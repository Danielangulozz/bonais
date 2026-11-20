/**
 * @file physics.js
 * @description Parámetros ondulatorios acústicos fundamentales y conversiones lineales/logarítmicas.
 */

/**
 * Frecuencia angular: ω = 2πf
 * @param {number} frequency - Frecuencia acústica [Hz]
 * @returns {number} Frecuencia angular [rad/s]
 */
export function calculateOmega(frequency) {
  return 2 * Math.PI * frequency;
}

/**
 * Número de onda espacial: k = ω / c = 2πf / c = 2π / λ
 * @param {number} frequency - Frecuencia acústica [Hz]
 * @param {number} speedOfSound - Velocidad de fase acústica [m/s]
 * @returns {number} Número de onda [rad/m]
 */
export function calculateWavenumber(frequency, speedOfSound) {
  return (2 * Math.PI * frequency) / speedOfSound;
}

/**
 * Longitud de onda acústica: λ = c / f
 * @param {number} frequency - Frecuencia acústica [Hz]
 * @param {number} speedOfSound - Velocidad de propagación [m/s]
 * @returns {number} Longitud de onda [m]
 */
export function calculateWavelength(frequency, speedOfSound) {
  return speedOfSound / frequency;
}

/**
 * Convierte ganancia en decibelios a factor lineal de amplitud: g = 10^(dB / 20).
 * @param {number} dB - Nivel relativo en dB
 * @returns {number} Factor de ganancia lineal [≥ 0]
 */
export function dBToLinear(dB) {
  return Math.pow(10, dB / 20);
}
