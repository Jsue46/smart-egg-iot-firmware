"""Unit tests for SmartEgg IoT Backend & Services."""

import os
import unittest
import json
import numpy as np
import joblib
from types import SimpleNamespace
from unittest.mock import Mock, patch

# Set env before importing
os.environ["DATABASE_URL"] = ""  # Force SQLite in-memory/local for test
os.environ["NODE_ID"] = "SE-TEST"

import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import database
import energy_service
import mqtt_ingestion
import serial_bridge


class TestSmartEggBackend(unittest.TestCase):
    def test_timer_expiry_queues_shutdown_until_mqtt_accepts_order(self):
        gestor = energy_service.GestorEnergiaInteligente()
        gestor.temporizador_fin = energy_service.time.time() - 1

        shutdown_order = gestor.procesar_vencimiento_temporizador()
        self.assertIsNotNone(shutdown_order)
        self.assertEqual(shutdown_order[1:], ("APAGAR", "temporizador_vencido"))
        self.assertIsNone(gestor.temporizador_fin)
        self.assertEqual(gestor.procesar_vencimiento_temporizador(), shutdown_order)

        gestor.confirmar_orden_actuadores(shutdown_order[0])
        self.assertIsNone(gestor.procesar_vencimiento_temporizador())

    def test_programming_new_timer_queues_actuator_resume(self):
        gestor = energy_service.GestorEnergiaInteligente()
        gestor.configurar_energia({"temporizador_minutos": 15})

        resume_order = gestor.procesar_vencimiento_temporizador()

        self.assertIsNotNone(resume_order)
        self.assertEqual(resume_order[1:], ("REANUDAR", "temporizador_programado"))

    def test_rescheduling_supersedes_an_unsent_shutdown(self):
        gestor = energy_service.GestorEnergiaInteligente()
        gestor.temporizador_fin = energy_service.time.time() - 1
        shutdown_order = gestor.procesar_vencimiento_temporizador()
        gestor.configurar_energia({"temporizador_minutos": 15})
        resume_order = gestor.procesar_vencimiento_temporizador()

        gestor.confirmar_orden_actuadores(shutdown_order[0])

        self.assertEqual(resume_order[1:], ("REANUDAR", "temporizador_programado"))
        self.assertEqual(gestor.procesar_vencimiento_temporizador(), resume_order)

    def test_timer_expiry_publishes_retained_shutdown_command(self):
        client = Mock()
        client.is_connected.return_value = True
        client.publish.return_value = SimpleNamespace(rc=energy_service.mqtt.MQTT_ERR_SUCCESS)

        published = energy_service.publicar_orden_actuadores(
            client, "APAGAR", "temporizador_vencido"
        )

        self.assertTrue(published)
        topic, raw_payload = client.publish.call_args.args[:2]
        payload = json.loads(raw_payload)
        self.assertEqual(topic, energy_service.T_ACTUADORES_CMD)
        self.assertEqual(payload["accion"], "APAGAR")
        self.assertEqual(payload["motivo"], "temporizador_vencido")
        self.assertEqual(client.publish.call_args.kwargs, {"qos": 1, "retain": True})

    def test_bridge_forwards_shutdown_and_timer_rearm_to_arduino(self):
        serial_conn = Mock(is_open=True)

        self.assertTrue(serial_bridge.reenviar_comando_control(
            energy_service.T_ACTUADORES_CMD,
            {"accion": "APAGAR"},
            serial_conn,
        ))
        self.assertTrue(serial_bridge.reenviar_comando_control(
            energy_service.T_ACTUADORES_CMD,
            {"accion": "REANUDAR"},
            serial_conn,
        ))

        self.assertEqual(
            [call.args[0] for call in serial_conn.write.call_args_list],
            [b"CMD:APAGAR_ACTUADORES\n", b"CMD:REANUDAR_ACTUADORES\n"],
        )

    def test_mqtt_reading_subscription_passes_full_sample_to_persistence(self):
        received = []
        subscriber = mqtt_ingestion.MqttIngestion(received.append)
        sample = {
            "nodo_id": "SE-TEST",
            "temperatura": 37.5,
            "humedad": 58,
            "foco": "ON",
            "fan": "OFF",
            "timestamp": "2026-10-22T12:00:00+00:00",
        }
        message = SimpleNamespace(
            topic=subscriber.topic,
            payload=json.dumps(sample).encode("utf-8"),
        )

        subscriber._on_message(None, None, message)

        self.assertEqual(received, [sample])

    def test_mqtt_ingestion_does_not_republish_bridge_sample(self):
        sample = {"nodo_id": "SE-TEST", "temperatura": 37.5, "humedad": 58}
        with patch.object(mqtt_ingestion, "guardar_lectura") as save_reading:
            mqtt_ingestion._persist_reading(sample)

        save_reading.assert_called_once_with(sample, publicar_lectura_mqtt=False)

    def test_database_sqlite_init(self):
        """Test SQLite schema initialization and execute helper."""
        database.init_db(max_retries=1)
        conn = database.get_connection()
        self.assertIsNotNone(conn)
        row = database.execute(conn, "SELECT COUNT(*) FROM nodos").fetchone()
        self.assertIsNotNone(row)
        conn.close()

    def test_energy_calculations(self):
        """Test power and kWh calculations according to electrical justifications."""
        gestor = energy_service.GestorEnergiaInteligente()
        gestor.foco = "OFF"
        gestor.ventilador = "OFF"
        gestor.rotacion = 0.0
        gestor.ultima_rotacion = 0.0

        datos_idle = gestor.calcular_potencia()
        # Base: 3.0W base + 0.5W motor idle = 3.5W
        self.assertAlmostEqual(datos_idle["watts"], 3.5, delta=0.2)

        # Foco ON (60W) + Fan ON (5W) + Base (3W) + Motor idle (0.5W) = 68.5W
        gestor.foco = "ON"
        gestor.ventilador = "ON"
        datos_full = gestor.calcular_potencia()
        self.assertAlmostEqual(datos_full["watts"], 68.5, delta=0.5)

    def test_vision_model_integrity(self):
        """Verify the trained vision AI model loads and has valid classes."""
        model_path = os.path.join(os.path.dirname(__file__), "..", "..", "vision", "modelo_vision.joblib")
        self.assertTrue(os.path.exists(model_path), f"Model not found at {model_path}")

        data = joblib.load(model_path)
        self.assertIn("model", data)
        self.assertIn("classes", data)
        self.assertEqual(list(data["classes"]), ["huevo", "objeto_extrano", "vacio"])

        # Predict on dummy features (46 dimensions)
        dummy_feat = np.zeros((1, 46))
        pred_idx = data["model"].predict(dummy_feat)[0]
        class_name = data["classes"][pred_idx] if isinstance(pred_idx, (int, np.integer)) else pred_idx
        self.assertIn(class_name, ["huevo", "objeto_extrano", "vacio"])


if __name__ == "__main__":
    unittest.main()
