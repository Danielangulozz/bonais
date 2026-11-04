import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useArrayState, useArrayDispatch } from '../state/arrayState.js';
import { calculateSpeedOfSound } from '../core/constants.js';
import { createTwoSubSources, precomputeSourceCoefficients } from '../core/field.js';
import { evaluateAllMetrics, calculateAR, calculateQPE, DEFAULT_AUDIENCE_REGION, DEFAULT_STAGE_REGION } from '../core/metrics.js';
import WaveHero, { morphSources } from './landing/WaveHero.jsx';
import FieldThumb from './landing/FieldThumb.jsx';
import KaTeXMath from './KaTeXMath.jsx';
import { ArrowRight, Sun, Moon } from 'lucide-react';

const INTRO_HOLD_MS = 1800;
const MODE_HOLD_MS = 5000;
const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const fmt = (v, dp = 1) => {
  if (!Number.isFinite(v)) return '—';
  const s = v.toFixed(dp);
  return (Number(s) === 0 ? (0).toFixed(dp) : s).replace('.', ',');
};

/** Diseño de referencia de la portada: 80 Hz, d = λ/4, τ = d/c, 20 °C. */
function useReferenceDesign() {
  return useMemo(() => {
    const f = 80;
    const c = calculateSpeedOfSound(20);
    const k = (2 * Math.PI * f) / c;
    const omega = 2 * Math.PI * f;
    const d = c / f / 4;
    const tau = d / c;
    const metrics = evaluateAllMetrics({
      frequency: f, speedOfSound: c, separation: d, delayRear: tau,
      polarityRear: -1, polarityFront: 1, rDistance: 10, n: 48,
    });
    const cardioid = precomputeSourceCoefficients(
      createTwoSubSources({ separation: d, delayRear: tau, polarityRear: -1, polarityFront: 1 }), omega,
    );
    const inPhase = precomputeSourceCoefficients(
      createTwoSubSources({ separation: d, delayRear: 0, polarityRear: 1, polarityFront: 1 }), omega,
    );
    return { f, c, k, d, tau, metrics, cardioid, inPhase };
  }, []);
}

const EQUATIONS = [
  {
    math: 'P_{\\text{total}}(x,y) = \\sum_{n=1}^{2} \\frac{A_n}{r_n}\\, e^{-j(k r_n + \\omega\\tau_n + \\theta_n)}',
    title: 'El campo es una función de dos variables',
    text: 'Cada subwoofer es una fuente puntual. Sumando sus ondas se obtiene la presión en cada punto del recinto; su energía E = |P|² se lee con curvas de nivel, gradiente y Hessiano.',
    ref: 'Secciones 4.2 a 4.5',
  },
  {
    math: 'A(d,\\tau) = 20\\log_{10}\\frac{|P_\\infty(0)|}{|P_\\infty(\\pi)|}, \\qquad d^* = \\tfrac{\\lambda}{4},\\ \\ \\tau^* = \\tfrac{d^*}{c}',
    title: 'El diseño es otra función de dos variables',
    text: 'Cambiando las variables de posición por las de diseño, la atenuación trasera depende de la separación y del retardo. Lagrange entrega el óptimo.',
    ref: 'Sección 4.5.1',
  },
  {
    math: 'Q_{PE} = 10\\log_{10}\\frac{\\iint_{R_\\text{púb}} E\\,dA}{\\iint_{R_\\text{esc}} E\\,dA}',
    title: 'La energía se mide sobre áreas, no en puntos',
    text: 'Integrales dobles sobre la zona del público y la del escenario dicen cuánta energía recibe cada una. BONAIS las aproxima con la regla del punto medio.',
    ref: 'Sección 4.6',
  },
];

const SPECIFIC_OBJECTIVES = [
  { verb: 'Relacionar', rest: 'la energía total de una región con interferencia y la suma de las energías de cada fuente por separado.' },
  { verb: 'Cuantificar', rest: 'la atenuación trasera del arreglo cardioide y el cociente de energía entre público y escenario, frente a dos subwoofers en fase.' },
  { verb: 'Comparar', rest: 'la variación de atenuación trasera ante errores mínimos de retardo y de separación propios del montaje.' },
];

const TEAM = [
  { name: 'Cielo Ochoa', role: 'Identidad visual y organización del proyecto. Autora del logo.' },
  { name: 'Daniel Angulo', role: 'Desarrollo de BONAIS: motor de simulación y visualización.' },
  { name: 'Jerónimo Gómez', role: 'Análisis matemático y validación de los resultados.' },
];

