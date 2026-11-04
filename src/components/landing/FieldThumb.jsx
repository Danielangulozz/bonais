import React, { useEffect, useRef } from 'react';
import { computeFieldGrid } from '../../core/field.js';
import { MAGMA_UINT32_TABLE, getPaletteIndex } from '../../render/colormap.js';

/**
 * Mapa estático del nivel L(x, y) = 10·log₁₀|P|² para una configuración dada,
 * con las regiones de público (morado) y escenario (rojo) superpuestas.
 */
export default function FieldThumb({ precomputedSources, k, audienceRegion, stageRegion, label }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return undefined;

    const render = () => {
      const rect = canvas.getBoundingClientRect();
      // Con la portada oculta el tamaño es 0: se espera al siguiente aviso de ResizeObserver
      if (rect.width < 1 || rect.height < 1) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      const ctx = canvas.getContext('2d');

      const aspect = rect.width / Math.max(rect.height, 1);
      const halfY = 10;
      const halfX = halfY * aspect;
      const xMin = -halfX;
      const xMax = halfX;
      const yMin = -halfY;
      const yMax = halfY;
      const w = 220;
      const h = Math.max(60, Math.round(w / aspect));
      const { levelGrid } = computeFieldGrid({ precomputedSources, k, xMin, xMax, yMin, yMax, width: w, height: h });

      const off = document.createElement('canvas');
      off.width = w;
      off.height = h;
      const offCtx = off.getContext('2d');
      const img = offCtx.createImageData(w, h);
      const d32 = new Uint32Array(img.data.buffer);
      for (let i = 0; i < w * h; i++) d32[i] = MAGMA_UINT32_TABLE[getPaletteIndex(levelGrid[i], -40, 12)];
      offCtx.putImageData(img, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(off, 0, 0, canvas.width, canvas.height);

      const toPx = (x, y) => [((x - xMin) / (xMax - xMin)) * canvas.width, ((yMax - y) / (yMax - yMin)) * canvas.height];
      const drawRegion = (r, color) => {
        const [x0, y0] = toPx(r.xMin, r.yMax);
        const [x1, y1] = toPx(r.xMax, r.yMin);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5 * dpr;
        ctx.setLineDash([5 * dpr, 4 * dpr]);
        ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
      };
      drawRegion(stageRegion, 'rgba(244,63,94,0.9)');
      drawRegion(audienceRegion, 'rgba(192,132,252,0.95)');
      ctx.setLineDash([]);
      precomputedSources.forEach((s, i) => {
        const [px, py] = toPx(s.x, s.y);
        ctx.fillStyle = i === 0 ? '#F43F5E' : '#A855F7';
        ctx.beginPath();
        ctx.arc(px, py, 4.5 * dpr, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 1.2 * dpr;
        ctx.stroke();
      });
    };

    render();
    const ro = new ResizeObserver(render);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [precomputedSources, k, audienceRegion, stageRegion]);

  return <canvas ref={ref} className="w-full aspect-[16/10] rounded-2xl" role="img" aria-label={label} />;
}
