import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { useArrayState, useArrayDerived } from '../state/arrayState.js';
import { generatePolarRadiationPattern } from '../core/frequencyResponse.js';

export default React.memo(function PolarPlot({ interactive = true }) {
  const state = useArrayState();
  const derived = useArrayDerived();
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  const [plotSize, setPlotSize] = useState(300);
  const [hoverData, setHoverData] = useState(null);

  const isDark = state.theme === 'dark';

  // Responsive size observer
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 50 && height > 50) {
          const avail = Math.min(width - 20, height - 76);
          setPlotSize(Math.max(Math.min(avail, 460), 180));
        }
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const polarData = useMemo(() => {
    return generatePolarRadiationPattern({
      frequency: state.frequency,
      speedOfSound: derived.c,
      d: state.separation,
      tau: state.delayRear,
      gainFront: derived.gainFrontLinear,
      gainRear: derived.gainRearLinear,
      polarityFront: state.polarityFront,
      polarityRear: state.polarityRear,
      delayFront: state.delayFront,
      delayRear: state.delayRear,
      stepDeg: 2, // 180 points: 2x faster, identical visual curve
    });
  }, [
    state.frequency,
    derived.c,
    state.separation,
    state.delayRear,
    state.delayFront,
    derived.gainFrontLinear,
    derived.gainRearLinear,
    state.polarityFront,
    state.polarityRear,
  ]);

  // Find peak radiation angle
  const peakAngle = useMemo(() => {
    if (!polarData.length) return 0;
    let max = -Infinity;
    let bestDeg = 0;
    for (const p of polarData) {
      if (p.cardioidDB > max) {
        max = p.cardioidDB;
        bestDeg = p.angleDeg;
      }
    }
    return bestDeg;
  }, [polarData]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (canvas.width !== plotSize) canvas.width = plotSize;
    if (canvas.height !== plotSize) canvas.height = plotSize;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const maxRadius = Math.min(centerX, centerY) - 24;

    ctx.clearRect(0, 0, width, height);

    // Theme-dependent colors
    const gridMajor = isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(15, 23, 42, 0.2)';
    const gridMinor = isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(15, 23, 42, 0.07)';
    const textLabel = isDark ? 'rgba(255, 255, 255, 0.45)' : 'rgba(71, 85, 105, 0.85)';
    const curveStroke = isDark ? '#C084FC' : '#7C3AED';
    const curveFill = isDark ? 'rgba(168, 85, 247, 0.18)' : 'rgba(124, 58, 237, 0.14)';
    const inPhaseColor = isDark ? '#F43F5E' : '#E11D48';

    // Círculos concéntricos de decibelios
    const dbCircles = [
      { db: 0, rRatio: 1.0, label: '0 dB' },
      { db: -6, rRatio: 0.8, label: '−6 dB' },
      { db: -12, rRatio: 0.6, label: '−12 dB' },
      { db: -18, rRatio: 0.4, label: '−18 dB' },
      { db: -24, rRatio: 0.2, label: '−24 dB' },
    ];

    ctx.save();

    // Dibujar círculos concéntricos
    dbCircles.forEach((c) => {
      const r = maxRadius * c.rRatio;
      ctx.beginPath();
      ctx.arc(centerX, centerY, r, 0, 2 * Math.PI);
      ctx.strokeStyle = c.db === 0 ? gridMajor : gridMinor;
      ctx.lineWidth = c.db === 0 ? 1.5 : 1;
      ctx.stroke();

      ctx.fillStyle = textLabel;
      ctx.font = '500 9px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(c.label, centerX + 4, centerY - r + 10);
    });

    // Ejes radiales (cada 30 grados)
    ctx.lineWidth = 1;
    for (let deg = 0; deg < 360; deg += 30) {
      const rad = (deg * Math.PI) / 180;
      const isMain = deg % 90 === 0;
      ctx.strokeStyle = isMain ? gridMajor : gridMinor;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(centerX + maxRadius * Math.cos(rad), centerY - maxRadius * Math.sin(rad));
      ctx.stroke();
    }

    // Rótulos de orientación cardinal
    ctx.font = '600 10px "IBM Plex Sans JP", sans-serif';
    ctx.fillStyle = curveStroke;
    ctx.textAlign = 'right';
    ctx.fillText('0° Frente (+x)', centerX + maxRadius + 2, centerY - 6);

    ctx.fillStyle = inPhaseColor;
    ctx.textAlign = 'left';
    ctx.fillText('180° Atrás (−x)', centerX - maxRadius - 2, centerY - 6);

    ctx.fillStyle = textLabel;
    ctx.textAlign = 'center';
    ctx.fillText('90° (+y)', centerX, centerY - maxRadius - 6);
    ctx.fillText('270° (−y)', centerX, centerY + maxRadius + 15);

    const dbToRadius = (db) => {
      const clamped = Math.max(Math.min(db, 0), -30);
      const ratio = (clamped + 30) / 30;
      return maxRadius * Math.max(ratio, 0.04);
    };

    // 1. Trazar arreglo En Fase (línea discontinua roja)
    ctx.strokeStyle = inPhaseColor;
    ctx.lineWidth = 1.4;
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

    // 2. Trazar arreglo Actual
    if (isDark) {
      ctx.shadowColor = '#A855F7';
      ctx.shadowBlur = 10;
    }
    ctx.strokeStyle = curveStroke;
    ctx.lineWidth = 2.4;
    ctx.fillStyle = curveFill;
    ctx.beginPath();
    polarData.forEach((p, idx) => {
      const r = dbToRadius(p.cardioidDB);
      const px = centerX + r * Math.cos(p.angleRad);
      const py = centerY - r * Math.sin(p.angleRad);
      if (idx === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 3. Indicador de aguja interactiva
    if (hoverData) {
      const r = dbToRadius(hoverData.cardioidDB);
      const px = centerX + r * Math.cos(hoverData.rad);
      const py = centerY - r * Math.sin(hoverData.rad);

      ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(15, 23, 42, 0.6)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(centerX + maxRadius * Math.cos(hoverData.rad), centerY - maxRadius * Math.sin(hoverData.rad));
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = isDark ? '#FFFFFF' : '#0F172A';
      ctx.beginPath();
      ctx.arc(px, py, 4, 0, 2 * Math.PI);
      ctx.fill();
      ctx.strokeStyle = curveStroke;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    ctx.restore();
  }, [polarData, hoverData, isDark, plotSize]);

  const lastMoveTime = useRef(0);
  const handleMouseMove = useCallback((e) => {
    if (!interactive) return;
    const now = performance.now();
    if (now - lastMoveTime.current < 30) return;
    lastMoveTime.current = now;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left - canvas.width / 2;
    const y = -(e.clientY - rect.top - canvas.height / 2);

    let rad = Math.atan2(y, x);
    if (rad < 0) rad += 2 * Math.PI;
    const deg = Math.round((rad * 180) / Math.PI) % 360;

    const matched = polarData.find((p) => Math.abs(p.angleDeg - deg) <= 1) || polarData[0];
    if (matched) {
      setHoverData({
        deg,
        rad,
        cardioidDB: matched.cardioidDB,
        inPhaseDB: matched.inPhaseDB,
      });
    }
  }, [interactive, polarData]);

  return (
    <div ref={containerRef} className="w-full h-full flex flex-col relative overflow-hidden select-none bg-white dark:bg-black">
      {/* Floating HUD Top */}
      <div className="absolute top-3 inset-x-3 z-10 flex items-center justify-between gap-2 pointer-events-none">
        <div className="landing-glass rounded-full px-3.5 py-1.5 flex items-center gap-2 text-[11px] pointer-events-auto">
          <span className="font-medium text-text">Patrón Polar</span>
          <span className="text-muted tabular-nums">{state.frequency} Hz</span>
        </div>

        <div className="flex items-center gap-2 pointer-events-auto">
          {hoverData ? (
            <span className="landing-glass px-3.5 py-1.5 rounded-full tabular-nums text-[11px] text-text">
              θ = {hoverData.deg}° · <strong className="font-semibold text-purple-dark dark:text-[#D8B4FE]">{hoverData.cardioidDB.toFixed(1).replace('.', ',')} dB</strong>
            </span>
          ) : (
            <span className={`landing-glass rounded-full px-3 py-1.5 text-[10.5px] font-medium ${peakAngle > 90 && peakAngle < 270 ? 'text-red dark:text-[#FB7185]' : 'text-purple-dark dark:text-[#D8B4FE]'}`}>
              {peakAngle > 90 && peakAngle < 270 ? '⚠️ Lóbulo hacia escenario (−180°)' : 'Lóbulo hacia público (0°)'}
            </span>
          )}
        </div>
      </div>

      {/* Canvas Area (Centered) */}
      <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
        <canvas
          ref={canvasRef}
          width={plotSize}
          height={plotSize}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverData(null)}
          className="cursor-crosshair max-w-full max-h-full"
          aria-label={`Diagrama polar a ${state.frequency} Hz`}
        />
      </div>

      {/* Floating HUD Bottom (Legend) */}
      <div className="absolute bottom-3 inset-x-3 z-10 flex items-center justify-between gap-2 pointer-events-none">
        <div className="landing-glass rounded-full px-3.5 py-1.5 flex items-center gap-3 text-[10.5px] pointer-events-auto">
          <span className="flex items-center gap-1.5 text-text">
            <span className="w-2 h-2 rounded-full bg-[#A855F7] inline-block" /> Arreglo actual
          </span>
          <span className="flex items-center gap-1.5 text-muted">
            <span className="w-3 h-0.5 border-b border-dashed border-[#F43F5E] inline-block" /> 2 subs en fase
          </span>
        </div>
        <div className="landing-glass rounded-full px-3 py-1.5 text-[10px] text-muted tabular-nums pointer-events-auto">
          0 a −30 dB
        </div>
      </div>
    </div>
  );
});
