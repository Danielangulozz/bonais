import React, { useState } from 'react';
import { useArrayState, useArrayDispatch } from '../state/arrayState.js';
import { SlidersHorizontal } from 'lucide-react';

const VENUES = [
  { id: 'sala', label: 'Sala' },
  { id: 'concierto', label: 'Concierto' },
  { id: 'festival', label: 'Festival' },
];

/** Convierte una región rectangular en dimensiones legibles: distancia al arreglo, profundidad y ancho. */
function toDims(region, isAudience) {
  return {
    gap: isAudience ? region.xMin : -region.xMax,
    depth: region.xMax - region.xMin,
    width: region.yMax - region.yMin,
  };
}

function Field({ label, value, onChange, min, max, step }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] text-muted">{label}</span>
      <span className="flex items-center rounded-xl sim-card focus-within:border-purple/50 transition-colors">
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={Math.round(value * 10) / 10}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            if (Number.isFinite(v)) onChange(v);
          }}
          className="w-full min-w-0 bg-transparent px-2 py-1 text-right font-medium tabular-nums text-text text-[11px] focus:outline-none"
        />
        <span className="pr-2 text-[9px] text-muted">m</span>
      </span>
    </label>
  );
}

function RegionRow({ name, title, tone, isAudience, expanded }) {
  const state = useArrayState();
  const dispatch = useArrayDispatch();
  const dims = toDims(state[name], isAudience);
  const area = dims.depth * dims.width;

  const set = (patch) =>
    dispatch({ type: 'SET_REGION_DIMS', payload: { regionName: name, ...dims, ...patch } });

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-[11.5px] text-text">
          <span className={`h-2 w-2 rounded-full ${tone === 'purple' ? 'bg-[#A855F7]' : 'bg-[#F43F5E]'}`} />
          <span>{title}</span>
        </span>
        <span className="text-[11px] text-muted tabular-nums">
          {dims.depth.toFixed(0)} × {dims.width.toFixed(0)} m · <strong className="font-medium text-text">{area.toFixed(0)} m²</strong>
        </span>
      </div>
      {expanded && (
        <div className="grid grid-cols-3 gap-1.5 animate-fade-in">
          <Field label="Distancia" value={dims.gap} min={0.5} max={60} step={0.5} onChange={(v) => set({ gap: v })} />
          <Field label="Profundidad" value={dims.depth} min={1} max={120} step={0.5} onChange={(v) => set({ depth: v })} />
          <Field label="Ancho" value={dims.width} min={1} max={120} step={0.5} onChange={(v) => set({ width: v })} />
        </div>
      )}
    </div>
  );
}

/**
 * Dimensiones editables de las zonas de público y escenario.
 * Cambiar estas regiones modifica en tiempo real los dominios de integración de ∬ E dA.
 */
export default function RegionControls() {
  const state = useArrayState();
  const dispatch = useArrayDispatch();
  const [customizeDims, setCustomizeDims] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wider text-muted font-medium">Recinto (Dominios R)</span>
        <button
          type="button"
          onClick={() => setCustomizeDims((v) => !v)}
          className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] transition-colors ${
            customizeDims
              ? 'bg-purple/20 text-purple-dark dark:text-purple-light font-medium'
              : 'text-muted hover:text-text'
          }`}
          title="Personalizar dimensiones de escenario y público"
        >
          <SlidersHorizontal className="h-2.5 w-2.5" />
          <span>{customizeDims ? 'Listo' : 'Editar'}</span>
        </button>
      </div>

      {/* Selector de recinto tipo píldora */}
      <div className="grid grid-cols-3 gap-1 rounded-full p-0.5 bg-black/[0.04] dark:bg-white/[0.05] border border-border">
        {VENUES.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => dispatch({ type: 'APPLY_VENUE_PRESET', payload: v.id })}
            className={`rounded-full py-1 text-[11px] transition-all ${
              state.venue === v.id
                ? 'bg-white text-[#0B0712] font-medium shadow-sm'
                : 'text-muted hover:text-text'
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      <div className="sim-card rounded-2xl p-3 flex flex-col gap-2.5">
        <RegionRow name="audienceRegion" title="Público (+x)" tone="purple" isAudience expanded={customizeDims} />
        <div className="h-px bg-border" />
        <RegionRow name="stageRegion" title="Escenario (−x)" tone="red" isAudience={false} expanded={customizeDims} />
      </div>
    </div>
  );
}
