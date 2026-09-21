/**
 * @file arrayState.js
 * @description Estado global de la aplicación BONAIS con useReducer y React Context.
 * Toda la lógica de estado es interna — sin sincronización con la URL.
 */

import React, { createContext, useContext, useReducer, useEffect, useMemo } from 'react';
import { calculateSpeedOfSound, DEFAULT_TEMPERATURE, DEFAULT_FREQUENCY, DEFAULT_REFERENCE_DISTANCE } from '../core/constants.js';
import { calculateWavelength, calculateWavenumber, calculateOmega, dBToLinear } from '../core/physics.js';
import { createTwoSubSources, precomputeSourceCoefficients } from '../core/field.js';
import { evaluateAllMetrics, calculateAR, calculateGFront, DEFAULT_AUDIENCE_REGION, DEFAULT_STAGE_REGION } from '../core/metrics.js';
import { calculateFarFieldAttenuation } from '../core/farField.js';

const ArrayContext = createContext(null);

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
  theme: 'light',
  activeTab: 'calculus',
  selectedTool: 'point',
  inspectedPoint: { x: 5.0, y: 0.0 },
  audienceRegion: { ...DEFAULT_AUDIENCE_REGION },
  stageRegion: { ...DEFAULT_STAGE_REGION },
  layers: {
    contours: true,
    criticalPoints: true,
    gradientVector: true,
    asymptoticMinima: true,
    regions: true,
  },
  compareMode: false,
  showTheoryModal: false,
  showExportModal: false,
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

    default:
      return state;
  }
}

export function ArrayProvider({ children }) {
  const [state, dispatch] = useReducer(arrayReducer, INITIAL_STATE);

  // Efecto para aplicar tema claro/oscuro en el elemento html
  useEffect(() => {
    const root = document.documentElement;
    if (state.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
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

  const value = useMemo(() => ({ state, dispatch, derived: fullDerived }), [state, fullDerived]);

  return React.createElement(ArrayContext.Provider, { value }, children);
}

export function useArray() {
  const context = useContext(ArrayContext);
  if (!context) {
    throw new Error('useArray debe utilizarse dentro de un ArrayProvider');
  }
  return context;
}
