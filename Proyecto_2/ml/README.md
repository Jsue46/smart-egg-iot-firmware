# Módulo de Machine Learning — Detección de anomalías (Fase 3)

Servicio que aprende cómo se comporta la incubadora en operación normal y avisa por MQTT cuando las lecturas se salen de ese patrón. Complementa la alarma fija del firmware (T ≥ 38.5 °C o humedad fuera de 50–65 %), que detecta muy pocas fallas.

## 1. Qué hace

1. Se suscribe por MQTT a `sensores/temperatura`, `sensores/humedad` y `actuadores/estado`.
2. Mantiene una ventana de las últimas 30 lecturas (≈ 1 minuto a una lectura cada 2 s).
3. Calcula 7 variables: temperatura, humedad, foco (0/1), ventilador (0/1), desviación estándar de temperatura y de humedad en la ventana, y cambio de temperatura en la ventana.
4. Un modelo Isolation Forest le asigna un score. Si supera el umbral, la lectura es anómala.
5. Publica el resultado en `smartegg/SE-01/ml/anomalia`.

No usa API REST: entra y sale solo por MQTT.

## 2. Contrato MQTT

**Entrada** (los publica hoy el backend; quien publique en su lugar, por ejemplo el ESP32, debe respetar este formato):

| Topic | Payload mínimo |
|---|---|
| `smartegg/SE-01/sensores/temperatura` | `{"valor": 37.5, ...}` |
| `smartegg/SE-01/sensores/humedad` | `{"valor": 58, ...}` |
| `smartegg/SE-01/actuadores/estado` | `{"foco": "ON"/"OFF", "ventilador": "ON"/"OFF", "timestamp": "..."}` |

La evaluación se dispara al llegar `actuadores/estado`. Por eso ese mensaje debe publicarse **una vez por lectura**, con `foco` y `ventilador` en texto `ON`/`OFF`, y de preferencia con un `timestamp` distinto en cada lectura.

**Salida:**

| Topic | QoS | Retained |
|---|---|---|
| `smartegg/SE-01/ml/anomalia` | 1 | Sí |

```json
{"nodo_id":"SE-01","anomalia":true,"valor":1,"score":0.2382,"umbral":-0.0052,"temperatura":38.7,"humedad":55.0,"timestamp":"2026-10-16T21:52:31+00:00"}
```

- `anomalia` es booleano y `valor` es 1/0. Grafana y la web pueden usar cualquiera de los dos.
- `score` es el puntaje crudo del modelo; mayor significa más raro.

## 3. Comportamiento que hay que conocer

- **Arranque:** no publica nada durante los primeros ~30 lecturas (1 min), mientras llena la ventana. Si no hay lecturas por más de 60 s, la ventana se reinicia y vuelve a esperar.
- **Estabilidad:** la alerta se activa tras 3 lecturas anómalas seguidas y se desactiva tras 10 normales seguidas. Así no parpadea con el ruido del sensor.
- **Arranque en frío = anomalía (decisión de diseño):** el modelo se entrenó con la incubadora estable a ~37.5 °C. Una incubadora a 25 °C con huevos adentro es un problema real, así que el modelo reporta anomalía hasta que llegue a su temperatura de trabajo. En la calificación se verá `true` los primeros minutos tras encenderla; es lo esperado.
- **Calentamiento brusco** (sensor acercado al foco, como en la demo del ventilador): se detecta como anomalía antes de que se cumpla la alarma fija de 38.5 °C.
- **El ML no bloquea el sistema.** El bloqueo por visión (huevo / objeto extraño) es independiente (`control/bloqueo`). Este módulo solo emite su alerta.

## 4. Resultados

Datos de entrenamiento y prueba: **sintéticos** (2 días simulados, 6.4 % de anomalías: picos del sensor, foco pegado ON/OFF, saltos de humedad, sensor congelado y calentamiento brusco). Se simularon con las reglas del firmware y la resolución real del sensor (0.1 °C, humedad entera). El modelo se entrena solo con lecturas normales. Hiperparámetros y umbral se eligen en validación; las métricas se reportan en un conjunto de prueba separado en el tiempo (split 50/25/25).

Modelo: Isolation Forest, `n_estimators=100`, `max_samples=1024`, umbral = −0.0052 (el que maximiza F1 en validación).

| Métrica (test) | Isolation Forest | Regla fija del firmware |
|---|---|---|
| F1 | **0.627** | 0.070 |
| Recall | **0.871** | 0.036 |
| Precision | 0.490 | 0.942 |
| AUC-ROC | 0.926 | — |

Matriz de confusión (test), filas = real, columnas = predicho: `[[TN=17337, FP=2025], [FN=287, TP=1944]]`.

La regla fija casi nunca da falsas alarmas, pero detecta solo el 4 % de las fallas. El modelo detecta el 87 %, a costa de más falsas alarmas. Parte de esas "falsas alarmas" son lecturas justo después de una falla, cuando el sistema aún se recupera.

