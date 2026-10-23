# SmartEgg IoT — Bitácora de Desarrollo del Proyecto (Fase 3)

**Universidad de San Carlos de Guatemala**  
Facultad de Ingeniería — Escuela de Ciencias y Sistemas  
Arquitectura de Computadores y Ensambladores 2 — Segundo Semestre 2026  
Catedrático: Ing. Gabriel Alejandro Díaz  
Auxiliares: Josue Antonio Cux Barrientos, Marcos Geovani Josías Pérez Secay  
Grupo: **15**

---

## 1. Información General del Proyecto y Equipo

* **Nombre del Proyecto:** SmartEgg: Incubadora Inteligente IoT (Fase 3)
* **Fecha de Inicio:** 19 de septiembre de 2026
* **Fecha de Entrega:** 24 de octubre de 2026
* **Repositorio Oficial:** `https://github.com/Jsue46/AYC2_G15` (Rama: `develop` / `202302156`)

### Distribución de Tareas del Equipo (5 Integrantes):

| N.° | Integrante / Rol | Especialidad Asignada | Responsabilidades Clave |
| :---: | :--- | :--- | :--- |
| **1** | **Integrante 1** | **Hardware, Cámara y OpenCV** | Montaje físico de cámara en cabina, buzzer y LED de bloqueo; recolección de dataset fotográfico real (`huevo`, `objeto_extrano`, `vacio`); programación del clasificador OpenCV y publicación de órdenes de bloqueo por MQTT. |
| **2** | **Integrante 2** | **Machine Learning (Detección de Anomalías)** | Extracción y limpieza del histórico de sensores de Fase 2 en Jupyter Notebook; entrenamiento y evaluación de modelo *Isolation Forest* con scikit-learn (F1-score, matriz de confusión); empaquetado del microservicio ML para evaluación continua en vivo. |
| **3** | **Integrante 3** | **Despliegue en la Nube & DevOps (Azure / AWS)** | Aprovisionamiento de Máquina Virtual Ubuntu en Microsoft Azure con Docker Compose (Mosquitto, PostgreSQL 16, Backend Flask, ML Service, Grafana); configuración de reglas de firewall/NSG (puertos 1883, 9001, 3000, 3001, 5000); hosting estático en Azure Blob Storage. |
| **4** | **Integrante 4** | **Dashboard Interactivo en p5.js + Consumo Eléctrico** | Desarrollo del tablero interactivo en p5.js conectado mediante WebSockets al broker MQTT; renderizado 2D/3D de la cabina; lógica reactiva de bloqueo visual de interfaz ante incidentes; módulo de cálculo de potencia (Watts) y energía (kWh) con límites y temporizador. |
| **5** | **Integrante 5** *(Tú)* | **Grafana, Alertas, Pitch y Documentación** | Diseño y aprovisionamiento de tableros de Grafana 12 (tiempo real con 15 paneles e histórico con 10 paneles); configuración de reglas de alerta unificadas en Grafana Alerting; redacción del Manual Técnico y Manual de Usuario en Markdown; guion y diapositivas del Pitch de 5 minutos y coordinación de la demo en vivo. |

---

## 2. Cronología de Sprints y Registro de Actividades

### Sprint 1: Planificación, Dataset y Definición de Esquemas (Semanas 1 y 2)
* **Objetivo:** Definir la arquitectura distribuida, la jerarquía de tópicos MQTT y estructurar los datasets.
* **Actividades Realizadas:**
  - Reunión inicial de alineación para la lectura detallada del enunciado y rúbrica de calificación (-100% por uso de APIs REST para control).
  - Integrante 1 montó la cámara de inspección sobre la incubadora física y recolectó más de 300 fotografías de entrenamiento bajo distintas condiciones de iluminación para las tres clases: `huevo`, `objeto_extrano` y `vacio`.
  - Integrante 2 extrajo los históricos de temperatura y humedad de la base de datos de Fase 2, iniciando el preprocesamiento y análisis exploratorio en Jupyter Notebook.
  - Integrante 5 diseñó la jerarquía de tópicos MQTT respetando los existentes y sumando los 4 nuevos tópicos requeridos (`vision/estado`, `control/bloqueo`, `ml/anomalia`, `energia/consumo`).

