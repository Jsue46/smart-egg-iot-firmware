# SmartEgg: Incubadora Inteligente IoT — Fase 3

**Universidad de San Carlos de Guatemala**  
Facultad de Ingeniería — Escuela de Ciencias y Sistemas  
Arquitectura de Computadores y Ensambladores 2 (Segundo Semestre 2026)  
Catedrático: Ing. Gabriel Alejandro Díaz  
Auxiliares: Josue Antonio Cux Barrientos, Marcos Geovani Josías Pérez Secay  

---

## 📋 Resumen del Proyecto

La **Fase 3 de SmartEgg** consolida la evolución de una incubadora IoT tradicional hacia una plataforma inteligente y autónoma, cerrando las tres brechas operativas críticas identificadas en la Fase 2:
1. **Percepción Visual Inteligente (OpenCV + ML):** Reconocimiento en tiempo real del contenido de la cabina (`huevo`, `objeto_extrano`, `vacio`). Si se inicia un ciclo y la cámara detecta un objeto no autorizado, se activa la alarma física y el sistema se bloquea por completo.
2. **Análisis Predictivo de Fallas (Isolation Forest):** Detección temprana de anomalías térmicas y de humedad antes de que ocurran fallas críticas o mortandad embrionaria.
3. **Gestión Inteligente de Energía Eléctrica:** Medición y cálculo de potencia instantánea (Watts) y consumo acumulado (kWh), temporizadores de corte y límites de potencia.
4. **Despliegue y Observabilidad en la Nube (Microsoft Azure):** Despliegue en VM Linux con Docker Compose (Mosquitto MQTT, PostgreSQL, Grafana, ML Service, Backend) y hosting estático del Dashboard interactivo p5.js en Azure Blob Storage.

---

## 🛠️ Arquitectura y Capas del Framework IoT

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             CAPA DE APLICACIÓN                              │
│   • Dashboard Grafana Cloud (Métricas en tiempo real e históricas)          │
│   • Dashboard Interactivo p5.js (Azure Blob Storage - MQTT WebSockets 9001)  │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ MQTT / WebSockets
┌──────────────────────────────────────▼──────────────────────────────────────┐
│                    CAPA DE PROCESAMIENTO Y SERVICIOS                        │
│   • Broker MQTT Eclipse Mosquitto (Puerto 1883 TCP / 9001 WS)                │
│   • Servicio de Detección de Anomalías ML (Isolation Forest - scikit-learn) │
│   • Servicio de Gestión Energética y Persistencia (Flask / psycopg3)        │
│   • Base de Datos Relacional PostgreSQL 16 (Esquema + Vistas Fase 3)        │
└──────────────────────────────────────▲──────────────────────────────────────┘
                                       │ MQTT TCP (Internet / Red Local)
┌──────────────────────────────────────┴──────────────────────────────────────┐
│                         CAPA DE RED Y ENLACE (EDGE)                         │
│   • Túnel Serial <-> MQTT (backend/serial_bridge.py)                        │
│   • Módulo de Visión Computacional OpenCV en Vivo (vision/detector_vision.py)│
└──────────────────────────────────────▲──────────────────────────────────────┘
                                       │ UART Serial / Video USB (Iriun)
┌──────────────────────────────────────┴──────────────────────────────────────┐
│                            CAPA DE PERCEPCIÓN                               │
│   • Nodo Físico Arduino Mega 2560 (DHT11, Servomotor, Lector RFID RC522)    │
│   • Actuadores: Foco Calefactor (Relé), Ventilador DC 12V, Buzzer Alarma    │
│   • Señalización Luminosa de Bloqueo (LED Pin 13) y Pantalla LCD 16x2 I2C   │
│   • Cámara de Inspección Interna (Smartphone / Iriun Webcam / USB)          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## ⚙️ Manual Técnico

