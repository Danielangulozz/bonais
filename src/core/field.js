/**
 * @file field.js
 * @description Cálculo del campo de presión acústica compleja, energía relativa y nivel SPL para fuentes puntuales.
 */

import { R_MIN, MIN_ENERGY_FLOOR, E_REF } from './constants.js';

/**
 * @typedef {Object} SourceConfig
 * @property {number} x - Posición en eje x [m]
 * @property {number} y - Posición en eje y [m]
 * @property {number} gain - Ganancia lineal de amplitud [≥ 0]
 * @property {number} polarity - Polaridad (+1 o -1)
 * @property {number} delay - Retardo temporal en segundos [s]
 */

/**
 * @typedef {Object} ArrayConfig
 * @property {number} frequency - Frecuencia del tono puro [Hz]
 * @property {number} speedOfSound - Velocidad del sonido [m/s]
 * @property {SourceConfig[]} sources - Lista de fuentes del arreglo
 */

/**
 * Precalcula los coeficientes complejos c_i para cada fuente:
 * c_i = g_i * s_i * exp(-j * ω * τ_i)
 *
 * @param {SourceConfig[]} sources
 * @param {number} omega - Frecuencia angular [rad/s]
 * @returns {Array<{x: number, y: number, cRe: number, cIm: number, gain: number}>}
 */
export function precomputeSourceCoefficients(sources, omega) {
  return sources.map((s) => {
    const angle = -omega * (s.delay || 0);
    const amp = (s.gain !== undefined ? s.gain : 1.0) * (s.polarity !== undefined ? s.polarity : 1.0);
    return {
      x: s.x,
      y: s.y,
      cRe: amp * Math.cos(angle),
      cIm: amp * Math.sin(angle),
      gain: s.gain !== undefined ? s.gain : 1.0,
    };
  });
}

/**
 * Genera la configuración estándar de 2 subwoofers sobre el eje x.
 * Fuente 1 (trasera): (-d/2, 0)
 * Fuente 2 (frontal): (+d/2, 0)
 *
 * @param {Object} params
 * @param {number} params.separation - Separación física entre cajas d [m]
 * @param {number} [params.delayRear=0] - Retardo de la fuente trasera en segundos [s]
 * @param {number} [params.delayFront=0] - Retardo de la fuente frontal en segundos [s]
 * @param {number} [params.gainRear=1.0] - Ganancia lineal trasera
 * @param {number} [params.gainFront=1.0] - Ganancia lineal frontal
 * @param {number} [params.polarityRear=-1] - Polaridad trasera (+1 o -1)
 * @param {number} [params.polarityFront=1] - Polaridad frontal (+1 o -1)
 * @returns {SourceConfig[]}
 */
export function createTwoSubSources({
  separation,
  delayRear = 0,
  delayFront = 0,
  gainRear = 1.0,
  gainFront = 1.0,
  polarityRear = -1,
  polarityFront = 1,
}) {
  const halfD = separation / 2;
  return [
    {
      x: -halfD,
      y: 0,
      gain: gainRear,
      polarity: polarityRear,
      delay: delayRear,
    },
    {
      x: halfD,
      y: 0,
      gain: gainFront,
      polarity: polarityFront,
      delay: delayFront,
    },
  ];
}

/**
 * Evalúa la presión compleja P(x, y), energía E y nivel L en un punto espacial (x, y).
 * P(x,y) = Σ_i c_i * exp(-j * k * r_i) / r_i
 * E(x,y) = |P|² = Re² + Im²
 * L(x,y) = 10 * log10( max(E, 1e-12) / E_ref )
 *
 * @param {number} x - Coordenada x [m]
 * @param {number} y - Coordenada y [m]
 * @param {Array<{x: number, y: number, cRe: number, cIm: number}>} precomputedSources
 * @param {number} k - Número de onda [rad/m]
 * @returns {{ pRe: number, pIm: number, energy: number, levelDB: number }}
 */
