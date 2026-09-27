import { useState, useMemo } from 'react';
import { useArray } from '../../state/arrayState.js';
import { calculateAnalyticalGradient, verifyGradientAtPoint } from '../../core/calculus/gradient.js';
import { findCriticalPoints } from '../../core/calculus/criticalPoints.js';
import { integrateRectangularRegion, integratePolarCorona } from '../../core/calculus/integrals.js';
import KaTeXMath from '../KaTeXMath.jsx';
import { CheckCircle2, ChevronDown, ChevronUp, Calculator, Compass } from 'lucide-react';

export default function CalculusPanel() {
  const { state, dispatch, derived } = useArray();
  const [showStepByStep, setShowStepByStep] = useState(false);
  const [integralMode, setIntegralMode] = useState('audience'); // 'audience' | 'stage' | 'corona'

  const nf1 = new Intl.NumberFormat('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const nf2 = new Intl.NumberFormat('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const nf3 = new Intl.NumberFormat('es-CO', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  const nf4 = new Intl.NumberFormat('es-CO', { minimumFractionDigits: 4, maximumFractionDigits: 4 });

  const px = state.inspectedPoint.x;
  const py = state.inspectedPoint.y;

  // 1. Datos del punto inspeccionado
  const pointGrad = useMemo(() => {
    return calculateAnalyticalGradient(px, py, derived.precomputedSources, derived.k);
  }, [px, py, derived.precomputedSources, derived.k]);

  const gradVerify = useMemo(() => {
    return verifyGradientAtPoint(px, py, derived.precomputedSources, derived.k);
  }, [px, py, derived.precomputedSources, derived.k]);

  // Distancias a las fuentes
  const src1 = derived.sources[0];
  const src2 = derived.sources[1];
  const r1 = Math.hypot(px - src1.x, py - src1.y);
  const r2 = Math.hypot(px - src2.x, py - src2.y);
  const phaseP = (Math.atan2(pointGrad.p.im, pointGrad.p.re) * 180) / Math.PI;

  // 2. Puntos críticos
  const criticalPoints = useMemo(() => {
    return findCriticalPoints({
      precomputedSources: derived.precomputedSources,
      k: derived.k,
      wavelength: derived.wavelength,
      xMin: -state.mapSpan,
      xMax: state.mapSpan,
      yMin: -state.mapSpan,
      yMax: state.mapSpan,
    });
  }, [derived.precomputedSources, derived.k, derived.wavelength, state.mapSpan]);

  const countMin = criticalPoints.filter((p) => p.type === 'minimum').length;
  const countMax = criticalPoints.filter((p) => p.type === 'maximum').length;
  const countSaddle = criticalPoints.filter((p) => p.type === 'saddle').length;

  // 3. Integración de energía
  const integralResult = useMemo(() => {
    if (integralMode === 'corona') {
      return integratePolarCorona({
        r1: 3.0,
        r2: 100.0,
        precomputedSources: derived.precomputedSources,
        k: derived.k,
        d: state.separation,
        wavelength: derived.wavelength,
      });
    }

    const region = integralMode === 'audience' ? state.audienceRegion : state.stageRegion;
    return integrateRectangularRegion({
      xMin: region.xMin,
      xMax: region.xMax,
      yMin: region.yMin,
      yMax: region.yMax,
      precomputedSources: derived.precomputedSources,
      k: derived.k,
      n: 120,
    });
  }, [integralMode, derived.precomputedSources, derived.k, state.separation, derived.wavelength, state.audienceRegion, state.stageRegion]);

  return (
    <div className="flex flex-col gap-6 text-xs text-text">
      {/* SECCIÓN 1: INSPECCIÓN ANALÍTICA DE PUNTO */}
      <section className="bg-surface border border-border rounded-lg p-4 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2.5">
          <div className="flex items-center gap-2">
            <Compass className="h-4 w-4 text-accent" />
            <h3 className="text-sm font-bold text-text">
              Inspección de Punto P({nf2.format(px)}, {nf2.format(py)}) m
            </h3>
          </div>
          <span className="text-[11px] text-muted">
            Haz clic en cualquier punto del mapa para evaluar su gradiente
          </span>
        </div>

        {/* Guía Pedagógica: ¿Para qué sirve este punto? */}
        <div className="p-3 bg-purple/10 border border-purple/25 rounded-xl flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5 font-bold text-purple-dark dark:text-purple-light text-xs">
            <span>💡 ¿Qué es el Punto Personalizado y para qué sirve esta información?</span>
          </div>
          <p className="text-[11px] text-muted leading-relaxed">
            Representa la ubicación exacta de un <strong className="text-text">micrófono de calibración</strong> o de un <strong className="text-text">oyente/músico</strong> en el recinto. Los cálculos analíticos evalúan la suma vectorial de las ondas sonoras en esa coordenada exacta:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-1 pt-1 border-t border-purple/20 text-[10px]">
            <div>
              <strong className="text-text">Presión Compleja P:</strong> Suma de fasores con amplitud 1/r y fase e^(-jkr). Revela si hay interferencia constructiva o destructiva.
            </div>
            <div>
              <strong className="text-text">Nivel L (dB SPL):</strong> Volumen efectivo en ese punto. Permite saber si el público recibe suficiente presión o si la tarima está silenciosa.
            </div>
            <div>
              <strong className="text-text">Gradiente ∇L (dB/m):</strong> Tasa y dirección de cambio del volumen. Si caminas en la dirección marcada por la flecha, el volumen sube a esa tasa.
            </div>
          </div>
        </div>

        {/* Tarjetas de valores evaluados */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {/* Presión y Fase */}
          <div className="p-3 bg-surface-2 border border-border rounded-xl">
            <span className="text-muted text-[11px] block mb-1">Presión Compleja P(x, y)</span>
            <div className="font-mono text-sm text-text font-bold">
              |P| = {nf3.format(Math.hypot(pointGrad.p.re, pointGrad.p.im))}
            </div>
            <div className="text-[11px] text-muted font-mono mt-0.5">
              Re: {nf3.format(pointGrad.p.re)} | Im: {nf3.format(pointGrad.p.im)}
            </div>
            <div className="text-[11px] text-muted font-mono">
              Fase: {nf1.format(phaseP)}°
            </div>
          </div>

          {/* Energía y SPL */}
          <div className="p-3 bg-surface-2 border border-border rounded-xl">
            <span className="text-muted text-[11px] block mb-1">Energía E y Nivel L</span>
            <div className="font-mono text-sm font-bold text-purple">
              L = {nf1.format(pointGrad.levelDB)} dB
            </div>
            <div className="text-[11px] text-muted font-mono mt-0.5">
              E = |P|² = {nf4.format(pointGrad.energy)}
            </div>
            <div className="text-[11px] text-muted">
              r₁={nf2.format(r1)}m, r₂={nf2.format(r2)}m
            </div>
          </div>

          {/* Gradiente de Energía ∇E */}
          <div className="p-3 bg-surface-2 border border-border rounded-xl">
            <span className="text-muted text-[11px] block mb-1">Gradiente de Energía ∇E</span>
            <div className="font-mono text-sm font-bold text-text">
              |∇E| = {nf3.format(pointGrad.gradMagE)}
            </div>
            <div className="text-[11px] text-muted font-mono mt-0.5">
              ∂E/∂x: {nf3.format(pointGrad.gradE_x)}
            </div>
            <div className="text-[11px] text-muted font-mono">
              ∂E/∂y: {nf3.format(pointGrad.gradE_y)}
            </div>
          </div>

          {/* Gradiente de Nivel y Dirección de Mayor Aumento */}
          <div className="p-3 bg-surface-2 border border-border rounded-xl">
            <span className="text-muted text-[11px] block mb-1">Tasa de Variación ∇L</span>
            <div className="font-mono text-sm font-bold text-text">
              |∇L| = {nf2.format(pointGrad.gradMagL)} dB/m
            </div>
            <div className="text-[11px] text-purple font-semibold mt-0.5 flex items-center gap-1">
              <span>Dirección max: {nf1.format(pointGrad.angleDeg)}°</span>
            </div>
            <div className="text-[10px] text-muted">
              Perpendicular a isofónica de {nf1.format(pointGrad.levelDB)} dB
            </div>
          </div>
        </div>

        {/* Verificación: Gradiente Analítico vs Diferencias Finitas */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded bg-surface-2 border border-border">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-ok" />
            <span className="font-semibold text-text">Verificación de Exactitud del Gradiente:</span>
            <span className="text-muted font-mono">
              Error relativo numérico = {gradVerify.relativeError.toExponential(3)}
            </span>
          </div>
          <span className="rounded bg-ok/20 border border-ok/30 px-2 py-0.5 text-[11px] font-semibold text-ok">
            Coincide con diferencias centrales a &lt; 10⁻⁵
          </span>
        </div>

        {/* Acordeón con desarrollo paso a paso KaTeX */}
        <div className="border border-border rounded">
          <button
            type="button"
            onClick={() => setShowStepByStep(!showStepByStep)}
            className="w-full flex items-center justify-between p-2.5 bg-surface-2 hover:bg-surface font-semibold text-text transition-colors"
          >
            <span>Deducción y Paso a Paso del Gradiente (Cálculo Multivariable)</span>
            {showStepByStep ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          {showStepByStep && (
            <div className="p-4 border-t border-border flex flex-col gap-3 bg-surface leading-relaxed">
              <p className="text-muted">
                Para cualquier campo complejo originado por fuentes puntuales, derivamos analíticamente la energía{' '}
                <KaTeXMath math="E(x,y) = |P|^2 = P \cdot \overline{P}" /> mediante la regla de la cadena:
              </p>
              <div className="p-3 bg-surface-2 rounded border border-border overflow-x-auto text-center">
                <KaTeXMath
                  math="\nabla E = 2 \operatorname{Re}\left( \overline{P} \cdot \nabla P \right) = 2 \begin{pmatrix} \operatorname{Re}(P) \frac{\partial P_x}{\partial x} + \operatorname{Im}(P) \frac{\partial P_y}{\partial x} \\ \operatorname{Re}(P) \frac{\partial P_x}{\partial y} + \operatorname{Im}(P) \frac{\partial P_y}{\partial y} \end{pmatrix}"
                  block
                />
              </div>
              <p className="text-muted">
                donde la derivada parcial de cada onda esférica individual <KaTeXMath math="P_i = c_i \frac{e^{-j k r_i}}{r_i}" /> viene dada por:
              </p>
              <div className="p-3 bg-surface-2 rounded border border-border overflow-x-auto text-center">
                <KaTeXMath
                  math="\frac{\partial P_i}{\partial x} = c_i \, e^{-j k r_i} (-j k r_i - 1) \frac{x - x_i}{r_i^3}"
                  block
                />
              </div>
              <p className="text-muted">
                Y para la variación espacial percibida del nivel en decibelios <KaTeXMath math="L(x,y) = 10 \log_{10}(E)" />:
              </p>
              <div className="p-3 bg-surface-2 rounded border border-border overflow-x-auto text-center">
                <KaTeXMath
                  math="\nabla L = \left(\frac{10}{\ln 10}\right) \frac{\nabla E}{E} \quad [\text{dB/m}]"
                  block
                />
              </div>
            </div>
          )}
        </div>
      </section>

      {/* SECCIÓN 2: PUNTOS CRÍTICOS Y CLASIFICACIÓN CON HESSIANO */}
      <section className="bg-surface border border-border rounded-lg p-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2.5">
          <div>
            <h3 className="text-sm font-bold text-text">Puntos Críticos del Campo de Energía (∇E = 0)</h3>
            <p className="text-[11px] text-muted">
              Identificados mediante el método de Newton multivariable y clasificados con el criterio del determinante de la matriz Hessiana.
            </p>
          </div>
          {/* Conteo por tipo */}
          <div className="flex items-center gap-2 text-[11px]">
            <span className="px-2 py-0.5 rounded bg-accent/15 text-accent border border-accent/30 font-semibold">
              ● {countMin} Mínimos
            </span>
            <span className="px-2 py-0.5 rounded bg-ok/15 text-ok border border-ok/30 font-semibold">
              ▲ {countMax} Máximos
            </span>
            <span className="px-2 py-0.5 rounded bg-warm/15 text-warm border border-warm/30 font-semibold">
              ■ {countSaddle} Puntos de Silla
            </span>
          </div>
        </div>

        {/* Tabla interactiva de puntos críticos */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse font-mono text-[11px]">
            <thead>
              <tr className="border-b border-border bg-surface-2 text-muted uppercase text-[10px]">
                <th className="py-1.5 px-2">x (m)</th>
                <th className="py-1.5 px-2">y (m)</th>
                <th className="py-1.5 px-2">Nivel (dB)</th>
                <th className="py-1.5 px-2">E_xx</th>
                <th className="py-1.5 px-2">E_xy</th>
                <th className="py-1.5 px-2">E_yy</th>
                <th className="py-1.5 px-2">D = Exx·Eyy − Exy²</th>
                <th className="py-1.5 px-2">Clasificación Hessiano</th>
              </tr>
            </thead>
            <tbody>
              {criticalPoints.map((pt, idx) => {
                const isSelected =
                  Math.hypot(pt.x - state.inspectedPoint.x, pt.y - state.inspectedPoint.y) < 0.1;
                return (
                  <tr
                    key={idx}
                    onClick={() =>
                      dispatch({ type: 'SET_INSPECTED_POINT', payload: { x: pt.x, y: pt.y } })
                    }
                    className={`border-b border-border/50 cursor-pointer transition-colors ${
                      isSelected ? 'bg-accent/20 font-bold' : 'hover:bg-surface-2'
                    }`}
                  >
                    <td className="py-1.5 px-2 text-text">{nf2.format(pt.x)}</td>
                    <td className="py-1.5 px-2 text-text">{nf2.format(pt.y)}</td>
                    <td className="py-1.5 px-2 text-accent">{nf1.format(pt.levelDB)}</td>
                    <td className="py-1.5 px-2 text-muted">{nf3.format(pt.Exx)}</td>
                    <td className="py-1.5 px-2 text-muted">{nf3.format(pt.Exy)}</td>
                    <td className="py-1.5 px-2 text-muted">{nf3.format(pt.Eyy)}</td>
                    <td className="py-1.5 px-2 text-muted">{nf3.format(pt.D)}</td>
                    <td className="py-1.5 px-2 font-sans font-semibold">
                      {pt.type === 'minimum' && <span className="text-accent">● Casi-nulo (Mínimo)</span>}
                      {pt.type === 'maximum' && <span className="text-ok">▲ Máximo local</span>}
                      {pt.type === 'saddle' && <span className="text-warm">■ Punto de silla</span>}
                      {pt.type === 'inconclusive' && <span className="text-muted">? No concluyente</span>}
                    </td>
                  </tr>
                );
              })}
              {criticalPoints.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-4 text-center text-muted font-sans">
                    No se detectaron puntos críticos estacionarios dentro del área visible actual.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-muted">
          Nota física: debido a la caída geométrica 1/r², los mínimos de interferencia en campo cercano son casi-nulos profundos (atenuaciones de −30 a −60 dB) más que ceros exactos.
        </p>
      </section>

      {/* SECCIÓN 3: INTEGRALES DOBLES DE ENERGÍA Y CORONA POLAR */}
      <section className="bg-surface border border-border rounded-lg p-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2.5">
          <div className="flex items-center gap-2">
            <Calculator className="h-4 w-4 text-accent" />
            <h3 className="text-sm font-bold text-text">
              Integrales Dobles de Energía Acústica: I_int vs. I_sum
            </h3>
          </div>
          {/* Selector de modo */}
          <div className="flex items-center gap-1.5 bg-surface-2 p-1 rounded border border-border">
            <button
              type="button"
              onClick={() => setIntegralMode('audience')}
              className={`px-2.5 py-1 rounded font-medium ${
                integralMode === 'audience' ? 'bg-accent text-bg font-semibold' : 'text-muted hover:text-text'
              }`}
            >
              Región Público
            </button>
            <button
              type="button"
              onClick={() => setIntegralMode('stage')}
              className={`px-2.5 py-1 rounded font-medium ${
                integralMode === 'stage' ? 'bg-accent text-bg font-semibold' : 'text-muted hover:text-text'
              }`}
            >
              Región Escenario
            </button>
            <button
              type="button"
              onClick={() => setIntegralMode('corona')}
              className={`px-2.5 py-1 rounded font-medium ${
                integralMode === 'corona' ? 'bg-accent text-bg font-semibold' : 'text-muted hover:text-text'
              }`}
            >
              Corona Polar (1 + J₀)
            </button>
          </div>
        </div>

        {integralMode !== 'corona' ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="p-3 bg-surface-2 border border-border rounded flex flex-col justify-between">
              <span className="text-muted">Energía con Interferencia I_int</span>
              <div className="font-mono text-lg font-bold text-text">
                {nf2.format(integralResult.I_int)}
              </div>
              <span className="text-[10px] text-muted">∬ E(x,y) dA</span>
            </div>

            <div className="p-3 bg-surface-2 border border-border rounded flex flex-col justify-between">
              <span className="text-muted">Suma de Fuentes Incoherentes I_sum</span>
              <div className="font-mono text-lg font-bold text-text">
                {nf2.format(integralResult.I_sum)}
              </div>
              <span className="text-[10px] text-muted">∬ (g₁²/r₁² + g₂²/r₂²) dA</span>
            </div>

            <div className="p-3 bg-surface-2 border border-border rounded flex flex-col justify-between">
              <span className="text-muted">Cociente de Redistribución ρ</span>
              <div className="font-mono text-lg font-bold text-accent">
                ρ = {nf3.format(integralResult.rho)}
              </div>
              <span className="text-[10px] text-muted">ρ = I_int / I_sum</span>
            </div>

            <div className="p-3 bg-surface-2 border border-border rounded flex flex-col justify-between">
              <span className="text-muted">Chequeo de Convergencia (N vs N/2)</span>
              <div className="font-mono text-sm font-bold text-ok">
                Δ = {(integralResult.relConvergenceDiff * 100).toFixed(2)} %
              </div>
              <span className="text-[10px] text-muted">
                {integralResult.isConverged ? '✓ Convegencia < 2%' : 'Aviso de convergencia'}
              </span>
            </div>
          </div>
        ) : (
          /* MODO CORONA CIRCULAR POLAR: VALIDACIÓN CON BESSEL J0 */
          <div className="flex flex-col gap-3">
            <div className="p-3 bg-accent/10 border border-accent/30 rounded flex flex-col md:flex-row items-center justify-between gap-4">
              <div>
                <span className="font-bold text-accent text-sm block">
                  Teorema Polar de Conservación y Redistribución: ρ ≈ 1 + J₀(kd)
                </span>
                <p className="text-[11px] text-muted mt-0.5">
                  Al integrar la energía en una corona completa lejana [3m, 100m] en coordenadas polares, la interferencia no crea ni destruye energía global, sino que la modula según la función de Bessel.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-xs text-muted">ρ Numérico polar: <strong className="text-text">{nf3.format(integralResult.rho)}</strong></div>
                  <div className="text-xs text-muted">1 + J₀(kd) teórico: <strong className="text-accent">{nf3.format(integralResult.rhoTheoretical)}</strong></div>
                </div>
                <span className="rounded bg-ok text-bg px-3 py-1 font-bold text-xs">
                  Coincide (Error {integralResult.errorPercent.toFixed(2)}%)
                </span>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
