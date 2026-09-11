# SmartEgg IoT — Documentación Técnica del Proyecto 1

## 1. Descripción de la Solución y Continuidad respecto a la Práctica 1

### 1.1 Contexto y Evolución del Sistema
En la **Práctica 1**, el sistema *SmartEgg* se concibió como un prototipo funcional monolítico enfocado en la adquisición física y el control básico de una incubadora avícola automatizada. Dicha fase inicial integró la lectura de sensores de temperatura y humedad (DHT11), detección de presencia de huevos mediante finales de carrera, actuación térmica mediante relés (foco calefactor y ventilador extractor), el movimiento oscilatorio mecánico de una bandeja giratoria controlada por servomotor ($\pm45^\circ$) y una aplicación de escritorio/web respaldada por una base de datos local SQLite y una API REST desarrollada en Flask.

Para este **Proyecto 1**, la solución evoluciona desde un sistema aislado hacia una **arquitectura distribuida IoT de grado industrial**, desacoplada, observable y contenerizada. El objetivo principal de esta transición es mitigar la latencia en la propagación de eventos críticos, garantizar la persistencia relacional concurrente de los datos de telemetría y dotar al operador de mecanismos analíticos y visuales interactivos de alto rendimiento.

---

### 1.2 Arquitectura y Componentes de Continuidad

El proyecto mantiene la lógica de hardware y de negocio establecida en la práctica inicial, expandiendo sus capacidades a través de los siguientes ejes de continuidad:

* **Capa de Adquisición Física (Microcontrolador & Serial):**
  Se preserva la integración con el microcontrolador físico mediante comunicación serial UART. El backend continúa procesando las tramas JSON estructuradas enviadas desde el hardware, garantizando resiliencia operativa mediante un hilo daemon que reintenta la conexión automáticamente ante una desconexión física. El simulador queda desactivado por defecto y solo se habilita explícitamente para pruebas locales. Como ampliación del proyecto, se incorpora el registro físico de acceso a cabina mediante switch/sensor para el control de operadores.

* **Núcleo del Backend (Python & Flask):**
  La API REST conserva y estandariza los contratos de datos originales (`/datos`, `/historial`, `/huevos`, `/alarmas`, `/reporte`), ampliándose funcionalmente como un **nodo publicador MQTT**. Cada lectura serial capturada se procesa hacia la base de datos relacional y se despacha de forma asíncrona hacia los tópicos correspondientes del broker.

* **Transición de Persistencia (SQLite a Base de Datos Relacional Contenerizada):**
  El esquema inicial de almacenamiento migra hacia un motor relacional formal orquestado en Docker (PostgreSQL/MySQL), integrando un modelo entidad-relación normalizado que soporta el ciclo de vida de lotes, operadores designados (Operador 1, Operador 2, Administrador), bitácora de accesos de puerta y métricas históricas indexadas.

* **Capa de Transporte Híbrida (REST + MQTT sobre WebSockets):**
  A diferencia de la Práctica 1, donde toda la actualización dependía de sondeo periódico HTTP (*polling*), el Proyecto 1 desacopla las alertas críticas. Los eventos de alarma y cambios de estado se distribuyen mediante el protocolo MQTT bajo calidad de servicio (QoS 1), retención de mensajes y Last Will and Testament (LWT), permitiendo que las alertas se reflejen en la interfaz en menos de 3 segundos sin recargar el navegador.

* **Ecosistema de Frontend y Observabilidad (Next.js & Grafana):**
  La interfaz de usuario pasa a construirse sobre Next.js (React + TypeScript) con una estética editorial botánica adaptada a la identidad del proyecto. En este entorno convergen:
  1. Paneles analíticos construidos con **Chart.js** para el seguimiento continuo de tendencias térmicas y ocupación histórica.
  2. Un lienzo interactivo en 2D desarrollado con **p5.js** que renderiza digitalmente el habitáculo mecánico, el plato de soporte a $\pm45^\circ$, el flujo dinámico de vapor y las advertencias de cabina consumiendo la telemetría en vivo.
  3. Dashboards avanzados en **Grafana** conectados al broker MQTT y a la base de datos para la supervisión y auditoría de la infraestructura operativa.

## 2. Diagrama de arquitectura general
### 2.1 Diagrama de Arquitectura

