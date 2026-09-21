import { useMemo, useRef, useEffect } from 'react';
import { useArray } from '../../state/arrayState.js';
import {
  sweepFrequencyResponse,
  calculateCardioidPassband,
  generatePolarRadiationPattern,
} from '../../core/frequencyResponse.js';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { Radio } from 'lucide-react';

export default function FrequencyPanel() {
  const { state, derived } = useArray();
  const polarCanvasRef = useRef(null);

  const nf1 = new Intl.NumberFormat('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const nf2 = new Intl.NumberFormat('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // 1. Barrido de respuesta en frecuencia
  const freqData = useMemo(() => {
    return sweepFrequencyResponse({
      d: state.separation,
      tau: state.delayRear,
      speedOfSound: derived.c,
      rDistance: state.referenceDistance,
    });
  }, [state.separation, state.delayRear, derived.c, state.referenceDistance]);

  // Banda útil a -3 dB
  const passband = useMemo(() => {
    return calculateCardioidPassband(state.separation, derived.c);
  }, [state.separation, derived.c]);

  // 2. Patrón polar de radiación a la frecuencia actual
  const polarData = useMemo(() => {
    return generatePolarRadiationPattern({
      frequency: state.frequency,
      speedOfSound: derived.c,
      d: state.separation,
      tau: state.delayRear,
      stepDeg: 2,
    });
  }, [state.frequency, derived.c, state.separation, state.delayRear]);

  // Renderizado del Diagrama Polar en Canvas 2D
  useEffect(() => {
    const canvas = polarCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const maxRadius = Math.min(centerX, centerY) - 24;

    ctx.clearRect(0, 0, width, height);

    // Círculos concéntricos de decibelios (0 dB, -6 dB, -12 dB, -18 dB, -24 dB)
    const dbCircles = [
      { db: 0, rRatio: 1.0, label: '0 dB' },
      { db: -6, rRatio: 0.8, label: '−6 dB' },
      { db: -12, rRatio: 0.6, label: '−12 dB' },
      { db: -18, rRatio: 0.4, label: '−18 dB' },
      { db: -24, rRatio: 0.2, label: '−24 dB' },
    ];

    ctx.save();
    ctx.strokeStyle = '#2A3541';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#93A1B0';
    ctx.font = '9px monospace';

    dbCircles.forEach((c) => {
      const r = maxRadius * c.rRatio;
      ctx.beginPath();
      ctx.arc(centerX, centerY, r, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.fillText(c.label, centerX + 4, centerY - r + 10);
    });

    // Ejes radiales (0°, 90°, 180°, 270°)
    const angles = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];
    ctx.beginPath();
    angles.forEach((a) => {
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(centerX + maxRadius * Math.cos(a), centerY + maxRadius * Math.sin(a));
    });
    ctx.stroke();

    // Rótulos de orientación
    ctx.fillStyle = '#7C3AED';
    ctx.fillText('0° Frente (+x)', centerX + maxRadius - 30, centerY - 8);
    ctx.fillStyle = '#E11D48';
    ctx.fillText('180° Atrás (−x)', centerX - maxRadius - 10, centerY - 8);
    ctx.fillStyle = '#64748B';
    ctx.fillText('90°', centerX + 4, centerY - maxRadius + 12);
    ctx.fillText('270°', centerX + 4, centerY + maxRadius - 4);

    // Función auxiliar para convertir (angleRad, dB) a coordenadas (x, y)
    const dbToRadius = (db) => {
      const clamped = Math.max(Math.min(db, 0), -30);
      const ratio = (clamped + 30) / 30; // 0 a 1
      return maxRadius * Math.max(ratio, 0.05);
    };

    // 1. Trazar arreglo En Fase (línea discontinua roja)
    ctx.strokeStyle = '#E11D48';
    ctx.lineWidth = 1.8;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    polarData.forEach((p, idx) => {
      const r = dbToRadius(p.inPhaseDB);
      const px = centerX + r * Math.cos(p.angleRad);
      const py = centerY - r * Math.sin(p.angleRad);
      if (idx === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);

    // 2. Trazar arreglo Cardioide actual (línea sólida morada)
    ctx.strokeStyle = '#7C3AED';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    polarData.forEach((p, idx) => {
      const r = dbToRadius(p.cardioidDB);
      const px = centerX + r * Math.cos(p.angleRad);
      const py = centerY - r * Math.sin(p.angleRad);
      if (idx === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.closePath();
    ctx.stroke();

    ctx.restore();
  }, [polarData]);

  return (
    <div className="flex flex-col gap-6 text-xs text-text">
      {/* TARJETA DE ANCHO DE BANDA ÚTIL */}
      <div className="p-4 bg-surface border border-border rounded-2xl flex flex-wrap items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-purple-light/70 text-purple dark:bg-purple-dark/30">
            <Radio className="h-5 w-5" />
          </div>
          <div>
            <span className="font-bold text-text text-sm block">
              Banda Útil del Arreglo Cardioide (G_front ≥ −3 dB)
            </span>
            <p className="text-[11px] text-muted">
              Con retardo ideal τ = d / c, el nulo trasero persiste a toda frecuencia. La banda útil queda delimitada por sin(kd).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 font-mono text-xs">
          <div className="bg-surface-2 border border-border px-3 py-1.5 rounded-xl text-center">
            <span className="text-muted text-[10px] block font-sans">Frecuencia Central fc</span>
            <strong className="text-purple">{nf1.format(passband.fc)} Hz</strong>
          </div>
          <div className="bg-surface-2 border border-border px-3 py-1.5 rounded-xl text-center">
            <span className="text-muted text-[10px] block font-sans">Banda Útil [fc/2, 3fc/2]</span>
            <strong className="text-ok">
              {nf1.format(passband.fLow)} – {nf1.format(passband.fHigh)} Hz
            </strong>
          </div>
        </div>
      </div>

      {/* GRÁFICAS: RESPUESTA EN FRECUENCIA Y DIAGRAMA POLAR */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Curvas vs Frecuencia con Recharts */}
        <div className="p-4 bg-surface border border-border rounded-2xl flex flex-col gap-3 shadow-sm">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <span className="font-bold text-text text-sm">Respuesta en Frecuencia (20–200 Hz)</span>
            <span className="text-muted font-mono">d = {nf2.format(state.separation)} m</span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={freqData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis
                  dataKey="frequency"
                  stroke="#64748B"
                  tick={{ fontSize: 10 }}
                  label={{ value: 'Frecuencia (Hz)', position: 'insideBottomRight', offset: -5, fill: '#64748B', fontSize: 10 }}
                />
                <YAxis stroke="#64748B" tick={{ fontSize: 10 }} domain={[-12, 35]} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#FFFFFF', borderColor: '#E2E8F0', borderRadius: '8px', color: '#0F172A' }}
                  labelStyle={{ color: '#0F172A', fontWeight: 'bold' }}
                />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
                <ReferenceLine y={-3} stroke="#E11D48" strokeDasharray="3 3" label={{ value: '−3 dB frontal', fill: '#E11D48', fontSize: 10 }} />
                <ReferenceLine x={state.frequency} stroke="#7C3AED" strokeDasharray="2 2" label={{ value: 'Actual', fill: '#7C3AED', fontSize: 10 }} />
                <Line type="monotone" dataKey="arDB" name="A_R (dB) Frente/Atrás" stroke="#7C3AED" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="gFrontDB" name="G_front (dB) Nivel Público" stroke="#E11D48" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Diagrama Polar */}
        <div className="p-4 bg-surface border border-border rounded-2xl flex flex-col items-center justify-between gap-3 shadow-sm">
          <div className="w-full flex items-center justify-between border-b border-border pb-2">
            <span className="font-bold text-text text-sm">Diagrama Polar a {state.frequency} Hz</span>
            <div className="flex items-center gap-3 text-[11px]">
              <span className="flex items-center gap-1 text-purple font-semibold">
                <span className="h-2 w-3 bg-purple inline-block rounded-sm" /> Cardioide
              </span>
              <span className="flex items-center gap-1 text-red font-semibold">
                <span className="h-2 w-3 bg-red inline-block rounded-sm" /> En fase
              </span>
            </div>
          </div>

          <div className="relative">
            <canvas
              ref={polarCanvasRef}
              width={280}
              height={280}
              className="max-w-full h-auto"
              aria-label={`Diagrama polar de radiación en campo lejano a ${state.frequency} Hz`}
            />
          </div>

          <span className="text-[11px] text-muted text-center">
            Escala polar de 0 dB (borde exterior) a −30 dB (centro). Nulo trasero evidente a 180°.
          </span>
        </div>
      </div>
    </div>
  );
}
