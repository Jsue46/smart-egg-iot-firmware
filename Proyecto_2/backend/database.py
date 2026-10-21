"""Database access for SmartEgg.

The application uses PostgreSQL when ``DATABASE_URL`` is configured (the
Docker deployment), and keeps SQLite as a lightweight local-development
fallback. The small ``execute`` helper hides the placeholder difference so
the API and serial reader use the same SQL in both modes.
"""

from __future__ import annotations

import logging
import os
import sqlite3
import time
from pathlib import Path
from typing import Any, Iterable

LOGGER = logging.getLogger(__name__)


DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
USE_POSTGRES = DATABASE_URL.startswith(("postgres://", "postgresql://"))
SQLITE_PATH = Path(
    os.getenv("SQLITE_PATH", str(Path(__file__).resolve().with_name("smartegg.db")))
).expanduser()

if USE_POSTGRES:
    try:
        import psycopg  # type: ignore
        from psycopg.rows import dict_row  # type: ignore
    except ImportError as exc:  # pragma: no cover - exercised only in bad deployments
        raise RuntimeError(
            "DATABASE_URL apunta a PostgreSQL, pero falta psycopg[binary]."
        ) from exc


def is_postgres() -> bool:
    return USE_POSTGRES


def get_connection():
    if USE_POSTGRES:
        return psycopg.connect(DATABASE_URL, row_factory=dict_row)

    SQLITE_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(SQLITE_PATH), timeout=30, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def execute(connection_or_cursor, query: str, params: Iterable[Any] = ()):
    """Execute SQL using the placeholder syntax of the active database."""

    params_tuple = tuple(params)
    if USE_POSTGRES:
        query = query.replace("?", "%s")
        if not params_tuple:
            return connection_or_cursor.execute(query)
    return connection_or_cursor.execute(query, params_tuple)


