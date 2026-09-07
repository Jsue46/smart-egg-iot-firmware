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
## 2. Arquitectura General del Sistema

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


## 3. Documentación de la jerarquía de topics MQTT (nombre, publicador, suscriptores, formato del payload, QoS).


## 4. Modelo entidad-relación de la base de datos.

![Diagrama ER SmartEgg](imagenes/Diagrama_ER.png)

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


## 5. API Contracts del backend


## 6. Capturas de los dashboards de Grafana 


## 7. Explicación de los frameworks/librerías y enlace al video demostrativo


## 8. Documento comparativo HTTP vs. MQTT 


## 9. Instrucciones y evidencia de la orquestación con Docker (docker-compose y capturas de los contenedores en ejecución).



## 10. Capturas de GitHub evidenciando los commits del equipo.


## 11. Manual de usuario
