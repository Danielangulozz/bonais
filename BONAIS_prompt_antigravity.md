# PROMPT PARA AGENTE DE IA (Antigravity): proyecto BONAIS

> Pega este documento completo como instrucción inicial. Está en español; el código usa identificadores en inglés y comentarios y textos de interfaz en español.

---

## 0. Cómo debes trabajar (léelo primero)

Actúa a la vez como **ingeniero de sonido con criterio de acústica de bajas frecuencias**, **desarrollador React senior** y **diseñador UI/UX de herramientas técnicas**. Vas a construir **BONAIS**, una aplicación web educativa para un proyecto de aula de **Cálculo III (Cálculo de Varias Variables)** de Ingeniería de Sonido.

Reglas de trabajo:

1. **Lee todo antes de escribir código.** Después inspecciona el workspace. Si contiene el repositorio **POZOLE** (React 18 + Vite + Tailwind + Recharts, con `Header`, `Sidebar`, `ExportModal`, `ReportModal`, `AcousticCharts`, `TheoryModal`, `SourceReceiver`, `roomPresets.js`), reutiliza su estructura y estilo y **elimina** lo específico de salas (`RoomDimensions`, `SurfaceMaterials`, `defaultMaterials.js`, `acousticCalculations.js`, `RoomVisualizer`). Si no existe, crea el proyecto desde cero. POZOLE es de otro equipo: conserva sus créditos en el README.
2. **Presenta primero un plan de implementación** por fases (sección 8) y avanza fase por fase. Al terminar cada fase ejecuta los tests y resume qué quedó hecho y qué no.
3. **El núcleo matemático va primero, con tests, antes que la interfaz.** Si un test numérico falla, arregla el núcleo antes de seguir.
4. **No inventes fórmulas.** Usa exactamente las de la sección 4. Si crees que hay un error, señálalo en tu resumen y no lo cambies en silencio.
5. **No agregues funciones fuera del alcance** (sección 2). Si sobra tiempo, propón mejoras al final en vez de implementarlas.
6. Si tienes navegador integrado, úsalo para verificar visualmente cada fase (mapa, paneles, modo claro/oscuro, ancho móvil de 375 px).

---

## 1. Contexto y propósito

**Qué es BONAIS.** Un simulador interactivo para **diseñar arreglos de subwoofers**. Muestra hacia dónde va la energía grave (mapa punto por punto), recomienda separación y retardo, y **hace visible el cálculo de varias variables** que hay detrás de cada resultado.

**Problema real que resuelve.** En sonido en vivo, un subwoofer solo radia casi igual en todas direcciones (a 40–100 Hz la longitud de onda mide 3,4 a 8,6 m). Los arreglos cardioides combinan dos o más fuentes con **polaridad invertida y retardo** para reforzar el sonido hacia el público y cancelarlo hacia el escenario. Los errores más comunes son:

- elegir separación y retardo "a ojo";
- no saber en **qué banda de frecuencias** funciona el arreglo;
- no saber **cuánto se degrada** la cancelación si el retardo o la distancia se desajustan un poco;
- sumar niveles en dB en vez de sumar presiones.

BONAIS responde: *¿qué separación y qué retardo uso, qué atenuación trasera obtengo, en qué banda funciona y qué tan delicado es el ajuste?*

**Contexto académico (importante).** No es un producto comercial. Todo resultado debe poder **deducirse a mano** por los estudiantes con contenidos de Cálculo III: funciones de dos variables, curvas de nivel, gradiente, puntos críticos con Hessiano, integrales dobles (cartesianas y polares) y optimización (incluidos multiplicadores de Lagrange). La app **no puede ser una caja negra**: muestra fórmulas, valores intermedios y verificaciones.

**Proyecto de aula (objetivos que la app debe poder responder).**

- **Objetivo general:** determinar la separación y el retardo entre dos subwoofers idénticos que dirigen la energía grave hacia el público y la reducen hacia el escenario, para frecuencias entre 40 y 100 Hz.
- **Específicos** y dónde los cubre la app:

| # | Objetivo específico | Dónde se responde |
|---|---|---|
| 1 | Establecer la condición de separación bajo la cual dos subs en fase se suman sin zonas de cancelación (d < λ/2) | Avisos de parámetros + Teoría + tests |
| 2 | Identificar máximos, mínimos y sillas del campo de energía y la dirección de mayor variación | Pestaña **Cálculo** (gradiente y puntos críticos) |
| 3 | Establecer la relación entre la energía con interferencia y la suma de energías por separado | Pestaña **Cálculo** (integral doble) |
| 4 | Determinar la separación y el retardo que maximizan la diferencia frente/atrás | Pestaña **Optimización** |
| 5 | Cuantificar la atenuación trasera (dB) y el cociente de energía público/escenario frente a dos subs en fase | Tarjetas de resultados + modo **Comparar** |
| 6 | Establecer cuánto se degrada la atenuación ante errores de retardo y separación | Pestaña **Sensibilidad** |

---

## 2. Alcance

**Incluye:** dos fuentes puntuales idénticas (ganancia, polaridad y retardo editables), campo libre, plano horizontal (x, y), **tono puro** de 20 a 200 Hz (foco 40–100 Hz), todo calculado en el navegador, sin backend.

**No incluye (déjalo explícito en la sección Teoría → Limitaciones):** efecto de sala, suelo o escenario (está documentado que un arreglo direccional colocado bajo el escenario pierde casi toda su direccionalidad), directividad propia de la caja, señales con varios armónicos, mediciones reales, más de dos fuentes, login, base de datos.

**Honestidad del modelo.** Es un **primer diseño ideal**. En el campo lejano y con fuentes puntuales la cancelación trasera es perfecta; los fabricantes reportan valores prácticos de hasta unos 15 dB. Muestra este aviso de forma visible junto a los resultados.

---

## 3. Decisión de stack

**Usa Vite + React 18 + JavaScript (sin TypeScript).**

- **Por qué Vite y no Next.js:** es una app 100 % del lado del cliente, sin rutas de servidor, sin SEO ni SSR. Next.js añadiría complejidad sin beneficio. Vite es lo que ya usa POZOLE y se despliega en Vercel como sitio estático (`vite build`).
- **Por qué JS:** la lógica matemática usa números complejos y funciones numéricas; se documenta con **JSDoc** (unidades y dominios) y se protege con tests, no con tipos.

Dependencias permitidas: `react`, `react-dom`, `vite`, `@vitejs/plugin-react`, `tailwindcss` (+ `postcss`, `autoprefixer`), `recharts`, `katex`, `vitest`, `eslint`, `prettier`, `@fontsource/*` (fuentes autoalojadas). **No** agregues librerías de estado global, kits de UI pesados ni librerías de álgebra/complejos (implementa la aritmética compleja mínima).

Estructura sugerida:

```
src/
  core/                 # matemática pura: sin React ni DOM, con JSDoc y tests
    constants.js  physics.js  complex.js  field.js  farField.js
    metrics.js  calculus/{gradient.js,criticalPoints.js,integrals.js,bessel.js}
    optimize.js  sensitivity.js  frequencyResponse.js
  render/               # heatmap.js (mapa de color + curvas de nivel), colormap.js
  workers/              # fieldWorker.js (solo si el rendimiento lo exige)
  state/                # store con useReducer + Context, sincronización con la URL
  components/           # Header, ControlPanel, FieldMap, ResultCards, panels/*, Theory, Export
  presets/arrayPresets.js
  theory/               # contenido de teoría (texto + fórmulas KaTeX)
tests/                  # *.test.js con Vitest
```

---

## 4. Modelo físico-matemático (fuente de verdad)

### 4.1 Convenciones
- SI: metros, segundos, hercios, radianes. En la interfaz, retardo en **ms**, ángulos en grados.
- Velocidad del sonido: `c = 331.3 * sqrt(1 + T/273.15)` con T en °C (defecto 20 °C, c ≈ 343 m/s). Los tests fijan `c = 343`.
- `ω = 2πf`, `k = ω/c`, `λ = c/f`.
- Convención temporal **e^{+jωt}**: una onda saliente es `exp(j(ωt − k r))`; **un retardo τ multiplica por `exp(−jωτ)`**; invertir polaridad multiplica por −1.
- **Eje del arreglo = eje x. Frente (público) = +x. Atrás (escenario) = −x.**
  Fuente 1 ("trasera") en `(−d/2, 0)`. Fuente 2 ("frontal") en `(+d/2, 0)`.

