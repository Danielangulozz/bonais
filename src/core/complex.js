/**
 * @file complex.js
 * @description Aritmética compleja mínima y de alto rendimiento para presiones acústicas e interferencia.
 */

/**
 * @typedef {Object} Complex
 * @property {number} re - Parte real
 * @property {number} im - Parte imaginaria
 */

/**
 * Crea un número complejo.
 * @param {number} re - Parte real
 * @param {number} im - Parte imaginaria
 * @returns {Complex}
 */
export function complex(re = 0, im = 0) {
  return { re, im };
}

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
 * Resta dos números complejos (a - b).
 * @param {Complex} a
 * @param {Complex} b
 * @returns {Complex}
 */
export function sub(a, b) {
  return { re: a.re - b.re, im: a.im - b.im };
}

/**
 * Multiplica un número complejo por un escalar real.
 * @param {Complex} a
 * @param {number} s
 * @returns {Complex}
 */
export function scale(a, s) {
  return { re: a.re * s, im: a.im * s };
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
 * Divide dos números complejos (a / b).
 * @param {Complex} a
 * @param {Complex} b
 * @returns {Complex}
 */
export function div(a, b) {
  const denom = b.re * b.re + b.im * b.im;
  if (denom === 0) {
    return { re: 0, im: 0 };
  }
  return {
    re: (a.re * b.re + a.im * b.im) / denom,
    im: (a.im * b.re - a.re * b.im) / denom,
  };
}

/**
 * Retorna el conjugado complejo: re - j*im.
 * @param {Complex} a
 * @returns {Complex}
 */
export function conj(a) {
  return { re: a.re, im: -a.im };
}

/**
 * Cuadrado del módulo |a|² = re² + im² (energía).
 * @param {Complex} a
 * @returns {number}
 */
export function absSq(a) {
  return a.re * a.re + a.im * a.im;
}

/**
 * Módulo |a| = sqrt(re² + im²).
 * @param {Complex} a
 * @returns {number}
 */
export function abs(a) {
  return Math.hypot(a.re, a.im);
}

/**
 * Argumento o fase angular de un número complejo en radianes [-π, π].
 * @param {Complex} a
 * @returns {number} [rad]
 */
export function arg(a) {
  return Math.atan2(a.im, a.re);
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

/**
 * Crea un complejo a partir de forma polar r * e^(j*theta).
 * @param {number} r - Magnitud [≥ 0]
 * @param {number} theta - Ángulo en radianes [rad]
 * @returns {Complex}
 */
export function fromPolar(r, theta) {
  return {
    re: r * Math.cos(theta),
    im: r * Math.sin(theta),
  };
}
