# Infraestructura y Dashboards de Grafana — SmartEgg (Fase 3)

Este directorio contiene las fuentes de datos, dashboards versionados, reglas de alerta unificadas y herramientas de prueba para la infraestructura de observabilidad en tiempo real e histórica de la incubadora **SmartEgg IoT**.

---

## 1. Arquitectura de Observabilidad

SmartEgg opera con dos capas de fuentes de datos complementarias:

1. **Streaming en Vivo (`SmartEgg MQTT` / `grafana-mqtt-datasource`):**
   - Conexión directa al broker Mosquitto (`tcp://mosquitto:1883`).
   - Flujo de telemetría en tiempo real: sensores físicos, actuadores, módulos de visión por computadora, modelos de machine learning y gestión de energía.
   - Sin latencia de base de datos; ideal para la supervisión activa durante el ciclo de incubación.

2. **Analítica Histórica y Alertas (`SmartEgg PostgreSQL` / `postgres`):**
   - Conexión a la base de datos relacional PostgreSQL (`postgres:5432/smartegg`).
   - Almacena series temporales durables: `lecturas`, `alarmas`, `accesos_puerta`, `mediciones_energia`, `registro_anomalias_ml` y `eventos_seguridad_vision`.
   - Ejecuta el motor de evaluación de **Grafana Alerting** en segundo plano sobre la base de datos.

---

## 2. Dashboards Versionados

Los dashboards se encuentran en [`infra/grafana/dashboards/`](dashboards/):

### A. Dashboard en Tiempo Real (`smartegg-realtime.json` / `dashboard_tiempo_real_fase3.json`)
* **UID:** `smartegg-realtime` / `smartegg-realtime-fase3`
* **Fuente:** `SmartEgg MQTT`
* **Paneles incluidos (15 paneles):**
  1. *Temperatura en tiempo real* (Time Series, límite crítico 38.5 °C).
  2. *Humedad en tiempo real* (Time Series, rango óptimo 50% - 65%).
  3. *Disponibilidad del nodo* (Stat, estado online/offline vía MQTT Last Will).
  4. *Estado de actuadores* (Table, foco, ventilador, espacios libres).
  5. *Rotación de la canasta* (Gauge, ángulo actual del servomotor 0° - 180°).
  6. *Alarma crítica* (Stat, disparo por anomalía ambiental del firmware).
  7. *Último evento de puerta* (Table, accesos RFID de apertura/cierre).
  8. *Notas de integración* (Text Markdown con resumen técnico del nodo).
  9. **[Fase 3] Estado de Seguridad y Bloqueo** (Stat, topic `smartegg/SE-01/control/bloqueo`):
     - `false / 0` → **SISTEMA OPERATIVO** (Verde `#73BF69`).
     - `true / 1` → **SISTEMA BLOQUEADO (OBJETO EXTRAÑO)** (Rojo `#F2495C`).
  10. **[Fase 3] Visión Artificial — Clasificación de Cabina** (Stat, topic `smartegg/SE-01/vision/estado`):
      - `huevo` → **HUEVO DETECTADO** (Azul `#5794F2`).
      - `vacio` → **CABINA VACÍA** (Gris `#808080`).
      - `objeto_extrano` → **¡OBJETO EXTRAÑO!** (Rojo `#E02F44`).
  11. **[Fase 3] Detección de Anomalías (Machine Learning)** (Stat, topic `smartegg/SE-01/ml/anomalia`):
      - `false / 0` → **COMPORTAMIENTO NORMAL** (Verde `#73BF69`).
      - `true / 1` → **ANOMALÍA DETECTADA** (Naranja `#FF780A`).
  12. **[Fase 3] Score de Anomalía ML** (Gauge, topic `smartegg/SE-01/ml/anomalia`):
      - Score de Isolation Forest. Umbral de alerta: `-0.0052`.
  13. **[Fase 3] Potencia Eléctrica en Tiempo Real** (Gauge, topic `smartegg/SE-01/energia/consumo`):
      - Escala 0 a 120 W. Verde hasta 50 W, amarillo 50-80 W (foco ON), rojo >80 W.
  14. **[Fase 3] Consumo Eléctrico Acumulado** (Stat, topic `smartegg/SE-01/energia/consumo`):
      - Consumo total acumulado en kilovatios-hora ($kWh$).
  15. **[Fase 3] Límite y Alerta de Consumo** (Stat, topic `smartegg/SE-01/energia/consumo`):
      - Alerta visual inmediata si la potencia supera el límite de 80 W.

### B. Dashboard Histórico (`smartegg-historico.json` / `dashboard_historico_fase3.json`)
* **UID:** `smartegg-historico` / `smartegg-historico-fase3`
* **Fuente:** `SmartEgg PostgreSQL` (filtrable dinámicamente por la variable `${node_id}`)
* **Paneles incluidos (10 paneles):**
  1. *Tendencia de temperatura y humedad* (Time Series con doble eje).
  2. *Ocupación de la bandeja* (Time Series de huevos vs espacios libres).
  3. *Mínimos, máximos y promedios por lote* (Table agregada por código de lote).
  4. *Duración de alarmas críticas* (Table con cálculo de duración en minutos).
  5. *Aperturas y cierres de puerta* (Stat total acumulado).
  6. *Eventos de puerta por día* (Time Series agrupado diario).
  7. **[Fase 3] Consumo Energético Histórico Acumulado (kWh por Día)** (Time Series con barras).
  8. **[Fase 3] Potencia Promedio Horaria (Watts)** (Time Series con línea de tendencia horaria).
  9. **[Fase 3] Histórico de Incidentes y Detección de Anomalías (ML)** (Table cronológica con score y diagnóstico predictivo).
  10. **[Fase 3] Bitácora de Eventos de Bloqueo por Visión Computacional** (Table de auditoría con objeto, confianza % y duración del bloqueo en segundos).

