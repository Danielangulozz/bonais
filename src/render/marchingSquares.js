/**
 * @file marchingSquares.js
 * @description Algoritmo de Marching Squares para generar y renderizar curvas de nivel isofónicas (isolíneas de SPL)
 * a intervalos regulares (ej. cada 3 dB) sobre el Canvas 2D.
 */

/**
 * Interpola linealmente la posición espacial entre dos vértices según el isovalor.
 *
 * @param {number} v1 - Valor en vértice 1
 * @param {number} v2 - Valor en vértice 2
 * @param {number} p1 - Posición del vértice 1
 * @param {number} p2 - Posición del vértice 2
 * @param {number} isovalue - Valor de la curva de nivel
 * @returns {number} Posición interpolada
 */
function interpolate(v1, v2, p1, p2, isovalue) {
  if (Math.abs(v2 - v1) < 1e-9) return (p1 + p2) / 2;
  const t = (isovalue - v1) / (v2 - v1);
  return p1 + t * (p2 - p1);
}

/**
 * Genera segmentos de línea para un conjunto de curvas de nivel sobre una malla rectangular.
 *
 * @param {Object} options
 * @param {Float64Array} options.levelGrid - Matriz 1D de niveles SPL en dB
 * @param {number} options.width - Columnas
 * @param {number} options.height - Filas
 * @param {number} options.xMin - [m]
 * @param {number} options.xMax - [m]
 * @param {number} options.yMin - [m]
 * @param {number} options.yMax - [m]
 * @param {number[]} options.isovalues - Lista de niveles dB a trazar (ej. -36, -33, ...)
 * @returns {Map<number, Array<{x1: number, y1: number, x2: number, y2: number}>>}
 */
export function generateContourSegments({
  levelGrid,
  width,
  height,
  xMin,
  xMax,
  yMin,
  yMax,
  isovalues,
}) {
  const dx = (xMax - xMin) / (width - 1);
  const dy = (yMax - yMin) / (height - 1);

  const contourMap = new Map();
  for (let k = 0; k < isovalues.length; k++) {
    contourMap.set(isovalues[k], []);
  }

  for (let j = 0; j < height - 1; j++) {
    const yTop = yMax - j * dy;
    const yBottom = yMax - (j + 1) * dy;

    for (let i = 0; i < width - 1; i++) {
      const xLeft = xMin + i * dx;
      const xRight = xMin + (i + 1) * dx;

      // 4 esquinas de la celda:
      // v0: top-left (i, j)
      // v1: top-right (i+1, j)
      // v2: bottom-right (i+1, j+1)
      // v3: bottom-left (i, j+1)
      const v0 = levelGrid[j * width + i];
      const v1 = levelGrid[j * width + (i + 1)];
      const v2 = levelGrid[(j + 1) * width + (i + 1)];
      const v3 = levelGrid[(j + 1) * width + i];

      const minCellVal = Math.min(v0, v1, v2, v3);
      const maxCellVal = Math.max(v0, v1, v2, v3);

      for (let k = 0; k < isovalues.length; k++) {
        const iso = isovalues[k];
        if (iso < minCellVal || iso > maxCellVal) continue;

        let mask = 0;
        if (v0 >= iso) mask |= 8;
        if (v1 >= iso) mask |= 4;
        if (v2 >= iso) mask |= 2;
        if (v3 >= iso) mask |= 1;

        if (mask === 0 || mask === 15) continue;

        // Puntos sobre los 4 bordes:
        // Top: entre v0 y v1
        const topPt = { x: interpolate(v0, v1, xLeft, xRight, iso), y: yTop };
        // Right: entre v1 y v2
        const rightPt = { x: xRight, y: interpolate(v1, v2, yTop, yBottom, iso) };
        // Bottom: entre v3 y v2
        const bottomPt = { x: interpolate(v3, v2, xLeft, xRight, iso), y: yBottom };
        // Left: entre v0 y v3
        const leftPt = { x: xLeft, y: interpolate(v0, v3, yTop, yBottom, iso) };

        const segments = contourMap.get(iso);

        switch (mask) {
          case 1:
          case 14:
            segments.push({ x1: leftPt.x, y1: leftPt.y, x2: bottomPt.x, y2: bottomPt.y });
            break;
          case 2:
          case 13:
            segments.push({ x1: bottomPt.x, y1: bottomPt.y, x2: rightPt.x, y2: rightPt.y });
            break;
          case 3:
          case 12:
            segments.push({ x1: leftPt.x, y1: leftPt.y, x2: rightPt.x, y2: rightPt.y });
            break;
          case 4:
          case 11:
            segments.push({ x1: topPt.x, y1: topPt.y, x2: rightPt.x, y2: rightPt.y });
            break;
          case 5:
            // Silla ambigua
            segments.push({ x1: leftPt.x, y1: leftPt.y, x2: topPt.x, y2: topPt.y });
            segments.push({ x1: bottomPt.x, y1: bottomPt.y, x2: rightPt.x, y2: rightPt.y });
            break;
          case 10:
            // Silla ambigua
            segments.push({ x1: topPt.x, y1: topPt.y, x2: rightPt.x, y2: rightPt.y });
            segments.push({ x1: leftPt.x, y1: leftPt.y, x2: bottomPt.x, y2: bottomPt.y });
            break;
          case 6:
          case 9:
            segments.push({ x1: topPt.x, y1: topPt.y, x2: bottomPt.x, y2: bottomPt.y });
            break;
          case 7:
          case 8:
            segments.push({ x1: leftPt.x, y1: leftPt.y, x2: topPt.x, y2: topPt.y });
            break;
        }
      }
    }
  }

  return contourMap;
}

/**
 * Dibuja las curvas de nivel sobre un contexto 2D de Canvas con transformación de coordenadas.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Map<number, Array<{x1: number, y1: number, x2: number, y2: number}>>} contourMap
 * @param {Function} worldToCanvas - Función (x, y) => { cx, cy }
 * @param {string} [lineColor='rgba(255, 255, 255, 0.25)']
 */
export function drawContoursOnCanvas(
  ctx,
  contourMap,
  worldToCanvas,
  lineColor = 'rgba(255, 255, 255, 0.22)'
) {
  ctx.save();
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = 1.0;
  ctx.beginPath();

  contourMap.forEach((segments) => {
    for (let s = 0; s < segments.length; s++) {
      const seg = segments[s];
      const p1 = worldToCanvas(seg.x1, seg.y1);
      const p2 = worldToCanvas(seg.x2, seg.y2);
      ctx.moveTo(p1.cx, p1.cy);
      ctx.lineTo(p2.cx, p2.cy);
    }
  });

  ctx.stroke();
  ctx.restore();
}