export default function LandingPage() {
  const state = useArrayState();
  const dispatch = useArrayDispatch();
  const ref = useReferenceDesign();
  const isDark = state.theme === 'dark';

  const goToSimulator = () => {
    window.scrollTo({ top: 0 });
    dispatch({ type: 'SET_ACTIVE_PAGE', payload: 'simulator' });
  };
  const toggleTheme = () => dispatch({ type: 'SET_THEME', payload: isDark ? 'light' : 'dark' });
  const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const cur = ref.metrics.current;
  const ph = ref.metrics.inPhase;

  // El campo alterna solo entre las dos configuraciones; con movimiento reducido se queda en el cardioide
  const [cardioid, setCardioid] = useState(prefersReducedMotion);
  const arValueRef = useRef(null);
  const tauValueRef = useRef(null);
  const qpeValueRef = useRef(null);

  useEffect(() => {
    if (prefersReducedMotion()) return undefined;
    let timer;
    const flip = () => {
      setCardioid((value) => !value);
      timer = setTimeout(flip, MODE_HOLD_MS);
    };
    timer = setTimeout(flip, INTRO_HOLD_MS);
    return () => clearTimeout(timer);
  }, []);

  // Se escribe directo en el DOM: cambia en cada cuadro durante la transición, sin re-renderizar la página
  const handleMix = useCallback((mix) => {
    const sources = morphSources(ref.d, mix);
    const { arDB } = calculateAR(sources, ref.k, 10);
    const { qpeDB } = calculateQPE({ precomputedSources: sources, k: ref.k, n: 48 });
    if (arValueRef.current) arValueRef.current.textContent = `${fmt(arDB)} dB`;
    if (tauValueRef.current) tauValueRef.current.textContent = `${fmt(ref.tau * 1000 * mix, 2)} ms`;
    if (qpeValueRef.current) qpeValueRef.current.textContent = `${fmt(qpeDB)} dB`;
  }, [ref]);

  const specs = [
    { value: `${fmt(cur.arDB)} dB`, valueRef: arValueRef, label: 'menos energía detrás del arreglo, a 10 m' },
    { value: `${fmt(ref.d, 2)} m`, label: 'separación óptima d = λ/4 a 80 Hz' },
    { value: `${fmt(ref.tau * 1000, 2)} ms`, valueRef: tauValueRef, label: 'retardo de la caja trasera' },
    { value: `${fmt(cur.qpeDB)} dB`, valueRef: qpeValueRef, label: 'más energía en el público que en el escenario' },
  ];

  return (
    <div className="landing min-h-screen w-full bg-bg text-text overflow-x-hidden">
      {/* ═══ Navegación (cristal) ═══ */}
      <header className="fixed top-3 inset-x-0 z-50 flex justify-center px-3">
        <nav className="landing-glass w-full max-w-5xl rounded-full pl-3 pr-1.5 py-1.5 flex items-center gap-3">
          <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="flex items-center gap-2 pr-2">
            <img src={isDark ? '/logo-dark.png' : '/favicon.png'} alt="BONAIS" className="h-7 w-7 rounded-full object-contain" />
            <span className="text-[15px] font-semibold tracking-tight text-text">BONAIS</span>
          </button>
          <div className="hidden md:flex items-center gap-1 ml-2">
            {[
              ['problema', 'Problema'],
              ['modelo', 'Modelo'],
              ['objetivos', 'Objetivos'],
              ['equipo', 'Equipo'],
            ].map(([id, label]) => (
              <button key={id} type="button" onClick={() => scrollTo(id)}
                className="px-3 py-1.5 rounded-full text-[13px] text-muted hover:text-text hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
                {label}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-1">
            <button type="button" onClick={toggleTheme} title="Cambiar tema"
              className="h-8 w-8 grid place-items-center rounded-full text-muted hover:text-text hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button type="button" onClick={goToSimulator}
              className={`rounded-full px-4 py-1.5 text-[13px] font-semibold transition-colors ${
                isDark
                  ? 'bg-white text-[#0B0712] hover:bg-white/90'
                  : 'bg-[#0B0712] text-white hover:bg-[#0B0712]/85'
              }`}>
              Abrir simulador
            </button>
          </div>
        </nav>
      </header>

      {/* ═══ Hero: el campo real del cardioide, animado ═══ */}
      <section className={`relative flex flex-col min-h-[100svh] lg:h-[100svh] lg:min-h-[620px] w-full overflow-hidden transition-colors duration-300 ${
        isDark ? 'bg-black text-white' : 'bg-white text-[#0B0712]'
      }`}>
        {/* Zona sensible: solo sobre el gráfico, para que pasar por el texto no lo active */}
        <div className="hero-hit absolute inset-0 lg:left-[52%] z-[5]" aria-hidden="true" />
        <WaveHero
          theme={state.theme}
          c={ref.c}
          frequency={ref.f}
          cardioid={cardioid}
          onMix={handleMix}
          className="hero-field absolute inset-0 h-full w-full"
        />
        {/* Velos: el texto vive en la zona silenciosa y la ficha sobre un fondo limpio */}
        <div className={`absolute inset-x-0 top-[280px] bottom-0 lg:top-auto lg:h-1/3 pointer-events-none bg-gradient-to-t ${
          isDark ? 'from-black via-black/90 lg:via-black/40 to-transparent' : 'from-white via-white/90 lg:via-white/40 to-transparent'
        }`} />
        <div className={`absolute inset-y-0 left-0 w-3/5 hidden lg:block pointer-events-none bg-gradient-to-r ${
          isDark ? 'from-black/85 via-black/50 to-transparent' : 'from-white/90 via-white/60 to-transparent'
        }`} />

        <div className="relative z-10 w-full lg:h-full max-w-6xl mx-auto px-5 sm:px-8 flex flex-col lg:justify-center pt-[335px] pb-8 lg:pb-[130px] lg:pt-16 pointer-events-none">
          <p className="text-[13px] text-muted mb-4">Proyecto de aula · Cálculo III · Ingeniería de Sonido</p>
          <h1 className="landing-display">
            El grave,<br />hacia el público.
          </h1>
          <p className="mt-5 max-w-md xl:max-w-lg text-[16px] sm:text-[17px] leading-relaxed text-muted">
            BONAIS modela dos subwoofers como una función de varias variables y encuentra la separación y el retardo
            que llevan la energía al público y la quitan del escenario.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3 pointer-events-auto">
            <button type="button" onClick={goToSimulator}
              className="group inline-flex items-center gap-2 rounded-full bg-[#7C3AED] hover:bg-[#8B5CF6] px-6 py-3 text-[15px] font-semibold text-white shadow-[0_8px_40px_-8px_rgba(124,58,237,0.8)] transition-colors">
              Abrir simulador
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </button>
            <button type="button" onClick={() => scrollTo('modelo')}
              className="landing-glass rounded-full px-6 py-3 text-[15px] font-medium text-text hover:bg-black/5 dark:hover:bg-white/15 transition-colors">
              Ver el modelo
            </button>
          </div>
        </div>

        {/* Ficha técnica (cristal) */}
        <div className="relative lg:absolute lg:bottom-5 lg:inset-x-0 mt-auto z-10 px-3 sm:px-8 pb-5 lg:pb-0">
          <dl className="landing-glass mx-auto max-w-6xl rounded-3xl grid grid-cols-2 lg:grid-cols-4 divide-border lg:divide-x">
            {specs.map((s) => (
              <div key={s.label} className="px-5 py-4">
                <dt className="sr-only">{s.label}</dt>
                <dd ref={s.valueRef} className="text-[22px] sm:text-[26px] font-light tracking-tight tabular-nums text-text">{s.value}</dd>
                <dd className="text-[11.5px] leading-snug text-muted mt-0.5">{s.label}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ═══ Problema ═══ */}
      <section id="problema" className="scroll-mt-20 max-w-6xl mx-auto px-5 sm:px-8 py-24 sm:py-32">
        <div className="max-w-3xl">
          <h2 className="landing-h2">Un subwoofer suena igual hacia todos lados.</h2>
          <p className="mt-5 text-[16px] sm:text-[17px] leading-relaxed text-muted">
            Entre 40 y 100 Hz la onda mide de 3,4 a 8,6 metros, mucho más que la caja. Por eso el grave llega al
            escenario con la misma fuerza que al público. Invertir la polaridad de una caja y retrasarla un tiempo
            exacto cambia eso: las ondas se cancelan atrás y se suman adelante.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 md:grid-cols-2 gap-6">
          {[
            { title: 'Dos subwoofers en fase', src: ref.inPhase, q: ph.qpeDB, note: 'El escenario recibe tanta energía como el público.' },
            { title: 'Arreglo cardioide', src: ref.cardioid, q: cur.qpeDB, note: 'Caja trasera invertida y retrasada τ = d/c.' },
          ].map((item) => (
            <figure key={item.title} className="flex flex-col gap-4">
              <FieldThumb
                precomputedSources={item.src}
                k={ref.k}
                audienceRegion={DEFAULT_AUDIENCE_REGION}
                stageRegion={DEFAULT_STAGE_REGION}
                label={`Mapa de nivel sonoro: ${item.title}`}
              />
              <figcaption className="flex items-end justify-between gap-4">
                <span>
                  <span className="block text-[17px] font-medium text-text">{item.title}</span>
                  <span className="block text-[13px] text-muted mt-0.5">{item.note}</span>
                </span>
                <span className="text-right flex-shrink-0">
                  <span className="block text-[26px] font-light tabular-nums tracking-tight text-text">{fmt(item.q)} dB</span>
                  <span className="block text-[11px] text-muted">público / escenario</span>
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
        <p className="mt-6 text-[12px] text-muted">
          80 Hz, d = {fmt(ref.d, 2)} m. Zonas punteadas: <span className="text-[#C084FC]">público</span> y{' '}
          <span className="text-[#FB7185]">escenario</span>, 12 × 16 m cada una.
        </p>
      </section>

      {/* ═══ Modelo ═══ */}
      <section id="modelo" className="scroll-mt-20 border-t border-border">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-24 sm:py-32">
          <h2 className="landing-h2 max-w-3xl">Tres ecuaciones, un diseño.</h2>
          <p className="mt-5 max-w-2xl text-[16px] sm:text-[17px] leading-relaxed text-muted">
            El simulador sigue el mismo orden del documento. Cada valor que ves en pantalla sale de estas expresiones,
            y el panel <span className="text-text">Modelo en vivo</span> las muestra con los números actuales.
          </p>

          <ol className="mt-14 flex flex-col">
            {EQUATIONS.map((eq, i) => (
              <li key={eq.title} className="grid grid-cols-1 lg:grid-cols-[56px_1fr_1fr] gap-4 lg:gap-8 py-10 border-t border-border first:border-t-0">
                <span className="text-[13px] text-muted tabular-nums pt-1">0{i + 1}</span>
                <div className="landing-eq overflow-x-auto custom-scrollbar text-text">
                  <KaTeXMath math={eq.math} block />
                </div>
                <div>
                  <h3 className="text-[19px] font-medium text-text leading-snug">{eq.title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-muted">{eq.text}</p>
                  <p className="mt-3 text-[12px] text-purple-dark dark:text-purple-light">{eq.ref}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ═══ Objetivos ═══ */}
      <section id="objetivos" className="scroll-mt-20 border-t border-border">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-24 sm:py-32 grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20">
          <div>
            <p className="text-[13px] text-muted mb-4">Objetivo general</p>
            <p className="text-[26px] sm:text-[32px] font-light leading-[1.2] tracking-tight text-text">
              Determinar la separación y el retardo óptimos entre dos subwoofers idénticos que dirigen los graves hacia
              el público y los reducen hacia el escenario, entre 40 y 100 Hz.
            </p>
          </div>
          <div>
            <p className="text-[13px] text-muted mb-4">Objetivos específicos</p>
            <ul className="flex flex-col">
              {SPECIFIC_OBJECTIVES.map((o) => (
                <li key={o.verb} className="py-5 border-t border-border first:border-t-0 first:pt-0 text-[16px] leading-relaxed text-muted">
                  <span className="text-text font-medium">{o.verb}</span> {o.rest}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ═══ Equipo ═══ */}
      <section id="equipo" className="scroll-mt-20 border-t border-border">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-24 sm:py-28">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
            <h2 className="landing-h2">Equipo</h2>
            <p className="text-[14px] text-muted max-w-sm">
              Estudiantes de Ingeniería de Sonido · Universidad de San Buenaventura Medellín · Semestre 2026-2.
            </p>
          </div>
          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-4">
            {TEAM.map((m) => (
              <div key={m.name} className="rounded-3xl border border-border bg-surface-2 p-6">
                <p className="text-[19px] font-medium text-text">{m.name}</p>
                <p className="mt-2 text-[14px] leading-relaxed text-muted">{m.role}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ Cierre ═══ */}
      <section className="relative overflow-hidden border-t border-border">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-24 sm:py-32 flex flex-col items-start gap-8">
          <h2 className="landing-h2 max-w-2xl">Mueve la separación. Mira cómo cambian las integrales.</h2>
          <button type="button" onClick={goToSimulator}
            className="group inline-flex items-center gap-2 rounded-full bg-[#7C3AED] hover:bg-[#8B5CF6] px-6 py-3 text-[15px] font-semibold text-white transition-colors">
            Abrir simulador
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-8 flex flex-col sm:flex-row gap-3 justify-between text-[12px] text-muted">
          <span>BONAIS · Optimización de arreglos de subwoofers con funciones de varias variables</span>
          <span>Logo: Cielo Ochoa</span>
        </div>
      </footer>
    </div>
  );
}
