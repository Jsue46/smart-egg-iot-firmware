# Módulo de Visión Computacional con Inteligencia Artificial
## SmartEgg: Incubadora Inteligente IoT (Fase 3)

Este módulo implementa el reconocimiento visual y sistema de seguridad crítico para la incubadora SmartEgg mediante **OpenCV** y **Machine Learning**.

---

### 1. Clases Visuales Detectadas

El sistema clasifica en tiempo real cada fotograma en tres condiciones operativas fundamentales:

| Clase | Descripción | Comportamiento del Sistema |
| :--- | :--- | :--- |
| **`huevo`** | Huevo real posicionado sobre la bandeja/rejilla de incubación. | Operación normal y conteo de días/ciclo permitido. |
| **`objeto_extrano`** | Cualquier elemento no autorizado (tijeras, llaves, monedas, bloques plásticos, etc.). | **ALARMA CRÍTICA Y BLOQUEO TOTAL**: Se apaga calefacción y ventilación, suena buzzer físico y se bloquea la plataforma. |
| **`vacio`** | Bandeja o compartimiento sin ningún elemento. | Modo espera o recarga. |

---

### 2. Arquitectura de Extracción de Características

Para garantizar robustez frente a diferentes niveles de iluminación y sombras dentro de la incubadora, se procesa una Región de Interés (ROI) central y se extrae un vector de características híbrido de **46 dimensiones**:

1. **Histogramas de Color HSV (28 bins):**
   - 12 bins para tono (H), 8 bins para saturación (S) y 8 bins para valor/brillo (V).
   - Discrimina tonos biológicos naturales del cascarón (crema, marfil, pardo) frente a colores artificiales o superficies metálicas.
2. **Estadísticas de Distribución (6 bins):**
   - Media y desviación estándar de cada canal HSV para medir balance general de color.
3. **Morfología y Momentos de Hu (12 bins):**
   - Densidad de bordes mediante algoritmo **Canny** y magnitud de gradiente **Sobel**.
   - Solidez y circularidad del contorno principal: los huevos presentan solidez convexa cercana a 1.0 y curvatura suave; los objetos extraños presentan esquinas agudas, concavidades y bordes rectilíneos.
   - Momentos invariantes de Hu (7 valores en escala logarítmica).

---

### 3. Métricas y Desempeño del Modelo

El clasificador se basa en un **Random Forest** balanceado entrenado con validación cruzada (*5-fold stratified cross-validation*).

* **Exactitud promedio:** **99.05%** (+/- 1.90%).
* **Matriz de Confusión y F1-Score:** Disponibles y exportadas en la gráfica `metricas_modelo.png`.

---

### 4. Estructura de Archivos del Módulo

* `capturar_dataset.py`: Herramienta interactiva con cámara en vivo para tomar fotografías clasificadas con tu celular (Iriun Webcam) o webcam.
* `generar_dataset_inicial.py`: Generador de muestras sintéticas con variaciones de luz y ángulo para inicializar el dataset.
* `entrenar_modelo.py`: Extractor de características, entrenamiento con scikit-learn, cálculo de métricas y exportación de `modelo_vision.joblib`.
* `detector_vision.py`: Ejecución en vivo de OpenCV con HUD gráfico, conexión MQTT y lógica de bloqueo automático.
* `dataset/`:
  * `dataset/huevo/`
  * `dataset/objeto_extrano/`
  * `dataset/vacio/`
* `metricas_modelo.png`: Evidencia gráfica de matriz de confusión para el reporte técnico.
* `modelo_vision.joblib`: Modelo serializado listo para inferencia en tiempo real.

---

### 5. Guía de Ejecución Rápida

#### Paso 1: Captura de fotos reales (Opcional, si deseas sumar más fotos de tu maqueta)
```bash
python vision/capturar_dataset.py
```
* Pulsa **`H`** para guardar como Huevo.
* Pulsa **`O`** para guardar como Objeto Extraño.
* Pulsa **`V`** para guardar como Vacío.
* Pulsa **`Q`** para salir.

#### Paso 2: Entrenar el modelo
```bash
python vision/entrenar_modelo.py
```

#### Paso 3: Ejecutar el detector en tiempo real
```bash
python vision/detector_vision.py
```

*Controles durante la ejecución en vivo:*
* **`[ESPACIO]`**: Inicia / Detiene el ciclo de incubación.
  * Si el ciclo está **iniciado** y se coloca un **objeto extraño**, a los pocos fotogramas el sistema dispara la orden de bloqueo por MQTT.
* **`[B]`**: Forzar prueba manual de bloqueo inmediato.
* **`[R]`**: Desbloquear / Resetear el sistema a estado normal.
* **`[Q]`**: Salir.

---

### 6. Integración con Hardware y Tópicos MQTT

1. **Tópico de Telemetría Visual:**
   * `smartegg/SE-01/vision/estado`
   * *Payload:*
     ```json
     {
       "nodo_id": "SE-01",
       "clase": "huevo",
       "confianza": 0.985,
       "ciclo_activo": true,
       "bloqueado": false,
       "motivo": "operacion_normal",
       "timestamp": "2026-10-16T00:00:00Z"
     }
     ```

2. **Tópico de Control de Bloqueo:**
   * `smartegg/SE-01/control/bloqueo`
   * *Payload de Bloqueo:* `{"bloquear": true, "motivo": "objeto_extrano_detectado"}`
   * *Payload de Desbloqueo:* `{"bloquear": false, "motivo": "desbloqueado_manual"}`

3. **Reacción Física en Arduino (`firmware.ino`):**
   * El script `backend/serial_bridge.py` escucha `smartegg/SE-01/control/bloqueo` y envía por serial `CMD:BLOQUEAR` a la placa.
   * La incubadora física **apaga el foco (relé) y el ventilador**, enciende la **luz roja de advertencia (Pin 13)**, activa la **alarma sonora con el buzzer (Pin 8)** y muestra en la pantalla LCD:
     ```text
     !BLOQUEO VISION!
     OBJETO INVALIDO
     ```
