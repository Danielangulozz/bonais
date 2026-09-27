import React from 'react';
import { useArrayState, useArrayDispatch } from '../state/arrayState.js';
import {
  Sun, Moon, BookOpen, Download, SplitSquareVertical,
  Compass, Map, Columns, Maximize2, Minimize2, Waves, Activity,
  FlaskConical, Home
} from 'lucide-react';

export default React.memo(function Header({ panelOpen, setPanelOpen }) {
  const state = useArrayState();
  const dispatch = useArrayDispatch();

  const handlePreset = (presetType) => {
    dispatch({ type: 'APPLY_PRESET', payload: presetType });
  };

  const toggleTheme = () => {
    dispatch({
      type: 'SET_THEME',
      payload: state.theme === 'dark' ? 'light' : 'dark',
    });
  };

  const goToLanding = () => {
    dispatch({ type: 'SET_ACTIVE_PAGE', payload: 'landing' });
  };

  const openExperimentLab = () => {
    dispatch({ type: 'SET_EXPERIMENT_MODAL', payload: true });
  };

  const viewModes = [
    { id: 'map2d', label: 'Mapa 2D', icon: Map },
    { id: 'polar', label: 'Polar', icon: Compass },
    { id: 'dual', label: 'Dual', icon: Columns },
    { id: 'contours', label: 'Isolíneas', icon: Waves },
  ];

  return (
    <header className="glass-strong rounded-2xl px-2.5 py-1.5 flex items-center gap-2.5 animate-fade-in select-none shadow-xl border border-border">
      {/* Botón Ir a Inicio / Landing */}
      <button
        type="button"
        onClick={goToLanding}
        className="flex items-center gap-1.5 px-2 py-1 rounded-xl text-text hover:bg-black/5 dark:hover:bg-white/5 transition-all group"
        title="Volver a la Página de Inicio (Contexto y Objetivos)"
      >
        <img
          src={state.theme === 'dark' ? '/logo-dark.png' : '/logo-light.png'}
          alt="BONAIS Logo"
          className="h-6 w-6 rounded-md object-contain group-hover:scale-105 transition-transform"
        />
        <div className="flex flex-col text-left leading-none">
          <span className="text-[13px] font-bold tracking-tight text-text">BONAIS</span>
          <span className="text-[8px] text-muted flex items-center gap-0.5">
            <Home className="h-2 w-2" /> Inicio
          </span>
        </div>
      </button>

      <div className="w-px h-5 bg-border" />

      {/* Arreglo Presets */}
      <div className="flex items-center gap-0.5 rounded-xl p-0.5" style={{ background: 'var(--surface-2)' }}>
        {[
          { id: 'cardioid', label: 'Cardioide' },
          { id: 'in_phase', label: 'En fase' },
          { id: 'custom', label: 'Custom' },
        ].map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => handlePreset(p.id)}
            className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition-all ${
              state.preset === p.id
                ? 'bg-purple/15 dark:bg-purple/25 text-purple-dark dark:text-purple-light shadow-sm font-semibold border border-purple/30'
                : 'text-muted hover:text-text'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="w-px h-5 bg-border" />

      {/* Selector de Modos de Vista / Extensiones */}
      <div className="flex items-center gap-0.5 rounded-xl p-0.5" style={{ background: 'var(--surface-2)' }}>
        {viewModes.map((v) => {
          const Icon = v.icon;
          const isActive = state.viewMode === v.id;
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => dispatch({ type: 'SET_VIEW_MODE', payload: v.id })}
              className={`flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-medium transition-all ${
                isActive
                  ? 'bg-purple/15 dark:bg-purple/25 text-purple-dark dark:text-purple-light shadow-sm font-semibold border border-purple/30'
                  : 'text-muted hover:text-text'
              }`}
              title={`Vista: ${v.label}`}
            >
              <Icon className="h-3 w-3" />
              <span>{v.label}</span>
            </button>
          );
        })}
      </div>

      <div className="w-px h-5 bg-border" />

      {/* Layout Mode (Estudio / Fullscreen) */}
      <button
        type="button"
        onClick={() =>
          dispatch({
            type: 'SET_LAYOUT_MODE',
            payload: state.layoutMode === 'studio' ? 'fullscreen' : 'studio',
          })
        }
        className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium transition-colors ${
          state.layoutMode === 'studio'
            ? 'bg-purple/15 dark:bg-purple/25 text-purple-dark dark:text-purple-light font-semibold border border-purple/30'
            : 'text-muted hover:text-text hover:bg-white/5'
        }`}
        title={state.layoutMode === 'studio' ? 'Modo Estudio (Enmarcado limpio)' : 'Modo Inmersivo (Pantalla completa)'}
      >
        {state.layoutMode === 'studio' ? (
          <>
            <Minimize2 className="h-3 w-3" />
            <span>Estudio</span>
          </>
        ) : (
          <>
            <Maximize2 className="h-3 w-3" />
            <span>Inmersivo</span>
          </>
        )}
      </button>

      {/* Laboratorio de Fórmulas en Vivo Button */}
      <button
        type="button"
        onClick={openExperimentLab}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold text-purple-dark dark:text-purple-light bg-purple/15 hover:bg-purple/25 border border-purple/30 transition-all shadow-sm"
        title="Abrir Laboratorio Experimental de Fórmulas y Verificación Numérica en Vivo"
      >
        <FlaskConical className="h-3 w-3" />
        <span className="hidden sm:inline">Fórmulas en Vivo</span>
        <span className="sm:hidden">Fórmulas</span>
      </button>

      {/* Análisis Técnico Drawer Button */}
      {setPanelOpen && (
        <button
          type="button"
          onClick={() => setPanelOpen(!panelOpen)}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium transition-colors ${
            panelOpen
              ? 'bg-purple/15 dark:bg-purple/25 text-purple-dark dark:text-purple-light font-semibold border border-purple/30'
              : 'text-muted hover:text-text hover:bg-white/5'
          }`}
          title="Panel de Análisis Técnico (Cálculo, Optimización, Sensibilidad, Frecuencia)"
        >
          <Activity className="h-3 w-3" />
          <span>Análisis</span>
          <span className="text-[9px] opacity-70">{panelOpen ? '▲' : '▼'}</span>
        </button>
      )}

      <div className="w-px h-5 bg-border" />

      {/* Actions */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => dispatch({ type: 'SET_COMPARE_MODE', payload: !state.compareMode })}
          className={`rounded-lg p-1.5 transition-colors ${
            state.compareMode
              ? 'bg-warm/20 text-warm'
              : 'text-muted hover:text-text hover:bg-white/5'
          }`}
          title="Comparar"
        >
          <SplitSquareVertical className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onClick={() => dispatch({ type: 'SET_MODAL', payload: { modal: 'showExportModal', open: true } })}
          className="rounded-lg p-1.5 text-muted hover:text-text hover:bg-white/5 transition-colors"
          title="Exportar"
        >
          <Download className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onClick={() => dispatch({ type: 'SET_MODAL', payload: { modal: 'showTheoryModal', open: true } })}
          className="rounded-lg p-1.5 text-muted hover:text-text hover:bg-white/5 transition-colors"
          title="Teoría"
        >
          <BookOpen className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onClick={toggleTheme}
          className="rounded-lg p-1.5 text-muted hover:text-text hover:bg-white/5 transition-colors"
          title="Tema"
        >
          {state.theme === 'dark' ? (
            <Sun className="h-3.5 w-3.5" />
          ) : (
            <Moon className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
    </header>
  );
});
