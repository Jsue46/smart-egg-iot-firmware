"""Modulo de Vision Computacional en Tiempo Real para SmartEgg.

Funcionalidades principales:
1. Captura en vivo desde Iriun Webcam (telefono celular) o webcam de laptop.
2. Deteccion y clasificacion en tiempo real (HUEVO vs OBJETO EXTRAÑO vs VACÍO).
3. Publicacion continua de estado por MQTT hacia Grafana / Backend.
4. Logica de seguridad y bloqueo automatico:
   - Si se inicia el ciclo de incubacion y se detecta un objeto extraño,
     se emite inmediatamente la orden de bloqueo del sistema y alarma critica por MQTT.
5. Interfaz HUD enriquecida con OpenCV (caja de enfoque, barra de confianza, estado).
"""

import argparse
import json
import os
import sys
import time
from datetime import datetime, timezone
import cv2
import numpy as np
import joblib
import paho.mqtt.client as mqtt

# Importar funcion de extraccion de caracteristicas del entrenador
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from entrenar_modelo import extraer_caracteristicas, CLASSES, MODEL_PATH


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class DetectorVisionSmartEgg:
    def __init__(
        self,
        camera_id=None,
        mqtt_host="localhost",
        mqtt_port=1883,
        node_id="SE-01",
        headless=False,
    ):
        self.camera_id = camera_id
        self.mqtt_host = mqtt_host
        self.mqtt_port = mqtt_port
        self.node_id = node_id
        self.headless = headless

        # Cargar modelo entrenado
        if not os.path.exists(MODEL_PATH):
            raise FileNotFoundError(
                f"No se encontro el modelo en {MODEL_PATH}. Ejecuta 'python vision/entrenar_modelo.py' primero."
            )

        print(f"Cargando modelo de vision desde {MODEL_PATH}...")
        bundle = joblib.load(MODEL_PATH)
        self.model = bundle["model"]
        self.classes = bundle.get("classes", CLASSES)

        # Estados de incubadora y seguridad
        self.ciclo_activo = False
        self.sistema_bloqueado = False
        self.ultimo_motivo_bloqueo = ""
        self.consecutivos_objeto = 0
        self.umbral_bloqueo_frames = 3  # Frames consecutivos para confirmar bloqueo

        # Variables de tiempo y telemetria
        self.ultima_telemetria_mqtt = 0
        self.intervalo_telemetria = 1.0  # Cada 1 segundo
        self.fps = 0.0

        # Conectar MQTT
        self.client = mqtt.Client(
            callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
            client_id=f"smartegg-vision-{self.node_id.lower()}",
        )
        self.client.on_connect = self._on_mqtt_connect
        self.client.on_message = self._on_mqtt_message
        self._conectar_mqtt()

    def _conectar_mqtt(self):
        try:
            self.client.connect_async(self.mqtt_host, self.mqtt_port, 60)
            self.client.loop_start()
            print(f"Iniciando conexion MQTT hacia {self.mqtt_host}:{self.mqtt_port}...")
        except Exception as e:
            print(f"Aviso: No se pudo conectar a MQTT de inmediato ({e}). Se reintentara en segundo plano.")

    def _on_mqtt_connect(self, client, userdata, flags, reason_code, properties=None):
        print(f"[MQTT] Modulo de Vision conectado exitosamente al broker ({reason_code})")
        # Suscribirse a comandos de control de ciclo o bloqueo
        client.subscribe(f"smartegg/{self.node_id}/control/#")
        client.subscribe(f"smartegg/{self.node_id}/ciclo/#")

    def _on_mqtt_message(self, client, userdata, msg):
        try:
            payload = json.loads(msg.payload.decode("utf-8"))
            topic = msg.topic

            # Inicio o fin de ciclo
            if "ciclo" in topic:
                self.ciclo_activo = bool(payload.get("activo", payload.get("iniciar", True)))
                print(f"[MQTT] Estado de ciclo actualizado: activo={self.ciclo_activo}")

            # Comando de desbloqueo / reset manual
            elif "bloqueo" in topic:
                if not payload.get("bloquear", True):
                    self.desbloquear_sistema()
        except Exception as e:
            print(f"[MQTT] Error procesando mensaje: {e}")

    def publicar_estado_vision(self, clase: str, confianza: float):
        topic = f"smartegg/{self.node_id}/vision/estado"
        payload = {
            "nodo_id": self.node_id,
            "clase": clase,
            "confianza": round(confianza, 3),
            "ciclo_activo": self.ciclo_activo,
            "bloqueado": self.sistema_bloqueado,
            "motivo": self.ultimo_motivo_bloqueo if self.sistema_bloqueado else "operacion_normal",
            "timestamp": now_iso(),
        }
        self.client.publish(topic, json.dumps(payload), qos=0)

    def activar_bloqueo(self, motivo: str):
        if self.sistema_bloqueado:
            return  # Ya esta bloqueado

        self.sistema_bloqueado = True
        self.ultimo_motivo_bloqueo = motivo
        print(f"\n{'!'*65}\n  ALERTA CRITICA: {motivo.upper()}!\n  ORDEN DE BLOQUEO ENVIADA AL SISTEMA!\n{'!'*65}\n")

        # 1. Enviar comando de bloqueo general a Arduino / Maqueta
        topic_bloqueo = f"smartegg/{self.node_id}/control/bloqueo"
        payload_bloqueo = {
            "nodo_id": self.node_id,
            "bloquear": True,
            "motivo": motivo,
            "alarma_fisica": True,
            "timestamp": now_iso(),
        }
        self.client.publish(topic_bloqueo, json.dumps(payload_bloqueo), qos=1, retain=True)

        # 2. Enviar alarma critica para Grafana y Frontend
        topic_alarma = f"smartegg/{self.node_id}/alarmas/critica"
        payload_alarma = {
            "id": f"ALM-VIS-{int(time.time())}",
            "nodo_id": self.node_id,
            "tipo": "BLOQUEO_SEGURIDAD_VISION",
            "severidad": "CRITICA",
            "mensaje": f"SISTEMA BLOQUEADO: Objeto no autorizado detectado en incubadora ({motivo})",
            "activa": True,
            "inicio_at": now_iso(),
            "timestamp": now_iso(),
        }
        self.client.publish(topic_alarma, json.dumps(payload_alarma), qos=1, retain=True)

    def desbloquear_sistema(self):
        self.sistema_bloqueado = False
        self.ultimo_motivo_bloqueo = ""
        self.consecutivos_objeto = 0
        print("[SISTEMA] Desbloqueo manual recibido. Reanudando operacion normal.")

        # Notificar por MQTT
        topic_bloqueo = f"smartegg/{self.node_id}/control/bloqueo"
        self.client.publish(
            topic_bloqueo,
            json.dumps({"nodo_id": self.node_id, "bloquear": False, "motivo": "desbloqueado_manual", "timestamp": now_iso()}),
            qos=1,
            retain=True,
        )

        topic_alarma = f"smartegg/{self.node_id}/alarmas/critica"
        self.client.publish(
            topic_alarma,
            json.dumps({
                "id": f"ALM-VIS-RES",
                "nodo_id": self.node_id,
                "tipo": "BLOQUEO_SEGURIDAD_VISION",
                "severidad": "NORMAL",
                "mensaje": "Bloqueo resuelto manualmente.",
                "activa": False,
                "resolucion_at": now_iso(),
                "timestamp": now_iso(),
            }),
            qos=1,
            retain=True,
        )

    def buscar_camara(self):
        if self.camera_id is not None:
            return self.camera_id

        # Auto-deteccion: Iriun suele ser camara 1 cuando hay webcam de laptop (0)
        print("Buscando camara activa (Iriun Webcam / Celular / Laptop)...")
        for idx in [1, 0, 2]:
            cap = cv2.VideoCapture(idx)
            if cap.isOpened():
                ret, _ = cap.read()
                cap.release()
                if ret:
                    print(f"-> Camara detectada y operativa en indice: {idx}")
                    return idx
        return 0

    def iniciar(self):
        cam_idx = self.buscar_camara()
        cap = cv2.VideoCapture(cam_idx)

        if not cap.isOpened():
            print(f"ERROR: No se pudo abrir la camara {cam_idx}.")
            print("Verifica que Iriun Webcam este activo en el telefono y la PC.")
            return

        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)

        print("\n" + "=" * 65)
        print("  SmartEgg Vision - Monitoreo y Bloqueo Inteligente Activo")
        print("=" * 65)
        print("Controles interactivos de prueba:")
        print("  [ESPACIO] -> Alternar Ciclo de Incubacion (ON / OFF)")
        print("  [B]       -> Forzar prueba de Bloqueo")
        print("  [R]       -> Resetear / Desbloquear Sistema")
        print("  [Q]       -> Salir")
        print("=" * 65 + "\n")

        prev_time = time.time()

        try:
            while True:
                ret, frame = cap.read()
                if not ret:
                    time.sleep(0.05)
                    continue

                curr_time = time.time()
                self.fps = 0.9 * self.fps + 0.1 * (1.0 / max(0.001, curr_time - prev_time))
                prev_time = curr_time

                h, w, _ = frame.shape
                # Region de interes central (ROI donde reposa el huevo)
                box_w, box_h = int(w * 0.55), int(h * 0.55)
                x1 = (w - box_w) // 2
                y1 = (h - box_h) // 2
                x2, y2 = x1 + box_w, y1 + box_h
                roi = frame[y1:y2, x1:x2]

                # Prediccion con OpenCV + Modelo ML
                features = extraer_caracteristicas(roi)
                clase_detectada = "vacio"
                confianza = 0.0

                if features is not None:
                    probs = self.model.predict_proba([features])[0]
                    idx_max = int(np.argmax(probs))
                    clase_detectada = self.classes[idx_max]
                    confianza = float(probs[idx_max])

                # Logica de Bloqueo requerida por el PDF:
                # "Si el operador inicia el conteo/ciclo pero la camara detecta un objeto
                #  que no es un huevo, suena la alarma y todo el sistema se bloquea"
                if self.ciclo_activo and not self.sistema_bloqueado:
                    if clase_detectada == "objeto_extrano":
                        self.consecutivos_objeto += 1
                        if self.consecutivos_objeto >= self.umbral_bloqueo_frames:
                            self.activar_bloqueo(f"Objeto extraño detectado ({clase_detectada})")
                    else:
                        self.consecutivos_objeto = max(0, self.consecutivos_objeto - 1)

                # Publicar telemetria MQTT periodica
                if curr_time - self.ultima_telemetria_mqtt >= self.intervalo_telemetria:
                    self.ultima_telemetria_mqtt = curr_time
                    self.publicar_estado_vision(clase_detectada, confianza)

                # Renderizar HUD si no estamos en modo headless
                if not self.headless:
                    display = frame.copy()
                    self._dibujar_hud(display, x1, y1, x2, y2, clase_detectada, confianza)
                    cv2.imshow("SmartEgg IoT - Vision & Deteccion de Seguridad", display)

                    key = cv2.waitKey(1) & 0xFF
                    if key == ord("q") or key == 27:
                        break
                    elif key == 32:  # Barra espaciadora
                        self.ciclo_activo = not self.ciclo_activo
                        print(f">> Ciclo de incubacion: {'INICIADO' if self.ciclo_activo else 'DETENIDO'}")
                    elif key == ord("b") or key == ord("B"):
                        self.activar_bloqueo("Prueba manual de bloqueo forzado")
                    elif key == ord("r") or key == ord("R"):
                        self.desbloquear_sistema()

        finally:
            cap.release()
            cv2.destroyAllWindows()
            self.client.loop_stop()
            self.client.disconnect()
            print("Modulo de vision finalizado.")

    def _dibujar_hud(self, img, x1, y1, x2, y2, clase, confianza):
        h, w, _ = img.shape

        # Colores segun estado
        if self.sistema_bloqueado:
            # Efecto estroboscopico / parpadeo rojo de alerta
            parpadeo = (int(time.time() * 4) % 2) == 0
            color_roi = (0, 0, 255) if parpadeo else (0, 0, 150)
            color_txt = (0, 0, 255)
        elif clase == "huevo":
            color_roi = (0, 230, 0)  # Verde
            color_txt = (0, 230, 0)
        elif clase == "objeto_extrano":
            color_roi = (0, 140, 255)  # Naranja
            color_txt = (0, 140, 255)
        else:
            color_roi = (200, 200, 200)  # Gris/Blanco
            color_txt = (200, 200, 200)

        # Marco ROI central
        cv2.rectangle(img, (x1, y1), (x2, y2), color_roi, 3 if self.sistema_bloqueado else 2)

        # Panel superior de Estado
        cv2.rectangle(img, (0, 0), (w, 75), (20, 20, 20), -1)

        # Titulo y FPS
        cv2.putText(
            img,
            f"SmartEgg Vision AI | Nodo: {self.node_id} | FPS: {self.fps:.1f}",
            (15, 25),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.55,
            (220, 220, 220),
            1,
            cv2.LINE_AA,
        )

        # Estado del Ciclo
        estado_ciclo = "CICLO EN PROGRESO" if self.ciclo_activo else "MODO ESPERA (STANDBY)"
        col_ciclo = (0, 255, 0) if self.ciclo_activo else (180, 180, 180)
        cv2.putText(
            img,
            f"Ciclo: {estado_ciclo} [ESPACIO: alternar]",
            (15, 52),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.5,
            col_ciclo,
            1,
            cv2.LINE_AA,
        )

        # Etiqueta de Deteccion en vivo
        texto_deteccion = f"{clase.upper()} ({confianza * 100:.1f}%)"
        cv2.putText(
            img,
            texto_deteccion,
            (x1, y1 - 10),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            color_txt,
            2,
            cv2.LINE_AA,
        )

        # Barra de confianza
        bar_w = int((x2 - x1) * confianza)
        cv2.rectangle(img, (x1, y2 + 8), (x1 + bar_w, y2 + 16), color_roi, -1)
        cv2.rectangle(img, (x1, y2 + 8), (x2, y2 + 16), (100, 100, 100), 1)

        # Banner de BLOQUEO si el sistema esta bloqueado
        if self.sistema_bloqueado:
            cv2.rectangle(img, (0, h - 80), (w, h), (0, 0, 180), -1)
            cv2.putText(
                img,
                "¡SISTEMA BLOQUEADO! ALARMA ACTIVADA",
                (30, h - 45),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.8,
                (255, 255, 255),
                2,
                cv2.LINE_AA,
            )
            cv2.putText(
                img,
                f"Motivo: {self.ultimo_motivo_bloqueo} | Pulsa [R] para Desbloquear",
                (30, h - 18),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.55,
                (200, 255, 255),
                1,
                cv2.LINE_AA,
            )


def main():
    parser = argparse.ArgumentParser(description="SmartEgg Vision AI Detection")
    parser.add_argument("--cam", type=int, default=None, help="Indice de la camara (0=laptop, 1=Iriun, etc.)")
    parser.add_argument("--mqtt-host", type=str, default=os.getenv("MQTT_HOST", "localhost"), help="Broker MQTT host")
    parser.add_argument("--mqtt-port", type=int, default=int(os.getenv("MQTT_PORT", 1883)), help="Broker MQTT port")
    parser.add_argument("--node-id", type=str, default=os.getenv("NODE_ID", "SE-01"), help="ID del nodo SmartEgg")
    parser.add_argument("--headless", action="store_true", help="Ejecutar sin ventana grafica")
    args = parser.parse_args()

    detector = DetectorVisionSmartEgg(
        camera_id=args.cam,
        mqtt_host=args.mqtt_host,
        mqtt_port=args.mqtt_port,
        node_id=args.node_id,
        headless=args.headless,
    )
    detector.iniciar()


if __name__ == "__main__":
    main()
