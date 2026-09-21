import { useArray } from '../state/arrayState.js';
import { Info, AlertTriangle } from 'lucide-react';

export default function ResultCards() {
  const { state, derived } = useArray();

  const nf1 = new Intl.NumberFormat('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const nf2 = new Intl.NumberFormat('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const metrics = derived.metrics.current;
  const delta = derived.metrics.delta;

  // Condiciones de avisos inteligentes
  const isPhaseNoCancellation = state.preset === 'in_phase' && state.separation < derived.wavelength / 2;
  const isCardioidLossHigh =
    state.polarityRear === -1 &&
    (derived.dOverLambda < 0.125 || derived.dOverLambda > 0.375);
  const isDelayShifted = Math.abs(derived.phaseErrorDeg) > 5.0 && !state.autoDelay;

  return (
    <div className="flex flex-col gap-3.5 w-full lg:w-72 flex-shrink-0 text-xs">
      <div className="flex items-center justify-between border-b border-border/80 pb-2.5">
        <h2 className="text-sm font-semibold tracking-tight text-text">Rendimiento Acústico</h2>
        <span className="text-[11px] text-muted font-medium bg-surface-2 px-2 py-0.5 rounded-full border border-border">
          Frente / Atrás
        </span>
      </div>

      {/* KPI PRINCIPAL: ATENUACIÓN FRENTE / ATRÁS A_R */}
      <div className="p-4 bg-surface border border-border rounded-2xl flex flex-col gap-2 shadow-sm relative overflow-hidden">
        <div className="flex items-center justify-between">
          <span className="text-muted text-[11px] font-medium">Atenuación a R={state.referenceDistance}m (A_R)</span>
          <span className="text-[11px] font-semibold text-purple font-mono bg-purple-light/80 dark:bg-purple-dark/30 px-2 py-0.5 rounded-full">
            Δ {delta.deltaAR >= 0 ? '+' : ''}{nf1.format(delta.deltaAR)} dB
          </span>
        </div>
        <div className="flex items-baseline gap-1.5 my-1">
          <span className="text-3xl font-bold tracking-tight text-purple">
            {nf1.format(metrics.arDB)}
          </span>
          <span className="text-sm font-semibold text-muted">dB</span>
        </div>
        <div className="flex justify-between items-center text-[11px] text-muted pt-2 border-t border-border/70">
          <span>Campo lejano ideal (A_ff):</span>
          <span className="font-semibold text-text">
            {metrics.isIdealInfinite ? '> 60 dB (ideal)' : `${nf1.format(metrics.affDB)} dB`}
          </span>
        </div>
      </div>

      {/* MÉTRICAS SECUNDARIAS */}
      <div className="p-4 bg-surface border border-border rounded-2xl flex flex-col gap-2.5 shadow-sm">
        <div className="flex justify-between items-center">
          <span className="text-muted text-[11px] font-medium">Nivel público (G_front)</span>
          <span className="text-sm font-bold text-text">
            {nf1.format(metrics.gFrontDB)} <span className="text-xs font-normal text-muted">dB</span>
          </span>
        </div>
        <div className="flex justify-between items-center pt-2 border-t border-border/70">
          <span className="text-muted text-[11px] font-medium">Energía Público / Escenario</span>
          <span className="text-sm font-bold text-purple">
            {nf1.format(metrics.qpeDB)} <span className="text-xs font-normal text-muted">dB</span>
          </span>
        </div>
      </div>

      {/* PARÁMETROS ONDULATORIOS DERIVADOS */}
      <div className="p-3.5 bg-surface-2 border border-border rounded-2xl flex flex-col gap-1.5">
        <span className="font-medium text-text text-[11px] mb-0.5">Parámetros Físicos</span>
        <div className="grid grid-cols-2 gap-y-1 gap-x-2 text-[11px]">
          <div className="flex justify-between">
            <span className="text-muted">Longitud λ:</span>
            <span className="font-mono text-text">{nf2.format(derived.wavelength)} m</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Fase k·d:</span>
            <span className="font-mono text-text">{nf2.format(derived.kd)} rad</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">d / λ:</span>
            <span className="font-mono text-text">{nf2.format(derived.dOverLambda)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">τ ideal:</span>
            <span className="font-mono text-text">{nf2.format(derived.idealTau * 1000)} ms</span>
          </div>
        </div>
      </div>

      {/* AVISOS INTELIGENTES MINIMALISTAS */}
      <div className="flex flex-col gap-2">
        {isPhaseNoCancellation && (
          <div className="flex items-start gap-2 p-2.5 rounded-xl bg-red-light/60 dark:bg-red-900/20 border border-red/30 text-red text-[11px]">
            <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <div>
              <strong className="block font-semibold">Sin cancelación:</strong>
              Como d &lt; λ/2 ({nf2.format(state.separation)}m &lt; {nf2.format(derived.wavelength / 2)}m), las ondas suman constructivamente hacia atrás.
            </div>
          </div>
        )}

        {isCardioidLossHigh && (
          <div className="flex items-start gap-2 p-2.5 rounded-xl bg-red-light/60 dark:bg-red-900/20 border border-red/30 text-red text-[11px]">
            <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <div>
              <strong className="block font-semibold">Caída frontal &gt; 3 dB:</strong>
              Separación alejada de λ/4. Acerca d a {nf2.format(derived.wavelength / 4)} m para máxima potencia hacia el público.
            </div>
          </div>
        )}

        {isDelayShifted && (
          <div className="flex items-start gap-2 p-2.5 rounded-xl bg-purple-light/60 dark:bg-purple-900/20 border border-purple/30 text-purple text-[11px]">
            <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <div>
              <strong className="block font-semibold">Nulo desviado:</strong>
              Desfase residual φ = {nf1.format(derived.phaseErrorDeg)}°. El nulo ya no apunta exactamente hacia el escenario.
            </div>
          </div>
        )}

        <p className="text-[10px] text-muted text-center pt-1">
          Modelo de primer diseño en campo libre ideal. Fabricantes reportan ~15–20 dB prácticos en recintos reales.
        </p>
      </div>
    </div>
  );
}