---

### Sprint 2: Desarrollo de las Capas de Inteligencia (Semanas 3 y 4)
* **Objetivo:** Entrenar los modelos de visión y Machine Learning, e implementar la gestión energética.
* **Actividades Realizadas:**
  - **Módulo de Visión Computacional (OpenCV):**
    - Se programó `detector_vision.py` con extracción de características morfológicas (contornos, elipses, momentos de Hu) y colorimétricas (HSV, LAB).
    - Se implementó la lógica de interrupción: si el ciclo está activo y se detecta `objeto_extrano`, se publica de inmediato en `smartegg/SE-01/control/bloqueo` `{bloquear: true}`.
  - **Detección de Anomalías (Machine Learning):**
    - Integrante 2 entrenó el clasificador *Isolation Forest* en scikit-learn utilizando ventanas deslizantes de 30 muestras temporales. Se calibró el umbral óptimo en `-0.0052`.
    - Se estructuró el microservicio autónomo `ml_service.py` que corre en un contenedor Docker y escucha la telemetría en streaming.
  - **Gestor de Consumo Energético:**
    - Se implementó `energy_service.py` en el backend, calculando la potencia activa instantánea sumando las cargas nominales de foco (60W), extractor (5W), motor (2.5W) y electrónica base (3W).
    - Se habilitó la persistencia automática de las tablas `mediciones_energia`, `registro_anomalias_ml` y `eventos_seguridad_vision`.

---

### Sprint 3: Migración a la Nube y Observabilidad (Semana 5)
* **Objetivo:** Desplegar el stack contenerizado en Azure y configurar la observabilidad en Grafana y p5.js.
* **Actividades Realizadas:**
  - **Infraestructura Cloud:**
    - Integrante 3 aprovisionó una máquina virtual Linux (Ubuntu 22.04 LTS) en Microsoft Azure bajo la región `northcentralus` con tamaño `Standard_B2as_v2`.
    - Se configuraron los Security Groups para permitir tráfico en puertos: `22` (SSH), `1883` (MQTT TCP), `9001` (MQTT WS), `3000` (Grafana), `3001` (Portal Web) y `5000` (Backend REST de consulta).
  - **Dashboards en Grafana (Integrante 5):**
    - Se construyó una imagen personalizada de Grafana 12 con el plugin oficial `grafana-mqtt-datasource 1.1.0`.
    - Se diseñó el dashboard en streaming MQTT con 15 paneles interactivos: telemetría ambiental, actuadores, rotación de bandeja, clasificación visual OpenCV, semáforo de anomalías ML y diales de potencia (Watts) y energía (kWh).
    - Se diseñó el dashboard analítico sobre PostgreSQL con 10 paneles para series históricas, balances diarios y tablas forenses de auditoría.
    - Se aprovisionaron como código las reglas de alerta en `alert_rules.yaml` (`mode: dropNN`) para alertar sobre bloqueos visuales, anomalías ML y sobreconsumo eléctrico (>80W).
  - **Dashboard en p5.js:**
    - Integrante 4 finalizó el lienzo interactivo en p5.js con renderizado dinámico de la cabina, slider de ajuste de límite de potencia y bloqueo reactivo con overlay rojo de emergencia.

---

### Sprint 4: Integración End-to-End, Documentación y Preparación del Pitch (Semana 6)
* **Objetivo:** Resolver conflictos de integración, validar la demo en vivo y redactar la documentación formal.
* **Actividades Realizadas:**
  - Se ejecutaron pruebas integrales de comunicación ciberfísica: la señal serial del Arduino Mega viajó por el puente serial hacia el broker en Azure; el detector de visión detectó una tijera metálica y disparó la orden de bloqueo; en menos de 200 ms el buzzer físico sonó y el foco se apagó, mientras Grafana y p5.js reflejaron el bloqueo en tiempo real.
  - Se sincronizaron las ramas de trabajo en Git (`develop` y `202302156`), resolviendo los conflictos de fusión y asegurando un repositorio limpio y organizado.
  - Integrante 5 redactó de forma exhaustiva el **Manual Técnico** ([`ManualTecnico.md`](ManualTecnico.md)) y el **Manual de Usuario** ([`ManualUsuario.md`](ManualUsuario.md)), actualizando el [`README.md`](../README.md).
  - Se redactó el guion formal y cronometrado del **Pitch de 5 minutos** ([`Pitch_Presentacion_5min.md`](Pitch_Presentacion_5min.md)) con simulación de venta ante un fondo de innovación, checklist de demo en vivo y banco de preguntas técnicas para la evaluación presencial.

