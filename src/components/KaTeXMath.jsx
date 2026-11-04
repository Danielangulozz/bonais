import React from 'react';
import katex from 'katex';

// Caché de renderizado: las fórmulas en vivo se re-evalúan en cada fotograma;
// si el texto LaTeX no cambió, se reutiliza el HTML ya generado.
const CACHE = new Map();
const CACHE_LIMIT = 800;

function render(math, block) {
  const key = (block ? 'B|' : 'I|') + math;
  const hit = CACHE.get(key);
  if (hit !== undefined) return hit;
  const html = katex.renderToString(math, { displayMode: block, throwOnError: false });
  if (CACHE.size >= CACHE_LIMIT) CACHE.delete(CACHE.keys().next().value);
  CACHE.set(key, html);
  return html;
}

/**
 * Renderiza expresiones matemáticas con KaTeX.
 *
 * @param {Object} props
 * @param {string} props.math - Código LaTeX
 * @param {boolean} [props.block=false] - Modo bloque o en línea
 * @param {string} [props.className='']
 */
function KaTeXMath({ math, block = false, className = '' }) {
  try {
    return <span className={className} dangerouslySetInnerHTML={{ __html: render(math, block) }} />;
  } catch (err) {
    return <span className="text-danger font-mono">{math}</span>;
  }
}

export default React.memo(KaTeXMath);
