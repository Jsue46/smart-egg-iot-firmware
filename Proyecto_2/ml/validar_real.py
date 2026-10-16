import json
import joblib
import pandas as pd

cfg = json.load(open("ml/model/config.json"))
modelo = joblib.load("ml/model/isoforest.joblib")
V, F, U = cfg["ventana"], cfg["features"], cfg["umbral"]

df = pd.read_csv("ml/data/lecturas_reales.csv")
df["ts"] = pd.to_datetime(df["timestamp"], format="mixed", utc=True)
df = df[df["ts"] >= "2026-09-11"].sort_values("ts").reset_index(drop=True)
df = df[(df["temperatura"] > 0) & (df["humedad"] > 0)].reset_index(drop=True)

df["seg"] = (df["ts"].diff().dt.total_seconds() > 60).cumsum()
df["foco_i"] = (df["foco"] == "ON").astype(int)
df["ventilador_i"] = (df["ventilador"] == "ON").astype(int)
g = df.groupby("seg")
df["t_std"] = g["temperatura"].transform(lambda s: s.rolling(V).std())
df["h_std"] = g["humedad"].transform(lambda s: s.rolling(V).std())
df["t_delta"] = df["temperatura"] - g["temperatura"].shift(V - 1)
df = df.dropna(subset=F)

df["score"] = -modelo.decision_function(df[F])
df["anomalia_ml"] = df["score"] >= U

print("Filas evaluadas:", len(df))
print("% marcadas como anomalía:", round(df["anomalia_ml"].mean() * 100, 1))
bandas = pd.cut(df["temperatura"], [0, 30, 36, 39, 50], labels=["<30", "30-36", "36-39", ">39"])
print(df.groupby(bandas, observed=True)["anomalia_ml"].agg(["count", "mean"]).round(3))
