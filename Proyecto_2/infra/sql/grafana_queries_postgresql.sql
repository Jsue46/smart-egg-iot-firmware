-- SmartEgg - queries para Grafana (PostgreSQL)
--
-- Contrato esperado por Rol 4. Rol 2 debe conservar estos nombres o avisar
-- antes de cambiar el modelo:
--   lecturas(id, nodo_id, lote_id, temperatura, humedad, espacios_libres, foco,
--            ventilador, rotacion_grados, timestamp)
--   lotes(id, nodo_id, codigo, etiqueta, cantidad, fecha_ingreso)
--   alarmas(id, nodo_id, lote_id, tipo, severidad, mensaje, inicio_at,
--           resolucion_at)
--   accesos_puerta(id, nodo_id, operador_id, accion, cantidad_huevos, timestamp)
--
-- Las expresiones ${...} y $__... son variables/macros de Grafana, no se
-- deben ejecutar directamente en psql sin reemplazarlas.

-- Q1 - Tendencia de temperatura y humedad.
SELECT
    r."timestamp" AS "time",
    r.temperatura AS "Temperatura (°C)",
    r.humedad AS "Humedad (%)"
FROM lecturas AS r
WHERE $__timeFilter(r."timestamp")
  AND r.nodo_id = '${node_id}'
ORDER BY r."timestamp";

-- Q2 - Ocupacion de la bandeja.
SELECT
    r."timestamp" AS "time",
    GREATEST(0, 3 - r.espacios_libres) AS "Huevos ocupados",
    r.espacios_libres AS "Espacios libres"
FROM lecturas AS r
WHERE $__timeFilter(r."timestamp")
  AND r.nodo_id = '${node_id}'
ORDER BY r."timestamp";

-- Q3 - Minimo, maximo y promedio por lote.
SELECT
    COALESCE(l.codigo, 'SIN_LOTE') AS "Lote",
    ROUND(MIN(r.temperatura)::numeric, 2) AS "Minimo (°C)",
    ROUND(MAX(r.temperatura)::numeric, 2) AS "Maximo (°C)",
    ROUND(AVG(r.temperatura)::numeric, 2) AS "Promedio (°C)",
    ROUND(MIN(r.humedad)::numeric, 2) AS "Humedad minima (%)",
    ROUND(MAX(r.humedad)::numeric, 2) AS "Humedad maxima (%)",
    ROUND(AVG(r.humedad)::numeric, 2) AS "Humedad promedio (%)"
FROM lecturas AS r
LEFT JOIN lotes AS l ON l.id = r.lote_id
WHERE r.nodo_id = '${node_id}'
  AND $__timeFilter(r."timestamp")
GROUP BY COALESCE(l.codigo, 'SIN_LOTE')
ORDER BY "Lote";

-- Q4 - Duracion de alarmas criticas en minutos.
-- Las alarmas abiertas se calculan hasta el momento actual.
SELECT
    a.tipo AS "Tipo",
    a.severidad AS "Severidad",
    a.mensaje AS "Mensaje",
    a.inicio_at AS "Inicio",
    a.resolucion_at AS "Resolucion",
    ROUND(
        EXTRACT(
            EPOCH FROM (COALESCE(a.resolucion_at, NOW()) - a.inicio_at)
        ) / 60.0,
        2
    ) AS "Duracion (min)"
FROM alarmas AS a
WHERE a.nodo_id = '${node_id}'
  AND a.inicio_at <= $__timeTo()
  AND COALESCE(a.resolucion_at, NOW()) >= $__timeFrom()
ORDER BY a.inicio_at DESC;

-- Q5 - Cantidad de aperturas y cierres de puerta.
SELECT
    COUNT(*) FILTER (WHERE ap.accion = 'ABRIR') AS "Aperturas",
    COUNT(*) FILTER (WHERE ap.accion = 'CERRAR') AS "Cierres"
FROM accesos_puerta AS ap
WHERE ap.nodo_id = '${node_id}'
  AND $__timeFilter(ap."timestamp");

-- Q6 - Eventos de puerta por dia para un panel de serie temporal.
SELECT
    date_trunc('day', ap."timestamp") AS "time",
    COUNT(*) FILTER (WHERE ap.accion = 'ABRIR') AS "Aperturas",
    COUNT(*) FILTER (WHERE ap.accion = 'CERRAR') AS "Cierres"
FROM accesos_puerta AS ap
WHERE ap.nodo_id = '${node_id}'
  AND $__timeFilter(ap."timestamp")
GROUP BY date_trunc('day', ap."timestamp")
ORDER BY "time";

-- Q7 - Consumo energetico diario acumulado (Fase 3).
SELECT
    date_trunc('day', me.timestamp) AS "time",
    ROUND(SUM(me.consumo_kwh)::numeric, 4) AS "Energía consumida (kWh)"
FROM vista_mediciones_energia AS me
WHERE $__timeFilter(me.timestamp)
  AND me.nodo_id = '${node_id}'
GROUP BY 1
ORDER BY 1;

-- Q8 - Potencia promedio horaria (Watts) (Fase 3).
SELECT
    date_trunc('hour', me.timestamp) AS "time",
    ROUND(AVG(me.potencia_watts)::numeric, 2) AS "Potencia Promedio (W)"
FROM vista_mediciones_energia AS me
WHERE $__timeFilter(me.timestamp)
  AND me.nodo_id = '${node_id}'
GROUP BY 1
ORDER BY 1;

-- Q9 - Historico de anomalias detectadas por Machine Learning (Fase 3).
SELECT
    timestamp AS "time",
    temperatura AS "Temp (°C)",
    humedad AS "Humedad (%)",
    ROUND(score_anomalia::numeric, 4) AS "Score ML",
    detalle AS "Diagnóstico"
FROM vista_registro_anomalias_ml
WHERE es_anomalia = true
  AND nodo_id = '${node_id}'
  AND $__timeFilter(timestamp)
ORDER BY timestamp DESC
LIMIT 50;

-- Q10 - Auditoria de eventos de bloqueo por Vision Computacional (Fase 3).
SELECT
    timestamp AS "time",
    nodo_id AS "Nodo",
    objeto_detectado AS "Clase Detectada",
    ROUND(confianza::numeric, 1) AS "Confianza (%)",
    estado_bloqueo AS "Estado",
    motivo AS "Motivo",
    ROUND(duracion_bloqueo_segundos::numeric, 1) AS "Duración Bloqueo (s)"
FROM vista_eventos_vision
WHERE nodo_id = '${node_id}'
  AND $__timeFilter(timestamp)
ORDER BY timestamp DESC
LIMIT 50;

