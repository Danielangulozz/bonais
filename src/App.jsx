import React, { useState } from 'react';
import { ArrayProvider, useArrayState, useArrayDispatch } from './state/arrayState.js';
import LandingPage from './components/LandingPage.jsx';
import Header from './components/Header.jsx';
import ControlPanel from './components/ControlPanel.jsx';
import FieldMap from './components/FieldMap.jsx';
import PolarPlot from './components/PolarPlot.jsx';
import CalculusPanel from './components/panels/CalculusPanel.jsx';
import OptimizationPanel from './components/panels/OptimizationPanel.jsx';
import SensitivityPanel from './components/panels/SensitivityPanel.jsx';
import FrequencyPanel from './components/panels/FrequencyPanel.jsx';
import TheoryPanel from './components/panels/TheoryPanel.jsx';
import TheoryModal from './components/TheoryModal.jsx';
import CompareModal from './components/CompareModal.jsx';
import ExportModal from './components/ExportModal.jsx';
import ExperimentLabModal from './components/ExperimentLabModal.jsx';
import LiveModelPanel from './components/LiveModelPanel.jsx';
import { Calculator, Sparkles, Activity, Radio, BookOpen, ChevronDown } from 'lucide-react';

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
      {/* ═══ TOP FLOATING PILL NAV (Idéntica estética a la Landing) ═══ */}
      <header className="px-3 pt-3 pb-1.5 flex-shrink-0 flex justify-center z-30">
        <Header panelOpen={panelOpen} setPanelOpen={setPanelOpen} />
      </header>

      {/* ═══ MAIN WORKSPACE (STARLINK / TESLA 3-COLUMN HUD) ═══ */}
      <div className="flex-1 flex overflow-hidden px-3 pb-3 pt-1 gap-3 relative min-h-0">
        {/* LEFT COLUMN: Parámetros del Arreglo */}
        {!isFullscreen && (
          <aside className="w-[272px] xl:w-[288px] h-full flex-shrink-0 flex flex-col sim-panel rounded-3xl overflow-hidden animate-fade-in">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between flex-shrink-0">
              <span className="text-[12px] font-medium tracking-tight text-text">Parámetros del arreglo</span>
              <span className="text-[10px] text-muted uppercase tracking-wider">{state.preset === 'cardioid' ? 'Cardioide' : state.preset === 'in_phase' ? 'En fase' : 'Manual'}</span>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-4">
              <ControlPanel />
            </div>
            <div className="px-4 py-2.5 border-t border-border text-[10px] text-muted flex items-center justify-between flex-shrink-0">
              <span>C. Ochoa · D. Angulo · J. Gómez</span>
              <span className="opacity-60">Cálculo III</span>
            </div>
          </aside>
        )}

        {/* CENTER COLUMN: Full-bleed Acoustic Canvas */}
        <main className="flex-1 flex flex-col rounded-3xl border border-border shadow-2xl overflow-hidden relative min-w-0 bg-white dark:bg-black">
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

          {/* Expandable Technical Charts Drawer */}
          {panelOpen && (
            <div className="absolute bottom-3 inset-x-3 z-30 sim-panel rounded-3xl animate-slide-up flex flex-col overflow-hidden" style={{ maxHeight: '48%' }}>
              <div className="flex items-center justify-between px-4 py-2 border-b border-border flex-shrink-0">
                <div className="flex items-center gap-1 overflow-x-auto">
                  {tabs.map((t) => {
                    const Icon = t.icon;
                    const isActive = state.activeTab === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => dispatch({ type: 'SET_ACTIVE_TAB', payload: t.id })}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] whitespace-nowrap transition-all ${
                          isActive
                            ? 'bg-white text-[#0B0712] font-medium shadow-sm'
                            : 'text-muted hover:text-text'
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
                  className="h-7 w-7 grid place-items-center text-muted hover:text-text rounded-full hover:bg-white/10 transition-colors"
                >
                  <ChevronDown className="h-4 w-4" />
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

        {/* RIGHT COLUMN: Telemetría y Modelo Matemático Unificado */}
        {!isFullscreen && (
          <aside className="w-[360px] xl:w-[410px] h-full flex-shrink-0 flex flex-col sim-panel rounded-3xl overflow-hidden animate-fade-in">
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
              <LiveModelPanel />
            </div>
          </aside>
        )}
      </div>

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
