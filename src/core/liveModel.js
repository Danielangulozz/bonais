/**
 * @file liveModel.js
 * @description Cálculo "en vivo" de toda la cadena del modelo del proyecto de aula,
 * en el mismo orden del marco teórico (cap. 4 del documento):
 *   4.1 ecuación de onda → λ, k, ω, fuente compacta
 *   4.2 superposición → fasores de cada fuente en el punto inspeccionado, ΔΦ
 *   4.3 decibel → suma coherente vs. suma incoherente
 *   4.5 gradiente y Hessiano de E(x, y) en el punto
 *   4.5.1 dominio de diseño A(d, τ) en campo lejano + óptimo de Lagrange
 *   4.6 integrales dobles sobre las regiones Público / Escenario (punto medio)
 *   Objetivos específicos 1, 2 y 3 con su respuesta numérica actual.
 *
 * Funciones puras (sin React) para poder probarlas en Node.
 */

import { calculatePointField, createTwoSubSources, precomputeSourceCoefficients } from './field.js';
import { calculateAR } from './metrics.js';
import { calculateAnalyticalGradient } from './calculus/gradient.js';
import { calculateHessian } from './calculus/criticalPoints.js';
import { integrateRectangularRegion, theoreticalCoronaRho } from './calculus/integrals.js';
import { besselJ0 } from './calculus/bessel.js';
import { R_MIN } from './constants.js';

/** Dimensión típica de una caja de subwoofer [m]; su semi-dimensión a = 0,35 m es el "radio" de la fuente. */
export const TYPICAL_BOX_SIZE = 0.7;

/** Envuelve un ángulo a (−π, π]. */
export function wrapPi(a) {
  let x = a % (2 * Math.PI);
  if (x <= -Math.PI) x += 2 * Math.PI;
  if (x > Math.PI) x -= 2 * Math.PI;
  return x;
}

/** Área de una región rectangular [m²]. */
export function regionArea(r) {
  return Math.max(r.xMax - r.xMin, 0) * Math.max(r.yMax - r.yMin, 0);
}

/**
 * Fasores individuales de cada fuente en el punto (x, y):
 * p_n = (g_n / r_n) · e^{−j (k r_n + φ_n)},  φ_n = ω τ_n + θ_n,  θ_n ∈ {0, π}
 */
export function sourcePhasorsAtPoint(x, y, sources, k, omega) {
  return sources.map((s) => {
    const r = Math.max(Math.hypot(x - s.x, y - s.y), R_MIN);
    const theta = s.polarity === -1 ? Math.PI : 0;
    const phi = omega * (s.delay || 0) + theta;
    const totalPhase = -(k * r + phi);
    const amp = (s.gain ?? 1) / r;
    return {
      r,
      phi,
      theta,
      totalPhase,
      amp,
      re: amp * Math.cos(totalPhase),
      im: amp * Math.sin(totalPhase),
    };
  });
}

/**
 * Presión en campo lejano en la dirección θ (θ = 0 → público, θ = π → escenario),
 * normalizada por e^{−jkr}/r:  P∞(θ) = Σ c_n e^{+j k x_n cos θ}
 */
export function farFieldPhasor(theta, precomputedSources, k) {
  let re = 0;
  let im = 0;
  const ct = Math.cos(theta);
  for (const s of precomputedSources) {
    const a = k * s.x * ct;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    re += s.cRe * ca - s.cIm * sa;
    im += s.cRe * sa + s.cIm * ca;
  }
  return { re, im, mag: Math.hypot(re, im) };
}

/** Muestras del integrando E(x, y) en una malla de visualización n×n (punto medio). */
export function sampleRegionGrid(region, precomputedSources, k, n = 20) {
  const dx = (region.xMax - region.xMin) / n;
  const dy = (region.yMax - region.yMin) / n;
  const levels = new Float64Array(n * n);
  for (let j = 0; j < n; j++) {
    const y = region.yMax - (j + 0.5) * dy;
    for (let i = 0; i < n; i++) {
      const x = region.xMin + (i + 0.5) * dx;
      levels[j * n + i] = calculatePointField(x, y, precomputedSources, k).levelDB;
    }
  }
  return { n, levels };
}

