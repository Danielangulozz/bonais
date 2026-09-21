/**
 * @file criticalPoints.js
 * @description Búsqueda y clasificación de puntos críticos (∇E = 0) usando Newton multivariable y matriz Hessiana.
 */

import { calculateAnalyticalGradient } from './gradient.js';

/**
 * @typedef {Object} HessianMatrix
 * @property {number} Exx - Segunda derivada parcial respecto a x
 * @property {number} Exy - Derivada cruzada mixta respecto a x e y
 * @property {number} Eyy - Segunda derivada parcial respecto a y
 * @property {number} D - Determinante del Hessiano: Exx*Eyy - Exy²
 * @property {string} type - 'maximum' | 'minimum' | 'saddle' | 'inconclusive'
 */

/**
 * Calcula la matriz Hessiana de la energía E en (x, y) mediante diferencias centrales
 * del gradiente analítico con paso h = 1e-4 m.
 *
 * @param {number} x
 * @param {number} y
 * @param {Array} precomputedSources
 * @param {number} k
 * @param {number} [h=1e-4]
 * @returns {HessianMatrix}
 */
export function calculateHessian(x, y, precomputedSources, k, h = 1e-4) {
  const gradRight = calculateAnalyticalGradient(x + h, y, precomputedSources, k);
  const gradLeft = calculateAnalyticalGradient(x - h, y, precomputedSources, k);
  const gradUp = calculateAnalyticalGradient(x, y + h, precomputedSources, k);
  const gradDown = calculateAnalyticalGradient(x, y - h, precomputedSources, k);

  const Exx = (gradRight.gradE_x - gradLeft.gradE_x) / (2 * h);
  const Exy = (gradUp.gradE_x - gradDown.gradE_x) / (2 * h);
  const Eyy = (gradUp.gradE_y - gradDown.gradE_y) / (2 * h);

  const D = Exx * Eyy - Exy * Exy;

  // Criterio del Hessiano
  const scale = Exx * Exx + Eyy * Eyy;
  let type = 'inconclusive';

  if (scale > 0 && Math.abs(D) / scale < 1e-6) {
    type = 'inconclusive';
  } else if (D > 0) {
    if (Exx < 0) {
      type = 'maximum';
    } else if (Exx > 0) {
      type = 'minimum';
    }
  } else if (D < 0) {
    type = 'saddle';
  }

  return { Exx, Exy, Eyy, D, type };
}

/**
 * Encuentra y clasifica los puntos críticos del campo de energía en la región [xMin, xMax] × [yMin, yMax].
 *
 * @param {Object} options
 * @param {Array} options.precomputedSources
 * @param {number} options.k - Número de onda [rad/m]
 * @param {number} options.wavelength - Longitud de onda λ [m]
 * @param {number} options.xMin
 * @param {number} options.xMax
 * @param {number} options.yMin
 * @param {number} options.yMax
 * @returns {Array<{
 *   x: number,
 *   y: number,
 *   energy: number,
 *   levelDB: number,
 *   Exx: number,
 *   Exy: number,
 *   Eyy: number,
 *   D: number,
 *   type: string,
 *   residualGrad: number
 * }>}
 */
export function findCriticalPoints({
  precomputedSources,
  k,
  wavelength,
  xMin,
  xMax,
  yMin,
  yMax,
}) {
  const seedStep = Math.max(wavelength / 8, 0.25);
  const maxStep = 0.05 * wavelength;
  const minSourceDist = Math.max(0.15, 0.02 * wavelength);
  const deduplicateRadius = 0.02 * wavelength;
  const maxIterations = 30;
  const convergenceTol = 1e-6;

  const rawPoints = [];

  // Malla de semillas
  for (let sx = xMin + seedStep / 2; sx <= xMax; sx += seedStep) {
    for (let sy = yMin + seedStep / 2; sy <= yMax; sy += seedStep) {
      let x = sx;
      let y = sy;
      let converged = false;

      for (let iter = 0; iter < maxIterations; iter++) {
        // Chequear distancia a las fuentes
        let tooClose = false;
        for (let s = 0; s < precomputedSources.length; s++) {
          if (Math.hypot(x - precomputedSources[s].x, y - precomputedSources[s].y) < minSourceDist) {
            tooClose = true;
            break;
          }
        }
        if (tooClose) break;

        const grad = calculateAnalyticalGradient(x, y, precomputedSources, k);
        const hessian = calculateHessian(x, y, precomputedSources, k);

        const D = hessian.D;
        if (Math.abs(D) < 1e-12) break;

        // Resolver H * δ = -∇E
        // H = [Exx Exy; Exy Eyy]
        // δ = -1/D * [Eyy*gx - Exy*gy; -Exy*gx + Exx*gy]
        let deltaX = -(hessian.Eyy * grad.gradE_x - hessian.Exy * grad.gradE_y) / D;
        let deltaY = -(-hessian.Exy * grad.gradE_x + hessian.Exx * grad.gradE_y) / D;

        const deltaLen = Math.hypot(deltaX, deltaY);
        if (deltaLen > maxStep) {
          const factor = maxStep / deltaLen;
          deltaX *= factor;
          deltaY *= factor;
        }

        x += deltaX;
        y += deltaY;

        if (deltaLen < convergenceTol) {
          converged = true;
          break;
        }

        // Salir si diverge fuera de la región ampliada
        if (x < xMin - 1 || x > xMax + 1 || y < yMin - 1 || y > yMax + 1) {
          break;
        }
      }

      if (converged) {
        // Verificar límites
        if (x >= xMin && x <= xMax && y >= yMin && y <= yMax) {
          // Chequear distancia final a fuentes
          let tooClose = false;
          for (let s = 0; s < precomputedSources.length; s++) {
            if (Math.hypot(x - precomputedSources[s].x, y - precomputedSources[s].y) < minSourceDist) {
              tooClose = true;
              break;
            }
          }

          if (!tooClose) {
            const finalGrad = calculateAnalyticalGradient(x, y, precomputedSources, k);
            if (finalGrad.gradMagE < 1e-2) {
              const finalHess = calculateHessian(x, y, precomputedSources, k);
              rawPoints.push({
                x,
                y,
                energy: finalGrad.energy,
                levelDB: finalGrad.levelDB,
                Exx: finalHess.Exx,
                Exy: finalHess.Exy,
                Eyy: finalHess.Eyy,
                D: finalHess.D,
                type: finalHess.type,
                residualGrad: finalGrad.gradMagE,
              });
            }
          }
        }
      }
    }
  }

  // Deduplicación espacial
  const uniquePoints = [];
  for (let i = 0; i < rawPoints.length; i++) {
    const pt = rawPoints[i];
    let duplicate = false;
    for (let j = 0; j < uniquePoints.length; j++) {
      if (Math.hypot(pt.x - uniquePoints[j].x, pt.y - uniquePoints[j].y) < deduplicateRadius) {
        duplicate = true;
        // Si el nuevo tiene menor residuo, reemplazar
        if (pt.residualGrad < uniquePoints[j].residualGrad) {
          uniquePoints[j] = pt;
        }
        break;
      }
    }
    if (!duplicate) {
      uniquePoints.push(pt);
    }
  }

  return uniquePoints;
}
