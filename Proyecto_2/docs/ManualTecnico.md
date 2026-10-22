# SmartEgg IoT — Documentación Técnica del Proyecto 1

## 1. Descripción de la Solución y Continuidad respecto a la Práctica 1

### 1.1 Contexto y Evolución del Sistema
En la **Práctica 1**, el sistema *SmartEgg* se concibió como un prototipo funcional monolítico enfocado en la adquisición física y el control básico de una incubadora avícola automatizada. Dicha fase inicial integró la lectura de sensores de temperatura y humedad (DHT11), detección de presencia de huevos mediante finales de carrera, actuación térmica mediante relés (foco calefactor y ventilador extractor), el movimiento oscilatorio mecánico de una bandeja giratoria controlada por servomotor ($\pm45^\circ$) y una aplicación de escritorio/web respaldada por una base de datos local SQLite y una API REST desarrollada en Flask.

Para este **Proyecto 1**, la solución evoluciona desde un sistema aislado hacia una **arquitectura distribuida IoT de grado industrial**, desacoplada, observable y contenerizada. El objetivo principal de esta transición es mitigar la latencia en la propagación de eventos críticos, garantizar la persistencia relacional concurrente de los datos de telemetría y dotar al operador de mecanismos analíticos y visuales interactivos de alto rendimiento.

---

### 1.2 Arquitectura y Componentes de Continuidad

El proyecto mantiene la lógica de hardware y de negocio establecida en la práctica inicial, expandiendo sus capacidades a través de los siguientes ejes de continuidad:

* **Capa de Adquisición Física (Microcontrolador & Serial):**
  Se preserva la integración con el microcontrolador físico mediante UART. En despliegue, el puente serial del host publica la telemetría por MQTT; el lector serial del backend queda disponible para pruebas locales y reintenta la conexión ante desconexiones físicas. El simulador queda desactivado por defecto. También se registra el acceso físico a cabina mediante switch/sensor.

* **Núcleo del Backend (Python & Flask):**
  Flask expone operaciones administrativas (lotes, operadores, alarmas, eventos de puerta y reportes). La telemetría no se consulta ni se envía por HTTP: el backend recibe por MQTT la lectura completa para persistirla en la base relacional.

* **Transición de Persistencia (SQLite a Base de Datos Relacional Contenerizada):**
  El esquema inicial de almacenamiento migra hacia un motor relacional formal orquestado en Docker (PostgreSQL/MySQL), integrando un modelo entidad-relación normalizado que soporta el ciclo de vida de lotes, operadores designados (Operador 1, Operador 2, Administrador), bitácora de accesos de puerta y métricas históricas indexadas.

* **Capa de Transporte Híbrida (REST administrativo + MQTT sobre WebSockets):**
  La telemetría, los estados de actuadores y los eventos en tiempo real se distribuyen mediante MQTT. REST queda para lotes y otras operaciones administrativas. Los mensajes de estado utilizan QoS, retención y Last Will and Testament (LWT) para que la interfaz observe cambios sin sondeo HTTP.

* **Ecosistema de Frontend y Observabilidad (Next.js & Grafana):**
  La interfaz de usuario pasa a construirse sobre Next.js (React + TypeScript) con una estética editorial botánica adaptada a la identidad del proyecto. En este entorno convergen:
  1. Paneles analíticos construidos con **Chart.js** para el seguimiento continuo de tendencias térmicas y ocupación histórica.
  2. Un dashboard web independiente e interactivo en **p5.js**, con gráficas 2D de temperatura, humedad y potencia que consume telemetría MQTT.
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

* **2. Microcontrolador $\longrightarrow$ Puente serial $\longrightarrow$ MQTT Broker:**
  * **Protocolo / Interfaz:** UART sobre USB (9600 baudios) y MQTT sobre TCP (puerto 1883).
  * **Descripción:** El puente lee las tramas JSON del Arduino, publica las variables en sus tópicos MQTT en vivo y envía el objeto completo a `smartegg/{id}/sensores/lectura` con QoS 1. El suscriptor MQTT del backend valida y persiste esa lectura. Para pruebas locales también se puede habilitar la lectura serial directa del backend.

* **3. Backend REST/API $\longleftrightarrow$ Base de Datos (`Query` / Persistencia):**
  * **Protocolo / Interfaz:** Conector SQL / TCP sobre red interna de contenedores.
  * **Descripción:** El suscriptor MQTT ejecuta `INSERT` transaccionales para guardar las lecturas recibidas, alarmas y eventos. Las consultas SQL se usan en operaciones administrativas y para construir reportes; la interfaz no recupera telemetría mediante endpoints REST.

