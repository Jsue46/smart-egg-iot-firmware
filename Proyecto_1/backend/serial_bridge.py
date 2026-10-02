"""Serial-to-MQTT and REST Tunnel for Windows Docker Compose deployment.

Reads Arduino Mega COM port on Windows host and forwards telemetry and door
events to both the Mosquitto MQTT container (port 1883) and the Backend API
container (port 5000) running inside Docker Compose.
"""

import json
import os
import sys
import time
import urllib.request
import serial
import serial.tools.list_ports
import paho.mqtt.client as mqtt

MQTT_HOST = os.getenv("MQTT_HOST", "localhost")
MQTT_PORT = int(os.getenv("MQTT_PORT", "1883"))
API_URL = os.getenv("API_URL", "http://localhost:5000")
NODE_ID = os.getenv("NODE_ID", "SE-01")


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


def main():
    puerto = os.getenv("SERIAL_PORT") or encontrar_puerto()
    print(f"=== TÚNEL SERIAL -> DOCKER MQTT & REST ===")
    print(f"Puerto Serial: {puerto}")
    print(f"Broker MQTT: {MQTT_HOST}:{MQTT_PORT}")
    print(f"Backend REST: {API_URL}")
    print(f"Nodo ID: {NODE_ID}\n")

    client = mqtt.Client(client_id="smartegg-serial-bridge")
    try:
        client.connect(MQTT_HOST, MQTT_PORT, 60)
        client.loop_start()
        print("Conectado exitosamente al broker Mosquitto en Docker.")
    except Exception as e:
        print(f"Error conectando a Mosquitto en Docker: {e}")
        sys.exit(1)

    try:
        with serial.Serial(puerto, 9600, timeout=2) as ser:
            print(f"Escuchando puerto {puerto}... Enviando datos a Docker.\n")
            while True:
                linea = ser.readline().decode("utf-8", errors="ignore").strip()
                if not linea:
                    continue

                if "[RFID] Acceso concedido" in linea:
                    payload = {"accion": "ABRIR", "nodo_id": NODE_ID, "operador_id": 1, "cantidad_huevos": 0}
                    client.publish(f"smartegg/{NODE_ID}/puerta/evento", json.dumps(payload), qos=1)
                    post_rest("/puerta", payload)
                    print(" [RFID] Acceso concedido -> Enviado a Docker (MQTT & PostgreSQL) [ABRIR]")

                elif "PUERTA CERRADA" in linea:
                    payload = {"accion": "CERRAR", "nodo_id": NODE_ID, "operador_id": 1, "cantidad_huevos": 0}
                    client.publish(f"smartegg/{NODE_ID}/puerta/evento", json.dumps(payload), qos=1)
                    post_rest("/puerta", payload)
                    print(" [PUERTA] Cierre detectado -> Enviado a Docker (MQTT & PostgreSQL) [CERRAR]")

                elif linea.startswith("{"):
                    try:
                        data = json.loads(linea)
                        client.publish(f"smartegg/{NODE_ID}/sensores/temperatura", json.dumps({"nodo_id": NODE_ID, "valor": data["temperatura"], "unidad": "°C"}))
                        client.publish(f"smartegg/{NODE_ID}/sensores/humedad", json.dumps({"nodo_id": NODE_ID, "valor": data["humedad"], "unidad": "%"}))
                        client.publish(
                            f"smartegg/{NODE_ID}/actuadores/estado",
                            json.dumps({
                                "nodo_id": NODE_ID,
                                "foco": data.get("foco", "OFF"),
                                "ventilador": data.get("fan", "OFF"),
                                "rotacion_grados": data.get("rotacion_grados", 0),
                                "espacios_libres": data.get("espacios_libres", 3)
                            }),
                            qos=1,
                            retain=True
                        )
                        post_rest("/datos", data)
                        print(f" Telemetría enviada a Docker: Temp={data['temperatura']}°C Hum={data['humedad']}% Foco={data.get('foco')} Fan={data.get('fan')}")
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
