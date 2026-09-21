import React from 'react';
import { useArray } from '../state/arrayState.js';
import { Sun, Moon, BookOpen, Download, SplitSquareVertical, Radio } from 'lucide-react';

export default function Header() {
  const { state, dispatch } = useArray();

  const handlePreset = (presetType) => {
    dispatch({ type: 'APPLY_PRESET', payload: presetType });
  };

  const toggleTheme = () => {
    dispatch({
      type: 'SET_THEME',
      payload: state.theme === 'dark' ? 'light' : 'dark',
    });
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-surface/90 backdrop-blur-md px-4 py-2.5 sm:px-8">
      <div className="flex flex-wrap items-center justify-between gap-4 max-w-[1600px] mx-auto">
        {/* Marca y Subtítulo Minimalista */}
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple text-white font-bold text-sm shadow-sm">
            B
          </div>
          <div className="flex items-center gap-2.5">
            <span className="text-base font-bold tracking-tight text-text">BONAIS</span>
            <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-purple-light/70 dark:bg-purple-dark/30 px-2.5 py-0.5 text-[11px] font-medium text-purple dark:text-purple-300">
              <Radio className="h-3 w-3" /> Arreglos Cardioides
            </span>
          </div>
        </div>

        {/* Selector de Presets tipo Segmented Control (Apple style) */}
        <div className="inline-flex items-center rounded-full border border-border bg-surface-2 p-0.5 text-xs">
          <button
            type="button"
            onClick={() => handlePreset('cardioid')}
            className={`rounded-full px-3.5 py-1 font-medium transition-all ${
              state.preset === 'cardioid'
                ? 'bg-purple text-white shadow-sm font-semibold'
                : 'text-muted hover:text-text'
            }`}
          >
            Cardioide λ/4
          </button>
          <button
            type="button"
            onClick={() => handlePreset('in_phase')}
            className={`rounded-full px-3.5 py-1 font-medium transition-all ${
              state.preset === 'in_phase'
                ? 'bg-purple text-white shadow-sm font-semibold'
                : 'text-muted hover:text-text'
            }`}
          >
            En fase
          </button>
          <button
            type="button"
            onClick={() => handlePreset('custom')}
            className={`rounded-full px-3.5 py-1 font-medium transition-all ${
              state.preset === 'custom'
                ? 'bg-purple text-white shadow-sm font-semibold'
                : 'text-muted hover:text-text'
            }`}
          >
            Personalizado
          </button>
        </div>

        {/* Acciones principales */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => dispatch({ type: 'SET_COMPARE_MODE', payload: !state.compareMode })}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors border ${
              state.compareMode
                ? 'border-red bg-red text-white'
                : 'border-border bg-surface hover:bg-surface-2 text-text'
            }`}
          >
            <SplitSquareVertical className="h-3.5 w-3.5" />
            <span>Comparar</span>
          </button>

          <button
            type="button"
            onClick={() => dispatch({ type: 'SET_MODAL', payload: { modal: 'showExportModal', open: true } })}
            className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text hover:bg-surface-2 transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Exportar</span>
          </button>

          <button
            type="button"
            onClick={() => dispatch({ type: 'SET_MODAL', payload: { modal: 'showTheoryModal', open: true } })}
            className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text hover:bg-surface-2 transition-colors"
          >
            <BookOpen className="h-3.5 w-3.5" />
            <span>Teoría</span>
          </button>

          <button
            type="button"
            onClick={toggleTheme}
            className="rounded-full border border-border bg-surface p-1.5 text-muted hover:text-text hover:bg-surface-2 transition-colors ml-1"
            aria-label="Conmutar tema claro/oscuro"
          >
            {state.theme === 'dark' ? (
              <Sun className="h-4 w-4 text-purple-light" />
            ) : (
              <Moon className="h-4 w-4 text-purple" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
