import React, { useState } from 'react';
import { ArrayProvider, useArrayState, useArrayDispatch } from './state/arrayState.js';
import LandingPage from './components/LandingPage.jsx';
import Header from './components/Header.jsx';
import ControlPanel from './components/ControlPanel.jsx';
import FieldMap from './components/FieldMap.jsx';
import PolarPlot from './components/PolarPlot.jsx';
import ResultCards from './components/ResultCards.jsx';
import CalculusPanel from './components/panels/CalculusPanel.jsx';
import OptimizationPanel from './components/panels/OptimizationPanel.jsx';
import SensitivityPanel from './components/panels/SensitivityPanel.jsx';
import FrequencyPanel from './components/panels/FrequencyPanel.jsx';
import TheoryPanel from './components/panels/TheoryPanel.jsx';
import TheoryModal from './components/TheoryModal.jsx';
import CompareModal from './components/CompareModal.jsx';
import ExportModal from './components/ExportModal.jsx';
import ExperimentLabModal from './components/ExperimentLabModal.jsx';
import { Calculator, Sparkles, Activity, Radio, BookOpen, ChevronDown, SlidersHorizontal, BarChart3 } from 'lucide-react';

const MemoCalculusPanel = React.memo(CalculusPanel);
const MemoOptimizationPanel = React.memo(OptimizationPanel);
const MemoSensitivityPanel = React.memo(SensitivityPanel);
const MemoFrequencyPanel = React.memo(FrequencyPanel);
const MemoTheoryPanel = React.memo(TheoryPanel);

