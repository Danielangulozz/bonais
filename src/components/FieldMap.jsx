import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { useArray } from '../state/arrayState.js';
import { computeFieldGrid, calculatePointField } from '../core/field.js';
import { getPaletteIndex, MAGMA_UINT32_TABLE } from '../render/colormap.js';
import { generateContourSegments, drawContoursOnCanvas } from '../render/marchingSquares.js';
import { calculateAnalyticalGradient } from '../core/calculus/gradient.js';
import { findCriticalPoints } from '../core/calculus/criticalPoints.js';
import { calculateInPhaseFirstMinimumAngle } from '../core/farField.js';
import { Crosshair } from 'lucide-react';

const ISOVALUES_3DB = [];
for (let val = -39; val <= 12; val += 3) {
  ISOVALUES_3DB.push(val);
}

export default function FieldMap() {
  const { state, dispatch, derived } = useArray();
  const canvasRef = useRef(null);

  const [hoverInfo, setHoverInfo] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isSettled, setIsSettled] = useState(true);

  const mapSpan = state.mapSpan;
  const xMin = -mapSpan;
  const xMax = mapSpan;
  const yMin = -mapSpan;
  const yMax = mapSpan;

  // Debounce para renderizado progresivo de alta resolución
  useEffect(() => {
    setIsSettled(false);
    const timer = setTimeout(() => {
      setIsSettled(true);
    }, 120);
    return () => clearTimeout(timer);
  }, [
    state.frequency,
    state.separation,
    state.delayRear,
    state.gainRearDB,
    state.gainFrontDB,
    state.polarityRear,
    state.polarityFront,
    state.temperature,
    mapSpan,
  ]);

  // Puntos críticos: solo cuando el estado está en reposo para máximo rendimiento
  const criticalPoints = useMemo(() => {
    if (!state.layers.criticalPoints || !isSettled) return [];
    return findCriticalPoints({
      precomputedSources: derived.precomputedSources,
      k: derived.k,
      wavelength: derived.wavelength,
      xMin,
      xMax,
      yMin,
      yMax,
    });
  }, [state.layers.criticalPoints, isSettled, derived.precomputedSources, derived.k, derived.wavelength, xMin, xMax, yMin, yMax]);

  // Primer mínimo lateral para subs en fase
  const asymptoticMin = useMemo(() => {
    if (state.preset !== 'in_phase') return null;
    return calculateInPhaseFirstMinimumAngle(state.separation, derived.wavelength);
  }, [state.preset, state.separation, derived.wavelength]);

  // Conversión coordenadas físicas <-> canvas
  const worldToCanvas = useCallback(
    (wx, wy, cWidth, cHeight) => {
      const cx = ((wx - xMin) / (xMax - xMin)) * cWidth;
      const cy = ((yMax - wy) / (yMax - yMin)) * cHeight;
      return { cx, cy };
    },
    [xMin, xMax, yMin, yMax]
  );

  const canvasToWorld = useCallback(
    (cx, cy, cWidth, cHeight) => {
      const wx = xMin + (cx / cWidth) * (xMax - xMin);
      const wy = yMax - (cy / cHeight) * (yMax - yMin);
      return { wx, wy };
    },
    [xMin, xMax, yMin, yMax]
  );

  // Renderizado optimizado a 60 FPS
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Resolución: 110x110 durante movimiento de sliders (instantáneo), 260x260 en reposo
    const simRes = isSettled ? 260 : 110;
    const { levelGrid } = computeFieldGrid({
      precomputedSources: derived.precomputedSources,
      k: derived.k,
      xMin,
      xMax,
      yMin,
      yMax,
      width: simRes,
      height: simRes,
    });

    // Escritura directa en ImageData Uint32Array
    const offscreen = document.createElement('canvas');
    offscreen.width = simRes;
    offscreen.height = simRes;
    const offCtx = offscreen.getContext('2d');
    const imgData = offCtx.createImageData(simRes, simRes);
    const data32 = new Uint32Array(imgData.data.buffer);

    for (let i = 0; i < simRes * simRes; i++) {
      data32[i] = MAGMA_UINT32_TABLE[getPaletteIndex(levelGrid[i], -40, 12)];
    }

    offCtx.putImageData(imgData, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(offscreen, 0, 0, width, height);

    // Curvas de nivel: solo en reposo para fluidez total al mover sliders
    if (state.layers.contours && isSettled) {
      const contourMap = generateContourSegments({
        levelGrid,
        width: simRes,
        height: simRes,
        xMin,
        xMax,
        yMin,
        yMax,
        isovalues: ISOVALUES_3DB,
      });

      drawContoursOnCanvas(
        ctx,
        contourMap,
        (wx, wy) => worldToCanvas(wx, wy, width, height),
        'rgba(255, 255, 255, 0.22)'
      );
    }

    // Cuadrícula y ejes de coordenadas
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);

    const stepM = mapSpan <= 15 ? 2 : 5;
    for (let m = -Math.floor(mapSpan); m <= Math.floor(mapSpan); m += stepM) {
      if (m === 0) continue;
      const { cx: px } = worldToCanvas(m, 0, width, height);
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, height);
      ctx.stroke();

      const { cy: py } = worldToCanvas(0, m, width, height);
      ctx.beginPath();
      ctx.moveTo(0, py);
      ctx.lineTo(width, py);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Ejes principales
    const { cx: origX, cy: origY } = worldToCanvas(0, 0, width, height);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.beginPath();
    ctx.moveTo(0, origY);
    ctx.lineTo(width, origY);
    ctx.moveTo(origX, 0);
    ctx.lineTo(origX, height);
    ctx.stroke();

    // Rótulos con acentos de color morado y rojo
    ctx.fillStyle = '#A855F7'; // Morado luminoso
    ctx.font = '600 11px "IBM Plex Sans JP", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('Público (+x) ►', width - 14, origY - 8);

    ctx.fillStyle = '#F43F5E'; // Rojo carmesí
    ctx.textAlign = 'left';
    ctx.fillText('◄ Escenario (−x)', 14, origY - 8);

    // Regiones Público (Morado) y Escenario (Rojo)
    if (state.layers.regions) {
      // Público
      const audTopLeft = worldToCanvas(state.audienceRegion.xMin, state.audienceRegion.yMax, width, height);
      const audBottomRight = worldToCanvas(state.audienceRegion.xMax, state.audienceRegion.yMin, width, height);
      ctx.fillStyle = 'rgba(168, 85, 247, 0.08)';
      ctx.strokeStyle = '#A855F7';
      ctx.lineWidth = 1.5;
      ctx.fillRect(audTopLeft.cx, audTopLeft.cy, audBottomRight.cx - audTopLeft.cx, audBottomRight.cy - audTopLeft.cy);
      ctx.strokeRect(audTopLeft.cx, audTopLeft.cy, audBottomRight.cx - audTopLeft.cx, audBottomRight.cy - audTopLeft.cy);
      ctx.fillStyle = '#A855F7';
      ctx.fillText('Público', audTopLeft.cx + 6, audTopLeft.cy + 14);

      // Escenario
      const stgTopLeft = worldToCanvas(state.stageRegion.xMin, state.stageRegion.yMax, width, height);
      const stgBottomRight = worldToCanvas(state.stageRegion.xMax, state.stageRegion.yMin, width, height);
      ctx.fillStyle = 'rgba(244, 63, 94, 0.08)';
      ctx.strokeStyle = '#F43F5E';
      ctx.lineWidth = 1.5;
      ctx.fillRect(stgTopLeft.cx, stgTopLeft.cy, stgBottomRight.cx - stgTopLeft.cx, stgBottomRight.cy - stgTopLeft.cy);
      ctx.strokeRect(stgTopLeft.cx, stgTopLeft.cy, stgBottomRight.cx - stgTopLeft.cx, stgBottomRight.cy - stgTopLeft.cy);
      ctx.fillStyle = '#F43F5E';
      ctx.fillText('Escenario', stgTopLeft.cx + 6, stgTopLeft.cy + 14);
    }

    // Líneas asintóticas de primer mínimo lateral
    if (state.layers.asymptoticMinima && asymptoticMin && asymptoticMin.exists) {
      ctx.strokeStyle = 'rgba(244, 63, 94, 0.6)';
      ctx.setLineDash([5, 5]);
      ctx.lineWidth = 1.5;

      const angleRad = (asymptoticMin.angleDeg * Math.PI) / 180;
      const length = mapSpan * 1.5;

      const rays = [
        { dx: length * Math.sin(angleRad), dy: length * Math.cos(angleRad) },
        { dx: -length * Math.sin(angleRad), dy: length * Math.cos(angleRad) },
        { dx: length * Math.sin(angleRad), dy: -length * Math.cos(angleRad) },
        { dx: -length * Math.sin(angleRad), dy: -length * Math.cos(angleRad) },
      ];

      rays.forEach((ray) => {
        const p1 = worldToCanvas(0, 0, width, height);
        const p2 = worldToCanvas(ray.dx, ray.dy, width, height);
        ctx.beginPath();
        ctx.moveTo(p1.cx, p1.cy);
        ctx.lineTo(p2.cx, p2.cy);
        ctx.stroke();
      });
      ctx.setLineDash([]);
    }

    // Puntos Críticos (círculo = mínimo, triángulo = máximo, cuadrado = silla)
    if (state.layers.criticalPoints && isSettled && criticalPoints.length > 0) {
      criticalPoints.forEach((pt) => {
        const { cx, cy } = worldToCanvas(pt.x, pt.y, width, height);
        ctx.lineWidth = 1.5;

        if (pt.type === 'minimum') {
          ctx.strokeStyle = '#A855F7';
          ctx.fillStyle = 'rgba(168, 85, 247, 0.4)';
          ctx.beginPath();
          ctx.arc(cx, cy, 5, 0, 2 * Math.PI);
          ctx.fill();
          ctx.stroke();
        } else if (pt.type === 'maximum') {
          ctx.strokeStyle = '#10B981';
          ctx.fillStyle = 'rgba(16, 185, 129, 0.4)';
          ctx.beginPath();
          ctx.moveTo(cx, cy - 6);
          ctx.lineTo(cx + 6, cy + 5);
          ctx.lineTo(cx - 6, cy + 5);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        } else if (pt.type === 'saddle') {
          ctx.strokeStyle = '#F43F5E';
          ctx.fillStyle = 'rgba(244, 63, 94, 0.4)';
          ctx.beginPath();
          ctx.strokeRect(cx - 5, cy - 5, 10, 10);
          ctx.fillRect(cx - 5, cy - 5, 10, 10);
        }
      });
    }

    // Altavoces Subwoofers
    derived.sources.forEach((s, idx) => {
      const { cx, cy } = worldToCanvas(s.x, s.y, width, height);

      // Disco exterior: Trasero rojo, frontal morado
      ctx.fillStyle = s.polarity === -1 ? '#E11D48' : '#7C3AED';
      ctx.beginPath();
      ctx.arc(cx, cy, 9, 0, 2 * Math.PI);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Símbolo + o -
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(s.polarity === -1 ? '−' : '+', cx, cy + 0.5);

      // Etiqueta
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '10px "IBM Plex Sans JP", sans-serif';
      ctx.fillText(
        `S${idx + 1} (${s.delay > 0 ? (s.delay * 1000).toFixed(2) + 'ms' : '0ms'})`,
        cx,
        cy + 18
      );
    });

    // Punto inspeccionado y flecha de gradiente
    if (state.inspectedPoint) {
      const { cx, cy } = worldToCanvas(state.inspectedPoint.x, state.inspectedPoint.y, width, height);

      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, 2 * Math.PI);
      ctx.moveTo(cx - 9, cy);
      ctx.lineTo(cx + 9, cy);
      ctx.moveTo(cx, cy - 9);
      ctx.lineTo(cx, cy + 9);
      ctx.stroke();

      if (state.layers.gradientVector) {
        const grad = calculateAnalyticalGradient(
          state.inspectedPoint.x,
          state.inspectedPoint.y,
          derived.precomputedSources,
          derived.k
        );

        if (grad.gradMagE > 1e-6) {
          const arrowLen = 34;
          const arrowNormX = grad.gradE_x / grad.gradMagE;
          const arrowNormY = grad.gradE_y / grad.gradMagE;

          const targetCx = cx + arrowNormX * arrowLen;
          const targetCy = cy - arrowNormY * arrowLen;

          ctx.strokeStyle = '#A855F7';
          ctx.fillStyle = '#A855F7';
          ctx.lineWidth = 2.5;

          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(targetCx, targetCy);
          ctx.stroke();

          const headAngle = Math.atan2(targetCy - cy, targetCx - cx);
          const headSize = 7;
          ctx.beginPath();
          ctx.moveTo(targetCx, targetCy);
          ctx.lineTo(
            targetCx - headSize * Math.cos(headAngle - Math.PI / 6),
            targetCy - headSize * Math.sin(headAngle - Math.PI / 6)
          );
          ctx.lineTo(
            targetCx - headSize * Math.cos(headAngle + Math.PI / 6),
            targetCy - headSize * Math.sin(headAngle + Math.PI / 6)
          );
          ctx.closePath();
          ctx.fill();
        }
      }
    }

    ctx.restore();
  }, [
    isSettled,
    derived,
    state.layers,
    state.inspectedPoint,
    state.audienceRegion,
    state.stageRegion,
    criticalPoints,
    asymptoticMin,
    mapSpan,
    xMin,
    xMax,
    yMin,
    yMax,
    worldToCanvas,
  ]);

  const handleMouseDown = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;

    const { wx, wy } = canvasToWorld(cx, cy, canvas.width, canvas.height);
    dispatch({ type: 'SET_INSPECTED_POINT', payload: { x: wx, y: wy } });
    setIsDragging(true);
  };

  const handleMouseMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;

    const { wx, wy } = canvasToWorld(cx, cy, canvas.width, canvas.height);

    const ptField = calculatePointField(wx, wy, derived.precomputedSources, derived.k);
    setHoverInfo({ x: wx, y: wy, levelDB: ptField.levelDB });

    if (isDragging) {
      dispatch({ type: 'SET_INSPECTED_POINT', payload: { x: wx, y: wy } });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <div className="flex-1 flex flex-col bg-surface border border-border rounded-2xl overflow-hidden shadow-sm relative">
      {/* Barra superior de herramientas y capas */}
      <div className="flex flex-wrap items-center justify-between border-b border-border/80 bg-surface px-4 py-2.5 text-xs gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-full bg-purple text-white px-3 py-1 font-medium shadow-sm"
          >
            <Crosshair className="h-3.5 w-3.5" />
            <span>Punto & Gradiente</span>
          </button>
        </div>

        {/* Capas conmutables tipo pill */}
        <div className="flex items-center gap-2 text-[11px]">
          <label className="inline-flex items-center gap-1.5 cursor-pointer rounded-full border border-border px-2.5 py-0.5 hover:bg-surface-2 transition-colors">
            <input
              type="checkbox"
              checked={state.layers.contours}
              onChange={() => dispatch({ type: 'TOGGLE_LAYER', payload: 'contours' })}
              className="accent-purple rounded"
            />
            <span className="text-text">Curvas 3 dB</span>
          </label>
          <label className="inline-flex items-center gap-1.5 cursor-pointer rounded-full border border-border px-2.5 py-0.5 hover:bg-surface-2 transition-colors">
            <input
              type="checkbox"
              checked={state.layers.gradientVector}
              onChange={() => dispatch({ type: 'TOGGLE_LAYER', payload: 'gradientVector' })}
              className="accent-purple rounded"
            />
            <span className="text-text">Vector ∇E</span>
          </label>
          <label className="inline-flex items-center gap-1.5 cursor-pointer rounded-full border border-border px-2.5 py-0.5 hover:bg-surface-2 transition-colors">
            <input
              type="checkbox"
              checked={state.layers.criticalPoints}
              onChange={() => dispatch({ type: 'TOGGLE_LAYER', payload: 'criticalPoints' })}
              className="accent-purple rounded"
            />
            <span className="text-text">Puntos Críticos</span>
          </label>
        </div>
      </div>

      {/* Canvas 2D */}
      <div className="relative flex-1 flex items-center justify-center p-3 bg-slate-950 min-h-[380px]">
        <canvas
          ref={canvasRef}
          width={640}
          height={480}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => {
            handleMouseUp();
            setHoverInfo(null);
          }}
          className="max-w-full h-auto rounded-xl border border-white/10 cursor-crosshair shadow-lg"
          aria-label="Mapa interactivo del campo acústico del arreglo"
        />

        {/* Coordenadas flotantes estilo HUD */}
        {hoverInfo && (
          <div className="absolute top-5 left-5 bg-slate-900/90 backdrop-blur-md border border-white/15 px-3 py-1.5 rounded-full text-xs font-mono shadow text-white pointer-events-none flex items-center gap-2">
            <span>x: {hoverInfo.x.toFixed(2)}m</span>
            <span>y: {hoverInfo.y.toFixed(2)}m</span>
            <span className="font-bold text-purple-light">| {hoverInfo.levelDB.toFixed(1)} dB</span>
          </div>
        )}
      </div>

      {/* Barra de escala en dB */}
      <div className="flex items-center justify-between px-5 py-2.5 bg-surface border-t border-border/80 text-[11px]">
        <span className="text-muted font-medium">Nivel SPL:</span>
        <div className="flex-1 mx-4 flex flex-col gap-1">
          <div
            className="h-2.5 w-full rounded-full"
            style={{
              background:
                'linear-gradient(to right, #0e0f1e, #28114b, #64186e, #b43664, #f0733c, #fac850, #fcfdbf)',
            }}
          />
          <div className="flex justify-between text-[10px] text-muted font-mono">
            <span>−40 dB</span>
            <span>−20 dB</span>
            <span>0 dB (ref)</span>
            <span>+6 dB</span>
            <span>+12 dB</span>
          </div>
        </div>
      </div>
    </div>
  );
}
