import React from 'react';
import { useArray } from '../state/arrayState.js';
import TheoryPanel from './panels/TheoryPanel.jsx';
import { X, BookOpen } from 'lucide-react';

export default function TheoryModal() {
  const { state, dispatch } = useArray();

  if (!state.showTheoryModal) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-6 py-4 bg-surface-2">
          <div className="flex items-center gap-2.5">
            <BookOpen className="h-4 w-4 text-purple" />
            <h2 className="text-base font-bold text-text">Fundamentos Teóricos y Matemáticos (Cálculo III)</h2>
          </div>
          <button
            type="button"
            onClick={() => dispatch({ type: 'SET_MODAL', payload: { modal: 'showTheoryModal', open: false } })}
            className="p-1.5 rounded-full text-muted hover:text-text hover:bg-surface transition-colors"
            aria-label="Cerrar modal de teoría"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          <TheoryPanel />
        </div>

        <div className="border-t border-border px-6 py-3.5 bg-surface-2 flex justify-end">
          <button
            type="button"
            onClick={() => dispatch({ type: 'SET_MODAL', payload: { modal: 'showTheoryModal', open: false } })}
            className="px-5 py-1.5 rounded-full bg-purple text-white font-medium text-xs hover:bg-purple-dark transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