export function calculatePointField(x, y, precomputedSources, k) {
  let pRe = 0;
  let pIm = 0;

  for (let i = 0; i < precomputedSources.length; i++) {
    const src = precomputedSources[i];
    const dx = x - src.x;
    const dy = y - src.y;
    const dist = Math.hypot(dx, dy);
    const r = Math.max(dist, R_MIN);

    // exp(-j * k * r) = cos(-k*r) + j*sin(-k*r) = cos(kr) - j*sin(kr)
    const kr = k * r;
    const expRe = Math.cos(kr);
    const expIm = -Math.sin(kr);

    // c_i * exp(-j*k*r) / r
    // (cRe + j*cIm) * (expRe + j*expIm) / r
    const termRe = (src.cRe * expRe - src.cIm * expIm) / r;
    const termIm = (src.cRe * expIm + src.cIm * expRe) / r;

    pRe += termRe;
    pIm += termIm;
  }

  const energy = pRe * pRe + pIm * pIm;
  const safeE = Math.max(energy, MIN_ENERGY_FLOOR);
  const levelDB = 10 * Math.log10(safeE / E_REF);

  return { pRe, pIm, energy, levelDB };
}

/**
 * Evalúa el campo acústico sobre una malla rectangular 2D completa.
 * Optimizado para alta tasa de refresco (60 FPS) usando Float64Array.
 *
 * @param {Object} options
 * @param {Array<{x: number, y: number, cRe: number, cIm: number}>} options.precomputedSources
 * @param {number} options.k - Número de onda [rad/m]
 * @param {number} options.xMin - Límite inferior en x [m]
 * @param {number} options.xMax - Límite superior en x [m]
 * @param {number} options.yMin - Límite inferior en y [m]
 * @param {number} options.yMax - Límite superior en y [m]
 * @param {number} options.width - Número de columnas (resolución x)
 * @param {number} options.height - Número de filas (resolución y)
 * @returns {{ energyGrid: Float64Array, levelGrid: Float64Array, minLevel: number, maxLevel: number }}
 */
export function computeFieldGrid({
  precomputedSources,
  k,
  xMin,
  xMax,
  yMin,
  yMax,
  width,
  height,
}) {
  const totalPoints = width * height;
  const energyGrid = new Float64Array(totalPoints);
  const levelGrid = new Float64Array(totalPoints);

  const dx = (xMax - xMin) / (width - 1);
  const dy = (yMax - yMin) / (height - 1);

  const numSources = precomputedSources.length;
  const srcX = new Float64Array(numSources);
  const srcY = new Float64Array(numSources);
  const srcCRe = new Float64Array(numSources);
  const srcCIm = new Float64Array(numSources);

  for (let s = 0; s < numSources; s++) {
    srcX[s] = precomputedSources[s].x;
    srcY[s] = precomputedSources[s].y;
    srcCRe[s] = precomputedSources[s].cRe;
    srcCIm[s] = precomputedSources[s].cIm;
  }

  let minL = Infinity;
  let maxL = -Infinity;

  let idx = 0;
  for (let j = 0; j < height; j++) {
    const y = yMax - j * dy; // y va de arriba hacia abajo para coordenadas de pantalla
    for (let i = 0; i < width; i++) {
      const x = xMin + i * dx;

      let pRe = 0;
      let pIm = 0;

      for (let s = 0; s < numSources; s++) {
        const diffX = x - srcX[s];
        const diffY = y - srcY[s];
        const dist = Math.hypot(diffX, diffY);
        const r = dist < R_MIN ? R_MIN : dist;

        const kr = k * r;
        const expRe = Math.cos(kr);
        const expIm = -Math.sin(kr);

        const invR = 1.0 / r;
        pRe += (srcCRe[s] * expRe - srcCIm[s] * expIm) * invR;
        pIm += (srcCRe[s] * expIm + srcCIm[s] * expRe) * invR;
      }

      const E = pRe * pRe + pIm * pIm;
      const safeE = E < MIN_ENERGY_FLOOR ? MIN_ENERGY_FLOOR : E;
      const L = 10 * Math.log10(safeE);

      energyGrid[idx] = E;
      levelGrid[idx] = L;

      if (L < minL) minL = L;
      if (L > maxL) maxL = L;

      idx++;
    }
  }

  return { energyGrid, levelGrid, minLevel: minL, maxLevel: maxL };
}
