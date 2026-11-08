/**
 * @file integrals.js
 * @description Integrales dobles de energía acústica en regiones cartesianas y modo corona polar,
 * con verificación del cociente de energía interferida vs. no interferida ρ ≈ 1 + J0(kd).
 */

import { R_EXCLUSION, R_MIN } from '../constants.js';
import { calculatePointField } from '../field.js';
import { besselJ0 } from './bessel.js';

/**
 * Calcula la integral doble rectangular de energía en [xMin, xMax] × [yMin, yMax] usando la regla del punto medio,
 * excluyendo celdas a menos de r_ex = 0.12 m de cualquier fuente.
 *
 * I_int = ∬ E dA
 * I_sum = ∬ Σ_i (g_i² / r_i²) dA
 * ρ = I_int / I_sum
 *
 * @param {Object} options
 * @param {number} options.xMin
 * @param {number} options.xMax
 * @param {number} options.yMin
 * @param {number} options.yMax
 * @param {Array<{x: number, y: number, cRe: number, cIm: number, gain: number}>} options.precomputedSources
 * @param {number} options.k - Número de onda [rad/m]
 * @param {number} [options.n=200] - Número de divisiones por eje (N×N celdas)
 * @param {number} [options.rEx=R_EXCLUSION] - Radio de exclusión [m]
 * @returns {{
 *   I_int: number,
 *   I_sum: number,
 *   rho: number,
 *   excludedCells: number,
 *   totalCells: number,
 *   relConvergenceDiff: number,
 *   isConverged: boolean
 * }}
 */
export function integrateRectangularRegion({
  xMin,
  xMax,
  yMin,
  yMax,
  precomputedSources,
  k,
  n = 200,
  rEx = R_EXCLUSION,
}) {
  const runMidpoint = (numDivs) => {
    const dx = (xMax - xMin) / numDivs;
    const dy = (yMax - yMin) / numDivs;
    const dA = dx * dy;

    let sumInt = 0;
    let sumSum = 0;
    let excluded = 0;

    for (let j = 0; j < numDivs; j++) {
      const y = yMin + (j + 0.5) * dy;
      for (let i = 0; i < numDivs; i++) {
        const x = xMin + (i + 0.5) * dx;

        // Comprobar cercanía a fuentes
        let isExcluded = false;
        for (let s = 0; s < precomputedSources.length; s++) {
          if (Math.hypot(x - precomputedSources[s].x, y - precomputedSources[s].y) < rEx) {
            isExcluded = true;
            break;
          }
        }

        if (isExcluded) {
          excluded++;
          continue;
        }

        const pt = calculatePointField(x, y, precomputedSources, k);
        sumInt += pt.energy * dA;

        // Suma de fuentes incoherentes: Σ g_i² / r_i²
        let localSum = 0;
        for (let s = 0; s < precomputedSources.length; s++) {
          const dist = Math.max(Math.hypot(x - precomputedSources[s].x, y - precomputedSources[s].y), R_MIN);
          const g = precomputedSources[s].gain !== undefined ? precomputedSources[s].gain : 1.0;
          localSum += (g * g) / (dist * dist);
        }
        sumSum += localSum * dA;
      }
    }

    const rho = sumSum > 0 ? sumInt / sumSum : 1.0;
    return { sumInt, sumSum, rho, excluded, totalCells: numDivs * numDivs };
  };

  const resultN = runMidpoint(n);
  // Verificación de convergencia con n/2
  const resultHalf = runMidpoint(Math.max(Math.floor(n / 2), 20));

  const relConvergenceDiff = Math.abs(resultN.rho - resultHalf.rho) / Math.max(resultN.rho, 1e-6);

  return {
    I_int: resultN.sumInt,
    I_sum: resultN.sumSum,
    rho: resultN.rho,
    excludedCells: resultN.excluded,
    totalCells: resultN.totalCells,
    relConvergenceDiff,
    isConverged: relConvergenceDiff <= 0.02,
  };
}

