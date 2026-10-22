"""Servicio inteligente de gestion de consumo electrico y persistencia IoT Fase 3.

Funciones principales:
1. Calculo justificado de potencia (Watts) y energia acumulada (kWh) en tiempo real:
   - Foco / Calefaccion: 60.0 W (resistencia calefactora tipica de incubadora)
   - Ventilador de flujo continuo: 5.0 W (motor DC 12V 0.4A)
   - Sistema de volteo / Servomotor: 2.5 W en movimiento, 0.5 W en reposo
   - Electronica de control (ESP32/Arduino/sensores): 3.0 W
   - Voltaje nominal: 120.0 V AC
2. Publicacion periodica a MQTT en 'smartegg/{NODE_ID}/energia/consumo'.
3. Persistencia en PostgreSQL en las tablas:
   - 'mediciones_energia'
   - 'eventos_seguridad_vision'
   - 'registro_anomalias_ml'
4. Gestion inteligente:
   - Temporizador de corte automatico y verificacion de limites de consumo (ej. 80W maximo).
   - Emision de alertas de sobreconsumo.
"""

from __future__ import annotations

import json
import logging
import os
import threading
import time
from datetime import datetime, timezone
from typing import Any

import paho.mqtt.client as mqtt

from database import execute, get_connection, is_postgres

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s [Energia] %(message)s")
LOGGER = logging.getLogger("energy_service")

NODE_ID = os.getenv("NODE_ID", "SE-01")
MQTT_HOST = os.getenv("MQTT_HOST", "localhost")
MQTT_PORT = int(os.getenv("MQTT_PORT", 1883))
MQTT_USERNAME = os.getenv("MQTT_USERNAME", "")
MQTT_PASSWORD = os.getenv("MQTT_PASSWORD", "")

BASE_TOPIC = f"smartegg/{NODE_ID}"
T_ACTUADORES = f"{BASE_TOPIC}/actuadores/estado"
T_VISION = f"{BASE_TOPIC}/vision/estado"
T_ML = f"{BASE_TOPIC}/ml/anomalia"
T_BLOQUEO = f"{BASE_TOPIC}/control/bloqueo"
T_ENERGIA_PUB = f"{BASE_TOPIC}/energia/consumo"
T_ENERGIA_CMD = f"{BASE_TOPIC}/control/energia"

