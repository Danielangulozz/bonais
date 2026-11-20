import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { useArrayState, useArrayDispatch, useArrayDerived } from '../state/arrayState.js';
import { computeFieldGrid, calculatePointField } from '../core/field.js';
import { getPaletteIndex, MAGMA_UINT32_TABLE } from '../render/colormap.js';
import { generateContourSegments, drawContoursOnCanvas } from '../render/marchingSquares.js';
import { calculateAnalyticalGradient } from '../core/calculus/gradient.js';
import { findCriticalPoints } from '../core/calculus/criticalPoints.js';
import { calculateInPhaseFirstMinimumAngle } from '../core/farField.js';
import { ZoomIn, ZoomOut, RotateCcw, Crosshair, Check, X } from 'lucide-react';

const ISOVALUES_3DB = [];
for (let val = -39; val <= 12; val += 3) {
  ISOVALUES_3DB.push(val);
}

const parseCoord = (raw) => {
  const cleaned = String(raw).trim().replace(',', '.');
  if (!cleaned || cleaned === '-' || cleaned === '+' || cleaned === '.') return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return Math.max(-100, Math.min(100, n));
};

const formatEditableCoord = (val) => {
  if (!Number.isFinite(val)) return '0';
  const rounded = Math.round(val * 100) / 100;
  return Object.is(rounded, -0) ? '0' : String(rounded);
};

