# Broker MQTT de SmartEgg

Esta carpeta contiene la configuración del broker usada por el `docker-compose.yml` de la entrega.

## Configuracion

`mosquitto.conf` habilita:

- MQTT TCP en el puerto `1883` para el backend, Grafana y clientes de prueba.
- MQTT sobre WebSocket en el puerto `9001` para el frontend con MQTT.js.
- Persistencia del broker para conservar mensajes retained.
- Logs en stdout para verificarlos desde Docker.

La configuracion usa `allow_anonymous true` únicamente para la demostracion local dentro de la red Docker. Si el equipo expone el broker fuera de la máquina, se debe reemplazar por autenticación con `password_file` y reglas ACL sin subir credenciales al repositorio.

## Integracion con Docker

El compose ya monta el archivo y el volumen persistente. Si Rol 2 reorganiza la orquestación, debe conservar estos montajes:

```yaml
services:
  mosquitto:
    image: eclipse-mosquitto:2
    ports:
      - "1883:1883"
      - "9001:9001"
    volumes:
      - ./infra/mqtt/mosquitto.conf:/mosquitto/config/mosquitto.conf:ro
      - mosquitto_data:/mosquitto/data
      - mosquitto_log:/mosquitto/log
```

El servicio debe llamarse `mosquitto` o Rol 2 debe ajustar `MQTT_GRAFANA_URI` y las URLs de los clientes.

## Consola y URLs

MQTT es el protocolo y Mosquitto es el broker; esta instalación no incluye una consola web administrativa propia como RabbitMQ Management. Las interfaces disponibles para observar SmartEgg son:

- Grafana: `http://localhost:3000` — dashboards de tiempo real e histórico.
- MQTT nativo: `mqtt://localhost:1883` — backend, Grafana y clientes MQTT.
- MQTT sobre WebSocket: `ws://localhost:9001` — frontend con MQTT.js y clientes web.
- CLI: `mosquitto_sub`/`mosquitto_pub` para inspeccionar o publicar mensajes.

Para una vista tipo explorador se puede usar MQTT Explorer o MQTTX apuntando a `localhost:1883`. Si el equipo necesitara una consola web completa del broker, tendría que elegir un broker que la incluya (por ejemplo, EMQX o HiveMQ) o desplegar una herramienta adicional; no es necesario para esta entrega porque Grafana cubre la observabilidad solicitada.

## Prueba rapida

Con el broker levantado, abrir una terminal para escuchar:

```bash
mosquitto_sub -h localhost -p 1883 -t 'smartegg/SE-01/#' -v
```

En otra terminal, publicar el estado retained:

```bash
mosquitto_pub -h localhost -p 1883 -q 1 -r \
  -t 'smartegg/SE-01/status' \
  -m '{"nodo_id":"SE-01","estado":"online","timestamp":"2026-09-02T12:00:00Z"}'
```

Los payloads definitivos y la matriz de topics están documentados en `README.md` y `docs/ManualTecnico.md`.