VOLTAJE_NOMINAL = 120.0
POTENCIA_BASE_WATTS = 3.0
POTENCIA_FOCO_WATTS = 60.0
POTENCIA_FAN_WATTS = 5.0
POTENCIA_MOTOR_ACTIVO = 2.5
POTENCIA_MOTOR_IDLE = 0.5


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class GestorEnergiaInteligente:
    def __init__(self) -> None:
        self.node_id = NODE_ID
        self.foco = "OFF"
        self.ventilador = "OFF"
        self.rotacion = 0.0
        self.ultima_rotacion = 0.0
        self.bloqueado = False

        # Parametros configurables
        self.limite_potencia_watts = 80.0
        self.temporizador_fin: float | None = None
        self.horario_inicio: int | None = None  # hora 0-23
        self.horario_fin: int | None = None

        # Acumulador energetico
        self.kwh_acumulado = 0.0
        self.ultimo_calculo_ts = time.monotonic()
        self.ultimo_guardado_db = 0.0
        self.intervalo_db = 5.0  # Guardar mediciones cada 5s en BD

        self._lock = threading.Lock()
        self._inicializar_kwh_desde_db()

    def _inicializar_kwh_desde_db(self) -> None:
        try:
            conn = get_connection()
            row = execute(
                conn,
                "SELECT COALESCE(MAX(consumo_kwh), 0.0) AS max_kwh FROM mediciones_energia WHERE nodo_id = ?",
                (self.node_id,),
            ).fetchone()
            if row:
                max_kwh = float(row["max_kwh"] if isinstance(row, dict) else row[0])
                self.kwh_acumulado = max_kwh
                LOGGER.info("Consumo kWh acumulado cargado desde BD: %.4f kWh", self.kwh_acumulado)
            conn.close()
        except Exception as e:
            LOGGER.warning("No se pudo cargar kWh previo de BD (se iniciara en 0): %s", e)

    def calcular_potencia(self) -> dict[str, Any]:
        with self._lock:
            # Si el sistema esta bloqueado por seguridad de vision, actuadores apagados
            foco_w = POTENCIA_FOCO_WATTS if (self.foco == "ON" and not self.bloqueado) else 0.0
            fan_w = POTENCIA_FAN_WATTS if (self.ventilador == "ON" and not self.bloqueado) else 0.0

            # Motor en movimiento si cambio el angulo en los ultimos segundos
            motor_en_movimiento = abs(self.rotacion - self.ultima_rotacion) > 1.0
            motor_w = POTENCIA_MOTOR_ACTIVO if motor_en_movimiento else POTENCIA_MOTOR_IDLE

            total_watts = round(POTENCIA_BASE_WATTS + foco_w + fan_w + motor_w, 2)
            corriente = round(total_watts / VOLTAJE_NOMINAL, 3)

            # Integrar kWh en el intervalo transcurrido
            ahora = time.monotonic()
            dt_horas = (ahora - self.ultimo_calculo_ts) / 3600.0
            self.ultimo_calculo_ts = ahora
            self.kwh_acumulado += (total_watts * dt_horas) / 1000.0

            # Alerta de sobreconsumo
            sobreconsumo = total_watts > self.limite_potencia_watts

            # Verificacion de temporizador
            temporizador_activo = False
            segundos_restantes = 0
            if self.temporizador_fin is not None:
                segundos_restantes = max(0, int(self.temporizador_fin - time.time()))
                temporizador_activo = True
                if segundos_restantes == 0:
                    LOGGER.info("Temporizador de conexion cumplido; desconectando actuadores.")
                    self.temporizador_fin = None

            return {
                "nodo_id": self.node_id,
                "watts": total_watts,
                "potencia": total_watts,
                "kwh": round(self.kwh_acumulado, 4),
                "consumo_kwh": round(self.kwh_acumulado, 4),
                "voltaje": VOLTAJE_NOMINAL,
                "corriente": corriente,
                "foco_watts": foco_w,
                "ventilador_watts": fan_w,
                "motor_watts": motor_w,
                "limite_watts": self.limite_potencia_watts,
                "alerta_consumo": sobreconsumo,
                "temporizador_activo": temporizador_activo,
                "segundos_restantes": segundos_restantes,
                "timestamp": now_iso(),
            }

    def actualizar_actuadores(self, data: dict[str, Any]) -> None:
        with self._lock:
            self.foco = str(data.get("foco", "OFF")).upper()
            self.ventilador = str(data.get("ventilador", data.get("fan", "OFF"))).upper()
            self.ultima_rotacion = self.rotacion
            self.rotacion = float(data.get("rotacion_grados", 0.0))

    def actualizar_bloqueo(self, bloqueado: bool) -> None:
        with self._lock:
            self.bloqueado = bloqueado

    def configurar_energia(self, cmd: dict[str, Any]) -> None:
        with self._lock:
            if "limite_watts" in cmd:
                self.limite_potencia_watts = float(cmd["limite_watts"])
                LOGGER.info("Nuevo limite de potencia establecido: %.1f W", self.limite_potencia_watts)
            if "temporizador_minutos" in cmd:
                minutos = float(cmd["temporizador_minutos"])
                if minutos > 0:
                    self.temporizador_fin = time.time() + (minutos * 60)
                    LOGGER.info("Temporizador programado por %.1f minutos", minutos)
                else:
                    self.temporizador_fin = None
                    LOGGER.info("Temporizador cancelado")


def guardar_medicion_energia_db(datos: dict[str, Any]) -> None:
    try:
        conn = get_connection()
        execute(
            conn,
            """
            INSERT INTO mediciones_energia (
                nodo_id, potencia_watts, consumo_kwh, voltaje, corriente,
                foco_watts, ventilador_watts, motor_watts, timestamp
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                datos["nodo_id"],
                datos["watts"],
                datos["kwh"],
                datos["voltaje"],
                datos["corriente"],
                datos["foco_watts"],
                datos["ventilador_watts"],
                datos["motor_watts"],
                datos["timestamp"],
            ),
        )
        conn.commit()
        conn.close()
    except Exception as e:
        LOGGER.warning("Error guardando medicion de energia en BD: %s", e)


def guardar_evento_vision_db(payload: dict[str, Any]) -> None:
    try:
        conn = get_connection()
        clase = str(payload.get("clase") or payload.get("objeto") or payload.get("objeto_detectado") or "desconocido")
        bloqueado = bool(payload.get("bloqueado") or payload.get("bloquear") or payload.get("bloqueo") or (clase == "objeto_extrano"))
        conf = float(payload.get("confianza", 0.0))
        conf_pct = conf * 100.0 if conf <= 1.0 else conf
        motivo = str(payload.get("motivo") or payload.get("alerta") or "Deteccion de vision")
        ts = payload.get("timestamp") or now_iso()

        execute(
            conn,
            """
            INSERT INTO eventos_seguridad_vision (
                nodo_id, objeto_detectado, confianza, estado_bloqueo, motivo, timestamp
            ) VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                payload.get("nodo_id", NODE_ID),
                clase,
                conf_pct,
                "BLOQUEADO" if bloqueado else "NORMAL",
                motivo,
                ts,
            ),
        )
        conn.commit()
        conn.close()
        LOGGER.info("Evento de vision registrado en base de datos: %s (bloqueado=%s)", clase, bloqueado)
    except Exception as e:
        LOGGER.warning("Error guardando evento de vision en BD: %s", e)


