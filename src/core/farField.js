/**
 * @file farField.js
 * @description Solución analítica en campo lejano, atenuación frente/atrás ideal y ángulos de cancelación.
 */

import { expJ, add, mul } from './complex.js';

/**
 * Calcula la presión compleja en campo lejano para un ángulo θ medido desde el eje +x (frente/público).
 * P_far(θ) ∝ c_2 * exp(+j * k * d * cosθ / 2) + c_1 * exp(-j * k * d * cosθ / 2)
 *
 * @param {number} theta - Ángulo en radianes [rad] (0 = frente, π = atrás)
 * @param {Object} params
 * @param {number} params.d - Separación física entre fuentes [m]
 * @param {number} params.k - Número de onda [rad/m]
 * @param {number} params.omega - Frecuencia angular [rad/s]
 * @param {number} [params.gainFront=1.0] - Ganancia fuente frontal
 * @param {number} [params.gainRear=1.0] - Ganancia fuente trasera
 * @param {number} [params.polarityFront=1] - Polaridad frontal (+1 o -1)
 * @param {number} [params.polarityRear=-1] - Polaridad trasera (+1 o -1)
 * @param {number} [params.delayFront=0] - Retardo fuente frontal [s]
 * @param {number} [params.delayRear=0] - Retardo fuente trasera [s]
 * @returns {{ re: number, im: number, mag: number }}
 */
export function calculateFarFieldPressure(theta, {
  d,
  k,
  omega,
  gainFront = 1.0,
  gainRear = 1.0,
  polarityFront = 1,
  polarityRear = -1,
  delayFront = 0,
  delayRear = 0,
}) {
  const spatialPhase = (k * d * Math.cos(theta)) / 2;

  // c_2 = g_2 * s_2 * exp(-j * ω * τ_2)
  const angle2 = -omega * delayFront;
  const c2Amp = gainFront * polarityFront;
  const c2 = { re: c2Amp * Math.cos(angle2), im: c2Amp * Math.sin(angle2) };

  // c_1 = g_1 * s_1 * exp(-j * ω * τ_1)
  const angle1 = -omega * delayRear;
  const c1Amp = gainRear * polarityRear;
  const c1 = { re: c1Amp * Math.cos(angle1), im: c1Amp * Math.sin(angle1) };

  // exp(+j * spatialPhase) y exp(-j * spatialPhase)
  const phaseFront = expJ(spatialPhase);
  const phaseRear = expJ(-spatialPhase);

  const termFront = mul(c2, phaseFront);
  const termRear = mul(c1, phaseRear);

  const pFar = add(termFront, termRear);
  const mag = Math.hypot(pFar.re, pFar.im);

  return { re: pFar.re, im: pFar.im, mag };
}

/**
 * Calcula la atenuación frente/atrás en campo lejano A_ff en decibelios:
 * A_ff = 20 * log10( |P_far(0)| / |P_far(π)| )
 *
 * @param {Object} params - Parámetros del arreglo
 * @returns {{ affDB: number, isIdealInfinite: boolean, frontMag: number, rearMag: number }}
 */
export function calculateFarFieldAttenuation(params) {
  const front = calculateFarFieldPressure(0, params);
  const rear = calculateFarFieldPressure(Math.PI, params);

  const frontMag = front.mag;
  const rearMag = rear.mag;

  if (rearMag < 1e-4) {
    return {
      affDB: 60.0,
      isIdealInfinite: true,
      frontMag,
      rearMag,
    };
  }

  const ratio = frontMag / rearMag;
  const affDB = 20 * Math.log10(Math.max(ratio, 1e-6));

  return {
    affDB: Math.min(affDB, 60.0),
    isIdealInfinite: affDB >= 60.0,
    frontMag,
    rearMag,
  };
}

/**
 * Calcula el ángulo del primer mínimo lateral en campo lejano para dos fuentes en fase (grados respecto al eje perpendicular).
 * Condición: sin(β) = λ / (2d), donde β es el ángulo respecto al eje y (perpendicular).
 *
 * @param {number} separation - Separación d [m]
 * @param {number} wavelength - Longitud de onda λ [m]
 * @returns {{ exists: boolean, angleDeg: number | null }}
 */
export function calculateInPhaseFirstMinimumAngle(separation, wavelength) {
  const ratio = wavelength / (2 * separation);
  if (ratio > 1.0) {
    return { exists: false, angleDeg: null };
  }
  const angleRad = Math.asin(ratio);
  const angleDeg = (angleRad * 180) / Math.PI;
  return { exists: true, angleDeg };
}
