import React from 'react';
import KaTeXMath from '../KaTeXMath.jsx';
import { AlertTriangle } from 'lucide-react';

export default function TheoryPanel() {
  return (
    <article className="prose-theory mx-auto flex flex-col gap-6 text-sm text-text leading-relaxed p-2">
      <header className="border-b border-border pb-4">
        <h2 className="text-xl font-bold text-accent font-sans">
          Fundamentos Físicos y Matemáticos de Arreglos Cardioides
        </h2>
        <p className="text-muted text-xs font-sans mt-1">
          Guía conceptual para estudiantes de Cálculo de Varias Variables e Ingeniería de Sonido.
        </p>
      </header>

      {/* 1. FASE Y SUMA DE ONDAS */}
      <section className="flex flex-col gap-2">
        <h3 className="text-base font-bold text-text font-sans">1. Fase y Superposición de Ondas Esféricas</h3>
        <p>
          En acústica de bajas frecuencias (40 a 100 Hz), la longitud de onda sonora <KaTeXMath math="\lambda = c / f" /> oscila entre 3,4 m y 8,6 m, dimensiones mucho mayores que el tamaño físico de un subwoofer típico. Por ello, una caja acústica aislada se comporta como un radiador monopolar omnidireccional.
        </p>
        <p>
          La presión acústica compleja irradiada por una fuente puntual <KaTeXMath math="i" /> en un punto <KaTeXMath math="(x,y)" /> a distancia <KaTeXMath math="r_i" /> bajo la convención armónica <KaTeXMath math="e^{j\omega t}" /> se modela como:
        </p>
        <div className="p-3 bg-surface-2 rounded border border-border text-center overflow-x-auto my-1">
          <KaTeXMath math="P_i(x,y) = g_i \cdot s_i \cdot e^{-j\omega\tau_i} \cdot \frac{e^{-j k r_i}}{r_i}" block />
        </div>
        <p>
          donde <KaTeXMath math="g_i" /> es la ganancia lineal, <KaTeXMath math="s_i \in \{+1, -1\}" /> representa la polaridad eléctrica de los bornes del altavoz, <KaTeXMath math="\tau_i" /> es el retardo temporal y <KaTeXMath math="k = \omega / c = 2\pi / \lambda" /> es el número de onda espacial. La presión total resultante es la suma fasorial compleja:
        </p>
        <div className="p-3 bg-surface-2 rounded border border-border text-center overflow-x-auto my-1">
          <KaTeXMath math="P(x,y) = \sum_{i} P_i(x,y), \quad E(x,y) = |P(x,y)|^2" block />
        </div>
      </section>

      {/* 2. POR QUÉ d < lambda/2 NO CANCELA EN FASE */}
      <section className="flex flex-col gap-2">
        <h3 className="text-base font-bold text-text font-sans">2. La Condición Geométrica: Por qué d &lt; λ/2 no Cancela en Fase</h3>
        <p>
          Para dos fuentes con la misma polaridad (<KaTeXMath math="s_1 = s_2 = +1" />) y sin retardo (<KaTeXMath math="\tau = 0" />), la diferencia de caminos acústicos hacia cualquier punto del plano viene acotada por la desigualdad triangular:
        </p>
        <div className="p-3 bg-surface-2 rounded border border-border text-center overflow-x-auto my-1">
          <KaTeXMath math="|\Delta r| = |r_1 - r_2| \le d" block />
        </div>
        <p>
          Para que exista interferencia destructiva destructora total (oposición de fase de 180°), se requiere que la diferencia de caminos alcance al menos media longitud de onda: <KaTeXMath math="|\Delta r| = \lambda / 2" />.
        </p>
        <p className="font-semibold text-warm">
          Consecuencia física: Si <KaTeXMath math="d < \lambda / 2" />, es geométricamente imposible que los frentes de onda lleguen con desfase de 180°. Por tanto, dos subwoofers en fase separados menos de medio ciclo suman constructivamente en todo el espacio horizontal.
        </p>
      </section>

      {/* 3. DERIVACIÓN DEL ARREGLO CARDIOIDE */}
      <section className="flex flex-col gap-2">
        <h3 className="text-base font-bold text-text font-sans">3. Derivación del Arreglo Cardioide (End-Fire Invertido)</h3>
        <p>
          Para obligar a que se produzca una cancelación trasera (<KaTeXMath math="\theta = \pi" />, eje <KaTeXMath math="-x" /> hacia el escenario), invertimos la polaridad de la fuente trasera (<KaTeXMath math="s_1 = -1" />) y le aplicamos un retardo electrónico igual al tiempo de propagación entre cajas:
        </p>
        <div className="p-3 bg-surface-2 rounded border border-border text-center overflow-x-auto my-1">
          <KaTeXMath math="\tau = \frac{d}{c}" block />
        </div>
        <p>
          Hacia atrás, la onda de la caja frontal recorre la distancia <KaTeXMath math="d" /> en un tiempo <KaTeXMath math="d/c" />, encontrándose con la emisión de la caja trasera que se disparó con retardo <KaTeXMath math="\tau = d/c" /> e inversión de 180°. Las dos ondas coinciden con exactamente la misma fase espacial pero polaridad opuesta: <strong>cancelación perfecta hacia el escenario</strong>.
        </p>
        <p>
          Hacia el frente (<KaTeXMath math="\theta = 0" />), el desfase total entre las dos ondas es <KaTeXMath math="\Delta \phi = k d + \omega \tau = 2 k d" />. Al sumar con la inversión de polaridad (<KaTeXMath math="e^{j\pi}" />), la ganancia frontal es máxima cuando <KaTeXMath math="2 k d = \pi \implies d = \lambda / 4" />.
        </p>
      </section>

      {/* 4. CÁLCULO MULTIVARIABLE APLICADO */}
      <section className="flex flex-col gap-2">
        <h3 className="text-base font-bold text-text font-sans">4. Cálculo de Varias Variables: Gradiente, Hessiano y Bessel</h3>
        <p>
          En BONAIS, cada aspecto acústico se deriva formalmente mediante cálculo diferencial e integral:
        </p>
        <ul className="list-disc list-inside flex flex-col gap-2 pl-2">
          <li>
            <strong>Gradiente espacial de energía (∇E):</strong> Es ortogonal a las curvas de nivel isofónicas y apunta hacia la dirección de máximo crecimiento acústico. Se calcula con la derivada del producto hermitiano <KaTeXMath math="\nabla E = 2\operatorname{Re}(\overline{P}\nabla P)" />.
          </li>
          <li>
            <strong>Clasificación con la matriz Hessiana:</strong> Los puntos donde <KaTeXMath math="\nabla E = 0" /> se clasifican mediante el determinante <KaTeXMath math="D = E_{xx} E_{yy} - E_{xy}^2" />. Si <KaTeXMath math="D > 0" /> y <KaTeXMath math="E_{xx} > 0" /> es un casi-nulo (mínimo local); si <KaTeXMath math="D < 0" /> es un punto de silla hiperbólico.
          </li>
          <li>
            <strong>Teorema de redistribución de energía:</strong> Al integrar en una corona circular lejana <KaTeXMath math="[r_1, r_2] \times [0, 2\pi]" />, el cociente entre la energía real y la suma de fuentes incoherentes converge analíticamente a <KaTeXMath math="\rho \approx 1 + \dfrac{2\,\mathrm{Re}(c_1\bar c_2)}{g_1^2+g_2^2}\,J_0(kd)" />, donde <KaTeXMath math="J_0" /> es la función de Bessel de orden cero. En fase vale <KaTeXMath math="1 + J_0(kd)" />; en el cardioide con <KaTeXMath math="\tau = d/c" />, <KaTeXMath math="1 - \cos(kd)\,J_0(kd)" />.
          </li>
        </ul>
      </section>

      {/* 5. LIMITACIONES DEL MODELO */}
      <section className="p-4 bg-surface-2 border border-border rounded-lg flex flex-col gap-2 text-xs">
        <div className="flex items-center gap-2 font-bold text-warm text-sm font-sans">
          <AlertTriangle className="h-4 w-4 text-warm" />
          <span>Limitaciones Físicas del Modelo (Honestidad del Simulador)</span>
        </div>
        <p className="text-muted">
          Este software implementa un modelo de primer diseño en <strong>campo libre ideal</strong>. En situaciones prácticas de sonido en vivo se deben tener en cuenta las siguientes restricciones:
        </p>
        <ul className="list-disc list-inside text-muted flex flex-col gap-1 pl-2">
          <li><strong>Efecto de suelo y escenario:</strong> Si el arreglo se ubica debajo de un escenario hueco o cerrado, las reflexiones internas y la carga acústica destruyen casi por completo la cardioididad.</li>
          <li><strong>Reflexiones de sala:</strong> Las paredes laterales y traseras generan ondas estacionarias y modos resonantes que alteran la cancelación.</li>
          <li><strong>Directividad de la caja:</strong> A frecuencias mayores a 150 Hz, las dimensiones de la caja dejan de ser despreciables y aparece difracción.</li>
          <li><strong>Señales complejas:</strong> El cálculo asume tonos puros monocromáticos continuos. En señales transitorias musicales, el retardo temporal produce dispersión en el ataque de bombos y bajos.</li>
        </ul>
      </section>

      {/* 6. GLOSARIO Y REFERENCIAS */}
      <section className="border-t border-border pt-4 flex flex-col gap-3">
        <h3 className="text-base font-bold text-text font-sans">Glosario y Referencias Académicas</h3>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="p-2 bg-surface-2 rounded border border-border">
            <dt className="font-bold text-text">Frente / Público (+x):</dt>
            <dd className="text-muted">Eje hacia donde se busca enfocar la energía acústica coherente.</dd>
          </div>
          <div className="p-2 bg-surface-2 rounded border border-border">
            <dt className="font-bold text-text">Atrás / Escenario (−x):</dt>
            <dd className="text-muted">Zona de músicos y micrófonos donde se maximiza la atenuación.</dd>
          </div>
          <div className="p-2 bg-surface-2 rounded border border-border">
            <dt className="font-bold text-text">Separación λ/4:</dt>
            <dd className="text-muted">Separación de un cuarto de longitud de onda que balancea máxima ganancia y nulo trasero.</dd>
          </div>
          <div className="p-2 bg-surface-2 rounded border border-border">
            <dt className="font-bold text-text">Atenuación A_R (dB):</dt>
            <dd className="text-muted">Cociente logarítmico de presiones frente/atrás a distancia de referencia R.</dd>
          </div>
        </dl>

        <div className="text-[11px] text-muted flex flex-col gap-1 mt-2">
          <span className="font-semibold text-text">Bibliografía recomendada:</span>
          <span>• McCarthy, B. (2016). <em>Sound Systems: Design and Optimization</em>. Focal Press.</span>
          <span>• Olson, H. F. (1957). <em>Acoustical Engineering</em>. D. Van Nostrand Company.</span>
          <span>• D&apos;Antonio, P., &amp; Cox, T. (2016). <em>Acoustic Absorbers and Diffusers</em>. CRC Press.</span>
        </div>
      </section>
    </article>
  );
}
