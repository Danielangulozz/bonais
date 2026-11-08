/**
 * @file optimize.js
 * @description Optimización matemática de arreglos de subwoofers: soluciones cerradas,
 * multiplicadores de Lagrange, optimización con límites físicos, asistente de banda min-max
 * y ascenso por gradiente numérico sobre A_R(d, τ).
 */

import { calculateWavelength, calculateOmega, calculateWavenumber } from './physics.js';
import { calculateAR } from './metrics.js';
import { createTwoSubSources, precomputeSourceCoefficients } from './field.js';
import { DEFAULT_REFERENCE_DISTANCE } from './constants.js';

/**
 * Optimización analítica no restringida a frecuencia fija f:
 * d* = λ / 4
 * τ* = d* / c = 1 / (4f)
 *
 * @param {number} frequency - [Hz]
 * @param {number} speedOfSound - [m/s]
 * @returns {{ dStar: number, tauStar: number, tauStarMs: number, wavelength: number }}
 */
export function optimizeSingleFrequency(frequency, speedOfSound) {
  const wavelength = calculateWavelength(frequency, speedOfSound);
  const dStar = wavelength / 4;
  const tauStar = dStar / speedOfSound; // = 1 / (4 * frequency)
  return {
    dStar,
    tauStar,
    tauStarMs: tauStar * 1000,
    wavelength,
  };
}

/**
 * Optimización con límites físicos d ∈ [dMin, dMax] (por ejemplo, limitaciones de espacio o fondo de caja).
 * Dado que |sin(kd)| crece hasta kd = π/2 y decrece después, el óptimo factible es el d más cercano a λ/4.
 *
 * @param {number} frequency - [Hz]
 * @param {number} speedOfSound - [m/s]
 * @param {number} dMin - Cota inferior de separación [m]
 * @param {number} dMax - Cota superior de separación [m]
 * @returns {{ dOpt: number, tauOpt: number, tauOptMs: number, isConstrained: boolean }}
 */
export function optimizeWithBounds(frequency, speedOfSound, dMin, dMax) {
  const { dStar } = optimizeSingleFrequency(frequency, speedOfSound);

  let dOpt = dStar;
  let isConstrained = false;

  if (dOpt < dMin) {
    dOpt = dMin;
    isConstrained = true;
  } else if (dOpt > dMax) {
    dOpt = dMax;
    isConstrained = true;
  }

  const tauOpt = dOpt / speedOfSound;
  return {
    dOpt,
    tauOpt,
    tauOptMs: tauOpt * 1000,
    isConstrained,
  };
}

/**
 * Asistente de optimización de banda (criterio min-max):
 * Para cubrir una banda [f1, f2] con la menor pérdida de nivel frontal en los extremos:
 * d* = c / (2 * (f1 + f2))
 * τ* = d* / c
 * Pérdida en los bordes = 20 * log10(sin(k1 * d*))
 *
 * @param {number} f1 - Frecuencia inferior [Hz]
 * @param {number} f2 - Frecuencia superior [Hz]
 * @param {number} speedOfSound - [m/s]
 * @returns {{
 *   dStar: number,
 *   tauStar: number,
 *   tauStarMs: number,
 *   edgeLossDB: number
 * }}
 */
export function optimizeBandMinMax(f1, f2, speedOfSound) {
  const dStar = speedOfSound / (2 * (f1 + f2));
  const tauStar = dStar / speedOfSound;

  const k1 = calculateWavenumber(f1, speedOfSound);
  const sinVal = Math.sin(k1 * dStar);
  const edgeLossDB = 20 * Math.log10(Math.max(Math.abs(sinVal), 1e-6));

  return {
    dStar,
    tauStar,
    tauStarMs: tauStar * 1000,
    edgeLossDB,
  };
}

/**
 * Evalúa la función objetivo A_R(d, τ) para una separación y retardo dados.
 *
 * @param {number} d - Separación física [m]
 * @param {number} tau - Retardo de la fuente trasera [s]
 * @param {number} frequency - [Hz]
 * @param {number} speedOfSound - [m/s]
 * @param {number} [rDistance=DEFAULT_REFERENCE_DISTANCE] - [m]
 * @param {Object} [config] - Configuración real del arreglo. Si se omite, se usa el cardioide ideal
 *   (g₁ = g₂ = 1, s₁ = −1, s₂ = +1, τ₂ = 0), que es el caso del objetivo general.
 * @param {number} [config.gainFront=1] @param {number} [config.gainRear=1]
 * @param {number} [config.polarityFront=1] @param {number} [config.polarityRear=-1]
 * @param {number} [config.delayFront=0] - Retardo de la fuente frontal [s]
 * @returns {number} Atenuación A_R en decibelios [dB]
 */
