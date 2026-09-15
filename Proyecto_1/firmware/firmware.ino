#include "DHT.h"
#include <Servo.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <SPI.h>
#include <MFRC522.h>
#include <avr/wdt.h>

// =================================================================
// REVISAR ANTES DE SUBIR (posibles causas de fallas intermitentes):
// 1) El MFRC522 (RC522) es de 3.3V. Su pin VCC debe ir al pin 3.3V
//    del Mega, NUNCA al de 5V. Si lo tienes en 5V, muevelo a 3.3V.
// 2) Si el fan/foco van por relé, verifica que el modulo de rele
//    tenga su propio diodo flyback (casi todos los modulos lo traen,
//    pero si usaste un rele "pelado" o un transistor suelto, agrega
//    un diodo 1N4007 en paralelo con la bobina del rele/motor).
// 3) Si el fan es un motor DC directo (no por rele), NO lo conectes
//    directo al pin FAN_PIN: usa un transistor/MOSFET + diodo
//    flyback, un pin no soporta la corriente ni el pico inductivo.
// 4) DHT11: si es el sensor "pelado" (3 pines, sin PCB azul), necesita
//    una resistencia pull-up de 4.7k-10k entre DATA y VCC. Los
//    modulos con PCB (3 pines con placa) ya la traen integrada.
// 5) Idealmente, alimenta reles/fan/servo desde una fuente externa
//    separada de la logica del Mega, compartiendo tierra (GND) comun.
// =================================================================

// -------------------------------------------------------------
// CONFIGURACION RFID RC522 (Mega 2560: SCK=52, MISO=50, MOSI=51)
// -------------------------------------------------------------
#define RST_PIN 5
#define SS_PIN  53

MFRC522 rfid(SS_PIN, RST_PIN);

// >>> CAMBIA ESTE UID POR EL DE TU LLAVERO AUTORIZADO <<<
const char* LLAVERO_AUTORIZADO = "31 FB F3 4C";

bool mostrandoMensajeAcceso = false;
unsigned long tiempoFinMensajeAcceso = 0;

// Estado y temporizador para auto-cierre del servo tras abrir con RFID (5 segundos)
bool puertaAbiertaRfid = false;
unsigned long tiempoCierrePuertaRfid = 0;
const unsigned long TIEMPO_APERTURA_PUERTA = 5000; // 5 segundos

// Rate-limit RFID: solo verifica cada 500ms
// Sin esto, el SPI genera ruido continuo que corrompe al DHT11
unsigned long lastRfidCheck = 0;
const unsigned long RFID_CHECK_INTERVAL = 500;

// -------------------------------------------------------------
// PINES Y VARIABLES
// -------------------------------------------------------------
#define DHTPIN 2
#define DHTTYPE DHT11
#define BUTTON_PIN 3
#define FAN_PIN 6
#define RELAY_PIN 7
#define BUZZER_PIN 8
#define SERVO_PIN 9

// A0, A1, A2 para finales de carrera (libera pines SPI 50-53)
const int switchPines[3] = {A0, A1, A2};
const int TOTAL_ESPACIOS = 3;

DHT dht(DHTPIN, DHTTYPE);
Servo eggServo;
LiquidCrystal_I2C lcd(0x27, 16, 2);

const float TEMP_OBJETIVO = 37.5;
const float HISTERESIS    = 0.3;
const float TEMP_FAN_ON   = 38.0;
const float TEMP_FAN_OFF  = 37.8;
const float TEMP_CRITICA  = 38.5;
const float HUM_MIN       = 50.0;
const float HUM_MAX       = 65.0;

const int RELE_ON  = LOW;
const int RELE_OFF = HIGH;

bool buzzerActivo = false;
int buzzerPitosRestantes = 0;
unsigned long buzzerSiguienteCambio = 0;
bool buzzerEstadoActual = false;
bool buzzerEsAlarma = false;

volatile bool sistemaEncendido = true;
volatile unsigned long lastDebounceTime1 = 0;

unsigned long previousServoTime = 0;
const unsigned long servoInterval = 60000;
bool servoDerecha = true;
int servoAngle = 45;

