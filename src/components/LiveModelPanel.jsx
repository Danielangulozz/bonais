import React, { useMemo, useState, useDeferredValue, useRef, useEffect } from 'react';
import { useArrayState, useArrayDerived } from '../state/arrayState.js';
import { computeLiveModel } from '../core/liveModel.js';
import { MAGMA_UINT32_TABLE, getPaletteIndex } from '../render/colormap.js';
import KaTeXMath from './KaTeXMath.jsx';
import { ChevronDown, AlertTriangle } from 'lucide-react';

/* ───────── Formato numérico (coma decimal, es-CO) ───────── */
const fixed = (v, dp) => {
  const s = v.toFixed(dp);
  return Number(s) === 0 ? (0).toFixed(dp) : s; // evita "−0,00"
};
const txt = (v, dp = 2) => {
  if (v === Infinity) return '∞';
  if (!Number.isFinite(v)) return '—';
  return fixed(v, dp).replace('.', ',');
};
const sgn = (v, dp = 2) => (v >= 0 ? '+' : '') + txt(v, dp);

/* ───────── Bloques de diseño estilo Apple / Tesla / Starlink ───────── */

/** Bloque de ecuación simbólica pura — limpia, sin números largos incrustados */
function FormulaBox({ children }) {
  return (
    <div className="sim-card rounded-2xl px-3.5 py-2.5 flex flex-col gap-1.5 overflow-x-auto custom-scrollbar">
      {children}
    </div>
  );
}

function Eq({ math }) {
  return (
    <div className="live-eq overflow-x-auto overflow-y-hidden custom-scrollbar py-0.5">
      <KaTeXMath math={math} block />
    </div>
  );
}

/** Tarjeta de telemetría individual (símbolo + valor tabular en vivo + subtexto opcional) */
function MetricTile({ symbol, label, value, sub, tone }) {
  const toneClass =
    tone === 'purple' ? 'text-purple-dark dark:text-[#C084FC]'
      : tone === 'red' ? 'text-red dark:text-[#FB7185]'
        : 'text-text';
  return (
    <div className="sim-card rounded-xl px-3 py-2 flex flex-col justify-between gap-0.5">
      <div className="flex items-center justify-between gap-1.5 text-[10.5px] text-muted">
        <span className="truncate">{label}</span>
        {symbol && (
          <span className="text-text/80 flex-shrink-0 text-[11px]">
            <KaTeXMath math={symbol} />
          </span>
        )}
      </div>
      <div className={`text-[14px] font-medium tracking-tight tabular-nums leading-snug ${toneClass}`}>
        {value}
      </div>
      {sub && <div className="text-[9.5px] text-muted tabular-nums leading-tight">{sub}</div>}
    </div>
  );
}

function Section({ index, num, title, badge, open, onToggle, children }) {
  return (
    <section className="border-b border-border last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition-colors group"
      >
        <span className="text-[11px] tabular-nums text-muted w-5 flex-shrink-0 font-light">{index}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-medium text-text tracking-tight truncate">{title}</span>
            <span className="text-[10px] text-muted tabular-nums hidden sm:inline">§{num}</span>
          </div>
        </div>
        {badge && (
          <span className="rounded-full sim-card px-2.5 py-0.5 text-[10.5px] tabular-nums text-muted group-hover:text-text transition-colors flex-shrink-0">
            {badge}
          </span>
        )}
        <ChevronDown className={`h-3.5 w-3.5 text-muted transition-transform flex-shrink-0 ${open ? 'rotate-180 text-text' : ''}`} />
      </button>
      {open && (
        <div className="px-4 pb-4 pt-0.5 flex flex-col gap-2.5 animate-fade-in">
          {children}
        </div>
      )}
    </section>
  );
}

function Note({ children }) {
  return <p className="text-[11px] leading-relaxed text-muted px-0.5">{children}</p>;
}

