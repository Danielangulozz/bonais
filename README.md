# BONAIS — Simulador y Optimización de Arreglos Cardioides de Subwoofers

**BONAIS** es una herramienta web interactiva orientada a la ingeniería de sonido y diseñada para visualizar y deducir rigurosamente el **Cálculo de Varias Variables (Cálculo III)** que fundamenta el comportamiento de los arreglos direccionales de bajas frecuencias (40–100 Hz).

---

## 1. ¿Qué problema resuelve BONAIS?

En sonido en vivo, una caja de subwoofer aislada radia energía de forma casi omnidireccional debido a que la longitud de onda sonora (3,4 a 8,6 m) es mucho mayor que las dimensiones físicas de la caja. Los arreglos cardioides combinan dos o más fuentes con **inversión de polaridad y retardo temporal** para enfocar la energía acústica hacia el público y crear una zona de cancelación profunda hacia el escenario.

BONAIS responde con precisión de ingeniería y rigor matemático:
- ¿Qué separación física ($d$) y qué retardo temporal ($\tau$) producen el máximo rendimiento?
- ¿Por qué dos fuentes en fase no cancelan si $d < \lambda/2$?
- ¿Hacia dónde varía con mayor rapidez la energía sonora en cualquier punto del espacio ($\nabla E$)?
- ¿Cómo se clasifican los puntos críticos de interferencia mediante la matriz Hessiana?
- ¿Cuánto se degrada la atenuación trasera ante desajustes milimétricos o de milisegundos?

---

## 2. Puesta en Marcha Local

### Requisitos
- **Node.js**: v18+ (probado en Node.js v24.x)
- **npm**: v9+

### Instalación y Ejecución

```bash
# 1. Clonar el repositorio y navegar a la carpeta
cd BONAIS

# 2. Instalar dependencias
npm install

# 3. Iniciar el servidor de desarrollo interactivo
npm run dev

# 4. Abrir en el navegador en http://localhost:3000/ (o el puerto indicado)
```

### Comandos Disponibles

| Comando | Descripción |
|---|---|
| `npm run dev` | Inicia el servidor de desarrollo Vite con Hot Module Replacement (HMR). |
| `npm run test` | Ejecuta la suite de pruebas automatizadas con Vitest validando los 10 vectores canónicos de física y cálculo. |
| `npm run build` | Compila la aplicación optimizada para producción en la carpeta `dist/`. |
| `npm run preview` | Previsualiza el build de producción localmente. |
| `npm run lint` | Ejecuta el análisis estático de código con ESLint. |

---

## 3. Verificación con Tests Matemáticos Obligatorios

Para verificar la exactitud de todas las formulaciones numéricas y analíticas, ejecuta:

```bash
npm run test
```

La suite de pruebas (`tests/vectors.test.js`) valida el 100% de los siguientes vectores canónicos fijando $c = 343{,}0\text{ m/s}$:
1. **$f = 80\text{ Hz}, d = \lambda/4$:** $\lambda = 4{,}2875\text{ m}, d = 1{,}0719\text{ m}, \tau = 3{,}125\text{ ms}$.
2. **Cardioide ideal a 80 Hz ($\tau = d/c$):** $A_{\text{ff}} > 60\text{ dB}$; a $\theta = 90^\circ$ el nivel es $-3{,}01\text{ dB}$ respecto al frente.
3. **Cardioide a 80 Hz a $R = 10\text{ m}$:** $A_R = 25{,}4\text{ dB} \ (\pm 0{,}3)$.
4. **Desajuste de retardo $\tau = d/c + 1\text{ ms}$ en campo lejano:** $A_{\text{ff}} = 11{,}8\text{ dB} \ (\pm 0{,}1)$.
5. **Fuentes en fase ($f = 500\text{ Hz}, d = 1\text{ m}$):** Primer mínimo lejano a $20{,}06^\circ$ del eje perpendicular.
6. **Corona polar 3–100 m en fase:** Reproduce $\rho \approx 1 + J_0(kd)$ dentro de $\pm 0{,}01$ para múltiples combinaciones.
7. **Banda min-max 40–100 Hz:** $d^* = 1{,}225\text{ m}, \tau^* = 3{,}571\text{ ms}$, pérdida en bordes $\approx -2{,}14\text{ dB}$.
8. **Función de Bessel:** $J_0(0) = 1$ y $J_0(2{,}404825557695773) = 0 \ (\pm 10^{-9})$.
9. **Simetría física en fase:** $\frac{\partial E}{\partial x}(0, y) = 0$ y $Q_{\text{PE}} = 0\text{ dB}$.
10. **Exactitud del gradiente:** Concordancia entre gradiente analítico y diferencias finitas con error relativo $< 10^{-5}$ en puntos espaciales arbitrarios.

