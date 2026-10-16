# Provisioning de Grafana para SmartEgg

Esta carpeta contiene las fuentes de datos y dashboards provisionados por el `docker-compose.yml` de la entrega. Rol 2 puede reutilizar los mismos montajes si reorganiza la orquestación.

## Requisitos

- Grafana `11.0` o superior.
- Plugin oficial `grafana-mqtt-datasource` `1.1.0`, fijado en [`Dockerfile`](Dockerfile) para que el despliegue sea reproducible.
- PostgreSQL accesible desde el contenedor de Grafana.
- Broker accesible desde Grafana mediante `tcp://mosquitto:1883` dentro de la red Docker.

El plugin MQTT es únicamente de streaming en vivo. No almacena mensajes ni permite recuperar histórico; por eso el dashboard histórico usa la fuente `SmartEgg PostgreSQL`. El dashboard MQTT debe permanecer abierto durante la demostración para ver el flujo.

La versión del plugin está fijada porque la combinación Grafana 12/plugin MQTT más reciente presentó errores de streaming en el flujo en vivo. La imagen propia descarga la versión compatible durante el build y no depende de una instalación mutable al arrancar.

## Variables requeridas

Rol 2 debe definir en el `.env` que cargue el contenedor de Grafana:

```dotenv
MQTT_GRAFANA_URI=tcp://mosquitto:1883
MQTT_USERNAME=
MQTT_PASSWORD=
GRAFANA_MQTT_CLIENT_ID=grafana-smartegg
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=smartegg
POSTGRES_USER=smartegg
POSTGRES_PASSWORD=cambiar_esta_clave
```

No se debe subir el archivo `.env` real.

## Montajes que necesita Docker

```yaml
environment:
  GF_PATHS_PLUGINS: /opt/smartegg-grafana-plugins
  GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS: grafana-mqtt-datasource
  MQTT_GRAFANA_URI: ${MQTT_GRAFANA_URI}
  MQTT_USERNAME: ${MQTT_USERNAME}
  MQTT_PASSWORD: ${MQTT_PASSWORD}
  GRAFANA_MQTT_CLIENT_ID: ${GRAFANA_MQTT_CLIENT_ID}
  POSTGRES_HOST: ${POSTGRES_HOST}
  POSTGRES_PORT: ${POSTGRES_PORT}
  POSTGRES_DB: ${POSTGRES_DB}
  POSTGRES_USER: ${POSTGRES_USER}
  POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
volumes:
  - ./infra/grafana/provisioning/datasources:/etc/grafana/provisioning/datasources:ro
  - ./infra/grafana/provisioning/dashboards:/etc/grafana/provisioning/dashboards:ro
  - ./infra/grafana/dashboards:/var/lib/grafana/dashboards:ro
```

El nombre `postgres` debe coincidir con el nombre del servicio de base de datos en el compose.

## Dashboards incluidos

- `smartegg-realtime.json`: temperatura, humedad, estado de actuadores, rotación, alarma, status y último evento de puerta mediante MQTT.
- `smartegg-historico.json`: tendencias, estadisticas por lote, duracion de alarmas y conteo de accesos mediante PostgreSQL.

El dashboard en vivo también muestra la rotación de la canasta en grados. Los timestamps del payload se conservan en UTC/ISO 8601; el modelo del dashboard usa `timezone: browser` y el panel de actuadores convierte `timestamp` a tipo fecha, por lo que la tabla muestra la hora local del PC. El datasource MQTT asigna además una columna `Time` al momento de recepción.
