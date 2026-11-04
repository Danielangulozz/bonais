/**
 * @file arrayState.js
 * @description Estado global de la aplicación BONAIS con useReducer y React Context.
 * Context separado en State, Dispatch y Derived para evitar re-renders innecesarios.
 * Toda la lógica de estado es interna — sin sincronización con la URL.
 */

import React, { createContext, useContext, useReducer, useEffect, useMemo, useCallback } from 'react';
import { calculateSpeedOfSound, DEFAULT_TEMPERATURE, DEFAULT_FREQUENCY, DEFAULT_REFERENCE_DISTANCE } from '../core/constants.js';
import { calculateWavelength, calculateWavenumber, calculateOmega, dBToLinear } from '../core/physics.js';
import { createTwoSubSources, precomputeSourceCoefficients } from '../core/field.js';
import { evaluateAllMetrics, calculateAR, calculateGFront, DEFAULT_AUDIENCE_REGION, DEFAULT_STAGE_REGION } from '../core/metrics.js';
import { calculateFarFieldAttenuation } from '../core/farField.js';

// ═══════════════════════════════════════════════════════════════════
// Contexts separados para rendimiento óptimo
// ═══════════════════════════════════════════════════════════════════
const StateContext = createContext(null);
const DispatchContext = createContext(null);
const DerivedContext = createContext(null);

// Estado inicial
const initialTemp = DEFAULT_TEMPERATURE;
const initialC = calculateSpeedOfSound(initialTemp);
const initialF = DEFAULT_FREQUENCY;
const initialWavelength = calculateWavelength(initialF, initialC);
const initialD = initialWavelength / 4; // Cardioide λ/4
const initialTau = initialD / initialC;

export const INITIAL_STATE = {
  frequency: initialF,
  separation: initialD,
  delayRear: initialTau, // [s]
  delayFront: 0, // [s]
  autoDelay: true,
  gainFrontDB: 0,
  gainRearDB: 0,
  polarityFront: 1,
  polarityRear: -1,
  temperature: initialTemp,
  referenceDistance: DEFAULT_REFERENCE_DISTANCE,
  mapSpan: 12.0, // ±12 m
  bandF1: 40,
  bandF2: 100,
  dMin: 0.5,
  dMax: 2.0,
  preset: 'cardioid',
  theme: 'dark',
  activeTab: 'calculus',
  selectedTool: 'point',
  inspectedPoint: { x: 5.0, y: 0.0 },
  audienceRegion: { ...DEFAULT_AUDIENCE_REGION },
  stageRegion: { ...DEFAULT_STAGE_REGION },
  venue: 'concierto',
  layers: {
    contours: true,
    criticalPoints: false, // Apagado por defecto para limpieza visual
    gradientVector: true,
    asymptoticMinima: true,
    regions: true,
    integrationMesh: false,
  },
  rightPanel: 'model', // 'model' | 'results'
  activePage: 'landing', // 'landing' | 'simulator'
  viewMode: 'map2d', // 'map2d' | 'polar' | 'dual' | 'contours'
  layoutMode: 'studio', // 'studio' | 'fullscreen'
  panOffset: { x: 0, y: 0 },
  compareMode: false,
  showTheoryModal: false,
  showExportModal: false,
  showExperimentModal: false,
};