* **4. Backend REST/API $\longleftrightarrow$ Frontend Web (`Request` / HTTP REST):**
  * **Protocolo / Interfaz:** HTTP/1.1 (JSON) sobre TCP/IP con soporte CORS.
  * **Descripción:** Comunicación cliente-servidor para acciones administrativas bajo demanda, como lotes y reportes. La interfaz recibe temperatura, humedad, actuadores, alarmas y eventos en vivo directamente por MQTT sobre WebSockets.

* **5. Puente serial/backend $\longrightarrow$ MQTT Broker (`Publisher`):**
  * **Protocolo / Interfaz:** Protocolo MQTT 3.1.1 sobre TCP (puerto estándar 1883).
  * **Descripción:** El puente publica temperatura, humedad y estado de actuadores; además publica el objeto completo en `smartegg/{id}/sensores/lectura` para que el backend lo guarde. El backend publica alarmas y estado de conectividad (Last Will and Testament, LWT). Los clientes web se conectan al listener MQTT sobre WebSockets (puerto 9001).

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
1. El microcontrolador envía periódicamente una línea JSON estructurada por UART al puente serial.
2. El puente publica telemetría y actuadores por MQTT, además de la muestra completa en `sensores/lectura`.
3. El suscriptor MQTT del backend persiste la lectura en PostgreSQL y gestiona intervalos de alarma térmica.
4. El backend publica alarmas y conectividad; `status` usa Last Will and Testament (LWT) con `offline`.
5. Grafana utiliza MQTT para el dashboard en vivo y PostgreSQL para analítica histórica. Next.js recibe telemetría por MQTT sobre WebSockets.

> **Estandarización temporal:** Todos los timestamps se publican y almacenan en formato UTC / ISO 8601 para garantizar consistencia. Ambos dashboards en Grafana operan con `timezone: browser`, adaptando automáticamente las series temporales al huso horario del operador.

### 2.4 Flujo de telemetría y alarmas del frontend: MQTT y REST administrativo

El frontend (Next.js / React / TypeScript) mantiene **dos clientes de transporte separados**: MQTT para el flujo en vivo y REST para operaciones administrativas bajo demanda.

* **Cliente MQTT (alarmas y eventos en vivo):** implementado con la librería `mqtt.js` sobre WebSocket (`ws://localhost:9001`). Se suscribe a los tópicos críticos del broker:
  * `smartegg/SE-01/sensores/temperatura` y `.../sensores/humedad` — telemetría ambiental.
  * `smartegg/SE-01/alarmas/critica` — condiciones fuera de rango.
  * `smartegg/SE-01/puerta/evento` — apertura/cierre de cabina.
  * `smartegg/SE-01/status` — disponibilidad del nodo (LWT).
  * `smartegg/SE-01/actuadores/estado` — estados de actuadores y rotación.

  Al recibir un mensaje de `alarmas/critica` con `activa: true`, la interfaz propaga el evento en menos de 3 segundos: banner **ALARMA ACTIVA**, *toast* emergente, indicador sonoro (desactivable) y actualización del centro de alarmas con la distinción entre eventos **activos** y **resueltos**. La notificación se dispara por *transición* de estado (activa → resuelta), no por cada lectura, para evitar repetir sonidos mientras la condición permanece fuera de rango.

* **Cliente HTTP/REST (operaciones administrativas):** implementado con `fetch` hacia la API de Flask:
  * Consultas: `GET /huevos`, `GET /alarmas`, `GET /accesos-puerta`, `GET /operadores`, `GET /reporte`.
  * Operaciones: `POST /huevo` (registro de ficha/lote) y `POST /puerta` (apertura/cierre).

  Este cliente alimenta las vistas administrativas y el generador de reportes PDF. La telemetría y los gráficos recientes se actualizan por suscripción MQTT; no usan sondeo HTTP.

| Canal | Rol | Mecanismo | Latencia esperada |
|---|---|---|---|
| MQTT (WebSocket) | Telemetría, actuadores, alarmas, eventos de puerta y estado del nodo | Publicador/suscriptor vía broker | En vivo (push, sin recarga) |
| HTTP/REST | Lotes y operaciones administrativas | Petición/respuesta con códigos de estado | Bajo demanda |

Esta separación mantiene toda la telemetría y el control en MQTT; las solicitudes REST se reservan para datos y operaciones administrativas.

## 3. Documentación de la Jerarquía de Topics MQTT