function MainLayout() {
  const state = useArrayState();
  const dispatch = useArrayDispatch();
  const [panelOpen, setPanelOpen] = useState(false);

  const tabs = [
    { id: 'calculus', label: 'Cálculo', icon: Calculator },
    { id: 'optimization', label: 'Optimización', icon: Sparkles },
    { id: 'sensitivity', label: 'Sensibilidad', icon: Activity },
    { id: 'frequency', label: 'Frecuencia', icon: Radio },
    { id: 'theory', label: 'Teoría', icon: BookOpen },
  ];

  const isFullscreen = state.layoutMode === 'fullscreen';

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-bg text-text select-none">
      {/* ═══ TOP HEADER BAR ═══ */}
      <div className="px-3 pt-2.5 pb-1 flex-shrink-0 flex justify-center z-30">
        <Header panelOpen={panelOpen} setPanelOpen={setPanelOpen} />
      </div>

      {/* ═══ MAIN WORKSPACE (COHERENT 3-COLUMN DOCKED LAYOUT) ═══ */}
      <div className="flex-1 flex overflow-hidden px-3 pb-1 pt-1 gap-2.5 relative">
        {/* LEFT COLUMN: Controls & Acoustic Setup */}
        {!isFullscreen && (
          <aside className="w-[280px] self-start max-h-full flex-shrink-0 flex flex-col glass-strong rounded-2xl border border-border shadow-sm overflow-hidden animate-fade-in">
            <div className="px-3 py-2 border-b border-border text-[11px] font-semibold text-text flex items-center gap-1.5 flex-shrink-0">
              <SlidersHorizontal className="h-3.5 w-3.5 text-purple-dark dark:text-purple-light" />
              <span>Controles del Arreglo</span>
            </div>
            <div className="overflow-y-auto custom-scrollbar p-3">
              <ControlPanel />
            </div>
          </aside>
        )}

        {/* CENTER COLUMN: Central Viewport Workspace */}
        <main className="flex-1 flex flex-col glass-strong rounded-2xl border border-border shadow-sm overflow-hidden relative">
          {state.viewMode === 'polar' ? (
            <PolarPlot />
          ) : state.viewMode === 'dual' ? (
            <div className="w-full h-full grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-border overflow-hidden">
              <div className="h-full relative overflow-hidden">
                <FieldMap />
              </div>
              <div className="h-full relative overflow-hidden">
                <PolarPlot />
              </div>
            </div>
          ) : (
            <FieldMap />
          )}

          {/* Expandable Technical Analysis Drawer */}
          {panelOpen && (
            <div className="absolute bottom-0 inset-x-0 z-30 glass-strong border-t border-border shadow-2xl animate-slide-up flex flex-col" style={{ maxHeight: '45%' }}>
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-surface-2 flex-shrink-0">
                <div className="flex items-center gap-1 overflow-x-auto">
                  {tabs.map((t) => {
                    const Icon = t.icon;
                    const isActive = state.activeTab === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => dispatch({ type: 'SET_ACTIVE_TAB', payload: t.id })}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-medium whitespace-nowrap transition-all ${
                          isActive
                            ? 'bg-purple/15 dark:bg-purple/25 text-purple-dark dark:text-purple-light shadow-sm font-semibold border border-purple/30'
                            : 'text-muted hover:text-text hover:bg-black/5 dark:hover:bg-white/5'
                        }`}
                      >
                        <Icon className="h-3 w-3" />
                        <span>{t.label}</span>
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => setPanelOpen(false)}
                  className="p-1 text-muted hover:text-text rounded-md"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
                {state.activeTab === 'calculus' && <MemoCalculusPanel />}
                {state.activeTab === 'optimization' && <MemoOptimizationPanel />}
                {state.activeTab === 'sensitivity' && <MemoSensitivityPanel />}
                {state.activeTab === 'frequency' && <MemoFrequencyPanel />}
                {state.activeTab === 'theory' && <MemoTheoryPanel />}
              </div>
            </div>
          )}
        </main>

        {/* RIGHT COLUMN: KPI Metrics & Result Cards */}
        {!isFullscreen && (
          <aside className="w-[230px] self-start max-h-full flex-shrink-0 flex flex-col glass-strong rounded-2xl border border-border shadow-sm overflow-hidden animate-fade-in">
            <div className="px-3 py-2 border-b border-border text-[11px] font-semibold text-text flex items-center gap-1.5 flex-shrink-0">
              <BarChart3 className="h-3.5 w-3.5 text-purple-dark dark:text-purple-light" />
              <span>Resultados Acústicos</span>
            </div>
            <div className="overflow-y-auto custom-scrollbar p-3">
              <ResultCards />
            </div>
          </aside>
        )}
      </div>

      {/* ═══ FOOTER PERSISTENTE DEL SIMULADOR CON INTEGRANTES ═══ */}
      <footer className="px-4 py-1.5 border-t border-border bg-surface-2/80 flex-shrink-0 flex flex-wrap items-center justify-between text-[10px] text-muted z-20">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-text">BONAIS</span>
          <span>·</span>
          <span>Proyecto de Aula · Cálculo III (Ingeniería de Sonido)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span>Integrantes:</span>
          <strong className="text-text font-semibold">Cielo Ochoa</strong> (Autora del Logo)
          <span>—</span>
          <strong className="text-text font-semibold">Daniel Angulo</strong>
          <span>—</span>
          <strong className="text-text font-semibold">Jerónimo "Por Partes" Gómez</strong>
        </div>
      </footer>

      {/* Print content */}
      <div className="hidden print-only p-8 text-black bg-white">
        <h1 className="text-2xl font-bold mb-2">BONAIS — Informe de Diseño Acústico</h1>
        <p className="text-xs text-gray-600 mb-6">Fecha: {new Date().toLocaleString('es-CO')}</p>
        <ul className="text-xs mb-4 grid grid-cols-2 gap-2">
          <li>Frecuencia: <strong>{state.frequency} Hz</strong></li>
          <li>Separación d: <strong>{state.separation.toFixed(3)} m</strong></li>
          <li>Retardo τ: <strong>{(state.delayRear * 1000).toFixed(2)} ms</strong></li>
          <li>T: <strong>{state.temperature}°C</strong></li>
        </ul>
      </div>
    </div>
  );
}

function AppContent() {
  const state = useArrayState();

  return (
    <>
      {state.activePage === 'landing' ? <LandingPage /> : <MainLayout />}

      {/* Modales globales accesibles en cualquier vista */}
      <ExperimentLabModal />
      <TheoryModal />
      <CompareModal />
      <ExportModal />
    </>
  );
}

export default function App() {
  return (
    <ArrayProvider>
      <AppContent />
    </ArrayProvider>
  );
}
