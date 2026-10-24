"""Script de captura automatica de fotos reales desde Iriun Webcam / Laptop.

Uso:
  python vision/auto_captura.py --clase huevo
  python vision/auto_captura.py --clase vacio
  python vision/auto_captura.py --clase objeto_extrano
"""

import argparse
import os
import sys
import time
import cv2
import numpy as np

# Cargar configuracion de ROI si existe
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ROI_CONFIG = os.path.join(BASE_DIR, "roi_config.json")
DATASET_DIR = os.path.join(BASE_DIR, "dataset")


def main():
    parser = argparse.ArgumentParser(description="Captura automatica de fotos reales")
    parser.add_argument("--clase", type=str, default="huevo", choices=["huevo", "vacio", "objeto_extrano"])
    parser.add_argument("--cam", type=int, default=1, help="Indice de la camara (1=Iriun, 0=laptop)")
    parser.add_argument("--fotos", type=int, default=20, help="Cantidad de fotos a tomar")
    args = parser.parse_args()

    dir_destino = os.path.join(DATASET_DIR, args.clase)
    os.makedirs(dir_destino, exist_ok=True)

    print("=" * 60)
    print(f"  SmartEgg Vision - Captura Automatica: [{args.clase.upper()}]")
    print("=" * 60)
    print(f"Abriendo camara {args.cam}...")
    cap = None
    for backend in [None, cv2.CAP_DSHOW]:
        c = cv2.VideoCapture(args.cam) if backend is None else cv2.VideoCapture(args.cam, backend)
        if c.isOpened():
            # Probar si realmente lee fotogramas
            for _ in range(5):
                ret, test_frame = c.read()
                if ret and test_frame is not None and test_frame.mean() > 5:
                    cap = c
                    break
                time.sleep(0.1)
            if cap is not None:
                break
            c.release()

    if cap is None:
        # Intentar camara 0 como fallback
        for idx in [0, 2]:
            c = cv2.VideoCapture(idx, cv2.CAP_DSHOW)
            if c.isOpened():
                ret, test_frame = c.read()
                if ret and test_frame is not None and test_frame.mean() > 5:
                    cap = c
                    print(f"Usando camara en indice {idx}...")
                    break
                c.release()

    if cap is None:
        print(f"ERROR: No se pudo obtener imagen de la camara.")
        print("Verifica que Iriun Webcam este transmitiendo desde el telefono.")
        return 1

    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)

    # Dejar que el sensor de la camara caliente y ajuste el balance de blancos
    print("Calibrando sensor de camara (1.5 segundos)...")
    for _ in range(10):
        cap.read()
        time.sleep(0.1)

    # Offset ROI por defecto (centrado en la bandeja, esquivando el foco arriba)
    offset_x = 0
    offset_y = 35
    scale = 0.50

    if os.path.exists(ROI_CONFIG):
        try:
            import json
            with open(ROI_CONFIG, "r") as f:
                c = json.load(f)
                offset_x = c.get("offset_x", offset_x)
                offset_y = c.get("offset_y", offset_y)
                scale = c.get("scale", scale)
        except Exception:
            pass

    guardadas = 0
    ts = int(time.time() * 1000)

    for i in range(args.fotos):
        ret, frame = cap.read()
        if not ret:
            time.sleep(0.05)
            continue

        h, w, _ = frame.shape
        box_w = max(40, min(w - 20, int(w * scale)))
        box_h = max(40, min(h - 20, int(h * scale)))
        cx = (w // 2) + offset_x
        cy = (h // 2) + offset_y
        x1 = max(0, min(w - box_w, cx - box_w // 2))
        y1 = max(0, min(h - box_h, cy - box_h // 2))
        x2 = x1 + box_w
        y2 = y1 + box_h

        roi = frame[y1:y2, x1:x2]
        path_foto = os.path.join(dir_destino, f"real_auto_{args.clase}_{ts}_{i:03d}.jpg")
        cv2.imwrite(path_foto, roi)
        guardadas += 1
        time.sleep(0.05)

    cap.release()
    print(f"\n¡Exito! Se capturaron {guardadas} fotos reales en:")
    print(f" -> {dir_destino}")

    # Preguntar o reentrenar directamente
    from entrenar_modelo import entrenar_modelo_fn
    print("\nReentrenando modelo con las nuevas fotos reales...")
    clf, acc = entrenar_modelo_fn()
    print(f"Exactitud obtenida: {acc * 100:.1f}%\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
