import json
import copy

# ==============================================================================
# 1. ACTUALIZAR DASHBOARD HISTORICO
# ==============================================================================
with open('Proyecto_2/infra/grafana/dashboards/smartegg-historico.json', 'r', encoding='utf-8') as f:
    d_hist = json.load(f)

panels_hist = [p for p in d_hist.get('panels', []) if p['id'] <= 6]

p7 = {
  'datasource': {'type': 'postgres', 'uid': 'smartegg-postgres'},
  'description': 'Consumo energetico diario en kWh integrado por dia en el rango de tiempo seleccionado.',
  'fieldConfig': {
    'defaults': {
      'color': {'fixedColor': '#38bdf8', 'mode': 'fixed'},
      'custom': {
        'axisBorderShow': True,
        'axisCenteredZero': False,
        'axisColorMode': 'text',
        'axisLabel': 'kWh',
        'axisPlacement': 'auto',
        'barAlignment': 0,
        'barWidthFactor': 0.6,
        'drawStyle': 'bars',
        'fillOpacity': 80,
        'gradientMode': 'none',
        'hideFrom': {'legend': False, 'tooltip': False, 'viz': False},
        'insertNulls': False,
        'lineInterpolation': 'linear',
        'lineWidth': 1,
        'pointSize': 5,
        'scaleDistribution': {'type': 'linear'},
        'showPoints': 'never',
        'spanNulls': False,
        'stacking': {'group': 'A', 'mode': 'none'},
        'thresholdsStyle': {'mode': 'off'}
      },
      'decimals': 3,
      'mappings': [],
      'thresholds': {'mode': 'absolute', 'steps': [{'color': 'green'}]},
      'unit': 'kwh'
    },
    'overrides': []
  },
  'gridPos': {'h': 8, 'w': 12, 'x': 0, 'y': 30},
  'id': 7,
  'options': {
    'legend': {'calcs': ['lastNotNull', 'max', 'sum'], 'displayMode': 'list', 'placement': 'bottom', 'showLegend': True},
    'tooltip': {'hideZeros': False, 'mode': 'multi', 'sort': 'desc'}
  },
  'pluginVersion': '12.0.0',
  'targets': [
    {
      'datasource': {'type': 'postgres', 'uid': 'smartegg-postgres'},
      'format': 'time_series',
      'rawQuery': True,
      'rawSql': 'SELECT date_trunc(\'day\', me.timestamp) AS "time", ROUND(SUM(me.consumo_kwh)::numeric, 4) AS "Energia consumida (kWh)" FROM vista_mediciones_energia AS me WHERE $__timeFilter(me.timestamp) AND me.nodo_id = \'${node_id}\' GROUP BY 1 ORDER BY 1;',
      'refId': 'A'
    }
  ],
  'title': 'Consumo Energético Histórico Acumulado (kWh por Día)',
  'type': 'timeseries'
}

p8 = {
  'datasource': {'type': 'postgres', 'uid': 'smartegg-postgres'},
  'description': 'Potencia promedio consumida por hora (W) segun activacion de foco, ventilador y perifericos.',
  'fieldConfig': {
    'defaults': {
      'color': {'fixedColor': '#f59e0b', 'mode': 'fixed'},
      'custom': {
        'axisBorderShow': True,
        'axisCenteredZero': False,
        'axisColorMode': 'text',
        'axisLabel': 'Watts',
        'axisPlacement': 'auto',
        'drawStyle': 'line',
        'fillOpacity': 15,
        'gradientMode': 'opacity',
        'hideFrom': {'legend': False, 'tooltip': False, 'viz': False},
        'insertNulls': False,
        'lineInterpolation': 'smooth',
        'lineWidth': 2,
        'pointSize': 5,
        'scaleDistribution': {'type': 'linear'},
        'showPoints': 'never',
        'spanNulls': False,
        'stacking': {'group': 'A', 'mode': 'none'},
        'thresholdsStyle': {'mode': 'line'}
      },
      'decimals': 1,
      'mappings': [],
      'thresholds': {
        'mode': 'absolute',
        'steps': [
          {'color': 'green'},
          {'color': 'yellow', 'value': 50},
          {'color': 'red', 'value': 80}
        ]
      },
      'unit': 'watt'
    },
    'overrides': []
  },
  'gridPos': {'h': 8, 'w': 12, 'x': 12, 'y': 30},
  'id': 8,
  'options': {
    'legend': {'calcs': ['lastNotNull', 'max', 'mean'], 'displayMode': 'list', 'placement': 'bottom', 'showLegend': True},
    'tooltip': {'hideZeros': False, 'mode': 'multi', 'sort': 'desc'}
  },
  'pluginVersion': '12.0.0',
  'targets': [
    {
      'datasource': {'type': 'postgres', 'uid': 'smartegg-postgres'},
      'format': 'time_series',
      'rawQuery': True,
      'rawSql': 'SELECT date_trunc(\'hour\', me.timestamp) AS "time", ROUND(AVG(me.potencia_watts)::numeric, 2) AS "Potencia Promedio (W)" FROM vista_mediciones_energia AS me WHERE $__timeFilter(me.timestamp) AND me.nodo_id = \'${node_id}\' GROUP BY 1 ORDER BY 1;',
      'refId': 'A'
    }
  ],
  'title': 'Potencia Promedio Horaria (Watts)',
  'type': 'timeseries'
}