![diagrama arquitectura](<imagenes/Diagrama de arquitectura genera.png>)

---

### 2.2 Descripción y Detalle de Conexiones

La arquitectura de **SmartEgg IoT** desacopla la adquisición de señales físicas, la persistencia transaccional, el despacho de telemetría asíncrona y la observabilidad distribuida. Cada enlace cumple una función técnica específica dentro del flujo de datos:

* **1. Componentes, Módulos, Sensores y Actuadores $\longleftrightarrow$ Microcontrolador (Capa Física / GPIO):**
  * **Protocolo / Interfaz:** Conexiones directas por entradas y salidas analógicas/digitales (GPIO) e interfaces de un solo hilo (One-Wire).
  * **Descripción:** Los transductores físicos (sensor DHT11 para temperatura y humedad, finales de carrera para conteo de huevos y sensor/switch de acceso de puerta) envían sus señales eléctricas al microcontrolador. En sentido inverso, el microcontrolador conmuta los actuadores de cabina (relés para foco calefactor y ventilador extractor) y envía el tren de pulsos PWM hacia el servomotor MG996R para el ciclo de inclinación de la bandeja a $\pm45^\circ$.

* **2. Microcontrolador $\longrightarrow$ Backend REST/API (`Serial Bus`):**
  * **Protocolo / Interfaz:** Comunicación Serial UART sobre puerto USB (9600 baudios).
  * **Descripción:** El microcontrolador serializa periódicamente las lecturas en una trama de texto JSON (`{"temperatura": 37.5, "humedad": 58.0, ...}`). El backend mantiene un hilo trabajador en segundo plano (*daemon thread*) que escucha continuamente el puerto serial con reconexión automática, deserializa el payload y lo pasa a las capas de persistencia y despacho.

* **3. Backend REST/API $\longleftrightarrow$ Base de Datos (`Query` / Persistencia):**
  * **Protocolo / Interfaz:** Conector SQL / TCP sobre red interna de contenedores.
  * **Descripción:** Conexión bidireccional transaccional. En sentido ascendente, el backend ejecuta sentencias `INSERT` para almacenar cada lectura de telemetría, registro de alarmas críticas y eventos de apertura/cierre de puerta. En sentido descendente, atiende peticiones analíticas y consultas históricas mediante sentencias `SELECT` indexadas (por ejemplo, para responder al endpoint `/historial` y nutrir el generador de reportes PDF).

* **4. Backend REST/API $\longleftrightarrow$ Frontend Web (`Request` / HTTP REST):**
  * **Protocolo / Interfaz:** HTTP/1.1 (JSON) sobre TCP/IP con soporte CORS.
  * **Descripción:** Comunicación cliente-servidor sincrónica bajo demanda. El frontend consume los contratos de datos expuestos por la API REST (`GET /datos`, `GET /historial`, `GET /huevos`, `POST /huevo`, `GET /reporte`). A través de este canal, la interfaz alimenta periódicamente las tarjetas analíticas de Chart.js y proporciona las lecturas de estado al lienzo interactivo de p5.js.

* **5. Backend REST/API $\longrightarrow$ MQTT Broker (`Publisher`):**
  * **Protocolo / Interfaz:** Protocolo MQTT 3.1.1 sobre TCP (puerto estándar 1883).
  * **Descripción:** El backend opera como un cliente publicador (*Publisher*). Cada vez que valida una nueva muestra del puerto serial o detecta condiciones de riesgo térmico/humedad, publica la información en tópicos jerárquicos estructurados (por ejemplo, `smartegg/{id}/sensores/temperatura` y `smartegg/{id}/alarmas/critica`). En las alertas críticas se configura QoS 1 y mensajes retenidos (*retained*), garantizando la entrega confiable y el estado Last Will and Testament (LWT) para supervisión de conectividad.

* **6. MQTT Broker $\longrightarrow$ Frontend Web (`WebSockets` / Tiempo Real):**
  * **Protocolo / Interfaz:** MQTT sobre WebSockets (`ws://` / `wss://` en el puerto 9001).
  * **Descripción:** El frontend actúa como suscriptor (*Subscriber*). Mantiene un socket abierto contra el broker mediante la librería `mqtt.js` escuchando tópicos críticos. Este canal push elimina la necesidad de sondeo HTTP (*polling*) constante, permitiendo desplegar alertas sonoras y visuales en la interfaz de operador en menos de 3 segundos ante contingencias ambientales o accesos no autorizados.

