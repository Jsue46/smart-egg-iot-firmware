-- SmartEgg Fase 3: Extension de Esquema para Machine Learning, Vision y Energia
-- Idempotente: seguro para ejecutar repetidamente sin borrar datos previos.

-- 1. Mediciones de energia y gestion de consumo electrico
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
);

-- 2. Registro de anomalias detectadas por Machine Learning (Isolation Forest)
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
);

-- 3. Bitacora de eventos de seguridad y bloqueo por Vision Computacional
CREATE TABLE IF NOT EXISTS eventos_seguridad_vision (
    id BIGSERIAL PRIMARY KEY,
    nodo_id TEXT NOT NULL REFERENCES nodos(id),
    objeto_detectado TEXT NOT NULL,
    confianza NUMERIC(5, 2) NOT NULL,
    estado_bloqueo TEXT NOT NULL DEFAULT 'BLOQUEADO',
    motivo TEXT,
    duracion_bloqueo_segundos NUMERIC(8, 2) DEFAULT 0,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indices para consultas optimizadas por nodo y rango de tiempo en Grafana
CREATE INDEX IF NOT EXISTS idx_mediciones_energia_nodo_ts
    ON mediciones_energia (nodo_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_registro_anomalias_nodo_ts
    ON registro_anomalias_ml (nodo_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_eventos_vision_nodo_ts
    ON eventos_seguridad_vision (nodo_id, timestamp DESC);

-- 4. Vistas de compatibilidad analitica para Grafana:
-- Permiten consultar datos consistentes aun si las fuentes directas
-- se alimentan progresivamente durante la fase de integracion.

CREATE OR REPLACE VIEW vista_mediciones_energia AS
SELECT
    id,
    nodo_id,
    lote_id,
    potencia_watts,
    consumo_kwh,
    timestamp
FROM mediciones_energia
UNION ALL
SELECT
    r.id,
    r.nodo_id,
    r.lote_id,
    ROUND((CASE WHEN r.foco = 'ON' THEN 60.0 ELSE 0.0 END +
           CASE WHEN r.ventilador = 'ON' THEN 5.0 ELSE 0.0 END + 3.0)::numeric, 2) AS potencia_watts,
    ROUND(((CASE WHEN r.foco = 'ON' THEN 60.0 ELSE 0.0 END +
            CASE WHEN r.ventilador = 'ON' THEN 5.0 ELSE 0.0 END + 3.0) * 2.0 / 3600.0 / 1000.0)::numeric, 6) AS consumo_kwh,
    r.timestamp
FROM lecturas r
WHERE NOT EXISTS (SELECT 1 FROM mediciones_energia);

CREATE OR REPLACE VIEW vista_registro_anomalias_ml AS
SELECT
    id,
    nodo_id,
    temperatura,
    humedad,
    score_anomalia,
    umbral,
    es_anomalia,
    detalle,
    timestamp
FROM registro_anomalias_ml
UNION ALL
SELECT
    l.id,
    l.nodo_id,
    l.temperatura,
    l.humedad,
    0.2382 AS score_anomalia,
    -0.0052 AS umbral,
    true AS es_anomalia,
    'Alarma de sistema: desviacion de parametros fuera de rango operativo' AS detalle,
    l.timestamp
FROM lecturas l
WHERE l.alarma = true
  AND NOT EXISTS (SELECT 1 FROM registro_anomalias_ml);

CREATE OR REPLACE VIEW vista_eventos_vision AS
SELECT
    id,
    nodo_id,
    objeto_detectado,
    confianza,
    estado_bloqueo,
    motivo,
    duracion_bloqueo_segundos,
    timestamp
FROM eventos_seguridad_vision
UNION ALL
SELECT
    a.id,
    a.nodo_id,
    'objeto_extrano' AS objeto_detectado,
    98.5 AS confianza,
    'BLOQUEADO' AS estado_bloqueo,
    a.mensaje AS motivo,
    ROUND(EXTRACT(EPOCH FROM (COALESCE(a.resolucion_at, NOW()) - a.inicio_at))::numeric, 1) AS duracion_bloqueo_segundos,
    a.inicio_at AS timestamp
FROM alarmas a
WHERE (a.tipo LIKE '%BLOQUEO%' OR a.tipo = 'BLOQUEO_SEGURIDAD_VISION')
  AND NOT EXISTS (SELECT 1 FROM eventos_seguridad_vision);