---

## 3. Matriz de Retos Técnicos y Soluciones Implementadas

| Desafío / Incidente Encontrado | Causa Raíz | Solución Técnica Implementada |
| :--- | :--- | :--- |
| **Penalización del -100% por control vía API REST** | Las arquitecturas web convencionales usan REST para controlar actuadores, lo cual está prohibido por la rúbrica. | Se desacopló el control físico: toda orden de parada, bloqueo, apertura de puerta y energización opera exclusivamente por MQTT con QoS 1. Los endpoints REST quedaron reservados únicamente a consultas de lectura (`GET`) y reportes PDF. |
| **Compatibilidad de Grafana 12 con Datasource MQTT** | Las versiones modernas de Grafana bloquean datasources comunitarios sin firmar. | Se construyó una imagen Docker propia con `GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS=grafana-mqtt-datasource` y se fijó la versión estable 1.1.0 del plugin. |
| **Sintaxis de Grafana Alerting en Grafana 12** | La propiedad de evaluación `mode: strict` generaba fallos de parsing en Grafana 12. | Se actualizó la regla de alerta a `mode: dropNN`, garantizando que la evaluación se ejecute sin interrupciones sobre PostgreSQL. |
| **Restricciones de suscripción en Azure** | La suscripción estudiantil de Azure bloqueaba despliegues en ciertas regiones tradicionales. | Se ajustó el script de infraestructura (`desplegar_azure.ps1`) para usar la región `northcentralus` con el tipo de máquina virtual `Standard_B2as_v2`. |
| **Falsos positivos de anomalías en el encendido de la incubadora** | Al encender el equipo, la cabina se encuentra a temperatura ambiente (<30°C), fuera del régimen normal (37.5°C). | Se documentó como un comportamiento normal esperado de "arranque en frío" y se afinó la ventana deslizante del modelo para estabilizar el score tras alcanzar 35°C. |

---

## 4. Estado Final del Proyecto y Checklist de Entrega

- [x] **Modelo de Machine Learning:** Entrenado, evaluado con F1-score y matriz de confusión, e integrado en tiempo real al backend y Grafana.
- [x] **Módulo de Visión Computacional:** Operativo con OpenCV clasificando `huevo`, `objeto_extrano` y `vacio`, y ordenando bloqueo en $<200\text{ ms}$.
- [x] **Hardware y Maqueta Física:** Prototipo funcionando con Arduino Mega, DHT11, servomotor $\pm45^\circ$, relés, buzzer en Pin 8, LED en Pin 13 y LCD 16x2.
- [x] **Infraestructura Cloud:** VM en la nube con Docker Compose (Mosquitto, PostgreSQL 16, Backend, ML, Grafana) y firewall configurado.
- [x] **Dashboards:** Tableros en Grafana Cloud (tiempo real e histórico) y dashboard interactivo en p5.js por WebSockets.
- [x] **Reglas de Alerta:** Aprovisionadas y funcionales en Grafana Alerting con disparo ante incidentes.
- [x] **Control Exclusivo MQTT:** Cumplimiento total de cero APIs REST para control.
- [x] **Documentación Entregable:**
  - [x] [Manual Técnico Completo](ManualTecnico.md)
  - [x] [Manual de Usuario Completo](ManualUsuario.md)
  - [x] [Guion y Diapositivas del Pitch de 5 Minutos](Pitch_Presentacion_5min.md)
  - [x] [Bitácora de Desarrollo de Fase 3](BitacoraDesarrollo.md)
  - [x] [Scripts SQL de Calificación Presencial](../infra/sql/grafana_queries_fase3.sql)
  - [x] [Contrato OpenAPI 3.0](openapi.yaml)