unsigned long previousSensorTime = 0;
const unsigned long sensorInterval = 2000;

// Reinicio preventivo del LCD (por si el bus I2C sufrio un timeout)
unsigned long previousLcdReinitTime = 0;
const unsigned long lcdReinitInterval = 30000; // cada 30s

// Ultimo valor valido del DHT (sobrevive a fallos del sensor)
float ultimaTempValida = 25.0;
float ultimaHumValida  = 55.0;
uint8_t errorCountDHT  = 0;   // Contador de fallos consecutivos del DHT

// -------------------------------------------------------------
// FUNCIONES AUXILIARES
// -------------------------------------------------------------
void ISR_toggleSistema() {
  unsigned long currentTime = millis();
  if (currentTime - lastDebounceTime1 > 300) {
    sistemaEncendido = !sistemaEncendido;
    lastDebounceTime1 = currentTime;
  }
}

void iniciarPitido(int pitos, unsigned long duracionMs) {
  buzzerEsAlarma = false;
  buzzerActivo = true;
  buzzerPitosRestantes = pitos * 2;
  buzzerEstadoActual = true;
  buzzerSiguienteCambio = millis() + duracionMs;
  digitalWrite(BUZZER_PIN, HIGH);
}

void actualizarBuzzer(unsigned long currentMillis) {
  if (buzzerEsAlarma) return;
  if (buzzerActivo && currentMillis >= buzzerSiguienteCambio) {
    buzzerPitosRestantes--;
    if (buzzerPitosRestantes <= 0) {
      buzzerActivo = false;
      digitalWrite(BUZZER_PIN, LOW);
      return;
    }
    buzzerEstadoActual = !buzzerEstadoActual;
    digitalWrite(BUZZER_PIN, buzzerEstadoActual ? HIGH : LOW);
    buzzerSiguienteCambio = currentMillis + 80;
  }
}

// Convierte un byte a 2 caracteres hex en mayuscula (sin usar String)
void byteToHex(byte b, char* out) {
  const char hexChars[] = "0123456789ABCDEF";
  out[0] = hexChars[(b >> 4) & 0x0F];
  out[1] = hexChars[b & 0x0F];
  out[2] = '\0';
}

void reinitLcd() {
  lcd.init();
  lcd.backlight();
}

// -------------------------------------------------------------
// SETUP
// -------------------------------------------------------------
void setup() {
  // CRITICO: limpiar WDT residual del bootloader ANTES de todo
  MCUSR = 0;
  wdt_disable();

  Serial.begin(9600);

  pinMode(RELAY_PIN, OUTPUT);
  pinMode(FAN_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(BUTTON_PIN, INPUT_PULLUP);

  digitalWrite(RELAY_PIN, RELE_OFF);
  digitalWrite(FAN_PIN, LOW);
  digitalWrite(BUZZER_PIN, LOW);

  for (int i = 0; i < TOTAL_ESPACIOS; i++) {
    pinMode(switchPines[i], INPUT_PULLUP);
  }

  attachInterrupt(digitalPinToInterrupt(BUTTON_PIN), ISR_toggleSistema, FALLING);

  eggServo.attach(SERVO_PIN, 544, 2400);
  eggServo.write(servoAngle);

  dht.begin();

  Wire.begin();
  // Si el bus I2C se traba (p.ej. por ruido del rele/fan al conmutar),
  // esto evita que el LCD cuelgue el programa para siempre.
  Wire.setWireTimeout(3000, true);

  SPI.begin();
  rfid.PCD_Init();

  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0);
  lcd.print("SmartEgg IoT");
  lcd.setCursor(0, 1);
  lcd.print("Iniciando...");
  delay(1000);
  lcd.clear();

  // Watchdog global: protege TODO el loop, no solo un bloque.
  // Si algo se cuelga en cualquier parte (RFID, LCD, servo, etc.),
  // el Mega se resetea solo en 4 segundos.
  wdt_enable(WDTO_4S);
}