export default React.memo(function FieldMap() {
  const state = useArrayState();
  const dispatch = useArrayDispatch();
  const derived = useArrayDerived();

  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const offscreenCanvasRef = useRef(null);
  const xInputRef = useRef(null);

  const [hoverInfo, setHoverInfo] = useState(null);
  const [isHoveringPoint, setIsHoveringPoint] = useState(false);
  const [pointEditor, setPointEditor] = useState(null);
  const [isSettled, setIsSettled] = useState(true);
  const [canvasSize, setCanvasSize] = useState({ w: 600, h: 450 });
  const [dragState, setDragState] = useState(null);

  const lastHoverTimeRef = useRef(0);

  const mapSpan = state.mapSpan;
  const panOffset = useMemo(() => state.panOffset || { x: 0, y: 0 }, [state.panOffset]);
  const isDark = state.theme === 'dark';

  // Strict 1:1 isotropic scale (dx === dy, NO stretching!)
  const aspect = canvasSize.w / Math.max(canvasSize.h, 1);
  let halfX, halfY;
  if (aspect >= 1) {
    halfY = mapSpan;
    halfX = mapSpan * aspect;
  } else {
    halfX = mapSpan;
    halfY = mapSpan / aspect;
  }

  const xMin = panOffset.x - halfX;
  const xMax = panOffset.x + halfX;
  const yMin = panOffset.y - halfY;
  const yMax = panOffset.y + halfY;

  // ResizeObserver with requestAnimationFrame throttling
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let rafId = null;
    const observer = new ResizeObserver((entries) => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          if (width > 20 && height > 20) {
            setCanvasSize({ w: Math.round(width), h: Math.round(height) });
          }
        }
      });
    });
    observer.observe(container);
    return () => {
      observer.disconnect();
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  // Debounce settled state: during interaction, use ultra-fast 60fps grid
  useEffect(() => {
    setIsSettled(false);
    const timer = setTimeout(() => setIsSettled(true), 120);
    return () => clearTimeout(timer);
  }, [
    state.frequency, state.separation, state.delayRear,
    state.gainRearDB, state.gainFrontDB,
    state.polarityRear, state.polarityFront,
    state.temperature, mapSpan, panOffset.x, panOffset.y,
  ]);

  const criticalPoints = useMemo(() => {
    if (!state.layers.criticalPoints || !isSettled) return [];
    return findCriticalPoints({
      precomputedSources: derived.precomputedSources,
      k: derived.k, wavelength: derived.wavelength,
      xMin, xMax, yMin, yMax,
    });
  }, [state.layers.criticalPoints, isSettled, derived.precomputedSources, derived.k, derived.wavelength, xMin, xMax, yMin, yMax]);

  const asymptoticMin = useMemo(() => {
    if (state.preset !== 'in_phase') return null;
    return calculateInPhaseFirstMinimumAngle(state.separation, derived.wavelength);
  }, [state.preset, state.separation, derived.wavelength]);

  const worldToCanvas = useCallback(
    (wx, wy, cWidth, cHeight) => ({
      cx: ((wx - xMin) / (xMax - xMin)) * cWidth,
      cy: ((yMax - wy) / (yMax - yMin)) * cHeight,
    }),
    [xMin, xMax, yMin, yMax]
  );

  const canvasToWorld = useCallback(
    (cx, cy, cWidth, cHeight) => ({
      wx: xMin + (cx / cWidth) * (xMax - xMin),
      wy: yMax - (cy / cHeight) * (yMax - yMin),
    }),
    [xMin, xMax, yMin, yMax]
  );

  // Wheel zoom
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 0.88 : 1.14;
    const newSpan = Math.min(Math.max(mapSpan * zoomFactor, 2.5), 50.0);
    dispatch({ type: 'SET_MAP_SPAN', payload: newSpan });
  }, [mapSpan, dispatch]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  // Main canvas render — highly optimized
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (canvas.width !== canvasSize.w) {
      canvas.width = canvasSize.w;
    }
    if (canvas.height !== canvasSize.h) {
      canvas.height = canvasSize.h;
    }

    const ctx = canvas.getContext('2d');
    const width = canvasSize.w;
    const height = canvasSize.h;
    if (width <= 0 || height <= 0) return;

    const isContoursMode = state.viewMode === 'contours';

    // PERFORMANCE OPTIMIZATION:
    // When sliding / interacting: simBase = 60 (super fast 60 FPS!)
    // When settled: simBase = 140 (crisp & instantaneous!)
    const simBase = isSettled ? 140 : 60;
    const simHeight = aspect >= 1 ? simBase : Math.round(simBase / aspect);
    const simWidth = aspect >= 1 ? Math.round(simBase * aspect) : simBase;

    const { levelGrid } = computeFieldGrid({
      precomputedSources: derived.precomputedSources,
      k: derived.k,
      xMin, xMax, yMin, yMax,
      width: simWidth, height: simHeight,
    });

    if (isContoursMode) {
      ctx.fillStyle = isDark ? '#1A1B1E' : '#FFFFFF';
      ctx.fillRect(0, 0, width, height);
    } else {
      if (!offscreenCanvasRef.current) {
        offscreenCanvasRef.current = document.createElement('canvas');
      }
      const offscreen = offscreenCanvasRef.current;
      if (offscreen.width !== simWidth || offscreen.height !== simHeight) {
        offscreen.width = simWidth;
        offscreen.height = simHeight;
      }
      const offCtx = offscreen.getContext('2d');
      const imgData = offCtx.createImageData(simWidth, simHeight);
      const data32 = new Uint32Array(imgData.data.buffer);

      const total = simWidth * simHeight;
      for (let i = 0; i < total; i++) {
        data32[i] = MAGMA_UINT32_TABLE[getPaletteIndex(levelGrid[i], -40, 12)];
      }

      offCtx.putImageData(imgData, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(offscreen, 0, 0, width, height);
    }

    // Contours (only when settled or in contour mode)
    if ((state.layers.contours || isContoursMode) && isSettled) {
      const contourMap = generateContourSegments({
        levelGrid, width: simWidth, height: simHeight,
        xMin, xMax, yMin, yMax, isovalues: ISOVALUES_3DB,
      });
      drawContoursOnCanvas(
        ctx,
        contourMap,
        (wx, wy) => worldToCanvas(wx, wy, width, height),
        isContoursMode
          ? (isDark ? 'rgba(192, 132, 252, 0.5)' : 'rgba(124, 58, 237, 0.6)')
          : 'rgba(255, 255, 255, 0.22)'
      );
    }

    ctx.save();

    // Metric Grid
    ctx.strokeStyle = isContoursMode
      ? (isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.08)')
      : 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 4]);

    const stepM = mapSpan <= 6 ? 1 : mapSpan <= 16 ? 2 : 5;
    const startX = Math.floor(xMin / stepM) * stepM;
    const endX = Math.ceil(xMax / stepM) * stepM;
    for (let m = startX; m <= endX; m += stepM) {
      if (Math.abs(m) < 1e-4) continue;
      const { cx: px } = worldToCanvas(m, 0, width, height);
      ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, height); ctx.stroke();
    }

    const startY = Math.floor(yMin / stepM) * stepM;
    const endY = Math.ceil(yMax / stepM) * stepM;
    for (let m = startY; m <= endY; m += stepM) {
      if (Math.abs(m) < 1e-4) continue;
      const { cy: py } = worldToCanvas(0, m, width, height);
      ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(width, py); ctx.stroke();
    }
    ctx.setLineDash([]);

    // Axes (x=0, y=0)
    const { cx: origX, cy: origY } = worldToCanvas(0, 0, width, height);
    ctx.strokeStyle = isContoursMode
      ? (isDark ? 'rgba(255, 255, 255, 0.25)' : 'rgba(15, 23, 42, 0.25)')
      : 'rgba(255, 255, 255, 0.22)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, origY); ctx.lineTo(width, origY);
    ctx.moveTo(origX, 0); ctx.lineTo(origX, height);
    ctx.stroke();

    // Regions (Audience and Stage)
    if (state.layers.regions) {
      [{
        region: state.audienceRegion,
        fill: 'rgba(168, 85, 247, 0.05)',
        stroke: 'rgba(168, 85, 247, 0.35)',
        label: 'Zona Público', labelColor: 'rgba(168, 85, 247, 0.8)',
      }, {
        region: state.stageRegion,
        fill: 'rgba(244, 63, 94, 0.05)',
        stroke: 'rgba(244, 63, 94, 0.35)',
        label: 'Zona Escenario', labelColor: 'rgba(244, 63, 94, 0.8)',
      }].forEach(({ region, fill, stroke, label, labelColor }) => {
        const tl = worldToCanvas(region.xMin, region.yMax, width, height);
        const br = worldToCanvas(region.xMax, region.yMin, width, height);
        ctx.fillStyle = fill;
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 1;
        ctx.fillRect(tl.cx, tl.cy, br.cx - tl.cx, br.cy - tl.cy);
        ctx.strokeRect(tl.cx, tl.cy, br.cx - tl.cx, br.cy - tl.cy);
        // Malla de la suma de Riemann (punto medio) usada por ∬ E dA
        if (state.layers.integrationMesh) {
          const nMesh = 12;
          const cw = (br.cx - tl.cx) / nMesh;
          const ch = (br.cy - tl.cy) / nMesh;
          ctx.save();
          ctx.strokeStyle = stroke;
          ctx.globalAlpha = 0.55;
          ctx.lineWidth = 0.8;
          for (let i = 1; i < nMesh; i++) {
            ctx.beginPath(); ctx.moveTo(tl.cx + i * cw, tl.cy); ctx.lineTo(tl.cx + i * cw, br.cy); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(tl.cx, tl.cy + i * ch); ctx.lineTo(br.cx, tl.cy + i * ch); ctx.stroke();
          }
          ctx.globalAlpha = 0.9;
          ctx.fillStyle = labelColor;
          if (cw > 6 && ch > 6) {
            for (let j = 0; j < nMesh; j++) {
              for (let i = 0; i < nMesh; i++) {
                ctx.beginPath();
                ctx.arc(tl.cx + (i + 0.5) * cw, tl.cy + (j + 0.5) * ch, 1.3, 0, 2 * Math.PI);
                ctx.fill();
              }
            }
          }
          ctx.restore();
        }

        const areaM2 = (region.xMax - region.xMin) * (region.yMax - region.yMin);
        ctx.fillStyle = labelColor;
        ctx.font = '600 10px "IBM Plex Sans JP", sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`${label} · ${areaM2.toFixed(0)} m²`, tl.cx + 6, tl.cy + 14);
      });
    }

    // Asymptotic minima lines
    if (state.layers.asymptoticMinima && asymptoticMin && asymptoticMin.exists) {
      ctx.strokeStyle = 'rgba(244, 63, 94, 0.4)';
      ctx.setLineDash([5, 5]);
      ctx.lineWidth = 1;
      const angleRad = (asymptoticMin.angleDeg * Math.PI) / 180;
      const length = mapSpan * 2;
      [
        { dx: length * Math.sin(angleRad), dy: length * Math.cos(angleRad) },
        { dx: -length * Math.sin(angleRad), dy: length * Math.cos(angleRad) },
        { dx: length * Math.sin(angleRad), dy: -length * Math.cos(angleRad) },
        { dx: -length * Math.sin(angleRad), dy: -length * Math.cos(angleRad) },
      ].forEach((ray) => {
        const p1 = worldToCanvas(0, 0, width, height);
        const p2 = worldToCanvas(ray.dx, ray.dy, width, height);
        ctx.beginPath(); ctx.moveTo(p1.cx, p1.cy); ctx.lineTo(p2.cx, p2.cy); ctx.stroke();
      });
      ctx.setLineDash([]);
    }

    // Critical points
    if (state.layers.criticalPoints && isSettled && criticalPoints.length > 0) {
      criticalPoints.forEach((pt) => {
        const { cx, cy } = worldToCanvas(pt.x, pt.y, width, height);
        ctx.lineWidth = 1.5;
        if (pt.type === 'minimum') {
          ctx.strokeStyle = '#A855F7'; ctx.fillStyle = 'rgba(168, 85, 247, 0.4)';
          ctx.beginPath(); ctx.arc(cx, cy, 5, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
        } else if (pt.type === 'maximum') {
          ctx.strokeStyle = '#10B981'; ctx.fillStyle = 'rgba(16, 185, 129, 0.4)';
          ctx.beginPath(); ctx.moveTo(cx, cy - 6); ctx.lineTo(cx + 6, cy + 5); ctx.lineTo(cx - 6, cy + 5); ctx.closePath(); ctx.fill(); ctx.stroke();
        } else if (pt.type === 'saddle') {
          ctx.strokeStyle = '#F43F5E'; ctx.fillStyle = 'rgba(244, 63, 94, 0.4)';
          ctx.strokeRect(cx - 5, cy - 5, 10, 10); ctx.fillRect(cx - 5, cy - 5, 10, 10);
        }
      });
    }

    // Speakers / Subwoofers — with ANTI-COLLISION LABELS
    derived.sources.forEach((s) => {
      const { cx, cy } = worldToCanvas(s.x, s.y, width, height);
      const isFront = s.x >= 0;
      const isRear = s.polarity === -1;

      // Glow effect
      ctx.shadowColor = isRear ? '#F43F5E' : '#A855F7';
      ctx.shadowBlur = 12;
      ctx.fillStyle = isRear ? '#F43F5E' : '#A855F7';
      ctx.beginPath();
      ctx.arc(cx, cy, 8.5, 0, 2 * Math.PI);
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.6;
      ctx.stroke();

      // Sign inside speaker circle (+ or -)
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(s.polarity === -1 ? '−' : '+', cx, cy + 0.5);

      // Label: Stagger horizontally so S1 and S2 NEVER collide
      const labelText = isFront ? 'S2 (Frontal)' : 'S1 (Trasera)';
      ctx.font = '600 10px "IBM Plex Sans JP", sans-serif';
      const textMetrics = ctx.measureText(labelText);
      const textW = textMetrics.width;

      const labelX = isFront ? cx + 14 : cx - 14;
      const labelY = cy + 3.5;
      ctx.textAlign = isFront ? 'left' : 'right';

      // Theme-adaptive badge behind text for crisp readability
      ctx.fillStyle = isDark ? 'rgba(26, 27, 30, 0.88)' : 'rgba(255, 255, 255, 0.92)';
      const pad = 3;
      const pillX = isFront ? labelX - pad : labelX - textW - pad;
      ctx.beginPath();
      ctx.roundRect(pillX, labelY - 10, textW + pad * 2, 14, 4);
      ctx.fill();
      ctx.strokeStyle = isFront
        ? (isDark ? 'rgba(168, 85, 247, 0.5)' : 'rgba(124, 58, 237, 0.4)')
        : (isDark ? 'rgba(244, 63, 94, 0.5)' : 'rgba(225, 29, 72, 0.4)');
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = isDark
        ? (isFront ? '#D8B4FE' : '#FDA4AF')
        : (isFront ? '#6B21A8' : '#BE123C');
      ctx.fillText(labelText, labelX, labelY);
    });

    // Inspected point & Gradient vector
    if (state.inspectedPoint) {
      const { cx, cy } = worldToCanvas(state.inspectedPoint.x, state.inspectedPoint.y, width, height);
      if (isHoveringPoint || pointEditor) {
        ctx.save();
        ctx.fillStyle = isDark ? 'rgba(168, 85, 247, 0.22)' : 'rgba(124, 58, 237, 0.16)';
        ctx.strokeStyle = isDark ? 'rgba(216, 180, 254, 0.75)' : 'rgba(124, 58, 237, 0.65)';
        ctx.lineWidth = 1.25;
        ctx.beginPath();
        ctx.arc(cx, cy, 13, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
      ctx.strokeStyle = isDark ? '#FFFFFF' : '#0F172A';
      ctx.lineWidth = isHoveringPoint || pointEditor ? 1.8 : 1.4;
      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, 2 * Math.PI);
      ctx.moveTo(cx - 9, cy); ctx.lineTo(cx + 9, cy);
      ctx.moveTo(cx, cy - 9); ctx.lineTo(cx, cy + 9);
      ctx.stroke();

      if (state.layers.gradientVector) {
        const grad = calculateAnalyticalGradient(state.inspectedPoint.x, state.inspectedPoint.y, derived.precomputedSources, derived.k);
        if (grad.gradMagE > 1e-6) {
          const arrowLen = 34;
          const nx = grad.gradE_x / grad.gradMagE;
          const ny = grad.gradE_y / grad.gradMagE;
          const tx = cx + nx * arrowLen;
          const ty = cy - ny * arrowLen;
          const vectorColor = isDark ? '#C084FC' : '#7C3AED';
          ctx.strokeStyle = vectorColor;
          ctx.fillStyle = vectorColor;
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(tx, ty); ctx.stroke();
          const ha = Math.atan2(ty - cy, tx - cx);
          ctx.beginPath(); ctx.moveTo(tx, ty);
          ctx.lineTo(tx - 6 * Math.cos(ha - Math.PI / 6), ty - 6 * Math.sin(ha - Math.PI / 6));
          ctx.lineTo(tx - 6 * Math.cos(ha + Math.PI / 6), ty - 6 * Math.sin(ha + Math.PI / 6));
          ctx.closePath(); ctx.fill();
        }
      }
    }

    ctx.restore();
  }, [
    isSettled, derived, state.layers, state.inspectedPoint,
    state.audienceRegion, state.stageRegion, state.viewMode,
    criticalPoints, asymptoticMin, mapSpan, aspect, isDark,
    xMin, xMax, yMin, yMax, worldToCanvas, canvasSize,
    isHoveringPoint, pointEditor,
  ]);

  // Focus & select X input when coordinate editor opens
  const isEditorOpen = Boolean(pointEditor);
  useEffect(() => {
    if (!isEditorOpen) return undefined;
    const id = requestAnimationFrame(() => {
      xInputRef.current?.focus();
      xInputRef.current?.select();
    });
    return () => cancelAnimationFrame(id);
  }, [isEditorOpen]);

  const openPointEditor = useCallback((targetPoint = state.inspectedPoint, customAnchor = null) => {
    const pt = targetPoint || { x: 0, y: 0 };
    const { cx, cy } = customAnchor || worldToCanvas(pt.x, pt.y, canvasSize.w, canvasSize.h);
    const popW = 248;
    const popH = 196;
    // Place next to crosshair, clamped neatly inside viewport away from top/bottom HUD pills
    let left = cx + 18;
    if (left + popW > canvasSize.w - 14) {
      left = cx - popW - 18;
    }
    left = Math.max(14, Math.min(canvasSize.w - popW - 14, left));
    const top = Math.max(54, Math.min(canvasSize.h - popH - 54, cy - 34));

    setPointEditor({
      xStr: formatEditableCoord(pt.x),
      yStr: formatEditableCoord(pt.y),
      left,
      top,
    });
  }, [state.inspectedPoint, worldToCanvas, canvasSize.w, canvasSize.h]);

  const applyManualPoint = useCallback((xVal, yVal) => {
    if (!Number.isFinite(xVal) || !Number.isFinite(yVal)) return;
    const x = Math.max(-100, Math.min(100, xVal));
    const y = Math.max(-100, Math.min(100, yVal));
    dispatch({ type: 'SET_INSPECTED_POINT', payload: { x, y } });
    // If the entered point is outside the current viewport, center the camera on it
    if (x < xMin || x > xMax || y < yMin || y > yMax) {
      dispatch({ type: 'SET_PAN_OFFSET', payload: { x, y } });
    }
    setPointEditor(null);
  }, [dispatch, xMin, xMax, yMin, yMax]);

  const handleEditorSubmit = useCallback((e) => {
    e.preventDefault();
    if (!pointEditor) return;
    const x = parseCoord(pointEditor.xStr);
    const y = parseCoord(pointEditor.yStr);
    if (x === null || y === null) return;
    applyManualPoint(x, y);
  }, [pointEditor, applyManualPoint]);

  // Pointer interaction: Drag to pan with PointerCapture vs Click to inspect
  const handlePointerDown = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (err) {
      // ignore
    }

    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;

    setDragState({
      pointerId: e.pointerId,
      startX: cx,
      startY: cy,
      startPanX: panOffset.x,
      startPanY: panOffset.y,
      moved: false,
    });
  }, [panOffset]);

  const handlePointerMove = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;

    if (dragState) {
      const dxPx = cx - dragState.startX;
      const dyPx = cy - dragState.startY;
      if (Math.hypot(dxPx, dyPx) > 3) {
        const metersPerPixelX = (xMax - xMin) / rect.width;
        const metersPerPixelY = (yMax - yMin) / rect.height;
        const nextPanX = dragState.startPanX - dxPx * metersPerPixelX;
        const nextPanY = dragState.startPanY + dyPx * metersPerPixelY;
        dispatch({ type: 'SET_PAN_OFFSET', payload: { x: nextPanX, y: nextPanY } });
        setDragState(prev => prev ? { ...prev, moved: true } : null);
        if (pointEditor) setPointEditor(null);
        return;
      }
    }

    const now = performance.now();
    if (now - lastHoverTimeRef.current < 35) return;
    lastHoverTimeRef.current = now;

    if (state.inspectedPoint) {
      const ptPx = worldToCanvas(state.inspectedPoint.x, state.inspectedPoint.y, rect.width, rect.height);
      const nearPt = Math.hypot(cx - ptPx.cx, cy - ptPx.cy) <= 16;
      setIsHoveringPoint((prev) => (prev === nearPt ? prev : nearPt));
    }

    // 100% exact projection to world coordinates using actual bounding rect
    const { wx, wy } = canvasToWorld(cx, cy, rect.width, rect.height);
    const ptField = calculatePointField(wx, wy, derived.precomputedSources, derived.k);
    setHoverInfo({ x: wx, y: wy, levelDB: ptField.levelDB });
  }, [dragState, canvasToWorld, worldToCanvas, state.inspectedPoint, derived.precomputedSources, derived.k, xMin, xMax, yMin, yMax, dispatch, pointEditor]);

  const handlePointerUp = useCallback((e) => {
    const canvas = canvasRef.current;
    if (canvas && dragState?.pointerId !== undefined) {
      try {
        canvas.releasePointerCapture(dragState.pointerId);
      } catch (err) {
        // ignore
      }
    }

    if (dragState && !dragState.moved && canvas) {
      const rect = canvas.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;

      // Avoid jittering the inspected point when clicking directly on its crosshair (e.g., to double-click it)
      const ptPx = state.inspectedPoint
        ? worldToCanvas(state.inspectedPoint.x, state.inspectedPoint.y, rect.width, rect.height)
        : null;
      const clickedOnCrosshair = ptPx && Math.hypot(cx - ptPx.cx, cy - ptPx.cy) <= 14;

      if (!clickedOnCrosshair) {
        const { wx, wy } = canvasToWorld(cx, cy, rect.width, rect.height);
        dispatch({ type: 'SET_INSPECTED_POINT', payload: { x: wx, y: wy } });
        if (pointEditor) setPointEditor(null);
      }
    }
    setDragState(null);
  }, [dragState, canvasToWorld, worldToCanvas, state.inspectedPoint, dispatch, pointEditor]);

  const handleDoubleClick = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;

    const ptPx = state.inspectedPoint
      ? worldToCanvas(state.inspectedPoint.x, state.inspectedPoint.y, rect.width, rect.height)
      : null;
    const nearCrosshair = ptPx && Math.hypot(cx - ptPx.cx, cy - ptPx.cy) <= 24;

    if (nearCrosshair) {
      openPointEditor(state.inspectedPoint, ptPx);
    } else {
      const { wx, wy } = canvasToWorld(cx, cy, rect.width, rect.height);
      const nextPt = { x: Math.round(wx * 100) / 100, y: Math.round(wy * 100) / 100 };
      dispatch({ type: 'SET_INSPECTED_POINT', payload: nextPt });
      openPointEditor(nextPt, { cx, cy });
    }
  }, [state.inspectedPoint, worldToCanvas, canvasToWorld, dispatch, openPointEditor]);

  const handlePointerCancel = useCallback(() => {
    setDragState(null);
  }, []);

  const handleZoom = (direction) => {
    const factor = direction === 'in' ? 0.8 : 1.25;
    const newSpan = Math.min(Math.max(mapSpan * factor, 2.5), 50.0);
    dispatch({ type: 'SET_MAP_SPAN', payload: newSpan });
  };

  const handleReset = () => {
    dispatch({ type: 'RESET_VIEW' });
  };

  const isReversedWarning = state.polarityRear === 1 && state.delayRear > 0;

  // Live preview of dB level for typed coordinates inside the manual popover
  const editorPreview = useMemo(() => {
    if (!pointEditor) return null;
    const x = parseCoord(pointEditor.xStr);
    const y = parseCoord(pointEditor.yStr);
    if (x === null || y === null) return { valid: false };
    const ptField = calculatePointField(x, y, derived.precomputedSources, derived.k);
    return { valid: true, x, y, levelDB: ptField.levelDB };
  }, [pointEditor, derived.precomputedSources, derived.k]);

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden select-none bg-white dark:bg-[#1A1B1E]">
      {/* ═══ FULL-BLEED CANVAS VIEWPORT ═══ */}
      <canvas
        ref={canvasRef}
        width={canvasSize.w}
        height={canvasSize.h}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onDoubleClick={handleDoubleClick}
        onPointerLeave={() => {
          if (!dragState) {
            setHoverInfo(null);
            setIsHoveringPoint(false);
          }
        }}
        className={`absolute inset-0 w-full h-full touch-none ${
          dragState?.moved
            ? 'cursor-grabbing'
            : isHoveringPoint
              ? 'cursor-pointer'
              : 'cursor-crosshair'
        }`}
        aria-label="Mapa interactivo del campo acústico"
      />

      {/* ═══ FLOATING MANUAL COORDINATE EDITOR (Double-click on point/map or HUD pill) ═══ */}
      {pointEditor && (
        <form
          onSubmit={handleEditorSubmit}
          onPointerDown={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
          onWheel={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.stopPropagation();
              setPointEditor(null);
            }
          }}
          style={{ left: pointEditor.left, top: pointEditor.top }}
          className="absolute z-30 w-[248px] landing-glass rounded-2xl p-3 flex flex-col gap-2.5 animate-fade-in shadow-2xl"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-[11.5px] font-medium text-text">
              <Crosshair className="h-3.5 w-3.5 text-purple-dark dark:text-purple-light" />
              <span>Coordenadas de P(x, y)</span>
            </div>
            <button
              type="button"
              onClick={() => setPointEditor(null)}
              className="h-5 w-5 grid place-items-center rounded-full text-muted hover:text-text hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
              title="Cerrar (Esc)"
            >
              <X className="h-3 w-3" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] text-muted">x (m)</span>
              <input
                ref={xInputRef}
                type="text"
                inputMode="decimal"
                value={pointEditor.xStr}
                onChange={(e) => setPointEditor((prev) => prev ? { ...prev, xStr: e.target.value } : null)}
                className="w-full rounded-xl sim-card px-2.5 py-1.5 text-[12px] font-medium tabular-nums text-text focus:outline-none focus:border-purple/60"
                placeholder="5,0"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] text-muted">y (m)</span>
              <input
                type="text"
                inputMode="decimal"
                value={pointEditor.yStr}
                onChange={(e) => setPointEditor((prev) => prev ? { ...prev, yStr: e.target.value } : null)}
                className="w-full rounded-xl sim-card px-2.5 py-1.5 text-[12px] font-medium tabular-nums text-text focus:outline-none focus:border-purple/60"
                placeholder="0,0"
              />
            </label>
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className="text-[10.5px] text-muted tabular-nums">
              {editorPreview?.valid
                ? <>Nivel: <strong className="font-semibold text-purple-dark dark:text-[#D8B4FE]">{editorPreview.levelDB.toFixed(1).replace('.', ',')} dB</strong></>
                : 'Ingresa valores numéricos'}
            </span>
            <button
              type="submit"
              disabled={!editorPreview?.valid}
              className="inline-flex items-center gap-1 rounded-full bg-[#7C3AED] hover:bg-[#8B5CF6] disabled:opacity-40 px-3 py-1 text-[11px] font-medium text-white transition-colors"
            >
              <Check className="h-3 w-3" />
              <span>Ubicar</span>
            </button>
          </div>

          {/* Accesos rápidos de coordenadas clave */}
          <div className="pt-1.5 border-t border-border flex items-center gap-1">
            {[
              { label: `Púb (${state.referenceDistance}; 0)`, x: state.referenceDistance, y: 0 },
              { label: `Esc (−${state.referenceDistance}; 0)`, x: -state.referenceDistance, y: 0 },
              { label: '(0; 0)', x: 0, y: 0 },
            ].map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => applyManualPoint(preset.x, preset.y)}
                className="flex-1 rounded-lg sim-card px-1.5 py-1 text-[9.5px] tabular-nums text-muted hover:text-text transition-colors text-center truncate"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </form>
      )}

      {/* ═══ FLOATING HUD TOP: Orientation & Cursor Telemetry ═══ */}
      <div className="absolute top-3 inset-x-3 z-10 flex items-center justify-between gap-2 pointer-events-none">
        <div className="landing-glass rounded-full px-3.5 py-1.5 flex items-center gap-2.5 text-[11px] pointer-events-auto">
          <span className="font-medium text-text">Campo 2D</span>
          <span className="text-muted tabular-nums">±{mapSpan.toFixed(0)} m</span>
          <span className="hidden md:inline-flex items-center gap-1.5 text-[10.5px] text-muted border-l border-border pl-2.5">
            <span className="text-red dark:text-[#FB7185] font-medium">Escenario (−x)</span>
            <span className="opacity-50">↔</span>
            <span className="text-purple-dark dark:text-[#D8B4FE] font-medium">Público (+x)</span>
          </span>
        </div>

        <div className="flex items-center gap-2 pointer-events-auto">
          {hoverInfo ? (
            <div className="landing-glass rounded-full px-3.5 py-1.5 flex items-center gap-2.5 text-[11px] tabular-nums">
              <span className="text-muted">
                ({hoverInfo.x.toFixed(1).replace('.', ',')}; {hoverInfo.y.toFixed(1).replace('.', ',')}) m
              </span>
              <span className="font-semibold text-purple-dark dark:text-[#D8B4FE]">{hoverInfo.levelDB.toFixed(1).replace('.', ',')} dB</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => openPointEditor(state.inspectedPoint)}
              onDoubleClick={() => openPointEditor(state.inspectedPoint)}
              className="landing-glass rounded-full px-3 py-1.5 flex items-center gap-1.5 text-[10.5px] text-muted hover:text-text transition-colors tabular-nums"
              title="Clic aquí o doble clic en el punto para escribir coordenadas (x, y) manualmente"
            >
              <Crosshair className="h-3 w-3 text-purple-dark dark:text-purple-light" />
              <span>
                P({state.inspectedPoint.x.toFixed(1).replace('.', ',')}; {state.inspectedPoint.y.toFixed(1).replace('.', ',')}) m
              </span>
              <span className="hidden xl:inline opacity-65">· Doble clic: editar</span>
            </button>
          )}

          {isReversedWarning && (
            <span className="landing-glass rounded-full px-3 py-1.5 text-[10.5px] font-medium text-red dark:text-[#FB7185] border-[#F43F5E]/40">
              ⚠️ Emite a escenario
            </span>
          )}
        </div>
      </div>

      {/* ═══ FLOATING HUD BOTTOM: Zoom, Scale & Layer Pills ═══ */}
      <div className="absolute bottom-3 inset-x-3 z-10 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        {/* Left Pill: Zoom Controls & Span Presets */}
        <div className="landing-glass rounded-full px-2 py-1 flex items-center gap-1 pointer-events-auto">
          <button
            type="button"
            onClick={() => handleZoom('in')}
            className="h-6 w-6 grid place-items-center rounded-full text-muted hover:text-text hover:bg-white/10 transition-colors"
            title="Acercar (Zoom In)"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => handleZoom('out')}
            className="h-6 w-6 grid place-items-center rounded-full text-muted hover:text-text hover:bg-white/10 transition-colors"
            title="Alejar (Zoom Out)"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="h-6 w-6 grid place-items-center rounded-full text-muted hover:text-text hover:bg-white/10 transition-colors"
            title="Restablecer vista a ±12m"
          >
            <RotateCcw className="h-3 w-3" />
          </button>

          <div className="w-px h-3.5 bg-border mx-0.5" />

          {[3, 12, 25].map((val) => (
            <button
              key={val}
              type="button"
              onClick={() => dispatch({ type: 'SET_MAP_SPAN', payload: val })}
              className={`px-2 py-0.5 rounded-full text-[10.5px] tabular-nums transition-all ${
                Math.abs(mapSpan - val) < 1.5
                  ? 'bg-white text-[#0B0712] font-medium'
                  : 'text-muted hover:text-text'
              }`}
            >
              {val} m
            </button>
          ))}

          {state.viewMode !== 'contours' && (
            <div className="hidden xl:flex items-center gap-1.5 pl-2 pr-1 border-l border-border ml-1">
              <span className="text-[9.5px] text-muted tabular-nums">−40</span>
              <div
                className="h-1.5 w-14 rounded-full opacity-90"
                style={{
                  background: 'linear-gradient(to right, #0e0f1e, #28114b, #64186e, #b43664, #f0733c, #fac850, #fcfdbf)',
                }}
              />
              <span className="text-[9.5px] text-muted tabular-nums">+12 dB</span>
            </div>
          )}
        </div>

        {/* Right Pill: Layer Toggles */}
        <div className="landing-glass rounded-full p-1 flex items-center gap-0.5 pointer-events-auto">
          {[
            { key: 'contours', label: 'Curvas' },
            { key: 'gradientVector', label: '∇E' },
            { key: 'criticalPoints', label: 'Pt. Crít.' },
            { key: 'integrationMesh', label: 'Malla ∬' },
          ].map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => dispatch({ type: 'TOGGLE_LAYER', payload: key })}
              className={`rounded-full px-2.5 py-1 text-[10.5px] transition-all ${
                state.layers[key]
                  ? 'bg-[#7C3AED] text-white font-medium shadow-[0_2px_10px_rgba(124,58,237,0.4)]'
                  : 'text-muted hover:text-text'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
});
