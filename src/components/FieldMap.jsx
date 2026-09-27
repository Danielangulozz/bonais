import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { useArrayState, useArrayDispatch, useArrayDerived } from '../state/arrayState.js';
import { computeFieldGrid, calculatePointField } from '../core/field.js';
import { getPaletteIndex, MAGMA_UINT32_TABLE } from '../render/colormap.js';
import { generateContourSegments, drawContoursOnCanvas } from '../render/marchingSquares.js';
import { calculateAnalyticalGradient } from '../core/calculus/gradient.js';
import { findCriticalPoints } from '../core/calculus/criticalPoints.js';
import { calculateInPhaseFirstMinimumAngle } from '../core/farField.js';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

const ISOVALUES_3DB = [];
for (let val = -39; val <= 12; val += 3) {
  ISOVALUES_3DB.push(val);
}

export default React.memo(function FieldMap() {
  const state = useArrayState();
  const dispatch = useArrayDispatch();
  const derived = useArrayDerived();

  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const offscreenCanvasRef = useRef(null);

  const [hoverInfo, setHoverInfo] = useState(null);
  const [isSettled, setIsSettled] = useState(true);
  const [canvasSize, setCanvasSize] = useState({ w: 600, h: 450 });
  const [dragState, setDragState] = useState(null);

  const lastHoverTimeRef = useRef(0);

  const mapSpan = state.mapSpan;
  const panOffset = state.panOffset || { x: 0, y: 0 };
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
      ctx.fillStyle = isDark ? '#090B14' : '#F8FAFC';
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
        ctx.fillStyle = labelColor;
        ctx.font = '600 10px "IBM Plex Sans JP", sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(label, tl.cx + 6, tl.cy + 14);
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
      ctx.fillStyle = isDark ? 'rgba(8, 10, 20, 0.85)' : 'rgba(255, 255, 255, 0.92)';
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
      ctx.strokeStyle = isDark ? '#FFFFFF' : '#0F172A';
      ctx.lineWidth = 1.4;
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
  ]);

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
        return;
      }
    }

    const now = performance.now();
    if (now - lastHoverTimeRef.current < 35) return;
    lastHoverTimeRef.current = now;

    // 100% exact projection to world coordinates using actual bounding rect
    const { wx, wy } = canvasToWorld(cx, cy, rect.width, rect.height);
    const ptField = calculatePointField(wx, wy, derived.precomputedSources, derived.k);
    setHoverInfo({ x: wx, y: wy, levelDB: ptField.levelDB });
  }, [dragState, canvasToWorld, derived.precomputedSources, derived.k, xMin, xMax, yMin, yMax, dispatch]);

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
      const { wx, wy } = canvasToWorld(cx, cy, rect.width, rect.height);
      dispatch({ type: 'SET_INSPECTED_POINT', payload: { x: wx, y: wy } });
    }
    setDragState(null);
  }, [dragState, canvasToWorld, dispatch]);

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

  return (
    <div className="w-full h-full flex flex-col relative overflow-hidden select-none bg-[#090B14]">
      {/* ═══ VIEWPORT TOP BAR: Fixed height h-8 (32px), NEVER expands or shrinks ═══ */}
      <div className="h-8 min-h-[32px] max-h-[32px] flex items-center justify-between px-3 glass-strong border-b border-border text-[11px] z-10 flex-shrink-0 overflow-hidden">
        <div className="flex items-center gap-2 font-mono">
          <span className="font-semibold text-text">Campo 2D</span>
          <span className="text-[10px] text-muted opacity-75">±{mapSpan.toFixed(0)}m</span>
          <span className="text-[9px] text-muted hidden md:inline opacity-60">Escenario (−x) ◄───► Público (+x)</span>
        </div>

        {/* HUD readout */}
        <div className="flex items-center gap-2">
          {hoverInfo ? (
            <div className="flex items-center gap-2 font-mono text-[10px] bg-purple/10 border border-purple/25 text-purple-dark dark:text-purple-light px-2.5 py-0.5 rounded-full shadow-sm">
              <span>x: {hoverInfo.x.toFixed(1)}m</span>
              <span>y: {hoverInfo.y.toFixed(1)}m</span>
              <strong className="font-bold">{hoverInfo.levelDB.toFixed(1)} dB</strong>
            </div>
          ) : (
            <span className="text-[10px] text-muted hidden sm:inline">Rueda: zoom · Arrastre: mover</span>
          )}

          {isReversedWarning && (
            <span className="text-[9px] font-semibold text-warm bg-warm/15 border border-warm/30 px-2 py-0.5 rounded-full">
              ⚠️ Emite a Escenario
            </span>
          )}
        </div>
      </div>

      {/* ═══ CANVAS VIEWPORT AREA ═══ */}
      <div ref={containerRef} className="flex-1 relative overflow-hidden">
        <canvas
          ref={canvasRef}
          width={canvasSize.w}
          height={canvasSize.h}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          onPointerLeave={() => { if (!dragState) setHoverInfo(null); }}
          className={`absolute inset-0 w-full h-full touch-none ${dragState?.moved ? 'cursor-grabbing' : 'cursor-crosshair'}`}
          aria-label="Mapa interactivo del campo acústico"
        />
      </div>

      {/* ═══ VIEWPORT BOTTOM FOOTER: Fixed height h-8 (32px), NEVER expands or shrinks ═══ */}
      <div className="h-8 min-h-[32px] max-h-[32px] flex items-center justify-between px-2.5 glass-strong border-t border-border z-10 gap-2 flex-shrink-0 overflow-hidden">
        {/* Left: Zoom Controls & Presets */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => handleZoom('in')}
            className="p-1 rounded-md text-muted hover:text-text hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            title="Acercar (Zoom In)"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => handleZoom('out')}
            className="p-1 rounded-md text-muted hover:text-text hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            title="Alejar (Zoom Out)"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="p-1 rounded-md text-muted hover:text-text hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            title="Restablecer vista a ±12m"
          >
            <RotateCcw className="h-3 w-3" />
          </button>

          <div className="w-px h-3.5 bg-border mx-1" />

          {[3, 12, 25].map((val) => (
            <button
              key={val}
              type="button"
              onClick={() => dispatch({ type: 'SET_MAP_SPAN', payload: val })}
              className={`px-1.5 py-0.5 rounded text-[9px] font-mono transition-colors ${
                Math.abs(mapSpan - val) < 1.5
                  ? 'bg-purple/20 text-purple-dark dark:text-purple-light font-bold border border-purple/30'
                  : 'text-muted hover:text-text'
              }`}
            >
              {val}m
            </button>
          ))}
        </div>

        {/* Center: Color gradient (only in heatmap view when space permits) */}
        {state.viewMode !== 'contours' && (
          <div className="hidden 2xl:flex items-center gap-1.5 pointer-events-none">
            <span className="text-[8px] text-muted font-mono">−40dB</span>
            <div
              className="h-1.5 w-16 rounded-full opacity-80"
              style={{
                background: 'linear-gradient(to right, #0e0f1e, #28114b, #64186e, #b43664, #f0733c, #fac850, #fcfdbf)',
              }}
            />
            <span className="text-[8px] text-muted font-mono">+12dB</span>
          </div>
        )}

        {/* Right: Layer Toggles */}
        <div className="flex items-center gap-1">
          {[
            { key: 'contours', label: 'Curvas' },
            { key: 'gradientVector', label: '∇ Grad' },
            { key: 'criticalPoints', label: 'Pt. Crít.' },
          ].map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => dispatch({ type: 'TOGGLE_LAYER', payload: key })}
              className={`rounded-md px-2 py-0.5 text-[9px] font-medium transition-all border ${
                state.layers[key]
                  ? 'text-purple-dark dark:text-purple-light bg-purple/15 dark:bg-purple/25 border-purple/30 font-semibold'
                  : 'text-muted hover:text-text border-transparent'
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