// -------------------------------------------------------------
// LOOP
// -------------------------------------------------------------
void loop() {
  wdt_reset(); // alimentar el watchdog en cada vuelta del loop

  if (!sistemaEncendido) {
    digitalWrite(RELAY_PIN, RELE_OFF);
    digitalWrite(FAN_PIN, LOW);
    digitalWrite(BUZZER_PIN, LOW);
    buzzerActivo = false;
    lcd.setCursor(0, 0);
    lcd.print("   SMARTEGG OFF ");
    lcd.setCursor(0, 1);
    lcd.print("  MODO STANDBY  ");
    delay(100);
    return;
  }

  unsigned long currentMillis = millis();
  actualizarBuzzer(currentMillis);

  // -------------------------------------------------------------
  // Reinicio preventivo del LCD cada cierto tiempo
  // -------------------------------------------------------------
  if (currentMillis - previousLcdReinitTime >= lcdReinitInterval) {
    previousLcdReinitTime = currentMillis;
    reinitLcd();
  }

  // -------------------------------------------------------------
  // TAREA 0: RFID RC522 — solo cada 500ms para no generar ruido SPI
  // -------------------------------------------------------------
  if (currentMillis - lastRfidCheck >= RFID_CHECK_INTERVAL) {
    lastRfidCheck = currentMillis;

    if (rfid.PICC_IsNewCardPresent() && rfid.PICC_ReadCardSerial()) {
      char uidLeido[32];
      uidLeido[0] = '\0';
      for (byte i = 0; i < rfid.uid.size; i++) {
        char hexPart[3];
        byteToHex(rfid.uid.uidByte[i], hexPart);
        strcat(uidLeido, hexPart);
        if (i < rfid.uid.size - 1) strcat(uidLeido, " ");
      }

      if (strcmp(uidLeido, LLAVERO_AUTORIZADO) == 0) {
        lcd.clear();
        lcd.setCursor(0, 0);
        lcd.print("ACCESO PERMITIDO");
        lcd.setCursor(0, 1);
        lcd.print("RETIRE LOS HUEVOS");
        iniciarPitido(1, 120);
        mostrandoMensajeAcceso = true;
        tiempoFinMensajeAcceso = currentMillis + 3000;

        // Mover servo a posicion de abierto (135 grados) y programar auto-cierre en 5s
        servoAngle = 135;
        eggServo.write(servoAngle);
        puertaAbiertaRfid = true;
        tiempoCierrePuertaRfid = currentMillis + TIEMPO_APERTURA_PUERTA;

        Serial.println(F("[RFID] Acceso concedido"));
      } else {
        lcd.clear();
        lcd.setCursor(0, 0);
        lcd.print("TARJETA INVALIDA");
        lcd.setCursor(0, 1);
        lcd.print("ACCESO DENEGADO");
        iniciarPitido(3, 80);
        mostrandoMensajeAcceso = true;
        tiempoFinMensajeAcceso = currentMillis + 1500;
        Serial.print(F("[RFID] Tarjeta desconocida: "));
        Serial.println(uidLeido);
      }

      rfid.PICC_HaltA();
      rfid.PCD_StopCrypto1();
    }
  }

  if (mostrandoMensajeAcceso && currentMillis >= tiempoFinMensajeAcceso) {
    mostrandoMensajeAcceso = false;
    lcd.clear();
  }

  // Cierre automatico del servo a los 5 segundos tras apertura RFID
  if (puertaAbiertaRfid && currentMillis >= tiempoCierrePuertaRfid) {
    puertaAbiertaRfid = false;
    servoAngle = 45;
    eggServo.write(servoAngle);
    Serial.println(F(">>> PUERTA CERRADA (SERVO -> 45)"));
  }

  // -------------------------------------------------------------
  // TAREA 1: SERVO MOTOR
  // -------------------------------------------------------------
  if (currentMillis - previousServoTime >= servoInterval) {
    previousServoTime = currentMillis;
    if (servoDerecha) {
      servoAngle = 45;
      eggServo.write(servoAngle);
      Serial.println(F(">>> SERVO -> POSICION 45"));
    } else {
      servoAngle = 135;
      eggServo.write(servoAngle);
      Serial.println(F(">>> SERVO -> POSICION 135"));
    }
    servoDerecha = !servoDerecha;
  }

  // -------------------------------------------------------------
  // TAREA 2: SENSORES + LCD + SERIAL
  // -------------------------------------------------------------
  if (currentMillis - previousSensorTime >= sensorInterval) {
    previousSensorTime = currentMillis;

    float rawTemp = dht.readTemperature();
    float rawHum  = dht.readHumidity();
    bool errorSensor = isnan(rawTemp) || isnan(rawHum);

    float temperatura, humedad;
    if (!errorSensor) {
      temperatura      = rawTemp;
      humedad          = rawHum;
      ultimaTempValida = temperatura;
      ultimaHumValida  = humedad;
      errorCountDHT    = 0;
    } else {
      errorCountDHT++;
      // Decaimiento progresivo del fallback despues de 2 fallos consecutivos.
      // Evita que el fan quede prendido para siempre si el DHT no responde.
      if (errorCountDHT > 2) {
        ultimaTempValida = max((float)25.0, ultimaTempValida - 0.5);
      }
      temperatura = ultimaTempValida;
      humedad     = ultimaHumValida;
    }

    // Control Foco
    static bool focoState = false;
    if (temperatura < (TEMP_OBJETIVO - HISTERESIS))      focoState = true;
    else if (temperatura > (TEMP_OBJETIVO + HISTERESIS)) focoState = false;
    digitalWrite(RELAY_PIN, focoState ? RELE_ON : RELE_OFF);
    const char* estadoFoco = focoState ? "ON" : "OFF";

    // Control Ventilador
    static bool fanState = false;
    if (temperatura >= TEMP_FAN_ON)       fanState = true;
    else if (temperatura <= TEMP_FAN_OFF) fanState = false;
    digitalWrite(FAN_PIN, fanState ? HIGH : LOW);
    const char* estadoFan = fanState ? "ON" : "OFF";

    // Control Alarma
    bool alarmaActiva = false;
    if (temperatura >= TEMP_CRITICA || humedad < HUM_MIN || humedad > HUM_MAX) {
      alarmaActiva = true;
      if (!buzzerActivo) {
        buzzerEsAlarma = true;
        digitalWrite(BUZZER_PIN, HIGH);
      }
    } else {
      buzzerEsAlarma = false;
      if (!buzzerActivo) digitalWrite(BUZZER_PIN, LOW);
    }

    // Conteo de huevos
    int huevosDetectados = 0;
    for (int i = 0; i < TOTAL_ESPACIOS; i++) {
      if (digitalRead(switchPines[i]) == LOW) huevosDetectados++;
    }
    int espaciosLibres = TOTAL_ESPACIOS - huevosDetectados;

    // LCD
    if (!mostrandoMensajeAcceso) {
      lcd.setCursor(0, 0);
      if (errorSensor) {
        lcd.print("Sensor: Ruido!  ");
      } else {
        lcd.print("T:");
        lcd.print(temperatura, 1);
        lcd.print((char)223);
        lcd.print("C H:");
        lcd.print((int)humedad);
        lcd.print("%  ");
      }
      lcd.setCursor(0, 1);
      if (alarmaActiva) {
        lcd.print("ALARM! Libres:");
        lcd.print(espaciosLibres);
        lcd.print("  ");
      } else {
        lcd.print("L:");
        lcd.print(espaciosLibres);
        lcd.print(" F:");
        lcd.print(estadoFoco);
        lcd.print(" V:");
        lcd.print(estadoFan);
      }
    }

    // JSON Serial
    Serial.print("{\"temperatura\":");       Serial.print(temperatura);
    Serial.print(",\"humedad\":");           Serial.print(humedad);
    Serial.print(",\"espacios_libres\":");   Serial.print(espaciosLibres);
    Serial.print(",\"foco\":\"");            Serial.print(estadoFoco);
    Serial.print("\",\"fan\":\"");           Serial.print(estadoFan);
    Serial.print("\",\"rotacion_grados\":"); Serial.print(servoAngle);
    Serial.print(",\"alarma\":");            Serial.print(alarmaActiva ? "true" : "false");
    Serial.println("}");
  }
}