---

## 3. Justificación Física de los Cálculos de Consumo Eléctrico

Para cumplir con el requerimiento de gestión inteligente de consumo con valores realistas y coherentes:

| Componente | Voltaje nominal | Potencia nominal | Modo de operación |
| :--- | :--- | :--- | :--- |
| **Foco incandescente / Calefactor** | 120 VAC | **60.0 W** | Conmutado por relé térmico (control de temperatura). |
| **Ventilador DC 12V** | 12 VDC | **5.0 W** | Activado por ventilación de alivio ($T \ge 38.0^\circ\text{C}$). |
| **Servomotor volteador (MG996R)** | 5 VDC | **2.5 W** en movimiento / **0.5 W** reposo | Ciclo de volteo cada 60 s. |
| **Electrónica base (ESP32/Mega, sensores, LCD, relés)** | 5 VDC | **3.0 W** | Operación continua permanente. |

### Rango de Operación Esperado:
- **Reposo térmico (foco OFF, fan OFF):** $\approx 3.5 \text{ W}$
- **Calefacción activa (foco ON, fan OFF):** $\approx 63.5 \text{ W}$
- **Refrigeración y alivio (foco ON + fan ON):** $\approx 68.5 \text{ W}$
- **Umbral de sobreconsumo anómalo:** $> 80.0 \text{ W}$ (indica bloqueo de motor, cortocircuito o fallo de relé pegado).

### Cálculo de Energía:
$$\text{Consumo (kWh)} = \frac{\text{Potencia (Watts)} \times \Delta t \text{ (horas)}}{1000}$$

---

## 4. Reglas de Alerta en Grafana Alerting

Las reglas se provisionan automáticamente mediante [`infra/grafana/provisioning/alerting/alert_rules.yaml`](provisioning/alerting/alert_rules.yaml).

| Nombre de la Regla | Condición Evaluada | Estado Normal | Estado Firing (Disparo) |
| :--- | :--- | :--- | :--- |
| **`[SmartEgg] ALERTA CRITICA - Bloqueo de Incubadora por Objeto Extrano`** | Conteo de alarmas activas de tipo `BLOQUEO_SEGURIDAD_VISION` $> 0$ en PostgreSQL. | Sin eventos activos (Verde). | Objeto extraño detectado en cámara (Rojo). |
| **`[SmartEgg] ALERTA - Deteccion de Anomalia Predictiva (ML)`** | Anomalias detectadas por Isolation Forest en el último minuto $> 0$. | Operación dentro de distribución normal. | Desviación estadística detectada. |
| **`[SmartEgg] ALERTA - Sobreconsumo Electrico Anomalo (>80W)`** | Potencia eléctrica $> 80.0\text{ W}$ durante 10 segundos. | Potencia nominal ($\le 70\text{ W}$). | Carga o consumo eléctrico fuera de rango. |

---

## 5. Pruebas y Generación de Evidencias (Simulador Fase 3)

Se incluye el script interactivo [`simular_telemetria_fase3.py`](simular_telemetria_fase3.py) para validar los dashboards y obtener las capturas requeridas para la documentación:

### Paso 1: Ejecutar el simulador en modo normal (Evidencia Normal / Verde)
```bash
python infra/grafana/simular_telemetria_fase3.py --modo normal
```
* Abre Grafana en `http://localhost:3000` (o `http://<IP-NUBE>:3000`).
* En el dashboard en tiempo real, verifica que:
  - *Estado de Seguridad y Bloqueo* esté en **SISTEMA OPERATIVO** (Verde).
  - *Visión Artificial* muestre **HUEVO DETECTADO** (Azul).
  - *ML* muestre **COMPORTAMIENTO NORMAL** (Verde).
  - *Grafana Alerting* muestre la regla en estado **Normal**.
* **Tomar captura de pantalla.**

### Paso 2: Provocar el disparo de Bloqueo Crítico (Evidencia Firing / Rojo)
```bash
python infra/grafana/simular_telemetria_fase3.py --modo bloqueo
```
* En el dashboard en tiempo real:
  - *Estado de Seguridad y Bloqueo* cambia a **SISTEMA BLOQUEADO (OBJETO EXTRAÑO)** (Rojo).
  - *Visión Artificial* cambia a **¡OBJETO EXTRAÑO!** (Rojo).
  - En la sección **Alerting → Alert rules**, la regla cambia de inmediato a estado **Firing** (Rojo).
* **Tomar captura de pantalla.**

### Paso 3: Probar los paneles históricos de Fase 3
Para poblar PostgreSQL con datos históricos de prueba:
```bash
# Si usas Docker Compose local o en VM:
docker compose exec -T postgres psql -U smartegg -d smartegg < infra/sql/seed_datos_fase3.sql
```
* Abre el dashboard `SmartEgg - Analítica histórica`.
* Observa las barras de consumo diario en kWh, tendencia horaria de Watts, tabla de incidentes de Machine Learning y la bitácora de bloqueos por visión computacional.

---

## 6. Variables de Entorno del Contenedor Grafana

Configuradas en `docker-compose.yml`:
```dotenv
MQTT_GRAFANA_URI=tcp://mosquitto:1883
GRAFANA_MQTT_CLIENT_ID=grafana-smartegg
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=smartegg
POSTGRES_USER=smartegg
POSTGRES_PASSWORD=cambiar_esta_clave
```
