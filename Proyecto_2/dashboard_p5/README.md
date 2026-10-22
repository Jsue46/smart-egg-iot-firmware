# Dashboard interactivo p5.js

`index.html` es la página independiente de monitoreo que se despliega en Azure Blob Storage. Usa un canvas 2D de p5.js para graficar temperatura, humedad y potencia, y recibe lecturas directamente por MQTT sobre WebSockets. Las tarjetas laterales muestran visión, ML, actuadores y controles de energía.

La copia local para el portal Next.js es `frontend/public/visualizacion_p5.html`. Ambas páginas deben mantenerse iguales; `index_cloud.html` se regenera desde `index.html` durante el despliegue e inyecta el host MQTT público.

El botón **Abrir dashboard p5.js** del encabezado de `/dashboard` abre la página local en una pestaña nueva. Para apuntar el botón al sitio estático de Azure, define `NEXT_PUBLIC_P5_DASHBOARD_URL` con la URL de Blob Storage antes de construir el frontend.
