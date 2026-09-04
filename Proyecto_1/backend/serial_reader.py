"""Continuous serial ingestion with reconnect and MQTT publication."""

from __future__ import annotations

import json
import logging
import os
import random
import serial  # type: ignore
import serial.tools.list_ports  # type: ignore
import threading
import time
from datetime import datetime, timezone
from typing import Any

from database import execute, get_connection
from mqtt_publisher import mqtt_publisher, now_iso


LOGGER = logging.getLogger(__name__)
NODE_ID = os.getenv("NODE_ID", "SE-01")
SERIAL_BAUD = int(os.getenv("SERIAL_BAUD", "9600"))
SERIAL_RETRY_SECONDS = float(os.getenv("SERIAL_RETRY_SECONDS", "5"))
SIMULATE_TELEMETRY = os.getenv("SIMULATE_TELEMETRY", "false").lower() in {
    "1",
    "true",
    "yes",
    "on",
}

_stop_event = threading.Event()
_dato_lock = threading.Lock()
ultimo_dato: dict[str, Any] = {}


def encontrar_puerto() -> str | None:
    puertos = list(serial.tools.list_ports.comports())
    if not puertos:
        return None

    for puerto in puertos:
        descripcion = (puerto.description or "").upper()
        if any(
            keyword in descripcion
            for keyword in ["ARDUINO", "CH340", "FTDI", "USB SERIAL", "CP210"]
        ):
            LOGGER.info("Arduino detectado en %s", puerto.device)
            return puerto.device

    LOGGER.info(
        "Puerto genérico detectado (%s - %s), probando conexión...",
        puertos[-1].device,
        puertos[-1].description,
    )
    return puertos[-1].device


def get_ultimo_dato() -> dict[str, Any]:
    with _dato_lock:
        return dict(ultimo_dato)


def normalizar_dato(raw: dict[str, Any]) -> dict[str, Any]:
    temperatura = float(raw.get("temperatura", raw.get("temperature")))
    humedad = float(raw.get("humedad", raw.get("humidity")))
    ventilador = raw.get("ventilador", raw.get("fan", "OFF"))
    rotacion = raw.get("rotacion_grados", raw.get("servo_ang", 0))
    timestamp = raw.get("timestamp") or now_iso()

    return {
        "nodo_id": str(raw.get("nodo_id", NODE_ID)),
        "lote_id": raw.get("lote_id"),
        "temperatura": temperatura,
        "humedad": humedad,
        "espacios_libres": int(raw.get("espacios_libres", 0)),
        "foco": str(raw.get("foco", "OFF")),
        "ventilador": str(ventilador),
        "fan": str(ventilador),
        "rotacion_grados": float(rotacion),
        "alarma": bool(raw.get("alarma", False)),
        "timestamp": str(timestamp),
    }


def _row_value(row, key: str, index: int = 0):
    if row is None:
        return None
    try:
        return row[key]
    except (KeyError, TypeError, IndexError):
        return row[index]


def _alarm_details(data: dict[str, Any]) -> tuple[str, str]:
    temperatura = data["temperatura"]
    humedad = data["humedad"]
    if temperatura >= 38.5 or temperatura < 36.0:
        return "TEMPERATURA", f"Temperatura crítica: {temperatura:.1f}°C"
    if humedad < 50.0 or humedad > 65.0:
        return "HUMEDAD", f"Humedad fuera de rango: {humedad:.1f}%"
    return "SISTEMA", f"Alarma del sistema — T:{temperatura:.1f}°C H:{humedad:.1f}%"


def _set_latest(data: dict[str, Any]) -> None:
    with _dato_lock:
        ultimo_dato.clear()
        ultimo_dato.update(data)


