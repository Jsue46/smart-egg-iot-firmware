"""Resilient MQTT publisher used by the backend.

The client owns the broker connection and publishes the node status as a
retained message. Its Last Will is the retained ``offline`` status, so
Grafana and the web client can distinguish a stale telemetry stream from a
healthy node.
"""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from threading import Event, Lock
from typing import Any

import paho.mqtt.client as mqtt  # type: ignore


LOGGER = logging.getLogger(__name__)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def iso_timestamp(value: Any = None) -> str:
    """Return a timestamp that Grafana can parse and localize reliably."""

    if value is None:
        return now_iso()
    if isinstance(value, datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc).isoformat()
    text = str(value).strip()
    if " " in text and "T" not in text:
        return text.replace(" ", "T", 1)
    return text


def _as_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in {"1", "true", "on", "yes"}


class MqttPublisher:
    def __init__(self) -> None:
        self.host = os.getenv("MQTT_HOST", "localhost")
        self.port = int(os.getenv("MQTT_PORT", "1883"))
        self.username = os.getenv("MQTT_USERNAME", "")
        self.password = os.getenv("MQTT_PASSWORD", "")
        self.node_id = os.getenv("NODE_ID", "SE-01")
        self.client_id = os.getenv(
            "MQTT_CLIENT_ID", f"smartegg-backend-{self.node_id.lower()}"
        )
        self.keepalive = int(os.getenv("MQTT_KEEPALIVE", "60"))
        self.status_topic = f"smartegg/{self.node_id}/status"
        self._connected = Event()
        self._started = False
        self._start_lock = Lock()

        self.client = mqtt.Client(
            callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
            client_id=self.client_id,
            protocol=mqtt.MQTTv311,
        )
        if self.username:
            self.client.username_pw_set(self.username, self.password)

        self.client.will_set(
            self.status_topic,
            json.dumps(
                {
                    "nodo_id": self.node_id,
                    "estado": "offline",
                    "valor": 0,
                    "motivo": "lwt",
                    "timestamp": now_iso(),
                }
            ),
            qos=1,
            retain=True,
        )
        self.client.reconnect_delay_set(min_delay=1, max_delay=30)
        self.client.on_connect = self._on_connect
        self.client.on_disconnect = self._on_disconnect

    @property
    def connected(self) -> bool:
        return self._connected.is_set()

    def _on_connect(self, _client, _userdata, _flags, reason_code, _properties) -> None:
        connection_failed = bool(getattr(reason_code, "is_failure", False))
        if not hasattr(reason_code, "is_failure"):
            connection_failed = int(reason_code) != 0
        if connection_failed:
            LOGGER.warning("MQTT rechazó la conexión: %s", reason_code)
            self._connected.clear()
            return

        self._connected.set()
        LOGGER.info("MQTT conectado a %s:%s", self.host, self.port)
        self.publish_json(
            self.status_topic,
            {
                "nodo_id": self.node_id,
                "estado": "online",
                "valor": 1,
                "timestamp": now_iso(),
            },
            qos=1,
            retain=True,
        )

    def _on_disconnect(
        self, _client, _userdata, _disconnect_flags, reason_code, _properties
    ) -> None:
        self._connected.clear()
        LOGGER.warning("MQTT desconectado: %s. Se reintentará automáticamente.", reason_code)

    def start(self) -> None:
        with self._start_lock:
            if self._started:
                return
            self._started = True

        self.client.loop_start()
        self.client.connect_async(self.host, self.port, self.keepalive)
        LOGGER.info("Iniciando conexión MQTT hacia %s:%s", self.host, self.port)

    def stop(self) -> None:
        if not self._started:
            return
        if self.connected:
            self.publish_json(
                self.status_topic,
                {
                    "nodo_id": self.node_id,
                    "estado": "offline",
                    "valor": 0,
                    "timestamp": now_iso(),
                },
                qos=1,
                retain=True,
            )
            self.client.disconnect()
        self.client.loop_stop()
        self._connected.clear()
        self._started = False

    def publish_json(
        self, topic: str, payload: dict[str, Any], qos: int = 0, retain: bool = False
    ) -> bool:
        if not self.connected:
            LOGGER.debug("MQTT no conectado; se omite publicación en %s", topic)
            return False

        message = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
        result = self.client.publish(topic, message, qos=qos, retain=retain)
        if result.rc != mqtt.MQTT_ERR_SUCCESS:
            LOGGER.warning("No se pudo publicar %s: rc=%s", topic, result.rc)
            return False
        return True

    def publish_reading(self, data: dict[str, Any]) -> None:
        timestamp = str(data.get("timestamp") or now_iso())
        base = {"nodo_id": self.node_id, "timestamp": timestamp}
        temperature = float(data["temperatura"])
        humidity = float(data["humedad"])

        # Publish a retained heartbeat with each reading so Grafana can show
        # node availability even when the dashboard is opened after startup.
        self.publish_json(
            self.status_topic,
            {**base, "estado": "online", "valor": 1},
            qos=1,
            retain=True,
        )

        self.publish_json(
            f"smartegg/{self.node_id}/sensores/temperatura",
            {**base, "valor": temperature, "unidad": "°C"},
        )
        self.publish_json(
            f"smartegg/{self.node_id}/sensores/humedad",
            {**base, "valor": humidity, "unidad": "%"},
        )
        self.publish_json(
            f"smartegg/{self.node_id}/actuadores/estado",
            {
                **base,
                "foco": str(data.get("foco", "OFF")),
                "ventilador": str(data.get("ventilador", data.get("fan", "OFF"))),
                "rotacion_grados": float(data.get("rotacion_grados", data.get("servo_ang", 0))),
                "espacios_libres": int(data.get("espacios_libres", 0)),
            },
            qos=1,
            retain=True,
        )

    def publish_alarm(
        self,
        *,
        alarm_id: Any,
        alarm_type: str,
        severity: str,
        message: str,
        active: bool,
        started_at: Any = None,
        resolved_at: Any = None,
    ) -> None:
        payload = {
            "id": alarm_id,
            "nodo_id": self.node_id,
            "tipo": alarm_type,
            "severidad": severity,
            "mensaje": message,
            "activa": _as_bool(active),
            "inicio_at": iso_timestamp(started_at),
            "timestamp": now_iso(),
        }
        if resolved_at:
            payload["resolucion_at"] = iso_timestamp(resolved_at)
        self.publish_json(
            f"smartegg/{self.node_id}/alarmas/critica",
            payload,
            qos=1,
            retain=True,
        )

    def publish_door_event(
        self,
        *,
        event_id: Any,
        action: str,
        operator_id: Any = None,
        egg_count: Any = None,
        timestamp: Any = None,
    ) -> None:
        """Publish a door event for live observability.

        Door events remain durable in PostgreSQL. They are deliberately not
        retained in MQTT so a newly connected subscriber does not mistake the
        last historical action for a new action.
        """

        payload: dict[str, Any] = {
            "id": event_id,
            "nodo_id": self.node_id,
            "accion": str(action).upper(),
            "timestamp": iso_timestamp(timestamp),
        }
        if operator_id is not None:
            payload["operador_id"] = int(operator_id)
        if egg_count is not None:
            payload["cantidad_huevos"] = int(egg_count)

        self.publish_json(
            f"smartegg/{self.node_id}/puerta/evento",
            payload,
            qos=1,
            retain=False,
        )


mqtt_publisher = MqttPublisher()
