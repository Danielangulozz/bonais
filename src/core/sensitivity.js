/**
 * @file sensitivity.js
 * @description Análisis de sensibilidad y robustez del arreglo frente a desajustes de retardo temporal (τ)
 * y separación física (d), derivadas parciales y ventanas de tolerancia.
 */

import { evaluateARObjective } from './optimize.js';
import { calculateOmega } from './physics.js';

export const DELTA_TAU_MS_LIST = [-1.0, -0.5, -0.25, -0.1, 0.1, 0.25, 0.5, 1.0];
export const DELTA_D_M_LIST = [-0.20, -0.10, -0.05, 0.05, 0.10, 0.20];

/**
 * Calcula la tabla de perturbaciones para retardo y distancia física.
 *
 * @param {Object} params
 * @param {number} params.d - Separación nominal [m]
 * @param {number} params.tau - Retardo nominal [s]
 * @param {number} params.frequency - [Hz]
 * @param {number} params.speedOfSound - [m/s]
 * @param {number} [params.rDistance=10] - [m]
 * @param {Object} [params.config] - Polaridades, ganancias y retardo frontal reales (ver evaluateARObjective)
 * @returns {{
 *   nominalAR: number,
 *   tauPerturbations: Array<{ deltaTauMs: number, perturbedAR: number, dropDB: number, phaseErrorDeg: number }>,
 *   dPerturbations: Array<{ deltaDCm: number, perturbedAR: number, dropDB: number }>,
 *   partialDerivatives: { dAR_dTau_ms: number, dAR_dD_m: number }
 * }}
 */
export function calculateSensitivityTable({
  d,
  tau,
  frequency,
  speedOfSound,
  rDistance = 10,
  config = {},
}) {
  const A = (dd, tt) => evaluateARObjective(dd, tt, frequency, speedOfSound, rDistance, config);
  const nominalAR = A(d, tau);
  const omega = calculateOmega(frequency);

  // 1. Perturbaciones en retardo τ
  const tauPerturbations = DELTA_TAU_MS_LIST.map((deltaMs) => {
    const deltaSec = deltaMs / 1000;
    const perturbedTau = Math.max(tau + deltaSec, 0);
    const perturbedAR = A(d, perturbedTau);
    const dropDB = nominalAR - perturbedAR;
    const phaseErrorDeg = (omega * Math.abs(deltaSec) * 180) / Math.PI;

    return {
      deltaTauMs: deltaMs,
      perturbedAR,
      dropDB,
      phaseErrorDeg,
    };
  });

  // 2. Perturbaciones en distancia d
  const dPerturbations = DELTA_D_M_LIST.map((deltaM) => {
    const perturbedD = Math.max(d + deltaM, 0.1);
    const perturbedAR = A(perturbedD, tau);
    const dropDB = nominalAR - perturbedAR;

    return {
      deltaDCm: deltaM * 100,
      perturbedAR,
      dropDB,
    };
  });

  // 3. Derivadas parciales por diferencias centrales
  const hTau = 0.0001; // 0.1 ms
  const arTauPlus = A(d, tau + hTau);
  const arTauMinus = A(d, Math.max(tau - hTau, 0));
  // en dB por ms
  const dAR_dTau_ms = (arTauPlus - arTauMinus) / (2 * hTau * 1000);

  const hD = 0.01; // 1 cm
  const arDPlus = A(d + hD, tau);
  const arDMinus = A(Math.max(d - hD, 0.1), tau);
  // en dB por metro
  const dAR_dD_m = (arDPlus - arDMinus) / (2 * hD);

  return {
    nominalAR,
    tauPerturbations,
    dPerturbations,
    partialDerivatives: {
      dAR_dTau_ms,
      dAR_dD_m,
    },
  };
}

/**
 * Determina las ventanas de tolerancia en las cuales la atenuación trasera A_R se mantiene superior o igual a un umbral dado (defecto 10 dB).
 *
 * @param {Object} params
 * @param {number} params.d - [m]
 * @param {number} params.tau - [s]
 * @param {number} params.frequency - [Hz]
 * @param {number} params.speedOfSound - [m/s]
 * @param {number} [params.thresholdDB=10.0] - Umbral mínimo exigido de atenuación [dB]
 * @param {number} [params.rDistance=10] - [m]
 * @returns {{
 *   tauMinMs: number,
 *   tauMaxMs: number,
 *   tauSpanMs: number,
 *   dMinM: number,
 *   dMaxM: number,
 *   dSpanM: number
 * }}
 */
export function calculateToleranceWindows({
  d,
  tau,
  frequency,
  speedOfSound,
  thresholdDB = 10.0,
  rDistance = 10,
  config = {},
}) {
  const A = (dd, tt) => evaluateARObjective(dd, tt, frequency, speedOfSound, rDistance, config);
  const nominalTauMs = tau * 1000;

  // Barrido fino de tau: nominal ± 5 ms
  let tauMinMs = nominalTauMs;
  let tauMaxMs = nominalTauMs;

  for (let t = nominalTauMs; t >= 0; t -= 0.05) {
    const ar = A(d, t / 1000);
    if (ar >= thresholdDB) {
      tauMinMs = t;
    } else {
      break;
    }
  }

  for (let t = nominalTauMs; t <= nominalTauMs + 10; t += 0.05) {
    const ar = A(d, t / 1000);
    if (ar >= thresholdDB) {
      tauMaxMs = t;
    } else {
      break;
    }
  }

  // Barrido fino de d: nominal ± 2 m
  let dMinM = d;
  let dMaxM = d;

  for (let dist = d; dist >= 0.1; dist -= 0.02) {
    const ar = A(dist, tau);
    if (ar >= thresholdDB) {
      dMinM = dist;
    } else {
      break;
    }
  }

  for (let dist = d; dist <= d + 3.0; dist += 0.02) {
    const ar = A(dist, tau);
    if (ar >= thresholdDB) {
      dMaxM = dist;
    } else {
      break;
    }
  }

  return {
    tauMinMs,
    tauMaxMs,
    tauSpanMs: tauMaxMs - tauMinMs,
    dMinM,
    dMaxM,
    dSpanM: dMaxM - dMinM,
  };
}
