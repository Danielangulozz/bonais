import { useMemo } from 'react';
import { useArray } from '../../state/arrayState.js';
import { calculateSensitivityTable, calculateToleranceWindows } from '../../core/sensitivity.js';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { Activity, ShieldCheck } from 'lucide-react';

export default function SensitivityPanel() {
  const { state, derived } = useArray();

  const nf1 = new Intl.NumberFormat('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const nf2 = new Intl.NumberFormat('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Tabla de perturbaciones y derivadas
  const sensData = useMemo(() => {
    return calculateSensitivityTable({
      d: state.separation,
      tau: state.delayRear,
      frequency: state.frequency,
      speedOfSound: derived.c,
      rDistance: state.referenceDistance,
      config: {
        gainFront: derived.gainFrontLinear,
        gainRear: derived.gainRearLinear,
        polarityFront: state.polarityFront,
        polarityRear: state.polarityRear,
        delayFront: state.delayFront,
      },
    });
  }, [state.separation, state.delayRear, state.frequency, derived.c, state.referenceDistance,
      derived.gainFrontLinear, derived.gainRearLinear, state.polarityFront, state.polarityRear, state.delayFront]);

  // Ventana de tolerancia para AR >= 10 dB
  const tolWindows = useMemo(() => {
    return calculateToleranceWindows({
      d: state.separation,
      tau: state.delayRear,
      frequency: state.frequency,
      speedOfSound: derived.c,
      thresholdDB: 10.0,
      rDistance: state.referenceDistance,
      config: {
        gainFront: derived.gainFrontLinear,
        gainRear: derived.gainRearLinear,
        polarityFront: state.polarityFront,
        polarityRear: state.polarityRear,
        delayFront: state.delayFront,
      },
    });
  }, [state.separation, state.delayRear, state.frequency, derived.c, state.referenceDistance,
      derived.gainFrontLinear, derived.gainRearLinear, state.polarityFront, state.polarityRear, state.delayFront]);

  // Encontrar perturbación a +0.5 ms para la frase automática
  const p05 = sensData.tauPerturbations.find((p) => Math.abs(p.deltaTauMs - 0.5) < 0.01);
  const nominalAR = sensData.nominalAR;
  const arAt05 = p05 ? p05.perturbedAR : nominalAR;

  // Formatear datos para las dos gráficas de Recharts
  const chartDataTau = sensData.tauPerturbations.map((p) => ({
    delta: p.deltaTauMs,
    label: `${p.deltaTauMs > 0 ? '+' : ''}${p.deltaTauMs} ms`,
    arDB: Math.round(p.perturbedAR * 10) / 10,
    dropDB: Math.round(p.dropDB * 10) / 10,
  }));

  const chartDataD = sensData.dPerturbations.map((p) => ({
    delta: p.deltaDCm,
    label: `${p.deltaDCm > 0 ? '+' : ''}${p.deltaDCm} cm`,
    arDB: Math.round(p.perturbedAR * 10) / 10,
    dropDB: Math.round(p.dropDB * 10) / 10,
  }));

  return (
    <div className="flex flex-col gap-6 text-xs text-text">
      {/* FRASE AUTOMÁTICA DE ROBUSTEZ Y VENTANA DE TOLERANCIA */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Frase automática */}
        <div className="p-3 bg-surface border border-border rounded-lg flex items-start gap-2.5">
          <Activity className="h-5 w-5 text-warm flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-text text-sm block mb-1">Impacto del Desajuste Temporal</span>
            <p className="text-muted leading-relaxed">
              Con <strong className="text-text">0,5 ms</strong> de error en el procesador de retardo, la atenuación trasera baja de{' '}
              <strong className="text-accent">{nf1.format(nominalAR)} dB</strong> a{' '}
              <strong className="text-warm">{nf1.format(arAt05)} dB</strong> (una pérdida de {nf1.format(nominalAR - arAt05)} dB).
            </p>
          </div>
        </div>

        {/* Ventana de tolerancia */}
        <div className="p-3 bg-surface border border-border rounded-lg flex items-start gap-2.5">
          <ShieldCheck className="h-5 w-5 text-ok flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-text text-sm block mb-1">Ventana de Tolerancia Útil (A_R ≥ 10 dB)</span>
            <div className="flex flex-col gap-0.5 text-muted">
              <div>
                Rango admisible de retardo: <strong className="text-text font-mono">[{nf2.format(tolWindows.tauMinMs)} ms, {nf2.format(tolWindows.tauMaxMs)} ms]</strong> (margen de {nf2.format(tolWindows.tauSpanMs)} ms)
              </div>
              <div>
                Rango admisible de distancia: <strong className="text-text font-mono">[{nf2.format(tolWindows.dMinM)} m, {nf2.format(tolWindows.dMaxM)} m]</strong> (margen de {nf2.format(tolWindows.dSpanM)} m)
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* DERIVADAS PARCIALES DE SENSIBILIDAD */}
      <div className="p-3 bg-surface-2 border border-border rounded-lg flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="font-semibold text-text block">Derivadas Parciales de Sensibilidad (Tasa de Variación Marginal)</span>
          <span className="text-[11px] text-muted">
            Evalúan la pendiente local de la atenuación frente a pequeñas desviaciones en la puesta a punto.
          </span>
        </div>
        <div className="flex items-center gap-6 font-mono text-xs">
          <div className="bg-surface border border-border px-3 py-1.5 rounded">
            <span className="text-muted text-[10px] block font-sans">∂A_R / ∂τ:</span>
            <strong className="text-text">{nf2.format(sensData.partialDerivatives.dAR_dTau_ms)} dB/ms</strong>
          </div>
          <div className="bg-surface border border-border px-3 py-1.5 rounded">
            <span className="text-muted text-[10px] block font-sans">∂A_R / ∂d:</span>
            <strong className="text-text">{nf2.format(sensData.partialDerivatives.dAR_dD_m)} dB/m</strong>
          </div>
        </div>
      </div>

      {/* TABLAS DE PERTURBACIONES */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Tabla Retardo */}
        <div className="p-4 bg-surface border border-border rounded-lg flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <h4 className="font-bold text-text">Sensibilidad frente a Error de Retardo (Δτ)</h4>
            <span className="text-muted font-mono">τ_nom = {nf2.format(state.delayRear * 1000)} ms</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-[11px]">
              <thead>
                <tr className="text-muted border-b border-border bg-surface-2 text-[10px]">
                  <th className="py-1 px-2">Desajuste Δτ</th>
                  <th className="py-1 px-2">Error Fase (φ)</th>
                  <th className="py-1 px-2">A_R Resultante</th>
                  <th className="py-1 px-2">Caída en dB</th>
                </tr>
              </thead>
              <tbody>
                {sensData.tauPerturbations.map((p, i) => (
                  <tr key={i} className="border-b border-border/40 hover:bg-surface-2">
                    <td className="py-1 px-2 text-text font-bold">
                      {p.deltaTauMs > 0 ? '+' : ''}{p.deltaTauMs} ms
                    </td>
                    <td className="py-1 px-2 text-muted">{nf1.format(p.phaseErrorDeg)}°</td>
                    <td className="py-1 px-2 text-accent font-semibold">{nf1.format(p.perturbedAR)} dB</td>
                    <td className="py-1 px-2 text-danger font-semibold">
                      {p.dropDB > 0 ? `−${nf1.format(p.dropDB)} dB` : '0.0 dB'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Tabla Separación */}
        <div className="p-4 bg-surface border border-border rounded-lg flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <h4 className="font-bold text-text">Sensibilidad frente a Error de Separación (Δd)</h4>
            <span className="text-muted font-mono">d_nom = {nf2.format(state.separation)} m</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-[11px]">
              <thead>
                <tr className="text-muted border-b border-border bg-surface-2 text-[10px]">
                  <th className="py-1 px-2">Desajuste Δd</th>
                  <th className="py-1 px-2">A_R Resultante</th>
                  <th className="py-1 px-2">Caída en dB</th>
                </tr>
              </thead>
              <tbody>
                {sensData.dPerturbations.map((p, i) => (
                  <tr key={i} className="border-b border-border/40 hover:bg-surface-2">
                    <td className="py-1 px-2 text-text font-bold">
                      {p.deltaDCm > 0 ? '+' : ''}{p.deltaDCm} cm
                    </td>
                    <td className="py-1 px-2 text-accent font-semibold">{nf1.format(p.perturbedAR)} dB</td>
                    <td className="py-1 px-2 text-danger font-semibold">
                      {p.dropDB > 0 ? `−${nf1.format(p.dropDB)} dB` : '0.0 dB'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* GRÁFICAS DE SENSIBILIDAD CON RECHARTS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Curva AR vs Delta tau */}
        <div className="p-4 bg-surface border border-border rounded-lg flex flex-col gap-2">
          <span className="font-bold text-text">Curva de Atenuación A_R vs. Error de Retardo (Δτ)</span>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartDataTau} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2A3541" />
                <XAxis dataKey="label" stroke="#93A1B0" tick={{ fontSize: 10 }} />
                <YAxis stroke="#93A1B0" domain={[0, 'auto']} tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#151C23', borderColor: '#2A3541', borderRadius: '4px' }}
                  labelStyle={{ color: '#E6EDF3', fontWeight: 'bold' }}
                />
                <ReferenceLine y={10} stroke="#E11D48" strokeDasharray="3 3" label={{ value: '10 dB umbral', fill: '#E11D48', fontSize: 10 }} />
                <Line type="monotone" dataKey="arDB" name="A_R (dB)" stroke="#7C3AED" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Curva AR vs Delta d */}
        <div className="p-4 bg-surface border border-border rounded-xl flex flex-col gap-2 shadow-sm">
          <span className="font-bold text-text">Curva de Atenuación A_R vs. Error de Posición (Δd)</span>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartDataD} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="label" stroke="#64748B" tick={{ fontSize: 10 }} />
                <YAxis stroke="#64748B" domain={[0, 'auto']} tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#FFFFFF', borderColor: '#E2E8F0', borderRadius: '8px', color: '#0F172A' }}
                  labelStyle={{ color: '#0F172A', fontWeight: 'bold' }}
                />
                <ReferenceLine y={10} stroke="#E11D48" strokeDasharray="3 3" label={{ value: '10 dB umbral', fill: '#E11D48', fontSize: 10 }} />
                <Line type="monotone" dataKey="arDB" name="A_R (dB)" stroke="#E11D48" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
