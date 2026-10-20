"""Simulador integral de telemetria MQTT Fase 3 para pruebas de Grafana y Alertas.

Permite a Integrante 5:
1. Probar en vivo todos los paneles de Grafana (Vision, ML, Energia y Seguridad).
2. Generar el estado Normal (OK/Verde) para la captura de pantalla.
3. Provocar el disparo de Alerta (Firing/Rojo) para la captura de pantalla.
4. Funciona tanto localmente (localhost:1883) como contra la nube (AWS/Azure IP:1883).

Uso:
  python infra/grafana/simular_telemetria_fase3.py
  python infra/grafana/simular_telemetria_fase3.py --mqtt-host 54.x.x.x --modo bloqueo
"""

import argparse
import json
import os
import random
import sys
import time
from datetime import datetime, timezone


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def main():
    parser = argparse.ArgumentParser(description="Simulador de telemetria MQTT Fase 3 para Grafana")
    parser.add_argument("--mqtt-host", type=str, default=os.getenv("MQTT_HOST", "localhost"), help="Broker MQTT")
    parser.add_argument("--mqtt-port", type=int, default=int(os.getenv("MQTT_PORT", 1883)), help="Puerto MQTT")
    parser.add_argument("--node-id", type=str, default=os.getenv("NODE_ID", "SE-01"), help="ID del nodo")
    parser.add_argument(
        "--modo",
        type=str,
        default="interactivo",
        choices=["interactivo", "normal", "bloqueo", "anomalia", "sobreconsumo"],
        help="Modo de simulacion",
    )
    args = parser.parse_args()

    try:
        import paho.mqtt.client as mqtt
    except ImportError:
        print("Instalando paho-mqtt...")
        os.system("pip install paho-mqtt")
        import paho.mqtt.client as mqtt

    client = mqtt.Client(
        callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
        client_id=f"simulador-grafana-{args.node_id.lower()}",
    )

    print("\n" + "=" * 70)
    print("  SmartEgg Fase 3 - Simulador de Telemetria para Grafana & Alertas")
    print("=" * 70)
    print(f"Broker:  {args.mqtt_host}:{args.mqtt_port}")
    print(f"Nodo:    {args.node_id}")
    print(f"Modo:    {args.modo}")
    print("=" * 70)

    try:
        client.connect(args.mqtt_host, args.mqtt_port, 60)
        client.loop_start()
        print("Conectado exitosamente al broker Mosquitto.\n")
    except Exception as exc:
        print(f"Error conectando al broker ({exc}). Verifica que Mosquitto este corriendo.")
        sys.exit(1)

    node_id = args.node_id
    t_status = f"smartegg/{node_id}/status"
    t_temp = f"smartegg/{node_id}/sensores/temperatura"
    t_hum = f"smartegg/{node_id}/sensores/humedad"
    t_act = f"smartegg/{node_id}/actuadores/estado"
    t_vision = f"smartegg/{node_id}/vision/estado"
    t_bloqueo = f"smartegg/{node_id}/control/bloqueo"
    t_ml = f"smartegg/{node_id}/ml/anomalia"
    t_energia = f"smartegg/{node_id}/energia/consumo"
    t_alarma = f"smartegg/{node_id}/alarmas/critica"

    # Estados base
    estado = {
        "bloqueado": False,
        "clase_vision": "huevo",
        "confianza_vision": 0.985,
        "anomalia_ml": False,
        "score_ml": -0.0125,
        "foco": "ON",
        "fan": "OFF",
        "temp": 37.5,
        "hum": 58.0,
        "rotacion": 45.0,
        "kwh_acum": 0.1250,
        "potencia_extra": 0.0,
    }

    if args.modo == "bloqueo":
        estado["bloqueado"] = True
        estado["clase_vision"] = "objeto_extrano"
        estado["confianza_vision"] = 0.991
        estado["foco"] = "OFF"
        estado["fan"] = "OFF"
    elif args.modo == "anomalia":
        estado["anomalia_ml"] = True
        estado["score_ml"] = 0.2840
        estado["temp"] = 39.2
    elif args.modo == "sobreconsumo":
        estado["potencia_extra"] = 45.0  # Sobrepasa los 80W

    if args.modo == "interactivo":
        print("Controles interactivos (pulsa una tecla en la consola si ejecutas interactivo):")
        print("  [1] Modo Normal (Huevo detectado, ML normal, Potencia ~63W, Sistema Operativo)")
        print("  [2] DISPARO DE BLOQUEO (Objeto extraño, Bloqueo ON, Alarma Critica -> FIRING)")
        print("  [3] DISPARO ANOMALIA ML (Temp alta, Score alto, Alerta ML)")
        print("  [4] DISPARO SOBRECONSUMO (Potencia > 100W -> Alerta Sobreconsumo)")
        print("  [Ctrl+C] Salir\n")

    step = 0
    try:
        while True:
            step += 1
            ts = now_iso()

            # Variaciones termicas suaves en operacion normal
            if not estado["bloqueado"] and not estado["anomalia_ml"]:
                estado["temp"] = round(37.4 + random.uniform(-0.3, 0.4), 1)
                estado["hum"] = round(57.0 + random.uniform(-2.0, 3.0), 1)
                estado["score_ml"] = round(-0.0150 + random.uniform(-0.005, 0.005), 4)

            # Calculo justificado de potencia
            # Foco: 60W, Fan: 5W, Motor: 2.5W, Base: 3W
            foco_w = 60.0 if estado["foco"] == "ON" else 0.0
            fan_w = 5.0 if estado["fan"] == "ON" else 0.0
            motor_w = 2.5 if (step % 10 == 0) else 0.5
            base_w = 3.0
            potencia_total = round(base_w + foco_w + fan_w + motor_w + estado["potencia_extra"], 1)

            # Acumulacion de kWh (2 segundos de intervalo)
            delta_kwh = (potencia_total * 2.0 / 3600.0) / 1000.0
            estado["kwh_acum"] = round(estado["kwh_acum"] + delta_kwh, 5)

            # 1. Publicar estado del nodo
            client.publish(
                t_status,
                json.dumps({"nodo_id": node_id, "estado": "online", "valor": 1, "timestamp": ts}),
                qos=1,
                retain=True,
            )

            # 2. Publicar Sensores
            client.publish(t_temp, json.dumps({"nodo_id": node_id, "valor": estado["temp"], "unidad": "°C", "timestamp": ts}))
            client.publish(t_hum, json.dumps({"nodo_id": node_id, "valor": estado["hum"], "unidad": "%", "timestamp": ts}))

            # 3. Publicar Actuadores
            client.publish(
                t_act,
                json.dumps({
                    "nodo_id": node_id,
                    "foco": estado["foco"],
                    "ventilador": estado["fan"],
                    "rotacion_grados": estado["rotacion"],
                    "espacios_libres": 0 if estado["clase_vision"] == "huevo" else 3,
                    "timestamp": ts,
                }),
                qos=1,
                retain=True,
            )

            # 4. Publicar Vision Computacional
            client.publish(
                t_vision,
                json.dumps({
                    "nodo_id": node_id,
                    "clase": estado["clase_vision"],
                    "confianza": estado["confianza_vision"],
                    "ciclo_activo": True,
                    "bloqueado": estado["bloqueado"],
                    "motivo": "objeto_extrano_detectado" if estado["bloqueado"] else "operacion_normal",
                    "timestamp": ts,
                }),
                qos=0,
            )

            # 5. Publicar Control de Bloqueo
            client.publish(
                t_bloqueo,
                json.dumps({
                    "nodo_id": node_id,
                    "bloquear": estado["bloqueado"],
                    "bloqueado": estado["bloqueado"],
                    "motivo": "Objeto extraño en incubadora" if estado["bloqueado"] else "desbloqueado",
                    "timestamp": ts,
                }),
                qos=1,
                retain=True,
            )

            # 6. Publicar Machine Learning
            client.publish(
                t_ml,
                json.dumps({
                    "nodo_id": node_id,
                    "anomalia": estado["anomalia_ml"],
                    "valor": int(estado["anomalia_ml"]),
                    "score": estado["score_ml"],
                    "umbral": -0.0052,
                    "temperatura": estado["temp"],
                    "humedad": estado["hum"],
                    "timestamp": ts,
                }),
                qos=1,
                retain=True,
            )

            # 7. Publicar Consumo Electrico
            client.publish(
                t_energia,
                json.dumps({
                    "nodo_id": node_id,
                    "watts": potencia_total,
                    "potencia": potencia_total,
                    "kwh": estado["kwh_acum"],
                    "voltaje": 120.0,
                    "corriente": round(potencia_total / 120.0, 3),
                    "limite_watts": 80.0,
                    "alerta_consumo": potencia_total > 80.0,
                    "timestamp": ts,
                }),
                qos=0,
            )

            # 8. Alarma Critica (si aplica)
            if estado["bloqueado"]:
                client.publish(
                    t_alarma,
                    json.dumps({
                        "id": "ALM-BLOQUEO-SIM",
                        "nodo_id": node_id,
                        "tipo": "BLOQUEO_SEGURIDAD_VISION",
                        "severidad": "CRITICA",
                        "mensaje": "SISTEMA BLOQUEADO: Objeto no autorizado detectado en cabina",
                        "activa": True,
                        "inicio_at": ts,
                        "timestamp": ts,
                    }),
                    qos=1,
                    retain=True,
                )
            else:
                client.publish(
                    t_alarma,
                    json.dumps({
                        "id": "ALM-BLOQUEO-SIM",
                        "nodo_id": node_id,
                        "tipo": "BLOQUEO_SEGURIDAD_VISION",
                        "severidad": "NORMAL",
                        "mensaje": "Sistema en operacion normal.",
                        "activa": False,
                        "timestamp": ts,
                    }),
                    qos=1,
                    retain=True,
                )

            sys.stdout.write(
                f"\r[{step:03d}] Temp={estado['temp']:.1f}°C | Hum={estado['hum']:.1f}% | "
                f"Vis={estado['clase_vision']:14s} | Bloq={str(estado['bloqueado']):5s} | "
                f"ML_Anom={str(estado['anomalia_ml']):5s} | Pot={potencia_total:5.1f}W ({estado['kwh_acum']:.4f} kWh)"
            )
            sys.stdout.flush()

            time.sleep(2.0)

    except KeyboardInterrupt:
        print("\n\nSimulador detenido por el usuario.")
    finally:
        client.loop_stop()
        client.disconnect()


if __name__ == "__main__":
    main()

