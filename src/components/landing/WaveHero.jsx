import React, { useEffect, useRef } from 'react';
import { R_MIN } from '../../core/constants.js';

const WIDE_MIN_PX = 1024; // Mismo corte que el breakpoint lg de Tailwind usado en la portada
const ARRAY_POS_WIDE = { x: 0.62, y: 0.46 };
const ARRAY_NARROW_X = 0.3;
const ARRAY_NARROW_TOP_PX = 215; // Bajo la navegación y sobre el texto, que en pantallas angostas va en flujo
const MORPH_MS = 1500;
const WAVE_PERIOD_MS = 2600;
const STATIC_PHASE = 0.6;
const LUT_SIZE = 1024;

/**
 * Coeficiente de la caja trasera en el cambio de "en fase" (mix = 0) a "cardioide" (mix = 1).
 * Con d = λ/4 y τ = d/c, invertir la polaridad y retrasar equivale a −e^{−jπ/2} = e^{jπ/2},
 * así que basta girar la fase de la caja trasera de 0° a 90°: cada paso intermedio es un
 * arreglo físicamente válido a esta frecuencia, no un fundido entre dos imágenes.
 */
export function morphSources(separation, mix) {
  const phi = mix * (Math.PI / 2);
  return [
    { x: -separation / 2, y: 0, cRe: Math.cos(phi), cIm: Math.sin(phi), gain: 1 },
    { x: separation / 2, y: 0, cRe: 1, cIm: 0, gain: 1 },
  ];
}

const lerpStops = (stops, t) => {
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) {
      const [t0, c0] = stops[i - 1];
      const [t1, c1] = stops[i];
      const u = (t - t0) / (t1 - t0);
      return c0.map((v, n) => v + (c1[n] - v) * u);
    }
  }
  return stops[stops.length - 1][1];
};

/** Tabla de color de presión: compresión en violeta, rarefacción en un rosa muy contenido. */
function buildPalette(isDark) {
  const crest = isDark
    ? [[0, [0, 0, 0]], [0.3, [34, 12, 78]], [0.65, [112, 50, 225]], [1, [224, 196, 255]]]
    : [[0, [255, 255, 255]], [0.3, [233, 225, 254]], [0.65, [167, 129, 248]], [1, [91, 33, 182]]];
  const trough = isDark
    ? [[0, [0, 0, 0]], [1, [88, 14, 48]]]
    : [[0, [255, 255, 255]], [1, [253, 205, 214]]];
  const lut = new Uint32Array(LUT_SIZE);
  for (let i = 0; i < LUT_SIZE; i++) {
    const v = (i / (LUT_SIZE - 1)) * 2 - 1;
    const [r, g, b] = v >= 0 ? lerpStops(crest, v) : lerpStops(trough, -v);
    lut[i] = (255 << 24) | (Math.round(b) << 16) | (Math.round(g) << 8) | Math.round(r);
  }
  return lut;
}

/**
 * Fondo animado de la portada: el campo de presión instantánea real del arreglo,
 * p(x, y, t) = Re{ P_total(x, y) · e^{jωt} }, a 80 Hz con d = λ/4.
 * `cardioid` conmuta entre dos cajas en fase y el cardioide; `onMix` informa el avance (0 a 1)
 * para que la portada actualice sus cifras al mismo ritmo que las ondas.
 */