* **7. MQTT Broker $\longrightarrow$ Grafana (`Subscribe` / Telemetría en Vivo):**
  * **Protocolo / Interfaz:** Data Source MQTT / WebSockets.
  * **Descripción:** Grafana se suscribe de manera directa a los tópicos de telemetría instantánea y status LWT del broker. Esto permite actualizar en tiempo real paneles de instrumentos visuales (medidores tipo *Gauge*, gráficos de serie temporal instantáneos y estados de salud del nodo) con latencia mínima y sin sobrecargar el backend.

* **8. Base de Datos $\longrightarrow$ Grafana (`Querys` / Analítica Histórica):**
  * **Protocolo / Interfaz:** Driver nativo SQL (PostgreSQL/MySQL) sobre TCP.
  * **Descripción:** Grafana ejecuta consultas directas de solo lectura contra el motor de base de datos relacional. Mediante agregaciones SQL (`AVG`, `MAX`, `MIN`), nutre tableros de analítica avanzada que muestran tendencias históricas semanales, duraciones acumuladas de alarmas térmicas y registros de acceso de los operadores a lo largo de los lotes de incubación.

### 2.3 Flujo Integrado de Datos Extremo a Extremo
1. El microcontrolador envía periódicamente una línea JSON estructurada por el bus UART a 9600 baudios.
2. Flask valida la lectura, la registra en PostgreSQL y gestiona la apertura o cierre de intervalos de alarma térmica.
3. El publicador MQTT envía telemetría, estado de actuadores y alarmas; mantiene `status=online` y configura Last Will and Testament (LWT) como `offline`.
4. Grafana utiliza MQTT para el dashboard de operación en vivo y PostgreSQL para la analítica histórica.
5. Next.js consume la API REST para lotes e histórico, y se conecta mediante MQTT.js sobre WebSockets para recibir alarmas y estado sin recargar la página.

> **Estandarización temporal:** Todos los timestamps se publican y almacenan en formato UTC / ISO 8601 para garantizar consistencia. Ambos dashboards en Grafana operan con `timezone: browser`, adaptando automáticamente las series temporales al huso horario del operador.

## 3. Documentación de la Jerarquía de Topics MQTT

| Topic | QoS | Retained | Publicador | Suscriptores | Contenido / Payload |
|---|:---:|:---:|---|---|---|
| `smartegg/SE-01/sensores/temperatura` | 0 | No | Backend Flask | Grafana, Frontend | `{valor, unidad, timestamp}` |
| `smartegg/SE-01/sensores/humedad` | 0 | No | Backend Flask | Grafana, Frontend | `{valor, unidad, timestamp}` |
| `smartegg/SE-01/actuadores/estado` | 1 | Sí | Backend Flask | Grafana, Frontend | `{foco, ventilador, rotacion_grados}` |
| `smartegg/SE-01/alarmas/critica` | 1 | Sí | Backend Flask | Grafana, Frontend | `{activa, tipo, severidad, inicio_at, resolucion_at}` |
| `smartegg/SE-01/status` | 1 | Sí | Backend Flask (LWT Broker) | Grafana, Frontend | `{estado, valor}`; `offline`/`valor=0` es el LWT |
| `smartegg/SE-01/puerta/evento` | 1 | No | Backend Flask | Grafana, Frontend | `{id, accion, operador_id, cantidad_huevos, timestamp}` |

* **Detalles de configuración:** Broker Mosquitto con listener TCP en puerto 1883 y listener WebSocket en puerto 9001. Documentación completa de pruebas y esquemas en `infra/mqtt/README.md`.


## 4. Modelo entidad-relación de la base de datos.

![Diagrama ER SmartEgg](imagenes/DiagramaER.png)

Diagrama interactivo (dbdiagram.io): https://dbdiagram.io/d/6a9e6fc850ad2c46dc5a2298

### Entidades

