import React, { useState, useMemo } from 'react';
import { useArrayState, useArrayDispatch, useArrayDerived } from '../state/arrayState.js';
import { calculateSpeedOfSound } from '../core/constants.js';
import { calculateWavelength, calculateWavenumber, calculateOmega, dBToLinear } from '../core/physics.js';
import { createTwoSubSources, precomputeSourceCoefficients, calculatePointField } from '../core/field.js';
import { calculateAR } from '../core/metrics.js';
import { calculateAnalyticalGradient } from '../core/calculus/gradient.js';
import { besselJ0 } from '../core/calculus/bessel.js';
import KaTeXMath from './KaTeXMath.jsx';
import {
  X, FlaskConical, Sliders, Waves, Activity, Calculator,
  Compass, ArrowRight, RefreshCw, CheckCircle2, AlertTriangle, ShieldCheck
} from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine, ReferenceDot
} from 'recharts';

export default function ExperimentLabModal() {
  const state = useArrayState();
  const dispatch = useArrayDispatch();
  const derived = useArrayDerived();

  if (!state.showExperimentModal) return null;

  const closeModal = () => {
    dispatch({ type: 'SET_EXPERIMENT_MODAL', payload: false });
  };

  // Parámetros experimentales locales vinculados al estado
  const f = state.frequency;
  const d = state.separation;
  const tau = state.delayRear;
  const temp = state.temperature;
  const px = state.inspectedPoint.x;
  const py = state.inspectedPoint.y;

  const nf1 = (v) => Number(v).toFixed(1);
  const nf2 = (v) => Number(v).toFixed(2);
  const nf3 = (v) => Number(v).toFixed(3);
  const nf4 = (v) => Number(v).toFixed(4);

  // Cálculos de laboratorio
  const c = calculateSpeedOfSound(temp);
  const lambda = calculateWavelength(f, c);
  const k = calculateWavenumber(f, c);
  const omega = calculateOmega(f);
  const kd = k * d;
  const idealD = lambda / 4;
  const idealTau = d / c;
  const deltaTau = tau - idealTau;
  const deltaTauMs = deltaTau * 1000;
  const phaseErrorDeg = (omega * Math.abs(deltaTau) * 180) / Math.PI;

  // Bessel J0(kd)
  const j0Value = besselJ0(kd);
  const rhoTheory = 1.0 + j0Value;

  // Fuentes y campos para métricas
  const gainRearLinear = dBToLinear(state.gainRearDB);
  const gainFrontLinear = dBToLinear(state.gainFrontDB);

  const testSources = useMemo(() => {
    return createTwoSubSources({
      separation: d,
      delayRear: tau,
      delayFront: state.delayFront,
      gainRear: gainRearLinear,
      gainFront: gainFrontLinear,
      polarityRear: state.polarityRear,
      polarityFront: state.polarityFront,
    });
  }, [d, tau, state.delayFront, gainRearLinear, gainFrontLinear, state.polarityRear, state.polarityFront]);

  const precomputed = useMemo(() => {
    return precomputeSourceCoefficients(testSources, omega);
  }, [testSources, omega]);

  const arCalc = useMemo(() => {
    return calculateAR(precomputed, k, state.referenceDistance);
  }, [precomputed, k, state.referenceDistance]);

  const pFront = useMemo(() => {
    return calculatePointField(state.referenceDistance, 0, precomputed, k);
  }, [precomputed, k, state.referenceDistance]);

  const pRear = useMemo(() => {
    return calculatePointField(-state.referenceDistance, 0, precomputed, k);
  }, [precomputed, k, state.referenceDistance]);

  // Inspección del punto personalizado (px, py)
  const ptGrad = useMemo(() => {
    return calculateAnalyticalGradient(px, py, precomputed, k);
  }, [px, py, precomputed, k]);

  const src1 = testSources[0];
  const src2 = testSources[1];
  const r1 = Math.hypot(px - src1.x, py - src1.y);
  const r2 = Math.hypot(px - src2.x, py - src2.y);
  const deltaR = Math.abs(r1 - r2);
  const deltaTR = deltaR / c;

  // Curva de sensibilidad reactiva: AR vs Delta tau (-2ms a +2ms)
  const sensitivityChartData = useMemo(() => {
    const points = [];
    for (let offsetMs = -2.5; offsetMs <= 2.5; offsetMs += 0.25) {
      const testTau = Math.max(0, idealTau + offsetMs * 0.001);
      const s = createTwoSubSources({
        separation: d,
        delayRear: testTau,
        delayFront: state.delayFront,
        gainRear: gainRearLinear,
        gainFront: gainFrontLinear,
        polarityRear: state.polarityRear,
        polarityFront: state.polarityFront,
      });
      const prec = precomputeSourceCoefficients(s, omega);
      const res = calculateAR(prec, k, state.referenceDistance);
      points.push({
        deltaMs: Number(offsetMs.toFixed(2)),
        arDB: Number(res.arDB.toFixed(1)),
      });
    }
    return points;
  }, [idealTau, d, state.delayFront, gainRearLinear, gainFrontLinear, state.polarityRear, state.polarityFront, omega, k, state.referenceDistance]);

  // Curva de Bessel: 1 + J0(k * sep) para sep entre 0 y 3m
  const besselChartData = useMemo(() => {
    const points = [];
    for (let sep = 0.1; sep <= 3.0; sep += 0.1) {
      const arg = k * sep;
      const bVal = besselJ0(arg);
      points.push({
        sepM: Number(sep.toFixed(1)),
        rho: Number((1.0 + bVal).toFixed(3)),
      });
    }
    return points;
  }, [k]);

  // Modificadores de estado reactivos
  const updateParam = (name, value) => {
    dispatch({ type: 'SET_PARAMETER', payload: { name, value: Number(value) } });
  };

  const applyCardioidIdeal = () => {
    dispatch({ type: 'APPLY_PRESET', payload: 'cardioid' });
  };

  const applyInPhase = () => {
    dispatch({ type: 'APPLY_PRESET', payload: 'in_phase' });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-2 sm:p-4 overflow-y-auto animate-fade-in select-none">
      <div className="relative w-full max-w-6xl max-h-[92vh] flex flex-col bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden">
        {/* ═══ ENCABEZADO MODAL ═══ */}
        <div className="px-5 py-3.5 border-b border-border bg-surface-2 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple/15 text-purple-dark dark:text-purple-light border border-purple/30">
              <FlaskConical className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-text">Laboratorio Experimental de Fórmulas y Verificación Numérica</h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-accent/15 text-accent border border-accent/30 font-mono">
                  EN VIVO
                </span>
              </div>
              <p className="text-xs text-muted">
                Observa cómo los números se sustituyen en las ecuaciones matemáticas en tiempo real al alterar los parámetros del arreglo.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeModal}
            className="p-1.5 rounded-xl text-muted hover:text-text hover:bg-white/10 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* ═══ CONTENIDO CON SCROLL ═══ */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 flex flex-col gap-6">
          {/* CONTROLES EXPERIMENTALES EN VIVO (SLIDERS) */}
          <div className="p-4 rounded-2xl bg-surface-2 border border-border shadow-sm flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 pb-2">
              <div className="flex items-center gap-2 text-xs font-bold text-text">
                <Sliders className="h-4 w-4 text-purple-dark dark:text-purple-light" />
                <span>Parámetros Experimentales del Arreglo</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={applyCardioidIdeal}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-purple/15 hover:bg-purple/25 text-purple-dark dark:text-purple-light border border-purple/30 transition-all"
                >
                  ⚡ Set Cardioide Óptimo (λ/4, d/c)
                </button>
                <button
                  type="button"
                  onClick={applyInPhase}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-surface hover:bg-surface-2 text-muted hover:text-text border border-border transition-all"
                >
                  Subwoofers en Fase (τ=0)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
              {/* Slider Frecuencia */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted font-medium">Frecuencia (f):</span>
                  <span className="font-mono font-bold text-text">{f} Hz</span>
                </div>
                <input
                  type="range"
                  min="30"
                  max="140"
                  step="1"
                  value={f}
                  onChange={(e) => updateParam('frequency', e.target.value)}
                  className="w-full h-1.5 bg-border rounded-lg appearance-none cursor-pointer accent-purple"
                />
                <span className="text-[10px] text-muted">Banda subgrave estándar: 40–100 Hz</span>
              </div>

              {/* Slider Separación */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted font-medium">Separación (d):</span>
                  <span className="font-mono font-bold text-text">{nf3(d)} m</span>
                </div>
                <input
                  type="range"
                  min="0.3"
                  max="2.5"
                  step="0.01"
                  value={d}
                  onChange={(e) => updateParam('separation', e.target.value)}
                  className="w-full h-1.5 bg-border rounded-lg appearance-none cursor-pointer accent-purple"
                />
                <span className="text-[10px] text-muted">Teórico óptimo λ/4 = {nf3(idealD)} m</span>
              </div>

              {/* Slider Retardo Trasero */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted font-medium">Retardo Trasero (τ):</span>
                  <span className="font-mono font-bold text-text">{nf2(tau * 1000)} ms</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="0.05"
                  value={(tau * 1000).toFixed(2)}
                  onChange={(e) => updateParam('delayRear', Number(e.target.value) / 1000)}
                  className="w-full h-1.5 bg-border rounded-lg appearance-none cursor-pointer accent-purple"
                />
                <span className="text-[10px] text-muted">Óptimo τ* = d/c = {nf2(idealTau * 1000)} ms</span>
              </div>

              {/* Slider Temperatura */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted font-medium">Temperatura (T):</span>
                  <span className="font-mono font-bold text-text">{temp} °C</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="40"
                  step="1"
                  value={temp}
                  onChange={(e) => updateParam('temperature', e.target.value)}
                  className="w-full h-1.5 bg-border rounded-lg appearance-none cursor-pointer accent-purple"
                />
                <span className="text-[10px] text-muted">Velocidad c = {nf2(c)} m/s</span>
              </div>
            </div>
          </div>

          {/* ═══ TARJETAS DE FÓRMULAS CON SUSTITUCIÓN NUMÉRICA EN VIVO ═══ */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* FÓRMULA 1: ONDA Y VELOCIDAD */}
            <div className="p-4 rounded-2xl bg-surface border border-border flex flex-col justify-between gap-3">
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-xs font-bold text-text flex items-center gap-1.5">
                    <Waves className="h-4 w-4 text-purple-dark dark:text-purple-light" />
                    1. Longitud de Onda y Propagación
                  </span>
                  <span className="text-[10px] font-mono text-muted bg-surface-2 px-2 py-0.5 rounded border border-border">
                    λ = c / f
                  </span>
                </div>
                <p className="text-xs text-muted mb-2">
                  Relaciona la velocidad de propagación acústica en el aire a {temp} °C con la frecuencia seleccionada:
                </p>
                <div className="p-3 rounded-xl bg-surface-2 border border-border/80 font-mono text-xs flex flex-col gap-1">
                  <div className="text-muted">
                    Fórmula teórica: <span className="text-text font-bold">λ = c / f</span>
                  </div>
                  <div className="text-purple-dark dark:text-purple-light font-bold text-sm">
                    λ = {nf2(c)} m/s ÷ {f} Hz = <span className="underline">{nf3(lambda)} m</span>
                  </div>
                  <div className="text-[11px] text-muted mt-1">
                    Número de onda k = 2π/λ = <strong className="text-text">{nf3(k)} rad/m</strong> | ω = 2πf = <strong className="text-text">{nf2(omega)} rad/s</strong>
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-muted leading-relaxed">
                💡 <strong className="text-text">Implicación:</strong> A menor frecuencia, la longitud de onda crece (a 40 Hz mide {nf2(c/40)} m), obligando a mayor separación física entre cajas para cancelar efectivamente.
              </p>
            </div>

            {/* FÓRMULA 2: CONDICIÓN DE CARDIOIDE */}
            <div className="p-4 rounded-2xl bg-surface border border-border flex flex-col justify-between gap-3">
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-xs font-bold text-text flex items-center gap-1.5">
                    <Activity className="h-4 w-4 text-accent" />
                    2. Sincronización Cardioide Óptima (d* y τ*)
                  </span>
                  <span className="text-[10px] font-mono text-muted bg-surface-2 px-2 py-0.5 rounded border border-border">
                    d* = λ/4, τ* = d/c
                  </span>
                </div>
                <p className="text-xs text-muted mb-2">
                  Para anular la radiación trasera mediante inversión de fase (−180°), el retardo debe igualar el tiempo de vuelo:
                </p>
                <div className="p-3 rounded-xl bg-surface-2 border border-border/80 font-mono text-xs flex flex-col gap-1">
                  <div className="text-muted">
                    Separación óptima: <span className="text-text">d* = {nf3(lambda)} / 4 = </span>
                    <strong className="text-text">{nf3(idealD)} m</strong> (Actual: <strong className="text-purple-dark dark:text-purple-light">{nf3(d)} m</strong>)
                  </div>
                  <div className="text-muted">
                    Retardo acústico óptimo: <span className="text-text">τ* = {nf3(d)} / {nf2(c)} = </span>
                    <strong className="text-accent">{nf2(idealTau * 1000)} ms</strong>
                  </div>
                  <div className="text-xs mt-1 pt-1 border-t border-border/60 flex items-center justify-between">
                    <span>Desvío actual: <strong>{deltaTauMs >= 0 ? `+${nf2(deltaTauMs)}` : nf2(deltaTauMs)} ms</strong></span>
                    <span className={phaseErrorDeg < 15 ? 'text-ok font-bold' : 'text-warm font-bold'}>
                      Error fase Δφ = {nf1(phaseErrorDeg)}°
                    </span>
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-muted leading-relaxed">
                💡 <strong className="text-text">Implicación:</strong> Hacia atrás (+x), la onda del frente tarda d/c en llegar atrás, sumándose a la onda trasera que ya salió con retardo d/c e invertida en polaridad: suman con desfase exacto de 180° causando silencio.
              </p>
            </div>

            {/* FÓRMULA 3: ATENUACIÓN FRENTE/ATRÁS A_R */}
            <div className="p-4 rounded-2xl bg-surface border border-border flex flex-col justify-between gap-3">
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-xs font-bold text-text flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-ok" />
                    3. Atenuación Frente/Atrás Cuantificada (A_R)
                  </span>
                  <span className="text-[10px] font-mono text-muted bg-surface-2 px-2 py-0.5 rounded border border-border">
                    A_R = 20 log₁₀(|P_f| / |P_r|)
                  </span>
                </div>
                <p className="text-xs text-muted mb-2">
                  Cociente logarítmico entre la presión en el eje frontal (+R, 0) y el eje trasero de escenario (−R, 0):
                </p>
                <div className="p-3 rounded-xl bg-surface-2 border border-border/80 font-mono text-xs flex flex-col gap-1.5">
                  <div className="text-muted">
                    En R = {state.referenceDistance} m: |P_frente| = <strong className="text-text">{nf3(pFront.mag)}</strong> | |P_atrás| = <strong className="text-text">{nf3(pRear.mag)}</strong>
                  </div>
                  <div className="text-sm font-bold text-purple-dark dark:text-purple-light">
                    A_R = 20 log₁₀({nf3(pFront.mag)} ÷ {nf3(pRear.mag)}) = <span className="text-base underline">{nf1(arCalc.arDB)} dB</span>
                  </div>
                  <div className="text-[11px] text-muted">
                    Nivel escenario: <strong className="text-text">{nf1(pRear.levelDB)} dB SPL</strong> | Nivel público: <strong className="text-text">{nf1(pFront.levelDB)} dB SPL</strong>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs">
                {arCalc.arDB >= 20 ? (
                  <span className="flex items-center gap-1.5 text-ok font-semibold">
                    <CheckCircle2 className="h-4 w-4" /> Cancelación excelente en escenario (&gt; 20 dB)
                  </span>
                ) : arCalc.arDB >= 10 ? (
                  <span className="flex items-center gap-1.5 text-accent font-semibold">
                    <CheckCircle2 className="h-4 w-4" /> Cancelación moderada aceptable (10 – 20 dB)
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-warm font-semibold">
                    <AlertTriangle className="h-4 w-4" /> Directividad degradada por desajuste (&lt; 10 dB)
                  </span>
                )}
              </div>
            </div>

            {/* FÓRMULA 4: CONSERVACIÓN Y BESSEL J0 */}
            <div className="p-4 rounded-2xl bg-surface border border-border flex flex-col justify-between gap-3">
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-xs font-bold text-text flex items-center gap-1.5">
                    <Calculator className="h-4 w-4 text-accent" />
                    4. Teorema de Redistribución e Integral Polar de Bessel
                  </span>
                  <span className="text-[10px] font-mono text-muted bg-surface-2 px-2 py-0.5 rounded border border-border">
                    ρ ≈ 1 + J₀(kd)
                  </span>
                </div>
                <p className="text-xs text-muted mb-2">
                  Demuestra que la interferencia no destruye la energía acústica total en el espacio sino que la redistribuye:
                </p>
                <div className="p-3 rounded-xl bg-surface-2 border border-border/80 font-mono text-xs flex flex-col gap-1.5">
                  <div className="text-muted">
                    kd = ({nf3(k)} rad/m) × ({nf3(d)} m) = <strong className="text-text">{nf3(kd)} rad</strong>
                  </div>
                  <div className="text-muted">
                    J₀({nf3(kd)}) = <strong className="text-text">{nf3(j0Value)}</strong>
                  </div>
                  <div className="text-sm font-bold text-accent">
                    ρ = 1 + J₀(kd) = 1 + ({nf3(j0Value)}) = <span className="text-base underline">{nf3(rhoTheory)}</span>
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-muted leading-relaxed">
                💡 <strong className="text-text">Implicación:</strong> Para d = λ/4, kd ≈ π/2 ≈ 1.57 rad, donde J₀(1.57) ≈ 0.47, arrojando ρ ≈ 1.47. Los subwoofers radian colectivamente 1.47 veces la energía de dos cajas aisladas debido al acoplamiento mutuo.
              </p>
            </div>
          </div>

          {/* ═══ GRÁFICAS REACTIVAS DE ANÁLISIS EN VIVO ═══ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* GRÁFICA 1: SENSIBILIDAD AR VS DELTA TAU */}
            <div className="p-4 rounded-2xl bg-surface border border-border shadow-sm flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-text flex items-center gap-1.5">
                  <Activity className="h-4 w-4 text-purple-dark dark:text-purple-light" />
                  Gráfica 1: Sensibilidad de Atenuación A_R vs Error de Retardo (Δτ)
                </span>
                <span className="text-[10px] font-mono text-muted bg-surface-2 px-2 py-0.5 rounded border border-border">
                  Umbral útil ≥ 10 dB
                </span>
              </div>
              <p className="text-[11px] text-muted">
                Observa cómo el punto actual (marcador brillante) se desplaza por la curva conforme varías los sliders arriba.
              </p>
              <div className="h-56 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={sensitivityChartData} margin={{ top: 10, right: 20, left: -15, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2A3541" opacity={0.3} />
                    <XAxis
                      dataKey="deltaMs"
                      stroke="#888"
                      tick={{ fontSize: 10 }}
                      tickFormatter={(val) => `${val > 0 ? '+' : ''}${val}ms`}
                    />
                    <YAxis stroke="#888" domain={[0, 35]} tick={{ fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#18181b', borderColor: '#3f3f46', borderRadius: '8px' }}
                      labelStyle={{ color: '#fff', fontWeight: 'bold' }}
                      formatter={(val) => [`${val} dB`, 'Atenuación A_R']}
                      labelFormatter={(val) => `Desvío Δτ: ${val > 0 ? '+' : ''}${val} ms`}
                    />
                    <ReferenceLine y={10} stroke="#f43f5e" strokeDasharray="4 4" label={{ value: '10 dB Límite', fill: '#f43f5e', fontSize: 10 }} />
                    <Line
                      type="monotone"
                      dataKey="arDB"
                      stroke="#8b5cf6"
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 5 }}
                    />
                    {/* Punto actual */}
                    <ReferenceDot
                      x={Math.max(-2.5, Math.min(2.5, Number(deltaTauMs.toFixed(2))))}
                      y={Math.min(35, Math.max(0, Number(arCalc.arDB.toFixed(1))))}
                      r={6}
                      fill="#ec4899"
                      stroke="#ffffff"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* GRÁFICA 2: CURVA DE BESSEL 1 + J0(kd) VS SEPARACIÓN */}
            <div className="p-4 rounded-2xl bg-surface border border-border shadow-sm flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-text flex items-center gap-1.5">
                  <Calculator className="h-4 w-4 text-accent" />
                  Gráfica 2: Curva Teórica de Bessel ρ = 1 + J₀(kd) vs Separación d
                </span>
                <span className="text-[10px] font-mono text-muted bg-surface-2 px-2 py-0.5 rounded border border-border">
                  f = {f} Hz
                </span>
              </div>
              <p className="text-[11px] text-muted">
                Comprueba cómo oscila la redistribución total de energía y dónde se encuentra la separación actual d = {nf2(d)} m.
              </p>
              <div className="h-56 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={besselChartData} margin={{ top: 10, right: 20, left: -15, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2A3541" opacity={0.3} />
                    <XAxis
                      dataKey="sepM"
                      stroke="#888"
                      tick={{ fontSize: 10 }}
                      tickFormatter={(val) => `${val}m`}
                    />
                    <YAxis stroke="#888" domain={[0.5, 2.0]} tick={{ fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#18181b', borderColor: '#3f3f46', borderRadius: '8px' }}
                      labelStyle={{ color: '#fff', fontWeight: 'bold' }}
                      formatter={(val) => [`ρ = ${val}`, 'Cociente Energético']}
                      labelFormatter={(val) => `Separación d: ${val} m`}
                    />
                    <ReferenceLine y={1.0} stroke="#10b981" strokeDasharray="4 4" label={{ value: 'ρ = 1.0 (Incoherente)', fill: '#10b981', fontSize: 10 }} />
                    <Line
                      type="monotone"
                      dataKey="rho"
                      stroke="#06b6d4"
                      strokeWidth={2.5}
                      dot={false}
                    />
                    <ReferenceDot
                      x={Math.max(0.1, Math.min(3.0, Number(d.toFixed(1))))}
                      y={Number(rhoTheory.toFixed(3))}
                      r={6}
                      fill="#f59e0b"
                      stroke="#ffffff"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* ═══ SECCIÓN PEDAGÓGICA: ¿QUÉ ES EL PUNTO PERSONALIZADO Y PARA QUÉ SIRVE? ═══ */}
          <div className="p-5 rounded-2xl bg-surface-2 border border-border shadow-sm flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 pb-3">
              <div className="flex items-center gap-2">
                <Compass className="h-5 w-5 text-accent" />
                <div>
                  <h3 className="text-sm font-bold text-text">
                    ¿Qué es el Punto Personalizado ({nf2(px)}, {nf2(py)}) m y para qué sirve esta información?
                  </h3>
                  <span className="text-[11px] text-muted">
                    Inspección punto a punto: explicación conceptual y práctica para ingenieros de sonido y estudiantes de Cálculo III.
                  </span>
                </div>
              </div>
              {/* Controles rápidos de posición del punto */}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted">Mover punto:</span>
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'SET_INSPECTED_POINT', payload: { x: 5, y: 0 } })}
                  className="px-2 py-1 rounded bg-surface border border-border hover:bg-surface-2 font-mono text-[11px]"
                >
                  Público (+5, 0)
                </button>
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'SET_INSPECTED_POINT', payload: { x: -5, y: 0 } })}
                  className="px-2 py-1 rounded bg-surface border border-border hover:bg-surface-2 font-mono text-[11px]"
                >
                  Escenario (−5, 0)
                </button>
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'SET_INSPECTED_POINT', payload: { x: 0, y: 5 } })}
                  className="px-2 py-1 rounded bg-surface border border-border hover:bg-surface-2 font-mono text-[11px]"
                >
                  Lateral (0, +5)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Tarjeta Explicativa 1 */}
              <div className="p-3.5 rounded-xl bg-surface border border-border flex flex-col gap-2">
                <span className="text-xs font-bold text-text flex items-center gap-1.5">
                  🎯 1. ¿Qué representa en la realidad?
                </span>
                <p className="text-[11px] text-muted leading-relaxed">
                  Representa las coordenadas físicas de un <strong className="text-text">micrófono de medición</strong>, la mesa de mezclas FOH, o la posición de un oyente o músico sobre la tarima.
                </p>
                <div className="p-2 rounded bg-surface-2 font-mono text-[11px] flex flex-col gap-1">
                  <div>Distancia a S₁ (frente): <strong>{nf2(r1)} m</strong></div>
                  <div>Distancia a S₂ (atrás): <strong>{nf2(r2)} m</strong></div>
                  <div>Diferencia Δr: <strong>{nf2(deltaR)} m</strong> ({nf2(deltaTR * 1000)} ms de vuelo)</div>
                </div>
              </div>

              {/* Tarjeta Explicativa 2 */}
              <div className="p-3.5 rounded-xl bg-surface border border-border flex flex-col gap-2">
                <span className="text-xs font-bold text-text flex items-center gap-1.5">
                  🔊 2. Presión Compleja y Nivel (SPL)
                </span>
                <p className="text-[11px] text-muted leading-relaxed">
                  Las ondas esféricas de ambos subwoofers llegan con amplitudes y fases diferentes, sumándose como fasores complejos:
                </p>
                <div className="p-2 rounded bg-surface-2 font-mono text-[11px] flex flex-col gap-1">
                  <div>Presión |P|: <strong>{nf3(Math.hypot(ptGrad.p.re, ptGrad.p.im))}</strong></div>
                  <div>Nivel sonoro L: <strong className="text-purple-dark dark:text-purple-light text-xs">{nf1(ptGrad.levelDB)} dB SPL</strong></div>
                  <div>Energía acústica E = |P|²: <strong>{nf4(ptGrad.energy)}</strong></div>
                </div>
                <p className="text-[10px] text-muted">
                  Sirve para evaluar si el público tiene presión suficiente o si el escenario está protegido del sangrado de graves.
                </p>
              </div>

              {/* Tarjeta Explicativa 3 */}
              <div className="p-3.5 rounded-xl bg-surface border border-border flex flex-col gap-2">
                <span className="text-xs font-bold text-text flex items-center gap-1.5">
                  📐 3. Gradiente Espacial ∇L (dB/m)
                </span>
                <p className="text-[11px] text-muted leading-relaxed">
                  En Cálculo III, el vector gradiente indica la dirección y tasa de máximo crecimiento del nivel sonoro:
                </p>
                <div className="p-2 rounded bg-surface-2 font-mono text-[11px] flex flex-col gap-1">
                  <div>Magnitud |∇L|: <strong className="text-accent">{nf2(ptGrad.gradMagL)} dB por metro</strong></div>
                  <div>Dirección de mayor subida: <strong>{nf1(ptGrad.angleDeg)}°</strong></div>
                  <div>Vector: (∂L/∂x: {nf2(ptGrad.gradE_x)}, ∂L/∂y: {nf2(ptGrad.gradE_y)})</div>
                </div>
                <p className="text-[10px] text-muted">
                  ¿Para qué sirve? Si caminas 1 m hacia {nf1(ptGrad.angleDeg)}°, el volumen aumenta en {nf2(ptGrad.gradMagL)} dB. Si es mayor a 3 dB/m, la cobertura es irregular y el oyente experimentará cambios bruscos al moverse.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ═══ FOOTER MODAL CON LOS 3 INTEGRANTES ═══ */}
        <div className="px-5 py-3 border-t border-border bg-surface-2 flex flex-wrap items-center justify-between gap-3 text-xs text-muted flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-text">BONAIS</span>
            <span>·</span>
            <span>Integrantes: <strong className="text-text">Cielo Ochoa</strong> (Autora del Logo) — <strong className="text-text">Daniel Angulo</strong> — <strong className="text-text">Jerónimo "Por Partes" Gómez</strong></span>
          </div>
          <button
            type="button"
            onClick={closeModal}
            className="px-4 py-1.5 rounded-xl font-bold text-white bg-purple hover:bg-purple-dark transition-all shadow-md"
          >
            Entendido, volver al simulador
          </button>
        </div>
      </div>
    </div>
  );
}