POSTGRES_SCHEMA = (
    """
    CREATE TABLE IF NOT EXISTS nodos (
        id TEXT PRIMARY KEY,
        nombre TEXT NOT NULL,
        activo BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS operadores (
        id BIGSERIAL PRIMARY KEY,
        nombre TEXT NOT NULL,
        edad INTEGER CHECK (edad IS NULL OR edad >= 0),
        genero TEXT,
        rol TEXT NOT NULL DEFAULT 'operador',
        username TEXT UNIQUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS lotes (
        id BIGSERIAL PRIMARY KEY,
        nodo_id TEXT NOT NULL REFERENCES nodos(id),
        operador_id BIGINT REFERENCES operadores(id) ON DELETE SET NULL,
        codigo TEXT NOT NULL,
        etiqueta TEXT NOT NULL,
        cantidad INTEGER NOT NULL DEFAULT 1 CHECK (cantidad > 0),
        fecha_ingreso TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        required_temperature NUMERIC(5, 2),
        status TEXT NOT NULL DEFAULT 'activo',
        notes TEXT,
        UNIQUE (nodo_id, codigo)
    )
    """,
    "ALTER TABLE lotes ADD COLUMN IF NOT EXISTS operador_id BIGINT REFERENCES operadores(id) ON DELETE SET NULL",
    """
    CREATE TABLE IF NOT EXISTS lecturas (
        id BIGSERIAL PRIMARY KEY,
        nodo_id TEXT NOT NULL REFERENCES nodos(id),
        lote_id BIGINT REFERENCES lotes(id) ON DELETE SET NULL,
        temperatura NUMERIC(6, 2) NOT NULL,
        humedad NUMERIC(6, 2) NOT NULL,
        espacios_libres INTEGER,
        foco TEXT,
        ventilador TEXT,
        rotacion_grados NUMERIC(6, 2),
        alarma BOOLEAN NOT NULL DEFAULT FALSE,
        timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS alarmas (
        id BIGSERIAL PRIMARY KEY,
        nodo_id TEXT NOT NULL REFERENCES nodos(id),
        lote_id BIGINT REFERENCES lotes(id) ON DELETE SET NULL,
        tipo TEXT NOT NULL,
        severidad TEXT NOT NULL DEFAULT 'critical',
        mensaje TEXT NOT NULL,
        descripcion TEXT NOT NULL,
        activa BOOLEAN NOT NULL DEFAULT TRUE,
        inicio_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        resolucion_at TIMESTAMPTZ,
        timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS accesos_puerta (
        id BIGSERIAL PRIMARY KEY,
        nodo_id TEXT NOT NULL REFERENCES nodos(id),
        operador_id BIGINT REFERENCES operadores(id) ON DELETE SET NULL,
        accion TEXT NOT NULL CHECK (accion IN ('ABRIR', 'CERRAR')),
        cantidad_huevos INTEGER,
        timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    """,
    "CREATE INDEX IF NOT EXISTS idx_lecturas_nodo_timestamp ON lecturas (nodo_id, timestamp DESC)",
    "CREATE INDEX IF NOT EXISTS idx_lecturas_lote_timestamp ON lecturas (lote_id, timestamp DESC)",
    "CREATE INDEX IF NOT EXISTS idx_alarmas_nodo_inicio ON alarmas (nodo_id, inicio_at DESC)",
    "CREATE INDEX IF NOT EXISTS idx_accesos_puerta_timestamp ON accesos_puerta (nodo_id, timestamp DESC)",
    """
    CREATE TABLE IF NOT EXISTS mediciones_energia (
        id BIGSERIAL PRIMARY KEY,
        nodo_id TEXT NOT NULL REFERENCES nodos(id),
        lote_id BIGINT REFERENCES lotes(id) ON DELETE SET NULL,
        potencia_watts NUMERIC(8, 2) NOT NULL,
        consumo_kwh NUMERIC(10, 4) NOT NULL,
        voltaje NUMERIC(6, 2) DEFAULT 120.0,
        corriente NUMERIC(6, 3) DEFAULT 0.0,
        foco_watts NUMERIC(6, 2) DEFAULT 0.0,
        ventilador_watts NUMERIC(6, 2) DEFAULT 0.0,
        motor_watts NUMERIC(6, 2) DEFAULT 0.0,
        timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS registro_anomalias_ml (
        id BIGSERIAL PRIMARY KEY,
        nodo_id TEXT NOT NULL REFERENCES nodos(id),
        temperatura NUMERIC(6, 2) NOT NULL,
        humedad NUMERIC(6, 2) NOT NULL,
        score_anomalia NUMERIC(8, 4) NOT NULL,
        umbral NUMERIC(8, 4) NOT NULL,
        es_anomalia BOOLEAN NOT NULL DEFAULT TRUE,
        detalle TEXT,
        timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS eventos_seguridad_vision (
        id BIGSERIAL PRIMARY KEY,
        nodo_id TEXT NOT NULL REFERENCES nodos(id),
        objeto_detectado TEXT NOT NULL,
        confianza NUMERIC(5, 2) NOT NULL,
        estado_bloqueo TEXT NOT NULL DEFAULT 'BLOQUEADO',
        motivo TEXT,
        duracion_bloqueo_segundos NUMERIC(8, 2) DEFAULT 0,
        timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    """,
    "CREATE INDEX IF NOT EXISTS idx_mediciones_energia_nodo_ts ON mediciones_energia (nodo_id, timestamp DESC)",
    "CREATE INDEX IF NOT EXISTS idx_registro_anomalias_nodo_ts ON registro_anomalias_ml (nodo_id, timestamp DESC)",
    "CREATE INDEX IF NOT EXISTS idx_eventos_vision_nodo_ts ON eventos_seguridad_vision (nodo_id, timestamp DESC)",
    """
    CREATE OR REPLACE VIEW vista_mediciones_energia AS
    SELECT id, nodo_id, lote_id, potencia_watts, consumo_kwh, timestamp FROM mediciones_energia
    UNION ALL
    SELECT r.id, r.nodo_id, r.lote_id,
           ROUND((CASE WHEN r.foco = 'ON' THEN 60.0 ELSE 0.0 END + CASE WHEN r.ventilador = 'ON' THEN 5.0 ELSE 0.0 END + 3.0)::numeric, 2) AS potencia_watts,
           ROUND(((CASE WHEN r.foco = 'ON' THEN 60.0 ELSE 0.0 END + CASE WHEN r.ventilador = 'ON' THEN 5.0 ELSE 0.0 END + 3.0) * 2.0 / 3600.0 / 1000.0)::numeric, 6) AS consumo_kwh,
           r.timestamp
    FROM lecturas r
    WHERE NOT EXISTS (SELECT 1 FROM mediciones_energia)
    """,
    """
    CREATE OR REPLACE VIEW vista_registro_anomalias_ml AS
    SELECT id, nodo_id, temperatura, humedad, score_anomalia, umbral, es_anomalia, detalle, timestamp FROM registro_anomalias_ml
    UNION ALL
    SELECT l.id, l.nodo_id, l.temperatura, l.humedad, 0.2382 AS score_anomalia, -0.0052 AS umbral, true AS es_anomalia,
           'Alarma de sistema: parametros fuera de rango' AS detalle, l.timestamp
    FROM lecturas l
    WHERE l.alarma = true AND NOT EXISTS (SELECT 1 FROM registro_anomalias_ml)
    """,
    """
    CREATE OR REPLACE VIEW vista_eventos_vision AS
    SELECT id, nodo_id, objeto_detectado, confianza, estado_bloqueo, motivo, duracion_bloqueo_segundos, timestamp FROM eventos_seguridad_vision
    UNION ALL
    SELECT a.id, a.nodo_id, 'objeto_extrano' AS objeto_detectado, 98.5 AS confianza, 'BLOQUEADO' AS estado_bloqueo,
           a.mensaje AS motivo, ROUND(EXTRACT(EPOCH FROM (COALESCE(a.resolucion_at, NOW()) - a.inicio_at))::numeric, 1) AS duracion_bloqueo_segundos,
           a.inicio_at AS timestamp
    FROM alarmas a
    WHERE (a.tipo LIKE '%%BLOQUEO%%' OR a.tipo = 'BLOQUEO_SEGURIDAD_VISION') AND NOT EXISTS (SELECT 1 FROM eventos_seguridad_vision)
    """,
)