---

## 4. Resumen de la Física y Módulos de la Aplicación

- **Campo Acústico (`src/core/field.js`):** Superposición de presiones complejas $P(x,y)$ con amortiguamiento esférico $1/r$ y umbral de regularización $r_{\min} = 0{,}05\text{ m}$.
- **Gradiente y Hessiano (`src/core/calculus/`):** Cálculo analítico exacto de $\nabla E = 2\operatorname{Re}(\overline{P}\nabla P)$ y matriz Hessiana para clasificar máximos, casi-nulos y puntos de silla hiperbólicos.
- **Integrales Dobles y Teorema de Bessel:** Validación del principio de conservación y redistribución de energía mediante integración en mallas rectangulares y coronas polares.
- **Mapa de Decisión y Optimización (`src/core/optimize.js`):** Solución cerrada para $\lambda/4$, método de multiplicadores de Lagrange, optimización con cotas físicas $[d_{\min}, d_{\max}]$, criterio min-max de banda y ascenso por gradiente numérico.
- **Sensibilidad (`src/core/sensitivity.js`):** Análisis de tolerancia ante desviaciones milimétricas ($\Delta d$) y de reloj ($\Delta \tau$), derivadas marginales y ventana de tolerancia para $A_R \ge 10\text{ dB}$.
- **Respuesta en Frecuencia y Polar (`src/core/frequencyResponse.js`):** Barrido 20–200 Hz con Recharts y trazado de diagrama polar de radiación a 360 grados.

---

## 5. Decisiones Tomadas y Supuestos del Modelo

1. **Plano Bidimensional Horizontal $(x, y)$:** Se modela la interacción en el plano de propagación horizontal entre las cajas.
2. **Aproximación de Campo Libre:** Se consideran fuentes monopolares omnidireccionales en espacio libre sin paredes ni límites.
3. **Piso de Ruido Numérico:** Para evitar singularidades en los nulos profundos, se aplica un suelo mínimo de energía $E \ge 10^{-12}$ (equivalente a $-120\text{ dB}$).
4. **Paleta Perceptual Magma:** Se implementó una rampa continua accesible para daltonismo con precomputación de enteros `Uint32` para renderizar el Canvas a 60 FPS.
5. **Formato Numérico y Exportación:** Configurado para español de Colombia (`es-CO`), con coma decimal y delimitador de punto y coma (`;`) en archivos CSV para apertura directa en Microsoft Excel.

---

## 6. Limitaciones del Modelo

- **Efecto de Suelo y Escenario:** En el mundo real, colocar arreglos direccionales debajo de un escenario hueco destruye gran parte de la directividad debido a reflexiones y carga de cavidad.
- **Directividad Propia de la Caja:** El modelo asume fuentes puntuales ideales. Para frecuencias mayores a 150 Hz, la difracción en las aristas de la caja comienza a influir.
- **Cancelación Práctica en Campo Real:** En condiciones ideales de simulación la atenuación teórica puede superar 40–60 dB; en mediciones prácticas de campo los fabricantes reportan típicamente entre 15 y 20 dB de atenuación trasera útil.

---

## 7. Mejoras Propuestas para Futuras Versiones

- Soporte para arreglos de 3 fuentes (cardioide en gradiente invertido de 3 elementos o configuración *end-fire* de 3 etapas).
- Inclusión del plano tridimensional $(x, y, z)$ con reflexión semiesférica de suelo (plano infinito de reflexión perfecta).
- Carga de mediciones acústicas experimentales en formato de archivo de texto/CSV para contrastar simulación vs. medición con micrófono de referencia.

---

## 8. Créditos y Reconocimientos

- **BONAIS** ha sido desarrollado como proyecto de aula interactivo para la asignatura de **Cálculo de Varias Variables (Cálculo III)** en la carrera de **Ingeniería de Sonido**.
- Se reconocen y agradecen los conceptos estructurales y de diseño de herramientas técnicas del proyecto **POZOLE** desarrollado previamente por el equipo de acústica.