**Validación con datos reales de la maqueta:** se evaluaron 1932 lecturas reales (11 de septiembre, arranques en frío y sensor pegado al foco). El modelo marcó el 100 % como anomalía. Esto prueba que no deja pasar condiciones fuera de rango reales; **no** mide falsas alarmas, porque no hay datos reales de operación estable.

Gráficas en `figs/`.

## 5. Estructura de la carpeta

| Archivo | Para qué sirve |
|---|---|
| `ml_service.py`, `Dockerfile`, `requirements.txt`, `.dockerignore` | Servicio que corre en Docker |
| `model/` (`isoforest.joblib`, `config.json`) | Modelo entrenado y su configuración. **El Dockerfile lo copia: sin esta carpeta el contenedor no arranca** |
| `generar_dataset.py` | Genera el dataset sintético en `data/lecturas_sinteticas.csv` |
| `entrenar_modelo.py` | Entrena, evalúa y guarda el modelo y las gráficas |
| `validar_real.py` | Valida el modelo con datos reales |
| `inspeccionar_db.py` | Extrae `data/lecturas_reales.csv` desde `backend/smartegg.db` |
| `simular_incubadora.py` | Prueba controlada: incubadora sana → calentamiento → sana |
| `figs/` | Gráficas de la evaluación |
| `data/` | Datos (`lecturas_sinteticas.csv` no se versiona; se regenera) |

## 6. Cómo ejecutarlo

Servicio (local):
```
docker compose up -d --build mosquitto ml
docker compose logs -f ml
```

Reproducir el entrenamiento (desde la raíz del repo):
```
pip install numpy pandas scikit-learn matplotlib joblib
python ml/generar_dataset.py
python ml/entrenar_modelo.py
python ml/validar_real.py
```

Prueba controlada (el simulador publica en `localhost:1883`; abrir dos terminales):
```
docker compose logs -f ml
python ml/simular_incubadora.py
```
En el log deben aparecer solo tres cambios: `False` → `True` → `False`.

Si se reentrena, hay que volver a construir el servicio: `docker compose up -d --build ml`. El `requirements.txt` del servicio fija la versión de scikit-learn con la que se entrenó; si se entrena con otra versión, hay que actualizarla.

## 7. Qué necesito de cada integrante

- **Integrante 1 (hardware y cámara):** si el ESP32 publica directo por MQTT, debe enviar los tres topics de entrada con el formato de la sección 2, cada 2 s aprox. Si el ESP32 deja de publicar más de 60 s, el ML vuelve a esperar 1 min antes de emitir.
- **Integrante 3 (nube):**
  - Agregar el servicio `ml` (`build: ./ml`) al `docker-compose.yml` de la VM.
  - Pasarle por variables de entorno `MQTT_HOST`, `MQTT_PORT`, `MQTT_USERNAME` y `MQTT_PASSWORD`. El servicio ya soporta usuario y contraseña.
  - Verificar que la carpeta `ml/model/` llegue a la VM junto con el repo.
  - Si el broker en la nube usa usuario y contraseña, también hay que ajustarlos en `simular_incubadora.py` para pruebas desde un PC.
- **Integrante 4 (p5.js / consumo):** suscribirse a `smartegg/SE-01/ml/anomalia` por WebSockets y leer `anomalia`. Como el mensaje es *retained*, un cliente nuevo recibe de inmediato el último estado.
- **Integrante 5 (Grafana y documentación):**
  - Panel con `valor` (1/0) y `score` desde el topic `ml/anomalia` del datasource MQTT.
  - Regla de alerta sugerida: `valor = 1` sostenido por unos segundos.
  - Para la documentación se puede citar la sección 4 de este archivo (métricas) y la 3 (decisiones de diseño).

## 8. Aviso al equipo (restricciones de la rúbrica)

El enunciado de la Fase 3 exige MQTT como canal de telemetría y control. El flujo actual queda así:
- `serial_bridge.py` publica la telemetría por MQTT, incluida la lectura completa en `smartegg/{NODE_ID}/sensores/lectura`; el suscriptor MQTT del backend la persiste en PostgreSQL. El registro administrativo de accesos físicos se conserva por `POST /puerta`.
- El frontend recibe telemetría y órdenes de control mediante MQTT sobre WebSockets. REST queda para lotes y otras operaciones administrativas; no se usa para consultar o enviar lecturas.

El módulo ML no depende de ninguno de esos endpoints, pero el sistema completo debe migrar su control a MQTT antes de la calificación.

## 9. Limitaciones

- El modelo se entrenó con datos sintéticos; las métricas reales pueden variar.
- Para mejorar: grabar 1 o 2 horas con la incubadora estable (por ejemplo con un recipiente de agua adentro), guardar el CSV, reentrenar y reportar esas métricas.
- La humedad normal se entrenó en el rango 52–64 %. Si la maqueta real se estabiliza fuera de ese rango, el modelo la marcará como anomalía.