function buildSources(state, gainRear, gainFront, override = {}) {
  return createTwoSubSources({
    separation: override.separation ?? state.separation,
    delayRear: override.delayRear ?? state.delayRear,
    delayFront: state.delayFront,
    gainRear,
    gainFront,
    polarityRear: override.polarityRear ?? state.polarityRear,
    polarityFront: override.polarityFront ?? state.polarityFront,
  });
}

/**
 * Calcula todo el modelo en vivo para el estado actual.
 *
 * @param {Object} state - estado global (frecuencia, separación, retardo, regiones…)
 * @param {Object} derived - derivados (c, k, ω, λ, fuentes precomputadas…)
 * @param {Object} [opts]
 * @param {number} [opts.n=48] - divisiones por eje de la regla del punto medio
 * @param {number} [opts.vizN=20] - malla de visualización de cada región
 */
export function computeLiveModel(state, derived, opts = {}) {
  const n = opts.n ?? 48;
  const vizN = opts.vizN ?? 20;
  const { c, k, omega, wavelength } = derived;
  const d = state.separation;
  const tau = state.delayRear;
  const gR = derived.gainRearLinear;
  const gF = derived.gainFrontLinear;
  const src = derived.precomputedSources;

  // ── 4.1 Onda ────────────────────────────────────────────────────
  const wave = {
    c,
    lambda: wavelength,
    k,
    omega,
    period: 1 / state.frequency,
    boxRadius: TYPICAL_BOX_SIZE / 2,
    ka: (k * TYPICAL_BOX_SIZE) / 2, // k·a con a = semi-dimensión de la caja
    isCompact: (k * TYPICAL_BOX_SIZE) / 2 < 1,
  };

  // ── 4.2 Superposición en el punto inspeccionado ─────────────────
  const { x: px, y: py } = state.inspectedPoint;
  const phasors = sourcePhasorsAtPoint(px, py, derived.sources, k, omega);
  const [p1, p2] = phasors;
  const P = { re: p1.re + p2.re, im: p1.im + p2.im };
  const deltaPhi = wrapPi(p2.totalPhase - p1.totalPhase);
  const superposition = {
    point: { x: px, y: py },
    phasors,
    P,
    Pmag: Math.hypot(P.re, P.im),
    deltaPhi,
    cosDelta: Math.cos(deltaPhi),
    pathDiff: p2.r - p1.r,
  };

  // ── 4.3 Decibel: coherente vs incoherente ───────────────────────
  const E = P.re * P.re + P.im * P.im;
  const E1 = p1.amp * p1.amp;
  const E2 = p2.amp * p2.amp;
  const toDB = (e) => 10 * Math.log10(Math.max(e, 1e-12));
  const decibel = {
    E,
    L: toDB(E),
    L1: toDB(E1),
    L2: toDB(E2),
    Lincoherent: toDB(E1 + E2),
    naiveSum: toDB(E1) + toDB(E2),
    interferenceGain: toDB(E) - toDB(E1 + E2),
  };

  // ── 4.5 Gradiente y Hessiano de E(x, y) ─────────────────────────
  const grad = calculateAnalyticalGradient(px, py, src, k);
  const hess = calculateHessian(px, py, src, k);
  const gradient = {
    Ex: grad.gradE_x,
    Ey: grad.gradE_y,
    mag: grad.gradMagE,
    magL: grad.gradMagL,
    angleDeg: grad.angleDeg,
    hessian: hess,
    isCritical: grad.gradMagE < 1e-6 * Math.max(E, 1e-9),
  };

  // ── 4.5.1 Dominio de diseño A(d, τ) en campo lejano ─────────────
  const front = farFieldPhasor(0, src, k);
  const rear = farFieldPhasor(Math.PI, src, k);
  const affDB = rear.mag < 1e-6 ? Infinity : 20 * Math.log10(front.mag / rear.mag);
  const ar = calculateAR(src, k, state.referenceDistance);
  const dStar = wavelength / 4;
  const tauStar = dStar / c;
  const isCardioidTopology = state.polarityRear === -1 && state.polarityFront === 1;
  const design = {
    frontMag: front.mag,
    rearMag: rear.mag,
    affDB,
    arDB: ar.arDB,
    constraint: omega * tau - k * d, // g(d, τ) = ωτ − kd
    u: (k * d + omega * tau) / 2,
    v: (omega * tau - k * d) / 2,
    dStar,
    tauStar,
    frontAtOptimum: 2 * Math.abs(Math.sin(k * d)), // 2|sin kd| sobre la restricción
    gFrontDB: 20 * Math.log10(Math.max(front.mag / Math.max(gR + gF, 1e-9), 1e-6)),
    isCardioidTopology,
  };

  // ── 4.6 Integrales dobles por la regla del punto medio ─────────
  const integrate = (region, sources) =>
    integrateRectangularRegion({ ...region, precomputedSources: sources, k, n });

  const inPhaseSrc = precomputeSourceCoefficients(
    buildSources(state, gR, gF, { delayRear: 0, polarityRear: 1, polarityFront: 1 }),
    omega,
  );

  const aud = integrate(state.audienceRegion, src);
  const stg = integrate(state.stageRegion, src);
  // Referencia en fase: solo se necesita I_int, basta una malla más gruesa
  const integrateRef = (region) =>
    integrateRectangularRegion({ ...region, precomputedSources: inPhaseSrc, k, n: Math.max(24, Math.round(n / 2)) });
  const audRef = integrateRef(state.audienceRegion);
  const stgRef = integrateRef(state.stageRegion);

  const qpe = (a, b) => 10 * Math.log10(Math.max(a, 1e-12) / Math.max(b, 1e-12));
  const mesh = (r) => ({
    dx: (r.xMax - r.xMin) / n,
    dy: (r.yMax - r.yMin) / n,
    area: regionArea(r),
  });

  const integrals = {
    n,
    audience: { region: state.audienceRegion, ...mesh(state.audienceRegion), ...aud },
    stage: { region: state.stageRegion, ...mesh(state.stageRegion), ...stg },
    qpeDB: qpe(aud.I_int, stg.I_int),
    qpeInPhaseDB: qpe(audRef.I_int, stgRef.I_int),
    audienceGainVsInPhaseDB: qpe(aud.I_int, audRef.I_int),
    stageGainVsInPhaseDB: qpe(stg.I_int, stgRef.I_int),
    rhoCorona: theoreticalCoronaRho(src, k, d),
    rhoCoronaInPhase: theoreticalCoronaRho(inPhaseSrc, k, d),
    j0: besselJ0(k * d),
    viz: {
      audience: sampleRegionGrid(state.audienceRegion, src, k, vizN),
      stage: sampleRegionGrid(state.stageRegion, src, k, vizN),
    },
  };

  // ── Objetivo 3: sensibilidad de A_R ante errores de montaje ─────
  const arWith = (override) => {
    const s = precomputeSourceCoefficients(buildSources(state, gR, gF, override), omega);
    return calculateAR(s, k, state.referenceDistance).arDB;
  };
  const hTau = 1e-5; // 0,01 ms
  const hD = 1e-3; // 1 mm
  const dARdTau = (arWith({ delayRear: tau + hTau }) - arWith({ delayRear: Math.max(tau - hTau, 0) })) / (2 * hTau);
  const dARdD = (arWith({ separation: d + hD }) - arWith({ separation: Math.max(d - hD, 0.05) })) / (2 * hD);
  const sensitivity = {
    dARdTauPerMs: dARdTau / 1000, // dB por ms
    dARdDPerCm: dARdD / 100, // dB por cm
    tauPlus: arWith({ delayRear: tau + 0.0005 }),
    tauMinus: arWith({ delayRear: Math.max(tau - 0.0005, 0) }),
    dPlus: arWith({ separation: d + 0.1 }),
    dMinus: arWith({ separation: Math.max(d - 0.1, 0.05) }),
    phaseErrorPerMsDeg: 360 * state.frequency / 1000, // ω·Δτ en grados por ms
  };

  return { wave, superposition, decibel, gradient, design, integrals, sensitivity };
}