function arrayReducer(state, action) {
  switch (action.type) {
    case 'SET_PARAMETER': {
      const { name, value } = action.payload;
      const nextState = { ...state, [name]: value };

      // Si se altera la separación, frecuencia o temperatura y está en autoDelay:
      if (
        (name === 'separation' || name === 'frequency' || name === 'temperature') &&
        nextState.autoDelay
      ) {
        const c = calculateSpeedOfSound(nextState.temperature);
        nextState.delayRear = nextState.separation / c;
      }

      // Si el usuario modifica manualmente el retardo, apagar autoDelay
      if (name === 'delayRear') {
        nextState.autoDelay = false;
        nextState.preset = 'custom';
      }

      if (name === 'separation' || name === 'polarityRear' || name === 'polarityFront') {
        nextState.preset = 'custom';
      }

      return nextState;
    }

    case 'APPLY_PRESET': {
      const presetType = action.payload;
      const c = calculateSpeedOfSound(state.temperature);

      if (presetType === 'in_phase') {
        return {
          ...state,
          preset: 'in_phase',
          polarityRear: 1,
          polarityFront: 1,
          gainRearDB: 0,
          gainFrontDB: 0,
          delayRear: 0,
          autoDelay: false,
        };
      }

      if (presetType === 'cardioid') {
        const wavelength = calculateWavelength(state.frequency, c);
        const sep = wavelength / 4;
        return {
          ...state,
          preset: 'cardioid',
          polarityRear: -1,
          polarityFront: 1,
          gainRearDB: 0,
          gainFrontDB: 0,
          separation: sep,
          autoDelay: true,
          delayRear: sep / c,
        };
      }

      return { ...state, preset: 'custom' };
    }

    case 'SET_AUTO_DELAY': {
      const enabled = action.payload;
      if (enabled) {
        const c = calculateSpeedOfSound(state.temperature);
        return {
          ...state,
          autoDelay: true,
          delayRear: state.separation / c,
        };
      }
      return { ...state, autoDelay: false };
    }

    case 'SET_LAMBDA_FOURTH': {
      const c = calculateSpeedOfSound(state.temperature);
      const wavelength = calculateWavelength(state.frequency, c);
      const sep = wavelength / 4;
      const nextDelay = state.autoDelay ? sep / c : state.delayRear;
      return {
        ...state,
        separation: sep,
        delayRear: nextDelay,
      };
    }

    case 'SET_INSPECTED_POINT':
      return { ...state, inspectedPoint: action.payload };

    case 'SET_TOOL':
      return { ...state, selectedTool: action.payload };

    case 'TOGGLE_LAYER': {
      const layerName = action.payload;
      return {
        ...state,
        layers: {
          ...state.layers,
          [layerName]: !state.layers[layerName],
        },
      };
    }

    case 'SET_THEME':
      return { ...state, theme: action.payload };

    case 'SET_ACTIVE_TAB':
      return { ...state, activeTab: action.payload };

    case 'SET_COMPARE_MODE':
      return { ...state, compareMode: action.payload };

    case 'SET_MODAL': {
      const { modal, open } = action.payload;
      return { ...state, [modal]: open };
    }

    case 'SET_REGION': {
      const { regionName, regionData } = action.payload;
      return {
        ...state,
        [regionName]: { ...state[regionName], ...regionData },
      };
    }

    case 'SET_REGION_DIMS': {
      // Dimensiones "de usuario" → región rectangular. Público hacia +x, escenario hacia −x.
      const { regionName, gap, depth, width } = action.payload;
      const g = Math.max(0.5, Math.min(gap, 60));
      const dp = Math.max(1, Math.min(depth, 120));
      const w = Math.max(1, Math.min(width, 120));
      const region = regionName === 'audienceRegion'
        ? { xMin: g, xMax: g + dp, yMin: -w / 2, yMax: w / 2 }
        : { xMin: -(g + dp), xMax: -g, yMin: -w / 2, yMax: w / 2 };
      return { ...state, [regionName]: region, venue: 'custom' };
    }

    case 'APPLY_VENUE_PRESET': {
      const venues = {
        sala: { aud: [2, 10, 10], stg: [1.5, 5, 8] },
        concierto: { aud: [3, 12, 16], stg: [3, 12, 16] },
        festival: { aud: [5, 40, 40], stg: [2, 10, 18] },
      };
      const v = venues[action.payload];
      if (!v) return state;
      const [ag, ad, aw] = v.aud;
      const [sg, sd, sw] = v.stg;
      return {
        ...state,
        venue: action.payload,
        audienceRegion: { xMin: ag, xMax: ag + ad, yMin: -aw / 2, yMax: aw / 2 },
        stageRegion: { xMin: -(sg + sd), xMax: -sg, yMin: -sw / 2, yMax: sw / 2 },
        // Encuadre que muestra ambas zonas completas
        mapSpan: Math.max(8, 0.55 * Math.max(ag + ad + sg + sd, aw, sw)),
        panOffset: { x: (ag + ad - sg - sd) / 2, y: 0 },
      };
    }

    case 'SET_RIGHT_PANEL':
      return { ...state, rightPanel: action.payload };

    case 'SET_VIEW_MODE':
      return { ...state, viewMode: action.payload };

    case 'SET_ACTIVE_PAGE':
      return { ...state, activePage: action.payload };

    case 'SET_EXPERIMENT_MODAL':
      return { ...state, showExperimentModal: action.payload };

    case 'SET_LAYOUT_MODE':
      return { ...state, layoutMode: action.payload };

    case 'SET_MAP_SPAN':
      return { ...state, mapSpan: Math.min(Math.max(action.payload, 2.5), 50) };

    case 'SET_PAN_OFFSET':
      return { ...state, panOffset: action.payload };

    case 'RESET_VIEW':
      return { ...state, mapSpan: 12.0, panOffset: { x: 0, y: 0 } };

    default:
      return state;
  }
}

