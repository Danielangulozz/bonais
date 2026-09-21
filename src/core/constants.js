/**
 * @file constants.js
 * @description Constantes físicas, valores por defecto y límites de seguridad acústicos.
 */

/**
 * Distancia mínima a una fuente puntual para evitar divergencia numérica 1/r.
 * @type {number} [m]
 */
export const R_MIN = 0.05;

/**
 * Radio de exclusión para integración numérica alrededor de las fuentes.
 * @type {number} [m]
 */
export const R_EXCLUSION = 0.12;

/**
 * Nivel de piso mínimo para evitar logaritmo de cero o divergencias en nulos acústicos (-120 dB).
 * @type {number}
 */
export const MIN_ENERGY_FLOOR = 1e-12;

/**
 * Energía de referencia para cálculo de nivel SPL relativo (0 dB = 1 fuente unitaria a 1 m).
 * @type {number}
 */
export const E_REF = 1.0;

/**
 * Frecuencia acústica por defecto (subwoofer centrado en la banda común).
 * @type {number} [Hz]
 */
export const DEFAULT_FREQUENCY = 80;

/**
 * Temperatura ambiente por defecto.
 * @type {number} [°C]
 */
export const DEFAULT_TEMPERATURE = 20;

/**
 * Distancia de medición estándar para atenuación frente/atrás (A_R).
 * @type {number} [m]
 */
export const DEFAULT_REFERENCE_DISTANCE = 10;

/**
 * Calcula la velocidad del sonido en el aire en función de la temperatura.
 * Fórmula física: c = 331.3 * sqrt(1 + T / 273.15)
 *
 * @param {number} temperatureCelsius - Temperatura en grados Celsius [°C]
 * @returns {number} Velocidad de propagación del sonido [m/s]
 */
export function calculateSpeedOfSound(temperatureCelsius = DEFAULT_TEMPERATURE) {
  return 331.3 * Math.sqrt(1 + temperatureCelsius / 273.15);
}
