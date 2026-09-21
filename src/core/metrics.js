/**
 * @file metrics.js
 * @description Cálculo de métricas acústicas del arreglo: A_R, A_ff, G_front, Q_PE y comparativa diferencial.
 */

import { calculatePointField, precomputeSourceCoefficients, createTwoSubSources } from './field.js';
import { calculateFarFieldAttenuation } from './farField.js';
import { integrateRectangularRegion } from './calculus/integrals.js';
import { calculateWavenumber, calculateOmega } from './physics.js';
import { DEFAULT_REFERENCE_DISTANCE } from './constants.js';

/**
 * Regiones por defecto para el cálculo de Q_PE
 */
export const DEFAULT_AUDIENCE_REGION = { xMin: 3.0, xMax: 15.0, yMin: -8.0, yMax: 8.0 };
export const DEFAULT_STAGE_REGION = { xMin: -15.0, xMax: -3.0, yMin: -8.0, yMax: 8.0 };

/**
 * Calcula la atenuación frente/atrás A_R a distancia de referencia R en el eje x:
 * A_R = 20 * log10( |P(+R, 0)| / |P(-R, 0)| )
 *
 * @param {Array<{x: number, y: number, cRe: number, cIm: number}>} precomputedSources
 * @param {number} k - Número de onda [rad/m]
 * @param {number} [rDistance=DEFAULT_REFERENCE_DISTANCE] - Distancia de referencia R [m]
 * @returns {{ arDB: number, pFrontMag: number, pRearMag: number }}
 */
export function calculateAR(precomputedSources, k, rDistance = DEFAULT_REFERENCE_DISTANCE) {
  const frontPt = calculatePointField(rDistance, 0, precomputedSources, k);
  const rearPt = calculatePointField(-rDistance, 0, precomputedSources, k);

  const frontMag = Math.sqrt(frontPt.energy);
  const rearMag = Math.sqrt(rearPt.energy);

  if (rearMag < 1e-6) {
    return { arDB: 60.0, pFrontMag: frontMag, pRearMag: rearMag };
  }

  const arDB = 20 * Math.log10(frontMag / rearMag);
  return { arDB, pFrontMag: frontMag, pRearMag: rearMag };
}

/**
 * Calcula la ganancia frontal relativa al máximo coherente:
 * G_front = 20 * log10( |P_far(0)| / (g1 + g2) )
 *
 * @param {number} frontMag - Magnitud |P_far(0)|
 * @param {number} sumGains - Suma de ganancias lineales (g1 + g2)
 * @returns {number} Decibelios [dB] (0 dB = suma perfecta en fase)
 */
export function calculateGFront(frontMag, sumGains = 2.0) {
  if (sumGains <= 0) return 0;
  return 20 * Math.log10(Math.max(frontMag / sumGains, 1e-6));
}

/**
 * Calcula el cociente de energía público/escenario Q_PE en decibelios:
 * Q_PE = 10 * log10( ∬_público E dA / ∬_escenario E dA )
 *
 * @param {Object} options
 * @param {Array} options.precomputedSources
 * @param {number} options.k
 * @param {Object} [options.audienceRegion=DEFAULT_AUDIENCE_REGION]
 * @param {Object} [options.stageRegion=DEFAULT_STAGE_REGION]
 * @param {number} [options.n=100] - División por eje
 * @returns {{ qpeDB: number, audienceEnergy: number, stageEnergy: number }}
 */
export function calculateQPE({
  precomputedSources,
  k,
  audienceRegion = DEFAULT_AUDIENCE_REGION,
  stageRegion = DEFAULT_STAGE_REGION,
  n = 100,
}) {
  const aud = integrateRectangularRegion({
    xMin: audienceRegion.xMin,
    xMax: audienceRegion.xMax,
    yMin: audienceRegion.yMin,
    yMax: audienceRegion.yMax,
    precomputedSources,
    k,
    n,
  });

  const stg = integrateRectangularRegion({
    xMin: stageRegion.xMin,
    xMax: stageRegion.xMax,
    yMin: stageRegion.yMin,
    yMax: stageRegion.yMax,
    precomputedSources,
    k,
    n,
  });

  const audienceEnergy = aud.I_int;
  const stageEnergy = stg.I_int;

  let qpeDB = 0;
  if (stageEnergy > 1e-12) {
    qpeDB = 10 * Math.log10(Math.max(audienceEnergy / stageEnergy, 1e-6));
  }

  return { qpeDB, audienceEnergy, stageEnergy };
}