/* Diagrama de fasores: p₁ (trasera, rojo) + p₂ (frontal, morado) = P */
function PhasorDiagram({ phasors, P }) {
  const [a, b] = phasors;
  const W = 260;
  const H = 116;
  const R = 46;
  const maxLen = Math.max(a.amp + b.amp, 1e-9);
  const s = R / maxLen;
  const ox = W / 2;
  const oy = H / 2;
  const toXY = (re, im) => [ox + re * s, oy - im * s];
  const [x1, y1] = toXY(a.re, a.im);
  const [x2, y2] = toXY(a.re + b.re, a.im + b.im);
  const [xp, yp] = toXY(P.re, P.im);

  const arrow = (xa, ya, xb, yb, color, w = 1.8) => {
    const ang = Math.atan2(yb - ya, xb - xa);
    const len = Math.hypot(xb - xa, yb - ya);
    if (len < 2) return null;
    const hx = xb - 6.5 * Math.cos(ang - 0.4);
    const hy = yb - 6.5 * Math.sin(ang - 0.4);
    const kx = xb - 6.5 * Math.cos(ang + 0.4);
    const ky = yb - 6.5 * Math.sin(ang + 0.4);
    return (
      <g>
        <line x1={xa} y1={ya} x2={xb} y2={yb} stroke={color} strokeWidth={w} strokeLinecap="round" />
        <path d={`M${xb},${yb} L${hx},${hy} L${kx},${ky} Z`} fill={color} />
      </g>
    );
  };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto rounded-2xl sim-card" role="img"
      aria-label="Diagrama de fasores: suma de la contribución de cada subwoofer en el punto inspeccionado">
      <circle cx={ox} cy={oy} r={R} fill="none" stroke="currentColor" className="text-border" strokeDasharray="2 4" />
      <line x1={ox - R - 8} y1={oy} x2={ox + R + 8} y2={oy} stroke="currentColor" className="text-border" />
      <line x1={ox} y1={oy - R - 8} x2={ox} y2={oy + R + 8} stroke="currentColor" className="text-border" />
      {arrow(ox, oy, x1, y1, '#F43F5E')}
      {arrow(x1, y1, x2, y2, '#A855F7')}
      {arrow(ox, oy, xp, yp, 'var(--text)', 2.4)}
      <text x={10} y={16} fontSize="8.5" fill="#FB7185">p₁ trasera</text>
      <text x={10} y={28} fontSize="8.5" fill="#C084FC">p₂ frontal</text>
      <text x={10} y={40} fontSize="8.5" fill="var(--text)">P = p₁ + p₂</text>
      <text x={W - 10} y={H - 8} fontSize="8" textAnchor="end" fill="var(--muted)">Plano complejo (Re, Im)</text>
    </svg>
  );
}