### 4.2 Campo de presión
Para cada fuente i: `c_i = g_i · s_i · exp(−j ω τ_i)` con `g_i ≥ 0` (ganancia lineal), `s_i ∈ {+1, −1}` (polaridad), `τ_i ≥ 0` (retardo).

```
r_i(x,y) = max( sqrt((x−x_i)² + (y−y_i)²), r_min )        r_min = 0.05 m
P(x,y)   = Σ_i  c_i · exp(−j k r_i) / r_i
E(x,y)   = |P|² = Re² + Im²                                (energía relativa)
L(x,y)   = 10·log10( max(E, 1e-12) / E_ref ),  E_ref = 1    (0 dB = una fuente unitaria a 1 m)
```
**Nunca sumes dB.** Suma presiones complejas (o energías) y convierte al final. Para derivadas, gradiente y puntos críticos usa **E**, no |P| ni L (|P| no es derivable en los nulos y L diverge).

### 4.3 Presets
- **Dos subs en fase:** ambas `s=+1`, `τ=0`.
- **Cardioide (end-fire):** fuente trasera `s=−1`, `τ = d/c`; fuente frontal `s=+1`, `τ=0`. Con `d = λ/4` (`τ = 1/(4f)`).
- **Personalizado:** todo editable.

### 4.4 Campo lejano (solución cerrada, útil para diagramas polares y tests)
Con θ medido desde +x y fuentes con `c_1, c_2`:
```
P_far(θ) ∝ c_2·exp(+j k d cosθ / 2) + c_1·exp(−j k d cosθ / 2)
```
Caso cardioide (`g=1`, `s_1=−1`, `τ_1=τ`):
```
|P_far(θ)| = 2 · | sin( (k d cosθ + ω τ) / 2 ) |
  frente  θ=0 :  2 |sin((kd + ωτ)/2)|
  atrás   θ=π :  2 |sin((ωτ − kd)/2)|      → se anula si  τ = d/c
Con τ = d/c:   |P_far| = 2 |sin( kd (1+cosθ)/2 )|      (frente = 2|sin(kd)|; máximo si kd = π/2 ⇒ d = λ/4)
```
Dos fuentes en fase: `|P_far| = 2 |cos(k d cosθ / 2)|`. Primer mínimo lateral: `sin θ = λ/(2d)` medido desde el eje **perpendicular** al arreglo (existe solo si `λ/(2d) ≤ 1`, es decir `d ≥ λ/2`). **Si d < λ/2 no hay cancelación en fase**.

### 4.5 Gradiente y Hessiano (analíticos, para poder deducirlos a mano)
```
∂P_i/∂x = c_i · exp(−j k r_i) · (−j k r_i − 1) · (x − x_i) / r_i³
∂P_i/∂y = c_i · exp(−j k r_i) · (−j k r_i − 1) · (y − y_i) / r_i³
∇E = 2 · Re( conj(P) · ∇P ),    ∇P = Σ_i ∇P_i
∇L = (10 / ln 10) · ∇E / E
```
Hessiano de E por **diferencias centrales del gradiente analítico** con `h = 1e-4 m`:
`E_xx ≈ (E_x(x+h,y) − E_x(x−h,y))/(2h)`, `E_xy ≈ (E_x(x,y+h) − E_x(x,y−h))/(2h)`, `E_yy ≈ (E_y(x,y+h) − E_y(x,y−h))/(2h)`.
Muestra en la interfaz una **verificación**: gradiente analítico vs. diferencia finita (debe coincidir a ~1e-6 relativo).

### 4.6 Puntos críticos (∇E = 0)
- Semillas en malla con paso `λ/8` sobre el área visible. Newton multivariable: resolver `H·δ = −∇E`, paso amortiguado (`|δ| ≤ 0.05 λ`), máx. 30 iteraciones, converge si `|δ| < 1e-6` m.
- Descarta puntos fuera del área, a menos de `max(0.15 m, 0.02 λ)` de una fuente, o con `|∇E|` residual grande. Deduplica a menos de `0.02 λ`.
- **Clasificación con el criterio del Hessiano:** `D = E_xx·E_yy − E_xy²`. Si `D > 0` y `E_xx < 0` → **máximo**; `D > 0` y `E_xx > 0` → **mínimo**; `D < 0` → **punto de silla**; `|D|` ≈ 0 (relativo a `E_xx²+E_yy²`, tolerancia 1e-6) → "no concluyente".
- Nota física: por la caída 1/r, los mínimos son **casi-nulos** profundos, no ceros exactos, salvo lejos de las fuentes.

