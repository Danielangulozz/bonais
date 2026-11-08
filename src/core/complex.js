/**
 * @file complex.js
 * @description Aritmética compleja mínima para el campo lejano (farField.js).
 */

/**
 * @typedef {Object} Complex
 * @property {number} re - Parte real
 * @property {number} im - Parte imaginaria
 */

/**
 * Suma dos números complejos.
 * @param {Complex} a
 * @param {Complex} b
 * @returns {Complex}
 */
export function add(a, b) {
  return { re: a.re + b.re, im: a.im + b.im };
}

/**
 * Multiplica dos números complejos: (a.re*b.re - a.im*b.im) + j(a.re*b.im + a.im*b.re)
 * @param {Complex} a
 * @param {Complex} b
 * @returns {Complex}
 */
export function mul(a, b) {
  return {
    re: a.re * b.re - a.im * b.im,
    im: a.re * b.im + a.im * b.re,
  };
}

/**
 * Exponencial compleja pura e^(j*theta) = cos(theta) + j*sin(theta).
 * @param {number} theta - Ángulo en radianes [rad]
 * @returns {Complex}
 */
export function expJ(theta) {
  return {
    re: Math.cos(theta),
    im: Math.sin(theta),
  };
}