| Tabla | Descripción |
|---|---|
| `nodos` | Incubadoras registradas en el sistema |
| `operadores` | Usuarios con acceso a apertura/cierre (Operador 1, Operador 2, Admin) |
| `lotes` | Fichas de huevos ingresados, asociadas a un nodo y opcionalmente a un operador |
| `lecturas` | Telemetría histórica: temperatura, humedad, actuadores, rotación |
| `alarmas` | Eventos críticos con severidad, inicio y resolución |
| `accesos_puerta` | Registro de apertura/cierre de cabina con cantidad de huevos |

### Relaciones clave
- Un `nodo` tiene muchos `lotes`, `lecturas`, `alarmas` y `accesos_puerta`.
- Un `operador` puede estar asociado a varios `lotes` (quien lo ingresó) y varios `accesos_puerta` (quien abrió/cerró).
- Cada `lectura` y `alarma` puede vincularse opcionalmente a un `lote` (`lote_id` nullable, se conserva el histórico aunque el lote termine).


## 5. API Contracts del Backend

El contrato OpenAPI completo del sistema se encuentra definido en [`openapi.yaml`](openapi.yaml).

### 5.1 Catálogo de Endpoints Principales
* `GET /health`: Comprobación de estado del servicio y conectividad con la base de datos.
* `GET /datos`: Lectura de telemetría instantánea y actuadores en vivo.
* `GET /historial`: Muestras históricas continuas para gráficas y analítica.
* `POST /huevo` / `GET /huevos`: Registro y consulta de estados de huevos por posición.
* `GET /alarmas`: Registro de eventos críticos e intervalos de superación de umbral.
* `GET /operadores`: Listado de usuarios autorizados (Operador 1, Operador 2, Administrador).
* `POST /puerta` / `GET /accesos-puerta`: Bitácora física de eventos de apertura y cierre de cabina.
* `GET /reporte`: Generación y descarga del informe consolidado en PDF.

## 6. Capturas de los Dashboards de Grafana

Los dashboards se provisionan automáticamente mediante archivos de configuración en el despliegue:

* **SmartEgg - Monitoreo MQTT en Tiempo Real:** Panel de baja latencia conectado al datasource MQTT streaming. Despliega temperatura, humedad, estado de foco/ventilador, rotación del servomotor, KPI de alarmas activas, estado de conexión (LWT) y el último evento registrado en la puerta.
![monitoreo](imagenes/monitoreo-MQTT.png)

* **SmartEgg - Analítica Histórica:** Panel de agregación conectado mediante SQL directo a PostgreSQL. Despliega tendencias de temperatura/humedad por lote, métricas de ocupación, valores mínimos/máximos/promedio, duración acumulada de alarmas y accesos de operadores.
![analitica-historica](imagenes/analitica-historica1.png)
![analitica-historica](imagenes/analitica-historica2.png)

### 6.1 Evidencias del broker MQTT

Pruebas ejecutadas con `mosquitto_sub` dentro del contenedor del broker:

* **Telemetría:** recepción de temperatura, humedad, actuadores, alarmas y estado del nodo.
  ![Evidencia de telemetría MQTT](imagenes/MQTT_Telemetria.png)
* **Retained:** un suscriptor nuevo recibe inmediatamente el último estado retenido del nodo.
  ![Evidencia de mensaje retained](imagenes/MQTT_Retained.png)
* **LWT:** al detener abruptamente el cliente de prueba, el broker publica `offline` con `valor: 0` y `motivo: lwt`.
  ![Evidencia de LWT offline](imagenes/MQTT_LWT.png)

La prueba LWT utiliza el topic aislado `smartegg/ROL4-TEST/status` para no interrumpir el nodo de demostración; el backend utiliza `smartegg/SE-01/status`.

## 7. Explicación de los frameworks/librerías y enlace al video demostrativo

### 7.1 Visualización interactiva con p5.js

La visualización interactiva principal del dashboard está construida con **p5.js 1.9.0**. p5.js es una biblioteca JavaScript orientada a la creación de gráficos interactivos y animaciones mediante un elemento `canvas` HTML. Se eligió para representar de manera sencilla y visual el estado de la incubadora sin depender de un modelo 3D complejo.

La visualización se encuentra en `frontend/public/visualizacion_p5.html` y se integra en el dashboard mediante un `iframe` desde el componente `IncubatorVisualizer`. Al estar dentro de la carpeta `public`, el archivo se accede desde la ruta `/visualizacion_p5.html`.

