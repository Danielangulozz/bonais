import React, { useState, useRef, useCallback } from 'react';
import { useArrayState, useArrayDispatch, useArrayDerived } from '../state/arrayState.js';
import { ChevronDown, ChevronUp, Wand2, RefreshCw, Settings2 } from 'lucide-react';
import { optimizeBandMinMax } from '../core/optimize.js';

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

  return (
    <div className="flex flex-col gap-3 text-xs select-none">
      {/* ═══ Frecuencia ═══ */}
      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between items-center">
          <span className="text-[11px] text-muted font-medium">Frecuencia</span>
          <div className="flex items-center gap-1">
            <input
              type="number"
              min="20"
              max="200"
              step="1"
              value={state.frequency}
              onChange={(e) => handleFrequencyInput(e.target.value)}
              className="w-14 rounded-lg bg-surface-2 border border-border px-1.5 py-0.5 text-right font-semibold text-text text-[11px] focus:border-purple/50 focus:outline-none transition-colors"
            />
            <span className="text-[9px] text-muted font-mono">Hz</span>
          </div>
        </div>
        <input
          type="range" min="20" max="200" step="1"
          value={state.frequency}
          onChange={(e) => handleFrequencySlider(e.target.value)}
          className="slider-custom"
        />
      </div>

      {/* ═══ Separación ═══ */}
      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between items-center">
          <span className="text-[11px] text-muted font-medium">Separación d</span>
          <div className="flex items-center gap-1">
            <input
              type="number"
              min="0.10" max="4.00" step="0.01"
              value={Math.round(state.separation * 100) / 100}
              onChange={(e) => handleSeparationInput(e.target.value)}
              className="w-14 rounded-lg bg-surface-2 border border-border px-1.5 py-0.5 text-right font-semibold text-text text-[11px] focus:border-purple/50 focus:outline-none transition-colors"
            />
            <span className="text-[9px] text-muted font-mono">m</span>
          </div>
        </div>
        <input
          type="range" min="0.10" max="4.00" step="0.01"
          value={state.separation}
          onChange={(e) => handleSeparationSlider(e.target.value)}
          className="slider-custom"
        />
        <div className="flex items-center justify-between text-[9px] text-muted">
          <span className="font-mono opacity-60">λ/4 = {nf2.format(derived.wavelength / 4)}m</span>
          <button
            type="button"
            onClick={() => dispatch({ type: 'SET_LAMBDA_FOURTH' })}
            className="text-purple-dark dark:text-purple-light hover:underline font-medium transition-colors"
          >
            = λ/4
          </button>
        </div>
      </div>

      {/* ═══ Retardo ═══ */}
      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between items-center">
          <span className="text-[11px] text-muted font-medium">Retardo τ</span>
          <div className="flex items-center gap-1">
            <input
              type="number"
              min="0" max="25" step="0.05"
              value={Math.round(state.delayRear * 100000) / 100}
              onChange={(e) => handleDelayInput(e.target.value)}
              className="w-14 rounded-lg bg-surface-2 border border-border px-1.5 py-0.5 text-right font-semibold text-text text-[11px] focus:border-purple/50 focus:outline-none transition-colors"
            />
            <span className="text-[9px] text-muted font-mono">ms</span>
          </div>
        </div>
        <input
          type="range" min="0" max="20" step="0.05"
          value={state.delayRear * 1000}
          onChange={(e) => handleDelaySlider(e.target.value)}
          className="slider-custom"
        />
        <label className="flex items-center gap-1.5 cursor-pointer text-[10px]">
          <input
            type="checkbox"
            checked={state.autoDelay}
            onChange={(e) => dispatch({ type: 'SET_AUTO_DELAY', payload: e.target.checked })}
            className="rounded accent-purple w-3 h-3"
          />
          <span className="text-muted">Auto τ = d/c</span>
          <span className="ml-auto font-mono text-muted opacity-70">{nf2.format(derived.idealTau * 1000)}ms</span>
        </label>
      </div>

      {/* ═══ Separador sutil ═══ */}
      <div className="h-px bg-border" />

      {/* ═══ Asistente de Banda ═══ */}
      <button
        type="button"
        onClick={() => setShowBandAssistant(!showBandAssistant)}
        className="flex items-center justify-between py-1 text-[11px] font-medium text-muted hover:text-text transition-colors"
      >
        <div className="flex items-center gap-1.5">
          <Wand2 className="h-3 w-3 text-purple" />
          <span>Asistente de Banda</span>
        </div>
        {showBandAssistant ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>

      {showBandAssistant && (
        <div className="flex flex-col gap-2 animate-fade-in">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[9px] text-muted block mb-0.5">f₁ min</label>
              <input
                type="number" min="20" max="150" value={state.bandF1}
                onChange={(e) => dispatch({ type: 'SET_PARAMETER', payload: { name: 'bandF1', value: Number(e.target.value) || 20 } })}
                className="w-full rounded-lg bg-surface-2 border border-border px-2 py-1 text-text text-[11px] focus:border-purple/50 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[9px] text-muted block mb-0.5">f₂ max</label>
              <input
                type="number" min="40" max="200" value={state.bandF2}
                onChange={(e) => dispatch({ type: 'SET_PARAMETER', payload: { name: 'bandF2', value: Number(e.target.value) || 100 } })}
                className="w-full rounded-lg bg-surface-2 border border-border px-2 py-1 text-text text-[11px] focus:border-purple/50 focus:outline-none"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={applyBandAssistant}
            className="flex items-center justify-center gap-1 w-full rounded-xl bg-purple/15 dark:bg-purple/25 text-purple-dark dark:text-purple-light py-1.5 text-[11px] font-semibold border border-purple/30 hover:bg-purple/25 transition-colors"
          >
            <RefreshCw className="h-3 w-3" />
            Aplicar d*
          </button>
        </div>
      )}

      {/* ═══ Avanzados ═══ */}
      <button
        type="button"
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="flex items-center justify-between py-1 text-[11px] font-medium text-muted hover:text-text transition-colors"
      >
        <div className="flex items-center gap-1.5">
          <Settings2 className="h-3 w-3" />
          <span>Avanzados</span>
        </div>
        {showAdvanced ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>

      {showAdvanced && (
        <div className="flex flex-col gap-3 animate-fade-in">
          {/* Polaridades */}
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-muted font-medium">Trasera (S1)</span>
                <span className="text-[8px] text-muted font-mono">{state.polarityRear === -1 ? 'Cardioide' : 'Directa'}</span>
              </div>
              <button
                type="button"
                onClick={() => dispatch({ type: 'SET_PARAMETER', payload: { name: 'polarityRear', value: state.polarityRear === 1 ? -1 : 1 } })}
                className={`px-2 py-1.5 rounded-lg text-[10px] font-semibold transition-all ${
                  state.polarityRear === -1
                    ? 'bg-purple/15 dark:bg-purple/25 text-purple-dark dark:text-purple-light border border-purple/30'
                    : 'bg-warm/20 text-warm border border-warm/30'
                }`}
                title="En arreglo cardioide la trasera debe estar invertida (−180°)"
              >
                {state.polarityRear === -1 ? '−180° Invertida' : '0° Normal'}
              </button>
              <div className="flex items-center gap-1 text-[9px] text-muted">
                <span>G:</span>
                <input
                  type="number" min="-12" max="0" step="0.5" value={state.gainRearDB}
                  onChange={(e) => dispatch({ type: 'SET_PARAMETER', payload: { name: 'gainRearDB', value: Number(e.target.value) || 0 } })}
                  className="w-12 rounded bg-surface-2 border border-border px-1 text-right text-text text-[9px]"
                />
                <span>dB</span>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-muted font-medium">Frontal (S2)</span>
                <span className="text-[8px] text-muted font-mono">Público</span>
              </div>
              <button
                type="button"
                onClick={() => dispatch({ type: 'SET_PARAMETER', payload: { name: 'polarityFront', value: state.polarityFront === 1 ? -1 : 1 } })}
                className={`px-2 py-1.5 rounded-lg text-[10px] font-semibold transition-all ${
                  state.polarityFront === -1 ? 'bg-warm/20 text-warm border border-warm/30' : 'bg-purple/15 dark:bg-purple/25 text-purple-dark dark:text-purple-light border border-purple/30'
                }`}
              >
                {state.polarityFront === -1 ? '−180° Invertida' : '0° Normal'}
              </button>
              <div className="flex items-center gap-1 text-[9px] text-muted">
                <span>G:</span>
                <input
                  type="number" min="-12" max="0" step="0.5" value={state.gainFrontDB}
                  onChange={(e) => dispatch({ type: 'SET_PARAMETER', payload: { name: 'gainFrontDB', value: Number(e.target.value) || 0 } })}
                  className="w-12 rounded bg-surface-2 border border-border px-1 text-right text-text text-[9px]"
                />
                <span>dB</span>
              </div>
            </div>

            {state.polarityRear === 1 && state.delayRear > 0 && (
              <div className="col-span-2 text-[9px] text-warm bg-warm/10 border border-warm/25 rounded-lg p-1.5 leading-tight">
                ⚠️ Con trasera en <strong>0° Normal</strong> y retardo activo, la cancelación ocurre hacia el frente (público) y emite hacia el escenario (−180°). Usa <strong>−180° Invertida</strong> para cardioide hacia el público.
              </div>
            )}
          </div>

          {/* Temp, R, Map */}
          {[
            { label: 'Temp.', name: 'temperature', min: 0, max: 40, step: 1, unit: '°C', sub: `c=${nf2.format(derived.c)}m/s` },
            { label: 'Dist. R', name: 'referenceDistance', min: 5, max: 50, step: 1, unit: 'm' },
            { label: 'Mapa ±L', name: 'mapSpan', min: 4, max: 30, step: 1, unit: 'm' },
          ].map(({ label, name, min, max, step, unit, sub }) => (
            <div key={name} className="flex justify-between items-center text-[10px]">
              <div>
                <span className="text-muted font-medium">{label}</span>
                {sub && <span className="block text-[8px] text-muted font-mono opacity-50">{sub}</span>}
              </div>
              <div className="flex items-center gap-1">
                <input
                  type="number" min={min} max={max} step={step}
                  value={state[name]}
                  onChange={(e) => dispatch({ type: 'SET_PARAMETER', payload: { name, value: Number(e.target.value) || min } })}
                  className="w-12 rounded-lg bg-surface-2 border border-border px-1 text-right text-text text-[10px]"
                />
                <span className="text-muted text-[9px]">{unit}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});
