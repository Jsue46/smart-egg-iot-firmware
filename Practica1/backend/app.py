from flask import Flask, jsonify, request, send_file # type: ignore
from flask_cors import CORS # type: ignore
from database import init_db, get_connection
from serial_reader import iniciar_hilo_serial, ultimo_dato
from pdf_generator import generar_pdf
import io

app = Flask(__name__)
CORS(app)

# primero inicializar BD y empezar a leer el Arduino
init_db()
iniciar_hilo_serial()

# DATOS EN TIEMPO REAL (el frontend lo llama cada cierto tieempo)

@app.route("/datos", methods=["GET"])
def get_datos():
    if not ultimo_dato:
        # Aún no hay dato en memoria, devolver el más reciente de la BD
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM lecturas ORDER BY timestamp DESC LIMIT 1")
        row = cursor.fetchone()
        conn.close()
        if row:
            return jsonify(dict(row))
        return jsonify({"mensaje": "Sin datos aún"}), 503
    return jsonify(ultimo_dato)


# HISTORIAL DE LECTURAS

@app.route("/historial", methods=["GET"])
def get_historial():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT * FROM lecturas
        ORDER BY timestamp DESC
        LIMIT 100
    """)
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return jsonify(rows)


# REGISTRO DE HUEVOS (ficha de identificación)

@app.route("/huevo", methods=["POST"])
def registrar_huevo():
    data = request.get_json()
    campos = ["lote", "etiqueta", "tecnico"]
    
    for campo in campos:
        if not data.get(campo):
            return jsonify({"error": f"Campo requerido: {campo}"}), 400

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO huevos (lote, etiqueta, tecnico, notas)
        VALUES (?, ?, ?, ?)
    """, (data["lote"], data["etiqueta"], data["tecnico"], data.get("notas", "")))
    conn.commit()
    conn.close()
    return jsonify({"mensaje": "Huevo registrado"}), 201

@app.route("/huevos", methods=["GET"])
def get_huevos():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM huevos ORDER BY fecha_ingreso DESC")
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return jsonify(rows)


# ALARMAS

@app.route("/alarmas", methods=["GET"])
def get_alarmas():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM alarmas ORDER BY timestamp DESC LIMIT 50")
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return jsonify(rows)


# REPORTE PDF (descarga automaticamente)

@app.route("/reporte", methods=["GET"])
def descargar_reporte():
    pdf_bytes = generar_pdf()
    return send_file(
        io.BytesIO(pdf_bytes),
        mimetype="application/pdf",
        as_attachment=True,
        download_name="reporte_smartegg.pdf"
    )

if __name__ == "__main__":
    app.run(debug=True, use_reloader=False, port=5000)