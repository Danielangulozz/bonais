import React from 'react';
import { useArrayState, useArrayDispatch, useArrayDerived } from '../state/arrayState.js';
import {
  Sliders, Activity, Calculator, Sparkles, BookOpen,
  ArrowRight, Waves, Radio, CheckCircle2, Shield, Sun, Moon,
  Cpu, Music, Layers, Compass, BarChart3, FlaskConical
} from 'lucide-react';

export default function LandingPage() {
  const state = useArrayState();
  const dispatch = useArrayDispatch();
  const derived = useArrayDerived();

  const isDark = state.theme === 'dark';

  const toggleTheme = () => {
    dispatch({
      type: 'SET_THEME',
      payload: isDark ? 'light' : 'dark',
    });
  };

  const goToSimulator = () => {
    dispatch({ type: 'SET_ACTIVE_PAGE', payload: 'simulator' });
  };

  const openExperimentLab = () => {
    dispatch({ type: 'SET_EXPERIMENT_MODAL', payload: true });
  };

  const openTheory = () => {
    dispatch({ type: 'SET_MODAL', payload: { modal: 'showTheoryModal', open: true } });
  };

  const objectives = [
    {
      num: 1,
      title: 'Condición de no-cancelación',
      desc: 'Demostrar que dos subwoofers en fase suman sin nulos laterales si la separación d < λ/2.',
      math: 'd < \\frac{\\lambda}{2} \\implies \\text{sin cancelación}',
      tag: 'Teoría y Avisos',
    },
    {
      num: 2,
      title: 'Máximos, mínimos y sillas con Hessiano',
      desc: 'Clasificar la topología del campo de energía acústica E(x, y) donde ∇E = 0 usando el determinante D.',
      math: 'D = E_{xx}E_{yy} - E_{xy}^2 \\quad (D < 0 \\implies \\text{Silla})',
      tag: 'Cálculo Analítico',
    },
    {
      num: 3,
      title: 'Redistribución de energía e integral doble',
      desc: 'Comprobar que la interferencia no destruye energía sino que la redistribuye según la función de Bessel J₀.',
      math: '\\rho = \\frac{\\iint E \\, dA}{\\iint \\Sigma E_i \\, dA} \\approx 1 + J_0(kd)',
      tag: 'Integrales Dobles',
    },
    {
      num: 4,
      title: 'Optimización frente/atrás (Lagrange)',
      desc: 'Maximizar la energía hacia el público sujeto a la anulación exacta hacia el escenario (ωτ = kd).',
      math: 'd^* = \\frac{\\lambda}{4}, \\quad \\tau^* = \\frac{d^*}{c} = \\frac{1}{4f}',
      tag: 'Optimización',
    },
    {
      num: 5,
      title: 'Cuantificación de atenuación trasera',
      desc: 'Medir la reducción en decibelios (A_R ≈ 25.4 dB a 10m) y el cociente público/escenario Q_PE.',
      math: 'A_R = 20\\log_{10}\\left(\\frac{|P(+R, 0)|}{|P(-R, 0)|}\\right)',
      tag: 'Métricas Acústicas',
    },
    {
      num: 6,
      title: 'Sensibilidad ante errores de retardo',
      desc: 'Determinar la tolerancia en milisegundos y centímetros antes de que la cancelación caiga por debajo de 10 dB.',
      math: '\\Delta \\phi = \\omega \\cdot \\Delta \\tau, \\quad \\frac{\\partial A_R}{\\partial \\tau}',
      tag: 'Sensibilidad',
    },
  ];

  const team = [
    {
      name: 'Cielo Ochoa',
      role: 'Identidad Visual & Co-Investigadora',
      highlight: 'Diseño del Logo Oficial & Modelado Conceptual',
      bio: 'Lideró la concepción visual de BONAIS, la creación del logo icónico del pingüino acústico y la estructuración estética y pedagógica del proyecto.',
    },
    {
      name: 'Daniel Angulo',
      role: 'Desarrollo de Software & Arquitectura',
      highlight: 'Motor de Simulación & Renderizado Espacial',
      bio: 'Diseñó la arquitectura de la aplicación en React/Vite, algoritmos numéricos de diferencias centrales, Marching Squares para isolíneas y optimización de 60 FPS.',
    },
    {
      name: 'Jerónimo Gómez',
      role: 'Análisis Matemático & Cálculo III',
      highlight: 'Deducciones Analíticas, Integrales & Hessiano',
      bio: 'Estructuró las formulaciones de cálculo multivariable, demostraciones analíticas del gradiente, clasificación de puntos críticos y validación de Bessel.',
    },
  ];

  return (
    <div className="min-h-screen w-full flex flex-col bg-bg text-text select-none overflow-x-hidden">
      {/* ═══ NAVBAR SUPERIOR ═══ */}
      <nav className="sticky top-0 z-40 px-4 py-2.5 glass-strong border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img
            src={isDark ? '/logo-dark.png' : '/logo-light.png'}
            alt="BONAIS"
            className="h-8 w-8 rounded-lg object-contain shadow-sm"
          />
          <div className="flex flex-col">
            <span className="text-sm font-extrabold tracking-tight text-text">BONAIS</span>
            <span className="text-[9px] text-muted font-mono leading-none">Cálculo III · Ingeniería de Sonido</span>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={openExperimentLab}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-purple-dark dark:text-purple-light bg-purple/15 hover:bg-purple/25 border border-purple/30 transition-all"
          >
            <FlaskConical className="h-3.5 w-3.5" />
            <span>Laboratorio de Fórmulas</span>
          </button>

          <button
            type="button"
            onClick={openTheory}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-muted hover:text-text hover:bg-surface-2 transition-all"
          >
            <BookOpen className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Teoría</span>
          </button>

          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 rounded-xl text-muted hover:text-text hover:bg-surface-2 transition-colors"
            title="Cambiar tema"
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          <button
            type="button"
            onClick={goToSimulator}
            className="flex items-center gap-2 px-4 py-1.5 rounded-xl text-xs font-bold text-white bg-purple hover:bg-purple-dark shadow-md shadow-purple/20 transition-all"
          >
            <span>Ir al Simulador</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </nav>

      {/* ═══ HERO SECTION ═══ */}
      <section className="relative px-4 py-12 md:py-20 flex flex-col items-center text-center max-w-5xl mx-auto">
        {/* Glow ambient background */}
        <div className="absolute top-1/3 -translate-y-1/2 w-96 h-96 bg-purple/15 rounded-full blur-3xl pointer-events-none -z-10" />

        {/* LOGO EN GRANDE CON CRÉDITOS */}
        <div className="relative mb-6 group">
          <div className="relative p-2 rounded-3xl bg-surface-2/80 border border-border shadow-2xl backdrop-blur-md">
            <img
              src="/logo-original.png"
              alt="Logo oficial BONAIS"
              className="h-28 w-28 sm:h-36 sm:w-36 rounded-2xl object-contain drop-shadow-lg transition-transform duration-300 group-hover:scale-105"
            />
          </div>
          <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap bg-purple/20 border border-purple/35 text-purple-dark dark:text-purple-light text-[10px] font-semibold px-3 py-0.5 rounded-full shadow-sm backdrop-blur-md">
            🎨 Logo Oficial: Cielo Ochoa
          </span>
        </div>

        {/* BADGES HEADER */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-4 mt-2">
          <span className="text-[10px] font-bold text-purple-dark dark:text-purple-light bg-purple/15 border border-purple/30 px-3 py-1 rounded-full uppercase tracking-wider">
            Proyecto de Aula · Cálculo III
          </span>
          <span className="text-[10px] font-semibold text-muted bg-surface-2 border border-border px-3 py-1 rounded-full">
            Ingeniería de Sonido
          </span>
        </div>

        {/* TÍTULO PRINCIPAL */}
        <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-text max-w-4xl leading-tight">
          Diseño y Optimización de <br className="hidden sm:block" />
          <span className="bg-gradient-to-r from-purple-dark via-purple to-pink-500 bg-clip-text text-transparent">
            Arreglos Cardioides de Subwoofers
          </span>
        </h1>

        {/* DESCRIPCIÓN CONTEXTUAL */}
        <p className="mt-5 text-sm sm:text-base text-muted max-w-2xl leading-relaxed">
          En sonido en vivo, los subwoofers radian en todas direcciones causando contaminación acústica en el escenario.
          <strong className="text-text font-semibold"> BONAIS</strong> demuestra cómo el
          <strong className="text-purple-dark dark:text-purple-light font-semibold"> Cálculo de Varias Variables </strong>
          resuelve este desafío mediante separación espacial, retardo de fase e interferencia destructiva controlada.
        </p>

        {/* BOTONES DE ACCIÓN PRINCIPAL */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={goToSimulator}
            className="flex items-center gap-2.5 px-6 py-3 rounded-2xl text-sm font-bold text-white bg-purple hover:bg-purple-dark shadow-xl shadow-purple/25 hover:shadow-purple/40 hover:-translate-y-0.5 transition-all"
          >
            <Sliders className="h-4 w-4" />
            <span>Abrir Simulador y Dashboard</span>
            <ArrowRight className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={openExperimentLab}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-semibold text-text bg-surface-2 hover:bg-surface border border-border hover:border-purple/40 shadow-sm transition-all"
          >
            <FlaskConical className="h-4 w-4 text-purple-dark dark:text-purple-light" />
            <span>Laboratorio de Fórmulas en Vivo</span>
          </button>
        </div>

        {/* STATS RÁPIDOS */}
        <div className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-3 w-full max-w-3xl">
          <div className="p-3.5 rounded-2xl bg-surface-2/60 border border-border">
            <span className="text-[10px] text-muted font-medium block">Atenuación Escenario</span>
            <span className="text-xl font-bold font-mono text-purple-dark dark:text-purple-light">25,4 dB</span>
          </div>
          <div className="p-3.5 rounded-2xl bg-surface-2/60 border border-border">
            <span className="text-[10px] text-muted font-medium block">Separación Óptima</span>
            <span className="text-xl font-bold font-mono text-text">d = λ/4</span>
          </div>
          <div className="p-3.5 rounded-2xl bg-surface-2/60 border border-border">
            <span className="text-[10px] text-muted font-medium block">Retardo Teórico</span>
            <span className="text-xl font-bold font-mono text-text">τ = d/c</span>
          </div>
          <div className="p-3.5 rounded-2xl bg-surface-2/60 border border-border">
            <span className="text-[10px] text-muted font-medium block">Banda Principal</span>
            <span className="text-xl font-bold font-mono text-text">40 – 100 Hz</span>
          </div>
        </div>
      </section>

      {/* ═══ CONTEXTO Y QUÉ RESUELVE EL PROYECTO ═══ */}
      <section className="px-4 py-12 bg-surface/50 border-y border-border">
        <div className="max-w-5xl mx-auto flex flex-col gap-8">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-text tracking-tight">
              ¿Qué problema real resuelve BONAIS?
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-muted">
              Un puente directo entre la física acústica de bajas frecuencias y los métodos rigurosos de Cálculo III.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-5 rounded-2xl bg-surface-2 border border-border flex flex-col gap-3">
              <div className="h-9 w-9 rounded-xl bg-warm/15 text-warm flex items-center justify-center">
                <Waves className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-text">1. El Problema: Graves Omnidireccionales</h3>
              <p className="text-xs text-muted leading-relaxed">
                A 40–100 Hz las ondas sonoras miden entre 3,4 y 8,6 metros. Al ser tan largas comparadas con la caja, el subwoofer radia casi idéntico en todas las direcciones. Toda esa energía inunda el escenario, satura los micrófonos y aturde a los músicos.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-surface-2 border border-border flex flex-col gap-3">
              <div className="h-9 w-9 rounded-xl bg-purple/15 text-purple-dark dark:text-purple-light flex items-center justify-center">
                <Music className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-text">2. La Solución: Arreglo Cardioide</h3>
              <p className="text-xs text-muted leading-relaxed">
                Colocando dos subwoofers en fila separados una distancia d = λ/4, retrasando la caja trasera un tiempo τ = d/c e invirtiendo su polaridad (−180°), las ondas llegan exactamente en fase hacia el público y en contrafase hacia el escenario, logrando silencio atrás.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-surface-2 border border-border flex flex-col gap-3">
              <div className="h-9 w-9 rounded-xl bg-accent/15 text-accent flex items-center justify-center">
                <Cpu className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-text">3. El Núcleo: Cálculo Multivariable</h3>
              <p className="text-xs text-muted leading-relaxed">
                BONAIS no usa "recetas a ojo". Todo resultado es deducible a mano: funciones de dos variables E(x, y), gradiente ∇E para saber dónde aumenta el sonido, puntos de silla mediante la matriz Hessiana e integrales dobles para cuantificar la energía total.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ OBJETIVOS DEL PROYECTO DE AULA ═══ */}
      <section className="px-4 py-14 max-w-5xl mx-auto w-full">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <span className="text-[10px] font-bold text-purple-dark dark:text-purple-light uppercase tracking-wider font-mono">
              Proyecto de Aula
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-text tracking-tight mt-1">
              Objetivos Específicos & Respuestas del Sistema
            </h2>
          </div>
          <button
            type="button"
            onClick={openExperimentLab}
            className="self-start md:self-auto flex items-center gap-1.5 text-xs font-semibold text-purple-dark dark:text-purple-light hover:underline"
          >
            <span>Verificar números en Laboratorio de Fórmulas</span>
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {objectives.map((obj) => (
            <div
              key={obj.num}
              className="p-4 rounded-2xl bg-surface-2 border border-border flex flex-col justify-between gap-3 hover:border-purple/30 transition-colors"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-purple/15 text-purple-dark dark:text-purple-light font-bold text-[10px]">
                      {obj.num}
                    </span>
                    <h3 className="text-xs font-bold text-text">{obj.title}</h3>
                  </div>
                  <span className="text-[9px] font-semibold text-muted bg-surface px-2 py-0.5 rounded-md border border-border">
                    {obj.tag}
                  </span>
                </div>
                <p className="text-[11px] text-muted leading-relaxed mb-2.5">
                  {obj.desc}
                </p>
              </div>
              <div className="p-2 rounded-xl bg-surface border border-border/80 font-mono text-[10px] text-purple-dark dark:text-purple-light flex items-center justify-between">
                <span>{obj.math}</span>
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 opacity-80" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ EQUIPO DE TRABAJO (CRÉDITOS OFICIALES) ═══ */}
      <section className="px-4 py-14 bg-surface-2/60 border-t border-border">
        <div className="max-w-5xl mx-auto">
          <div className="text-center max-w-xl mx-auto mb-10">
            <span className="text-[10px] font-bold text-purple-dark dark:text-purple-light uppercase tracking-wider font-mono">
              Autores & Desarrolladores
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-text tracking-tight mt-1">
              Equipo de Investigación y Creación
            </h2>
            <p className="text-xs text-muted mt-1.5">
              Estudiantes de Ingeniería de Sonido para el curso de Cálculo III.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {team.map((member) => (
              <div
                key={member.name}
                className="p-5 rounded-2xl bg-surface border border-border shadow-sm flex flex-col justify-between gap-4"
              >
                <div>
                  <div className="h-10 w-10 rounded-xl bg-purple/15 text-purple-dark dark:text-purple-light flex items-center justify-center font-bold text-sm mb-3">
                    {member.name.charAt(0)}
                  </div>
                  <h3 className="text-sm font-bold text-text">{member.name}</h3>
                  <span className="text-[10px] font-semibold text-purple-dark dark:text-purple-light block mt-0.5">
                    {member.role}
                  </span>
                  <div className="my-2 h-px bg-border" />
                  <span className="inline-block text-[9px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full mb-2">
                    {member.highlight}
                  </span>
                  <p className="text-[11px] text-muted leading-relaxed">
                    {member.bio}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FOOTER OFICIAL CON NOMBRES ═══ */}
      <footer className="px-4 py-8 bg-bg border-t border-border text-center text-xs text-muted">
        <div className="max-w-4xl mx-auto flex flex-col items-center gap-3">
          <div className="flex items-center gap-2 font-semibold text-text">
            <img src="/logo-original.png" alt="BONAIS" className="h-5 w-5 rounded object-contain" />
            <span>BONAIS — Proyecto de Aula de Cálculo III</span>
          </div>

          <p className="text-[11px] text-muted">
            Integrantes: <strong className="text-text font-semibold">Cielo Ochoa</strong> - <strong className="text-text font-semibold">Daniel Angulo</strong> — <strong className="text-text font-semibold">Jerónimo Gómez</strong>
          </p>

          <p className="text-[10px] text-muted opacity-75">
            Ingeniería de Sonido · Cálculo de Varias Variables · 2026
          </p>

          <div className="mt-2 flex items-center gap-3 text-[11px]">
            <button
              type="button"
              onClick={goToSimulator}
              className="text-purple-dark dark:text-purple-light font-semibold hover:underline"
            >
              Ir al Simulador
            </button>
            <span>·</span>
            <button
              type="button"
              onClick={openExperimentLab}
              className="hover:text-text transition-colors"
            >
              Laboratorio de Fórmulas
            </button>
            <span>·</span>
            <button
              type="button"
              onClick={openTheory}
              className="hover:text-text transition-colors"
            >
              Fundamentos Teóricos
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
