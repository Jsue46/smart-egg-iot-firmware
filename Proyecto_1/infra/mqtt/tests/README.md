# Pruebas manuales del contrato MQTT

Estas pruebas sirven para demostrar a Rol 1 y al docente que el broker distribuye los mensajes correctamente.

## 1. Escuchar todo el nodo

```bash
mosquitto_sub -h localhost -p 1883 -q 1 -t 'smartegg/SE-01/#' -v
```

## 2. Publicar telemetria de prueba

```bash
mosquitto_pub -h localhost -p 1883 -q 0 \
  -t 'smartegg/SE-01/sensores/temperatura' \
  -m '{"nodo_id":"SE-01","valor":37.5,"unidad":"C","timestamp":"2026-09-02T12:00:00Z"}'

mosquitto_pub -h localhost -p 1883 -q 0 \
  -t 'smartegg/SE-01/sensores/humedad' \
  -m '{"nodo_id":"SE-01","valor":58.0,"unidad":"%","timestamp":"2026-09-02T12:00:00Z"}'

mosquitto_pub -h localhost -p 1883 -q 1 -r \
  -t 'smartegg/SE-01/actuadores/estado' \
  -m '{"nodo_id":"SE-01","foco":"OFF","ventilador":"OFF","rotacion_grados":45,"timestamp":"2026-09-02T12:00:00Z"}'

mosquitto_pub -h localhost -p 1883 -q 1 \
  -t 'smartegg/SE-01/puerta/evento' \
  -m '{"id":42,"nodo_id":"SE-01","accion":"ABRIR","operador_id":1,"cantidad_huevos":3,"timestamp":"2026-09-02T12:00:00Z"}'
```

## 3. Probar retained

Cerrar el suscriptor y ejecutar de nuevo solo el comando de actuadores. Un suscriptor nuevo debe recibir inmediatamente el último estado retenido.

## 4. Probar alarma retained con QoS 1

```bash
mosquitto_pub -h localhost -p 1883 -q 1 -r \
  -t 'smartegg/SE-01/alarmas/critica' \
  -m '{"nodo_id":"SE-01","activa":true,"tipo":"TEMPERATURA","severidad":"critical","mensaje":"Temperatura fuera de rango","timestamp":"2026-09-02T12:00:00Z"}'
```

Para limpiar el estado retained de una alarma resuelta, publicar un payload explícito con `activa:false` o enviar un mensaje vacío retenido, según la decisión final de Rol 1.

Los eventos de puerta no son retained. En producción se publican desde `POST /puerta`; el comando anterior solo sirve para probar el panel MQTT en vivo.

## 5. Evidencia del LWT

El cliente de Rol 1 debe conectar con:

- Will topic: `smartegg/SE-01/status`.
- Will payload: `{"nodo_id":"SE-01","estado":"offline"}`.
- Will QoS: `1`.
- Will retained: `true`.

Publicar `online` retained después de conectar. Luego detener el proceso de forma inesperada y capturar el mensaje `offline` recibido por `mosquitto_sub`.
