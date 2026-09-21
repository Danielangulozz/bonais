# Compendio Físico-Matemático de BONAIS (Cálculo III)

> Documento de consulta técnica y académica para estudiantes de Ingeniería de Sonido y Cálculo de Varias Variables.

---

## 1. Convenciones y Parámetros Fundamentales

- **Sistema Internacional:** Distancias en metros ($m$), tiempo en segundos ($s$), frecuencias en hercios ($Hz$), ángulos en radianes ($rad$) para el cálculo y grados ($^\circ$) en la interfaz. Retardos temporales expresados en milisegundos ($ms$) en visualización.
- **Velocidad del sonido en el aire:**
  $$c(T) = 331{,}3 \sqrt{1 + \frac{T}{273{,}15}} \quad [\text{m/s}]$$
  A temperatura estándar de $20^\circ\text{C}$, $c \approx 343{,}14\text{ m/s}$ (en vectores de prueba canónicos se fija $c = 343{,}0\text{ m/s}$).
- **Relaciones ondulatorias:**
  $$\omega = 2\pi f \quad [\text{rad/s}], \quad k = \frac{\omega}{c} = \frac{2\pi}{\lambda} \quad [\text{rad/m}], \quad \lambda = \frac{c}{f} \quad [\text{m}]$$
- **Convención temporal armónica:** Se adopta la convención $e^{+j\omega t}$. Una onda saliente progresiva es $\exp(j(\omega t - k r))$.
  - Un retardo temporal $\tau$ multiplica por $\exp(-j\omega\tau)$.
  - Una inversión de polaridad eléctrica multiplica por $-1 = e^{j\pi}$.
- **Geometría del arreglo:**
  - Eje del arreglo sobre el eje $x$.
  - Frente (zona de audiencia / público): $+x$.
  - Atrás (zona de músicos / escenario): $-x$.
  - Fuente 1 ("trasera"): $\mathbf{r}_1 = (-d/2, 0)$.
  - Fuente 2 ("frontal"): $\mathbf{r}_2 = (+d/2, 0)$.

---

## 2. Campo Acústico de Presión y Energía

Para cada fuente puntual $i \in \{1, 2\}$, el coeficiente complejo de excitación es:
$$c_i = g_i \cdot s_i \cdot e^{-j\omega\tau_i}$$
donde $g_i \ge 0$ es la ganancia de amplitud lineal, $s_i \in \{+1, -1\}$ es la polaridad y $\tau_i \ge 0$ es el retardo temporal.

La distancia euclidiana regularizada para evitar singularidades numéricas es:
$$r_i(x,y) = \max\left(\sqrt{(x - x_i)^2 + (y - y_i)^2}, \, r_{\min}\right), \quad r_{\min} = 0{,}05\text{ m}$$

La superposición fasorial de presión acústica compleja es:
$$P(x,y) = \sum_{i} c_i \frac{e^{-j k r_i(x,y)}}{r_i(x,y)}$$

La energía acústica relativa $E$ (proporcional al cuadrado de la presión eficaz) es:
$$E(x,y) = |P(x,y)|^2 = \operatorname{Re}(P)^2 + \operatorname{Im}(P)^2$$

El nivel relativo SPL en decibelios $L$ respecto a una fuente unitaria a 1 metro ($E_{\text{ref}} = 1{,}0$) es:
$$L(x,y) = 10 \log_{10}\left( \frac{\max(E(x,y), \, 10^{-12})}{E_{\text{ref}}} \right) \quad [\text{dB}]$$

---

## 3. Campo Lejano y Condiciones Asintóticas

Con el ángulo $\theta$ medido desde el eje $+x$ (frente):
$$P_{\text{far}}(\theta) \propto c_2 e^{+j k d \cos\theta / 2} + c_1 e^{-j k d \cos\theta / 2}$$

### Caso Cardioide ($g_1=g_2=1, s_1=-1, s_2=+1, \tau_1=\tau, \tau_2=0$):
$$|P_{\text{far}}(\theta)| = 2 \left| \sin\left( \frac{k d \cos\theta + \omega \tau}{2} \right) \right|$$
- Hacia el frente ($\theta = 0$): $|P_{\text{far}}(0)| = 2 \left| \sin\left(\frac{kd + \omega\tau}{2}\right) \right|$.
- Hacia atrás ($\theta = \pi$): $|P_{\text{far}}(\pi)| = 2 \left| \sin\left(\frac{\omega\tau - kd}{2}\right) \right|$.
- El nulo trasero perfecto se obtiene cuando $\omega\tau - kd = 0 \iff \tau = \frac{d}{c}$.
- Con $\tau = d/c$, la amplitud frontal resulta $2|\sin(kd)|$, alcanzando su máximo absoluto cuando $kd = \pi/2 \iff d = \lambda/4$.

### Dos fuentes en fase ($s_1=s_2=+1, \tau_1=\tau_2=0$):
$$|P_{\text{far}}(\theta)| = 2 \left| \cos\left( \frac{k d \cos\theta}{2} \right) \right|$$
El primer mínimo lateral en campo lejano se produce a un ángulo $\beta$ respecto al eje perpendicular ($y$):
$$\sin\beta = \frac{\lambda}{2d}$$
Este mínimo solo existe físicamente si $\frac{\lambda}{2d} \le 1 \iff d \ge \frac{\lambda}{2}$. Por consiguiente, **si $d < \lambda/2$, no existen zonas de cancelación para dos fuentes en fase**.

