# SmartEgg - Frontend V1

SmartEgg es el panel web de una incubadora inteligente IoT para pequeños avicultores. Esta primera versión cubre la experiencia frontend solicitada en la Práctica 1 de Arquitectura de Computadoras y Ensambladores 2, USAC, segundo semestre de 2026.

La aplicación permite observar telemetría simulada en tiempo real, consultar lotes, registrar huevos mediante una ficha validada y generar un reporte PDF desde el navegador.

## Alcance de la V1

- Dashboard con temperatura, humedad, rotación y espacios disponibles.
- Telemetría simulada mediante variaciones suaves tipo random walk.
- Escena 3D de la incubadora en escritorio y alternativa 2D en móvil.
- Estado visual de alarma y control para pausar la simulación.
- Listado de lotes y capacidad de la incubadora.
- Formulario de registro con React Hook Form y Zod.
- Persistencia local de lotes mediante `localStorage`.
- Historial semanal con gráficas SVG accesibles.
- Línea de tiempo de alarmas.
- Generación y descarga de reportes PDF en el cliente.
- Diseño responsive desde 360 px, navegación por teclado y movimiento reducido.

## Rutas

| Ruta | Descripción |
| --- | --- |
| `/dashboard` | Monitoreo de sensores y estado de la incubadora. |
| `/lotes` | Capacidad y listado de lotes registrados. |
| `/lotes/nuevo` | Formulario y ficha de identificación del lote. |
| `/reportes` | Historial, alarmas y descarga del reporte PDF. |

## Tecnologías

- Next.js 16 con App Router y Turbopack.
- React 19 y TypeScript estricto.
- Tailwind CSS 4 y CSS personalizado.
- Motion para transiciones y lecturas animadas.
- Three.js con React Three Fiber y Drei.
- React Hook Form, Zod y resolvers tipados.
- jsPDF para reportes generados en el navegador.

## Requisitos

- Node.js 22 o superior.
- npm 10 o superior.

## Instalación y ejecución

```bash
cd frontend
npm install
npm run dev
```

La aplicación estará disponible en `http://localhost:3000` y redirigirá automáticamente al dashboard.

## Verificación local

```bash
cd frontend
npm run lint
npm run build
```

`npm run lint` ejecuta la validación completa de TypeScript. `npm run build` genera el build de producción con Turbopack.

## Estructura principal

```text
docs/
|- mockups/
|  |- frontend-desktop/  Capturas o diseños de la vista de escritorio
|  |- frontend-mobile/   Capturas o diseños de la vista móvil
|  `- prototipo-fisico/  Bocetos y evolución del encapsulado
|- diagramas/            Arquitectura, conexiones y capas IoT
`- evidencias/           Fotografías y pruebas del prototipo operando

frontend/
|- app/            Rutas, layout y estilos globales
|- components/     Dashboard, sensores, formularios, gráficas y escena 3D
|- hooks/          Telemetría simulada y estado compartido
|- lib/            Tipos y datos de demostración
|- package.json    Dependencias y comandos del proyecto
```

## Estado de integración

Esta V1 utiliza datos simulados y persistencia local para permitir la demostración completa del frontend sin depender todavía del hardware. La integración con Arduino/ESP32, comunicación serial, REST API, base de datos y autenticación del técnico corresponde a las siguientes fases del proyecto.

## Contexto académico

- Universidad de San Carlos de Guatemala.
- Facultad de Ingeniería.
- Arquitectura de Computadoras y Ensambladores 2.
- Grupo 7.
- Práctica 1: SmartEgg, Incubadora Inteligente IoT.
