import React from 'react';
import katex from 'katex';

/**
 * Componente para renderizar expresiones matemáticas con KaTeX de forma segura.
 *
 * @param {Object} props
 * @param {string} props.math - Código LaTeX
 * @param {boolean} [props.block=false] - Modo bloque o en línea
 * @param {string} [props.className='']
 */
export default function KaTeXMath({ math, block = false, className = '' }) {
  try {
    const html = katex.renderToString(math, {
      displayMode: block,
      throwOnError: false,
    });
    return (
      <span
        className={className}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  } catch (err) {
    return <span className="text-danger font-mono">{math}</span>;
  }
}