export default function WaveHero({ frequency = 80, c = 343.2, cardioid = true, theme = 'dark', onMix, className = '' }) {
  const canvasRef = useRef(null);
  const targetRef = useRef(cardioid ? 1 : 0);
  const mixRef = useRef(cardioid ? 1 : 0);
  const onMixRef = useRef(onMix);
  const redrawRef = useRef(null);

  onMixRef.current = onMix;

  useEffect(() => {
    targetRef.current = cardioid ? 1 : 0;
    redrawRef.current?.();
  }, [cardioid]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    const isDark = theme === 'dark';
    const lut = buildPalette(isDark);

    const k = (2 * Math.PI * frequency) / c;
    const d = c / frequency / 4;
    const off = document.createElement('canvas');
    const offCtx = off.getContext('2d');

    let ready = false;
    let cssW = 0;
    let cssH = 0;
    let dpr = 1;
    let W = 0;
    let H = 0;
    let ax = 0;
    let ay = 0;
    let ppm = 1;
    let rMax = 1;
    let rearRe = null;
    let rearIm = null;
    let frontRe = null;
    let frontIm = null;
    let img = null;
    let data32 = null;

    // Campo unitario de cada caja en la malla: se calcula una vez por tamaño
    const build = () => {
      const rect = canvas.getBoundingClientRect();
      // Con la portada oculta el tamaño es 0: se espera al siguiente aviso de ResizeObserver
      if (rect.width < 1 || rect.height < 1) {
        ready = false;
        return;
      }
      cssW = rect.width;
      cssH = rect.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);

      const wide = cssW >= WIDE_MIN_PX;
      ax = cssW * (wide ? ARRAY_POS_WIDE.x : ARRAY_NARROW_X);
      ay = wide ? cssH * ARRAY_POS_WIDE.y : ARRAY_NARROW_TOP_PX;
      ppm = wide ? cssW / 39 : Math.min(cssW / 20, 26);
      rMax = wide ? 6 : 4;

      W = Math.max(200, Math.min(520, Math.round(cssW / 3)));
      H = Math.max(90, Math.round((W * cssH) / cssW));
      off.width = W;
      off.height = H;
      img = offCtx.createImageData(W, H);
      data32 = new Uint32Array(img.data.buffer);
      rearRe = new Float32Array(W * H);
      rearIm = new Float32Array(W * H);
      frontRe = new Float32Array(W * H);
      frontIm = new Float32Array(W * H);

      let idx = 0;
      for (let j = 0; j < H; j++) {
        const y = (ay - (j / (H - 1)) * cssH) / ppm;
        for (let i = 0; i < W; i++) {
          const x = ((i / (W - 1)) * cssW - ax) / ppm;
          // Compensación suave para que no sature en el origen y los frentes lejanos se lean limpio
          const rr = Math.hypot(x, y);
          const comp = Math.tanh(rr / 1.1) * Math.pow(Math.max(rr, 0.6), 0.7);

          const rRear = Math.max(Math.hypot(x + d / 2, y), R_MIN * 4);
          const rFront = Math.max(Math.hypot(x - d / 2, y), R_MIN * 4);
          rearRe[idx] = (Math.cos(k * rRear) / rRear) * comp;
          rearIm[idx] = (-Math.sin(k * rRear) / rRear) * comp;
          frontRe[idx] = (Math.cos(k * rFront) / rFront) * comp;
          frontIm[idx] = (-Math.sin(k * rFront) / rFront) * comp;
          idx++;
        }
      }
      ready = true;
    };

    const drawField = (phase, mix) => {
      const phi = mix * (Math.PI / 2);
      const cr = Math.cos(phi);
      const ci = Math.sin(phi);
      const cp = Math.cos(phase);
      const sp = Math.sin(phase);
      const a = cr * cp - ci * sp;
      const b = -ci * cp - cr * sp;
      const n = W * H;
      const scale = (LUT_SIZE - 1) / 2;
      for (let i = 0; i < n; i++) {
        const p = rearRe[i] * a + rearIm[i] * b + frontRe[i] * cp - frontIm[i] * sp;
        const v = p * 0.62;
        const clamped = v > 1 ? 1 : v < -1 ? -1 : v;
        data32[i] = lut[((clamped + 1) * scale) | 0];
      }
      offCtx.putImageData(img, 0, 0);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(off, 0, 0, canvas.width, canvas.height);
    };

    /** Patrón polar de campo lejano |c·e^{−jk(d/2)cosθ} + e^{jk(d/2)cosθ}|, normalizado a su máximo teórico. */
    const drawPolar = (mix) => {
      const phi = mix * (Math.PI / 2);
      const steps = 96;
      ctx.beginPath();
      for (let s = 0; s <= steps; s++) {
        const th = (s / steps) * 2 * Math.PI;
        const psi = (k * d * Math.cos(th)) / 2;
        const gain = Math.hypot(Math.cos(phi - psi) + Math.cos(psi), Math.sin(phi - psi) + Math.sin(psi)) / 2;
        const r = gain * rMax * ppm;
        const px = ax + r * Math.cos(th);
        const py = ay - r * Math.sin(th);
        if (s === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = isDark ? 'rgba(216,180,254,0.07)' : 'rgba(124,58,237,0.07)';
      ctx.fill();
      ctx.save();
      ctx.shadowColor = isDark ? 'rgba(192,132,252,0.9)' : 'rgba(124,58,237,0.35)';
      ctx.shadowBlur = 14;
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = isDark ? 'rgba(243,232,255,0.92)' : 'rgba(76,29,149,0.85)';
      ctx.stroke();
      ctx.restore();
    };

    const drawSources = () => {
      const dPx = d * ppm;
      const size = Math.min(13, dPx * 0.6);
      [
        { x: ax - dPx / 2, fill: '#F43F5E', label: 'S₁' },
        { x: ax + dPx / 2, fill: '#A855F7', label: 'S₂' },
      ].forEach(({ x, fill, label }) => {
        ctx.beginPath();
        ctx.roundRect(x - size / 2, ay - size / 2, size, size, 3);
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = isDark ? '#FFFFFF' : '#0B0712';
        ctx.stroke();
        ctx.font = '500 11px "IBM Plex Sans", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillStyle = isDark ? 'rgba(255,255,255,0.8)' : 'rgba(11,7,18,0.75)';
        ctx.fillText(label, x, ay - size / 2 - 5);
      });
    };

    const drawZoneLabels = () => {
      ctx.font = '500 13px "IBM Plex Sans", system-ui, sans-serif';
      ctx.textBaseline = 'middle';
      const tipX = ax + rMax * ppm + 14;
      ctx.textAlign = 'left';
      ctx.fillStyle = isDark ? '#E9D5FF' : '#5B21B6';
      if (tipX + 70 < cssW) ctx.fillText('público →', tipX, ay);
      ctx.textAlign = 'right';
      ctx.fillStyle = isDark ? '#FDA4AF' : '#BE123C';
      ctx.fillText('← escenario', ax - (d * ppm) / 2 - 18, ay);
    };

    const draw = (phase, mix) => {
      if (!ready) return;
      drawField(phase, mix);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawPolar(mix);
      drawSources();
      drawZoneLabels();
    };

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = null;
    let visible = true;
    let from = mixRef.current;
    let to = mixRef.current;
    let morphStart = 0;
    const start = performance.now();

    const setMix = (value) => {
      if (value === mixRef.current) return;
      mixRef.current = value;
      onMixRef.current?.(value);
    };

    const loop = (t) => {
      if (targetRef.current !== to) {
        from = mixRef.current;
        to = targetRef.current;
        morphStart = t;
      }
      if (mixRef.current !== to) {
        const u = Math.min((t - morphStart) / MORPH_MS, 1);
        const eased = u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2;
        setMix(u >= 1 ? to : from + (to - from) * eased);
      }
      if (visible) draw(((t - start) / WAVE_PERIOD_MS) * 2 * Math.PI, mixRef.current);
      raf = requestAnimationFrame(loop);
    };

    build();
    onMixRef.current?.(mixRef.current);

    if (reduce) {
      redrawRef.current = () => {
        setMix(targetRef.current);
        draw(STATIC_PHASE, mixRef.current);
      };
      redrawRef.current();
    } else {
      redrawRef.current = null;
      raf = requestAnimationFrame(loop);
    }

    // Las etiquetas del lienzo necesitan la fuente ya cargada cuando la animación está quieta
    if (reduce) document.fonts?.ready.then(() => redrawRef.current?.());

    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; });
    io.observe(canvas);
    const ro = new ResizeObserver(() => {
      build();
      if (reduce) draw(STATIC_PHASE, mixRef.current);
    });
    ro.observe(canvas);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      redrawRef.current = null;
      io.disconnect();
      ro.disconnect();
    };
  }, [frequency, c, theme]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      role="img"
      aria-label={
        cardioid
          ? 'Campo de presión del arreglo cardioide: las ondas avanzan hacia el público y casi desaparecen hacia el escenario'
          : 'Campo de presión de dos subwoofers en fase: las ondas se reparten por igual hacia el público y hacia el escenario'
      }
    />
  );
}