/* Curva del nivel frontal sobre la restricción τ = d/c: 20·log₁₀|sin(kd)| */
function FrontCurve({ k, d, dStar }) {
  const W = 280;
  const H = 82;
  const dMax = Math.max(2.2 * dStar, d * 1.1);
  const yMin = -24;
  const pts = [];
  for (let i = 0; i <= 120; i++) {
    const dd = (i / 120) * dMax;
    const g = 20 * Math.log10(Math.max(Math.abs(Math.sin(k * dd)), 1e-6));
    const x = 10 + (dd / dMax) * (W - 20);
    const y = 10 + (Math.min(Math.max(g, yMin), 0) / yMin) * (H - 26);
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  const xOf = (dd) => 10 + (dd / dMax) * (W - 20);
  const gCur = 20 * Math.log10(Math.max(Math.abs(Math.sin(k * d)), 1e-6));
  const yCur = 10 + (Math.min(Math.max(gCur, yMin), 0) / yMin) * (H - 26);
  return (
    <div className="sim-card rounded-2xl p-2.5">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img"
        aria-label="Nivel frontal del cardioide en función de la separación, con el óptimo en lambda cuartos">
        <line x1={10} y1={10} x2={W - 10} y2={10} stroke="var(--border)" />
        <line x1={10} y1={H - 16} x2={W - 10} y2={H - 16} stroke="var(--border)" />
        <polyline points={pts.join(' ')} fill="none" stroke="#A855F7" strokeWidth="1.8" />
        <line x1={xOf(dStar)} y1={6} x2={xOf(dStar)} y2={H - 16} stroke="#C084FC" strokeDasharray="3 3" opacity="0.7" />
        <circle cx={xOf(d)} cy={yCur} r="4" fill="#F43F5E" stroke="white" strokeWidth="1.2" />
        <text x={xOf(dStar) + 4} y={20} fontSize="8.5" fill="#C084FC">d* = λ/4</text>
        <text x={10} y={H - 4} fontSize="8" fill="var(--muted)">0 m</text>
        <text x={W - 10} y={H - 4} fontSize="8" textAnchor="end" fill="var(--muted)">d = {txt(dMax, 1)} m</text>
        <text x={W - 10} y={20} fontSize="8" textAnchor="end" fill="var(--muted)">0 dB (máx)</text>
      </svg>
    </div>
  );
}

/* Malla de la suma de Riemann (punto medio) coloreada con el integrando E(x,y) */
function RiemannGrid({ grid, region, label, sublabel, tone }) {
  const ref = useRef(null);
  const w = Math.max(region.xMax - region.xMin, 0.1);
  const h = Math.max(region.yMax - region.yMin, 0.1);
  const cssW = 128;
  const cssH = Math.max(Math.min(cssW * (h / w), 136), 48);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const { n, levels } = grid;
    const ctx = canvas.getContext('2d');
    const off = document.createElement('canvas');
    off.width = n;
    off.height = n;
    const offCtx = off.getContext('2d');
    const img = offCtx.createImageData(n, n);
    const data32 = new Uint32Array(img.data.buffer);
    for (let i = 0; i < n * n; i++) data32[i] = MAGMA_UINT32_TABLE[getPaletteIndex(levels[i], -40, 12)];
    offCtx.putImageData(img, 0, 0);
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(off, 0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.lineWidth = 1;
    for (let i = 1; i < n; i++) {
      const x = Math.round((i / n) * canvas.width) + 0.5;
      const y = Math.round((i / n) * canvas.height) + 0.5;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }
  }, [grid, cssH]);

  return (
    <figure className="sim-card rounded-2xl p-2.5 flex flex-col items-center gap-1.5 flex-1">
      <canvas
        ref={ref}
        style={{ width: cssW, height: cssH }}
        className={`rounded-lg border ${tone === 'red' ? 'border-[#F43F5E]/40' : 'border-[#A855F7]/40'}`}
        aria-label={`Integrando E(x,y) sobre la región ${label}, dividida en celdas de la suma de Riemann`}
      />
      <figcaption className="text-center">
        <span className="block text-[10.5px] font-medium text-text">{label}</span>
        {sublabel && <span className="block text-[9.5px] text-muted tabular-nums">{sublabel}</span>}
      </figcaption>
    </figure>
  );
}

