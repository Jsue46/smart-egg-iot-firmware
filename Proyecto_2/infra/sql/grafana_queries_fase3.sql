-- ============================================================================
-- SmartEgg Fase 3 - Consultas SQL para Grafana (PostgreSQL)
-- Autor: Integrante 5 (Dashboards, Alertas y Documentacion)
--
-- Modelos consultados:
--   - mediciones_energia (id, nodo_id, lote_id, potencia_watts, consumo_kwh, ...)
--   - registro_anomalias_ml (id, nodo_id, temperatura, humedad, score_anomalia, ...)
--   - eventos_seguridad_vision (id, nodo_id, objeto_detectado, confianza, estado_bloqueo, ...)
--   - vista_mediciones_energia (vista unificada con fallback a lecturas)
--   - vista_registro_anomalias_ml (vista unificada con fallback a alarmas/lecturas)
--   - vista_eventos_vision (vista unificada con fallback a alarmas)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1.1 Energia Acumulada (kWh) por Dia
-- Visualizacion recomendada: Time Series con Draw style = "Bars"
-- ----------------------------------------------------------------------------
SELECT
  date_trunc('day', me.timestamp) AS "time",
  ROUND(SUM(me.consumo_kwh)::numeric, 4) AS "Energía consumida (kWh)"
FROM vista_mediciones_energia AS me
WHERE $__timeFilter(me.timestamp)
  AND me.nodo_id = '${node_id}'
GROUP BY 1
ORDER BY 1;

-- ----------------------------------------------------------------------------
-- 1.2 Potencia Promedio por Hora (W) y Consumo Horario
-- Visualizacion recomendada: Time Series con Linea suave
-- Justificacion de consumo calculada:
--   - Foco incandescente: 60W (calefaccion ON)
--   - Ventilador DC 12V: 5W (refrigeracion forzada ON)
--   - Servomotor MG996R: 2.5W en movimiento / 0.5W reposo
--   - Electronica base (ESP32/Mega + sensores + reles): 3W permanente
--   - Rango nominal normal: 3W a 70.5W. >80W se considera sobreconsumo anomalo.
-- ----------------------------------------------------------------------------
SELECT
  date_trunc('hour', me.timestamp) AS "time",
  ROUND(AVG(me.potencia_watts)::numeric, 2) AS "Potencia Promedio (W)",
  ROUND(SUM(me.consumo_kwh)::numeric, 4) AS "Consumo (kWh/h)"
FROM vista_mediciones_energia AS me
WHERE $__timeFilter(me.timestamp)
  AND me.nodo_id = '${node_id}'
GROUP BY 1
ORDER BY 1;

-- ----------------------------------------------------------------------------
-- 1.3 Historico de Incidentes y Anomalias Detectadas por ML
-- Visualizacion recomendada: Table o State Timeline
-- Registra eventos donde el modelo Isolation Forest supero el umbral (-0.0052)
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- 1.4 Bitacora de Eventos de Bloqueo por Vision Computacional
-- Visualizacion recomendada: Table (Auditoria de Seguridad)
-- Registra detecciones de objeto extrano y protocolo de bloqueo
-- ----------------------------------------------------------------------------
SELECT
  timestamp AS "time",
  nodo_id AS "Nodo",
  objeto_detectado AS "Clase Detectada",
  ROUND(confianza::numeric, 1) AS "Nivel de Confianza (%)",
  estado_bloqueo AS "Estado del Sistema",
  motivo AS "Motivo",
  ROUND(duracion_bloqueo_segundos::numeric, 1) AS "Duración Bloqueo (s)"
FROM vista_eventos_vision
WHERE nodo_id = '${node_id}'
  AND $__timeFilter(timestamp)
ORDER BY timestamp DESC
LIMIT 50;

-- ----------------------------------------------------------------------------
-- 1.5 Consultas para Reglas de Alerta Activas (Grafana Alerting)
-- ----------------------------------------------------------------------------

-- Alerta 1: Disparo inmediato por Bloqueo Critico de Vision
SELECT COUNT(*) AS count
FROM alarmas
WHERE nodo_id = 'SE-01'
  AND activa = true
  AND (tipo LIKE '%BLOQUEO%' OR tipo = 'BLOQUEO_SEGURIDAD_VISION');

-- Alerta 2: Deteccion de Anomalia Predictiva ML
SELECT COUNT(*) AS count
FROM registro_anomalias_ml
WHERE nodo_id = 'SE-01'
  AND es_anomalia = true
  AND timestamp > NOW() - INTERVAL '1 minute';

-- Alerta 3: Sobreconsumo Electrico Anomalo (>80W)
SELECT COALESCE(
  (SELECT potencia_watts FROM vista_mediciones_energia WHERE nodo_id = 'SE-01' ORDER BY timestamp DESC LIMIT 1),
  0.0
) AS potencia;

