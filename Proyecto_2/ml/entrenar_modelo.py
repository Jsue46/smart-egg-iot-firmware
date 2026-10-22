# %% [markdown]
# # SmartEgg Fase 3 - Detección de anomalías con Isolation Forest
# Entrena solo con comportamiento normal, elige hiperparámetros y umbral en validación,
# y reporta métricas finales en un conjunto de prueba (split temporal 50/25/25).

# %%
import json
import os
import joblib
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from sklearn.ensemble import IsolationForest
from sklearn.metrics import (
    ConfusionMatrixDisplay, confusion_matrix, f1_score, precision_recall_curve,
    precision_score, recall_score, roc_auc_score,
)

CSV_PATH = "ml/data/lecturas_sinteticas.csv"
VENTANA = 30  # lecturas (30 x 2 s = 1 minuto)
FEATURES = ["temperatura", "humedad", "foco_i", "ventilador_i", "t_std", "h_std", "t_delta"]
os.makedirs("ml/model", exist_ok=True)
os.makedirs("ml/figs", exist_ok=True)

# %% [markdown]
# ## 1. Carga y exploración

# %%
df = pd.read_csv(CSV_PATH, parse_dates=["timestamp"]).sort_values("timestamp").reset_index(drop=True)
print("Forma:", df.shape)
print("Nulos por columna:\n", df.isna().sum())
print("Timestamps duplicados:", df.duplicated(subset="timestamp").sum())
print(df[["temperatura", "humedad"]].describe().round(2))

fig, ax = plt.subplots(1, 2, figsize=(10, 3.5))
df["temperatura"].hist(bins=80, ax=ax[0]); ax[0].set_title("Distribución de temperatura (°C)")
df["humedad"].hist(bins=80, ax=ax[1]); ax[1].set_title("Distribución de humedad (%)")
plt.tight_layout(); plt.savefig("ml/figs/01_distribuciones.png", dpi=120); plt.close()

# %% [markdown]
# ## 2. Features (ventana móvil de 30 lecturas)

# %%
df["foco_i"] = (df["foco"] == "ON").astype(int)
df["ventilador_i"] = (df["ventilador"] == "ON").astype(int)
df["t_std"] = df["temperatura"].rolling(VENTANA).std()
df["h_std"] = df["humedad"].rolling(VENTANA).std()
df["t_delta"] = df["temperatura"] - df["temperatura"].shift(VENTANA - 1)
df = df.dropna(subset=FEATURES).reset_index(drop=True)

n = len(df)
i1, i2 = int(n * 0.50), int(n * 0.75)
train, val, test = df.iloc[:i1], df.iloc[i1:i2], df.iloc[i2:]
train_norm = train[train["anomalia_real"] == 0]
for nombre, d in (("train", train), ("val", val), ("test", test)):
    print(f"{nombre}: {len(d)} filas, {d['anomalia_real'].mean() * 100:.2f}% anomalías")
print("Entrenamiento (solo normales):", len(train_norm))

# %% [markdown]
# ## 3. Selección de hiperparámetros (AUC-ROC en validación)

# %%
mejor = None
for n_est in (100, 200, 300):
    for max_s in (256, 1024, "auto"):
        m = IsolationForest(n_estimators=n_est, max_samples=max_s, contamination="auto",
                            random_state=42, n_jobs=-1).fit(train_norm[FEATURES])
        auc = roc_auc_score(val["anomalia_real"], -m.decision_function(val[FEATURES]))
        print(f"n_estimators={n_est:<4} max_samples={str(max_s):<5} AUC val={auc:.4f}")
        if mejor is None or auc > mejor[0]:
            mejor = (auc, n_est, max_s, m)
auc_val, n_est, max_s, modelo = mejor
print(f"\nMejor: n_estimators={n_est}, max_samples={max_s}, AUC val={auc_val:.4f}")

# %% [markdown]
# ## 4. Umbral de alerta (máximo F1 en validación)

# %%
s_val = -modelo.decision_function(val[FEATURES])  # mayor = más anómalo
p, r, th = precision_recall_curve(val["anomalia_real"], s_val)
f1s = 2 * p[:-1] * r[:-1] / (p[:-1] + r[:-1] + 1e-12)
umbral = float(th[np.argmax(f1s)])
print(f"Umbral elegido: {umbral:.4f} (F1 val={f1s.max():.4f})")

# %% [markdown]
# ## 5. Evaluación final en test

# %%
y = test["anomalia_real"].values
s_test = -modelo.decision_function(test[FEATURES])
y_pred = (s_test >= umbral).astype(int)

metricas = {
    "precision": float(precision_score(y, y_pred)),
    "recall": float(recall_score(y, y_pred)),
    "f1": float(f1_score(y, y_pred)),
    "auc_roc": float(roc_auc_score(y, s_test)),
}
print("Isolation Forest (test):", {k: round(v, 4) for k, v in metricas.items()})
print("Matriz de confusión [[TN FP],[FN TP]]:\n", confusion_matrix(y, y_pred))

# Línea base: regla fija del firmware (columna 'alarma')
yb = test["alarma"].astype(int).values
base = {"precision": precision_score(y, yb, zero_division=0),
        "recall": recall_score(y, yb), "f1": f1_score(y, yb)}
print("Regla fija del firmware (test):", {k: round(float(v), 4) for k, v in base.items()})

ConfusionMatrixDisplay(confusion_matrix(y, y_pred), display_labels=["normal", "anomalía"]).plot(cmap="Blues")
plt.title("Matriz de confusión (test)"); plt.savefig("ml/figs/02_matriz_confusion.png", dpi=120); plt.close()

plt.figure(figsize=(8, 3.5))
plt.hist(s_test[y == 0], bins=80, alpha=0.6, label="normal")
plt.hist(s_test[y == 1], bins=80, alpha=0.6, label="anomalía")
plt.axvline(umbral, color="r", ls="--", label="umbral"); plt.legend(); plt.title("Score de anomalía (test)")
plt.savefig("ml/figs/03_scores.png", dpi=120); plt.close()

# %% [markdown]
# ## 6. Guardado del modelo

# %%
joblib.dump(modelo, "ml/model/isoforest.joblib")
with open("ml/model/config.json", "w") as f:
    json.dump({"features": FEATURES, "ventana": VENTANA, "umbral": umbral,
               "n_estimators": n_est, "max_samples": str(max_s), "metricas_test": metricas}, f, indent=2)
print("Guardado en ml/model/")
