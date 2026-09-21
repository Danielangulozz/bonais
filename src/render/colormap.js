/**
 * @file colormap.js
 * @description Rampa secuencial perceptual tipo Magma para visualización del nivel SPL [dB],
 * optimizada para daltonismo y con generación de paleta Uint32 para escritura directa en Canvas 2D.
 */

// Puntos de control perceptuales de la paleta Magma: [t, R, G, B]
const MAGMA_STOPS = [
  { t: 0.00, r: 14,  g: 15,  b: 30 },  // Negro violáceo profundo (-40 dB o nulos)
  { t: 0.15, r: 40,  g: 17,  b: 75 },  // Púrpura oscuro
  { t: 0.35, r: 100, g: 24,  b: 110 }, // Magenta oscuro
  { t: 0.55, r: 180, g: 54,  b: 100 }, // Rosa cálido
  { t: 0.75, r: 240, g: 115, b: 60 },  // Naranja brillante
  { t: 0.90, r: 250, g: 200, b: 80 },  // Amarillo oro
  { t: 1.00, r: 252, g: 253, b: 191 }, // Blanco cálido máximo (+12 dB)
];

const PALETTE_SIZE = 512;
const MIN_DB_DEFAULT = -40;
const MAX_DB_DEFAULT = 12;

/**
 * Tabla precomputada de colores Uint32 (formato Little-Endian ABGR para ImageData).
 * 0xFF_BB_GG_RR
 * @type {Uint32Array}
 */
export const MAGMA_UINT32_TABLE = new Uint32Array(PALETTE_SIZE);

/**
 * Tabla precomputada de colores CSS [r, g, b]
 * @type {Array<[number, number, number]>}
 */
export const MAGMA_RGB_TABLE = new Array(PALETTE_SIZE);

// Inicializar tablas precalculadas
(function initColormapTables() {
  for (let i = 0; i < PALETTE_SIZE; i++) {
    const t = i / (PALETTE_SIZE - 1);

    // Encontrar segmento de interpolación
    let s0 = MAGMA_STOPS[0];
    let s1 = MAGMA_STOPS[MAGMA_STOPS.length - 1];

    for (let s = 0; s < MAGMA_STOPS.length - 1; s++) {
      if (t >= MAGMA_STOPS[s].t && t <= MAGMA_STOPS[s + 1].t) {
        s0 = MAGMA_STOPS[s];
        s1 = MAGMA_STOPS[s + 1];
        break;
      }
    }

    const localT = (t - s0.t) / (s1.t - s0.t);
    const r = Math.round(s0.r + localT * (s1.r - s0.r));
    const g = Math.round(s0.g + localT * (s1.g - s0.g));
    const b = Math.round(s0.b + localT * (s1.b - s0.b));

    MAGMA_RGB_TABLE[i] = [r, g, b];

    // En arquitecturas little-endian (x86/ARM), Uint32Array escribe bytes en memoria: [R, G, B, A]
    // Por ende: (A << 24) | (B << 16) | (G << 8) | R
    const a = 255;
    MAGMA_UINT32_TABLE[i] = (a << 24) | (b << 16) | (g << 8) | r;
  }
})();

/**
 * Mapea un nivel en dB al índice de la paleta.
 * @param {number} levelDB - Nivel SPL relativo en dB
 * @param {number} [minDB=MIN_DB_DEFAULT] - Límite inferior (-40 dB)
 * @param {number} [maxDB=MAX_DB_DEFAULT] - Límite superior (+12 dB)
 * @returns {number} Índice [0, PALETTE_SIZE - 1]
 */
export function getPaletteIndex(levelDB, minDB = MIN_DB_DEFAULT, maxDB = MAX_DB_DEFAULT) {
  if (levelDB <= minDB) return 0;
  if (levelDB >= maxDB) return PALETTE_SIZE - 1;
  const norm = (levelDB - minDB) / (maxDB - minDB);
  return (norm * (PALETTE_SIZE - 1)) | 0;
}

/**
 * Obtiene el color Uint32 listo para asignar a ImageData.data32.
 * @param {number} levelDB
 * @param {number} [minDB]
 * @param {number} [maxDB]
 * @returns {number}
 */
export function getMagmaUint32(levelDB, minDB = MIN_DB_DEFAULT, maxDB = MAX_DB_DEFAULT) {
  return MAGMA_UINT32_TABLE[getPaletteIndex(levelDB, minDB, maxDB)];
}

/**
 * Obtiene el color en formato CSS `rgb(r, g, b)`.
 * @param {number} levelDB
 * @param {number} [minDB]
 * @param {number} [maxDB]
 * @returns {string}
 */
export function getMagmaCSS(levelDB, minDB = MIN_DB_DEFAULT, maxDB = MAX_DB_DEFAULT) {
  const [r, g, b] = MAGMA_RGB_TABLE[getPaletteIndex(levelDB, minDB, maxDB)];
  return `rgb(${r}, ${g}, ${b})`;
}