/* ───────── Panel principal unificado (Telemetría + Ecuaciones Limpias) ───────── */
export default function LiveModelPanel() {
  const state = useArrayState();
  const derived = useArrayDerived();

  // Los cálculos pesados siguen al estado sin bloquear los deslizadores.
  const s = useDeferredValue(state);
  const dv = useDeferredValue(derived);
  const isStale = s !== state;

  const m = useMemo(
    () => computeLiveModel(s, dv),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dv, s.inspectedPoint, s.audienceRegion, s.stageRegion, s.referenceDistance, s.separation, s.delayRear,
      s.polarityRear, s.polarityFront, s.frequency, s.delayFront],
  );

  const [open, setOpen] = useState({ wave: false, sup: true, db: false, grad: false, design: true, int: true, sens: false });
  const toggle = (key) => setOpen((o) => ({ ...o, [key]: !o[key] }));

  const allOpen = Object.values(open).every(Boolean);
  const toggleAll = () => {
    const next = !allOpen;
    setOpen({ wave: next, sup: next, db: next, grad: next, design: next, int: next, sens: next });
  };

  const { wave, superposition: sp, decibel: db, gradient: gr, design: ds, integrals: I, sensitivity: se } = m;
  const [p1, p2] = sp.phasors;
  const H = gr.hessian;

  const interferenceLabel =
    db.interferenceGain > 1.5 ? 'Refuerzo constructivo'
      : db.interferenceGain < -6 ? 'Cancelación destructiva'
        : db.interferenceGain < -1.5 ? 'Cancelación parcial'
          : 'Cuadratura (≈ 0 dB)';

  const hessType = {
    maximum: 'máximo local', minimum: 'mínimo local', saddle: 'punto de silla', inconclusive: 'no concluyente',
  }[H.type];

  const worstTauDrop = Math.min(se.tauPlus, se.tauMinus) - ds.arDB;

  return (
    <div className="flex flex-col text-text select-none">
      {/* ═══ CABECERA DE TELEMETRÍA (Estilo Ficha Técnica de la Landing) ═══ */}
      <div className="p-4 border-b border-border flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${isStale ? 'bg-muted' : 'bg-[#A855F7] shadow-[0_0_10px_#A855F7]'}`} />
            <span className="text-[11px] font-medium tracking-tight text-text">Telemetría y modelo en vivo</span>
          </div>
          <span className="text-[10.5px] text-muted tabular-nums">
            {state.frequency} Hz · d = {txt(state.separation, 2)} m
          </span>
        </div>

        {/* 4 KPIs Principales en grilla de cristal estilo Tesla / Starlink */}
        <dl className="sim-card rounded-2xl grid grid-cols-2 divide-x divide-y divide-border overflow-hidden">
          <div className="p-3">
            <dt className="text-[10px] text-muted flex items-center justify-between">
              <span>Atenuación trasera</span>
              <span className="text-text/75"><KaTeXMath math="A_R" /></span>
            </dt>
            <dd className="mt-1 text-[23px] font-light tracking-tight tabular-nums text-text leading-none">
              {txt(ds.arDB, 1)} <span className="text-[12px] text-muted font-normal">dB</span>
            </dd>
            <dd className="mt-1 text-[10px] text-muted tabular-nums">
              Campo lejano: {ds.affDB === Infinity || ds.affDB > 60 ? '> 60 dB' : `${txt(ds.affDB, 1)} dB`}
            </dd>
          </div>

          <div className="p-3">
            <dt className="text-[10px] text-muted flex items-center justify-between">
              <span>Público / Escenario</span>
              <span className="text-purple-dark dark:text-[#C084FC]"><KaTeXMath math="Q_{PE}" /></span>
            </dt>
            <dd className="mt-1 text-[23px] font-light tracking-tight tabular-nums text-purple-dark dark:text-[#D8B4FE] leading-none">
              {txt(I.qpeDB, 1)} <span className="text-[12px] text-muted font-normal">dB</span>
            </dd>
            <dd className="mt-1 text-[10px] text-muted tabular-nums">
              En fase: {txt(I.qpeInPhaseDB, 1)} dB ({sgn(I.qpeDB - I.qpeInPhaseDB, 1)} dB)
            </dd>
          </div>

          <div className="p-3">
            <dt className="text-[10px] text-muted flex items-center justify-between">
              <span>Obj. 1 · Energía púb.</span>
              <span className="text-text/75"><KaTeXMath math="\rho_{\text{púb}}" /></span>
            </dt>
            <dd className="mt-1 text-[23px] font-light tracking-tight tabular-nums text-text leading-none">
              {txt(I.audience.rho, 2)}
            </dd>
            <dd className="mt-1 text-[10px] text-muted tabular-nums">
              Escenario: ρ = {txt(I.stage.rho, 2)}
            </dd>
          </div>

          <div className="p-3">
            <dt className="text-[10px] text-muted flex items-center justify-between">
              <span>Obj. 3 · Error Δτ = 0,5 ms</span>
              <span className="text-red dark:text-[#FB7185]"><KaTeXMath math="\Delta A_R" /></span>
            </dt>
            <dd className="mt-1 text-[23px] font-light tracking-tight tabular-nums text-red dark:text-[#FB7185] leading-none">
              {sgn(worstTauDrop, 1)} <span className="text-[12px] text-muted font-normal">dB</span>
            </dd>
            <dd className="mt-1 text-[10px] text-muted tabular-nums">
              G frontal: {txt(ds.gFrontDB, 1)} dB
            </dd>
          </div>
        </dl>

        {/* Aviso acústico contextual si la configuración invierte el lóbulo */}
        {ds.arDB < -1 && (
          <div className="rounded-xl px-3 py-2 flex items-center gap-2 text-[10.5px] text-[#FB7185] bg-[#F43F5E]/10 border border-[#F43F5E]/25">
            <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
            <span>Emisión invertida hacia el escenario. Revisa la polaridad trasera (−180°).</span>
          </div>
        )}
      </div>

      {/* ═══ BARRA DE CAPÍTULOS MATEMÁTICOS ═══ */}
      <div className="px-4 py-2 border-b border-border flex items-center justify-between bg-black/[0.02] dark:bg-white/[0.015]">
        <span className="text-[10.5px] uppercase tracking-wider text-muted font-medium">
          Capítulos del documento
        </span>
        <button
          type="button"
          onClick={toggleAll}
          className="text-[10.5px] text-purple-dark dark:text-purple-light hover:underline font-medium"
        >
          {allOpen ? 'Colapsar capítulos' : 'Expandir todos'}
        </button>
      </div>

      {/* ═══ 01 · 4.1 LA ONDA ═══ */}
      <Section
        index="01"
        num="4.1"
        title="La onda y fuente compacta"
        badge={`λ = ${txt(wave.lambda, 2)} m`}
        open={open.wave}
        onToggle={() => toggle('wave')}
      >
        <FormulaBox>
          <Eq math={'c = 331{,}3\\sqrt{1+\\tfrac{T}{273{,}15}}, \\qquad \\lambda = \\frac{c}{f}, \\qquad k = \\frac{2\\pi}{\\lambda}'} />
        </FormulaBox>
        <div className="grid grid-cols-2 gap-1.5">
          <MetricTile label="Velocidad del sonido" symbol="c" value={`${txt(wave.c, 1)} m/s`} sub={`T = ${state.temperature} °C`} />
          <MetricTile label="Longitud de onda" symbol="\lambda" value={`${txt(wave.lambda, 3)} m`} sub={`f = ${state.frequency} Hz`} tone="purple" />
          <MetricTile label="Número de onda" symbol="k" value={`${txt(wave.k, 3)} rad/m`} sub={`ω = ${txt(wave.omega, 1)} rad/s`} />
          <MetricTile
            label="Fuente compacta"
            symbol="k\,a"
            value={txt(wave.ka, 2)}
            sub={wave.isCompact ? 'ka < 1 · Fuente puntual' : 'ka ≥ 1 · Direccional'}
            tone={wave.isCompact ? 'purple' : 'red'}
          />
        </div>
      </Section>

      {/* ═══ 02 · 4.2 SUPERPOSICIÓN EN EL PUNTO ═══ */}
      <Section
        index="02"
        num="4.2"
        title="Superposición en el punto"
        badge={`P(${txt(sp.point.x, 1)}; ${txt(sp.point.y, 1)}) m`}
        open={open.sup}
        onToggle={() => toggle('sup')}
      >
        <FormulaBox>
          <Eq math={'P_{\\text{total}}(x,y) = \\sum_{n=1}^{2} \\frac{A_n}{r_n}\\,e^{-j(k r_n + \\phi_n)}, \\qquad \\phi_n = \\omega\\tau_n + \\theta_n'} />
        </FormulaBox>
        <div className="grid grid-cols-2 gap-1.5">
          <MetricTile
            label="S₁ Trasera (−d/2)"
            symbol="r_1, \phi_1"
            value={`r₁ = ${txt(p1.r, 2)} m`}
            sub={`φ₁ = ${txt(p1.phi, 2)} rad`}
            tone="red"
          />
          <MetricTile
            label="S₂ Frontal (+d/2)"
            symbol="r_2, \phi_2"
            value={`r₂ = ${txt(p2.r, 2)} m`}
            sub={`φ₂ = ${txt(p2.phi, 2)} rad`}
            tone="purple"
          />
          <MetricTile
            label="Diferencia de fase"
            symbol="\Delta\Phi"
            value={`${txt((sp.deltaPhi * 180) / Math.PI, 0)}° (${txt(sp.deltaPhi, 2)} rad)`}
            sub={`cos ΔΦ = ${txt(sp.cosDelta, 2)}`}
          />
          <MetricTile
            label="Presión resultante"
            symbol="|P_{\text{total}}|"
            value={txt(sp.Pmag, 3)}
            sub={interferenceLabel}
            tone={db.interferenceGain > 1.5 ? 'purple' : db.interferenceGain < -1.5 ? 'red' : undefined}
          />
        </div>
        <PhasorDiagram phasors={sp.phasors} P={sp.P} />
        <Note>Haz clic en cualquier punto del mapa 2D para mover el micrófono virtual P(x, y) y ver cómo giran los fasores.</Note>
      </Section>

      {/* ═══ 03 · 4.3 EL DECIBEL ═══ */}
      <Section
        index="03"
        num="4.3"
        title="El decibel y la interferencia"
        badge={`${txt(db.L, 1)} dB`}
        open={open.db}
        onToggle={() => toggle('db')}
      >
        <FormulaBox>
          <Eq math={'L = 10\\log_{10}|P_{\\text{total}}|^2, \\qquad L_{\\text{incoh}} = 10\\log_{10}(E_1 + E_2)'} />
        </FormulaBox>
        <div className="grid grid-cols-2 gap-1.5">
          <MetricTile
            label="Suma coherente real"
            symbol="L"
            value={`${txt(db.L, 1)} dB`}
            sub={`E = |P|² = ${txt(db.E, 4)}`}
            tone="purple"
          />
          <MetricTile
            label="Suma incoherente"
            symbol="L_{\text{incoh}}"
            value={`${txt(db.Lincoherent, 1)} dB`}
            sub="Sin término de fase"
          />
          <MetricTile
            label="Niveles individuales"
            symbol="L_1, L_2"
            value={`${txt(db.L1, 1)} / ${txt(db.L2, 1)} dB`}
            sub={`Suma aritmética: ${txt(db.naiveSum, 1)} dB`}
          />
          <MetricTile
            label="Huella de interferencia"
            symbol="L - L_{\text{incoh}}"
            value={`${sgn(db.interferenceGain, 1)} dB`}
            sub="Máximo teórico: +3,01 dB"
            tone={db.interferenceGain >= 0 ? 'purple' : 'red'}
          />
        </div>
      </Section>

      {/* ═══ 04 · 4.5 GRADIENTE Y HESSIANO ═══ */}
      <Section
        index="04"
        num="4.5"
        title="Gradiente y Hessiano"
        badge={`‖∇L‖ = ${txt(gr.magL, 2)} dB/m`}
        open={open.grad}
        onToggle={() => toggle('grad')}
      >
        <FormulaBox>
          <Eq math={'\\nabla E = \\left(\\frac{\\partial E}{\\partial x},\\,\\frac{\\partial E}{\\partial y}\\right), \\qquad H_E = \\begin{pmatrix} E_{xx} & E_{xy} \\\\ E_{xy} & E_{yy} \\end{pmatrix}'} />
        </FormulaBox>
        <div className="grid grid-cols-2 gap-1.5">
          <MetricTile
            label="Gradiente de energía"
            symbol="\nabla E"
            value={`(${txt(gr.Ex, 3)}; ${txt(gr.Ey, 3)})`}
            sub={`‖∇E‖ = ${txt(gr.mag, 4)}`}
          />
          <MetricTile
            label="Cambio espacial en dB"
            symbol="\lVert\nabla L\rVert"
            value={`${txt(gr.magL, 2)} dB/m`}
            sub={`Dirección máx: ${txt(gr.angleDeg, 0)}°`}
            tone="purple"
          />
          <MetricTile
            label="Curvatura (2ª derivadas)"
            symbol="E_{xx}, E_{yy}"
            value={`${txt(H.Exx, 3)} / ${txt(H.Eyy, 3)}`}
            sub={`Cruzada E_xy = ${txt(H.Exy, 3)}`}
          />
          <MetricTile
            label="Discriminante Hessiano"
            symbol="D = \det H_E"
            value={txt(H.D, 4)}
            sub={gr.isCritical ? `Punto crítico: ${hessType}` : `Curvatura tipo ${hessType}`}
          />
        </div>
      </Section>

      {/* ═══ 05 · 4.5.1 DOMINIO DE DISEÑO A(d, τ) Y LAGRANGE ═══ */}
      <Section
        index="05"
        num="4.5.1"
        title="Diseño óptimo de Lagrange"
        badge={`d* = ${txt(ds.dStar, 2)} m`}
        open={open.design}
        onToggle={() => toggle('design')}
      >
        <FormulaBox>
          <Eq math={'A(d,\\tau) = 20\\log_{10}\\frac{|P_\\infty(0)|}{|P_\\infty(\\pi)|} = 20\\log_{10}\\frac{\\left|\\sin\\frac{kd+\\omega\\tau}{2}\\right|}{\\left|\\sin\\frac{\\omega\\tau-kd}{2}\\right|}'} />
          <Eq math={'g(d,\\tau) = \\omega\\tau - kd = 0 \\implies d^* = \\frac{\\lambda}{4}, \\quad \\tau^* = \\frac{d^*}{c}'} />
        </FormulaBox>
        <div className="grid grid-cols-2 gap-1.5">
          <MetricTile
            label="Óptimo de Lagrange"
            symbol="d^*, \tau^*"
            value={`${txt(ds.dStar, 2)} m · ${txt(ds.tauStar * 1000, 2)} ms`}
            sub="Máximo frontal con nulo trasero"
            tone="purple"
          />
          <MetricTile
            label="Configuración actual"
            symbol="d, \tau"
            value={`${txt(state.separation, 2)} m · ${txt(state.delayRear * 1000, 2)} ms`}
            sub={`g(d,τ) = ${txt(ds.constraint, 3)} rad`}
          />
        </div>
        <FrontCurve k={dv.k} d={state.separation} dStar={ds.dStar} />
        <Note>
          Sobre la restricción de nulo trasero <KaTeXMath math="\tau = d/c" />, la ganancia frontal sigue <KaTeXMath math="20\log_{10}|\sin(kd)|" /> y alcanza su máximo en <KaTeXMath math="d^* = \lambda/4" />.
        </Note>
      </Section>

      {/* ═══ 06 · 4.6 INTEGRALES DOBLES ═══ */}
      <Section
        index="06"
        num="4.6"
        title="Integrales dobles en regiones"
        badge={`Q_PE = ${txt(I.qpeDB, 1)} dB`}
        open={open.int}
        onToggle={() => toggle('int')}
      >
        <FormulaBox>
          <Eq math={'I_R = \\iint_R E(x,y)\\,dA \\approx \\sum_{j=1}^{N}\\sum_{i=1}^{N} E(\\bar{x}_i,\\bar{y}_j)\\,\\Delta x\\,\\Delta y'} />
          <Eq math={'Q_{PE} = 10\\log_{10}\\frac{I_{\\text{púb}}}{I_{\\text{esc}}}, \\qquad \\rho_R = \\frac{\\iint_R E\\,dA}{\\iint_R (E_1+E_2)\\,dA}'} />
        </FormulaBox>

        <div className="flex gap-2">
          <RiemannGrid
            grid={I.viz.stage}
            region={I.stage.region}
            label="Escenario (R_esc)"
            sublabel={`${txt(I.stage.area, 0)} m² · ρ = ${txt(I.stage.rho, 2)}`}
            tone="red"
          />
          <RiemannGrid
            grid={I.viz.audience}
            region={I.audience.region}
            label="Público (R_púb)"
            sublabel={`${txt(I.audience.area, 0)} m² · ρ = ${txt(I.audience.rho, 2)}`}
            tone="purple"
          />
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <MetricTile
            label="Integral en Público"
            symbol="I_{\text{púb}}"
            value={txt(I.audience.I_int, 3)}
            sub={`${sgn(I.audienceGainVsInPhaseDB, 1)} dB vs. 2 subs en fase`}
            tone="purple"
          />
          <MetricTile
            label="Integral en Escenario"
            symbol="I_{\text{esc}}"
            value={txt(I.stage.I_int, 3)}
            sub={`${sgn(I.stageGainVsInPhaseDB, 1)} dB vs. 2 subs en fase`}
            tone="red"
          />
          <MetricTile
            label="Partición punto medio"
            symbol="\Delta x \times \Delta y"
            value={`${txt(I.audience.dx, 2)} × ${txt(I.audience.dy, 2)} m`}
            sub={`Malla N = ${I.n} (${I.n * I.n} celdas)`}
          />
          <MetricTile
            label="Corona lejana (Bessel)"
            symbol="\rho_{\text{corona}}"
            value={txt(I.rhoCorona, 3)}
            sub={`En fase: ${txt(I.rhoCoronaInPhase, 3)} · J₀ = ${txt(I.j0, 2)}`}
          />
        </div>
      </Section>

      {/* ═══ 07 · OBJETIVO 3: SENSIBILIDAD ═══ */}
      <Section
        index="07"
        num="Obj.3"
        title="Sensibilidad de montaje"
        badge={`${txt(se.dARdTauPerMs, 1)} dB/ms`}
        open={open.sens}
        onToggle={() => toggle('sens')}
      >
        <FormulaBox>
          <Eq math={'dA_R = \\frac{\\partial A_R}{\\partial \\tau}\\,d\\tau + \\frac{\\partial A_R}{\\partial d}\\,dd, \\qquad \\Delta\\phi = \\omega\\,\\Delta\\tau'} />
        </FormulaBox>
        <div className="grid grid-cols-2 gap-1.5">
          <MetricTile
            label="Sensibilidad al retardo"
            symbol="\partial A_R / \partial \tau"
            value={`${txt(se.dARdTauPerMs, 2)} dB/ms`}
            sub={`Desfase: ${txt(se.phaseErrorPerMsDeg, 1)}° por ms`}
            tone="red"
          />
          <MetricTile
            label="Sensibilidad a posición"
            symbol="\partial A_R / \partial d"
            value={`${txt(se.dARdDPerCm, 3)} dB/cm`}
            sub=" Derivada parcial espacial"
          />
          <MetricTile
            label="A_R con τ ± 0,5 ms"
            symbol="\tau \mp 0{,}5\text{ ms}"
            value={`${txt(se.tauMinus, 1)} / ${txt(se.tauPlus, 1)} dB`}
            sub="Tolerancia de procesador DSP"
          />
          <MetricTile
            label="A_R con d ± 10 cm"
            symbol="d \mp 10\text{ cm}"
            value={`${txt(se.dMinus, 1)} / ${txt(se.dPlus, 1)} dB`}
            sub="Tolerancia de cinta métrica"
          />
        </div>
      </Section>
    </div>
  );
}
