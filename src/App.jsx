import React from 'react';
import { ArrayProvider, useArray } from './state/arrayState.js';
import Header from './components/Header.jsx';
import ControlPanel from './components/ControlPanel.jsx';
import FieldMap from './components/FieldMap.jsx';
import ResultCards from './components/ResultCards.jsx';
import CalculusPanel from './components/panels/CalculusPanel.jsx';
import OptimizationPanel from './components/panels/OptimizationPanel.jsx';
import SensitivityPanel from './components/panels/SensitivityPanel.jsx';
import FrequencyPanel from './components/panels/FrequencyPanel.jsx';
import TheoryPanel from './components/panels/TheoryPanel.jsx';
import TheoryModal from './components/TheoryModal.jsx';
import CompareModal from './components/CompareModal.jsx';
import ExportModal from './components/ExportModal.jsx';
import { Calculator, Sparkles, Activity, Radio, BookOpen } from 'lucide-react';

function MainLayout() {
  const { state, dispatch, derived } = useArray();

  const tabs = [
    { id: 'calculus', label: 'Cálculo Multivariable', icon: Calculator },
    { id: 'optimization', label: 'Optimización', icon: Sparkles },
    { id: 'sensitivity', label: 'Sensibilidad', icon: Activity },
    { id: 'frequency', label: 'Frecuencia & Polar', icon: Radio },
    { id: 'theory', label: 'Teoría & Fórmulas', icon: BookOpen },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-bg text-text transition-colors">
      {/* Encabezado fijo minimalista */}
      <Header />

      {/* Contenido principal con diseño espacioso tipo Apple */}
      <main className="flex-1 flex flex-col gap-6 p-4 sm:p-6 lg:p-8 max-w-[1600px] w-full mx-auto">
        <div className="flex flex-col lg:flex-row gap-5 items-start">
          {/* Columna Izquierda: Panel de Controles */}
          <ControlPanel />

          {/* Columna Central: Mapa Principal (Protagonista visual) */}
          <FieldMap />

          {/* Columna Derecha: Tarjetas de Rendimiento */}
          <ResultCards />
        </div>

        {/* Sección Inferior de Pestañas Técnicas */}
        <div className="flex flex-col gap-4">
          {/* Barra de pestañas tipo Segmented Control de Apple */}
          <div className="flex justify-center sm:justify-start">
            <div className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-2 p-1 text-xs overflow-x-auto max-w-full shadow-sm">
              {tabs.map((t) => {
                const Icon = t.icon;
                const isActive = state.activeTab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => dispatch({ type: 'SET_ACTIVE_TAB', payload: t.id })}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full font-medium whitespace-nowrap transition-all ${isActive
                        ? 'bg-purple text-white shadow font-semibold'
                        : 'text-muted hover:text-text hover:bg-surface/80'
                      }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Contenedor del panel activo */}
          <div className="border border-border rounded-2xl bg-surface p-5 sm:p-7 shadow-sm">
            {state.activeTab === 'calculus' && <CalculusPanel />}
            {state.activeTab === 'optimization' && <OptimizationPanel />}
            {state.activeTab === 'sensitivity' && <SensitivityPanel />}
            {state.activeTab === 'frequency' && <FrequencyPanel />}
            {state.activeTab === 'theory' && <TheoryPanel />}
          </div>
        </div>
      </main>

      {/* Pie de página minimalista */}
      <footer className="border-t border-border/80 bg-surface px-6 py-4 text-center text-xs text-muted">
        <p>
          BONAIS — Simulador Educativo de Arreglos Cardioides de Subwoofers | Cielo Ochoa - Daniel Angulo Ingenieros de sonido |
        </p>
      </footer>

      {/* Modales flotantes */}
      <TheoryModal />
      <CompareModal />
      <ExportModal />

      {/* CONTENIDO PARA IMPRESIÓN EXCLUSIVA DE REPORTE */}
      <div className="hidden print-only p-8 text-black bg-white">
        <h1 className="text-2xl font-bold mb-2">BONAIS — Informe de Diseño Acústico de Arreglo Cardioide</h1>
        <p className="text-xs text-gray-600 mb-6">Fecha de generación: {new Date().toLocaleString('es-CO')}</p>

        <h2 className="text-lg font-bold border-b pb-1 mb-2">1. Configuración de Parámetros</h2>
        <ul className="text-xs mb-4 grid grid-cols-2 gap-2">
          <li>Frecuencia: <strong>{state.frequency} Hz</strong></li>
          <li>Separación física d: <strong>{state.separation.toFixed(3)} m</strong></li>
          <li>Retardo fuente trasera τ: <strong>{(state.delayRear * 1000).toFixed(2)} ms</strong></li>
          <li>Velocidad del sonido c: <strong>{derived.c.toFixed(1)} m/s</strong> (T={state.temperature}°C)</li>
          <li>Longitud de onda λ: <strong>{derived.wavelength.toFixed(3)} m</strong></li>
          <li>Relación d/λ: <strong>{derived.dOverLambda.toFixed(3)}</strong></li>
        </ul>

        <h2 className="text-lg font-bold border-b pb-1 mb-2">2. Resultados Acústicos</h2>
        <ul className="text-xs mb-6 grid grid-cols-2 gap-2">
          <li>Atenuación frente/atrás A_R ({state.referenceDistance}m): <strong>{derived.metrics.current.arDB.toFixed(1)} dB</strong></li>
          <li>Atenuación campo lejano A_ff: <strong>{derived.metrics.current.isIdealInfinite ? '>60 dB (ideal)' : `${derived.metrics.current.affDB.toFixed(1)} dB`}</strong></li>
          <li>Nivel frontal G_front: <strong>{derived.metrics.current.gFrontDB.toFixed(1)} dB</strong></li>
          <li>Cociente público/escenario Q_PE: <strong>{derived.metrics.current.qpeDB.toFixed(1)} dB</strong></li>
        </ul>

        <h2 className="text-lg font-bold border-b pb-1 mb-2">3. Consideraciones Físicas y Limitaciones</h2>
        <p className="text-xs text-gray-700 leading-relaxed">
          Cálculo efectuado bajo aproximación en campo libre ideal. En aplicaciones reales en recintos o tarimas, las reflexiones del suelo, carga acústica bajo escenario y difracción de la caja reducen la atenuación práctica trasera a un rango típico de 12 a 18 dB.
        </p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ArrayProvider>
      <MainLayout />
    </ArrayProvider>
  );
}
