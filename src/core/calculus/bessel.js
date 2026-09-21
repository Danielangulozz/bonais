/**
 * @file bessel.js
 * @description Función de Bessel de primera especie y orden cero J0(x) calculada mediante
 * la integral integral de Poisson con regla del punto medio (400 puntos).
 */

const BESSEL_POINTS = 400;

/**
 * Calcula J0(x) = (1/π) ∫_0^π cos(x * sin(t)) dt usando la regla del punto medio.
 *
 * @param {number} x - Argumento real
 * @param {number} [n=BESSEL_POINTS] - Número de intervalos del punto medio
 * @returns {number} Valor de J0(x)
 */
export function besselJ0(x, n = BESSEL_POINTS) {
  const h = Math.PI / n;
  let sum = 0;

  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) * h;
    sum += Math.cos(x * Math.sin(t));
  }

  // sum * (h / π) = sum * ((π / n) / π) = sum / n
  return sum / n;
}