> **Documentación Detallada del Sistema:**
> * [Manual Técnico Completo](docs/ManualTecnico.md) — Arquitectura, modelo E-R, tópicos MQTT, OpenAPI y Valor Disruptivo.
> * [Manual de Usuario Completo](docs/ManualUsuario.md) — Uso de Grafana, Dashboard p5.js, consola web y resolución de incidentes.
> * [Guion y Diapositivas del Pitch de 5 Minutos](docs/Pitch_Presentacion_5min.md) — Venta a fondo de innovación, checklist de demo y Q&A técnico.
> * [Bitácora de Desarrollo de Fase 3](docs/BitacoraDesarrollo.md) — Sprints, matriz de responsabilidades e hitos de integración.
> * [Especificación OpenAPI 3.0 (docs/openapi.yaml)](docs/openapi.yaml) — Contratos REST del backend.
> * [Scripts SQL de Auditoría y Calificación (infra/sql/grafana_queries_fase3.sql)](infra/sql/grafana_queries_fase3.sql)

### 1. Documentación de Tópicos MQTT (Comunicación Exclusiva)
El control y monitoreo opera **exclusivamente mediante MQTT**, eliminando APIs intermediarias para el flujo de telemetría y actuación.

| Tópico | QoS | Retained | Payload JSON | Propósito |
| :--- | :---: | :---: | :--- | :--- |
| `smartegg/SE-01/status` | 1 | Sí | `{"nodo_id":"SE-01","estado":"online","valor":1,"timestamp":"..."}` | Disponibilidad y Last Will (LWT = offline). |
| `smartegg/SE-01/sensores/temperatura` | 0 | No | `{"nodo_id":"SE-01","valor":37.5,"unidad":"°C","timestamp":"..."}` | Lecturas térmicas en vivo. |
| `smartegg/SE-01/sensores/humedad` | 0 | No | `{"nodo_id":"SE-01","valor":58.0,"unidad":"%","timestamp":"..."}` | Humedad relativa en vivo. |
| `smartegg/SE-01/actuadores/estado` | 1 | Sí | `{"nodo_id":"SE-01","foco":"ON","ventilador":"OFF","rotacion_grados":45.0}` | Estado de relés y servomotor. |
| `smartegg/SE-01/vision/estado` | 0 | No | `{"nodo_id":"SE-01","clase":"huevo","confianza":0.985,"bloqueado":false}` | Clasificación OpenCV en tiempo real. |
| `smartegg/SE-01/control/bloqueo` | 1 | Sí | `{"nodo_id":"SE-01","bloquear":true,"motivo":"objeto_extrano_detectado"}` | Orden de bloqueo hacia el Arduino y dashboards. |
| `smartegg/SE-01/ml/anomalia` | 1 | Sí | `{"nodo_id":"SE-01","anomalia":false,"score":-0.0125,"umbral":-0.0052}` | Inferencia predictiva de Isolation Forest. |
| `smartegg/SE-01/energia/consumo` | 0 | No | `{"nodo_id":"SE-01","watts":68.5,"kwh":0.142,"limite_watts":80.0}` | Potencia instantánea y acumulación. |
| `smartegg/SE-01/control/energia` | 1 | No | `{"limite_watts":85.0,"temporizador_minutos":30}` | Configuración dinámica de energía y timer. |
| `smartegg/SE-01/control/actuadores` | 1 | Sí | `{"accion":"APAGAR","motivo":"temporizador_vencido"}` o `{"accion":"REANUDAR","motivo":"temporizador_programado"}` | Última orden del servicio de energía al puente serial al vencer, reprogramar o cancelar el temporizador. |
| `smartegg/SE-01/alarmas/critica` | 1 | Sí | `{"id":"...","tipo":"BLOQUEO_SEGURIDAD_VISION","activa":true}` | Notificación de alarma crítica en Grafana. |

---

### 2. Base de Datos (Modelo Entidad-Relación y Tablas Fase 3)

La base de datos relacional PostgreSQL almacena la serie temporal y las bitácoras forenses. En la Fase 3 se incorporan tres tablas principales y tres vistas analíticas:

