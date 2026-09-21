/**
 * @file gradient.js
 * @description Cálculo analítico del gradiente de la presión, energía relativa ∇E y nivel ∇L,
 * con verificación contra diferencias finitas centrales.
 */

import { R_MIN, MIN_ENERGY_FLOOR } from '../constants.js';
import { calculatePointField } from '../field.js';

const LN10 = Math.LN10;
const DB_FACTOR = 10 / LN10; // ≈ 4.3429448

/**
 * Calcula el gradiente analítico del campo de presión ∇P = (∂P/∂x, ∂P/∂y) y energía ∇E = (∂E/∂x, ∂E/∂y).
 *
 * Fórmulas analíticas:
 * ∂P_i/∂x = c_i * exp(-j*k*r_i) * (-j*k*r_i - 1) * (x - x_i) / r_i³
 * ∂P_i/∂y = c_i * exp(-j*k*r_i) * (-j*k*r_i - 1) * (y - y_i) / r_i³
 * ∇P = Σ_i ∇P_i
 * ∇E = 2 * Re( conj(P) * ∇P )
 * ∇L = (10 / ln 10) * ∇E / E
 *
 * @param {number} x - Coordenada x [m]
 * @param {number} y - Coordenada y [m]
 * @param {Array<{x: number, y: number, cRe: number, cIm: number}>} precomputedSources
 * @param {number} k - Número de onda [rad/m]
 * @returns {{
 *   p: { re: number, im: number },
 *   gradP_x: { re: number, im: number },
 *   gradP_y: { re: number, im: number },
 *   gradE_x: number,
 *   gradE_y: number,
 *   gradMagE: number,
 *   gradL_x: number,
 *   gradL_y: number,
 *   gradMagL: number,
 *   energy: number,
 *   levelDB: number,
 *   angleDeg: number
 * }}
 */
export function calculateAnalyticalGradient(x, y, precomputedSources, k) {
  let pRe = 0;
  let pIm = 0;
  let dPxRe = 0;
  let dPxIm = 0;
  let dPyRe = 0;
  let dPyIm = 0;

  for (let i = 0; i < precomputedSources.length; i++) {
    const src = precomputedSources[i];
    const dx = x - src.x;
    const dy = y - src.y;
    const dist = Math.hypot(dx, dy);
    const r = Math.max(dist, R_MIN);

    const kr = k * r;
    const expRe = Math.cos(kr);
    const expIm = -Math.sin(kr); // exp(-j*k*r) = cos(kr) - j*sin(kr)

    // c_i * exp(-j*k*r)
    const cExpRe = src.cRe * expRe - src.cIm * expIm;
    const cExpIm = src.cRe * expIm + src.cIm * expRe;

    // Presión P_i
    pRe += cExpRe / r;
    pIm += cExpIm / r;

    // Factor (-j*k*r - 1) = -1 - j*(k*r)
    const factorRe = -1.0;
    const factorIm = -kr;

    // c_i * exp(-j*k*r) * (-1 - j*kr)
    const termRe = cExpRe * factorRe - cExpIm * factorIm;
    const termIm = cExpRe * factorIm + cExpIm * factorRe;

    const r3 = r * r * r;
    const scaleX = dx / r3;
    const scaleY = dy / r3;

    dPxRe += termRe * scaleX;
    dPxIm += termIm * scaleX;

    dPyRe += termRe * scaleY;
    dPyIm += termIm * scaleY;
  }

  const energy = pRe * pRe + pIm * pIm;
  const safeE = Math.max(energy, MIN_ENERGY_FLOOR);
  const levelDB = 10 * Math.log10(safeE);

  // ∇E = 2 * Re( conj(P) * ∇P )
  // conj(P) = pRe - j*pIm
  // conj(P) * ∇P_x = (pRe - j*pIm)*(dPxRe + j*dPxIm) = (pRe*dPxRe + pIm*dPxIm) + j(...)
  // Re(conj(P) * ∇P_x) = pRe * dPxRe + pIm * dPxIm
  const gradE_x = 2 * (pRe * dPxRe + pIm * dPxIm);
  const gradE_y = 2 * (pRe * dPyRe + pIm * dPyIm);
  const gradMagE = Math.hypot(gradE_x, gradE_y);

  // ∇L = (10 / ln 10) * ∇E / E  [dB/m]
  const gradL_x = (DB_FACTOR * gradE_x) / safeE;
  const gradL_y = (DB_FACTOR * gradE_y) / safeE;
  const gradMagL = Math.hypot(gradL_x, gradL_y);

  // Dirección de máximo crecimiento en grados [0°, 360°)
  let angleRad = Math.atan2(gradE_y, gradE_x);
  if (angleRad < 0) angleRad += 2 * Math.PI;
  const angleDeg = (angleRad * 180) / Math.PI;

  return {
    p: { re: pRe, im: pIm },
    gradP_x: { re: dPxRe, im: dPxIm },
    gradP_y: { re: dPyRe, im: dPyIm },
    gradE_x,
    gradE_y,
    gradMagE,
    gradL_x,
    gradL_y,
    gradMagL,
    energy,
    levelDB,
    angleDeg,
  };
}

/**
 * Calcula el gradiente numérico de la energía por diferencias finitas centrales.
 *
 * @param {number} x
 * @param {number} y
 * @param {Array<{x: number, y: number, cRe: number, cIm: number}>} precomputedSources
 * @param {number} k
 * @param {number} [h=1e-5] - Paso de diferenciación en metros [m]
 * @returns {{ numGradE_x: number, numGradE_y: number }}
 */
export function calculateNumericalGradient(x, y, precomputedSources, k, h = 1e-5) {
  const pRight = calculatePointField(x + h, y, precomputedSources, k);
  const pLeft = calculatePointField(x - h, y, precomputedSources, k);
  const pUp = calculatePointField(x, y + h, precomputedSources, k);
  const pDown = calculatePointField(x, y - h, precomputedSources, k);

  const numGradE_x = (pRight.energy - pLeft.energy) / (2 * h);
  const numGradE_y = (pUp.energy - pDown.energy) / (2 * h);

  return { numGradE_x, numGradE_y };
}

/**
 * Compara el gradiente analítico contra diferencias finitas y calcula el error relativo.
 *
 * @param {number} x
 * @param {number} y
 * @param {Array<{x: number, y: number, cRe: number, cIm: number}>} precomputedSources
 * @param {number} k
 * @param {number} [h=1e-5]
 * @returns {{
 *   analytical: { x: number, y: number, mag: number },
 *   numerical: { x: number, y: number, mag: number },
 *   relativeError: number,
 *   matches: boolean
 * }}
 */
export function verifyGradientAtPoint(x, y, precomputedSources, k, h = 1e-5) {
  const ana = calculateAnalyticalGradient(x, y, precomputedSources, k);
  const num = calculateNumericalGradient(x, y, precomputedSources, k, h);

  const diffX = ana.gradE_x - num.numGradE_x;
  const diffY = ana.gradE_y - num.numGradE_y;
  const diffMag = Math.hypot(diffX, diffY);
  const baseMag = Math.max(ana.gradMagE, 1e-6);

  const relativeError = diffMag / baseMag;

  return {
    analytical: { x: ana.gradE_x, y: ana.gradE_y, mag: ana.gradMagE },
    numerical: { x: num.numGradE_x, y: num.numGradE_y, mag: Math.hypot(num.numGradE_x, num.numGradE_y) },
    relativeError,
    matches: relativeError < 1e-5,
  };
}