El programa utiliza las funciones principales de p5.js:

* `setup()` crea el lienzo, configura el modo angular y prepara las partículas que representan el vapor o la humedad.
* `draw()` se ejecuta continuamente para redibujar la escena y actualizar el movimiento de las partículas, el foco, el ventilador, la bandeja y los huevos.
* `createCanvas()` genera el área de renderizado adaptada al tamaño del `iframe`.
* Las transformaciones `translate()` y `rotate()` permiten mostrar la rotación de la bandeja según el ángulo recibido del servomotor.

La escena representa los siguientes elementos del sistema SmartEgg:

* El color ambiental cambia según la temperatura.
* Las partículas animadas reaccionan al valor de humedad.
* El foco se muestra encendido o apagado según el estado del actuador.
* El ventilador extractor cambia su apariencia cuando está activo.
* La bandeja circular gira de acuerdo con `rotacion_grados` o `servo_ang`.
* Los huevos ocupan las posiciones correspondientes a la cantidad calculada a partir de `espacios_libres`.
* El marco y la banda de alerta se activan cuando la API reporta una alarma o la temperatura supera el umbral crítico.

Cada dos segundos, el archivo ejecuta una petición `fetch` al endpoint `GET /datos` del backend Flask. La respuesta actualiza temperatura, humedad, espacios libres, estados de los actuadores, rotación y alarma. Por lo tanto, la escena no depende únicamente de valores estáticos: consume la telemetría real expuesta por la API REST.

### 7.2 Uso de Three.js

El proyecto incluye las dependencias `three`, `@react-three/fiber` y `@react-three/drei`, que permiten construir escenas 3D con Three.js dentro de React. Estas herramientas son adecuadas para modelos tridimensionales, cámaras, luces, materiales y controles de navegación.

Sin embargo, la visualización que se muestra actualmente en el dashboard para representar la incubadora es la implementación 2D realizada con p5.js. Three.js no es la biblioteca que renderiza esa visualización activa; sus componentes se conservan como soporte para posibles escenas 3D futuras o para pruebas del prototipo. Esta distinción evita documentar como funcional una visualización que no corresponde al panel actualmente desplegado.

### 7.3 Gráficos analíticos con Chart.js

Para los gráficos históricos se utiliza **Chart.js 4.5.1**, integrado en React mediante **react-chartjs-2**. Chart.js se seleccionó porque ofrece una API clara para construir gráficos de líneas y barras, soporta actualización de datos, tooltips, leyendas, escalas y diseño responsive, y se integra directamente con el ciclo de renderizado de los componentes React.

El componente `AnalyticsCharts` consulta el endpoint `GET /historial?limit=100` mediante `fetch`. La respuesta se almacena en el estado del componente y se actualiza automáticamente cada cuatro segundos. Para mantener el gráfico legible, se muestran las últimas 15 lecturas en orden cronológico.

Actualmente se presentan dos gráficos:

1. **Historial térmico y de humedad:** gráfico de líneas que muestra temperatura en grados Celsius y humedad relativa en porcentaje. Cada punto corresponde a una lectura almacenada en la base de datos.
2. **Registro de ocupación:** gráfico de barras que calcula los huevos ocupados mediante `3 - espacios_libres`, respetando la capacidad de tres posiciones de la bandeja.

Chart.js registra los módulos `CategoryScale`, `LinearScale`, `PointElement`, `LineElement`, `BarElement`, `Title`, `Tooltip`, `Legend` y `Filler`. Esto permite trabajar con etiquetas de tiempo, escalas numéricas, puntos, líneas, barras, áreas rellenas, leyendas y ayudas emergentes.

### 7.4 Flujo de datos de las visualizaciones

El flujo implementado es el siguiente:

1. El microcontrolador envía las lecturas al backend mediante comunicación serial.
2. Flask valida y persiste las lecturas en la base de datos.
3. El endpoint `GET /datos` entrega el estado actual para la escena p5.js.
4. El endpoint `GET /historial` entrega las lecturas históricas para Chart.js.
5. p5.js representa el estado actual en tiempo real, mientras Chart.js presenta la evolución histórica de las variables.