1. **`mediciones_energia`**: Registro temporal de potencia (Watts), energía (kWh), voltaje (120V) y corriente (Amperios) por componente.
2. **`registro_anomalias_ml`**: Historial de inferencias predictivas emitidas por el modelo `Isolation Forest`, puntuaciones atípicas y etiquetas de desviación.
3. **`eventos_seguridad_vision`**: Bitácora de incidentes visuales, tipo de objeto invasor, porcentaje de confianza y duración del estado de bloqueo.

#### Consultas SQL de Calificación (Auditoría Forense):

* **Consultar últimas mediciones de consumo energético:**
  ```sql
  SELECT timestamp, potencia_watts, consumo_kwh, foco_watts, ventilador_watts
  FROM mediciones_energia
  WHERE nodo_id = 'SE-01'
  ORDER BY timestamp DESC LIMIT 10;
  ```

* **Consultar incidentes de bloqueo por visión artificial:**
  ```sql
  SELECT timestamp, objeto_detectado, confianza, estado_bloqueo, motivo
  FROM eventos_seguridad_vision
  WHERE nodo_id = 'SE-01'
  ORDER BY timestamp DESC;
  ```

* **Consultar anomalías predictivas detectadas por Machine Learning:**
  ```sql
  SELECT timestamp, temperatura, humedad, score_anomalia, umbral, detalle
  FROM registro_anomalias_ml
  WHERE es_anomalia = true
  ORDER BY timestamp DESC;
  ```

---

### 3. Justificación Técnica del Consumo Eléctrico

Los valores de potencia y energía se sustentan en especificaciones físicas de componentes de incubación avícola:
* **Foco calefactor incandescente:** $60.0\text{ W}$ (cuando el relé está cerrado en modo calentamiento).
* **Ventilador DC 12V / 0.4A:** $5.0\text{ W}$ (conmutado por MOSFET o transistor).
* **Servomotor SG90 / MG996R (volteo):** $2.5\text{ W}$ en rotación activa ($0.5\text{ W}$ en reposo).
* **Consumo base de electrónica (Arduino, sensores, LEDs, LCD):** $3.0\text{ W}$ constantes.
* **Potencia Total Nominal Activa:** $60.0 + 5.0 + 2.5 + 3.0 = 70.5\text{ W}$.
* **Consumo Energético Integrado:** $\text{kWh} = \sum \frac{P_i \times \Delta t}{3600 \times 1000}$.
* **Umbral de Alerta por Sobreconsumo:** $80.0\text{ W}$ (indica falla en relé, cortocircuito o activación simultánea de cargas no autorizadas).

---

### 4. Justificación del Valor Disruptivo
El **bloqueo automático de bioseguridad mediante visión computacional** constituye el valor disruptivo del sistema. A diferencia de incubadoras comerciales que operan a ciegas confiando únicamente en la telemetría numérica, SmartEgg detecta objetos extraños, herramientas olvidadas o plagas dentro del nido, cortando de inmediato la energía de calefacción para evitar incendios o contaminación biológica.

---

## 💻 Manual de Usuario

### 1. Interpretación del Dashboard en Grafana
* Acceso: `http://<IP_AZURE>:3000` (Usuario: `admin` / Clave: `admin`).
* **Panel de Temperatura y Humedad:** Muestra gráficas temporales con umbrales verde (óptimo 37.5°C), amarillo y rojo.
* **Panel de Visión y Seguridad:** Muestra la insignia del estado actual (`HUEVO` o `BLOQUEADO`).
* **Panel de Anomalías Predictivas:** Gráfica del score de `Isolation Forest`; si el score supera `-0.0052`, se resalta en rojo.
* **Panel de Consumo Energético:** Gráfico de Watts y totalizador de kWh acumulados.
* **Campana de Alertas:** Notifica eventos de `alert-bloqueo-vision-objeto` y `alert-sobreconsumo-electrico`.

