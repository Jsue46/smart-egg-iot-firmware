"""Herramienta interactiva para captura de dataset de visión con OpenCV.

Permite tomar fotografías reales usando la cámara del teléfono (Iriun) o webcam
y clasificarlas automáticamente en las carpetas correspondientes:
- 'h': Guardar foto como HUEVO
- 'o': Guardar foto como OBJETO EXTRAÑO
- 'v': Guardar foto como VACÍO
- 'q': Salir
"""

import cv2
import os
import sys
import time
from datetime import datetime

DATASET_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "dataset")
CLASSES = {
    "h": ("huevo", os.path.join(DATASET_DIR, "huevo")),
    "o": ("objeto_extrano", os.path.join(DATASET_DIR, "objeto_extrano")),
    "v": ("vacio", os.path.join(DATASET_DIR, "vacio"))
}


def asegurar_directorios():
    for _, path in CLASSES.values():
        os.makedirs(path, exist_ok=True)


def contar_muestras():
    conteo = {}
    for key, (nombre, path) in CLASSES.items():
        if os.path.exists(path):
            archivos = [f for f in os.listdir(path) if f.lower().endswith((".jpg", ".png", ".jpeg"))]
            conteo[nombre] = len(archivos)
        else:
            conteo[nombre] = 0
    return conteo


def encontrar_camara():
    """Busca automáticamente el índice de la cámara disponible (Iriun suele ser 1 o 0)."""
    # Si el usuario pasó un argumento por consola (ej. python capturar_dataset.py 1)
    if len(sys.argv) > 1:
        try:
            return int(sys.argv[1])
        except ValueError:
            return sys.argv[1]

    # Intentar primero índice 1 (Iriun Webcam externa suele ser 1 si la laptop tiene 0)
    for idx in [1, 0, 2]:
        cap = cv2.VideoCapture(idx)
        if cap.isOpened():
            ret, _ = cap.read()
            cap.release()
            if ret:
                return idx
    return 0


def main():
    asegurar_directorios()
    cam_idx = encontrar_camara()
    print("=" * 60)
    print("  SmartEgg IoT - Herramienta de Captura de Dataset")
    print("=" * 60)
    print(f"Abriendo camara indice: {cam_idx}")
    print("Controles de teclado:")
    print("  [H] -> Guardar como HUEVO")
    print("  [O] -> Guardar como OBJETO EXTRAÑO")
    print("  [V] -> Guardar como INCUBADORA VACÍA")
    print("  [Q] -> Salir")
    print("=" * 60)

    cap = cv2.VideoCapture(cam_idx)
    if not cap.isOpened():
        print(f"ERROR: No se pudo abrir la camara {cam_idx}.")
        print("Verifica que Iriun Webcam este corriendo en tu telefono y laptop.")
        return

    # Ajustar resolucion estandar
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)

    ultimo_guardado = ""
    tiempo_aviso = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            print("Error al leer fotograma de la camara.")
            break

        conteo = contar_muestras()
        display = frame.copy()
        h, w, _ = display.shape

        # Dibujar cuadro de enfoque / Region de Interes (ROI) central
        box_w, box_h = int(w * 0.6), int(h * 0.6)
        x1 = (w - box_w) // 2
        y1 = (h - box_h) // 2
        x2, y2 = x1 + box_w, y1 + box_h
        cv2.rectangle(display, (x1, y1), (x2, y2), (0, 255, 255), 2)

        # Panel superior de informacion
        cv2.rectangle(display, (0, 0), (w, 75), (20, 20, 20), -1)
        cv2.putText(
            display,
            "Captura SmartEgg Dataset [H]=Huevo  [O]=Objeto  [V]=Vacio  [Q]=Salir",
            (10, 22),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.5,
            (255, 255, 255),
            1,
            cv2.LINE_AA,
        )

        stats = f"Huevos: {conteo['huevo']} | Objetos: {conteo['objeto_extrano']} | Vacio: {conteo['vacio']}"
        cv2.putText(
            display,
            stats,
            (10, 48),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            (0, 255, 0),
            2,
            cv2.LINE_AA,
        )

        if time.time() < tiempo_aviso:
            cv2.putText(
                display,
                ultimo_guardado,
                (10, h - 20),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.6,
                (0, 255, 255),
                2,
                cv2.LINE_AA,
            )

        cv2.imshow("Captura de Dataset - SmartEgg", display)
        key = cv2.waitKey(1) & 0xFF

        if key == ord("q") or key == 27:
            break

        char_key = chr(key).lower() if key < 256 else ""
        if char_key in CLASSES:
            nombre_clase, dir_destino = CLASSES[char_key]
            # Guardamos tanto el fotograma completo como el recorte de la zona central
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
            filename = f"{nombre_clase}_{timestamp}.jpg"
            filepath = os.path.join(dir_destino, filename)

            # Extraemos la region de interes
            roi = frame[y1:y2, x1:x2]
            cv2.imwrite(filepath, roi)

            ultimo_guardado = f"GUARDADO: {filename} en [{nombre_clase}]"
            tiempo_aviso = time.time() + 1.5
            print(f"-> {ultimo_guardado}")

    cap.release()
    cv2.destroyAllWindows()
    print("\nCaptura finalizada.")
    print("Muestras actuales:")
    for k, v in contar_muestras().items():
        print(f"  - {k}: {v} imagenes")


if __name__ == "__main__":
    main()
