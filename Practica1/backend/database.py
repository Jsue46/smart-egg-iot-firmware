import sqlite3

DB_PATH = "smartegg.db"

def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row  
    return conn

def init_db():
    conn = get_connection()
    cursor = conn.cursor()

    # Lecturas del sensor (temperatura O humedad)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS lecturas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            temperatura REAL NOT NULL,
            humedad REAL NOT NULL,
            espacios_libres INTEGER,
            foco TEXT,
            fan TEXT,
            alarma INTEGER DEFAULT 0,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Registro de huevos por lote
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS huevos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            lote TEXT NOT NULL,
            etiqueta TEXT NOT NULL,
            fecha_ingreso DATETIME DEFAULT CURRENT_TIMESTAMP,
            tecnico TEXT NOT NULL,
            notas TEXT
        )
    """)

    # Alarmas
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS alarmas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tipo TEXT NOT NULL,
            descripcion TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)

    conn.commit()
    conn.close()