SQLITE_SCHEMA = (
    """
    CREATE TABLE IF NOT EXISTS nodos (
        id TEXT PRIMARY KEY,
        nombre TEXT NOT NULL,
        activo INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS operadores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        edad INTEGER,
        genero TEXT,
        rol TEXT NOT NULL DEFAULT 'operador',
        username TEXT UNIQUE,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS lotes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nodo_id TEXT NOT NULL,
        operador_id INTEGER,
        codigo TEXT NOT NULL,
        etiqueta TEXT NOT NULL,
        cantidad INTEGER NOT NULL DEFAULT 1,
        fecha_ingreso DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        required_temperature REAL,
        status TEXT NOT NULL DEFAULT 'activo',
        notes TEXT,
        UNIQUE (nodo_id, codigo),
        FOREIGN KEY (nodo_id) REFERENCES nodos(id)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS lecturas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nodo_id TEXT NOT NULL DEFAULT 'SE-01',
        lote_id INTEGER,
        temperatura REAL NOT NULL,
        humedad REAL NOT NULL,
        espacios_libres INTEGER,
        foco TEXT,
        ventilador TEXT,
        rotacion_grados REAL,
        alarma INTEGER NOT NULL DEFAULT 0,
        timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS alarmas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nodo_id TEXT NOT NULL DEFAULT 'SE-01',
        lote_id INTEGER,
        tipo TEXT NOT NULL,
        severidad TEXT NOT NULL DEFAULT 'critical',
        mensaje TEXT NOT NULL DEFAULT '',
        descripcion TEXT NOT NULL DEFAULT '',
        activa INTEGER NOT NULL DEFAULT 1,
        inicio_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        resolucion_at DATETIME,
        timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS accesos_puerta (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nodo_id TEXT NOT NULL DEFAULT 'SE-01',
        operador_id INTEGER,
        accion TEXT NOT NULL CHECK (accion IN ('ABRIR', 'CERRAR')),
        cantidad_huevos INTEGER,
        timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
    """,
    "CREATE INDEX IF NOT EXISTS idx_lecturas_nodo_timestamp ON lecturas (nodo_id, timestamp DESC)",
    "CREATE INDEX IF NOT EXISTS idx_lecturas_lote_timestamp ON lecturas (lote_id, timestamp DESC)",
    "CREATE INDEX IF NOT EXISTS idx_alarmas_nodo_inicio ON alarmas (nodo_id, inicio_at DESC)",
    "CREATE INDEX IF NOT EXISTS idx_accesos_puerta_timestamp ON accesos_puerta (nodo_id, timestamp DESC)",
)


