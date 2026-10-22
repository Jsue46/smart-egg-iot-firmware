"""Herramienta de diagnostico y prueba rapida de camara para SmartEgg.

Permite verificar al instante si la camara del celular (Iriun Webcam) o de la laptop
esta respondiendo correctamente con OpenCV, mostrando resolucion, FPS y controles:
- [N]: Cambiar al siguiente indice de camara (0 -> 1 -> 2)
- [ESPACIO]: Tomar una foto de prueba y guardarla en 'vision/foto_prueba.jpg'
- [Q]: Salir
"""

import sys
import time
import cv2


def escanear_camaras():
    disponibles = []
    print("Escaneando dispositivos de video disponibles...")
    for i in range(5):
        cap = cv2.VideoCapture(i)
        if cap.isOpened():
            ret, _ = cap.read()
            if ret:
                w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
                h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
                disponibles.append((i, w, h))
            cap.release()
    return disponibles


def main():
    print("=" * 65)
    print("  SmartEgg Vision - Test y Diagnostico de Camara")
    print("=" * 65)

    cams = escanear_camaras()
    if not cams:
        print("\n[ERROR] No se detecto ninguna camara activa.")
        print("Sugerencias:")
        print("  1. Si usas Iriun Webcam en tu celular, asegurate de que la app")
        print("     este abierta en el cel y en la laptop.")
        print("  2. Si usas la webcam de tu laptop, verifica permisos de camara en Windows.")
        return

    print("\nCamaras encontradas:")
    for idx, w, h in cams:
        print(f"  -> Indice {idx}: Resolucion {w}x{h}")

    current_idx_pos = 0
    cam_id = cams[current_idx_pos][0]

    print(f"\nIniciando vista previa con camara indice: {cam_id}")
    cap = cv2.VideoCapture(cam_id)
    prev_time = time.time()
    fps = 0.0

    while True:
        ret, frame = cap.read()
        if not ret:
            print(f"Error al leer fotograma de la camara {cam_id}.")
            time.sleep(0.1)
            continue

        curr_time = time.time()
        fps = 0.9 * fps + 0.1 * (1.0 / max(0.001, curr_time - prev_time))
        prev_time = curr_time

        display = frame.copy()
        h, w, _ = display.shape

        # Panel superior de diagnostico
        cv2.rectangle(display, (0, 0), (w, 60), (20, 20, 20), -1)
        cv2.putText(
            display,
            f"Camara: Indice {cam_id} ({w}x{h}) | FPS: {fps:.1f}",
            (15, 25),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            (0, 255, 0),
            2,
            cv2.LINE_AA,
        )
        cv2.putText(
            display,
            "[N]=Cambiar Camara  [ESPACIO]=Guardar Foto  [Q]=Salir",
            (15, 48),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.45,
            (200, 200, 200),
            1,
            cv2.LINE_AA,
        )

        # Mira central
        cv2.drawMarker(
            display,
            (w // 2, h // 2),
            (0, 255, 255),
            markerType=cv2.MARKER_CROSS,
            markerSize=30,
            thickness=2,
        )

        cv2.imshow("SmartEgg - Test de Camara (Iriun / Laptop)", display)
        key = cv2.waitKey(1) & 0xFF

        if key == ord("q") or key == 27:
            break
        elif key == ord("n") or key == ord("N"):
            # Cambiar a la siguiente camara detectada
            cap.release()
            current_idx_pos = (current_idx_pos + 1) % len(cams)
            cam_id = cams[current_idx_pos][0]
            print(f"Cambiando a camara indice: {cam_id}...")
            cap = cv2.VideoCapture(cam_id)
        elif key == 32:  # Barra espaciadora
            foto_path = "vision/foto_prueba.jpg"
            cv2.imwrite(foto_path, frame)
            print(f">> Foto de prueba guardada exitosamente en '{foto_path}'")

    cap.release()
    cv2.destroyAllWindows()
    print("Test de camara finalizado.")


if __name__ == "__main__":
    main()
