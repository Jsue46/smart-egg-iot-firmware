#include "DHT.h"
#include <Servo.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>

// --- Definición de Pines ---
#define DHTPIN 2          // Pin de datos del sensor DHT11
#define DHTTYPE DHT11     
#define BUTTON_PIN 3      // Interrupción 1: Botón ON/OFF (Pin 3)
#define INTERRUPT_PIN2 18 // Interrupción 2: Alerta / Test en Pin 18
#define FAN_PIN 6         // MOSFET Ventilador
#define RELAY_PIN 7       // Relé Foco
#define BUZZER_PIN 8      // Alarma Buzzer
#define SERVO_PIN 9       // Servomotor MG996R

// Pines para finales de carrera (Detección de huevos)
const int switchPines[3] = {49, 51, 53}; 
const int TOTAL_ESPACIOS = 3;

// --- Inicialización de Objetos ---
DHT dht(DHTPIN, DHTTYPE);
Servo eggServo;
LiquidCrystal_I2C lcd(0x27, 16, 2);

// --- Parámetros de Control ---
const float TEMP_OBJETIVO = 37.5; 
const float HISTERESIS    = 0.3;  
const float TEMP_FAN_ON  = 38.0; 
const float TEMP_FAN_OFF = 37.8; // Histéresis de apagado
const float TEMP_CRITICA = 38.5; 
const float HUM_MIN      = 50.0; 
const float HUM_MAX      = 65.0;

const int RELE_ON  = LOW;
const int RELE_OFF = HIGH;

// --- Variables Volátiles para Interrupciones Externas ---
volatile bool sistemaEncendido = true;
volatile unsigned long lastDebounceTime1 = 0;
volatile unsigned long lastDebounceTime2 = 0;
volatile bool eventoInterrupcion2 = false;

// --- Variables para Multitarea Asíncrona (millis) ---
unsigned long previousServoTime = 0;
// NOTA: El PDF pide 120000 (2 minutos), pero se bajó a 5000 (5 segundos) para que puedas probar que funciona.
const unsigned long servoInterval = 5000; 
bool servoDerecha = true;

unsigned long previousSensorTime = 0;
const unsigned long sensorInterval = 2000;  // Lectura cada 2 segundos

// --- ISR 1: Interrupción Externa del Botón ON/OFF (Pin 3) ---
void ISR_toggleSistema() {
  unsigned long currentTime = millis();
  if (currentTime - lastDebounceTime1 > 250) { // Antirrebote
    sistemaEncendido = !sistemaEncendido;
    lastDebounceTime1 = currentTime;
  }
}

// --- ISR 2: Interrupción Externa Secundaria (Pin 18) ---
void ISR_eventoSecundario() {
  unsigned long currentTime = millis();
  if (currentTime - lastDebounceTime2 > 250) {
    eventoInterrupcion2 = !eventoInterrupcion2;
    lastDebounceTime2 = currentTime;
  }
}

void setup() {
  Serial.begin(9600);

  // 1. Configuración de Pines
  pinMode(RELAY_PIN, OUTPUT);
  pinMode(FAN_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  pinMode(INTERRUPT_PIN2, INPUT_PULLUP);

  digitalWrite(RELAY_PIN, RELE_OFF);
  digitalWrite(FAN_PIN, LOW);
  digitalWrite(BUZZER_PIN, LOW);

  for (int i = 0; i < TOTAL_ESPACIOS; i++) {
    pinMode(switchPines[i], INPUT_PULLUP);
  }

  // 2. Adjuntar las 2 Interrupciones de Hardware requeridas por la rúbrica
  attachInterrupt(digitalPinToInterrupt(BUTTON_PIN), ISR_toggleSistema, FALLING);
  attachInterrupt(digitalPinToInterrupt(INTERRUPT_PIN2), ISR_eventoSecundario, FALLING);

  // 3. Inicialización de Periféricos
  dht.begin();
  eggServo.attach(SERVO_PIN);
  
  // -- PRUEBA DE HARDWARE: Movimiento forzado al encender --
  eggServo.write(45); 
  delay(1000);
  eggServo.write(135);
  delay(1000);
  // ---------------------------------------------------------
  
  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0);
  lcd.print("SmartEgg loT");
  lcd.setCursor(0, 1);
  lcd.print("USAC - 2S2026");
  delay(1500);
  lcd.clear();
}

