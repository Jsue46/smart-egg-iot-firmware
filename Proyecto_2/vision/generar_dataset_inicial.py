"""Generador de dataset de arranque para SmartEgg Vision.

Crea un conjunto inicial de muestras variadas con diferentes iluminaciones,
rotaciones y escalas para las 3 clases requeridas por el enunciado:
1. 'huevo' (formas ovoides, tonos crema/marron/blanco, superficie suave)
2. 'objeto_extrano' (herramientas, llaves, bloques angulares, colores artificiales)
3. 'vacio' (fondo de rejilla/bandeja de incubadora sin contenido)

Permite entrenar y validar el modelo de inmediato, y se complementa con las
fotografias reales que el usuario tome con capturar_dataset.py.
"""

import os
import random
import cv2
import numpy as np

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATASET_DIR = os.path.join(BASE_DIR, "dataset")

CLASSES = ["huevo", "objeto_extrano", "vacio"]
IMG_SIZE = (224, 224)
SAMPLES_PER_CLASS = 35


def fondo_incubadora(w=224, h=224, luz=1.0):
    """Genera fondo con textura de bandeja o rejilla de incubadora."""
    # Base oscura/grisacea
    base_color = int(45 * luz)
    img = np.full((h, w, 3), (base_color, base_color + 5, base_color + 10), dtype=np.uint8)

    # Lineas de rejilla
    grid_color = int(25 * luz)
    for y in range(0, h, 28):
        cv2.line(img, (0, y), (w, y), (grid_color, grid_color, grid_color), 1)
    for x in range(0, w, 28):
        cv2.line(img, (x, 0), (x, h), (grid_color, grid_color, grid_color), 1)

    # Ruido sutil de textura
    ruido = np.random.normal(0, 5, (h, w, 3)).astype(np.int16)
    img = np.clip(img.astype(np.int16) + ruido, 0, 255).astype(np.uint8)
    return img


def generar_huevo(luz=1.0):
    img = fondo_incubadora(IMG_SIZE[0], IMG_SIZE[1], luz)
    cx = IMG_SIZE[0] // 2 + random.randint(-15, 15)
    cy = IMG_SIZE[1] // 2 + random.randint(-15, 15)
    eje_mayor = random.randint(45, 65)
    eje_menor = int(eje_mayor * random.uniform(0.68, 0.78))
    angulo = random.randint(0, 180)

    # Color de huevo (blanco, crema, beige o cafe claro)
    tonos = [
        (220, 230, 240),  # Blanco / tiza
        (170, 205, 235),  # Crema suave
        (130, 175, 215),  # Beige cafe
        (100, 145, 195),  # Pardo rojizo
    ]
    color_base = random.choice(tonos)
    color = tuple(min(255, int(c * luz)) for c in color_base)

    # Sombra previa
    sombra_cx = cx + 8
    sombra_cy = cy + 10
    cv2.ellipse(img, (sombra_cx, sombra_cy), (eje_mayor + 4, eje_menor + 4), angulo, 0, 360, (15, 15, 15), -1)

    # Huevo principal
    cv2.ellipse(img, (cx, cy), (eje_mayor, eje_menor), angulo, 0, 360, color, -1)

    # Brillo especular suave en la cascara
    brillo_cx = cx - int(eje_mayor * 0.25)
    brillo_cy = cy - int(eje_menor * 0.25)
    brillo_color = tuple(min(255, int(c * 1.25 * luz)) for c in color_base)
    cv2.ellipse(img, (brillo_cx, brillo_cy), (int(eje_mayor * 0.4), int(eje_menor * 0.35)), angulo, 0, 360, brillo_color, -1)

    # Suavizado de bordes
    img = cv2.GaussianBlur(img, (3, 3), 0)
    return img