### 4.7 Integrales dobles de energía
Región rectangular `[x0,x1]×[y0,y1]`, regla del punto medio con `N×N` celdas (N=200 por defecto, máx. 400), excluyendo celdas a menos de `r_ex = 0.12 m` de una fuente (informa cuántas se excluyeron):
```
I_int = ∬ E dA            (con interferencia)
I_sum = ∬ Σ_i g_i²/r_i² dA (energías de cada fuente por separado)
ρ     = I_int / I_sum
```
Convergencia: calcula también con N/2 y avisa si la diferencia relativa supera 2 %.

**Modo corona (coordenadas polares)** para validación: `∬ E r dr dθ` con `r ∈ [r1, r2]`, `θ ∈ [0, 2π]`, Δr ≤ λ/8 y ≥ 720 pasos en θ (defecto `r1=3 m`, `r2=100 m`).
**Resultado a verificar (dos fuentes en fase, corona completa lejos de las fuentes):**
```
ρ ≈ 1 + J0(k d)
J0(x) = (1/π) ∫_0^π cos(x sin t) dt        (regla del punto medio, 400 puntos)
```
Lectura física: la interferencia **redistribuye** la energía; el total no es la suma y depende de d y f. Con d → 0, ρ → 2.

### 4.8 Métricas del arreglo
- **Atenuación frente/atrás a distancia R** (defecto R = 10 m, editable 5–50 m):
  `A_R = 20·log10( |P(+R,0)| / |P(−R,0)| )` (en dB).
- **Atenuación en campo lejano ideal:** `A_ff = 20·log10( |P_far(0)| / |P_far(π)| )`; si el denominador es ~0 muestra "> 60 dB (ideal)".
- **Nivel frontal relativo al máximo coherente:** `G_front = 20·log10( |P_far(0)| / (g_1+g_2) )` (0 dB = las dos fuentes sumadas en fase perfecta). En cardioide ideal: `20·log10|sin(kd)|`.
- **Cociente de energía público/escenario:** con dos rectángulos editables, por defecto **Público** `[3,15]×[−8,8]` y **Escenario** `[−15,−3]×[−8,8]`:
  `Q_PE = 10·log10( ∬_público E dA / ∬_escenario E dA )`.
  Por simetría, dos subs en fase dan `Q_PE = 0 dB`.
- **Comparación** contra "dos subs en fase" con el mismo `d`, `f`, `g`: ΔA_R y ΔQ_PE.

### 4.9 Optimización (Cálculo III aplicado)
1. **Cerrada, una variable:** con `τ = d/c`, maximizar `F(d) = 4 sin²(kd)` ⇒ `F'(d) = 4k sin(2kd) = 0` y `F'' < 0` en `kd = π/2` ⇒ **`d* = λ/4`**, **`τ* = d*/c = 1/(4f)`**.
2. **Con restricción (Lagrange), dos variables:** maximizar `F(d,τ) = 4 sin²((kd + ωτ)/2)` sujeto a `G(d,τ) = ωτ − kd = 0` (nulo trasero). Con `u = (kd+ωτ)/2`: `∇F = 2 sin(2u)·(k, ω)` y `∇G = (−k, ω)`. Las condiciones dan `sin(2u) = 0` y, sobre la restricción, `u = kd`; el máximo es `kd = π/2`. Muestra estos pasos en la pestaña de teoría.
3. **Con límites físicos:** dado `d ∈ [d_min, d_max]` (por ejemplo por el fondo de la caja), como `|sin(kd)|` crece hasta `kd = π/2` y luego decrece, el óptimo es el `d` factible **más cercano a λ/4**; `τ = d/c`.
4. **Asistente de banda (min-max):** para cubrir una banda `[f1, f2]` con la menor pérdida de nivel frontal en los extremos, se iguala `sin(k1 d) = sin(k2 d)` ⇒ `k1 d + k2 d = π` ⇒
   **`d* = c / (2 (f1 + f2))`**, **`τ* = d*/c`**, pérdida en los bordes `20·log10 sin(k1 d*)`.
