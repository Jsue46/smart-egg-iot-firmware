"""Unit tests for SmartEgg IoT Backend & Services."""

import os
import unittest
import numpy as np
import joblib

# Set env before importing
os.environ["DATABASE_URL"] = ""  # Force SQLite in-memory/local for test
os.environ["NODE_ID"] = "SE-TEST"

import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import database
import energy_service


class TestSmartEggBackend(unittest.TestCase):
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
