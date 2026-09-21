import React from 'react';
import { useArray } from '../state/arrayState.js';
import { calculateSensitivityTable } from '../core/sensitivity.js';
import { findCriticalPoints } from '../core/calculus/criticalPoints.js';
import { X, FileSpreadsheet, Image as ImageIcon, Printer } from 'lucide-react';

export default function ExportModal() {
  const { state, dispatch, derived } = useArray();

  if (!state.showExportModal) return null;

  const nfComma = (num, decimals = 2) => {
    if (num === null || num === undefined || isNaN(num)) return '';
    return num.toFixed(decimals).replace('.', ',');
  };

  // Generación de CSV con separador ';' y coma decimal
  const exportCSV = () => {
    const lines = [];

    // Encabezado
    lines.push('BONAIS — REPORTE DE SIMULACIÓN Y OPTIMIZACIÓN ACÚSTICA');
    lines.push(`Fecha;${new Date().toLocaleString('es-CO')}`);
    lines.push('');

    // Parámetros
    lines.push('--- PARÁMETROS DEL ARREGLO ---');
    lines.push(`Frecuencia acústica (Hz);${state.frequency}`);
    lines.push(`Separación física d (m);${nfComma(state.separation, 3)}`);
    lines.push(`Retardo trasero τ (ms);${nfComma(state.delayRear * 1000, 2)}`);
    lines.push(`Polaridad trasera;${state.polarityRear === -1 ? 'Invertida (-1)' : 'Normal (+1)'}`);
    lines.push(`Polaridad frontal;${state.polarityFront === 1 ? 'Normal (+1)' : 'Invertida (-1)'}`);
    lines.push(`Ganancia trasera (dB);${state.gainRearDB}`);
    lines.push(`Ganancia frontal (dB);${state.gainFrontDB}`);
    lines.push(`Temperatura ambiente (°C);${state.temperature}`);
    lines.push(`Velocidad del sonido c (m/s);${nfComma(derived.c, 2)}`);
    lines.push(`Longitud de onda λ (m);${nfComma(derived.wavelength, 3)}`);
    lines.push('');

    // Métricas
    lines.push('--- RESULTADOS Y MÉTRICAS ACÚSTICAS ---');
    lines.push(`Atenuación frente/atrás A_R a ${state.referenceDistance}m (dB);${nfComma(derived.metrics.current.arDB, 2)}`);
    lines.push(`Atenuación en campo lejano A_ff (dB);${derived.metrics.current.isIdealInfinite ? '>60 (ideal)' : nfComma(derived.metrics.current.affDB, 2)}`);
    lines.push(`Nivel frontal G_front (dB);${nfComma(derived.metrics.current.gFrontDB, 2)}`);
    lines.push(`Cociente de energía Público / Escenario Q_PE (dB);${nfComma(derived.metrics.current.qpeDB, 2)}`);
    lines.push('');

    // Sensibilidad
    lines.push('--- ANÁLISIS DE SENSIBILIDAD ---');
    lines.push('Desajuste retardo (ms);Error de fase (°);A_R resultante (dB);Caída en dB');
    const sens = calculateSensitivityTable({
      d: state.separation,
      tau: state.delayRear,
      frequency: state.frequency,
      speedOfSound: derived.c,
      rDistance: state.referenceDistance,
    });
    sens.tauPerturbations.forEach((p) => {
      lines.push(`${nfComma(p.deltaTauMs, 2)};${nfComma(p.phaseErrorDeg, 1)};${nfComma(p.perturbedAR, 2)};${nfComma(p.dropDB, 2)}`);
    });
    lines.push('');

    // Puntos críticos
    lines.push('--- PUNTOS CRÍTICOS IDENTIFICADOS ---');
    lines.push('x (m);y (m);Nivel (dB);Exx;Exy;Eyy;D (Hessiano);Tipo');
    const pts = findCriticalPoints({
      precomputedSources: derived.precomputedSources,
      k: derived.k,
      wavelength: derived.wavelength,
      xMin: -state.mapSpan,
      xMax: state.mapSpan,
      yMin: -state.mapSpan,
      yMax: state.mapSpan,
    });
    pts.forEach((pt) => {
      lines.push(`${nfComma(pt.x, 2)};${nfComma(pt.y, 2)};${nfComma(pt.levelDB, 1)};${nfComma(pt.Exx, 3)};${nfComma(pt.Exy, 3)};${nfComma(pt.Eyy, 3)};${nfComma(pt.D, 3)};${pt.type}`);
    });

    const csvContent = '\uFEFF' + lines.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `BONAIS_Reporte_${state.frequency}Hz_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Exportar PNG del Canvas principal
  const exportPNG = () => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `BONAIS_Mapa_${state.frequency}Hz.png`;
    link.href = dataUrl;
    link.click();
  };

  // Imprimir reporte formal
  const handlePrint = () => {
    dispatch({ type: 'SET_MODAL', payload: { modal: 'showExportModal', open: false } });
    setTimeout(() => {
      window.print();
    }, 200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="bg-surface border border-border rounded-xl w-full max-w-lg flex flex-col shadow-2xl overflow-hidden text-xs">
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5 bg-surface-2">
          <h2 className="text-base font-bold text-text">Exportar Datos y Reporte</h2>
          <button
            type="button"
            onClick={() => dispatch({ type: 'SET_MODAL', payload: { modal: 'showExportModal', open: false } })}
            className="p-1 rounded text-muted hover:text-text hover:bg-surface"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-4">
          <p className="text-muted leading-relaxed">
            Descarga los resultados técnicos del cálculo de varias variables y acústica para informes de laboratorio o presentaciones de ingeniería:
          </p>

          <div className="grid grid-cols-1 gap-3">
            {/* Opción 1: CSV para Excel */}
            <button
              type="button"
              onClick={exportCSV}
              className="flex items-center gap-3.5 p-3.5 rounded-2xl border border-border bg-surface-2 hover:border-purple/50 hover:bg-purple-light/20 transition-all text-left"
            >
              <div className="p-2.5 rounded-xl bg-purple-light/70 dark:bg-purple-dark/30 text-purple">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <strong className="block text-sm text-text font-semibold">Datos CSV (Excel en Español)</strong>
                <span className="text-[11px] text-muted">
                  Separador punto y coma (;) y coma decimal con parámetros, sensibilidad y puntos críticos.
                </span>
              </div>
            </button>

            {/* Opción 2: PNG del Mapa */}
            <button
              type="button"
              onClick={exportPNG}
              className="flex items-center gap-3.5 p-3.5 rounded-2xl border border-border bg-surface-2 hover:border-purple/50 hover:bg-purple-light/20 transition-all text-left"
            >
              <div className="p-2.5 rounded-xl bg-purple-light/70 dark:bg-purple-dark/30 text-purple">
                <ImageIcon className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <strong className="block text-sm text-text font-semibold">Captura de Mapa (Imagen PNG)</strong>
                <span className="text-[11px] text-muted">
                  Descarga el mapa de calor con curvas de nivel e indicadores a alta resolución.
                </span>
              </div>
            </button>

            {/* Opción 3: Informe Imprimible */}
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-3.5 p-3.5 rounded-2xl border border-border bg-surface-2 hover:border-red/50 hover:bg-red-light/20 transition-all text-left"
            >
              <div className="p-2.5 rounded-xl bg-red-light/70 dark:bg-red-900/30 text-red">
                <Printer className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <strong className="block text-sm text-text font-semibold">Informe Imprimible (PDF / Hoja Impresa)</strong>
                <span className="text-[11px] text-muted">
                  Formato limpio adaptado con portada, parámetros, fórmulas y advertencias físicas.
                </span>
              </div>
            </button>
          </div>
        </div>

        <div className="border-t border-border px-6 py-3.5 bg-surface-2 flex justify-end">
          <button
            type="button"
            onClick={() => dispatch({ type: 'SET_MODAL', payload: { modal: 'showExportModal', open: false } })}
            className="px-5 py-1.5 rounded-full bg-surface hover:bg-surface-2 border border-border text-text font-medium transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
