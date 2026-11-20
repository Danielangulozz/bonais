import React, { useState, useRef, useCallback } from 'react';
import { useArrayState, useArrayDispatch, useArrayDerived } from '../state/arrayState.js';
import { ChevronDown, Wand2, RefreshCw, Settings2 } from 'lucide-react';
import { optimizeBandMinMax } from '../core/optimize.js';
import RegionControls from './RegionControls.jsx';

/**
 * Hook para throttlear dispatches de sliders a 1 por frame via rAF.
 */
function useThrottledDispatch(dispatch) {
  const rafRef = useRef(null);
  const pendingRef = useRef(null);

  const throttledDispatch = useCallback((action) => {
    pendingRef.current = action;
    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(() => {
        if (pendingRef.current) {
          dispatch(pendingRef.current);
          pendingRef.current = null;
        }
        rafRef.current = null;
      });
    }
  }, [dispatch]);

  return throttledDispatch;
}

export default React.memo(function ControlPanel() {
  const state = useArrayState();
  const dispatch = useArrayDispatch();
  const derived = useArrayDerived();
  const throttledDispatch = useThrottledDispatch(dispatch);

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showBandAssistant, setShowBandAssistant] = useState(false);

  const nf2 = new Intl.NumberFormat('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const handleFrequencySlider = useCallback((val) => {
    const f = Math.max(20, Math.min(200, Number(val) || 20));
    throttledDispatch({ type: 'SET_PARAMETER', payload: { name: 'frequency', value: f } });
  }, [throttledDispatch]);

  const handleFrequencyInput = useCallback((val) => {
    const f = Math.max(20, Math.min(200, Number(val) || 20));
    dispatch({ type: 'SET_PARAMETER', payload: { name: 'frequency', value: f } });
  }, [dispatch]);

  const handleSeparationSlider = useCallback((val) => {
    const d = Math.max(0.1, Math.min(4.0, Number(val) || 0.1));
    throttledDispatch({ type: 'SET_PARAMETER', payload: { name: 'separation', value: d } });
  }, [throttledDispatch]);

  const handleSeparationInput = useCallback((val) => {
    const d = Math.max(0.1, Math.min(4.0, Number(val) || 0.1));
    dispatch({ type: 'SET_PARAMETER', payload: { name: 'separation', value: d } });
  }, [dispatch]);

  const handleDelaySlider = useCallback((valMs) => {
    const tauSec = Math.max(0, Math.min(0.025, (Number(valMs) || 0) / 1000));
    throttledDispatch({ type: 'SET_PARAMETER', payload: { name: 'delayRear', value: tauSec } });
  }, [throttledDispatch]);

  const handleDelayInput = useCallback((valMs) => {
    const tauSec = Math.max(0, Math.min(0.025, (Number(valMs) || 0) / 1000));
    dispatch({ type: 'SET_PARAMETER', payload: { name: 'delayRear', value: tauSec } });
  }, [dispatch]);

  const applyBandAssistant = () => {
    const opt = optimizeBandMinMax(state.bandF1, state.bandF2, derived.c);
    dispatch({ type: 'SET_PARAMETER', payload: { name: 'separation', value: opt.dStar } });
    if (state.autoDelay) {
      dispatch({ type: 'SET_PARAMETER', payload: { name: 'delayRear', value: opt.tauStar } });
    }
  };

  const isLambdaFourth = Math.abs(state.separation - derived.wavelength / 4) < 0.015;

  return (
    <div className="flex flex-col gap-5 text-xs select-none">
      {/* ═══ Frecuencia f ═══ */}
      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-baseline">
          <div>
            <span className="text-[12px] text-text font-medium">Frecuencia</span>
            <span className="block text-[10px] text-muted tabular-nums">λ = {nf2.format(derived.wavelength)} m</span>
          </div>
          <div className="flex items-baseline gap-1">
            <input
              type="number"
              min="20"
              max="200"
              step="1"
              value={state.frequency}
              onChange={(e) => handleFrequencyInput(e.target.value)}
              className="w-16 bg-transparent text-right font-light text-[24px] tracking-tight tabular-nums text-text focus:outline-none border-b border-transparent focus:border-purple/50 transition-colors"
            />
            <span className="text-[11px] text-muted">Hz</span>
          </div>
        </div>
        <input
          type="range" min="20" max="200" step="1"
          value={state.frequency}
          onChange={(e) => handleFrequencySlider(e.target.value)}
          className="slider-custom"
        />
        <div className="flex items-center justify-between pt-0.5">
          <span className="text-[10.5px] text-muted tabular-nums">Presets sub</span>
          <div className="flex items-center gap-1">
            {[50, 80, 100].map((fPreset) => (
              <button
                key={fPreset}
                type="button"
                onClick={() => handleFrequencyInput(fPreset)}
                className={`rounded-full px-2.5 py-0.5 text-[10.5px] font-medium transition-all ${
                  state.frequency === fPreset
                    ? 'bg-[#7C3AED]/20 text-purple-dark dark:text-purple-light border border-[#7C3AED]/40 font-semibold'
                    : 'sim-card text-muted hover:text-text'
                }`}
                title={`Fijar frecuencia a ${fPreset} Hz${fPreset === 80 ? ' (diseño de referencia del proyecto)' : ''}`}
              >
                {fPreset} Hz
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ═══ Separación d ═══ */}
      <div className="flex flex-col gap-2 pt-3 border-t border-border">
        <div className="flex justify-between items-baseline">
          <div>
            <span className="text-[12px] text-text font-medium">Separación d</span>
            <span className="block text-[10px] text-muted tabular-nums">d/λ = {nf2.format(derived.dOverLambda)}</span>
          </div>
          <div className="flex items-baseline gap-1">
            <input
              type="number"
              min="0.10" max="4.00" step="0.01"
              value={Math.round(state.separation * 100) / 100}
              onChange={(e) => handleSeparationInput(e.target.value)}
              className="w-16 bg-transparent text-right font-light text-[24px] tracking-tight tabular-nums text-text focus:outline-none border-b border-transparent focus:border-purple/50 transition-colors"
            />
            <span className="text-[11px] text-muted">m</span>
          </div>
        </div>
        <input
          type="range" min="0.10" max="4.00" step="0.01"
          value={state.separation}
          onChange={(e) => handleSeparationSlider(e.target.value)}
          className="slider-custom"
        />
        <div className="flex items-center justify-between pt-0.5">
          <span className="text-[10.5px] text-muted tabular-nums">Óptimo λ/4 = {nf2.format(derived.wavelength / 4)} m</span>
          <button
            type="button"
            onClick={() => dispatch({ type: 'SET_LAMBDA_FOURTH' })}
            className={`rounded-full px-2.5 py-0.5 text-[10.5px] font-medium transition-all ${
              isLambdaFourth
                ? 'bg-[#7C3AED]/20 text-purple-dark dark:text-purple-light border border-[#7C3AED]/40'
                : 'sim-card text-muted hover:text-text'
            }`}
          >
            Fijar d = λ/4
          </button>
        </div>
      </div>

      {/* ═══ Retardo τ ═══ */}
      <div className="flex flex-col gap-2 pt-3 border-t border-border">
        <div className="flex justify-between items-baseline">
          <div>
            <span className="text-[12px] text-text font-medium">Retardo trasero τ</span>
            <span className="block text-[10px] text-muted tabular-nums">d/c = {nf2.format(derived.idealTau * 1000)} ms</span>
          </div>
          <div className="flex items-baseline gap-1">
            <input
              type="number"
              min="0" max="25" step="0.05"
              value={Math.round(state.delayRear * 100000) / 100}
              onChange={(e) => handleDelayInput(e.target.value)}
              className="w-16 bg-transparent text-right font-light text-[24px] tracking-tight tabular-nums text-text focus:outline-none border-b border-transparent focus:border-purple/50 transition-colors"
            />
            <span className="text-[11px] text-muted">ms</span>
          </div>
        </div>
        <input
          type="range" min="0" max="20" step="0.05"
          value={state.delayRear * 1000}
          onChange={(e) => handleDelaySlider(e.target.value)}
          className="slider-custom"
        />
        <div className="flex items-center justify-between pt-0.5">
          <span className="text-[10.5px] text-muted">Restricción nulo trasero</span>
          <button
            type="button"
            onClick={() => dispatch({ type: 'SET_AUTO_DELAY', payload: !state.autoDelay })}
            className={`rounded-full px-2.5 py-0.5 text-[10.5px] font-medium transition-all ${
              state.autoDelay
                ? 'bg-[#7C3AED]/20 text-purple-dark dark:text-purple-light border border-[#7C3AED]/40'
                : 'sim-card text-muted hover:text-text'
            }`}
          >
            {state.autoDelay ? 'Auto τ = d/c activo' : 'Activar τ = d/c'}
          </button>
        </div>
      </div>

      {/* ═══ Recinto (Dominios de integración) ═══ */}
      <div className="pt-3 border-t border-border">
        <RegionControls />
      </div>

      {/* ═══ Acordeones secundarios limpios ═══ */}
      <div className="pt-2 border-t border-border flex flex-col gap-1">
        {/* Asistente de Banda */}
        <button
          type="button"
          onClick={() => setShowBandAssistant(!showBandAssistant)}
          className="flex items-center justify-between py-2 text-[11.5px] font-medium text-muted hover:text-text transition-colors"
        >
          <span className="flex items-center gap-2">
            <Wand2 className="h-3.5 w-3.5 text-purple" />
            <span>Compromiso en banda</span>
          </span>
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showBandAssistant ? 'rotate-180' : ''}`} />
        </button>

        {showBandAssistant && (
          <div className="sim-card rounded-2xl p-3 flex flex-col gap-2.5 mb-2 animate-fade-in">
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-[10px] text-muted">f₁ mín (Hz)</span>
                <input
                  type="number" min="20" max="150" value={state.bandF1}
                  onChange={(e) => dispatch({ type: 'SET_PARAMETER', payload: { name: 'bandF1', value: Number(e.target.value) || 20 } })}
                  className="w-full rounded-xl sim-card px-2.5 py-1 text-text text-[11px] tabular-nums focus:border-purple/50 focus:outline-none"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] text-muted">f₂ máx (Hz)</span>
                <input
                  type="number" min="40" max="200" value={state.bandF2}
                  onChange={(e) => dispatch({ type: 'SET_PARAMETER', payload: { name: 'bandF2', value: Number(e.target.value) || 100 } })}
                  className="w-full rounded-xl sim-card px-2.5 py-1 text-text text-[11px] tabular-nums focus:border-purple/50 focus:outline-none"
                />
              </label>
            </div>
            <button
              type="button"
              onClick={applyBandAssistant}
              className="flex items-center justify-center gap-1.5 w-full rounded-full bg-[#7C3AED] hover:bg-[#8B5CF6] text-white py-1.5 text-[11px] font-medium transition-colors"
            >
              <RefreshCw className="h-3 w-3" />
              <span>Aplicar d* para [{state.bandF1}–{state.bandF2} Hz]</span>
            </button>
          </div>
        )}

        {/* Ajustes Avanzados */}
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center justify-between py-2 text-[11.5px] font-medium text-muted hover:text-text transition-colors"
        >
          <span className="flex items-center gap-2">
            <Settings2 className="h-3.5 w-3.5" />
            <span>Polaridad y medio físico</span>
          </span>
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
        </button>

        {showAdvanced && (
          <div className="sim-card rounded-2xl p-3 flex flex-col gap-3 animate-fade-in">
            {/* Polaridades */}
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] text-muted">S1 Trasera (−d/2)</span>
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'SET_PARAMETER', payload: { name: 'polarityRear', value: state.polarityRear === 1 ? -1 : 1 } })}
                  className={`px-2 py-1.5 rounded-xl text-[10.5px] font-medium transition-all ${
                    state.polarityRear === -1
                      ? 'bg-[#7C3AED]/20 text-purple-dark dark:text-purple-light border border-[#7C3AED]/40'
                      : 'bg-warm/20 text-warm border border-warm/30'
                  }`}
                >
                  {state.polarityRear === -1 ? '−180° Invertida' : '0° En fase'}
                </button>
                <div className="flex items-center justify-between text-[10px] text-muted pt-0.5">
                  <span>Ganancia</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number" min="-12" max="0" step="0.5" value={state.gainRearDB}
                      onChange={(e) => dispatch({ type: 'SET_PARAMETER', payload: { name: 'gainRearDB', value: Number(e.target.value) || 0 } })}
                      className="w-11 rounded-lg sim-card px-1.5 py-0.5 text-right text-text text-[10px] tabular-nums"
                    />
                    <span>dB</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] text-muted">S2 Frontal (+d/2)</span>
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'SET_PARAMETER', payload: { name: 'polarityFront', value: state.polarityFront === 1 ? -1 : 1 } })}
                  className={`px-2 py-1.5 rounded-xl text-[10.5px] font-medium transition-all ${
                    state.polarityFront === -1
                      ? 'bg-warm/20 text-warm border border-warm/30'
                      : 'bg-[#7C3AED]/20 text-purple-dark dark:text-purple-light border border-[#7C3AED]/40'
                  }`}
                >
                  {state.polarityFront === -1 ? '−180° Invertida' : '0° En fase'}
                </button>
                <div className="flex items-center justify-between text-[10px] text-muted pt-0.5">
                  <span>Ganancia</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number" min="-12" max="0" step="0.5" value={state.gainFrontDB}
                      onChange={(e) => dispatch({ type: 'SET_PARAMETER', payload: { name: 'gainFrontDB', value: Number(e.target.value) || 0 } })}
                      className="w-11 rounded-lg sim-card px-1.5 py-0.5 text-right text-text text-[10px] tabular-nums"
                    />
                    <span>dB</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="h-px bg-border" />

            {/* Medio físico */}
            {[
              { label: 'Temperatura', name: 'temperature', min: 0, max: 40, step: 1, unit: '°C', sub: `c = ${nf2.format(derived.c)} m/s` },
              { label: 'Distancia ref. R', name: 'referenceDistance', min: 5, max: 50, step: 1, unit: 'm' },
              { label: 'Alcance mapa ±L', name: 'mapSpan', min: 4, max: 30, step: 1, unit: 'm' },
            ].map(({ label, name, min, max, step, unit, sub }) => (
              <div key={name} className="flex justify-between items-center text-[11px]">
                <div>
                  <span className="text-muted">{label}</span>
                  {sub && <span className="block text-[9.5px] text-muted tabular-nums opacity-70">{sub}</span>}
                </div>
                <div className="flex items-center gap-1">
                  <input
                    type="number" min={min} max={max} step={step}
                    value={state[name]}
                    onChange={(e) => dispatch({ type: 'SET_PARAMETER', payload: { name, value: Number(e.target.value) || min } })}
                    className="w-14 rounded-xl sim-card px-2 py-0.5 text-right text-text text-[11px] tabular-nums"
                  />
                  <span className="text-muted text-[10px] w-4">{unit}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});