5. **Numérico (verificación):** ascenso por gradiente sobre `A_R(d, τ)` (con R fijo) usando gradiente por diferencias finitas, con búsqueda de línea; debe converger a la línea `τ = d/c`. Dibuja la trayectoria sobre el **mapa de decisión** (sección 5.4).

### 4.10 Sensibilidad
Para la configuración actual calcula `A_R` (y `A_ff`) con perturbaciones:
- `Δτ ∈ {±0.1, ±0.25, ±0.5, ±1} ms` y `Δd ∈ {±5, ±10, ±20} cm`, y su caída en dB respecto al valor nominal.
- Derivadas parciales `∂A_R/∂τ` y `∂A_R/∂d` (diferencias centrales).
- **Ventana de tolerancia:** rango de `τ` (y de `d`) en que `A_R ≥ umbral` (defecto 10 dB), por barrido.
Idea física: el nulo trasero depende de `ωτ − kd`; un error de retardo Δτ equivale a un error de fase `φ = ωΔτ`.

### 4.11 Respuesta del arreglo vs. frecuencia
Para `d` y `τ` fijos, barrer `f` de 20 a 200 Hz y graficar: `A_R(f)` y `G_front(f)` (dB). Con `τ = d/c` el nulo trasero se mantiene en todas las frecuencias y lo que limita la banda útil es el nivel frontal `|sin(kd)|`, que cae al alejarse de `kd = π/2` (y se anula en `kd = π`, es decir `d = λ/2`). Muestra la banda donde `G_front ≥ −3 dB` (para `τ = d/c`, `f ∈ [f_c/2, 3f_c/2]` con `f_c = c/(4d)`).

### 4.12 Vectores de prueba (tests obligatorios, `c = 343`)

| Caso | Resultado esperado |
|---|---|
| f=80 Hz, d=λ/4 | λ=4,2875 m; d=1,0719 m; τ=3,125 ms |
| Cardioide ideal 80 Hz, τ=d/c | `A_ff` > 60 dB; a θ=90° el nivel es −3,01 dB respecto al frente |
| Cardioide 80 Hz, d=λ/4, τ=d/c, R=10 m | `A_R` = 25,4 dB (±0,3) |
| Igual, pero τ = d/c + 1 ms (campo lejano) | `A_ff` = 11,8 dB (±0,1) |
| En fase, f=500 Hz, d=1 m | primer mínimo lejano a 20,06° del eje perpendicular |
| Corona 3–100 m, en fase, c=343 | ρ = 0,872 (500 Hz, d=1 m); 0,603 (200 Hz, d=1 m); 1,061 (500 Hz, d=0,25 m); tolerancia ±0,01 y coincide con `1+J0(kd)` |
| Banda 40–100 Hz | `d*` = 1,225 m; `τ*` = 3,571 ms; pérdida en bordes ≈ −2,14 dB |
| J0 | `J0(0)=1`; `J0(2.404825557695773)=0` (±1e-9) |
| Simetría en fase | `∂E/∂x(0,y)=0` y `Q_PE = 0 dB` |
| Derivadas | gradiente analítico = diferencia finita (rel. < 1e-6) en 50 puntos aleatorios |

---

## 5. Funcionalidades y experiencia de uso

### 5.1 Estructura de pantalla

```
Escritorio (≥ 1100 px)
┌──────────────────────────────────────────────────────────────────────────┐
│ BONAIS   [Presets ▾]   [Comparar]  [Exportar]  [Teoría]   [claro/oscuro] │
├───────────────┬──────────────────────────────────────┬───────────────────┤
│ Controles     │  MAPA (elemento principal)           │ Resultados        │
│  Básico       │  curvas de nivel, fuentes, regiones  │  A_R, A_ff        │
│  Avanzado     │                                      │  G_front, Q_PE    │
│  Asistente    │  ── barra de color en dB ──          │  Avisos           │
├───────────────┴──────────────────────────────────────┴───────────────────┤
│ Pestañas:  Cálculo │ Optimización │ Sensibilidad │ Frecuencia │ Teoría    │
└──────────────────────────────────────────────────────────────────────────┘
Móvil (375 px): mapa arriba; resultados en tarjetas horizontales; controles en panel
inferior desplegable; pestañas con desplazamiento horizontal.
```

### 5.2 Controles