def guardar_lectura(data: dict[str, Any]) -> None:
    """Persist a reading, close/open alarm intervals, then publish telemetry."""

    data = normalizar_dato(data)
    alarma_activa = bool(data["alarma"])
    nodo_id = data["nodo_id"]
    lote_id = data.get("lote_id") or None
    timestamp = data["timestamp"]
    alarm_publication: dict[str, Any] | None = None

    conn = get_connection()
    try:
        execute(
            conn,
            """
            INSERT INTO lecturas (
                nodo_id, lote_id, temperatura, humedad, espacios_libres,
                foco, ventilador, rotacion_grados, alarma, timestamp
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                nodo_id,
                lote_id,
                data["temperatura"],
                data["humedad"],
                data["espacios_libres"],
                data["foco"],
                data["ventilador"],
                data["rotacion_grados"],
                alarma_activa,
                timestamp,
            ),
        )

        active_row = execute(
            conn,
            """
            SELECT id, tipo, severidad, mensaje, inicio_at
            FROM alarmas
            WHERE nodo_id = ? AND activa = ?
            ORDER BY inicio_at DESC
            LIMIT 1
            """,
            (nodo_id, True),
        ).fetchone()

        if alarma_activa:
            alarm_type, message = _alarm_details(data)
            if active_row is None:
                execute(
                    conn,
                    """
                    INSERT INTO alarmas (
                        nodo_id, lote_id, tipo, severidad, mensaje, descripcion,
                        activa, inicio_at, timestamp
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        nodo_id,
                        lote_id,
                        alarm_type,
                        "critical",
                        message,
                        message,
                        True,
                        timestamp,
                        timestamp,
                    ),
                )
                created = execute(
                    conn,
                    """
                    SELECT id, tipo, severidad, mensaje, inicio_at
                    FROM alarmas
                    WHERE nodo_id = ? AND activa = ?
                    ORDER BY inicio_at DESC
                    LIMIT 1
                    """,
                    (nodo_id, True),
                ).fetchone()
                alarm_publication = {
                    "alarm_id": _row_value(created, "id"),
                    "alarm_type": alarm_type,
                    "severity": "critical",
                    "message": message,
                    "active": True,
                    "started_at": _row_value(created, "inicio_at"),
                }
            else:
                alarm_publication = {
                    "alarm_id": _row_value(active_row, "id"),
                    "alarm_type": _row_value(active_row, "tipo") or alarm_type,
                    "severity": _row_value(active_row, "severidad") or "critical",
                    "message": _row_value(active_row, "mensaje") or message,
                    "active": True,
                    "started_at": _row_value(active_row, "inicio_at"),
                }
        elif active_row is not None:
            resolved_at = timestamp
            execute(
                conn,
                """
                UPDATE alarmas
                SET activa = ?, resolucion_at = ?
                WHERE id = ?
                """,
                (False, resolved_at, _row_value(active_row, "id")),
            )
            alarm_publication = {
                "alarm_id": _row_value(active_row, "id"),
                "alarm_type": _row_value(active_row, "tipo") or "SISTEMA",
                "severity": _row_value(active_row, "severidad") or "critical",
                "message": _row_value(active_row, "mensaje") or "Alarma resuelta",
                "active": False,
                "started_at": _row_value(active_row, "inicio_at"),
                "resolved_at": resolved_at,
            }

        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

    _set_latest(data)
    mqtt_publisher.publish_reading(data)
    if alarm_publication:
        mqtt_publisher.publish_alarm(**alarm_publication)


def _simulated_reading() -> dict[str, Any]:
    temperatura = round(random.uniform(36.5, 39.0), 1)
    humedad = round(random.uniform(48.0, 67.0), 1)
    return {
        "nodo_id": NODE_ID,
        "temperatura": temperatura,
        "humedad": humedad,
        "espacios_libres": random.randint(0, 3),
        "foco": "ON" if temperatura < 37.3 else "OFF",
        "ventilador": "ON" if temperatura >= 38.0 else "OFF",
        "rotacion_grados": random.choice([0, 45, 90, 135, 180]),
        "alarma": temperatura >= 38.5 or humedad < 50.0 or humedad > 65.0,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


def _wait(seconds: float) -> None:
    _stop_event.wait(seconds)


def leer_serial() -> None:
    """Read JSON lines forever and reconnect after a serial failure."""

    while not _stop_event.is_set():
        puerto = os.getenv("SERIAL_PORT") or encontrar_puerto()
        if puerto is None:
            if SIMULATE_TELEMETRY:
                guardar_lectura(_simulated_reading())
                _wait(float(os.getenv("SIMULATION_INTERVAL", "2")))
            else:
                LOGGER.warning(
                    "No se encontró Arduino. Reintentando en %.1f s.",
                    SERIAL_RETRY_SECONDS,
                )
                _wait(SERIAL_RETRY_SECONDS)
            continue

        try:
            with serial.Serial(puerto, SERIAL_BAUD, timeout=2) as ser:
                LOGGER.info("Serial conectado en %s", puerto)
                while not _stop_event.is_set():
                    linea = ser.readline().decode("utf-8", errors="ignore").strip()
                    if not linea or not linea.startswith("{"):
                        continue
                    try:
                        guardar_lectura(json.loads(linea))
                    except (TypeError, ValueError, KeyError, json.JSONDecodeError) as exc:
                        LOGGER.warning("Trama serial ignorada: %s", exc)
        except (serial.SerialException, OSError) as exc:
            LOGGER.warning(
                "Conexión serial perdida (%s). Reconectando en %.1f s.",
                exc,
                SERIAL_RETRY_SECONDS,
            )
            _wait(SERIAL_RETRY_SECONDS)
        except Exception:
            LOGGER.exception(
                "Error inesperado en lectura serial. Reintentando en %.1f s.",
                SERIAL_RETRY_SECONDS,
            )
            _wait(SERIAL_RETRY_SECONDS)


def iniciar_hilo_serial() -> threading.Thread:
    hilo = threading.Thread(target=leer_serial, daemon=True, name="smartegg-serial")
    hilo.start()
    return hilo


def detener_hilo_serial() -> None:
    _stop_event.set()