/**
 * Evalúa todas las métricas acústicas del arreglo actual y las compara
 * contra un arreglo de referencia de dos subwoofers en fase con la misma d, f y ganancias.
 *
 * @param {Object} params
 * @param {number} params.frequency
 * @param {number} params.speedOfSound
 * @param {number} params.separation
 * @param {number} params.delayRear
 * @param {number} [params.delayFront=0]
 * @param {number} [params.gainRear=1.0]
 * @param {number} [params.gainFront=1.0]
 * @param {number} [params.polarityRear=-1]
 * @param {number} [params.polarityFront=1]
 * @param {number} [params.rDistance=DEFAULT_REFERENCE_DISTANCE]
 * @param {Object} [params.audienceRegion]
 * @param {Object} [params.stageRegion]
 * @param {boolean} [params.computeQPE=true]
 * @returns {Object}
 */
export function evaluateAllMetrics(params) {
  const {
    frequency,
    speedOfSound,
    separation,
    delayRear,
    delayFront = 0,
    gainRear = 1.0,
    gainFront = 1.0,
    polarityRear = -1,
    polarityFront = 1,
    rDistance = DEFAULT_REFERENCE_DISTANCE,
    audienceRegion = DEFAULT_AUDIENCE_REGION,
    stageRegion = DEFAULT_STAGE_REGION,
    computeQPE = true,
  } = params;

  const omega = calculateOmega(frequency);
  const k = calculateWavenumber(frequency, speedOfSound);

  // 1. Arreglo actual
  const currentSources = createTwoSubSources({
    separation,
    delayRear,
    delayFront,
    gainRear,
    gainFront,
    polarityRear,
    polarityFront,
  });
  const precompCurrent = precomputeSourceCoefficients(currentSources, omega);

  const arCurrent = calculateAR(precompCurrent, k, rDistance);
  const affCurrent = calculateFarFieldAttenuation({
    d: separation,
    k,
    omega,
    gainFront,
    gainRear,
    polarityFront,
    polarityRear,
    delayFront,
    delayRear,
  });
  const gFrontCurrent = calculateGFront(affCurrent.frontMag, gainFront + gainRear);

  let qpeCurrent = { qpeDB: 0, audienceEnergy: 0, stageEnergy: 0 };
  if (computeQPE) {
    qpeCurrent = calculateQPE({
      precomputedSources: precompCurrent,
      k,
      audienceRegion,
      stageRegion,
      n: params.n || 30,
    });
  }

  // 2. Arreglo de referencia en fase (mismo d, f, ganancias, pero polaridades +1 y retardo 0)
  const inPhaseSources = createTwoSubSources({
    separation,
    delayRear: 0,
    delayFront: 0,
    gainRear,
    gainFront,
    polarityRear: 1,
    polarityFront: 1,
  });
  const precompInPhase = precomputeSourceCoefficients(inPhaseSources, omega);

  const arInPhase = calculateAR(precompInPhase, k, rDistance);
  const affInPhase = calculateFarFieldAttenuation({
    d: separation,
    k,
    omega,
    gainFront,
    gainRear,
    polarityFront: 1,
    polarityRear: 1,
    delayFront: 0,
    delayRear: 0,
  });
  const gFrontInPhase = calculateGFront(affInPhase.frontMag, gainFront + gainRear);

  let qpeInPhase = { qpeDB: 0, audienceEnergy: 0, stageEnergy: 0 };
  if (computeQPE) {
    qpeInPhase = calculateQPE({
      precomputedSources: precompInPhase,
      k,
      audienceRegion,
      stageRegion,
      n: params.n || 30,
    });
  }

  return {
    current: {
      arDB: arCurrent.arDB,
      affDB: affCurrent.affDB,
      isIdealInfinite: affCurrent.isIdealInfinite,
      gFrontDB: gFrontCurrent,
      qpeDB: qpeCurrent.qpeDB,
      audienceEnergy: qpeCurrent.audienceEnergy,
      stageEnergy: qpeCurrent.stageEnergy,
    },
    inPhase: {
      arDB: arInPhase.arDB,
      affDB: affInPhase.affDB,
      isIdealInfinite: affInPhase.isIdealInfinite,
      gFrontDB: gFrontInPhase,
      qpeDB: qpeInPhase.qpeDB,
      audienceEnergy: qpeInPhase.audienceEnergy,
      stageEnergy: qpeInPhase.stageEnergy,
    },
    delta: {
      deltaAR: arCurrent.arDB - arInPhase.arDB,
      deltaAFF: affCurrent.affDB - affInPhase.affDB,
      deltaGFront: gFrontCurrent - gFrontInPhase,
      deltaQPE: qpeCurrent.qpeDB - qpeInPhase.qpeDB,
    },
  };
}
