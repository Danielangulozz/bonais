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

    const ar = evaluateARObjective(d, tau, f, speedOfSound, rDistance);

    const ff = calculateFarFieldAttenuation({
      d,
      k,
      omega,
      gainFront: 1.0,
      gainRear: 1.0,
      polarityFront: 1,
      polarityRear: -1,
      delayFront: 0,
      delayRear: tau,
    });

    const gFront = calculateGFront(ff.frontMag, 2.0);

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
 * normalizados a 0 dB en el eje frontal (+x).
 *
 * @param {Object} params
 * @param {number} params.frequency - [Hz]
 * @param {number} params.speedOfSound - [m/s]
 * @param {number} params.d - [m]
 * @param {number} params.tau - [s]
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
  stepDeg = 2,
}) {
  const omega = calculateOmega(frequency);
  const k = calculateWavenumber(frequency, speedOfSound);

  // Valores frontales para normalización
  const cardFront = calculateFarFieldPressure(0, {
    d,
    k,
    omega,
    gainFront: 1.0,
    gainRear: 1.0,
    polarityFront: 1,
    polarityRear: -1,
    delayFront: 0,
    delayRear: tau,
  });

  const inPhaseFront = calculateFarFieldPressure(0, {
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

  const cardRefMag = Math.max(cardFront.mag, 1e-4);
  const inPhaseRefMag = Math.max(inPhaseFront.mag, 1e-4);

  const pattern = [];

  for (let deg = 0; deg <= 360; deg += stepDeg) {
    const rad = (deg * Math.PI) / 180;

    const cardP = calculateFarFieldPressure(rad, {
      d,
      k,
      omega,
      gainFront: 1.0,
      gainRear: 1.0,
      polarityFront: 1,
      polarityRear: -1,
      delayFront: 0,
      delayRear: tau,
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

    const cardRatio = Math.max(cardP.mag / cardRefMag, 1e-4);
    const inPhaseRatio = Math.max(inPhaseP.mag / inPhaseRefMag, 1e-4);

    pattern.push({
      angleDeg: deg,
      angleRad: rad,
      cardioidDB: Math.max(20 * Math.log10(cardRatio), -40),
      inPhaseDB: Math.max(20 * Math.log10(inPhaseRatio), -40),
    });
  }

  return pattern;
}
