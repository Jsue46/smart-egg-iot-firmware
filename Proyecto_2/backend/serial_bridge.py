"""Serial-to-MQTT bridge for Windows Docker Compose deployment.

Reads Arduino Mega COM port on Windows host and forwards telemetry and door
events to the Mosquitto MQTT broker. The backend subscribes to the complete
reading topic and persists telemetry without an HTTP ingestion endpoint.
"""

import argparse
import json
import os
import urllib.request
from datetime import datetime, timezone
import paho.mqtt.client as mqtt
import serial
import serial.tools.list_ports

DEFAULT_MQTT_HOST = os.getenv("MQTT_HOST", "localhost")
DEFAULT_MQTT_PORT = int(os.getenv("MQTT_PORT", "1883"))
API_URL = os.getenv("API_URL", "http://localhost:5000")
NODE_ID = os.getenv("NODE_ID", "SE-01")
ACTUATOR_CONTROL_TOPIC = f"smartegg/{NODE_ID}/control/actuadores"


def encontrar_puerto() -> str:
    puertos = list(serial.tools.list_ports.comports())
    for p in puertos:
        desc = (p.description or "").upper()
        if any(k in desc for k in ["ARDUINO", "CH340", "FTDI", "USB SERIAL", "CP210"]):
            return p.device
    if puertos:
        return puertos[-1].device
    return "COM7"


def post_rest(endpoint: str, payload_dict: dict) -> None:
    """Persist administrative events that are also announced over MQTT."""
    try:
        data = json.dumps(payload_dict).encode("utf-8")
        req = urllib.request.Request(
            f"{API_URL}{endpoint}",
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        urllib.request.urlopen(req, timeout=1.5)
    except Exception:
        pass


def reenviar_comando_control(topic: str, payload: dict, serial_conn) -> bool:
    """Translate MQTT control messages into commands understood by Arduino."""
    if serial_conn is None or not serial_conn.is_open:
        return False

    command = None
    if topic.endswith("/control/bloqueo"):
        command = (
            b"CMD:BLOQUEAR\n"
            if payload.get("bloquear")
            else b"CMD:DESBLOQUEAR\n"
        )
    elif topic == ACTUATOR_CONTROL_TOPIC:
        action = str(payload.get("accion", "")).upper()
        if action == "APAGAR":
            command = b"CMD:APAGAR_ACTUADORES\n"
        elif action == "REANUDAR":
            command = b"CMD:REANUDAR_ACTUADORES\n"

    if command is None:
        return False

    serial_conn.write(command)
    print(f" [CONTROL MQTT -> SERIAL] Comando enviado a Arduino: {command.decode().strip()}")
    return True


def main():
    parser = argparse.ArgumentParser(description="SmartEgg Serial Tunnel to MQTT")
    parser.add_argument("--mqtt-host", type=str, default=DEFAULT_MQTT_HOST, help="IP o host del broker MQTT (ej. IP de AWS/Azure)")
    parser.add_argument("--mqtt-port", type=int, default=DEFAULT_MQTT_PORT, help="Puerto MQTT (1883)")
    parser.add_argument("--port", type=str, default=os.getenv("SERIAL_PORT"), help="Puerto COM de Arduino (ej. COM3)")
    args = parser.parse_args()

    mqtt_host = args.mqtt_host
    mqtt_port = args.mqtt_port
    puerto = args.port or encontrar_puerto()

    print(f"=== TÚNEL SERIAL -> MQTT ({mqtt_host}:{mqtt_port}) ===")
    print(f"Puerto Serial: {puerto}")
    print(f"Broker MQTT: {mqtt_host}:{mqtt_port}")
    print(f"Nodo ID: {NODE_ID}\n")

    ser = None

    def on_mqtt_message(_client, _userdata, msg):
        try:
            payload = json.loads(msg.payload.decode("utf-8"))
            if isinstance(payload, dict):
                reenviar_comando_control(msg.topic, payload, ser)
        except Exception as err:
            print(f"Error procesando comando MQTT hacia serial: {err}")

    client.on_message = on_mqtt_message

    try:
        with serial.Serial(puerto, 9600, timeout=2) as ser_conn:
            ser = ser_conn
            client.connect(mqtt_host, mqtt_port, 60)
            client.subscribe(f"smartegg/{NODE_ID}/control/#", qos=1)
            client.loop_start()
            print(f"Conectado exitosamente al broker Mosquitto en {mqtt_host}:{mqtt_port}.")
            print(f"Escuchando puerto {puerto}... Enviando datos a Docker.\n")
            while True:
                linea = ser.readline().decode("utf-8", errors="ignore").strip()
                if not linea:
                    continue

                if "[RFID] Acceso concedido" in linea:
                    payload = {"accion": "ABRIR", "nodo_id": NODE_ID, "operador_id": 1, "cantidad_huevos": 0}
                    client.publish(f"smartegg/{NODE_ID}/puerta/evento", json.dumps(payload), qos=1)
                    post_rest("/puerta", payload)
                    print(" [RFID] Acceso concedido -> Evento enviado por MQTT y registrado [ABRIR]")

                elif "PUERTA CERRADA" in linea:
                    payload = {"accion": "CERRAR", "nodo_id": NODE_ID, "operador_id": 1, "cantidad_huevos": 0}
                    client.publish(f"smartegg/{NODE_ID}/puerta/evento", json.dumps(payload), qos=1)
                    post_rest("/puerta", payload)
                    print(" [PUERTA] Cierre detectado -> Evento enviado por MQTT y registrado [CERRAR]")

                elif linea.startswith("{"):
                    try:
                        data = json.loads(linea)
                        data["nodo_id"] = str(data.get("nodo_id") or NODE_ID)
                        data.setdefault("timestamp", datetime.now(timezone.utc).isoformat())
                        base = {"nodo_id": data["nodo_id"], "timestamp": data["timestamp"]}
                        client.publish(
                            f"smartegg/{NODE_ID}/sensores/temperatura",
                            json.dumps({**base, "valor": data["temperatura"], "unidad": "°C"}),
                        )
                        client.publish(
                            f"smartegg/{NODE_ID}/sensores/humedad",
                            json.dumps({**base, "valor": data["humedad"], "unidad": "%"}),
                        )
                        client.publish(
                            f"smartegg/{NODE_ID}/actuadores/estado",
                            json.dumps({
                                **base,
                                "foco": data.get("foco", "OFF"),
                                "ventilador": data.get("fan", "OFF"),
                                "rotacion_grados": data.get("rotacion_grados", 0),
                                "espacios_libres": data.get("espacios_libres", 3)
                            }),
                            qos=1,
                            retain=True
                        )
                        client.publish(
                            f"smartegg/{NODE_ID}/sensores/lectura",
                            json.dumps(data, ensure_ascii=False),
                            qos=1,
                            retain=False,
                        )
                        print(
                            f" Telemetría MQTT: Temp={data['temperatura']}°C "
                            f"Hum={data['humedad']}% Foco={data.get('foco')} "
                            f"Fan={data.get('fan')}"
                        )
                    except Exception:
                        pass
    except KeyboardInterrupt:
        print("\nTúnel detenido por el usuario.")
    except Exception as exc:
        print(f"\nError en lectura serial: {exc}")
    finally:
        client.loop_stop()
        client.disconnect()


if __name__ == "__main__":
    main()
