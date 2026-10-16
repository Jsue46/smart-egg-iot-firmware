import sqlite3
import pandas as pd

conn = sqlite3.connect("backend/smartegg.db")

print("Tablas:", [r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")])

df = pd.read_sql("SELECT * FROM lecturas ORDER BY timestamp", conn)
print("Filas:", len(df))
print("Columnas:", list(df.columns))
if len(df):
    print("Desde:", df["timestamp"].min(), "  Hasta:", df["timestamp"].max())
    print(df[["temperatura", "humedad"]].describe().round(2))
    print(df.head(15).to_string(index=False))
    df.to_csv("ml/data/lecturas_reales.csv", index=False)
    print("Guardado en ml/data/lecturas_reales.csv")