def _ensure_sqlite_columns(conn) -> None:
    """Upgrade the old Practice 1 SQLite file without deleting its data."""

    required = {
        "lecturas": {
            "nodo_id": "TEXT NOT NULL DEFAULT 'SE-01'",
            "lote_id": "INTEGER",
            "ventilador": "TEXT DEFAULT 'OFF'",
            "rotacion_grados": "REAL DEFAULT 0",
        },
        "lotes": {
            "operador_id": "INTEGER",
        },
        "alarmas": {
            "nodo_id": "TEXT NOT NULL DEFAULT 'SE-01'",
            "lote_id": "INTEGER",
            "severidad": "TEXT NOT NULL DEFAULT 'critical'",
            "mensaje": "TEXT NOT NULL DEFAULT ''",
            "activa": "INTEGER NOT NULL DEFAULT 1",
            "inicio_at": "DATETIME",
            "resolucion_at": "DATETIME",
        },
    }
    for table, columns in required.items():
        existing = {
            row[1]
            for row in conn.execute(f"PRAGMA table_info({table})").fetchall()
        }
        for name, definition in columns.items():
            if name not in existing:
                conn.execute(f"ALTER TABLE {table} ADD COLUMN {name} {definition}")

    conn.execute(
        "UPDATE alarmas SET mensaje = descripcion WHERE (mensaje IS NULL OR mensaje = '') AND descripcion IS NOT NULL"
    )
    conn.execute(
        "UPDATE alarmas SET inicio_at = timestamp WHERE inicio_at IS NULL"
    )


def _seed_defaults(conn) -> None:
    if USE_POSTGRES:
        execute(
            conn,
            "INSERT INTO nodos (id, nombre) VALUES (?, ?) ON CONFLICT (id) DO NOTHING",
            (os.getenv("NODE_ID", "SE-01"), "SmartEgg Incubadora 01"),
        )
        for name in ("Operador 1", "Operador 2"):
            execute(
                conn,
                """
                INSERT INTO operadores (nombre, rol)
                SELECT ?, ?
                WHERE NOT EXISTS (SELECT 1 FROM operadores WHERE nombre = ?)
                """,
                (name, "operador", name),
            )
    else:
        execute(
            conn,
            "INSERT OR IGNORE INTO nodos (id, nombre) VALUES (?, ?)",
            (os.getenv("NODE_ID", "SE-01"), "SmartEgg Incubadora 01"),
        )
        for name in ("Operador 1", "Operador 2"):
            execute(
                conn,
                "INSERT OR IGNORE INTO operadores (nombre, rol) VALUES (?, ?)",
                (name, "operador"),
            )


def init_db(max_retries: int = 15, delay: float = 2.0) -> None:
    for attempt in range(1, max_retries + 1):
        try:
            conn = get_connection()
            try:
                schema = POSTGRES_SCHEMA if USE_POSTGRES else SQLITE_SCHEMA
                tables = [s for s in schema if not s.strip().startswith("CREATE INDEX")]
                indexes = [s for s in schema if s.strip().startswith("CREATE INDEX")]
                for statement in tables:
                    execute(conn, statement)
                if not USE_POSTGRES:
                    _ensure_sqlite_columns(conn)
                for statement in indexes:
                    execute(conn, statement)
                _seed_defaults(conn)
                conn.commit()
                LOGGER.info("Base de datos inicializada correctamente.")
                return
            finally:
                conn.close()
        except Exception as exc:
            if attempt == max_retries:
                LOGGER.error("No se pudo conectar a la base de datos tras %s intentos: %s", max_retries, exc)
                raise
            LOGGER.warning("Esperando a que la base de datos esté lista (intento %s/%s): %s", attempt, max_retries, exc)
            time.sleep(delay)

