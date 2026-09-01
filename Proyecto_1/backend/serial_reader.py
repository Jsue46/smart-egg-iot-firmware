import threading
import serial
import json
import time
import random
import serial.tools.list_ports
from database import get_connection

def encontrar_puerto():
    puertos = list(serial.tools.list_ports.comports())
    if not puertos:
        return None
        
    for puerto in puertos:
        # Busca descriptores comunes de Arduino
        if any(keyword in puerto.description.upper() for keyword in ["ARDUINO", "CH340", "FTDI", "USB SERIAL", "CP210"]):
            print(f"Arduino detectado en {puerto.device}")
            return puerto.device
            
    # Si hay puertos pero no coinciden con los nombres típicos, usa el último (común en Windows)
    print(f"Puerto genérico detectado ({puertos[-1].device} - {puertos[-1].description}), probando conexión...")
    return puertos[-1].device

def guardar_lectura(data):
    conn = get_connection()
    cursor = conn.cursor()
    
    alarma = 1 if data.get("alarma") else 0
    
    cursor.execute("""
        INSERT INTO lecturas (temperatura, humedad, espacios_libres, foco, fan, alarma)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (
        data["temperatura"],
        data["humedad"],
        data.get("espacios_libres", 0),
        data.get("foco", "OFF"),
        data.get("fan", "OFF"),
        alarma
    ))

    # Si hay alarma, se registra en la tabla de alarmas
    if alarma:
        temp = data["temperatura"]
        hum = data["humedad"]
        if temp >= 38.5:
            tipo = "TEMPERATURA"
            desc = f"Temperatura crítica: {temp}°C"
        elif hum < 50.0:
            tipo = "HUMEDAD"
            desc = f"Humedad baja: {hum}%"
        elif hum > 65.0:
            tipo = "HUMEDAD"
            desc = f"Humedad alta: {hum}%"
        else:
            tipo = "SISTEMA"
            desc = f"Alarma del sistema — T:{temp}°C H:{hum}%"
        
        cursor.execute("""
            INSERT INTO alarmas (tipo, descripcion)
            VALUES (?, ?)
        """, (tipo, desc))

    conn.commit()
    conn.close()

# Esta variable es la que lee el endpoint para dar el dato más reciente
ultimo_dato = {}

def leer_serial():
    global ultimo_dato
    while True:
        try:
            puerto = encontrar_puerto()
            if puerto is None:
                raise Exception("No se encontró ningún Arduino conectado")
            with serial.Serial(puerto, 9600, timeout=2) as ser:
                print(f"Serial conectado en {puerto}")
                while True:
                    linea = ser.readline().decode("utf-8").strip()
                    if linea.startswith("{"):
                        data = json.loads(linea)
                        ultimo_dato = data
                        guardar_lectura(data)
        except Exception as e:
            # Si no hay Arduino, genera datos simulados e intenta reconectar
            print(f"Arduino no encontrado ({e}). Reintentando en 2s (simulando dato temporal)...")
            data = {
                "temperatura": round(random.uniform(36.5, 39.0), 1),
                "humedad": round(random.uniform(48.0, 67.0), 1),
                "espacios_libres": random.randint(0, 3),
                "foco": "ON",
                "fan": "OFF",
                "alarma": random.random() < 0.2
            }
            ultimo_dato = data
            guardar_lectura(data)
            time.sleep(2)
                
def iniciar_hilo_serial():
    hilo = threading.Thread(target=leer_serial, daemon=True)
    hilo.start()