Esta separación permite utilizar cada herramienta según su propósito: p5.js se encarga de la representación interactiva y animada de la incubadora, y Chart.js de la comparación y análisis de las mediciones almacenadas.

### 7.5 Ventajas y consideraciones técnicas

* **p5.js:** facilita la creación de una escena animada personalizada y permite relacionar directamente cada elemento visual con una variable de telemetría.
* **Chart.js:** reduce el código necesario para crear gráficos profesionales y proporciona escalas, leyendas, tooltips y adaptación responsive.
* **Three.js:** queda disponible para una futura representación 3D más detallada, pero no es necesario para la visualización p5.js actualmente utilizada.
* **REST y `fetch`:** mantienen una integración simple entre el frontend y Flask. El sondeo periódico permite refrescar los datos sin recargar la página completa.

### 7.6 Video Demostrativo
* **Demostración en video (4 min):** [Ver Video Demostrativo de SmartEgg](https://drive.google.com/file/d/154BJDqPCBuRmhvK30u8I7iYwhhcL9cLo/view?usp=sharing)
* **Plataforma:** Google Drive
* **Duración:** 4:21 minutos


## 8. Documento comparativo HTTP vs. MQTT

SmartEgg utiliza una arquitectura híbrida: HTTP/REST para operaciones bajo demanda y MQTT para telemetría, estados y eventos en tiempo real.

### 8.1 HTTP en IoT

HTTP sigue el modelo **cliente-servidor de petición/respuesta**. El cliente realiza una solicitud (`GET`, `POST`, `PUT`, `PATCH` o `DELETE`) y el servidor responde con un código de estado y, normalmente, un JSON. En IoT, un dispositivo puede enviar mediciones mediante `POST`, pero el cliente debe volver a consultar para detectar cambios nuevos.

En SmartEgg, REST se utiliza para consultar datos y ejecutar operaciones concretas: `GET /datos`, `GET /historial`, `POST /huevo`, `POST /puerta`, consultas de alarmas/operadores y generación de reportes. Esto permite validaciones, códigos HTTP y contratos OpenAPI.

### 8.2 Optimizaciones HTTP

| Técnica | Beneficio en IoT |
|---|---|
| `Keep-Alive` | Reutiliza la conexión TCP/TLS y reduce *handshakes*. |
| Compresión | `gzip`/Brotli y JSON compacto reducen el payload. |
| HTTP/2 | Multiplexa solicitudes y comprime cabeceras en una conexión. |
| Caching | `ETag` y `Cache-Control` evitan transferir datos que no cambiaron. |
| Batching | Agrupa varias lecturas y reduce solicitudes repetidas. |
| CoAP | Alternativa REST ligera para dispositivos restringidos, normalmente sobre UDP. |

Estas técnicas optimizan HTTP, pero no lo convierten en un canal *push*; para alarmas inmediatas a varios consumidores se utiliza MQTT.

### 8.3 MQTT en SmartEgg

MQTT usa el modelo **publish/subscribe**: el backend publica en un *topic*, Mosquitto lo distribuye y Grafana/frontend reciben el mensaje sin consultarlo repetidamente. El backend es el publicador porque recibe las lecturas del microcontrolador por serial.

* Temperatura y humedad: QoS 0, porque son lecturas frecuentes.
* Actuadores, alarmas, status y puerta: QoS 1 para entrega al menos una vez.
* Status, actuadores y alarma: mensajes `retained` para entregar el último estado a nuevos suscriptores.
* `smartegg/SE-01/status`: LWT retenido con `estado=offline`; al conectar se publica `estado=online`.
* Las lecturas y eventos completos permanecen en PostgreSQL; MQTT distribuye el estado en vivo, no reemplaza el historial.

### 8.4 Tabla comparativa

| Criterio | HTTP/REST | MQTT |
|---|---|---|
| Comunicación | Petición/respuesta. | Publicación/suscripción mediante broker. |
| Overhead | Cabeceras y estructura más pesadas. | Encabezado pequeño y payload ligero. |
| Energía/banda | Puede aumentar con *polling* frecuente. | Menor tráfico repetido y conexión persistente. |
| Eventos | El cliente debe consultar. | Entrega *push* a suscriptores. |
| Desconexiones | Requiere timeout y reintentos de aplicación. | QoS, retained y LWT ayudan a recuperar estado y detectar caídas. |
| Escalabilidad | Cada consumidor consulta al servidor. | El broker distribuye a múltiples consumidores. |
| Historial | Requiere una base de datos externa. | `Retained` guarda solo el último estado; el histórico requiere PostgreSQL. |
| Uso en SmartEgg | CRUD, puerta, consultas y PDF. | Telemetría, actuadores, alarmas y status para Grafana/frontend. |

### 8.5 Justificación de la arquitectura

Se eligió **MQTT para telemetría y eventos** porque son mensajes pequeños y frecuentes que deben llegar en vivo a Grafana y al frontend. El broker desacopla los componentes y permite usar QoS 1, `retained` y LWT.

Se eligió **REST/HTTP para CRUD y consultas** porque registrar lotes, controlar la puerta, consultar históricos y generar reportes requiere una respuesta explícita, validaciones y códigos de estado.

Por tanto, el flujo queda separado así: **serial** entre microcontrolador y backend, **MQTT** para distribución en tiempo real, **REST/HTTP** para operaciones bajo demanda y **PostgreSQL** para persistencia histórica.

## 9. Instrucciones y evidencia de la orquestación con Docker.

### 9.1 Requisitos previos
- Docker Desktop instalado y en ejecución.
- Archivo `.env` creado a partir de `.env.example` (`cp .env.example .env`).

### 9.2 Comandos de despliegue

```bash
# 1. Copiar variables de entorno
cp .env.example .env

# 2. Levantar todos los servicios (primera vez, construye las imágenes)
docker compose up -d --build

# 3. Verificar que los 5 servicios estén arriba
docker compose ps

# 4. Revisar que la base de datos inicializó el schema correctamente
docker compose logs postgres
```

### 9.2.1 Configuración de Modo Simulado vs. Hardware Real
* **Modo Simulado:** Para probar el circuito completo sin el Arduino conectado, se define `SIMULATE_TELEMETRY=true` en `.env` y se recrea el contenedor:
  ```powershell
  docker compose up -d --force-recreate backend
  Invoke-RestMethod http://localhost:5000/health | ConvertTo-Json
  ```
  Para que las lecturas aparezcan en la analítica por lote, registre primero un lote y defina `SIMULATION_LOT_ID=<id_del_lote>` en `.env` antes de recrear el backend.

### 9.3 Servicios y accesos

| Servicio | Contenedor | Puerto | URL/Acceso |
|---|---|---|---|
| Base de datos | postgres-1 | 5432 | `postgresql://smartegg:***@localhost:5432/smartegg` |
| Broker MQTT | mosquitto-1 | 1883 / 9001 | `mqtt://localhost:1883`, WebSocket `ws://localhost:9001` |
| Backend API | backend-1 | 5000 | http://localhost:5000 |
| Grafana | grafana-1 | 3000 | http://localhost:3000 |
| Frontend | frontend-1 | 3001 | http://localhost:3001 |

### 9.4 Evidencia de funcionamiento

**Los 5 servicios corriendo (`docker compose ps`):**

![Docker compose ps](imagenes/DockerComposePS.png)

**Inicialización del schema en PostgreSQL (`docker compose logs postgres`):**

![Logs de postgres](imagenes/LogsPostgres.png)

Se observa la creación de las 6 tablas del modelo, los 4 índices y los registros semilla (nodo `SE-01` y los operadores 1 y 2), sin errores.

### 9.5 Prueba de persistencia de datos

Se validó que los datos sobreviven a un reinicio de los contenedores:

```bash
docker compose down      # elimina contenedores, conserva el volumen
docker compose up -d     # vuelve a levantar todo
docker exec -it smartegg-postgres-1 psql -U smartegg -d smartegg -c "SELECT * FROM nodos; SELECT * FROM operadores;"
```

![Prueba de persistencia](imagenes/PersistenciaTest.png)

El campo `created_at` de los registros coincide con el timestamp de la inicialización original, confirmando que el volumen `postgres_data` conserva la información entre reinicios.


## 10. Capturas de GitHub evidenciando los commits del equipo.
![captura-commits](imagenes/commits1.png)  
![captura-commits](imagenes/commits2.png)  

## 11. Manual de usuario
[Manual-Usuario](ManualUsuario.md)