| Topic | QoS | Retained | Publicador | Suscriptores | Contenido / Payload |
|---|:---:|:---:|---|---|---|
| `smartegg/SE-01/sensores/temperatura` | 0 | No | Puente serial | Grafana, Frontend | `{valor, unidad, timestamp}` |
| `smartegg/SE-01/sensores/humedad` | 0 | No | Puente serial | Grafana, Frontend | `{valor, unidad, timestamp}` |
| `smartegg/SE-01/sensores/lectura` | 1 | No | Puente serial | Backend MQTT | Lectura completa para persistencia |
| `smartegg/SE-01/actuadores/estado` | 1 | Sí | Puente serial | Grafana, Frontend | `{foco, ventilador, rotacion_grados}` |
| `smartegg/SE-01/alarmas/critica` | 1 | Sí | Backend Flask | Grafana, Frontend | `{activa, tipo, severidad, inicio_at, resolucion_at}` |
| `smartegg/SE-01/status` | 1 | Sí | Backend Flask (LWT Broker) | Grafana, Frontend | `{estado, valor}`; `offline`/`valor=0` es el LWT |
| `smartegg/SE-01/puerta/evento` | 1 | No | Puente serial/backend | Grafana, Frontend | `{id, accion, operador_id, cantidad_huevos, timestamp}` |
| `smartegg/SE-01/control/energia` | 1 | No | Frontend | Servicio de energía, puente serial | Límite de potencia y temporizador |
| `smartegg/SE-01/control/actuadores` | 1 | Sí | Servicio de energía | Puente serial | Última orden: `{accion: APAGAR}` al vencer; `{accion: REANUDAR}` al programar o cancelar |

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

El dashboard independiente usa **p5.js 1.9.0** para dibujar gráficas 2D dentro de un `canvas`. El archivo fuente es `dashboard_p5/index.html`; la misma página está disponible localmente en `frontend/public/visualizacion_p5.html` y se publica como sitio estático en Azure Blob Storage. En el panel Next.js, el botón **Abrir dashboard p5.js** abre esta interfaz en una pestaña nueva. No se incrusta dentro de la tarjeta del modelo 3D.

La página presenta lecturas ambientales, clasificación de visión, estado del modelo ML, actuadores y consumo eléctrico. El canvas permite elegir entre las tendencias de temperatura, humedad y potencia, y muestra detalles al pasar sobre las lecturas. Los valores empiezan vacíos y aparecen cuando llegan mensajes; no se muestran mediciones de ejemplo.

* `setup()` crea el lienzo y abre la conexión al broker por MQTT sobre WebSockets.
* `draw()` dibuja la variable seleccionada y actualiza el cursor y la lectura resaltada.
* `createCanvas()` crea el lienzo según el tamaño disponible y `windowResized()` lo adapta al cambiar la ventana.
* Los botones de selección cambian entre temperatura, humedad y potencia. El control deslizante de energía, el temporizador y la acción de desbloqueo publican órdenes MQTT.
* El dashboard mantiene hasta 72 muestras recientes por variable en memoria local de la página.

La interfaz recibe mensajes de `smartegg/{id}/sensores/temperatura`, `.../sensores/humedad`, `.../actuadores/estado`, `.../vision/estado`, `.../ml/anomalia` y `.../energia/consumo`. No consulta REST para telemetría ni para el estado de actuadores.

### 7.2 Uso de Three.js

El proyecto incluye las dependencias `three`, `@react-three/fiber` y `@react-three/drei`, que permiten construir escenas 3D con Three.js dentro de React. Estas herramientas son adecuadas para modelos tridimensionales, cámaras, luces, materiales y controles de navegación.

Three.js, mediante `@react-three/fiber` y `@react-three/drei`, renderiza el modelo tridimensional en el panel Next.js. Esa vista es independiente del dashboard p5.js, que dibuja tendencias 2D y se abre desde el botón del encabezado del Panel.

### 7.3 Gráficos recientes con Chart.js

Para los gráficos de tendencias recientes se utiliza **Chart.js 4.5.1**, integrado en React mediante **react-chartjs-2**. Chart.js se seleccionó porque ofrece una API clara para construir gráficos de líneas y barras, soporta actualización de datos, tooltips, leyendas, escalas y diseño responsive, y se integra directamente con el ciclo de renderizado de los componentes React.

El componente `AnalyticsCharts` utiliza las muestras recientes que mantiene `useTelemetry` a partir de los mensajes MQTT de temperatura y humedad. El gráfico se actualiza al llegar nuevas lecturas; no consulta un endpoint HTTP de historial.

Actualmente se presentan dos gráficos:

1. **Tendencia térmica y de humedad reciente:** gráfico de líneas que muestra temperatura en grados Celsius y humedad relativa en porcentaje a partir de muestras MQTT recibidas.
2. **Registro de ocupación:** gráfico de barras que calcula los huevos ocupados mediante `3 - espacios_libres`, respetando la capacidad de tres posiciones de la bandeja.

Chart.js registra los módulos `CategoryScale`, `LinearScale`, `PointElement`, `LineElement`, `BarElement`, `Title`, `Tooltip`, `Legend` y `Filler`. Esto permite trabajar con etiquetas de tiempo, escalas numéricas, puntos, líneas, barras, áreas rellenas, leyendas y ayudas emergentes.

