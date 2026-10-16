import json
import random
import time
from datetime import datetime, timezone

import paho.mqtt.client as mqtt

NODE = "SE-01"
BASE = f"smartegg/{NODE}"
PASO = 0.5  # segundos entre lecturas (la real es cada 2 s; así la prueba dura menos)

c = mqtt.Client(callback_api_version=mqtt.CallbackAPIVersion.VERSION2, client_id="prueba-ml")
c.connect("localhost", 1883, 60)
c.loop_start()


def publicar(T, H, foco, vent):
    ts = datetime.now(timezone.utc).isoformat()
    c.publish(f"{BASE}/sensores/temperatura",
              json.dumps({"nodo_id": NODE, "valor": round(T, 1), "unidad": "°C", "timestamp": ts}))
    c.publish(f"{BASE}/sensores/humedad",
              json.dumps({"nodo_id": NODE, "valor": float(round(H)), "unidad": "%", "timestamp": ts}))
    c.publish(f"{BASE}/actuadores/estado",
              json.dumps({"nodo_id": NODE, "foco": foco, "ventilador": vent,
                          "rotacion_grados": 45.0, "espacios_libres": 3, "timestamp": ts}), qos=1)
    time.sleep(PASO)


def normal(n):
    T, foco = 37.5, True
    for _ in range(n):
        Tm = round(T + random.gauss(0, 0.05), 1)
        if Tm < 37.2:
            foco = True
        elif Tm > 37.8:
            foco = False
        T += (0.03 if foco else 0.0) - 0.0015 * (T - 26) + random.gauss(0, 0.01)
        publicar(Tm, random.choice([57, 58, 58, 59]), "ON" if foco else "OFF", "OFF")


print("FASE 1: incubadora sana a 37.5 C (esperado: anomalia = False)")
normal(80)

print("FASE 2: sensor pegado al foco, calentamiento brusco (esperado: anomalia = True)")
for i in range(20):                       # sube 8 C en 20 lecturas
    T = 37.5 + 8 * (i + 1) / 20
    publicar(T, 58 - 2.7 * (T - 37.5), "ON" if T < 37.8 else "OFF", "ON" if T >= 38.0 else "OFF")
for _ in range(20):                       # se mantiene arriba
    publicar(45.5, 36, "OFF", "ON")
for i in range(20):                       # baja
    T = 45.5 - 8 * (i + 1) / 20
    publicar(T, 58 - 2.7 * (T - 37.5), "OFF", "ON" if T >= 38.0 else "OFF")

print("FASE 3: vuelve a la normalidad (esperado: anomalia = False)")
normal(80)

print("Fin de la prueba")
c.loop_stop()
