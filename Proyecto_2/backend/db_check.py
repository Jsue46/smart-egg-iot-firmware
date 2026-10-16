import os, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
os.environ.setdefault("DATABASE_URL", "postgresql://smartegg:cambiar_esta_clave@localhost:5433/smartegg")

from database import get_connection, execute
from collections import Counter

conn = get_connection()

print("=== ULTIMAS 20 LECTURAS (mas reciente primero) ===")
rows = execute(conn, "SELECT temperatura, humedad, foco, ventilador, alarma, timestamp FROM lecturas ORDER BY timestamp DESC LIMIT 20").fetchall()
for r in rows:
    print(f"  T={r['temperatura']:<6}  H={r['humedad']:<6}  foco={r['foco']:<3}  fan={r['ventilador']:<3}  alarma={r['alarma']}  @ {r['timestamp']}")

print("\n=== DISTRIBUCION DE TEMPERATURAS (ultimas 200 lecturas) ===")
temps = [row['temperatura'] for row in execute(conn, "SELECT temperatura FROM lecturas ORDER BY timestamp DESC LIMIT 200").fetchall()]
counter = Counter(float(t) for t in temps)
for t, n in sorted(counter.items()):
    print(f"  {t}C -> {n} lecturas {'<-- VALOR POR DEFECTO' if t == 25.0 else ''}")

print(f"\n  Total lecturas analizadas: {len(temps)}")
conn.close()