def guardar_anomalia_ml_db(payload: dict[str, Any]) -> None:
    try:
        if not payload.get("anomalia"):
            return  # Guardar solo cuando hay anomalia detectada
        conn = get_connection()
        execute(
            conn,
            """
            INSERT INTO registro_anomalias_ml (
                nodo_id, temperatura, humedad, score_anomalia, umbral, es_anomalia, detalle, timestamp
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                payload.get("nodo_id", NODE_ID),
                float(payload.get("temperatura", 0.0)),
                float(payload.get("humedad", 0.0)),
                float(payload.get("score", 0.0)),
                float(payload.get("umbral", 0.0)),
                True,
                f"Anomalia ML detectada (Score: {payload.get('score')})",
                payload.get("timestamp") or now_iso(),
            ),
        )
        conn.commit()
        conn.close()
        LOGGER.info("Anomalia ML registrada en BD: T=%.1f H=%.1f Score=%.4f", payload.get("temperatura", 0), payload.get("humedad", 0), payload.get("score", 0))
    except Exception as e:
        LOGGER.warning("Error guardando anomalia ML en BD: %s", e)


def main():
    gestor = GestorEnergiaInteligente()

    client = mqtt.Client(
        callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
        client_id=f"smartegg-energy-service-{NODE_ID.lower()}",
    )
    if MQTT_USERNAME:
        client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)

    def on_connect(c, _u, _f, rc, _p=None):
        LOGGER.info("Conectado al broker MQTT en %s:%d (rc=%s)", MQTT_HOST, MQTT_PORT, rc)
        c.subscribe([
            (T_ACTUADORES, 1),
            (T_VISION, 0),
            (T_ML, 1),
            (T_BLOQUEO, 1),
            (T_ENERGIA_CMD, 1),
        ])

    def on_message(_c, _u, msg):
        try:
            payload = json.loads(msg.payload.decode("utf-8"))
            topic = msg.topic

            if topic == T_ACTUADORES:
                gestor.actualizar_actuadores(payload)
            elif topic == T_VISION:
                es_bloq = bool(payload.get("bloqueado") or payload.get("bloquear") or payload.get("bloqueo") or False)
                gestor.actualizar_bloqueo(es_bloq)
                clase_det = str(payload.get("clase") or payload.get("objeto") or payload.get("objeto_detectado") or "")
                if es_bloq or clase_det == "objeto_extrano":
                    guardar_evento_vision_db(payload)
            elif topic == T_BLOQUEO:
                gestor.actualizar_bloqueo(bool(payload.get("bloquear", payload.get("bloqueado", False))))
            elif topic == T_ML:
                if payload.get("anomalia"):
                    guardar_anomalia_ml_db(payload)
            elif topic == T_ENERGIA_CMD:
                gestor.configurar_energia(payload)
        except Exception as e:
            LOGGER.warning("Error procesando mensaje MQTT en topico %s: %s", msg.topic, e)

    client.on_connect = on_connect
    client.on_message = on_message

    LOGGER.info("Iniciando servicio de energia inteligente hacia %s:%d...", MQTT_HOST, MQTT_PORT)
    client.connect(MQTT_HOST, MQTT_PORT, 60)
    client.loop_start()

    try:
        while True:
            datos_energia = gestor.calcular_potencia()

            # Publicar en MQTT
            client.publish(T_ENERGIA_PUB, json.dumps(datos_energia), qos=0)

            # Persistir periodicamente en BD
            ahora = time.time()
            if ahora - gestor.ultimo_guardado_db >= gestor.intervalo_db:
                gestor.ultimo_guardado_db = ahora
                guardar_medicion_energia_db(datos_energia)

            time.sleep(1.0)
    except KeyboardInterrupt:
        LOGGER.info("Servicio de energia detenido por usuario.")
    finally:
        client.loop_stop()
        client.disconnect()


def iniciar_hilo_energia() -> threading.Thread:
    """Inicia el servicio de gestion de energia en un hilo demonio."""
    hilo = threading.Thread(target=main, name="energy-service-thread", daemon=True)
    hilo.start()
    LOGGER.info("Hilo demonio de servicio de energia inteligente iniciado con exito.")
    return hilo


if __name__ == "__main__":
    main()
