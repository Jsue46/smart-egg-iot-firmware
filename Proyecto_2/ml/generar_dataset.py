import os
import numpy as np
import pandas as pd

rng = np.random.default_rng(42)
N = 86400            # 2 días a 1 lectura cada 2 s
PASO_S = 2

# --- 1. Plan de anomalías (0 = normal) ---
# 1 pico del sensor | 2 foco pegado ON | 3 foco pegado OFF | 4 salto de humedad | 5 sensor congelado
kind = np.zeros(N, dtype=int)
pos = 2000
while pos < N - 600:
    k = int(rng.integers(1, 6))
    largo = {1: 20, 2: 400, 3: 400, 4: 60, 5: 80}[k] + int(rng.integers(0, 30))
    kind[pos:pos + largo] = k
    pos += largo + int(rng.integers(1500, 4000))

# --- 2. Simulación ---
T, H = 37.5, 58.0
H0 = 58.0
foco, fan = True, False
amb = 26.0
prev_k = 0
spike_off, hum_shift = 0.0, 0.0
last_T, last_H = T, H
filas = []
t0 = pd.Timestamp("2026-10-01 00:00:00", tz="UTC")

for i in range(N):
    if i % 3600 == 0:
        H0 = rng.uniform(52, 64)
    k = kind[i]
    if k != prev_k and k != 0:
        spike_off = rng.uniform(2.5, 4.0)
        hum_shift = rng.choice([-1, 1]) * rng.uniform(12, 18)
    prev_k = k

    amb += rng.normal(0, 0.01)
    amb = float(np.clip(amb, 22, 30))

    # medición (lo que lee el sensor)
    Tm = T + rng.normal(0, 0.03)
    Hm = H + rng.normal(0, 0.15)
    if k == 1:
        Tm += spike_off
    if k == 4:
        Hm += hum_shift
    if k == 5:
        Tm, Hm = last_T, last_H
    last_T, last_H = Tm, Hm

    # control (igual que el firmware, con histéresis)
    if Tm < 37.2:
        foco = True
    elif Tm > 37.8:
        foco = False
    if Tm >= 38.0:
        fan = True
    elif Tm <= 37.8:
        fan = False
    if k == 2:
        foco = True      # foco pegado ON
    if k == 3:
        foco = False     # foco pegado OFF

    # física
    heat = 0.03 if foco else 0.0
    cool = 0.006 if fan else 0.0
    T += heat - cool - 0.0015 * (T - amb) + rng.normal(0, 0.01)
    H += 0.02 * (H0 - H) + rng.normal(0, 0.15)

    alarma = (Tm >= 38.5) or (Hm < 50.0) or (Hm > 65.0)
    filas.append((
        (t0 + pd.Timedelta(seconds=i * PASO_S)).isoformat(),
        round(Tm, 1), float(round(Hm)),
        "ON" if foco else "OFF",
        "ON" if fan else "OFF",
        45 if (i // 30) % 2 == 0 else 135,
        bool(alarma),
        int(k != 0),
    ))

df = pd.DataFrame(filas, columns=[
    "timestamp", "temperatura", "humedad", "foco", "ventilador",
    "rotacion_grados", "alarma", "anomalia_real",
])

os.makedirs("ml/data", exist_ok=True)
df.to_csv("ml/data/lecturas_sinteticas.csv", index=False)

print("Filas:", len(df))
print("% anomalías reales:", round(df.anomalia_real.mean() * 100, 2))
print("% alarma del firmware:", round(df.alarma.mean() * 100, 2))
print(df[["temperatura", "humedad"]].describe().round(2))
print(df.head(5).to_string(index=False))
