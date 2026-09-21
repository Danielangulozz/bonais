import React, { useRef, useEffect } from 'react';
import { useArray } from '../state/arrayState.js';
import { computeFieldGrid } from '../core/field.js';
import { getPaletteIndex, MAGMA_UINT32_TABLE } from '../render/colormap.js';
import { createTwoSubSources, precomputeSourceCoefficients } from '../core/field.js';
import { X, SplitSquareVertical } from 'lucide-react';

export default function CompareModal() {
  const { state, dispatch, derived } = useArray();
  const canvasInPhaseRef = useRef(null);
  const canvasCurrentRef = useRef(null);

  const nf1 = new Intl.NumberFormat('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  const metrics = derived.metrics;

  // Renderizado de ambos mapas
  useEffect(() => {
    if (!state.compareMode) return;

    const span = state.mapSpan;
    const xMin = -span;
    const xMax = span;
    const yMin = -span;
    const yMax = span;
    const res = 180;

    // 1. Arreglo en fase
    const c1 = canvasInPhaseRef.current;
    if (c1) {
      const ctx1 = c1.getContext('2d');
      const inPhaseSources = createTwoSubSources({
        separation: state.separation,
        delayRear: 0,
        delayFront: 0,
        gainRear: 1.0,
        gainFront: 1.0,
        polarityRear: 1,
        polarityFront: 1,
      });
      const precompInPhase = precomputeSourceCoefficients(inPhaseSources, derived.omega);
      const gridInPhase = computeFieldGrid({
        precomputedSources: precompInPhase,
        k: derived.k,
        xMin,
        xMax,
        yMin,
        yMax,
        width: res,
        height: res,
      });

      const off1 = document.createElement('canvas');
      off1.width = res;
      off1.height = res;
      const offCtx1 = off1.getContext('2d');
      const img1 = offCtx1.createImageData(res, res);
      const data32_1 = new Uint32Array(img1.data.buffer);

      for (let i = 0; i < res * res; i++) {
        data32_1[i] = MAGMA_UINT32_TABLE[getPaletteIndex(gridInPhase.levelGrid[i], -40, 12)];
      }
      offCtx1.putImageData(img1, 0, 0);
      ctx1.drawImage(off1, 0, 0, c1.width, c1.height);
    }

    // 2. Arreglo actual
    const c2 = canvasCurrentRef.current;
    if (c2) {
      const ctx2 = c2.getContext('2d');
      const gridCurrent = computeFieldGrid({
        precomputedSources: derived.precomputedSources,
        k: derived.k,
        xMin,
        xMax,
        yMin,
        yMax,
        width: res,
        height: res,
      });

      const off2 = document.createElement('canvas');
      off2.width = res;
      off2.height = res;
      const offCtx2 = off2.getContext('2d');
      const img2 = offCtx2.createImageData(res, res);
      const data32_2 = new Uint32Array(img2.data.buffer);

      for (let i = 0; i < res * res; i++) {
        data32_2[i] = MAGMA_UINT32_TABLE[getPaletteIndex(gridCurrent.levelGrid[i], -40, 12)];
      }
      offCtx2.putImageData(img2, 0, 0);
      ctx2.drawImage(off2, 0, 0, c2.width, c2.height);
    }
  }, [state.compareMode, state.separation, state.mapSpan, derived]);

  if (!state.compareMode) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="bg-surface border border-border rounded-xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-xs">
        <div className="flex items-center justify-between border-b border-border px-5 py-3 bg-surface-2">
          <div className="flex items-center gap-2">
            <SplitSquareVertical className="h-4 w-4 text-warm" />
            <h2 className="text-base font-bold text-text">
              Comparación Lado a Lado: En Fase vs. Arreglo Actual
            </h2>
          </div>
          <button
            type="button"
            onClick={() => dispatch({ type: 'SET_COMPARE_MODE', payload: false })}
            className="p-1 rounded text-muted hover:text-text hover:bg-surface"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-6">
          {/* Mapas lado a lado */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col items-center gap-2 p-3.5 bg-surface-2 border border-border rounded-2xl">
              <span className="font-bold text-red text-sm">1. Dos subs en fase (mismo d y f)</span>
              <canvas
                ref={canvasInPhaseRef}
                width={320}
                height={260}
                className="rounded-xl border border-white/10 bg-black max-w-full h-auto shadow"
              />
              <span className="text-[11px] text-muted">Polaridad normal (+ / +), retardo 0 ms</span>
            </div>

            <div className="flex flex-col items-center gap-2 p-3.5 bg-surface-2 border border-border rounded-2xl">
              <span className="font-bold text-purple text-sm">2. Arreglo actual</span>
              <canvas
                ref={canvasCurrentRef}
                width={320}
                height={260}
                className="rounded-xl border border-white/10 bg-black max-w-full h-auto shadow"
              />
              <span className="text-[11px] text-muted">
                Polaridad ({state.polarityRear === -1 ? '−' : '+'}) / (+), retardo {(state.delayRear * 1000).toFixed(2)} ms
              </span>
            </div>
          </div>

          {/* Tabla comparativa de métricas */}
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono border-collapse border border-border text-xs rounded-xl overflow-hidden">
              <thead>
                <tr className="bg-surface-2 border-b border-border text-muted uppercase text-[10px]">
                  <th className="py-2.5 px-3 font-sans">Métrica Acústica</th>
                  <th className="py-2.5 px-3">En Fase</th>
                  <th className="py-2.5 px-3">Arreglo Actual</th>
                  <th className="py-2.5 px-3">Diferencia (Beneficio)</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border/50">
                  <td className="py-2.5 px-3 font-sans font-medium text-text">
                    Atenuación frente/atrás A_R a {state.referenceDistance}m
                  </td>
                  <td className="py-2.5 px-3 text-muted">{nf1.format(metrics.inPhase.arDB)} dB</td>
                  <td className="py-2.5 px-3 text-purple font-bold">{nf1.format(metrics.current.arDB)} dB</td>
                  <td className="py-2.5 px-3 text-ok font-bold">
                    +{nf1.format(metrics.delta.deltaAR)} dB
                  </td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2.5 px-3 font-sans font-medium text-text">
                    Atenuación campo lejano A_ff
                  </td>
                  <td className="py-2.5 px-3 text-muted">
                    {metrics.inPhase.isIdealInfinite ? '>60 dB' : `${nf1.format(metrics.inPhase.affDB)} dB`}
                  </td>
                  <td className="py-2.5 px-3 text-purple font-bold">
                    {metrics.current.isIdealInfinite ? '>60 dB (ideal)' : `${nf1.format(metrics.current.affDB)} dB`}
                  </td>
                  <td className="py-2.5 px-3 text-ok font-bold">
                    +{nf1.format(metrics.delta.deltaAFF)} dB
                  </td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2.5 px-3 font-sans font-medium text-text">
                    Nivel frontal G_front (vs suma perfecta)
                  </td>
                  <td className="py-2.5 px-3 text-muted">{nf1.format(metrics.inPhase.gFrontDB)} dB</td>
                  <td className="py-2.5 px-3 text-text font-semibold">{nf1.format(metrics.current.gFrontDB)} dB</td>
                  <td className="py-2.5 px-3 text-muted">
                    {metrics.delta.deltaGFront >= 0 ? '+' : ''}{nf1.format(metrics.delta.deltaGFront)} dB
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-sans font-medium text-text">
                    Cociente de energía Público / Escenario (Q_PE)
                  </td>
                  <td className="py-2.5 px-3 text-muted">{nf1.format(metrics.inPhase.qpeDB)} dB</td>
                  <td className="py-2.5 px-3 text-purple font-bold">{nf1.format(metrics.current.qpeDB)} dB</td>
                  <td className="py-2.5 px-3 text-ok font-bold">
                    +{nf1.format(metrics.delta.deltaQPE)} dB
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="border-t border-border px-6 py-3 bg-surface-2 flex justify-end">
          <button
            type="button"
            onClick={() => dispatch({ type: 'SET_COMPARE_MODE', payload: false })}
            className="px-5 py-1.5 rounded-full bg-purple text-white font-medium hover:bg-purple-dark transition-colors"
          >
            Cerrar Comparación
          </button>
        </div>
      </div>
    </div>
  );
}