p9 = {
  'datasource': {'type': 'postgres', 'uid': 'smartegg-postgres'},
  'description': 'Registro cronologico de anomalias detectadas por el modelo Isolation Forest.',
  'fieldConfig': {
    'defaults': {
      'custom': {
        'align': 'auto',
        'cellOptions': {'type': 'auto'},
        'filterable': True,
        'inspect': True
      },
      'mappings': [],
      'thresholds': {'mode': 'absolute', 'steps': [{'color': 'green'}]}
    },
    'overrides': [
      {
        'matcher': {'id': 'byName', 'options': 'Score ML'},
        'properties': [
          {'id': 'custom.cellOptions', 'value': {'type': 'color-text'}},
          {
            'id': 'thresholds',
            'value': {
              'mode': 'absolute',
              'steps': [{'color': '#73BF69'}, {'color': '#FF780A', 'value': -0.0052}, {'color': '#F2495C', 'value': 0.15}]
            }
          }
        ]
      }
    ]
  },
  'gridPos': {'h': 8, 'w': 12, 'x': 0, 'y': 38},
  'id': 9,
  'options': {
    'cellHeight': 'sm',
    'footer': {'countRows': False, 'enablePagination': True, 'fields': '', 'reducer': ['sum'], 'show': True},
    'showHeader': True,
    'sortBy': [{'desc': True, 'displayName': 'time'}]
  },
  'pluginVersion': '12.0.0',
  'targets': [
    {
      'datasource': {'type': 'postgres', 'uid': 'smartegg-postgres'},
      'format': 'table',
      'rawQuery': True,
      'rawSql': 'SELECT timestamp AS "time", temperatura AS "Temp (°C)", humedad AS "Humedad (%)", ROUND(score_anomalia::numeric, 4) AS "Score ML", detalle AS "Diagnostico" FROM vista_registro_anomalias_ml WHERE es_anomalia = true AND nodo_id = \'${node_id}\' AND $__timeFilter(timestamp) ORDER BY timestamp DESC LIMIT 50;',
      'refId': 'A'
    }
  ],
  'title': 'Histórico de Incidentes y Detección de Anomalías (ML)',
  'type': 'table'
}

p10 = {
  'datasource': {'type': 'postgres', 'uid': 'smartegg-postgres'},
  'description': 'Auditoria de eventos de seguridad y protocolo de bloqueo activados por OpenCV.',
  'fieldConfig': {
    'defaults': {
      'custom': {
        'align': 'auto',
        'cellOptions': {'type': 'auto'},
        'filterable': True,
        'inspect': True
      },
      'mappings': [],
      'thresholds': {'mode': 'absolute', 'steps': [{'color': 'green'}]}
    },
    'overrides': [
      {
        'matcher': {'id': 'byName', 'options': 'Estado'},
        'properties': [
          {'id': 'custom.cellOptions', 'value': {'type': 'color-text'}},
          {
            'id': 'mappings',
            'value': [
              {
                'options': {
                  'BLOQUEADO': {'color': '#F2495C', 'index': 0, 'text': 'BLOQUEADO'},
                  'NORMAL': {'color': '#73BF69', 'index': 1, 'text': 'NORMAL'}
                },
                'type': 'value'
              }
            ]
          }
        ]
      }
    ]
  },
  'gridPos': {'h': 8, 'w': 12, 'x': 12, 'y': 38},
  'id': 10,
  'options': {
    'cellHeight': 'sm',
    'footer': {'countRows': False, 'enablePagination': True, 'fields': '', 'reducer': ['sum'], 'show': True},
    'showHeader': True,
    'sortBy': [{'desc': True, 'displayName': 'time'}]
  },
  'pluginVersion': '12.0.0',
  'targets': [
    {
      'datasource': {'type': 'postgres', 'uid': 'smartegg-postgres'},
      'format': 'table',
      'rawQuery': True,
      'rawSql': 'SELECT timestamp AS "time", nodo_id AS "Nodo", objeto_detectado AS "Clase Detectada", ROUND(confianza::numeric, 1) AS "Confianza (%)", estado_bloqueo AS "Estado", motivo AS "Motivo", ROUND(duracion_bloqueo_segundos::numeric, 1) AS "Duracion Bloqueo (s)" FROM vista_eventos_vision WHERE nodo_id = \'${node_id}\' AND $__timeFilter(timestamp) ORDER BY timestamp DESC LIMIT 50;',
      'refId': 'A'
    }
  ],
  'title': 'Bitácora de Eventos de Bloqueo por Visión Computacional',
  'type': 'table'
}

all_panels_hist = panels_hist + [p7, p8, p9, p10]
d_hist['panels'] = all_panels_hist
d_hist['version'] = d_hist.get('version', 1) + 1

with open('Proyecto_2/infra/grafana/dashboards/smartegg-historico.json', 'w', encoding='utf-8') as f:
    json.dump(d_hist, f, indent=2, ensure_ascii=False)

f3_hist = copy.deepcopy(d_hist)
f3_hist['uid'] = 'smartegg-historico-fase3'
f3_hist['title'] = 'SmartEgg - Analítica histórica (Fase 3)'
with open('Proyecto_2/infra/grafana/dashboards/dashboard_historico_fase3.json', 'w', encoding='utf-8') as f:
    json.dump(f3_hist, f, indent=2, ensure_ascii=False)

print('Updated smartegg-historico.json and dashboard_historico_fase3.json successfully.')

