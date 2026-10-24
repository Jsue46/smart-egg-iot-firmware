"""Generador de dataset realista para SmartEgg Vision.

Genera imágenes sintéticas que imitan las condiciones reales de la maqueta:
- Bandeja celeste/azul con agujeros circulares oscuros
- Iluminación cálida (foco incandescente naranja)
- Huevos reales vistos desde arriba en ángulo
- Diferentes condiciones de luz y posición
"""

import os
import random
import cv2
import numpy as np

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATASET_DIR = os.path.join(BASE_DIR, "dataset")
CLASSES = ["huevo", "objeto_extrano", "vacio"]
IMG_SIZE = (224, 224)
SAMPLES_PER_CLASS = 50


def fondo_bandeja_real(w=224, h=224, luz=1.0):
    """Genera fondo que imita la bandeja celeste real de la maqueta."""
    # Base celeste/azul de la bandeja (como en la foto real)
    base_b = int(min(255, 160 * luz))
    base_g = int(min(255, 140 * luz))
    base_r = int(min(255, 100 * luz))
    img = np.full((h, w, 3), (base_b, base_g, base_r), dtype=np.uint8)

    # Agregar variación de textura plástica
    ruido = np.random.normal(0, 8, (h, w, 3)).astype(np.int16)
    img = np.clip(img.astype(np.int16) + ruido, 0, 255).astype(np.uint8)

    # Agujeros circulares oscuros de la bandeja (como en la foto real)
    num_agujeros = random.randint(2, 5)
    for _ in range(num_agujeros):
        ax = random.randint(20, w - 20)
        ay = random.randint(20, h - 20)
        radio = random.randint(15, 35)
        # Interior oscuro del agujero
        cv2.circle(img, (ax, ay), radio, (25, 25, 30), -1)
        # Borde del agujero un poco más claro
        cv2.circle(img, (ax, ay), radio, (60, 55, 50), 2)

    # Gradiente cálido (simula iluminación del foco naranja)
    warmth = np.zeros((h, w, 3), dtype=np.float32)
    for y in range(h):
        for x in range(w):
            dist = np.sqrt((x - w * 0.3) ** 2 + (y - h * 0.2) ** 2) / max(w, h)
            intensity = max(0, 0.3 - dist * 0.4) * luz
            warmth[y, x] = [0, intensity * 30, intensity * 60]  # Tono naranja/amarillo
    img = np.clip(img.astype(np.float32) + warmth, 0, 255).astype(np.uint8)

    return img


def generar_huevo_realista(luz=1.0):
    """Genera huevo sobre bandeja celeste con iluminación cálida."""
    img = fondo_bandeja_real(IMG_SIZE[0], IMG_SIZE[1], luz)
    cx = IMG_SIZE[0] // 2 + random.randint(-20, 20)
    cy = IMG_SIZE[1] // 2 + random.randint(-20, 20)

    # Huevos reales son más grandes en la vista de cámara
    eje_mayor = random.randint(55, 80)
    eje_menor = int(eje_mayor * random.uniform(0.65, 0.80))
    angulo = random.randint(0, 180)

    # Colores realistas de huevo (marrón claro a oscuro, como en la foto)
    tonos_realistas = [
        (160, 185, 210),  # Marrón claro / beige
        (140, 170, 200),  # Marrón medio
        (130, 160, 195),  # Marrón pardo
        (120, 155, 190),  # Marrón oscuro
        (150, 180, 215),  # Crema cálido
        (135, 165, 205),  # Beige rosado
        (145, 175, 200),  # Cáscara natural
        (155, 185, 220),  # Blanco cálido
    ]
    color_base = random.choice(tonos_realistas)
    color = tuple(min(255, int(c * luz)) for c in color_base)

    # Sombra debajo del huevo
    sx, sy = cx + random.randint(3, 8), cy + random.randint(5, 12)
    shadow_color = (40, 35, 30)
    cv2.ellipse(img, (sx, sy), (eje_mayor + 5, eje_menor + 5), angulo, 0, 360, shadow_color, -1)
    img = cv2.GaussianBlur(img, (7, 7), 3)

    # Huevo principal
    cv2.ellipse(img, (cx, cy), (eje_mayor, eje_menor), angulo, 0, 360, color, -1)

    # Gradiente de iluminación sobre el huevo (reflejo del foco)
    brillo_offset_x = int(eje_mayor * random.uniform(-0.3, -0.1))
    brillo_offset_y = int(eje_menor * random.uniform(-0.3, -0.1))
    brillo_color = tuple(min(255, int(c * 1.3 * luz)) for c in color_base)
    cv2.ellipse(
        img,
        (cx + brillo_offset_x, cy + brillo_offset_y),
        (int(eje_mayor * 0.45), int(eje_menor * 0.4)),
        angulo + random.randint(-15, 15),
        0, 360,
        brillo_color,
        -1,
    )

    # Textura sutil de cáscara
    mask = np.zeros((IMG_SIZE[1], IMG_SIZE[0]), dtype=np.uint8)
    cv2.ellipse(mask, (cx, cy), (eje_mayor, eje_menor), angulo, 0, 360, 255, -1)
    noise = np.random.normal(0, 4, (IMG_SIZE[1], IMG_SIZE[0], 3)).astype(np.int16)
    noise_masked = np.where(mask[:, :, None] > 0, noise, 0)
    img = np.clip(img.astype(np.int16) + noise_masked, 0, 255).astype(np.uint8)

    # Suavizado final
    img = cv2.GaussianBlur(img, (3, 3), 0.8)
    return img


