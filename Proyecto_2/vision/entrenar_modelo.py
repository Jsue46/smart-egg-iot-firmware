"""Entrenamiento y evaluacion formal del modelo de vision para SmartEgg.

Extrae caracteristicas visuales hibridas usando OpenCV:
1. Histograma de color en espacio HSV (discrimina cascaron, metal, colores artificiales, fondo)
2. Momentos de Hu y compacidad morfologica (discrimina ovalo suave vs bordes agudos/herramientas)
3. Densidad y estadisticas de gradiente/bordes (Canny / Sobel)

Entrena un clasificador con scikit-learn (RandomForestClassifier).
Genera metricas exigidas en la rubrica:
- Matriz de confusion
- Precision, Recall, F1-Score
- Grafica visual de metricas exportada como 'metricas_modelo.png'
- Serializa el modelo entrenado como 'modelo_vision.joblib'
"""

import os
import cv2
import numpy as np
import joblib
import matplotlib.pyplot as plt
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import classification_report, confusion_matrix, ConfusionMatrixDisplay
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATASET_DIR = os.path.join(BASE_DIR, "dataset")
MODEL_PATH = os.path.join(BASE_DIR, "modelo_vision.joblib")
METRICS_IMG_PATH = os.path.join(BASE_DIR, "metricas_modelo.png")

CLASSES = ["huevo", "objeto_extrano", "vacio"]


def extraer_caracteristicas(img):
    """Extrae un vector representativo de caracteristicas visuales con OpenCV."""
    if img is None:
        return None

    # Redimensionar para consistencia
    resized = cv2.resize(img, (128, 128))

    # 1. Histograma de Color en HSV
    hsv = cv2.cvtColor(resized, cv2.COLOR_BGR2HSV)
    hist_h = cv2.calcHist([hsv], [0], None, [12], [0, 180])
    hist_s = cv2.calcHist([hsv], [1], None, [8], [0, 256])
    hist_v = cv2.calcHist([hsv], [2], None, [8], [0, 256])
    cv2.normalize(hist_h, hist_h)
    cv2.normalize(hist_s, hist_s)
    cv2.normalize(hist_v, hist_v)
    feat_color = np.concatenate([hist_h.flatten(), hist_s.flatten(), hist_v.flatten()])

    # 2. Estadisticas de brillo y color medio y desviacion
    mean_val, std_val = cv2.meanStdDev(hsv)
    feat_stats = np.concatenate([mean_val.flatten(), std_val.flatten()])

    # 3. Deteccion de bordes y textura (Canny y Gradiente Sobel)
    gray = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 50, 150)
    edge_density = np.sum(edges > 0) / float(edges.size)

    sobelx = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3)
    sobely = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)
    sobel_mag = np.mean(np.sqrt(sobelx**2 + sobely**2))

    # 4. Morfologia de contorno principal y Momentos de Hu
    # Umbralizado adaptativo u Otsu
    _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    area_ratio = 0.0
    circularity = 0.0
    solidity = 0.0
    hu_feats = np.zeros(7)

    if contours:
        c_max = max(contours, key=cv2.contourArea)
        area = cv2.contourArea(c_max)
        perimeter = cv2.arcLength(c_max, True)
        hull = cv2.convexHull(c_max)
        hull_area = cv2.contourArea(hull)

        area_ratio = area / float(resized.shape[0] * resized.shape[1])
        if perimeter > 0:
            circularity = 4 * np.pi * (area / (perimeter * perimeter))
        if hull_area > 0:
            solidity = area / float(hull_area)

        moments = cv2.moments(c_max)
        hu = cv2.HuMoments(moments).flatten()
        # Escala logaritmica para momentos de Hu
        for i in range(7):
            hu_feats[i] = -1 * np.sign(hu[i]) * np.log10(abs(hu[i])) if hu[i] != 0 else 0

    feat_morph = np.array([edge_density, sobel_mag, area_ratio, circularity, solidity])
    return np.concatenate([feat_color, feat_stats, feat_morph, hu_feats])


def cargar_dataset():
    X = []
    y = []
    detalles = {}

    for label_idx, cls_name in enumerate(CLASSES):
        dir_cls = os.path.join(DATASET_DIR, cls_name)
        if not os.path.exists(dir_cls):
            continue

        archivos = [f for f in os.listdir(dir_cls) if f.lower().endswith((".jpg", ".png", ".jpeg"))]
        detalles[cls_name] = len(archivos)

        for arch in archivos:
            img_path = os.path.join(dir_cls, arch)
            img = cv2.imread(img_path)
            if img is None:
                continue

            feats = extraer_caracteristicas(img)
            if feats is not None:
                X.append(feats)
                y.append(label_idx)

    return np.array(X), np.array(y), detalles


def entrenar_modelo_fn():
    print("=" * 65)
    print("  SmartEgg Vision - Entrenamiento y Evaluacion de Modelo")
    print("=" * 65)

    X, y, conteo = cargar_dataset()

    print(f"Muestras cargadas por clase: {conteo}")
    print(f"Total muestras: {len(X)} | Dimension del vector de caracteristicas: {X.shape[1] if len(X)>0 else 0}")

    if len(X) < 15:
        print("ERROR: No hay suficientes muestras para entrenar.")
        print("Ejecuta primero 'python vision/generar_dataset_inicial.py' o toma fotos con 'capturar_dataset.py'.")
        return None, 0.0

    # Split estratificado para entrenamiento y evaluacion
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.25, random_state=42, stratify=y
    )

    # Entrenar Random Forest optimizado
    clf = RandomForestClassifier(
        n_estimators=100,
        max_depth=12,
        random_state=42,
        class_weight="balanced"
    )
    clf.fit(X_train, y_train)

    # Validacion cruzada (5-fold)
    cv_scores = cross_val_score(clf, X, y, cv=5)
    acc = float(cv_scores.mean())
    print(f"\nExactitud promedio (Validacion Cruzada 5-Fold): {acc * 100:.2f}% (+/- {cv_scores.std()*100:.2f}%)")

    # Evaluacion en conjunto de prueba
    y_pred = clf.predict(X_test)
    report = classification_report(y_test, y_pred, target_names=CLASSES, output_dict=False)
    print("\nReporte de Clasificacion:")
    print("-" * 55)
    print(report)

    # Guardar modelo con metadatos
    datos_empaquetados = {
        "model": clf,
        "classes": CLASSES,
        "train_samples": len(X),
        "cv_accuracy_mean": acc,
        "created_at": datetime.now().isoformat()
    }
    joblib.dump(datos_empaquetados, MODEL_PATH)
    print(f"Modelo guardado exitosamente en: {MODEL_PATH}")

    # Generar y guardar grafica de matriz de confusion
    try:
        fig, ax = plt.subplots(figsize=(6, 5))
        cm = confusion_matrix(y_test, y_pred)
        disp = ConfusionMatrixDisplay(confusion_matrix=cm, display_labels=CLASSES)
        disp.plot(cmap="Blues", ax=ax, values_format="d")
        plt.title(f"Matriz de Confusion - SmartEgg Vision (Exactitud: {acc*100:.1f}%)")
        plt.tight_layout()
        plt.savefig(METRICS_IMG_PATH, dpi=150)
        plt.close()
        print(f"Grafica de evaluacion guardada en: {METRICS_IMG_PATH}")
    except Exception as e:
        print(f"No se pudo generar la grafica: {e}")

    print("\nProceso de entrenamiento completado al 100%.")
    return clf, acc


def main():
    entrenar_modelo_fn()


if __name__ == "__main__":
    main()
