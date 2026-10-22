"""Subscribe to complete MQTT readings and persist them in the backend."""

from __future__ import annotations

import json
import logging
import os
from threading import Lock
from typing import Any, Callable

import paho.mqtt.client as mqtt  # type: ignore

from serial_reader import guardar_lectura


LOGGER = logging.getLogger(__name__)
NODE_ID = os.getenv("NODE_ID", "SE-01")


class MqttIngestion:
    def __init__(self, reading_handler: Callable[[dict[str, Any]], None]) -> None:
        self.host = os.getenv("MQTT_HOST", "localhost")
        self.port = int(os.getenv("MQTT_PORT", "1883"))
        self.username = os.getenv("MQTT_USERNAME", "")
        self.password = os.getenv("MQTT_PASSWORD", "")
        self.keepalive = int(os.getenv("MQTT_KEEPALIVE", "60"))
        self.topic = f"smartegg/{NODE_ID}/sensores/lectura"
        client_id = os.getenv(
            "MQTT_INGEST_CLIENT_ID", f"smartegg-ingest-{NODE_ID.lower()}"
        )
        self._reading_handler = reading_handler
        self._started = False
        self._start_lock = Lock()
        self.client = mqtt.Client(
            callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
            client_id=client_id,
            protocol=mqtt.MQTTv311,
        )
        if self.username:
            self.client.username_pw_set(self.username, self.password)
        self.client.reconnect_delay_set(min_delay=1, max_delay=30)
        self.client.on_connect = self._on_connect
        self.client.on_disconnect = self._on_disconnect
        self.client.on_message = self._on_message

    def _on_connect(self, client, _userdata, _flags, reason_code, _properties) -> None:
        connection_failed = bool(getattr(reason_code, "is_failure", False))
        if not hasattr(reason_code, "is_failure"):
            connection_failed = int(reason_code) != 0
        if connection_failed:
            LOGGER.warning("MQTT rechazó conexión del suscriptor de telemetría: %s", reason_code)
            return

        client.subscribe(self.topic, qos=1)
        LOGGER.info("Suscrito a lecturas MQTT en %s", self.topic)

    @staticmethod
    def _on_disconnect(_client, _userdata, _disconnect_flags, reason_code, _properties) -> None:
        LOGGER.warning(
            "Suscriptor de telemetría MQTT desconectado: %s. Se reintentará automáticamente.",
            reason_code,
        )

    def _on_message(self, _client, _userdata, message) -> None:
        try:
            reading = json.loads(message.payload.decode("utf-8"))
            if not isinstance(reading, dict):
                raise ValueError("La lectura MQTT debe ser un objeto JSON")
            self._reading_handler(reading)
        except Exception as exc:
            LOGGER.warning("Lectura MQTT inválida en %s: %s", message.topic, exc)

    def start(self) -> None:
        with self._start_lock:
            if self._started:
                return
            self._started = True

        self.client.loop_start()
        self.client.connect_async(self.host, self.port, self.keepalive)
        LOGGER.info("Iniciando suscriptor MQTT de telemetría hacia %s:%s", self.host, self.port)

    def stop(self) -> None:
        with self._start_lock:
            if not self._started:
                return
            self._started = False
        self.client.disconnect()
        self.client.loop_stop()


def _persist_reading(reading: dict[str, Any]) -> None:
    # The bridge already publishes the live sensor/actuator topics. Persist this
    # aggregate sample without publishing it again from the backend.
    guardar_lectura(reading, publicar_lectura_mqtt=False)


mqtt_ingestion = MqttIngestion(_persist_reading)
