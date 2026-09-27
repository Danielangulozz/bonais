/**
 * @file frequencyResponse.js
 * @description Respuesta en frecuencia del arreglo (barrido 20–200 Hz), cálculo de ancho de banda útil
 * a -3 dB y datos para diagramas polares de campo lejano.
 */

import { evaluateARObjective } from './optimize.js';
import { calculateFarFieldPressure, calculateFarFieldAttenuation } from './farField.js';
import { calculateGFront } from './metrics.js';
import { calculateWavenumber, calculateOmega } from './physics.js';

/**
 * Realiza un barrido en frecuencia de 20 a 200 Hz para calcular A_R(f) y G_front(f).
 *
 * @param {Object} params
 * @param {number} params.d - Separación física [m]
 * @param {number} params.tau - Retardo de fuente trasera [s]
 * @param {number} params.speedOfSound - [m/s]
 * @param {number} [params.fMin=20] - Frecuencia inicial [Hz]
 * @param {number} [params.fMax=200] - Frecuencia final [Hz]
 * @param {number} [params.numPoints=91] - Cantidad de puntos (paso ~2 Hz)
 * @param {number} [params.rDistance=10] - [m]
 * @returns {Array<{
 *   frequency: number,
 *   arDB: number,
 *   gFrontDB: number,
 *   isUsefulBand: boolean
 * }>}
 */
export function sweepFrequencyResponse({
  d,
  tau,
  speedOfSound,
  gainFront = 1.0,
  gainRear = 1.0,
  polarityFront = 1,
  polarityRear = -1,
  delayFront = 0,
  delayRear = tau,
  fMin = 20,
  fMax = 200,
  numPoints = 91,
  rDistance = 10,
}) {
  const step = (fMax - fMin) / (numPoints - 1);
  const data = [];

  for (let i = 0; i < numPoints; i++) {
    const f = fMin + i * step;
    const omega = calculateOmega(f);
    const k = calculateWavenumber(f, speedOfSound);

    const ar = evaluateARObjective(d, delayRear, f, speedOfSound, rDistance);

    const ff = calculateFarFieldAttenuation({
      d,
      k,
      omega,
      gainFront,
      gainRear,
      polarityFront,
      polarityRear,
      delayFront,
      delayRear,
    });

    const gFront = calculateGFront(ff.frontMag, (gainFront + gainRear));

    data.push({
      frequency: Math.round(f * 10) / 10,
      arDB: Math.round(ar * 10) / 10,
      gFrontDB: Math.round(gFront * 10) / 10,
      isUsefulBand: gFront >= -3.0,
    });
  }

  return data;
}

/**
 * Calcula la banda útil teórica en la cual G_front ≥ -3 dB para un cardioide con τ = d/c.
 * f_c = c / (4d)
 * Banda: [f_c / 2, 3 * f_c / 2]
 *
 * @param {number} d - Separación física [m]
 * @param {number} speedOfSound - [m/s]
 * @returns {{ fc: number, fLow: number, fHigh: number }}
 */
export function calculateCardioidPassband(d, speedOfSound) {
  const fc = speedOfSound / (4 * d);
  return {
    fc,
    fLow: fc / 2,
    fHigh: (3 * fc) / 2,
  };
}

/**
 * Genera datos de radiación polar para 360 grados a la frecuencia de interés,
 * normalizados a 0 dB en la dirección del lóbulo principal.
 *
 * @param {Object} params
 * @param {number} params.frequency - [Hz]
 * @param {number} params.speedOfSound - [m/s]
 * @param {number} params.d - [m]
 * @param {number} params.tau - [s]
 * @param {number} [params.gainFront=1.0]
 * @param {number} [params.gainRear=1.0]
 * @param {number} [params.polarityFront=1]
 * @param {number} [params.polarityRear=-1]
 * @param {number} [params.delayFront=0]
 * @param {number} [params.delayRear]
 * @param {number} [params.stepDeg=2] - Paso angular en grados
 * @returns {Array<{
 *   angleDeg: number,
 *   angleRad: number,
 *   cardioidDB: number,
 *   inPhaseDB: number
 * }>}
 */
export function generatePolarRadiationPattern({
  frequency,
  speedOfSound,
  d,
  tau,
  gainFront = 1.0,
  gainRear = 1.0,
  polarityFront = 1,
  polarityRear = -1,
  delayFront = 0,
  delayRear = tau,
  stepDeg = 2,
}) {
  const omega = calculateOmega(frequency);
  const k = calculateWavenumber(frequency, speedOfSound);

  const rawPoints = [];
  let maxCardMag = 0;
  let maxInPhaseMag = 0;

  for (let deg = 0; deg <= 360; deg += stepDeg) {
    const rad = (deg * Math.PI) / 180;

    const cardP = calculateFarFieldPressure(rad, {
      d,
      k,
      omega,
      gainFront,
      gainRear,
      polarityFront,
      polarityRear,
      delayFront,
      delayRear,
    });

    const inPhaseP = calculateFarFieldPressure(rad, {
      d,
      k,
      omega,
      gainFront: 1.0,
      gainRear: 1.0,
      polarityFront: 1,
      polarityRear: 1,
      delayFront: 0,
      delayRear: 0,
    });

    if (cardP.mag > maxCardMag) maxCardMag = cardP.mag;
    if (inPhaseP.mag > maxInPhaseMag) maxInPhaseMag = inPhaseP.mag;

    rawPoints.push({
      angleDeg: deg,
      angleRad: rad,
      cardMag: cardP.mag,
      inPhaseMag: inPhaseP.mag,
    });
  }

  const refCard = Math.max(maxCardMag, 1e-4);
  const refInPhase = Math.max(maxInPhaseMag, 1e-4);

  return rawPoints.map((pt) => ({
    angleDeg: pt.angleDeg,
    angleRad: pt.angleRad,
    cardioidDB: Math.max(20 * Math.log10(Math.max(pt.cardMag / refCard, 1e-4)), -40),
    inPhaseDB: Math.max(20 * Math.log10(Math.max(pt.inPhaseMag / refInPhase, 1e-4)), -40),
  }));
}
