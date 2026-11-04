import React from 'react';
import { useArrayState, useArrayDispatch } from '../state/arrayState.js';
import {
  Sun, Moon, BookOpen, Download, SplitSquareVertical,
  Compass, Map, Columns, Maximize2, Minimize2, Waves, Activity,
  ArrowLeft
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

  const viewModes = [
    { id: 'map2d', label: 'Campo 2D', icon: Map },
    { id: 'polar', label: 'Polar', icon: Compass },
    { id: 'dual', label: 'Dual', icon: Columns },
    { id: 'contours', label: 'Isolíneas', icon: Waves },
  ];

  const isFullscreen = state.layoutMode === 'fullscreen';

  return (
    <nav className="landing-glass rounded-full pl-2.5 pr-2 py-1.5 flex items-center gap-2 animate-fade-in select-none">
      {/* Botón Ir a Inicio / Landing */}
      <button
        type="button"
        onClick={goToLanding}
        className="flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-full text-text hover:bg-black/5 dark:hover:bg-white/10 transition-colors group"
        title="Volver a la portada (Contexto y Objetivos)"
      >
        <ArrowLeft className="h-3.5 w-3.5 text-muted group-hover:text-text group-hover:-translate-x-0.5 transition-all" />
        <img
          src={state.theme === 'dark' ? '/logo-dark.png' : '/favicon.png'}
          alt="BONAIS Logo"
          className="h-6 w-6 rounded-full object-contain"
        />
        <span className="text-[14px] font-semibold tracking-tight text-text">BONAIS</span>
      </button>

      <div className="w-px h-4 bg-border" />

      {/* Presets de arreglo — píldora segmentada */}
      <div className="flex items-center gap-0.5 rounded-full p-0.5 bg-black/[0.04] dark:bg-white/[0.05]">
        {[
          { id: 'cardioid', label: 'Cardioide' },
          { id: 'in_phase', label: 'En fase' },
          { id: 'custom', label: 'Manual' },
        ].map((p) => {
          const active = state.preset === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => handlePreset(p.id)}
              className={`rounded-full px-3 py-1 text-[12px] transition-all ${
                active
                  ? 'bg-[#7C3AED] text-white font-medium shadow-[0_2px_12px_rgba(124,58,237,0.45)]'
                  : 'text-muted hover:text-text'
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      <div className="w-px h-4 bg-border" />

      {/* Selector de vista */}
      <div className="flex items-center gap-0.5 rounded-full p-0.5 bg-black/[0.04] dark:bg-white/[0.05]">
        {viewModes.map((v) => {
          const Icon = v.icon;
          const isActive = state.viewMode === v.id;
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => dispatch({ type: 'SET_VIEW_MODE', payload: v.id })}
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] transition-all ${
                isActive
                  ? 'bg-white text-[#0B0712] dark:bg-white dark:text-[#0B0712] font-medium shadow-sm'
                  : 'text-muted hover:text-text'
              }`}
              title={`Vista: ${v.label}`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{v.label}</span>
            </button>
          );
        })}
      </div>

      <div className="w-px h-4 bg-border" />

      {/* Gráficas de análisis técnico (drawer inferior) */}
      {setPanelOpen && (
        <button
          type="button"
          onClick={() => setPanelOpen(!panelOpen)}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] transition-colors ${
            panelOpen
              ? 'bg-[#7C3AED]/20 text-purple-dark dark:text-purple-light font-medium border border-[#7C3AED]/40'
              : 'text-muted hover:text-text hover:bg-black/5 dark:hover:bg-white/10'
          }`}
          title="Gráficas de Análisis (Cálculo, Optimización, Sensibilidad, Frecuencia)"
        >
          <Activity className="h-3.5 w-3.5" />
          <span className="hidden md:inline">Gráficas</span>
        </button>
      )}

      {/* Acciones circulares limpias */}
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={() =>
            dispatch({
              type: 'SET_LAYOUT_MODE',
              payload: isFullscreen ? 'studio' : 'fullscreen',
            })
          }
          className={`h-8 w-8 grid place-items-center rounded-full transition-colors ${
            isFullscreen
              ? 'bg-[#7C3AED]/20 text-purple-dark dark:text-purple-light'
              : 'text-muted hover:text-text hover:bg-black/5 dark:hover:bg-white/10'
          }`}
          title={isFullscreen ? 'Salir de pantalla completa (mostrar paneles)' : 'Modo lienzo inmersivo (ocultar paneles laterales)'}
        >
          {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
        </button>

        <button
          type="button"
          onClick={() => dispatch({ type: 'SET_COMPARE_MODE', payload: !state.compareMode })}
          className={`h-8 w-8 grid place-items-center rounded-full transition-colors ${
            state.compareMode
              ? 'bg-warm/20 text-warm'
              : 'text-muted hover:text-text hover:bg-black/5 dark:hover:bg-white/10'
          }`}
          title="Comparar arreglos"
        >
          <SplitSquareVertical className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onClick={() => dispatch({ type: 'SET_MODAL', payload: { modal: 'showTheoryModal', open: true } })}
          className="h-8 w-8 grid place-items-center rounded-full text-muted hover:text-text hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
          title="Marco teórico del proyecto"
        >
          <BookOpen className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onClick={() => dispatch({ type: 'SET_MODAL', payload: { modal: 'showExportModal', open: true } })}
          className="h-8 w-8 grid place-items-center rounded-full text-muted hover:text-text hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
          title="Exportar informe"
        >
          <Download className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onClick={toggleTheme}
          className="h-8 w-8 grid place-items-center rounded-full text-muted hover:text-text hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
          title="Cambiar tema claro / oscuro"
        >
          {state.theme === 'dark' ? (
            <Sun className="h-3.5 w-3.5" />
          ) : (
            <Moon className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
    </nav>
  );
});