def generar_objeto_realista(luz=1.0):
    """Genera objetos extraños sobre bandeja celeste."""
    img = fondo_bandeja_real(IMG_SIZE[0], IMG_SIZE[1], luz)
    cx = IMG_SIZE[0] // 2 + random.randint(-25, 25)
    cy = IMG_SIZE[1] // 2 + random.randint(-25, 25)

    tipo = random.choice([
        "cable_rojo", "destornillador", "moneda", "plastico",
        "llave", "tornillo", "clip", "lapicero"
    ])

    if tipo == "cable_rojo":
        # Cables como los que se ven en la maqueta
        for _ in range(random.randint(2, 4)):
            pts = []
            x, y = random.randint(10, 200), random.randint(10, 200)
            for _ in range(random.randint(4, 8)):
                x += random.randint(-30, 30)
                y += random.randint(-30, 30)
                pts.append([max(5, min(219, x)), max(5, min(219, y))])
            pts = np.array(pts, np.int32)
            color = random.choice([(30, 30, 200), (200, 30, 30), (30, 30, 30), (0, 180, 255)])
            cv2.polylines(img, [pts], False, color, random.randint(3, 6))

    elif tipo == "destornillador":
        angulo_rad = np.radians(random.randint(0, 360))
        length = random.randint(60, 100)
        x_end = int(cx + length * np.cos(angulo_rad))
        y_end = int(cy + length * np.sin(angulo_rad))
        cv2.line(img, (cx, cy), (x_end, y_end), (140, 140, 160), 8)
        cv2.line(img, (cx, cy), (x_end, y_end), (100, 100, 110), 4)
        # Mango
        x_m = int(cx - 25 * np.cos(angulo_rad))
        y_m = int(cy - 25 * np.sin(angulo_rad))
        cv2.circle(img, (x_m, y_m), 12, (30, 30, 200), -1)

    elif tipo == "moneda":
        radio = random.randint(15, 25)
        cv2.circle(img, (cx, cy), radio, (160, 170, 190), -1)
        cv2.circle(img, (cx, cy), radio, (100, 110, 120), 2)
        cv2.circle(img, (cx, cy), radio - 5, (180, 190, 200), 1)

    elif tipo == "plastico":
        w_b = random.randint(35, 70)
        h_b = random.randint(35, 70)
        color = random.choice([(200, 50, 50), (50, 200, 50), (50, 50, 200), (200, 200, 50)])
        cv2.rectangle(img, (cx - w_b // 2, cy - h_b // 2), (cx + w_b // 2, cy + h_b // 2), color, -1)

    elif tipo == "llave":
        cv2.circle(img, (cx, cy), 20, (150, 150, 160), -1)
        cv2.circle(img, (cx, cy), 8, (40, 40, 45), -1)
        ang = np.radians(random.randint(0, 360))
        x2 = int(cx + 65 * np.cos(ang))
        y2 = int(cy + 65 * np.sin(ang))
        cv2.line(img, (cx, cy), (x2, y2), (150, 150, 160), 10)

    elif tipo == "tornillo":
        ang = random.randint(0, 180)
        cv2.ellipse(img, (cx, cy), (8, 40), ang, 0, 360, (130, 130, 140), -1)
        cv2.circle(img, (cx, cy), 12, (110, 110, 120), -1)

    elif tipo == "clip":
        pts = np.array([
            [cx - 15, cy - 25], [cx + 15, cy - 25],
            [cx + 15, cy + 5], [cx - 10, cy + 5],
            [cx - 10, cy - 15], [cx + 10, cy - 15],
            [cx + 10, cy + 25], [cx - 15, cy + 25],
        ], np.int32)
        cv2.polylines(img, [pts], False, (180, 180, 190), 3)

    else:  # lapicero
        ang = np.radians(random.randint(0, 360))
        length = random.randint(70, 100)
        x2 = int(cx + length * np.cos(ang))
        y2 = int(cy + length * np.sin(ang))
        color = random.choice([(200, 30, 30), (30, 30, 200), (30, 30, 30)])
        cv2.line(img, (cx, cy), (x2, y2), color, 7)
        # Punta
        x_tip = int(x2 + 10 * np.cos(ang))
        y_tip = int(y2 + 10 * np.sin(ang))
        cv2.line(img, (x2, y2), (x_tip, y_tip), (180, 180, 180), 4)

    return img


def generar_vacio_realista(luz=1.0):
    """Bandeja vacía celeste con agujeros visibles."""
    return fondo_bandeja_real(IMG_SIZE[0], IMG_SIZE[1], luz)


def main():
    print("=" * 60)
    print("  SmartEgg - Generando Dataset Realista")
    print("=" * 60)

    for c in CLASSES:
        os.makedirs(os.path.join(DATASET_DIR, c), exist_ok=True)

    niveles_luz = [0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.35, 1.5]

    for c in CLASSES:
        target_dir = os.path.join(DATASET_DIR, c)
        print(f"Generando {SAMPLES_PER_CLASS} muestras realistas para '{c}'...")
        for i in range(SAMPLES_PER_CLASS):
            luz = random.choice(niveles_luz)
            if c == "huevo":
                img = generar_huevo_realista(luz)
            elif c == "objeto_extrano":
                img = generar_objeto_realista(luz)
            else:
                img = generar_vacio_realista(luz)

            filename = f"real_syn_{c}_{i:03d}.jpg"
            cv2.imwrite(os.path.join(target_dir, filename), img)

    print("\nDataset realista generado:")
    for c in CLASSES:
        target_dir = os.path.join(DATASET_DIR, c)
        total = len([f for f in os.listdir(target_dir) if f.endswith((".jpg", ".png"))])
        print(f"  - {c}: {total} imágenes totales")


if __name__ == "__main__":
    main()