### 7.4 Flujo de datos de las visualizaciones

El flujo implementado es el siguiente:

1. El puente serial publica las muestras del microcontrolador en MQTT, incluidos los tópicos de sensores y actuadores.
2. La lectura completa se publica en `smartegg/{id}/sensores/lectura`; el backend la recibe por MQTT y la persiste en PostgreSQL.
3. La interfaz Next.js recibe los valores en vivo del broker mediante MQTT sobre WebSockets; el dashboard p5.js abre su propia suscripción al mismo broker.
4. `useTelemetry` conserva una ventana de muestras recibidas para Chart.js. El dashboard p5.js mantiene hasta 72 muestras recientes por variable para su canvas.

Así, Three.js representa la maqueta 3D, p5.js ofrece el dashboard interactivo de tendencias y Chart.js muestra las gráficas de la aplicación React.

### 7.5 Ventajas y consideraciones técnicas

* **p5.js:** crea una interfaz de gráficas 2D interactivas que se alimenta de mensajes MQTT.
* **Chart.js:** reduce el código necesario para crear gráficos profesionales y proporciona escalas, leyendas, tooltips y adaptación responsive.
* **Three.js:** renderiza el modelo 3D del panel React; no forma parte del dashboard p5.js.
* **REST y `fetch`:** mantienen una integración simple para lotes y otras operaciones administrativas; la telemetría se actualiza por MQTT, sin sondeo HTTP.

### 7.6 Video Demostrativo
* **Demostración en video:** [Ver Video Demostrativo de SmartEgg (Google Drive)](https://drive.google.com/drive/folders/1w0q4TgvbBKzDrHfzG4wQCiI1_iPQEONU?usp=sharing)
* **Plataforma:** Google Drive


## 8. Documento comparativo HTTP vs. MQTT

SmartEgg utiliza REST para operaciones administrativas bajo demanda y MQTT para telemetría, estados, controles y eventos en tiempo real.

### 8.1 HTTP en IoT

HTTP sigue el modelo **cliente-servidor de petición/respuesta**. El cliente realiza una solicitud (`GET`, `POST`, `PUT`, `PATCH` o `DELETE`) y el servidor responde con un código de estado y, normalmente, un JSON. En IoT, un dispositivo puede enviar mediciones mediante `POST`, pero el cliente debe volver a consultar para detectar cambios nuevos.

En SmartEgg, REST se utiliza para lotes, consultas administrativas, registro de eventos de puerta y generación de reportes. No existen rutas REST para consultar o registrar telemetría; esos datos viajan por MQTT.

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

MQTT usa el modelo **publish/subscribe**: el puente serial publica en los tópicos del nodo, Mosquitto los distribuye y Grafana/frontend reciben los mensajes sin consultarlos repetidamente. El backend se suscribe a la lectura completa para persistirla y publica estado y alarmas.

* Temperatura y humedad: QoS 0, porque son lecturas frecuentes.
* Actuadores, alarmas, status y puerta: QoS 1 para entrega al menos una vez.
* Status, actuadores y alarma: mensajes `retained` para entregar el último estado a nuevos suscriptores.
* `smartegg/SE-01/status`: LWT retenido con `estado=offline`; al conectar se publica `estado=online`.
* El objeto completo de cada lectura viaja por MQTT hacia el suscriptor del backend y se conserva en PostgreSQL; el dashboard recibe el estado directamente del broker.

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
| Uso en SmartEgg | CRUD administrativo, consultas de lotes/operadores y PDF. | Telemetría, actuadores, alarmas, puerta y status para Grafana/frontend. |

### 8.5 Justificación de la arquitectura

Se eligió **MQTT para telemetría y eventos** porque son mensajes pequeños y frecuentes que deben llegar en vivo a Grafana y al frontend. El broker desacopla los componentes y permite usar QoS 1, `retained` y LWT.

Se eligió **REST/HTTP para CRUD administrativo y reportes** porque registrar lotes y consultar datos administrativos requiere una respuesta explícita, validaciones y códigos de estado. Las órdenes y estados de actuadores se envían por MQTT.

Por tanto, el flujo queda separado así: **serial** entre microcontrolador y puente, **MQTT** para telemetría, control y distribución en tiempo real, **REST/HTTP** para operaciones administrativas y **PostgreSQL** para persistencia histórica.

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
A continuación se presenta la evidencia del trabajo colaborativo del equipo en el repositorio de GitHub, verificando la participación activa y el registro de commits por parte de cada integrante:  

![captura-commits](imagenes/commits1.png)  
![captura-commits](imagenes/commits2.png)  

## 11. Manual de usuario
[Manual-Usuario](ManualUsuario.md)
