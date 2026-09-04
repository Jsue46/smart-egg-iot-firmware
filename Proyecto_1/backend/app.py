"""SmartEgg REST API and service bootstrap."""

from __future__ import annotations

import io
import logging
import os
from datetime import datetime, timezone

from flask import Flask, jsonify, request, send_file  # type: ignore
from flask_cors import CORS  # type: ignore

import serial_reader
from database import execute, get_connection, init_db
from mqtt_publisher import mqtt_publisher
from pdf_generator import generar_pdf


logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s %(name)s - %(message)s",
)
LOGGER = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": os.getenv("CORS_ORIGINS", "*")}})


def _as_dict(row):
    return dict(row) if row is not None else None


def _node_id() -> str:
    return os.getenv("NODE_ID", "SE-01")


def _startup() -> None:
    init_db()
    mqtt_publisher.start()
    serial_reader.iniciar_hilo_serial()
    LOGGER.info("Backend SmartEgg iniciado para el nodo %s", _node_id())


_startup()


@app.get("/health")
def health():
    db_ok = False
    try:
        conn = get_connection()
        execute(conn, "SELECT 1").fetchone()
        conn.close()
        db_ok = True
    except Exception as exc:  # pragma: no cover - depends on deployment state
        LOGGER.warning("Healthcheck de base de datos falló: %s", exc)

    return jsonify(
        {
            "estado": "ok" if db_ok else "degraded",
            "database": "up" if db_ok else "down",
            "mqtt": "connected" if mqtt_publisher.connected else "reconnecting",
            "serial": "receiving" if serial_reader.get_ultimo_dato() else "waiting",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    ), (200 if db_ok else 503)


@app.get("/datos")
def get_datos():
    dato = serial_reader.get_ultimo_dato()
    if dato:
        return jsonify(dato)

    conn = get_connection()
    try:
        row = execute(
            conn,
            "SELECT * FROM lecturas WHERE nodo_id = ? ORDER BY timestamp DESC LIMIT 1",
            (_node_id(),),
        ).fetchone()
    finally:
        conn.close()

    if row:
        return jsonify(_as_dict(row))
    return jsonify({"mensaje": "Sin datos aún"}), 503


@app.get("/historial")
def get_historial():
    limit = min(max(int(request.args.get("limit", 100)), 1), 1000)
    conn = get_connection()
    try:
        rows = execute(
            conn,
            """
            SELECT * FROM lecturas
            WHERE nodo_id = ?
            ORDER BY timestamp DESC
            LIMIT ?
            """,
            (_node_id(), limit),
        ).fetchall()
    finally:
        conn.close()
    return jsonify([_as_dict(row) for row in rows])


@app.post("/huevo")
def registrar_huevo():
    data = request.get_json(silent=True) or {}
    codigo = data.get("lote") or data.get("codigo")
    etiqueta = data.get("etiqueta")
    tecnico = data.get("tecnico") or data.get("operator") or "Operador 1"
    if not codigo:
        return jsonify({"error": "Campo requerido: lote"}), 400
    if not etiqueta:
        return jsonify({"error": "Campo requerido: etiqueta"}), 400

    try:
        cantidad = max(int(data.get("cantidad", data.get("quantity", 1))), 1)
    except (TypeError, ValueError):
        return jsonify({"error": "cantidad debe ser un entero positivo"}), 400

    fecha_ingreso = data.get("fecha_ingreso") or data.get("entryDate")
    if fecha_ingreso and len(str(fecha_ingreso)) == 10:
        fecha_ingreso = f"{fecha_ingreso}T00:00:00+00:00"

    conn = get_connection()
    try:
        operator_row = execute(
            conn,
            "SELECT id FROM operadores WHERE nombre = ? LIMIT 1",
            (str(tecnico),),
        ).fetchone()
        operator_id = _as_dict(operator_row)["id"] if operator_row else None
        execute(
            conn,
            """
            INSERT INTO lotes (
                nodo_id, operador_id, codigo, etiqueta, cantidad, fecha_ingreso,
                required_temperature, notes
            ) VALUES (?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP), ?, ?)
            """,
            (
                _node_id(),
                operator_id,
                str(codigo),
                str(etiqueta),
                cantidad,
                fecha_ingreso,
                data.get("temperatura_requerida", data.get("requiredTemperature")),
                data.get("notas", data.get("notes", "")),
            ),
        )
        row = execute(
            conn,
            "SELECT id FROM lotes WHERE nodo_id = ? AND codigo = ?",
            (_node_id(), str(codigo)),
        ).fetchone()
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

    return jsonify({"mensaje": "Lote registrado", "id": _as_dict(row)["id"]}), 201


@app.get("/huevos")
def get_huevos():
    conn = get_connection()
    try:
        rows = execute(
            conn,
            """
            SELECT
                l.id,
                l.codigo AS lote,
                l.codigo,
                l.etiqueta,
                l.fecha_ingreso,
                l.cantidad,
                l.required_temperature AS temperatura_requerida,
                l.status,
                l.notes AS notas,
                COALESCE(o.nombre, '') AS tecnico
            FROM lotes l
            LEFT JOIN operadores o ON o.id = l.operador_id
            WHERE l.nodo_id = ?
            ORDER BY l.fecha_ingreso DESC
            """,
            (_node_id(),),
        ).fetchall()
    finally:
        conn.close()
    return jsonify([_as_dict(row) for row in rows])


@app.get("/alarmas")
def get_alarmas():
    conn = get_connection()
    try:
        rows = execute(
            conn,
            """
            SELECT
                id, nodo_id, lote_id, tipo, severidad,
                COALESCE(NULLIF(mensaje, ''), descripcion) AS descripcion,
                activa, inicio_at, resolucion_at, timestamp
            FROM alarmas
            WHERE nodo_id = ?
            ORDER BY timestamp DESC
            LIMIT 50
            """,
            (_node_id(),),
        ).fetchall()
    finally:
        conn.close()
    return jsonify([_as_dict(row) for row in rows])


@app.get("/operadores")
def get_operadores():
    conn = get_connection()
    try:
        rows = execute(
            conn,
            "SELECT id, nombre, edad, genero, rol, username FROM operadores ORDER BY id",
        ).fetchall()
    finally:
        conn.close()
    return jsonify([_as_dict(row) for row in rows])


@app.post("/puerta")
def registrar_acceso_puerta():
    data = request.get_json(silent=True) or {}
    accion = str(data.get("accion", "")).upper()
    if accion not in {"ABRIR", "CERRAR"}:
        return jsonify({"error": "accion debe ser ABRIR o CERRAR"}), 400

    created = None
    conn = get_connection()
    try:
        created = execute(
            conn,
            """
            INSERT INTO accesos_puerta (nodo_id, operador_id, accion, cantidad_huevos)
            VALUES (?, ?, ?, ?)
            RETURNING id, nodo_id, operador_id, accion, cantidad_huevos, timestamp
            """,
            (_node_id(), data.get("operador_id"), accion, data.get("cantidad_huevos")),
        ).fetchone()
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

    event = _as_dict(created) or {
        "id": None,
        "nodo_id": _node_id(),
        "operador_id": data.get("operador_id"),
        "accion": accion,
        "cantidad_huevos": data.get("cantidad_huevos"),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    mqtt_publisher.publish_door_event(
        event_id=event["id"],
        action=event["accion"],
        operator_id=event.get("operador_id"),
        egg_count=event.get("cantidad_huevos"),
        timestamp=event.get("timestamp"),
    )
    return jsonify(
        {
            "mensaje": "Acceso de puerta registrado",
            "id": event["id"],
            "accion": event["accion"],
            "timestamp": str(event["timestamp"]),
        }
    ), 201


@app.get("/accesos-puerta")
def get_accesos_puerta():
    limit = min(max(int(request.args.get("limit", 100)), 1), 1000)
    conn = get_connection()
    try:
        rows = execute(
            conn,
            """
            SELECT a.id, a.nodo_id, a.operador_id, o.nombre AS operador,
                   a.accion, a.cantidad_huevos, a.timestamp
            FROM accesos_puerta a
            LEFT JOIN operadores o ON o.id = a.operador_id
            WHERE a.nodo_id = ?
            ORDER BY a.timestamp DESC
            LIMIT ?
            """,
            (_node_id(), limit),
        ).fetchall()
    finally:
        conn.close()
    return jsonify([_as_dict(row) for row in rows])


@app.get("/reporte")
def descargar_reporte():
    pdf_bytes = generar_pdf()
    return send_file(
        io.BytesIO(pdf_bytes),
        mimetype="application/pdf",
        as_attachment=True,
        download_name="reporte_smartegg.pdf",
    )


if __name__ == "__main__":
    app.run(
        debug=os.getenv("FLASK_DEBUG", "false").lower() == "true",
        use_reloader=False,
        host=os.getenv("API_HOST", "0.0.0.0"),
        port=int(os.getenv("API_PORT", "5000")),
    )