export function evaluateARObjective(d, tau, frequency, speedOfSound, rDistance = DEFAULT_REFERENCE_DISTANCE, config = {}) {
  const omega = calculateOmega(frequency);
  const k = calculateWavenumber(frequency, speedOfSound);
  const {
    gainFront = 1.0,
    gainRear = 1.0,
    polarityFront = 1,
    polarityRear = -1,
    delayFront = 0,
  } = config;

  const sources = createTwoSubSources({
    separation: d,
    delayRear: tau,
    delayFront,
    gainRear,
    gainFront,
    polarityRear,
    polarityFront,
  });

  const precomp = precomputeSourceCoefficients(sources, omega);
  const result = calculateAR(precomp, k, rDistance);
  return result.arDB;
}

/**
 * Realiza un ascenso por gradiente numérico sobre A_R(d, τ) para verificar numéricamente
 * que la trayectoria converge a la condición física de nulo trasero τ = d / c.
 *
 * @param {Object} options
 * @param {number} options.initialD - Separación inicial [m]
 * @param {number} options.initialTau - Retardo inicial [s]
 * @param {number} options.frequency - [Hz]
 * @param {number} options.speedOfSound - [m/s]
 * @param {number} [options.maxIterations=40]
 * @param {number} [options.stepD=0.05]
 * @param {number} [options.stepTau=0.0002]
 * @returns {{
 *   trajectory: Array<{d: number, tauMs: number, arDB: number}>,
 *   finalD: number,
 *   finalTau: number,
 *   finalTauMs: number,
 *   finalAR: number,
 *   convergedToIdealLine: boolean
 * }}
 */
export function numericalGradientAscent({
  initialD,
  initialTau,
  frequency,
  speedOfSound,
  maxIterations = 40,
  stepD = 0.05,
  stepTau = 0.0002,
}) {
  let curD = Math.max(initialD, 0.2);
  let curTau = Math.max(initialTau, 0);

  const trajectory = [];
  const hd = 0.001; // paso diferencias finitas d [m]
  const ht = 0.00002; // paso diferencias finitas tau [s]

  for (let iter = 0; iter < maxIterations; iter++) {
    const currentAR = evaluateARObjective(curD, curTau, frequency, speedOfSound);
    trajectory.push({
      d: curD,
      tauMs: curTau * 1000,
      arDB: currentAR,
    });

    // Gradiente numérico
    const arDPlus = evaluateARObjective(curD + hd, curTau, frequency, speedOfSound);
    const arDMinus = evaluateARObjective(curD - hd, curTau, frequency, speedOfSound);
    const gradD = (arDPlus - arDMinus) / (2 * hd);

    const arTauPlus = evaluateARObjective(curD, curTau + ht, frequency, speedOfSound);
    const arTauMinus = evaluateARObjective(curD, curTau - ht, frequency, speedOfSound);
    const gradTau = (arTauPlus - arTauMinus) / (2 * ht);

    const gradNorm = Math.hypot(gradD, gradTau);
    if (gradNorm < 1e-4) break;

    // Actualización de parámetros con paso amortiguado
    const deltaD = Math.max(Math.min((gradD / gradNorm) * stepD, 0.1), -0.1);
    const deltaTau = Math.max(Math.min((gradTau / gradNorm) * stepTau, 0.0005), -0.0005);

    curD = Math.max(Math.min(curD + deltaD, 4.0), 0.1);
    curTau = Math.max(Math.min(curTau + deltaTau, 0.025), 0.0);

    if (Math.hypot(deltaD, deltaTau * 1000) < 1e-5) break;
  }

  const finalAR = evaluateARObjective(curD, curTau, frequency, speedOfSound);
  const idealTau = curD / speedOfSound;
  const tauDiffMs = Math.abs(curTau - idealTau) * 1000;

  return {
    trajectory,
    finalD: curD,
    finalTau: curTau,
    finalTauMs: curTau * 1000,
    finalAR,
    convergedToIdealLine: tauDiffMs < 0.2, // dentro de 0.2 ms de la línea física ideal
  };
}
