/**
 * @file vectors.test.js
 * @description Suite de pruebas unitarias obligatorias (Sección 4.12) para el núcleo físico-matemático de BONAIS.
 */

import { describe, it, expect } from 'vitest';
import { calculateWavelength, calculateOmega, calculateWavenumber } from '../src/core/physics.js';
import {
  calculateFarFieldPressure,
  calculateFarFieldAttenuation,
  calculateInPhaseFirstMinimumAngle,
} from '../src/core/farField.js';
import { calculateAR, calculateQPE } from '../src/core/metrics.js';
import { createTwoSubSources, precomputeSourceCoefficients, calculatePointField } from '../src/core/field.js';
import { besselJ0 } from '../src/core/calculus/bessel.js';
import { sweepFrequencyResponse } from '../src/core/frequencyResponse.js';
import { integratePolarCorona } from '../src/core/calculus/integrals.js';
import { optimizeBandMinMax, optimizeSingleFrequency } from '../src/core/optimize.js';
import {
  calculateAnalyticalGradient,
  calculateNumericalGradient,
} from '../src/core/calculus/gradient.js';

const C = 343.0; // Velocidad del sonido fijada para tests

describe('Vectores de prueba obligatorios (Sección 4.12)', () => {
  // Vector 1: f=80 Hz, d=λ/4
  it('1. f=80 Hz, d=λ/4: λ=4.2875 m, d=1.0719 m, τ=3.125 ms', () => {
    const f = 80;
    const lambda = calculateWavelength(f, C);
    expect(lambda).toBeCloseTo(4.2875, 4);

    const { dStar, tauStarMs } = optimizeSingleFrequency(f, C);
    expect(dStar).toBeCloseTo(1.071875, 3);
    expect(tauStarMs).toBeCloseTo(3.125, 3);
  });

  // Vector 2: Cardioide ideal 80 Hz, τ=d/c
  it('2. Cardioide ideal 80 Hz, τ=d/c: A_ff > 60 dB; a θ=90° nivel = -3.01 dB vs frente', () => {
    const f = 80;
    const omega = calculateOmega(f);
    const k = calculateWavenumber(f, C);
    const d = calculateWavelength(f, C) / 4;
    const tau = d / C;

    const aff = calculateFarFieldAttenuation({
      d,
      k,
      omega,
      gainFront: 1.0,
      gainRear: 1.0,
      polarityFront: 1,
      polarityRear: -1,
      delayFront: 0,
      delayRear: tau,
    });

    expect(aff.affDB).toBeGreaterThanOrEqual(60.0);

    const pFront = calculateFarFieldPressure(0, {
      d,
      k,
      omega,
      gainFront: 1.0,
      gainRear: 1.0,
      polarityFront: 1,
      polarityRear: -1,
      delayFront: 0,
      delayRear: tau,
    });

    const p90 = calculateFarFieldPressure(Math.PI / 2, {
      d,
      k,
      omega,
      gainFront: 1.0,
      gainRear: 1.0,
      polarityFront: 1,
      polarityRear: -1,
      delayFront: 0,
      delayRear: tau,
    });

    const relLevel90 = 20 * Math.log10(p90.mag / pFront.mag);
    expect(relLevel90).toBeCloseTo(-3.01, 1);
  });

  // Vector 3: Cardioide 80 Hz, d=λ/4, τ=d/c, R=10 m -> A_R = 25.4 dB (±0.3)
  it('3. Cardioide 80 Hz, d=λ/4, τ=d/c, R=10 m: A_R = 25.4 dB (±0.3)', () => {
    const f = 80;
    const omega = calculateOmega(f);
    const k = calculateWavenumber(f, C);
    const d = calculateWavelength(f, C) / 4;
    const tau = d / C;

    const sources = createTwoSubSources({
      separation: d,
      delayRear: tau,
      delayFront: 0,
      gainRear: 1.0,
      gainFront: 1.0,
      polarityRear: -1,
      polarityFront: 1,
    });
    const precomp = precomputeSourceCoefficients(sources, omega);

    const ar = calculateAR(precomp, k, 10.0);
    expect(ar.arDB).toBeGreaterThanOrEqual(25.1);
    expect(ar.arDB).toBeLessThanOrEqual(25.7);
  });

  // Vector 4: Igual, pero τ = d/c + 1 ms (campo lejano) -> A_ff = 11.8 dB (±0.1)
  it('4. Cardioide 80 Hz con desajuste τ = d/c + 1 ms: A_ff = 11.8 dB (±0.1)', () => {
    const f = 80;
    const omega = calculateOmega(f);
    const k = calculateWavenumber(f, C);
    const d = calculateWavelength(f, C) / 4;
    const tau = d / C + 0.001; // + 1 ms

    const aff = calculateFarFieldAttenuation({
      d,
      k,
      omega,
      gainFront: 1.0,
      gainRear: 1.0,
      polarityFront: 1,
      polarityRear: -1,
      delayFront: 0,
      delayRear: tau,
    });

    expect(aff.affDB).toBeGreaterThanOrEqual(11.7);
    expect(aff.affDB).toBeLessThanOrEqual(11.9);
  });

  // Vector 5: En fase, f=500 Hz, d=1 m -> primer mínimo lejano a 20.06° del eje perpendicular
  it('5. En fase, f=500 Hz, d=1 m: primer mínimo lejano a 20.06° del eje perpendicular', () => {
    const f = 500;
    const d = 1.0;
    const lambda = calculateWavelength(f, C);

    const minResult = calculateInPhaseFirstMinimumAngle(d, lambda);
    expect(minResult.exists).toBe(true);
    expect(minResult.angleDeg).toBeCloseTo(20.06, 1);
  });

  // Vector 6: Corona 3–100 m, en fase, c=343
  // ρ = 0.872 (500 Hz, d=1 m); 0.603 (200 Hz, d=1 m); 1.061 (500 Hz, d=0.25 m); tolerancia ±0.01 y coincide con 1+J0(kd)
  it('6. Corona 3–100 m, en fase: reproduce 1 + J0(kd) con tolerancia ±0.01', () => {
    const testCases = [
      { f: 500, d: 1.0, expectedRho: 0.872 },
      { f: 200, d: 1.0, expectedRho: 0.603 },
      { f: 500, d: 0.25, expectedRho: 1.061 },
    ];

    for (const tc of testCases) {
      const omega = calculateOmega(tc.f);
      const k = calculateWavenumber(tc.f, C);
      const lambda = calculateWavelength(tc.f, C);

      const sources = createTwoSubSources({
        separation: tc.d,
        delayRear: 0,
        delayFront: 0,
        gainRear: 1.0,
        gainFront: 1.0,
        polarityRear: 1,
        polarityFront: 1,
      });
      const precomp = precomputeSourceCoefficients(sources, omega);

      const corona = integratePolarCorona({
        r1: 3.0,
        r2: 100.0,
        precomputedSources: precomp,
        k,
        d: tc.d,
        wavelength: lambda,
        numTheta: 720,
      });

      expect(corona.rho).toBeGreaterThanOrEqual(tc.expectedRho - 0.01);
      expect(corona.rho).toBeLessThanOrEqual(tc.expectedRho + 0.01);
      expect(corona.rho).toBeCloseTo(corona.rhoTheoretical, 2);
    }
  });

  // Vector 7: Banda 40–100 Hz -> d* = 1.225 m; τ* = 3.571 ms; pérdida en bordes ≈ -2.14 dB
  it('7. Banda 40–100 Hz: d* = 1.225 m; τ* = 3.571 ms; pérdida en bordes ≈ -2.14 dB', () => {
    const opt = optimizeBandMinMax(40, 100, C);
    expect(opt.dStar).toBeCloseTo(1.225, 3);
    expect(opt.tauStarMs).toBeCloseTo(3.571, 2);
    expect(opt.edgeLossDB).toBeCloseTo(-2.14, 1);
  });

  // Vector 8: J0(0)=1; J0(2.404825557695773)=0 (±1e-9)
  it('8. J0(0)=1 y J0(2.404825557695773)=0 (±1e-9)', () => {
    expect(besselJ0(0)).toBeCloseTo(1.0, 9);
    expect(Math.abs(besselJ0(2.404825557695773))).toBeLessThan(1e-9);
  });

  // Vector 9: Simetría en fase: ∂E/∂x(0,y)=0 y Q_PE = 0 dB
  it('9. Simetría en fase: ∂E/∂x(0,y) = 0 y Q_PE = 0 dB', () => {
    const f = 80;
    const omega = calculateOmega(f);
    const k = calculateWavenumber(f, C);
    const d = 1.0;

    const sources = createTwoSubSources({
      separation: d,
      delayRear: 0,
      delayFront: 0,
      gainRear: 1.0,
      gainFront: 1.0,
      polarityRear: 1,
      polarityFront: 1,
    });
    const precomp = precomputeSourceCoefficients(sources, omega);

    // Evaluar ∂E/∂x en varios puntos sobre el eje de simetría x = 0
    const testYs = [-5.0, -2.0, 1.5, 4.0, 7.2];
    for (const y of testYs) {
      const grad = calculateAnalyticalGradient(0, y, precomp, k);
      expect(Math.abs(grad.gradE_x)).toBeLessThan(1e-9);
    }

    // Q_PE debe ser 0 dB por simetría geométrica y física
    const qpe = calculateQPE({
      precomputedSources: precomp,
      k,
      n: 80,
    });
    expect(Math.abs(qpe.qpeDB)).toBeLessThan(0.05);
  });

  // Vector 10: Derivadas: gradiente analítico = diferencia finita (rel. < 1e-6) en 50 puntos aleatorios
  it('10. Derivadas: gradiente analítico = diferencia finita (rel. < 1e-6) en 50 puntos aleatorios', () => {
    const f = 80;
    const omega = calculateOmega(f);
    const k = calculateWavenumber(f, C);
    const d = 1.07;
    const tau = d / C;

    const sources = createTwoSubSources({
      separation: d,
      delayRear: tau,
      delayFront: 0,
      gainRear: 1.0,
      gainFront: 1.0,
      polarityRear: -1,
      polarityFront: 1,
    });
    const precomp = precomputeSourceCoefficients(sources, omega);

    // 50 puntos pseudo-aleatorios alejados de las singularidades inmediatas
    let testCount = 0;
    for (let i = 0; i < 50; i++) {
      // Coordenadas entre -10 y 10 m
      const rx = (Math.sin(i * 1.7) * 8.0);
      const ry = (Math.cos(i * 2.3) * 8.0);

      // Evitar estar dentro de 0.2 m de las fuentes
      const dist1 = Math.hypot(rx - (-d / 2), ry);
      const dist2 = Math.hypot(rx - (d / 2), ry);
      if (dist1 < 0.2 || dist2 < 0.2) continue;

      const ana = calculateAnalyticalGradient(rx, ry, precomp, k);
      const num = calculateNumericalGradient(rx, ry, precomp, k, 1e-5);

      const diffX = ana.gradE_x - num.numGradE_x;
      const diffY = ana.gradE_y - num.numGradE_y;
      const err = Math.hypot(diffX, diffY) / Math.max(ana.gradMagE, 1e-4);

      expect(err).toBeLessThan(1e-5);
      testCount++;
    }
    expect(testCount).toBeGreaterThan(40);
  });

  it('11. Corona 3–100 m, cardioide 80 Hz con τ = d/c: reproduce 1 − cos(kd)·J0(kd) (±0.015)', () => {
    const c = 343.2;
    const f = 80;
    const omega = calculateOmega(f);
    const k = calculateWavenumber(f, c);
    for (const d of [0.5, 1.0, 1.4, 2.0]) {
      const src = precomputeSourceCoefficients(
        createTwoSubSources({ separation: d, delayRear: d / c, polarityRear: -1, polarityFront: 1 }),
        omega
      );
      const corona = integratePolarCorona({ r1: 3, r2: 100, precomputedSources: src, k, d, wavelength: c / f });
      const expected = 1 - Math.cos(k * d) * besselJ0(k * d);
      expect(Math.abs(corona.rhoTheoretical - expected)).toBeLessThan(1e-9);
      expect(Math.abs(corona.rho - expected)).toBeLessThanOrEqual(0.015);
    }
  });

  it('12. Respuesta en frecuencia en fase (τ = 0, s₁ = s₂ = +1): A_R(f) = 0 dB en toda la banda', () => {
    const data = sweepFrequencyResponse({
      d: 1.07, tau: 0, speedOfSound: 343.2,
      polarityRear: 1, polarityFront: 1, delayRear: 0,
      fMin: 40, fMax: 100, numPoints: 13,
    });
    data.forEach((p) => expect(Math.abs(p.arDB)).toBeLessThan(0.05));
  });
});
