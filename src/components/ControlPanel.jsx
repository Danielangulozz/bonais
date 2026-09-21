import React, { useState } from 'react';
import { useArray } from '../state/arrayState.js';
import { ChevronDown, ChevronUp, AlertCircle, Wand2, RefreshCw, SlidersHorizontal } from 'lucide-react';
import { optimizeBandMinMax } from '../core/optimize.js';

export default function ControlPanel() {
  const { state, dispatch, derived } = useArray();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showBandAssistant, setShowBandAssistant] = useState(false);

  const nf2 = new Intl.NumberFormat('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const handleFrequencyChange = (val) => {
    const f = Math.max(20, Math.min(200, Number(val) || 20));
    dispatch({ type: 'SET_PARAMETER', payload: { name: 'frequency', value: f } });
  };

  const handleSeparationChange = (val) => {
    const d = Math.max(0.1, Math.min(4.0, Number(val) || 0.1));
    dispatch({ type: 'SET_PARAMETER', payload: { name: 'separation', value: d } });
  };

  const handleDelayChange = (valMs) => {
    const tauSec = Math.max(0, Math.min(0.025, (Number(valMs) || 0) / 1000));
    dispatch({ type: 'SET_PARAMETER', payload: { name: 'delayRear', value: tauSec } });
  };

  const applyBandAssistant = () => {
    const opt = optimizeBandMinMax(state.bandF1, state.bandF2, derived.c);
    dispatch({ type: 'SET_PARAMETER', payload: { name: 'separation', value: opt.dStar } });
    if (state.autoDelay) {
      dispatch({ type: 'SET_PARAMETER', payload: { name: 'delayRear', value: opt.tauStar } });
    }
  };

  const isOutOfStandardBand = state.frequency < 40 || state.frequency > 100;

  return (
    <aside className="w-full lg:w-80 flex-shrink-0 flex flex-col gap-3.5 p-4 bg-surface border border-border rounded-2xl text-xs shadow-sm">
      <div className="flex items-center justify-between border-b border-border/80 pb-2.5">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-purple" />
          <h2 className="text-sm font-semibold tracking-tight text-text">Configuración</h2>
        </div>
        <span className="text-[11px] text-muted font-medium bg-surface-2 px-2 py-0.5 rounded-full border border-border">
          2 Fuentes
        </span>
      </div>

      {/* CONTROLES BÁSICOS */}
      <div className="flex flex-col gap-3.5">
        {/* Frecuencia f */}
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between items-center">
            <label htmlFor="freq-slider" className="font-medium text-text text-[13px]">
              Frecuencia <span className="text-muted font-normal text-xs">(f)</span>
            </label>
            <div className="flex items-center gap-1">
              <input
                id="freq-num"
                type="number"
                min="20"
                max="200"
                step="1"
                value={state.frequency}
                onChange={(e) => handleFrequencyChange(e.target.value)}
                className="w-14 rounded-lg border border-border bg-surface-2 px-2 py-1 text-right font-semibold text-text focus:border-purple focus:ring-1 focus:ring-purple focus:outline-none"
              />
              <span className="text-muted font-medium text-[11px]">Hz</span>
            </div>
          </div>
          <input
            id="freq-slider"
            type="range"
            min="20"
            max="200"
            step="1"
            value={state.frequency}
            onChange={(e) => handleFrequencyChange(e.target.value)}
            className="accent-purple cursor-pointer w-full h-1.5 bg-surface-2 rounded-lg"
          />
          {isOutOfStandardBand && (
            <div className="flex items-start gap-1.5 text-[11px] text-red bg-red-light/60 dark:bg-red-900/20 p-2 rounded-lg border border-red/20">
              <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
              <span>Fuera del rango habitual de subwoofers (40–100 Hz).</span>
            </div>
          )}
        </div>

        {/* Separación física d */}
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between items-center">
            <label htmlFor="sep-slider" className="font-medium text-text text-[13px]">
              Separación <span className="text-muted font-normal text-xs">(d)</span>
            </label>
            <div className="flex items-center gap-1">
              <input
                id="sep-num"
                type="number"
                min="0.10"
                max="4.00"
                step="0.01"
                value={Math.round(state.separation * 100) / 100}
                onChange={(e) => handleSeparationChange(e.target.value)}
                className="w-14 rounded-lg border border-border bg-surface-2 px-2 py-1 text-right font-semibold text-text focus:border-purple focus:ring-1 focus:ring-purple focus:outline-none"
              />
              <span className="text-muted font-medium text-[11px]">m</span>
            </div>
          </div>
          <input
            id="sep-slider"
            type="range"
            min="0.10"
            max="4.00"
            step="0.01"
            value={state.separation}
            onChange={(e) => handleSeparationChange(e.target.value)}
            className="accent-purple cursor-pointer w-full h-1.5 bg-surface-2 rounded-lg"
          />
          <div className="flex items-center justify-between text-[11px] text-muted pt-0.5">
            <span>λ/4 = {nf2.format(derived.wavelength / 4)} m</span>
            <button
              type="button"
              onClick={() => dispatch({ type: 'SET_LAMBDA_FOURTH' })}
              className="text-purple hover:underline font-semibold"
            >
              Fijar d = λ/4
            </button>
          </div>
        </div>

        {/* Retardo fuente trasera τ */}
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between items-center">
            <label htmlFor="delay-slider" className="font-medium text-text text-[13px]">
              Retardo trasero <span className="text-muted font-normal text-xs">(τ)</span>
            </label>
            <div className="flex items-center gap-1">
              <input
                id="delay-num"
                type="number"
                min="0"
                max="25"
                step="0.05"
                value={Math.round(state.delayRear * 100000) / 100}
                onChange={(e) => handleDelayChange(e.target.value)}
                className="w-14 rounded-lg border border-border bg-surface-2 px-2 py-1 text-right font-semibold text-text focus:border-purple focus:ring-1 focus:ring-purple focus:outline-none"
              />
              <span className="text-muted font-medium text-[11px]">ms</span>
            </div>
          </div>
          <input
            id="delay-slider"
            type="range"
            min="0"
            max="20"
            step="0.05"
            value={state.delayRear * 1000}
            onChange={(e) => handleDelayChange(e.target.value)}
            className="accent-purple cursor-pointer w-full h-1.5 bg-surface-2 rounded-lg"
          />
          <div className="flex items-center justify-between mt-1 pt-1 border-t border-border/60">
            <label className="flex items-center gap-2 cursor-pointer text-[11px] text-text font-medium">
              <input
                type="checkbox"
                checked={state.autoDelay}
                onChange={(e) => dispatch({ type: 'SET_AUTO_DELAY', payload: e.target.checked })}
                className="rounded accent-purple"
              />
              <span>Automático (τ = d / c)</span>
            </label>
            <span className="text-[11px] text-muted font-mono">
              {nf2.format(derived.idealTau * 1000)} ms
            </span>
          </div>
        </div>
      </div>

      {/* ASISTENTE DE BANDA MIN-MAX */}
      <div className="border border-border rounded-xl bg-surface-2 overflow-hidden">
        <button
          type="button"
          onClick={() => setShowBandAssistant(!showBandAssistant)}
          className="w-full flex items-center justify-between p-2.5 font-medium text-text hover:bg-surface/60 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Wand2 className="h-3.5 w-3.5 text-purple" />
            <span>Asistente de Banda</span>
          </div>
          {showBandAssistant ? <ChevronUp className="h-3.5 w-3.5 text-muted" /> : <ChevronDown className="h-3.5 w-3.5 text-muted" />}
        </button>

        {showBandAssistant && (
          <div className="p-3 border-t border-border flex flex-col gap-2.5 bg-surface">
            <p className="text-[11px] text-muted leading-relaxed">
              Calcula la separación óptima d* para abarcar la banda [f1, f2] minimizando la caída en los extremos (4.9-4).
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-muted block mb-1">f1 min (Hz)</label>
                <input
                  type="number"
                  min="20"
                  max="150"
                  value={state.bandF1}
                  onChange={(e) =>
                    dispatch({
                      type: 'SET_PARAMETER',
                      payload: { name: 'bandF1', value: Number(e.target.value) || 20 },
                    })
                  }
                  className="w-full rounded-lg border border-border bg-surface-2 px-2 py-1 text-text focus:border-purple focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[11px] text-muted block mb-1">f2 max (Hz)</label>
                <input
                  type="number"
                  min="40"
                  max="200"
                  value={state.bandF2}
                  onChange={(e) =>
                    dispatch({
                      type: 'SET_PARAMETER',
                      payload: { name: 'bandF2', value: Number(e.target.value) || 100 },
                    })
                  }
                  className="w-full rounded-lg border border-border bg-surface-2 px-2 py-1 text-text focus:border-purple focus:outline-none"
                />
              </div>
            </div>
            <button
              type="button"
              onClick={applyBandAssistant}
              className="flex items-center justify-center gap-1.5 w-full rounded-lg bg-purple text-white py-1.5 font-medium hover:bg-purple-dark transition-colors shadow-sm mt-1"
            >
              <RefreshCw className="h-3 w-3" />
              <span>Aplicar d* de banda</span>
            </button>
          </div>
        )}
      </div>

      {/* AJUSTES AVANZADOS */}
      <div className="border border-border rounded-xl bg-surface-2 overflow-hidden">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full flex items-center justify-between p-2.5 font-medium text-text hover:bg-surface/60 transition-colors"
        >
          <span>Parámetros Avanzados</span>
          {showAdvanced ? <ChevronUp className="h-3.5 w-3.5 text-muted" /> : <ChevronDown className="h-3.5 w-3.5 text-muted" />}
        </button>

        {showAdvanced && (
          <div className="p-3 border-t border-border flex flex-col gap-3 bg-surface">
            {/* Polaridades y Ganancias */}
            <div className="grid grid-cols-2 gap-2 pb-2.5 border-b border-border">
              <div className="flex flex-col gap-1.5">
                <span className="font-medium text-text text-[11px]">Trasera (-d/2)</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      dispatch({
                        type: 'SET_PARAMETER',
                        payload: { name: 'polarityRear', value: state.polarityRear === 1 ? -1 : 1 },
                      })
                    }
                    className={`px-2 py-1 rounded-md text-[11px] font-bold transition-colors ${
                      state.polarityRear === -1 ? 'bg-red text-white' : 'bg-surface-2 text-text border border-border'
                    }`}
                  >
                    {state.polarityRear === -1 ? '− Invertida' : '+ Normal'}
                  </button>
                </div>
                <div className="flex items-center gap-1 text-[11px] text-muted">
                  <span>Ganancia:</span>
                  <input
                    type="number"
                    min="-12"
                    max="0"
                    step="0.5"
                    value={state.gainRearDB}
                    onChange={(e) =>
                      dispatch({
                        type: 'SET_PARAMETER',
                        payload: { name: 'gainRearDB', value: Number(e.target.value) || 0 },
                      })
                    }
                    className="w-12 rounded border border-border bg-surface-2 px-1 text-right text-text"
                  />
                  <span>dB</span>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="font-medium text-text text-[11px]">Frontal (+d/2)</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      dispatch({
                        type: 'SET_PARAMETER',
                        payload: { name: 'polarityFront', value: state.polarityFront === 1 ? -1 : 1 },
                      })
                    }
                    className={`px-2 py-1 rounded-md text-[11px] font-bold transition-colors ${
                      state.polarityFront === -1 ? 'bg-red text-white' : 'bg-purple text-white'
                    }`}
                  >
                    {state.polarityFront === -1 ? '− Invertida' : '+ Normal'}
                  </button>
                </div>
                <div className="flex items-center gap-1 text-[11px] text-muted">
                  <span>Ganancia:</span>
                  <input
                    type="number"
                    min="-12"
                    max="0"
                    step="0.5"
                    value={state.gainFrontDB}
                    onChange={(e) =>
                      dispatch({
                        type: 'SET_PARAMETER',
                        payload: { name: 'gainFrontDB', value: Number(e.target.value) || 0 },
                      })
                    }
                    className="w-12 rounded border border-border bg-surface-2 px-1 text-right text-text"
                  />
                  <span>dB</span>
                </div>
              </div>
            </div>

            {/* Temperatura y Distancia R */}
            <div className="flex justify-between items-center">
              <div>
                <span className="font-medium text-text block">Temperatura</span>
                <span className="text-[10px] text-muted font-mono">c = {nf2.format(derived.c)} m/s</span>
              </div>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="0"
                  max="40"
                  step="1"
                  value={state.temperature}
                  onChange={(e) =>
                    dispatch({
                      type: 'SET_PARAMETER',
                      payload: { name: 'temperature', value: Number(e.target.value) || 20 },
                    })
                  }
                  className="w-12 rounded-lg border border-border bg-surface-2 px-1 text-right text-text"
                />
                <span className="text-muted">°C</span>
              </div>
            </div>

            <div className="flex justify-between items-center">
              <span className="font-medium text-text">Distancia Ref. R (A_R)</span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="5"
                  max="50"
                  step="1"
                  value={state.referenceDistance}
                  onChange={(e) =>
                    dispatch({
                      type: 'SET_PARAMETER',
                      payload: { name: 'referenceDistance', value: Number(e.target.value) || 10 },
                    })
                  }
                  className="w-12 rounded-lg border border-border bg-surface-2 px-1 text-right text-text"
                />
                <span className="text-muted">m</span>
              </div>
            </div>

            <div className="flex justify-between items-center">
              <span className="font-medium text-text">Área del Mapa (±L)</span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="4"
                  max="30"
                  step="1"
                  value={state.mapSpan}
                  onChange={(e) =>
                    dispatch({
                      type: 'SET_PARAMETER',
                      payload: { name: 'mapSpan', value: Number(e.target.value) || 12 },
                    })
                  }
                  className="w-12 rounded-lg border border-border bg-surface-2 px-1 text-right text-text"
                />
                <span className="text-muted">m</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
