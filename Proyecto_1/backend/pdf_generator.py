from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from database import get_connection
from datetime import datetime
import io

def generar_pdf():
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter)
    styles = getSampleStyleSheet()
    elementos = []

    # ── Encabezado ──
    titulo_style = ParagraphStyle(
        "titulo", parent=styles["Heading1"],
        textColor=colors.HexColor("#255F53"),
        fontSize=18
    )
    elementos.append(Paragraph("SmartEgg — Reporte de Incubadora", titulo_style))
    elementos.append(Paragraph("Facultad de Ingeniería, USAC", styles["Normal"]))
    elementos.append(Paragraph(f"Generado: {datetime.now().strftime('%d/%m/%Y %H:%M')}", styles["Normal"]))
    elementos.append(Spacer(1, 0.3 * inch))

    conn = get_connection()
    cursor = conn.cursor()

    # ── Temperatura (max y min) ──
    cursor.execute("""
        SELECT MAX(temperatura), MIN(temperatura), AVG(humedad)
        FROM lecturas
        WHERE DATE(timestamp) = DATE('now')
    """)
    row = cursor.fetchone()
    temp_max, temp_min, hum_avg = row[0], row[1], row[2]

    elementos.append(Paragraph("Resumen del día", styles["Heading2"]))
    resumen = [
        ["Temperatura máxima", f"{temp_max:.1f}°C" if temp_max else "N/D"],
        ["Temperatura mínima", f"{temp_min:.1f}°C" if temp_min else "N/D"],
        ["Humedad promedio",   f"{hum_avg:.1f}%" if hum_avg else "N/D"],
    ]
    tabla_resumen = Table(resumen, colWidths=[3*inch, 2*inch])
    tabla_resumen.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,0), colors.HexColor("#255F53")),
        ("TEXTCOLOR", (0,0), (-1,0), colors.white),
        ("GRID", (0,0), (-1,-1), 0.5, colors.grey),
        ("FONTSIZE", (0,0), (-1,-1), 11),
    ]))
    elementos.append(tabla_resumen)
    elementos.append(Spacer(1, 0.2 * inch))

    # ── Lotes registrados ──
    cursor.execute("SELECT lote, etiqueta, tecnico, fecha_ingreso FROM huevos ORDER BY fecha_ingreso DESC")
    huevos = cursor.fetchall()

    elementos.append(Paragraph("Lotes registrados", styles["Heading2"]))
    if huevos:
        data_lotes = [["Lote", "Etiqueta", "Técnico", "Fecha ingreso"]]
        for h in huevos:
            data_lotes.append([h[0], h[1], h[2], h[3]])
        tabla_lotes = Table(data_lotes, colWidths=[1.2*inch, 1.5*inch, 1.8*inch, 2*inch])
        tabla_lotes.setStyle(TableStyle([
            ("BACKGROUND", (0,0), (-1,0), colors.HexColor("#EFB216")),
            ("GRID", (0,0), (-1,-1), 0.5, colors.grey),
            ("FONTSIZE", (0,0), (-1,-1), 10),
        ]))
        elementos.append(tabla_lotes)
    else:
        elementos.append(Paragraph("No hay lotes registrados.", styles["Normal"]))

    elementos.append(Spacer(1, 0.2 * inch))

    # ── Registro de alarmas ──
    cursor.execute("SELECT descripcion, timestamp FROM alarmas ORDER BY timestamp DESC LIMIT 20")
    alarmas = cursor.fetchall()

    elementos.append(Paragraph("Registro de alarmas", styles["Heading2"]))
    if alarmas:
        data_alarmas = [["Descripción", "Timestamp"]]
        for a in alarmas:
            data_alarmas.append([a[0], a[1]])
        tabla_alarmas = Table(data_alarmas, colWidths=[4*inch, 2.5*inch])
        tabla_alarmas.setStyle(TableStyle([
            ("BACKGROUND", (0,0), (-1,0), colors.HexColor("#D74430")),
            ("TEXTCOLOR", (0,0), (-1,0), colors.white),
            ("GRID", (0,0), (-1,-1), 0.5, colors.grey),
            ("FONTSIZE", (0,0), (-1,-1), 10),
        ]))
        elementos.append(tabla_alarmas)
    else:
        elementos.append(Paragraph("No se registraron alarmas.", styles["Normal"]))

    conn.close()
    doc.build(elementos)
    buffer.seek(0)
    return buffer.read()