| Control | Rango | Defecto | Notas |
|---|---|---|---|
| Frecuencia f | 20–200 Hz | 80 | Deslizador + campo numérico. Fuera de 40–100 Hz muestra aviso informativo |
| Separación d | 0,10–4,00 m | λ/4 (1,07 m) | Botón "d = λ/4" |
| Retardo de la fuente trasera τ | 0–20 ms | auto | Interruptor "Automático (τ = d/c)" activado por defecto |
| Polaridad y ganancia de cada fuente | ± ; −12…0 dB | +, 0 dB | La trasera cambia a − en el preset cardioide |
| Temperatura | 0–40 °C | 20 | Actualiza c, λ y τ automático |
| Distancia de referencia R | 5–50 m | 10 | Para `A_R` |
| Extensión del mapa ±L | 4–30 m | 12 | |
| Banda del asistente f1–f2 | 20–200 Hz | 40–100 | Calcula `d*` y `τ*` (4.9-4) |
| Límites de d (d_min, d_max) | 0,3–4 m | 0,5–2,0 | Para la optimización con restricciones |

Presets como botones visibles: **Dos subs en fase**, **Cardioide λ/4**, **Personalizado**.
Muestra siempre los valores derivados: `λ`, `c`, `k·d`, `d/λ`, `τ` ideal y `τ` actual.

### 5.3 Mapa (elemento principal)
- **Canvas 2D** con mapa de color del nivel `L` (rango −40 a +12 dB, ajustable) y **curvas de nivel cada 3 dB** (marching squares, líneas finas semitransparentes).
- Ejes en metros, fuentes dibujadas con el signo de su polaridad y su retardo, flecha de "Frente / público".
- Regiones **Público** y **Escenario** como rectángulos con manijas para arrastrar, con color distinto y etiqueta.
- Herramientas conmutables: **Punto** (clic = gradiente) y **Región** (arrastrar = integral).
- Capas opcionales: puntos críticos (círculo = mínimo, triángulo = máximo, cuadrado = silla; **no dependas solo del color**), líneas del primer mínimo en campo lejano, flecha del gradiente.
- Lectura al pasar el cursor: (x, y) y `L` en dB.
- Renderizado progresivo: baja resolución (~240×240) mientras se mueve un control y resolución completa (~480×480) tras 150 ms de reposo.

### 5.4 Pestañas

**Cálculo**
- *Punto:* al hacer clic muestra `r_1`, `r_2`, `P` (parte real, imaginaria, módulo y fase), `E`, `L`, `∇E` (analítico), `|∇E|`, dirección de mayor aumento, `∇L` en dB/m y la verificación contra diferencia finita. Bloque plegable **"Paso a paso"** con las fórmulas de 4.5 (KaTeX) y los números sustituidos. Recuerda que `∇E` es perpendicular a la curva de nivel que pasa por el punto.
- *Puntos críticos:* tabla (x, y, E, L, `E_xx`, `E_xy`, `E_yy`, `D`, tipo) con conteo por tipo; al hacer clic en una fila se resalta en el mapa. Aviso sobre casi-nulos.
- *Integral:* rectángulo dibujado o las regiones Público/Escenario; muestra `I_int`, `I_sum`, `ρ`, celdas excluidas y el chequeo de convergencia. Modo **corona** con la comparación contra `1 + J0(kd)` y una insignia "coincide (Δ = x %)".

**Optimización**
- Tarjetas: `d*` y `τ*` cerradas (4.9-1), versión con límites físicos (4.9-3), **asistente de banda** (4.9-4), y **verificación numérica** con insignia si coincide.
- **Mapa de decisión:** gráfico de curvas de nivel de `A_R(d, τ)` a la frecuencia actual, con `d` en x (0,2–3 m) y `τ` en y (0–15 ms). Dibuja la línea `τ = d/c`, el punto actual (arrastrable: cambia `d` y `τ`) y el óptimo. Botón **"Optimizar"** que ejecuta el ascenso por gradiente y muestra la trayectoria.
- Bloque plegable con la deducción (derivada y Lagrange) en KaTeX.

**Sensibilidad**
- Tabla de perturbaciones (4.10) y dos gráficas de `A_R` vs. `Δτ` y vs. `Δd` con bandas de tolerancia sombreadas. Frase automática: "Con 0,5 ms de error de retardo la atenuación trasera baja de X a Y dB".
- Derivadas parciales explicadas en una línea cada una.

