-- SmartEgg PostgreSQL schema. Mounted into the official postgres image on
-- first startup; the backend keeps the same DDL idempotently for restarts.

CREATE TABLE IF NOT EXISTS nodos (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS operadores (
    id BIGSERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    edad INTEGER CHECK (edad IS NULL OR edad >= 0),
    genero TEXT,
    rol TEXT NOT NULL DEFAULT 'operador',
    username TEXT UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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
);

ALTER TABLE lotes
    ADD COLUMN IF NOT EXISTS operador_id BIGINT REFERENCES operadores(id) ON DELETE SET NULL;

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
);

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
);

CREATE TABLE IF NOT EXISTS accesos_puerta (
    id BIGSERIAL PRIMARY KEY,
    nodo_id TEXT NOT NULL REFERENCES nodos(id),
    operador_id BIGINT REFERENCES operadores(id) ON DELETE SET NULL,
    accion TEXT NOT NULL CHECK (accion IN ('ABRIR', 'CERRAR')),
    cantidad_huevos INTEGER,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lecturas_nodo_timestamp
    ON lecturas (nodo_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_lecturas_lote_timestamp
    ON lecturas (lote_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_alarmas_nodo_inicio
    ON alarmas (nodo_id, inicio_at DESC);
CREATE INDEX IF NOT EXISTS idx_accesos_puerta_timestamp
    ON accesos_puerta (nodo_id, timestamp DESC);

INSERT INTO nodos (id, nombre)
VALUES ('SE-01', 'SmartEgg Incubadora 01')
ON CONFLICT (id) DO NOTHING;

INSERT INTO operadores (nombre, rol)
SELECT 'Operador 1', 'operador'
WHERE NOT EXISTS (SELECT 1 FROM operadores WHERE nombre = 'Operador 1');

INSERT INTO operadores (nombre, rol)
SELECT 'Operador 2', 'operador'
WHERE NOT EXISTS (SELECT 1 FROM operadores WHERE nombre = 'Operador 2');