---

## 4. Gradiente y Hessiano de la Energía (Cálculo Multivariable)

Las derivadas analíticas del campo de presión para cada fuente son:
$$\frac{\partial P_i}{\partial x} = c_i \cdot e^{-j k r_i} \cdot (-j k r_i - 1) \cdot \frac{x - x_i}{r_i^3}$$
$$\frac{\partial P_i}{\partial y} = c_i \cdot e^{-j k r_i} \cdot (-j k r_i - 1) \cdot \frac{y - y_i}{r_i^3}$$
$$\nabla P = \sum_i \nabla P_i = \begin{pmatrix} \sum_i \partial P_i / \partial x \\ \sum_i \partial P_i / \partial y \end{pmatrix}$$

El gradiente espacial de la energía acústica $E = P \cdot \overline{P}$ es:
$$\nabla E = 2 \operatorname{Re}\left( \overline{P} \cdot \nabla P \right) = 2 \begin{pmatrix} \operatorname{Re}(P)\frac{\partial P_x}{\partial x} + \operatorname{Im}(P)\frac{\partial P_y}{\partial x} \\ \operatorname{Re}(P)\frac{\partial P_x}{\partial y} + \operatorname{Im}(P)\frac{\partial P_y}{\partial y} \end{pmatrix}$$

Para la tasa espacial de cambio del nivel en decibelios:
$$\nabla L = \left( \frac{10}{\ln 10} \right) \frac{\nabla E}{E} \quad [\text{dB/m}]$$

La matriz Hessiana $H(E)$ se aproxima por diferencias centrales del gradiente analítico con paso $h = 10^{-4}\text{ m}$:
$$E_{xx} \approx \frac{\nabla E_x(x+h,y) - \nabla E_x(x-h,y)}{2h}, \quad E_{yy} \approx \frac{\nabla E_y(x,y+h) - \nabla E_y(x,y-h)}{2h}$$
$$E_{xy} \approx \frac{\nabla E_x(x,y+h) - \nabla E_x(x,y-h)}{2h}$$
$$D = \det(H) = E_{xx} E_{yy} - E_{xy}^2$$

### Criterio de clasificación de puntos críticos ($\nabla E = 0$):
- Si $D > 0$ y $E_{xx} < 0$: **Máximo local**.
- Si $D > 0$ y $E_{xx} > 0$: **Mínimo local (casi-nulo)**.
- Si $D < 0$: **Punto de silla hiperbólico**.
- Si $D = 0$ (o $|D| / (E_{xx}^2 + E_{yy}^2) < 10^{-6}$): **No concluyente**.

---

## 5. Integrales Dobles y Teorema Polar de Bessel

En regiones rectangulares $[x_0, x_1] \times [y_0, y_1]$ se aplica la regla del punto medio con exclusión de discos de radio $r_{\text{ex}} = 0{,}12\text{ m}$ alrededor de cada fuente:
$$I_{\text{int}} = \iint E \, dA \quad (\text{energía real con interferencia})$$
$$I_{\text{sum}} = \iint \left( \frac{g_1^2}{r_1^2} + \frac{g_2^2}{r_2^2} \right) dA \quad (\text{energía incoherente})$$
$$\rho = \frac{I_{\text{int}}}{I_{\text{sum}}}$$

En coordenadas polares sobre una corona circular completa lejana $[r_1, r_2] \times [0, 2\pi]$ con dos fuentes en fase:
$$\rho \approx 1 + J_0(kd)$$
donde $J_0(x)$ es la función de Bessel de primera especie y orden cero:
$$J_0(x) = \frac{1}{\pi} \int_{0}^{\pi} \cos(x \sin t) \, dt$$

---

## 6. Métricas del Arreglo y Optimización

- **Atenuación frente/atrás a distancia $R$ ($A_R$):**
  $$A_R = 20 \log_{10}\left( \frac{|P(+R, 0)|}{|P(-R, 0)|} \right) \quad [\text{dB}]$$
- **Atenuación en campo lejano ($A_{\text{ff}}$):**
  $$A_{\text{ff}} = 20 \log_{10}\left( \frac{|P_{\text{far}}(0)|}{|P_{\text{far}}(\pi)|} \right) \quad [\text{dB}]$$
- **Ganancia frontal respecto a suma coherente ($G_{\text{front}}$):**
  $$G_{\text{front}} = 20 \log_{10}\left( \frac{|P_{\text{far}}(0)|}{g_1 + g_2} \right) \quad [\text{dB}]$$
- **Cociente de energía Público / Escenario ($Q_{\text{PE}}$):**
  $$Q_{\text{PE}} = 10 \log_{10}\left( \frac{\iint_{\text{público}} E \, dA}{\iint_{\text{escenario}} E \, dA} \right) \quad [\text{dB}]$$
- **Optimización de banda (criterio min-max para $[f_1, f_2]$):**
  $$d^* = \frac{c}{2(f_1 + f_2)}, \quad \tau^* = \frac{d^*}{c}, \quad \text{Pérdida en bordes} = 20 \log_{10}\sin(k_1 d^*) \quad [\text{dB}]$$