### 2. Uso del Dashboard Interactivo en p5.js
* Acceso: Hospedado en Azure Blob Storage (o `frontend/public/visualizacion_p5.html`).
* Desde el encabezado de **Panel**, el botón **Abrir dashboard p5.js** abre esta interfaz en una pestaña nueva.
* **Gráficas 2D:** Cambia entre las tendencias MQTT de temperatura, humedad y potencia; al pasar sobre una lectura se muestra su valor.
* **Estado del sistema:** Las tarjetas muestran visión, ML, actuadores y energía. Los campos permanecen vacíos hasta recibir datos MQTT.
* **Control de Potencia:** Slider interactivo para ajustar el límite de corte de energía (50W - 150W).
* **Temporizador:** Botón para fijar ciclos de conexión eléctrica programada.
* **Reacción de Bloqueo:** Si ocurre un bloqueo, la interfaz despliega una pantalla de alarma roja con el motivo del incidente y un botón seguro de **Desbloqueo**.

---

## 🚀 Guía de Puesta en Marcha

### A. Despliegue en Microsoft Azure (Nube)
Desde PowerShell en la carpeta raíz del proyecto:
```powershell
.\infra\azure\desplegar_azure.ps1
```
El script creará automáticamente el Resource Group, la VM Ubuntu (`Standard_B2s`), las reglas de firewall, el auto-apagado de ahorro de créditos a las 23:00 hrs, levantará el stack Docker Compose y desplegará el dashboard p5.js en Azure Blob Storage.

### B. Ejecución Local de la Maqueta y Cámara

1. **Subir firmware a Arduino:**
   * Abrir `firmware/firmware.ino` en Arduino IDE y subir a la placa Arduino Mega 2560.
2. **Probar la cámara (Iriun Webcam):**
   ```powershell
   python vision/probar_camara.py
   ```
3. **Iniciar el enlace Serial <-> Nube:**
   ```powershell
   python backend/serial_bridge.py --mqtt-host <IP_PUBLICA_AZURE>
   ```
4. **Iniciar el detector de Visión Artificial:**
   ```powershell
   python vision/detector_vision.py --mqtt-host <IP_PUBLICA_AZURE>
   ```

---

## 🎤 Guion del Pitch de Presentación (5 Minutos)

* **Minuto 0:00 - 1:00 (Problema y Oportunidad):**
  *"En la industria avícola y biomédica, una falla térmica de 2 horas arruina miles de embriones. Pero peor aún: las incubadoras actuales son 'ciegas'; no saben si hay un huevo real o un objeto extraño que provoque un incendio. Presentamos SmartEgg IoT."*
* **Minuto 1:00 - 2:00 (Arquitectura y Nube):**
  *"SmartEgg combina un nodo físico local con despliegue en Microsoft Azure. Nuestra nube procesa telemetría MQTT sobre WebSockets, persiste en PostgreSQL y monitorea métricas en tiempo real en Grafana y en un dashboard interactivo en p5.js."*
* **Minuto 2:00 - 3:30 (Demostración en Vivo — El momento 'WOW'):**
  1. Mostrar la incubadora física operando con un huevo normal. En pantalla se observa `HUEVO (98.5% CONF)` y el foco calentando.
  2. Retirar el huevo e introducir una tijera/llave/objeto extraño.
  3. **Reacción inmediata:** En 200 ms la cámara OpenCV detecta `OBJETO EXTRAÑO`. Suena el buzzer físico, se enciende la luz de bloqueo, el foco se apaga y la pantalla de p5.js y Grafana entran en estado de bloqueo total.
* **Minuto 3:30 - 4:30 (Inteligencia Predictiva y Energía):**
  *"Demostramos nuestro modelo Isolation Forest previniendo desvíos térmicos sutiles y el gestor de consumo en Watts y kWh garantizando eficiencia energética."*
* **Minuto 4:30 - 5:00 (Cierre y Preguntas):**
  *"SmartEgg transforma la avicultura de una reacción tardía a una supervisión autónoma y predictiva. Quedamos a su disposición para la ronda de preguntas técnicas."*