def generar_objeto_extrano(luz=1.0):
    img = fondo_incubadora(IMG_SIZE[0], IMG_SIZE[1], luz)
    cx = IMG_SIZE[0] // 2 + random.randint(-20, 20)
    cy = IMG_SIZE[1] // 2 + random.randint(-20, 20)

    tipo = random.choice(["rectangulo_metal", "llave", "bloque_color", "tornillo"])

    if tipo == "rectangulo_metal":
        # Simulacion de destornillador / tijera / pieza metalica gris oscura o cromo
        w_box = random.randint(15, 30)
        h_box = random.randint(70, 110)
        rect = ((cx, cy), (w_box, h_box), random.randint(0, 180))
        box = cv2.boxPoints(rect)
        box = np.int32(box)
        cv2.drawContours(img, [box], 0, (180, 180, 180), -1)
        cv2.drawContours(img, [box], 0, (60, 60, 60), 2)

    elif tipo == "bloque_color":
        # Objeto de plastico brillante (azul, verde, rojo chillante)
        colores = [(200, 30, 30), (30, 200, 30), (30, 30, 220), (200, 200, 30)]
        col = random.choice(colores)
        lado = random.randint(40, 70)
        x1 = cx - lado // 2
        y1 = cy - lado // 2
        cv2.rectangle(img, (x1, y1), (x1 + lado, y1 + lado), col, -1)
        cv2.rectangle(img, (x1, y1), (x1 + lado, y1 + lado), (10, 10, 10), 2)

    elif tipo == "llave":
        # Forma alargada con cabeza circular
        angulo = random.randint(0, 360)
        rad = np.radians(angulo)
        # Cabeza
        cv2.circle(img, (cx, cy), 18, (140, 140, 150), -1)
        cv2.circle(img, (cx, cy), 7, (20, 20, 20), -1)
        # Cuerpo
        x_fin = int(cx + 60 * np.cos(rad))
        y_fin = int(cy + 60 * np.sin(rad))
        cv2.line(img, (cx, cy), (x_fin, y_fin), (140, 140, 150), 10)

    else:
        # Tornillo / pieza irregular con puntas
        pts = np.array([
            [cx - 30, cy - 10], [cx + 30, cy - 10],
            [cx + 10, cy + 35], [cx - 10, cy + 35]
        ], np.int32)
        cv2.fillPoly(img, [pts], (100, 100, 120))
        cv2.polylines(img, [pts], True, (40, 40, 40), 2)

    return img


def generar_vacio(luz=1.0):
    return fondo_incubadora(IMG_SIZE[0], IMG_SIZE[1], luz)


def main():
    print("=" * 60)
    print("  SmartEgg Vision - Generando Dataset Inicial de Calidad")
    print("=" * 60)

    for c in CLASSES:
        target_dir = os.path.join(DATASET_DIR, c)
        os.makedirs(target_dir, exist_ok=True)

    niveles_luz = [0.7, 0.85, 1.0, 1.15, 1.3]

    for c in CLASSES:
        target_dir = os.path.join(DATASET_DIR, c)
        # Verificar cuantas imagenes ya existen
        existentes = len([f for f in os.listdir(target_dir) if f.endswith(".jpg")])
        if existentes >= SAMPLES_PER_CLASS:
            print(f"Clase '{c}' ya tiene {existentes} muestras. Conservando.")
            continue

        print(f"Generando muestras para clase '{c}'...")
        for i in range(SAMPLES_PER_CLASS):
            luz = random.choice(niveles_luz)
            if c == "huevo":
                img = generar_huevo(luz)
            elif c == "objeto_extrano":
                img = generar_objeto_extrano(luz)
            else:
                img = generar_vacio(luz)

            filename = f"seed_{c}_{i:03d}.jpg"
            filepath = os.path.join(target_dir, filename)
            cv2.imwrite(filepath, img)

    print("\nDataset completado con exito:")
    for c in CLASSES:
        target_dir = os.path.join(DATASET_DIR, c)
        total = len([f for f in os.listdir(target_dir) if f.endswith((".jpg", ".png"))])
        print(f"  - {c}: {total} imagenes disponibles en {target_dir}")


if __name__ == "__main__":
    main()
