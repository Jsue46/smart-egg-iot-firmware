"""Servicio ML: escucha MQTT, evalúa cada lectura con Isolation Forest y publica ml/anomalia."""
import json
import logging
import os
import time
import warnings
from collections import deque
from datetime import datetime, timezone

import joblib
import numpy as np
import paho.mqtt.client as mqtt

warnings.filterwarnings("ignore", message="X does not have valid feature names")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s - %(message)s")
LOG = logging.getLogger("ml")

NODE_ID = os.getenv("NODE_ID", "SE-01")
BASE = f"smartegg/{NODE_ID}"
T_TEMP = f"{BASE}/sensores/temperatura"
T_HUM = f"{BASE}/sensores/humedad"
T_ACT = f"{BASE}/actuadores/estado"
T_OUT = f"{BASE}/ml/anomalia"
GAP_S = 60  # sin lecturas por más de 60 s: se reinicia la ventana

cfg = json.load(open("model/config.json"))
modelo = joblib.load("model/isoforest.joblib")
VENTANA, UMBRAL, FEATURES = cfg["ventana"], cfg["umbral"], cfg["features"]

temps, hums = deque(maxlen=VENTANA), deque(maxlen=VENTANA)
ALTAS_PARA_ALERTAR = 3   # lecturas seguidas anómalas para activar la alerta
BAJAS_PARA_NORMAL = 10   # lecturas seguidas normales para desactivarla
estado = {"t": None, "h": None, "ts": None, "last_tick": 0.0, "last_anom": None, "altas": 0, "bajas": 0, "pub": None}

def evaluar(client, act):
    ts = act.get("timestamp")
    if estado["t"] is None or estado["h"] is None or (ts is not None and ts == estado["ts"]):
        return
    estado["ts"] = ts
    ahora = time.monotonic()
    if ahora - estado["last_tick"] > GAP_S:
        temps.clear()
        hums.clear()
    estado["last_tick"] = ahora
    temps.append(estado["t"])
    hums.append(estado["h"])
    if len(temps) < VENTANA:
        return  # llenando la ventana (30 lecturas = 1 min)

    t, h = np.array(temps), np.array(hums)
    fila = {
        "temperatura": t[-1],
        "humedad": h[-1],
        "foco_i": int(str(act.get("foco", "OFF")).upper() == "ON"),
        "ventilador_i": int(str(act.get("ventilador", "OFF")).upper() == "ON"),
        "t_std": t.std(ddof=1),
        "h_std": h.std(ddof=1),
        "t_delta": t[-1] - t[0],
    }
    X = np.array([[fila[f] for f in FEATURES]])
    score = float(-modelo.decision_function(X)[0])
    crudo = score >= UMBRAL
    if crudo:
        estado["altas"] += 1
        estado["bajas"] = 0
    else:
        estado["bajas"] += 1
        estado["altas"] = 0
    if estado["pub"] is None:
        estado["pub"] = crudo
    elif not estado["pub"] and estado["altas"] >= ALTAS_PARA_ALERTAR:
        estado["pub"] = True
    elif estado["pub"] and estado["bajas"] >= BAJAS_PARA_NORMAL:
        estado["pub"] = False
    anomalia = estado["pub"]

    payload = {
        "nodo_id": NODE_ID,
        "anomalia": anomalia,
        "valor": int(anomalia),
        "score": round(score, 4),
        "umbral": round(UMBRAL, 4),
        "temperatura": float(t[-1]),
        "humedad": float(h[-1]),
        "timestamp": ts or datetime.now(timezone.utc).isoformat(),
    }
    client.publish(T_OUT, json.dumps(payload), qos=1, retain=True)
    if anomalia != estado["last_anom"]:
        LOG.info("Anomalía=%s (T=%.1f H=%.0f score=%.4f)", anomalia, t[-1], h[-1], score)
        estado["last_anom"] = anomalia


def on_connect(client, _u, _f, rc, _p):
    if rc.is_failure:
        LOG.warning("MQTT rechazó la conexión: %s", rc)
        return
    LOG.info("Conectado al broker; suscrito a %s", BASE)
    client.subscribe([(T_TEMP, 0), (T_HUM, 0), (T_ACT, 1)])


def on_message(client, _u, msg):
    try:
        p = json.loads(msg.payload)
    except ValueError:
        return
    if msg.topic == T_TEMP:
        estado["t"] = float(p["valor"])
    elif msg.topic == T_HUM:
        estado["h"] = float(p["valor"])
    elif msg.topic == T_ACT:
        evaluar(client, p)


client = mqtt.Client(
    callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
    client_id=os.getenv("MQTT_CLIENT_ID", "smartegg-ml-se01"),
    protocol=mqtt.MQTTv311,
)
if os.getenv("MQTT_USERNAME"):
    client.username_pw_set(os.getenv("MQTT_USERNAME"), os.getenv("MQTT_PASSWORD", ""))
client.on_connect = on_connect
client.on_message = on_message
client.reconnect_delay_set(1, 30)

while True:
    try:
        client.connect(os.getenv("MQTT_HOST", "localhost"), int(os.getenv("MQTT_PORT", "1883")), 60)
        client.loop_forever()
    except Exception as exc:
        LOG.warning("MQTT no disponible (%s); reintento en 5 s", exc)
        time.sleep(5)