**Frecuencia**
- Gráficas de `A_R(f)` y `G_front(f)` (Recharts) con la banda útil sombreada, y un **diagrama polar** a la frecuencia actual (campo lejano, en dB relativos al frente) superpuesto al de dos subs en fase.

**Teoría** (contenido propio con KaTeX)
Fase y suma de ondas → hipérbolas de refuerzo y cancelación → por qué `d < λ/2` no cancela → derivación del cardioide → gradiente, Hessiano y clasificación → la integral y `1 + J0(kd)` → optimización (derivada, Lagrange, min-max de banda) → sensibilidad → **Limitaciones** (sección 2) → glosario (fase, polaridad, retardo, campo lejano, dB, λ/4) → referencias.

### 5.5 Modo Comparar
Dos mapas lado a lado con la **misma escala y vista**: "Dos subs en fase (mismo d y f)" y "Configuración actual". Debajo, tabla con `A_R`, `Q_PE`, `G_front` y sus diferencias.

### 5.6 Exportar y compartir
- **CSV** (parámetros, resultados, tabla de sensibilidad, puntos críticos; separador `;` y coma decimal para abrir bien en Excel en español).
- **PNG** del mapa (`canvas.toBlob`).
- **Informe imprimible** con hoja de estilos de impresión: portada, parámetros, mapa, resultados, fórmulas usadas y limitaciones.
- **Enlace compartible:** el estado completo se codifica en los parámetros de la URL.

### 5.7 Avisos inteligentes (mensajes claros que dicen qué hacer)
- En fase y `d < λ/2`: "Las ondas nunca llegan en oposición de fase: no hay zonas de cancelación".
- Cardioide con `d < 0,125 λ` o `d > 0,375 λ`: "El nivel frontal cae más de 3 dB; acerca d a λ/4".
- `τ ≠ d/c`: "El nulo trasero se desplaza. Error de fase residual φ = X°".
- Región que contiene una fuente: "Se excluyó un disco alrededor de la fuente".
- Aviso permanente cerca de los resultados: modelo ideal en campo libre; no incluye escenario, suelo ni sala.

---

## 6. Sistema de diseño

**Concepto:** instrumento de medición de un estudio, sobrio y legible; **el mapa es el protagonista** y todo lo demás se mantiene en silencio visual. Sin degradados decorativos, sin efecto cristal, sin tarjetas idénticas con sombra.

**Color (tokens CSS, tema claro y oscuro; respeta `prefers-color-scheme` y permite conmutar):**

| Token | Oscuro | Claro |
|---|---|---|
| `--bg` | `#0E1318` | `#F3F5F7` |
| `--surface` / `--surface-2` | `#151C23` / `#1C252E` | `#FFFFFF` / `#EAEFF3` |
| `--border` | `#2A3541` | `#D5DCE3` |
| `--text` / `--muted` | `#E6EDF3` / `#93A1B0` | `#17212B` / `#566575` |
| `--accent` (señal, público) | `#3CC8D8` | `#0E7C8C` |
| `--warm` (escenario, avisos) | `#F0B429` | `#B7791F` |
| `--danger` / `--ok` | `#F26B5B` / `#5AC88A` | `#C53030` / `#2F855A` |

El mapa de color del campo usa una rampa secuencial perceptual tipo *magma* (implementada con paradas de color, sin librerías), pensada para daltonismo.

**Tipografía:** IBM Plex Sans para la interfaz y Source Serif 4 para los textos largos de Teoría (paquetes `@fontsource`, sin CDN). Números con `font-variant-numeric: tabular-nums`. Escala 12 / 14 / 16 / 20 / 28 px. Texto en minúscula normal (sin etiquetas en mayúsculas sostenidas), líneas de menos de 80 caracteres en Teoría.

**Principios de UX:**
- **Divulgación progresiva:** lo básico siempre visible; "Avanzado" plegado.
- **Respuesta inmediata:** mover un control actualiza el mapa en el mismo fotograma (baja resolución) y se afina al soltar.
- **Toda cifra lleva unidad** y un ícono "¿qué es?" que abre la entrada correspondiente de Teoría.
- **Los errores y avisos dicen qué pasó y cómo arreglarlo**, sin disculpas ni tono vago.
- **Un mismo verbo para la misma acción** en toda la app (p. ej. "Exportar", "Optimizar", "Comparar").
- Movimiento solo como respuesta a una acción del usuario y respetando `prefers-reduced-motion`.
- Español de Colombia, coma decimal (`Intl.NumberFormat('es-CO')`), dB con 1 decimal, ms con 2, m con 2.
- **Accesibilidad AA:** contraste suficiente, foco visible, controles operables con teclado, `aria-live` educado (limitado) para los resultados, texto alternativo del canvas que resuma la configuración, `lang="es"`.