/**
 * Realiza la integración en modo corona circular (coordenadas polares) para validar
 * la fórmula exacta de campo lejano (dos fuentes, cualquier polaridad, ganancia y retardo):
 *   ρ ≈ 1 + 2·Re(c₁·c̄₂)·J0(kd) / (g₁² + g₂²)
 * En fase (c₁ = c₂ = 1) se reduce a 1 + J0(kd); en el cardioide con τ = d/c, a 1 − cos(kd)·J0(kd).
 * ∬ E r dr dθ con r ∈ [r1, r2], θ ∈ [0, 2π].
 *
 * @param {Object} options
 * @param {number} [options.r1=3.0] - Radio interno [m]
 * @param {number} [options.r2=100.0] - Radio externo [m]
 * @param {Array<{x: number, y: number, cRe: number, cIm: number, gain: number}>} options.precomputedSources
 * @param {number} options.k - Número de onda [rad/m]
 * @param {number} options.d - Separación entre fuentes [m]
 * @param {number} [options.wavelength] - Longitud de onda λ [m]
 * @param {number} [options.numTheta=720] - Pasos angulares en θ
 * @returns {{
 *   I_int: number,
 *   I_sum: number,
 *   rho: number,
 *   rhoTheoretical: number,
 *   errorPercent: number,
 *   matchesTheory: boolean
 * }}
 */
export function integratePolarCorona({
  r1 = 3.0,
  r2 = 100.0,
  precomputedSources,
  k,
  d,
  wavelength,
  numTheta = 720,
}) {
  // Δr ≤ λ / 8 si se provee λ
  const maxDr = wavelength ? wavelength / 8 : 0.5;
  const numR = Math.max(Math.ceil((r2 - r1) / maxDr), 120);

  const dr = (r2 - r1) / numR;
  const dTheta = (2 * Math.PI) / numTheta;

  let sumInt = 0;
  let sumSum = 0;

  for (let ir = 0; ir < numR; ir++) {
    const r = r1 + (ir + 0.5) * dr;
    const rArea = r * dr * dTheta; // r dr dθ

    for (let it = 0; it < numTheta; it++) {
      const theta = (it + 0.5) * dTheta;
      const x = r * Math.cos(theta);
      const y = r * Math.sin(theta);

      const pt = calculatePointField(x, y, precomputedSources, k);
      sumInt += pt.energy * rArea;

      let localSum = 0;
      for (let s = 0; s < precomputedSources.length; s++) {
        const dist = Math.max(Math.hypot(x - precomputedSources[s].x, y - precomputedSources[s].y), R_MIN);
        const g = precomputedSources[s].gain !== undefined ? precomputedSources[s].gain : 1.0;
        localSum += (g * g) / (dist * dist);
      }
      sumSum += localSum * rArea;
    }
  }

  const rho = sumSum > 0 ? sumInt / sumSum : 1.0;
  const rhoTheoretical = theoreticalCoronaRho(precomputedSources, k, d);
  const errorPercent = Math.abs((rho - rhoTheoretical) / Math.max(Math.abs(rhoTheoretical), 1e-6)) * 100;

  return {
    I_int: sumInt,
    I_sum: sumSum,
    rho,
    rhoTheoretical,
    errorPercent,
    matchesTheory: Math.abs(rho - rhoTheoretical) <= 0.015,
  };
}

/**
 * Valor exacto de ρ en una corona lejana para dos fuentes con coeficientes c₁ (trasera) y c₂ (frontal):
 * ρ = 1 + 2·Re(c₁·c̄₂)·J0(kd) / (|c₁|² + |c₂|²).
 * Se obtiene integrando en polares el término cruzado de |P|², con r₁ − r₂ ≈ d·cos θ y
 * ∫₀^{2π} e^{−j·kd·cos θ} dθ = 2π·J0(kd).
 *
 * @param {Array<{cRe: number, cIm: number}>} precomputedSources - [trasera, frontal]
 * @param {number} k - Número de onda [rad/m]
 * @param {number} d - Separación [m]
 * @returns {number}
 */
export function theoreticalCoronaRho(precomputedSources, k, d) {
  if (!precomputedSources || precomputedSources.length !== 2) return 1.0 + besselJ0(k * d);
  const [s1, s2] = precomputedSources;
  const cross = s1.cRe * s2.cRe + s1.cIm * s2.cIm; // Re(c₁·c̄₂)
  const g2 = s1.cRe * s1.cRe + s1.cIm * s1.cIm + s2.cRe * s2.cRe + s2.cIm * s2.cIm;
  if (g2 <= 0) return 1.0;
  return 1.0 + (2 * cross * besselJ0(k * d)) / g2;
}
