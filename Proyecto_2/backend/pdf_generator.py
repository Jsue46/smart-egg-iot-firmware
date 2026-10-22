"""Generate the operational SmartEgg PDF report from the active database."""

from __future__ import annotations

import io
import os
from datetime import datetime

from reportlab.lib import colors  # type: ignore
from reportlab.lib.pagesizes import letter  # type: ignore
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet  # type: ignore
from reportlab.lib.units import inch  # type: ignore
from reportlab.platypus import (  # type: ignore
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from database import execute, get_connection, is_postgres


def _value(row, key: str, index: int = 0):
    try:
        return row[key]
    except (KeyError, TypeError, IndexError):
        return row[index]


def _text(value) -> str:
    return "N/D" if value is None or value == "" else str(value)


def generar_pdf() -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter)
    styles = getSampleStyleSheet()
    elementos = []

    titulo_style = ParagraphStyle(
        "titulo",
        parent=styles["Heading1"],
        textColor=colors.HexColor("#255F53"),
        fontSize=18,
    )
    elementos.append(Paragraph("SmartEgg — Reporte de Incubadora", titulo_style))
    elementos.append(Paragraph("Facultad de Ingeniería, USAC", styles["Normal"]))
    elementos.append(
        Paragraph(f"Generado: {datetime.now().strftime('%d/%m/%Y %H:%M')}", styles["Normal"])
    )
    elementos.append(Spacer(1, 0.3 * inch))

    node_id = os.getenv("NODE_ID", "SE-01")
    conn = get_connection()
    try:
        date_filter = (
            "timestamp::date = CURRENT_DATE"
            if is_postgres()
            else "DATE(timestamp) = DATE('now')"
        )
        row = execute(
            conn,
            f"""
            SELECT MAX(temperatura), MIN(temperatura), AVG(humedad)
            FROM lecturas
            WHERE nodo_id = ? AND {date_filter}
            """,
            (node_id,),
        ).fetchone()
        temp_max, temp_min, hum_avg = (_value(row, "max", 0), _value(row, "min", 1), _value(row, "avg", 2))

        elementos.append(Paragraph("Resumen del día", styles["Heading2"]))
        resumen = [
            ["Temperatura máxima", f"{float(temp_max):.1f}°C" if temp_max is not None else "N/D"],
            ["Temperatura mínima", f"{float(temp_min):.1f}°C" if temp_min is not None else "N/D"],
            ["Humedad promedio", f"{float(hum_avg):.1f}%" if hum_avg is not None else "N/D"],
        ]
        tabla_resumen = Table(resumen, colWidths=[3 * inch, 2 * inch])
        tabla_resumen.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#255F53")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                    ("FONTSIZE", (0, 0), (-1, -1), 11),
                ]
            )
        )
        elementos.append(tabla_resumen)
        elementos.append(Spacer(1, 0.2 * inch))

        lotes = execute(
            conn,
            """
            SELECT codigo, etiqueta, cantidad, fecha_ingreso
            FROM lotes
            WHERE nodo_id = ?
            ORDER BY fecha_ingreso DESC
            """,
            (node_id,),
        ).fetchall()

        elementos.append(Paragraph("Lotes registrados", styles["Heading2"]))
        if lotes:
            data_lotes = [["Lote", "Etiqueta", "Cantidad", "Fecha ingreso"]]
            for lote in lotes:
                data_lotes.append(
                    [
                        _text(_value(lote, "codigo", 0)),
                        _text(_value(lote, "etiqueta", 1)),
                        _text(_value(lote, "cantidad", 2)),
                        _text(_value(lote, "fecha_ingreso", 3)),
                    ]
                )
            tabla_lotes = Table(
                data_lotes, colWidths=[1.3 * inch, 1.7 * inch, 1.0 * inch, 2.2 * inch]
            )
            tabla_lotes.setStyle(
                TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#EFB216")),
                        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                        ("FONTSIZE", (0, 0), (-1, -1), 10),
                    ]
                )
            )
            elementos.append(tabla_lotes)
        else:
            elementos.append(Paragraph("No hay lotes registrados.", styles["Normal"]))

        elementos.append(Spacer(1, 0.2 * inch))

        alarmas = execute(
            conn,
            """
            SELECT COALESCE(NULLIF(mensaje, ''), descripcion), timestamp
            FROM alarmas
            WHERE nodo_id = ?
            ORDER BY timestamp DESC
            LIMIT 20
            """,
            (node_id,),
        ).fetchall()

        elementos.append(Paragraph("Registro de alarmas", styles["Heading2"]))
        if alarmas:
            data_alarmas = [["Descripción", "Timestamp"]]
            for alarma in alarmas:
                data_alarmas.append(
                    [_text(_value(alarma, "coalesce", 0)), _text(_value(alarma, "timestamp", 1))]
                )
            tabla_alarmas = Table(data_alarmas, colWidths=[4 * inch, 2.5 * inch])
            tabla_alarmas.setStyle(
                TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#D74430")),
                        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                        ("FONTSIZE", (0, 0), (-1, -1), 10),
                    ]
                )
            )
            elementos.append(tabla_alarmas)
        else:
            elementos.append(Paragraph("No se registraron alarmas.", styles["Normal"]))
    finally:
        conn.close()

    doc.build(elementos)
    buffer.seek(0)
    return buffer.read()
