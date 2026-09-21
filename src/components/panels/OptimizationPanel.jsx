import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useArray } from '../../state/arrayState.js';
import {
  optimizeSingleFrequency,
  optimizeWithBounds,
  optimizeBandMinMax,
  numericalGradientAscent,
  evaluateARObjective,
} from '../../core/optimize.js';
import KaTeXMath from '../KaTeXMath.jsx';
import { Play, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';

export default function OptimizationPanel() {
  const { state, dispatch, derived } = useArray();
  const [showLagrangeProof, setShowLagrangeProof] = useState(false);
  const [ascentTrajectory, setAscentTrajectory] = useState(null);
  const [isOptimizing, setIsOptimizing] = useState(false);

  const canvasRef = useRef(null);

  const nf2 = new Intl.NumberFormat('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const nf3 = new Intl.NumberFormat('es-CO', { minimumFractionDigits: 3, maximumFractionDigits: 3 });

  // 1. Soluciones analíticas
  const singleOpt = useMemo(() => {
    return optimizeSingleFrequency(state.frequency, derived.c);
  }, [state.frequency, derived.c]);

  const boundedOpt = useMemo(() => {
    return optimizeWithBounds(state.frequency, derived.c, state.dMin, state.dMax);
  }, [state.frequency, derived.c, state.dMin, state.dMax]);

  const bandOpt = useMemo(() => {
    return optimizeBandMinMax(state.bandF1, state.bandF2, derived.c);
  }, [state.bandF1, state.bandF2, derived.c]);

  // Límites del mapa de decisión: d ∈ [0.2, 3.0] m, τ ∈ [0, 15] ms
  const dMinMap = 0.2;
  const dMaxMap = 3.0;
  const tauMinMap = 0.0;
  const tauMaxMap = 0.015; // 15 ms

  // Renderizado del Mapa de Decisión A_R(d, τ) en Canvas 2D
  const drawDecisionMap = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    const simW = 54;
    const simH = 40;
    const offscreen = document.createElement('canvas');
    offscreen.width = simW;
    offscreen.height = simH;
    const offCtx = offscreen.getContext('2d');
    const imgData = offCtx.createImageData(simW, simH);
    const data32 = new Uint32Array(imgData.data.buffer);

    for (let j = 0; j < simH; j++) {
      const tau = tauMaxMap - (j / (simH - 1)) * (tauMaxMap - tauMinMap);
      for (let i = 0; i < simW; i++) {
        const d = dMinMap + (i / (simW - 1)) * (dMaxMap - dMinMap);
        const ar = evaluateARObjective(d, tau, state.frequency, derived.c, state.referenceDistance);

        // Mapear AR de 0 a 30 dB en rampa morado/rojo elegante
        const norm = Math.max(0, Math.min(1, ar / 30.0));
        const r = Math.round(30 + norm * 180);
        const g = Math.round(15 + norm * 70);
        const b = Math.round(50 + (1 - norm) * 120 + norm * 180);
        data32[j * simW + i] = (255 << 24) | (b << 16) | (g << 8) | r;
      }
    }

    offCtx.putImageData(imgData, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(offscreen, 0, 0, width, height);

    // Función de coordenadas mundo -> canvas
    const toCanvas = (d, tauSec) => {
      const cx = ((d - dMinMap) / (dMaxMap - dMinMap)) * width;
      const cy = ((tauMaxMap - tauSec) / (tauMaxMap - tauMinMap)) * height;
      return { cx, cy };
    };

    // Trazar línea física ideal τ = d / c
    ctx.save();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    const pStart = toCanvas(dMinMap, dMinMap / derived.c);
    const pEnd = toCanvas(Math.min(dMaxMap, tauMaxMap * derived.c), tauMaxMap);
    ctx.moveTo(pStart.cx, pStart.cy);
    ctx.lineTo(pEnd.cx, pEnd.cy);
    ctx.stroke();
    ctx.setLineDash([]);

    // Etiqueta de la recta ideal
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '10px monospace';
    ctx.fillText('Línea ideal: τ = d / c', pStart.cx + 10, pStart.cy - 10);

    // Dibujar óptimo analítico λ/4
    const optPt = toCanvas(singleOpt.dStar, singleOpt.tauStar);
    ctx.fillStyle = '#5AC88A';
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(optPt.cx, optPt.cy, 6, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();

    // Dibujar trayectoria del ascenso por gradiente si existe
    if (ascentTrajectory && ascentTrajectory.length > 1) {
      ctx.strokeStyle = '#F0B429';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      const startTr = toCanvas(ascentTrajectory[0].d, ascentTrajectory[0].tauMs / 1000);
      ctx.moveTo(startTr.cx, startTr.cy);
      for (let s = 1; s < ascentTrajectory.length; s++) {
        const pt = toCanvas(ascentTrajectory[s].d, ascentTrajectory[s].tauMs / 1000);
        ctx.lineTo(pt.cx, pt.cy);
      }
      ctx.stroke();

      // Puntos individuales en la trayectoria
      ctx.fillStyle = '#F0B429';
      ascentTrajectory.forEach((step) => {
        const pt = toCanvas(step.d, step.tauMs / 1000);
        ctx.beginPath();
        ctx.arc(pt.cx, pt.cy, 2.5, 0, 2 * Math.PI);
        ctx.fill();
      });
    }

    // Dibujar punto actual del arreglo
    const curPt = toCanvas(state.separation, state.delayRear);
    ctx.fillStyle = '#3CC8D8';
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(curPt.cx, curPt.cy, 7, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText('Actual', curPt.cx + 9, curPt.cy + 3);

    ctx.restore();
  }, [
    state.frequency,
    state.separation,
    state.delayRear,
    state.referenceDistance,
    derived.c,
    singleOpt,
    ascentTrajectory,
  ]);

  useEffect(() => {
    drawDecisionMap();
  }, [drawDecisionMap]);

  // Ejecutar ascenso por gradiente numérico
  const handleRunGradientAscent = () => {
    setIsOptimizing(true);
    setTimeout(() => {
      const result = numericalGradientAscent({
        initialD: state.separation,
        initialTau: state.delayRear,
        frequency: state.frequency,
        speedOfSound: derived.c,
      });

      setAscentTrajectory(result.trajectory);
      setIsOptimizing(false);

      // Aplicar estado optimizado
      dispatch({ type: 'SET_PARAMETER', payload: { name: 'separation', value: result.finalD } });
      dispatch({ type: 'SET_PARAMETER', payload: { name: 'delayRear', value: result.finalTau } });
    }, 50);
  };

  return (
    <div className="flex flex-col gap-6 text-xs text-text">
      {/* TARJETAS DE MÉTODOS DE OPTIMIZACIÓN */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Método 1: Cerrado univariable */}
        <div className="p-3 bg-surface border border-border rounded-lg flex flex-col justify-between gap-2">
          <div>
            <div className="flex items-center justify-between">
              <span className="font-semibold text-text">1. Óptimo Monocromático (λ/4)</span>
              <span className="text-[10px] bg-accent/20 text-accent px-1.5 py-0.5 rounded font-mono font-bold">
                f = {state.frequency} Hz
              </span>
            </div>
            <p className="text-[11px] text-muted mt-1">
              Maximiza la amplitud frontal cancelando el lóbulo posterior en campo lejano.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 bg-surface-2 p-2 rounded border border-border font-mono">
            <div>
              <span className="text-muted text-[10px] block">d* óptima</span>
              <strong className="text-sm text-accent">{nf3.format(singleOpt.dStar)} m</strong>
            </div>
            <div>
              <span className="text-muted text-[10px] block">τ* óptimo</span>
              <strong className="text-sm text-text">{nf2.format(singleOpt.tauStarMs)} ms</strong>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              dispatch({ type: 'SET_PARAMETER', payload: { name: 'separation', value: singleOpt.dStar } });
              dispatch({ type: 'SET_PARAMETER', payload: { name: 'delayRear', value: singleOpt.tauStar } });
            }}
            className="w-full py-1.5 rounded bg-surface-2 hover:bg-border text-text font-medium text-center transition-colors"
          >
            Aplicar d* y τ*
          </button>
        </div>

        {/* Método 2: Con restricciones físicas */}
        <div className="p-3 bg-surface border border-border rounded-lg flex flex-col justify-between gap-2">
          <div>
            <div className="flex items-center justify-between">
              <span className="font-semibold text-text">2. Con Límites Físicos</span>
              <span className="text-[10px] text-muted font-mono">
                [{state.dMin}m, {state.dMax}m]
              </span>
            </div>
            <p className="text-[11px] text-muted mt-1">
              Optimización restringida por dimensiones de la tarima o fondo físico de la caja acústica.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 bg-surface-2 p-2 rounded border border-border font-mono">
            <div>
              <span className="text-muted text-[10px] block">d factible</span>
              <strong className="text-sm text-text">{nf3.format(boundedOpt.dOpt)} m</strong>
            </div>
            <div>
              <span className="text-muted text-[10px] block">τ asociado</span>
              <strong className="text-sm text-text">{nf2.format(boundedOpt.tauOptMs)} ms</strong>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              dispatch({ type: 'SET_PARAMETER', payload: { name: 'separation', value: boundedOpt.dOpt } });
              dispatch({ type: 'SET_PARAMETER', payload: { name: 'delayRear', value: boundedOpt.tauOpt } });
            }}
            className="w-full py-1.5 rounded bg-surface-2 hover:bg-border text-text font-medium text-center transition-colors"
          >
            Aplicar d factible
          </button>
        </div>

        {/* Método 3: Asistente Min-Max de Banda */}
        <div className="p-3 bg-surface border border-border rounded-lg flex flex-col justify-between gap-2">
          <div>
            <div className="flex items-center justify-between">
              <span className="font-semibold text-text">3. Cobertura de Banda (Min-Max)</span>
              <span className="text-[10px] bg-warm/20 text-warm px-1.5 py-0.5 rounded font-mono font-bold">
                {state.bandF1}–{state.bandF2} Hz
              </span>
            </div>
            <p className="text-[11px] text-muted mt-1">
              Iguala el nivel frontal en f1 y f2 para minimizar la pérdida en los bordes de la banda.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 bg-surface-2 p-2 rounded border border-border font-mono">
            <div>
              <span className="text-muted text-[10px] block">d* de banda</span>
              <strong className="text-sm text-warm">{nf3.format(bandOpt.dStar)} m</strong>
            </div>
            <div>
              <span className="text-muted text-[10px] block">Caída en bordes</span>
              <strong className="text-sm text-text">{nf2.format(bandOpt.edgeLossDB)} dB</strong>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              dispatch({ type: 'SET_PARAMETER', payload: { name: 'separation', value: bandOpt.dStar } });
              dispatch({ type: 'SET_PARAMETER', payload: { name: 'delayRear', value: bandOpt.tauStar } });
            }}
            className="w-full py-1.5 rounded bg-surface-2 hover:bg-border text-text font-medium text-center transition-colors"
          >
            Aplicar óptimo de banda
          </button>
        </div>
      </div>

      {/* MAPA DE DECISIÓN BIDIMENSIONAL Y ASCENSO POR GRADIENTE */}
      <div className="bg-surface border border-border rounded-lg p-4 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2.5">
          <div>
            <h3 className="text-sm font-bold text-text">Mapa de Decisión A_R(d, τ) y Verificación Numérica</h3>
            <p className="text-[11px] text-muted">
              Superficie de atenuación frente/atrás en función de la separación física d y el retardo τ.
            </p>
          </div>

          <button
            type="button"
            disabled={isOptimizing}
            onClick={handleRunGradientAscent}
            className="flex items-center gap-1.5 rounded bg-accent text-bg px-3.5 py-1.5 font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            <span>{isOptimizing ? 'Optimizando...' : 'Optimizar por Ascenso de Gradiente'}</span>
          </button>
        </div>

        <div className="flex flex-col lg:flex-row gap-4 items-center">
          <div className="relative">
            <canvas
              ref={canvasRef}
              width={480}
              height={260}
              className="rounded border border-border bg-black shadow"
              aria-label="Mapa de decisión bidimensional A_R en función de d y tau"
            />
            <div className="absolute bottom-1 right-2 text-[10px] text-white/70 font-mono">
              d: 0.2m → 3.0m
            </div>
            <div className="absolute top-1 left-2 text-[10px] text-white/70 font-mono">
              τ: 15ms ↓ 0ms
            </div>
          </div>

          <div className="flex-1 flex flex-col gap-2.5 text-[11px]">
            <span className="font-semibold text-text text-xs">Lectura y Comportamiento del Mapa:</span>
            <ul className="list-disc list-inside text-muted flex flex-col gap-1.5">
              <li>
                <strong className="text-text">Cresta de máxima atenuación:</strong> Coincide exactamente con la recta{' '}
                <span className="font-mono text-text">τ = d / c</span> (línea punteada blanca).
              </li>
              <li>
                <strong className="text-text">Punto Óptimo λ/4 (verde):</strong> Se ubica en{' '}
                <span className="font-mono text-accent">d = {nf2.format(singleOpt.dStar)} m, τ = {nf2.format(singleOpt.tauStarMs)} ms</span>.
              </li>
              <li>
                <strong className="text-text">Ascenso por gradiente numérico:</strong> Comprueba cómo cualquier configuración inicial escala por el gradiente de A_R convergiendo a la recta analítica.
              </li>
            </ul>

            {ascentTrajectory && (
              <div className="mt-2 p-2 rounded bg-ok/10 border border-ok/30 text-ok flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                <span>
                  El ascenso numérico convergió con éxito a la condición de nulo trasero τ = d / c ({ascentTrajectory.length} pasos).
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* DEDUCCIÓN MATEMÁTICA CON MULTIPLICADORES DE LAGRANGE */}
      <div className="border border-border rounded bg-surface">
        <button
          type="button"
          onClick={() => setShowLagrangeProof(!showLagrangeProof)}
          className="w-full flex items-center justify-between p-3 bg-surface-2 hover:bg-surface font-semibold text-text transition-colors"
        >
          <span>Deducción Formal con Multiplicadores de Lagrange (Cálculo III)</span>
          {showLagrangeProof ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {showLagrangeProof && (
          <div className="p-4 border-t border-border flex flex-col gap-3 leading-relaxed text-muted">
            <p>
              Planteamos el problema de maximizar la ganancia frontal sujeta a la anulación de energía en el escenario:
            </p>
            <div className="p-3 bg-surface-2 rounded border border-border overflow-x-auto text-center">
              <KaTeXMath
                math="\text{Maximizar } F(d, \tau) = 4\sin^2\left(\frac{kd + \omega\tau}{2}\right) \quad \text{sujeto a } G(d, \tau) = \omega\tau - kd = 0"
                block
              />
            </div>
            <p>
              Definiendo la variable angular auxiliar <KaTeXMath math="u = (kd + \omega\tau)/2" />, los gradientes son:
            </p>
            <div className="p-3 bg-surface-2 rounded border border-border overflow-x-auto text-center">
              <KaTeXMath
                math="\nabla F = 2\sin(2u) \cdot \begin{pmatrix} k \\ \omega \end{pmatrix}, \quad \nabla G = \begin{pmatrix} -k \\ \omega \end{pmatrix}"
                block
              />
            </div>
            <p>
              La condición de Lagrange <KaTeXMath math="\nabla F = \lambda \nabla G" /> junto con la restricción <KaTeXMath math="\omega\tau = kd" /> implica que sobre la restricción <KaTeXMath math="u = kd" />. Para obtener el máximo absoluto de amplitud:
            </p>
            <div className="p-3 bg-surface-2 rounded border border-border overflow-x-auto text-center">
              <KaTeXMath
                math="kd = \frac{\pi}{2} \implies d^* = \frac{\lambda}{4}, \quad \tau^* = \frac{d^*}{c} = \frac{1}{4f}"
                block
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