void loop() {
  // Modo Standby / Apagado por botón
  if (!sistemaEncendido) {
    digitalWrite(RELAY_PIN, RELE_OFF);
    digitalWrite(FAN_PIN, LOW);
    digitalWrite(BUZZER_PIN, LOW);
    lcd.setCursor(0, 0);
    lcd.print("   SMARTEGG OFF ");
    lcd.setCursor(0, 1);
    lcd.print("  MODO STANDBY  ");
    delay(200);
    return;
  }

  unsigned long currentMillis = millis();

  // -------------------------------------------------------------
  // TAREA 1: ROTACIÓN PERIÓDICA DEL SERVO (Cada 2 MINUTOS)
  // -------------------------------------------------------------
  if (currentMillis - previousServoTime >= servoInterval) {
    previousServoTime = currentMillis;

    if (servoDerecha) {
      eggServo.write(45);  // -45 grados
    } else {
      eggServo.write(135); // +45 grados
    }
    servoDerecha = !servoDerecha;
  }

  // -------------------------------------------------------------
  // TAREA 2: SENSORES, CONTROL DE POTENCIA Y LCD (Cada 2 segundos)
  // -------------------------------------------------------------
  if (currentMillis - previousSensorTime >= sensorInterval) {
    previousSensorTime = currentMillis;

    float humedad = dht.readHumidity();
    float temperatura = dht.readTemperature();

    if (isnan(humedad) || isnan(temperatura)) {
      lcd.setCursor(0, 0);
      lcd.print("Error Sensor DHT");
      return;
    }

    // Conteo de Espacios Disponibles
    int huevosDetectados = 0;
    for (int i = 0; i < TOTAL_ESPACIOS; i++) {
      if (digitalRead(switchPines[i]) == LOW) {
        huevosDetectados++;
      }
    }
    int espaciosLibres = TOTAL_ESPACIOS - huevosDetectados;

    // Control del Foco
    String estadoFoco = "OFF";
    if (temperatura < (TEMP_OBJETIVO - HISTERESIS)) {
      digitalWrite(RELAY_PIN, RELE_ON);
      estadoFoco = "ON";
    } else if (temperatura > (TEMP_OBJETIVO + HISTERESIS)) {
      digitalWrite(RELAY_PIN, RELE_OFF);
      estadoFoco = "OFF";
    }

    // Control del Ventilador
    String estadoFan = "OFF";
    // Usamos histéresis correcta: enciende al subir de 38.0, apaga al bajar de 37.8
    static bool fanState = false;
    if (temperatura >= TEMP_FAN_ON) {
      fanState = true;
    } else if (temperatura <= TEMP_FAN_OFF) {
      fanState = false;
    }
    
    if (fanState) {
      digitalWrite(FAN_PIN, HIGH);
      estadoFan = "ON";
    } else {
      digitalWrite(FAN_PIN, LOW);
      estadoFan = "OFF";
    }

    // Control del Buzzer
    bool alarmaActiva = false;
    if (temperatura >= TEMP_CRITICA || humedad < HUM_MIN || humedad > HUM_MAX) {
      alarmaActiva = true;
      digitalWrite(BUZZER_PIN, HIGH);
    } else {
      digitalWrite(BUZZER_PIN, LOW);
    }

    // Actualización LCD
    lcd.setCursor(0, 0);
    lcd.print("T:");
    lcd.print(temperatura, 1);
    lcd.print((char)223);
    lcd.print("C H:");
    lcd.print((int)humedad);
    lcd.print("% ");

    lcd.setCursor(0, 1);
    if (alarmaActiva) {
      lcd.print("ALARM! Libres:");
      lcd.print(espaciosLibres);
    } else {
      lcd.print("L:");
      lcd.print(espaciosLibres);
      lcd.print(" Foc:");
      lcd.print(estadoFoco);
      lcd.print(" V:");
      lcd.print(estadoFan);
    }

    // 1. Salida para el Serial Plotter (Requisito del PDF)
    Serial.print("Temperatura:"); Serial.print(temperatura);
    Serial.print(" Humedad:"); Serial.println(humedad);

    // 2. Salida JSON estructurada para el Backend REST API
    Serial.print("{\"temperatura\":");     Serial.print(temperatura);
    Serial.print(",\"humedad\":");         Serial.print(humedad);
    Serial.print(",\"espacios_libres\":"); Serial.print(espaciosLibres);
    Serial.print(",\"foco\":\"");          Serial.print(estadoFoco);
    Serial.print("\",\"fan\":\"");         Serial.print(estadoFan);
    Serial.print("\",\"alarma\":");        Serial.print(alarmaActiva ? "true" : "false");
    Serial.println("}");
  }
}