export function ArrayProvider({ children }) {
  const [state, dispatch] = useReducer(arrayReducer, INITIAL_STATE);

  // Estabilizar dispatch con useCallback (es estable por naturaleza, pero explicitamos)
  const stableDispatch = useCallback(dispatch, []);

  // Efecto para aplicar tema claro/oscuro en el elemento html y sincronizar favicon
  useEffect(() => {
    const root = document.documentElement;
    if (state.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    const iconLink = document.querySelector('link[rel="icon"]');
    if (iconLink) {
      iconLink.setAttribute('href', state.theme === 'dark' ? '/logo-dark.png' : '/favicon.png');
    }
  }, [state.theme]);

  // ═══════════════════════════════════════════════════════════════════
  // CAPA 1: Cálculos INSTANTÁNEOS (< 0.1 ms) — se ejecutan en cada tick
  // ═══════════════════════════════════════════════════════════════════
  const derived = useMemo(() => {
    const c = calculateSpeedOfSound(state.temperature);
    const omega = calculateOmega(state.frequency);
    const k = calculateWavenumber(state.frequency, c);
    const wavelength = calculateWavelength(state.frequency, c);

    const kd = k * state.separation;
    const dOverLambda = state.separation / wavelength;
    const idealTau = state.separation / c;
    const currentTau = state.delayRear;
    const phaseErrorRad = omega * Math.abs(currentTau - idealTau);
    const phaseErrorDeg = (phaseErrorRad * 180) / Math.PI;

    const gainRearLinear = dBToLinear(state.gainRearDB);
    const gainFrontLinear = dBToLinear(state.gainFrontDB);

    const sources = createTwoSubSources({
      separation: state.separation,
      delayRear: state.delayRear,
      delayFront: state.delayFront,
      gainRear: gainRearLinear,
      gainFront: gainFrontLinear,
      polarityRear: state.polarityRear,
      polarityFront: state.polarityFront,
    });

    const precomputedSources = precomputeSourceCoefficients(sources, omega);

    // Métricas livianas: A_R (2 evaluaciones de punto) y A_ff (fórmula cerrada)

    const arResult = calculateAR(precomputedSources, k, state.referenceDistance);
    const affResult = calculateFarFieldAttenuation({
      d: state.separation, k, omega,
      gainFront: gainFrontLinear, gainRear: gainRearLinear,
      polarityFront: state.polarityFront, polarityRear: state.polarityRear,
      delayFront: state.delayFront, delayRear: state.delayRear,
    });
    const gFrontDB = calculateGFront(affResult.frontMag, gainFrontLinear + gainRearLinear);

    return {
      c, omega, k, wavelength, kd, dOverLambda,
      idealTau, currentTau, phaseErrorDeg,
      gainRearLinear, gainFrontLinear,
      sources, precomputedSources,
      // Métricas instantáneas (sin integrales)
      fastMetrics: {
        arDB: arResult.arDB,
        affDB: affResult.affDB,
        isIdealInfinite: affResult.isIdealInfinite,
        gFrontDB,
      },
    };
  }, [
    state.frequency,
    state.separation,
    state.delayRear,
    state.delayFront,
    state.gainRearDB,
    state.gainFrontDB,
    state.polarityRear,
    state.polarityFront,
    state.temperature,
    state.referenceDistance,
  ]);

  // ═══════════════════════════════════════════════════════════════════
  // CAPA 2: Métricas PESADAS (QPE, comparativa) — diferidas 200ms
  // ═══════════════════════════════════════════════════════════════════
  const [metrics, setMetrics] = React.useState(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      const result = evaluateAllMetrics({
        frequency: state.frequency,
        speedOfSound: derived.c,
        separation: state.separation,
        delayRear: state.delayRear,
        delayFront: state.delayFront,
        gainRear: derived.gainRearLinear,
        gainFront: derived.gainFrontLinear,
        polarityRear: state.polarityRear,
        polarityFront: state.polarityFront,
        rDistance: state.referenceDistance,
        audienceRegion: state.audienceRegion,
        stageRegion: state.stageRegion,
        computeQPE: true,
        n: 25,
      });
      setMetrics(result);
    }, 200);
    return () => clearTimeout(timer);
  }, [
    state.frequency,
    state.separation,
    state.delayRear,
    state.delayFront,
    derived.gainRearLinear,
    derived.gainFrontLinear,
    state.polarityRear,
    state.polarityFront,
    state.temperature,
    state.referenceDistance,
    state.audienceRegion,
    state.stageRegion,
    derived.c,
  ]);

  // Fusionar derived + metrics en un solo objeto estable
  const fullDerived = useMemo(() => ({
    ...derived,
    metrics: metrics || {
      current: {
        arDB: derived.fastMetrics.arDB,
        affDB: derived.fastMetrics.affDB,
        isIdealInfinite: derived.fastMetrics.isIdealInfinite,
        gFrontDB: derived.fastMetrics.gFrontDB,
        qpeDB: 0,
        audienceEnergy: 0,
        stageEnergy: 0,
      },
      inPhase: { arDB: 0, affDB: 0, isIdealInfinite: false, gFrontDB: 0, qpeDB: 0, audienceEnergy: 0, stageEnergy: 0 },
      delta: { deltaAR: derived.fastMetrics.arDB, deltaAFF: derived.fastMetrics.affDB, deltaGFront: derived.fastMetrics.gFrontDB, deltaQPE: 0 },
    },
  }), [derived, metrics]);

  return React.createElement(
    StateContext.Provider,
    { value: state },
    React.createElement(
      DispatchContext.Provider,
      { value: stableDispatch },
      React.createElement(
        DerivedContext.Provider,
        { value: fullDerived },
        children
      )
    )
  );
}

// ═══════════════════════════════════════════════════════════════════
// Hooks granulares — usa el más específico posible
// ═══════════════════════════════════════════════════════════════════

/** Solo el state — re-renders cuando el state cambia */
export function useArrayState() {
  const context = useContext(StateContext);
  if (context === null) throw new Error('useArrayState debe utilizarse dentro de un ArrayProvider');
  return context;
}

/** Solo dispatch — NUNCA re-renderiza por cambios de state */
export function useArrayDispatch() {
  const context = useContext(DispatchContext);
  if (context === null) throw new Error('useArrayDispatch debe utilizarse dentro de un ArrayProvider');
  return context;
}

/** Solo derived — re-renders cuando los cálculos derivados cambian */
export function useArrayDerived() {
  const context = useContext(DerivedContext);
  if (context === null) throw new Error('useArrayDerived debe utilizarse dentro de un ArrayProvider');
  return context;
}

/** Wrapper compatible con el API existente — usa los hooks granulares internamente */
export function useArray() {
  const state = useArrayState();
  const dispatch = useArrayDispatch();
  const derived = useArrayDerived();
  return { state, dispatch, derived };
}
