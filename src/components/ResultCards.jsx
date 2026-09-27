import React from 'react';
import { useArrayState, useArrayDerived } from '../state/arrayState.js';
import { AlertTriangle, Info } from 'lucide-react';

export default React.memo(function ResultCards() {
  const state = useArrayState();
  const derived = useArrayDerived();

  const nf1 = new Intl.NumberFormat('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const nf2 = new Intl.NumberFormat('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const metrics = derived.metrics.current;
  const delta = derived.metrics.delta;

  const isPhaseNoCancellation = state.preset === 'in_phase' && state.separation < derived.wavelength / 2;
  const isCardioidLossHigh = state.polarityRear === -1 && (derived.dOverLambda < 0.125 || derived.dOverLambda > 0.375);
  const isDelayShifted = Math.abs(derived.phaseErrorDeg) > 5.0 && !state.autoDelay;

  return (
    <div className="flex flex-col gap-2 select-none animate-fade-in">
      {/* KPI Principal — glass card */}
      <div className="glass-strong rounded-2xl p-3.5 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-[9px] text-muted font-medium uppercase tracking-wider opacity-70">Atenuación F/A</span>
          <span className="text-[9px] font-semibold font-mono text-purple-dark dark:text-purple-light bg-purple/15 dark:bg-purple/25 border border-purple/30 px-1.5 py-0.5 rounded-full">
            Δ{delta.deltaAR >= 0 ? '+' : ''}{nf1.format(delta.deltaAR)}
          </span>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-3xl font-bold tracking-tighter text-text">
            {nf1.format(metrics.arDB)}
          </span>
          <span className="text-xs text-muted font-medium">dB</span>
        </div>
        <div className="border-t border-border" />
        <div className="flex justify-between text-[9px] text-muted">
          <span>Campo lejano</span>
          <span className="text-text font-medium">
            {metrics.isIdealInfinite ? '>60 dB' : `${nf1.format(metrics.affDB)} dB`}
          </span>
        </div>
      </div>

      {/* Métricas secundarias — glass pills */}
      <div className="glass rounded-xl p-3 flex flex-col gap-2">
        <div className="flex justify-between items-center text-[10px]">
          <span className="text-muted">G_front</span>
          <span className="font-bold text-text">{nf1.format(metrics.gFrontDB)} <span className="font-normal text-muted">dB</span></span>
        </div>
        <div className="border-t border-border" />
        <div className="flex justify-between items-center text-[10px]">
          <span className="text-muted">Q_PE</span>
          <span className="font-bold text-purple-dark dark:text-purple-light">{nf1.format(metrics.qpeDB)} <span className="font-normal text-muted">dB</span></span>
        </div>
      </div>

      {/* Parámetros físicos — subtle */}
      <div className="glass rounded-xl p-2.5">
        <div className="grid grid-cols-2 gap-y-1 gap-x-3 text-[9px]">
          {[
            { label: 'λ', value: `${nf2.format(derived.wavelength)}m` },
            { label: 'k·d', value: `${nf2.format(derived.kd)}rad` },
            { label: 'd/λ', value: nf2.format(derived.dOverLambda) },
            { label: 'τ id', value: `${nf2.format(derived.idealTau * 1000)}ms` },
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between">
              <span className="text-muted opacity-60">{label}</span>
              <span className="font-mono text-text opacity-80">{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Avisos — minimal */}
      {metrics.arDB < -1 && (
        <div className="glass rounded-xl p-2 flex items-center gap-1.5 text-[9px] text-warm border border-warm/25 bg-warm/10">
          <AlertTriangle className="h-3 w-3 flex-shrink-0" />
          <span>Emisión invertida (Atrás &gt; Frente). Revisa polaridad trasera en Avanzados.</span>
        </div>
      )}
      {isPhaseNoCancellation && (
        <div className="glass rounded-xl p-2 flex items-center gap-2 text-[9px] text-warm">
          <AlertTriangle className="h-3 w-3 flex-shrink-0" />
          <span>Sin cancelación — d &lt; λ/2</span>
        </div>
      )}
      {isCardioidLossHigh && (
        <div className="glass rounded-xl p-2 flex items-center gap-2 text-[9px] text-warm">
          <AlertTriangle className="h-3 w-3 flex-shrink-0" />
          <span>Caída &gt;3dB — d ≠ λ/4</span>
        </div>
      )}
      {isDelayShifted && (
        <div className="glass rounded-xl p-2 flex items-center gap-2 text-[9px] text-purple-dark dark:text-purple-light">
          <Info className="h-3 w-3 flex-shrink-0" />
          <span>Nulo desviado φ={nf1.format(derived.phaseErrorDeg)}°</span>
        </div>
      )}
    </div>
  );
});
