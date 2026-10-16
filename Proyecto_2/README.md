# SmartEgg · Proyecto 1

Integración del sistema IoT de incubación: microcontrolador por serial, API Flask, PostgreSQL, Mosquitto, Grafana y frontend Next.js.

## Arranque con Docker

Desde esta carpeta:

```powershell
Copy-Item .env.example .env
docker compose up -d --build
docker compose ps
```

Servicios publicados en el equipo:

| Servicio | URL/puerto |
| --- | --- |
| Frontend | http://localhost:3001 |
| API REST | http://localhost:5000 |
| Grafana | http://localhost:3000 (`admin` / `admin`) |
| MQTT TCP | `localhost:1883` |
| MQTT WebSocket | `ws://localhost:9001` |
| PostgreSQL | `localhost:5432` |

El backend usa `SIMULATE_TELEMETRY=false` por defecto. Para probar el circuito completo sin Arduino, cambia temporalmente esa variable a `true` en `.env` y recrea el backend:

```powershell
docker compose up -d --force-recreate backend
Invoke-RestMethod http://localhost:5000/health | ConvertTo-Json
```

Para hardware real, deja el simulador en `false` y configura `SERIAL_PORT` si el puerto no puede detectarse automáticamente. El lector serial reintenta después de una desconexión y no reemplaza fallos reales con datos aleatorios.

## Flujo integrado

1. El microcontrolador envía una línea JSON por UART a 9600 baudios.
2. Flask valida la lectura, la guarda en PostgreSQL y abre/cierra intervalos de alarma.
3. El publicador MQTT envía telemetría, actuadores y alarmas; mantiene `status=online` y configura LWT `offline`.
4. Grafana usa MQTT para el dashboard en vivo y PostgreSQL para histórico.
5. Next.js consume REST para lotes/histórico y MQTT.js por WebSocket para estado y alarmas sin refrescar.

Los timestamps se publican y almacenan en UTC/ISO 8601 para que todos los servicios compartan la misma referencia. Ambos dashboards tienen `timezone: browser`: Grafana convierte la fecha al huso horario local del navegador y, por tanto, del PC que los visualiza.

## Topics MQTT

| Topic | QoS | Retained | Contenido |
| --- | ---: | :---: | --- |
| `smartegg/SE-01/sensores/temperatura` | 0 | No | `{valor, unidad, timestamp}` |
| `smartegg/SE-01/sensores/humedad` | 0 | No | `{valor, unidad, timestamp}` |
| `smartegg/SE-01/actuadores/estado` | 1 | Sí | `{foco, ventilador, rotacion_grados}` |
| `smartegg/SE-01/alarmas/critica` | 1 | Sí | `{activa, tipo, severidad, inicio_at, resolucion_at}` |
| `smartegg/SE-01/status` | 1 | Sí | `{estado, valor}`; `offline`/`valor=0` es el LWT |
| `smartegg/SE-01/puerta/evento` | 1 | No | `{id, accion, operador_id, cantidad_huevos, timestamp}`; evento en vivo |

La configuración del broker, pruebas y payloads completos están en [`infra/mqtt/README.md`](infra/mqtt/README.md).

## Grafana

Los dashboards se provisionan automáticamente:

- `SmartEgg - Monitoreo MQTT en tiempo real`: temperatura, humedad, actuadores, rotación, alarma, status y último evento de puerta.
- `SmartEgg - Analítica histórica`: tendencias, ocupación, min/max/promedio por lote, duración de alarmas y accesos de puerta.

El dashboard en vivo usa una composición oscura tipo operación, series suaves con umbrales, KPIs de disponibilidad/alarma, estado de actuadores y rotación de la canasta. El histórico añade promedios, máximos/mínimos por lote, duración de alarmas y eventos de puerta. Las consultas SQL están en [`infra/sql/grafana_queries_postgresql.sql`](infra/sql/grafana_queries_postgresql.sql). El datasource MQTT es streaming y no almacena histórico; por eso los datos históricos se consultan en PostgreSQL.

## API

El contrato OpenAPI está en [`docs/openapi.yaml`](docs/openapi.yaml). Endpoints principales:

## Video Demostrativo

- [Ver Video Demostrativo de SmartEgg en Google Drive](https://drive.google.com/drive/folders/1w0q4TgvbBKzDrHfzG4wQCiI1_iPQEONU?usp=sharing)

## Verificación rápida

```powershell
Invoke-RestMethod http://localhost:5000/health
Invoke-RestMethod http://localhost:5000/datos
docker compose exec mosquitto mosquitto_sub -h localhost -t 'smartegg/SE-01/#' -C 1 -W 10
```

Para detener la instalación:

```powershell
docker compose down
```

Los volúmenes `postgres_data`, `mosquitto_data` y `grafana_data` conservan la información entre reinicios. Solo usa `docker compose down -v` si quieres eliminar también esos datos de desarrollo.