---

## 7. Rendimiento y calidad

- Presupuesto: actualizar el mapa a 240×240 en menos de 16 ms mientras se mueve un control. Usa `Float64Array`, escribe el `ImageData` como `Uint32Array`, precalcula constantes por fotograma, evita crear objetos en los bucles internos y fusiona actualizaciones con `requestAnimationFrame`.
- Mide antes de optimizar. Si puntos críticos, corona o mapa de decisión superan ~50 ms, muévelos a un **Web Worker** (`new Worker(new URL(...), { type: 'module' })`).
- **Estado** con `useReducer` + Context; el estado derivado con `useMemo`; sincronizado con la URL (sin router).
- ESLint y Prettier configurados; `npm run test`, `npm run lint` y `npm run build` deben pasar sin advertencias.
- Cada función de `core/` con JSDoc que indique **unidades y dominio**.
- Comentarios en español que expliquen la **física**, no lo obvio del código.

---

## 8. Fases y criterios de aceptación

| Fase | Contenido | Se acepta cuando |
|---|---|---|
| **0. Andamiaje** | Vite + React + JS, Tailwind, ESLint, Vitest, estructura de carpetas, fuentes, tokens | `dev`, `build`, `lint` y `test` corren sin error |
| **1. Núcleo** | `core/` completo (4.1–4.11) | **Todos los vectores de 4.12 pasan** |
| **2. Mapa y controles** | Heatmap, curvas de nivel, controles, presets, tarjetas de resultados, avisos, URL, tema claro/oscuro | El mapa del cardioide a 80 Hz se ve como en la teoría (silencio detrás) y `A_R` ≈ 25,4 dB |
| **3. Cálculo** | Gradiente por clic, puntos críticos, integrales (rectángulo y corona), verificación | La corona reproduce `1 + J0(kd)`; críticos clasificados con Hessiano |
| **4. Optimización y análisis** | Optimización, mapa de decisión, sensibilidad, respuesta en frecuencia, polar | `d*`, `τ*` y la ventana de tolerancia coinciden con 4.9–4.10; el ascenso numérico converge a `τ = d/c` |
| **5. Cierre** | Comparar, Teoría con KaTeX, exportar/informe, accesibilidad, README | Recorrido completo en móvil y escritorio sin errores en consola |

---

## 9. Errores comunes que debes evitar

- Sumar o promediar **dB** directamente.
- Derivar `|P|` o `L` en vez de `E = |P|²`.
- Confundir el **signo del retardo** (`exp(−jωτ)`) o mezclar el 180° de polaridad con un retardo.
- No fijar `c = 343` en los tests (la temperatura cambia los resultados).
- Dejar la singularidad `1/r` en las fuentes sin `r_min` ni disco de exclusión.
- Mostrar `−∞ dB` en los nulos (usa el piso `E ≥ 1e-12` y limita la escala de color).
- Muestrear el mapa con paso mayor a `λ/8`.
- Renderizar el mapa como SVG (usa canvas).
- Prometer más de lo que el modelo puede dar: es campo libre ideal.
- Agregar dependencias o funciones fuera de lo permitido.

---

## 10. Entregables finales

1. Repositorio funcional con la estructura de la sección 3, listo para desplegar en Vercel como sitio estático.
2. `README.md`: qué es BONAIS, cómo ejecutarlo, resumen de la física, cómo verificar con los tests, limitaciones y créditos (incluye POZOLE si se reutilizó).
3. `docs/formulas.md`: copia de la sección 4 para consulta de los estudiantes.
4. Suite de tests con los vectores de 4.12 y un resumen del resultado.
5. Lista corta de **decisiones tomadas y supuestos** (por ejemplo, rangos y valores por defecto) y de mejoras propuestas que quedaron fuera.

**Si algo es ambiguo y bloquea el avance**, hazme como máximo tres preguntas concretas; si no bloquea, elige el valor por defecto de este documento, anótalo en la lista de supuestos y continúa.
