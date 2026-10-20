-- SmartEgg Fase 3 - Datos de prueba (Seed Data) para Grafana
-- Permite visualizar y validar de inmediato los paneles historicos de Fase 3
-- Ejecutar en PostgreSQL: psql -U smartegg -d smartegg -f seed_datos_fase3.sql

-- 1. Insertar mediciones de energia de las ultimas 48 horas (ciclos de calefaccion y ventilacion)
INSERT INTO mediciones_energia (nodo_id, potencia_watts, consumo_kwh, voltaje, corriente, foco_watts, ventilador_watts, motor_watts, timestamp)
SELECT
    'SE-01',
    (CASE 
        WHEN (EXTRACT(MINUTE FROM t)::int % 15) < 7 THEN 63.0  -- Foco ON + electronica (60W + 3W)
        WHEN (EXTRACT(MINUTE FROM t)::int % 15) = 7 THEN 68.0  -- Foco ON + Ventilador ON (60W + 5W + 3W)
        WHEN (EXTRACT(MINUTE FROM t)::int % 15) = 8 THEN 8.0   -- Solo Ventilador ON (5W + 3W)
        ELSE 3.0                                               -- Standby / reposo (3W)
    END) AS potencia_watts,
    ROUND((((CASE 
        WHEN (EXTRACT(MINUTE FROM t)::int % 15) < 7 THEN 63.0
        WHEN (EXTRACT(MINUTE FROM t)::int % 15) = 7 THEN 68.0
        WHEN (EXTRACT(MINUTE FROM t)::int % 15) = 8 THEN 8.0
        ELSE 3.0
    END) * 30.0 / 3600.0) / 1000.0)::numeric, 5) AS consumo_kwh,
    120.0,
    ROUND(((CASE 
        WHEN (EXTRACT(MINUTE FROM t)::int % 15) < 7 THEN 63.0
        ELSE 3.0
    END) / 120.0)::numeric, 3) AS corriente,
    (CASE WHEN (EXTRACT(MINUTE FROM t)::int % 15) <= 7 THEN 60.0 ELSE 0.0 END) AS foco_watts,
    (CASE WHEN (EXTRACT(MINUTE FROM t)::int % 15) IN (7, 8) THEN 5.0 ELSE 0.0 END) AS ventilador_watts,
    (CASE WHEN (EXTRACT(MINUTE FROM t)::int % 60) = 0 THEN 2.5 ELSE 0.0 END) AS motor_watts,
    t AS timestamp
FROM generate_series(NOW() - INTERVAL '48 hour', NOW(), INTERVAL '30 second') AS t
ON CONFLICT DO NOTHING;

-- 2. Insertar registros historicos de anomalias detectadas por Machine Learning (Isolation Forest)
INSERT INTO registro_anomalias_ml (nodo_id, temperatura, humedad, score_anomalia, umbral, es_anomalia, detalle, timestamp)
VALUES
    ('SE-01', 24.8, 52.0, 0.3120, -0.0052, true, 'Arranque en frío: temperatura ambiente por debajo de umbral de incubación (37.5°C)', NOW() - INTERVAL '36 hour'),
    ('SE-01', 25.4, 53.0, 0.2840, -0.0052, true, 'Arranque en frío: gradiente térmico ascendente lento', NOW() - INTERVAL '35 hour 55 minute'),
    ('SE-01', 38.8, 48.0, 0.2450, -0.0052, true, 'Calentamiento brusco y caída de humedad: posible sensor cercano a foco', NOW() - INTERVAL '22 hour 10 minute'),
    ('SE-01', 39.1, 46.5, 0.2980, -0.0052, true, 'Pico de temperatura anómalo sostenido (>38.5°C)', NOW() - INTERVAL '22 hour 8 minute'),
    ('SE-01', 37.4, 71.0, 0.1850, -0.0052, true, 'Humedad fuera de rango óptimo (>65%) con temperatura nominal', NOW() - INTERVAL '10 hour 15 minute'),
    ('SE-01', 38.6, 54.0, 0.2150, -0.0052, true, 'Desviación térmica durante ciclo activo de incubación', NOW() - INTERVAL '2 hour 30 minute')
ON CONFLICT DO NOTHING;

-- 3. Insertar eventos de seguridad y bloqueo por Vision Computacional (OpenCV)
INSERT INTO eventos_seguridad_vision (nodo_id, objeto_detectado, confianza, estado_bloqueo, motivo, duracion_bloqueo_segundos, timestamp)
VALUES
    ('SE-01', 'objeto_extrano', 98.4, 'BLOQUEADO', 'Intrusión no autorizada: tijera metálica detectada en bandeja', 45.0, NOW() - INTERVAL '28 hour'),
    ('SE-01', 'objeto_extrano', 96.2, 'BLOQUEADO', 'Elemento extraño: llavero sobre rejilla de rotación', 32.5, NOW() - INTERVAL '14 hour 20 minute'),
    ('SE-01', 'objeto_extrano', 99.1, 'BLOQUEADO', 'Objeto de prueba colocado al inicio del ciclo de incubación', 20.0, NOW() - INTERVAL '1 hour 10 minute')
ON CONFLICT DO NOTHING;

-- 4. Registrar alarma critica correspondiente en la tabla de alarmas
INSERT INTO alarmas (nodo_id, tipo, severidad, mensaje, descripcion, activa, inicio_at, resolucion_at, timestamp)
VALUES
    ('SE-01', 'BLOQUEO_SEGURIDAD_VISION', 'critical', 'SISTEMA BLOQUEADO: Objeto no autorizado detectado en incubadora', 'Disparo de seguridad OpenCV al inicio de ciclo', false, NOW() - INTERVAL '28 hour', NOW() - INTERVAL '28 hour' + INTERVAL '45 second', NOW() - INTERVAL '28 hour'),
    ('SE-01', 'BLOQUEO_SEGURIDAD_VISION', 'critical', 'SISTEMA BLOQUEADO: Objeto no autorizado detectado en incubadora', 'Disparo de seguridad OpenCV al inicio de ciclo', false, NOW() - INTERVAL '14 hour 20 minute', NOW() - INTERVAL '14 hour 20 minute' + INTERVAL '33 second', NOW() - INTERVAL '14 hour 20 minute'),
    ('SE-01', 'BLOQUEO_SEGURIDAD_VISION', 'critical', 'SISTEMA BLOQUEADO: Objeto no autorizado detectado en incubadora', 'Disparo de seguridad OpenCV al inicio de ciclo', false, NOW() - INTERVAL '1 hour 10 minute', NOW() - INTERVAL '1 hour 10 minute' + INTERVAL '20 second', NOW() - INTERVAL '1 hour 10 minute')
ON CONFLICT DO NOTHING;

