#include <Arduino_FreeRTOS.h>
#include <semphr.h>
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
const float TEMP_FAN_OFF = 37.8; 
const float TEMP_CRITICA = 38.5; 
const float HUM_MIN      = 50.0; 
const float HUM_MAX      = 65.0;

const int RELE_ON  = LOW;
const int RELE_OFF = HIGH;

// --- Variables Globales (Estado del Sistema) ---
volatile bool sistemaEncendido = true;
volatile bool eventoInterrupcion2 = false;

// --- Semáforos de FreeRTOS ---
SemaphoreHandle_t xSemaphoreBoton;
SemaphoreHandle_t xSemaphoreEvento;

// --- ISR 1: Interrupción Externa del Botón ON/OFF (Pin 3) ---
void ISR_toggleSistema() {
  BaseType_t xHigherPriorityTaskWoken = pdFALSE;
  // Desbloqueamos la tarea en lugar de cambiar la lógica aquí
  xSemaphoreGiveFromISR(xSemaphoreBoton, &xHigherPriorityTaskWoken);
  
  if (xHigherPriorityTaskWoken == pdTRUE) {
    portYIELD_FROM_ISR(); // Forzamos cambio de contexto
  }
}

// --- ISR 2: Interrupción Externa Secundaria (Pin 18) ---
void ISR_eventoSecundario() {
  BaseType_t xHigherPriorityTaskWoken = pdFALSE;
  xSemaphoreGiveFromISR(xSemaphoreEvento, &xHigherPriorityTaskWoken);
  
  if (xHigherPriorityTaskWoken == pdTRUE) {
    portYIELD_FROM_ISR();
  }
}

// --- TAREAS DE FREERTOS ---

// Tarea para manejar el botón ON/OFF (despertada por la ISR 1)
void TaskControlBoton(void *pvParameters) {
  (void) pvParameters;
  for (;;) {
    // La tarea espera indefinidamente el semáforo (no consume CPU)
    if (xSemaphoreTake(xSemaphoreBoton, portMAX_DELAY) == pdTRUE) {
      sistemaEncendido = !sistemaEncendido;
      vTaskDelay(250 / portTICK_PERIOD_MS); // Antirrebote usando delay de FreeRTOS
    }
  }
}

// Tarea para manejar el Evento 2 (despertada por la ISR 2)
void TaskEventoSecundario(void *pvParameters) {
  (void) pvParameters;
  for (;;) {
    if (xSemaphoreTake(xSemaphoreEvento, portMAX_DELAY) == pdTRUE) {
      eventoInterrupcion2 = !eventoInterrupcion2;
      vTaskDelay(250 / portTICK_PERIOD_MS); // Antirrebote
    }
  }
}

// Tarea para el Servomotor (Asíncrona, cada 5 segundos)
void TaskServo(void *pvParameters) {
  (void) pvParameters;
  bool servoDerecha = true;
  for (;;) {
    if (sistemaEncendido) {
      if (servoDerecha) {
        eggServo.write(45);  
      } else {
        eggServo.write(135); 
      }
      servoDerecha = !servoDerecha;
    }
    // Duerme la tarea por 5 segundos
    vTaskDelay(5000 / portTICK_PERIOD_MS); 
  }
}

// Tarea principal para Sensores, LCD, y Potencia (Asíncrona, cada 2 segundos)
void TaskSensoresYControl(void *pvParameters) {
  (void) pvParameters;
  static bool fanState = false;

  for (;;) {
    if (!sistemaEncendido) {
      digitalWrite(RELAY_PIN, RELE_OFF);
      digitalWrite(FAN_PIN, LOW);
      digitalWrite(BUZZER_PIN, LOW);
      
      lcd.setCursor(0, 0);
      lcd.print("   SMARTEGG OFF ");
      lcd.setCursor(0, 1);
      lcd.print("  MODO STANDBY  ");
    } else {
      float humedad = dht.readHumidity();
      float temperatura = dht.readTemperature();

      if (isnan(humedad) || isnan(temperatura)) {
        lcd.setCursor(0, 0);
        lcd.print("Error Sensor DHT");
      } else {
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

        // Salida Serial Plotter
        Serial.print("Temperatura:"); Serial.print(temperatura);
        Serial.print(" Humedad:"); Serial.println(humedad);

        // Salida JSON estructurada para el Backend
        Serial.print("{\"temperatura\":");     Serial.print(temperatura);
        Serial.print(",\"humedad\":");         Serial.print(humedad);
        Serial.print(",\"espacios_libres\":"); Serial.print(espaciosLibres);
        Serial.print(",\"foco\":\"");          Serial.print(estadoFoco);
        Serial.print("\",\"fan\":\"");         Serial.print(estadoFan);
        Serial.print("\",\"alarma\":");        Serial.print(alarmaActiva ? "true" : "false");
        Serial.println("}");
      }
    }
    
    // Duerme la tarea por 2 segundos antes de volver a leer
    vTaskDelay(2000 / portTICK_PERIOD_MS); 
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

  // 2. Inicialización de Periféricos
  dht.begin();
  eggServo.attach(SERVO_PIN);
  
  // -- PRUEBA DE HARDWARE: Movimiento forzado al encender --
  eggServo.write(45); 
  delay(1000); // Usamos delay normal aquí porque FreeRTOS aún no arranca
  eggServo.write(135);
  delay(1000);
  // ---------------------------------------------------------
  
  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0);
  lcd.print("SmartEgg loT");
  lcd.setCursor(0, 1);
  lcd.print("FreeRTOS USAC");
  delay(1500);
  lcd.clear();

  // 3. Crear Semáforos para Interrupciones
  xSemaphoreBoton = xSemaphoreCreateBinary();
  xSemaphoreEvento = xSemaphoreCreateBinary();

  // 4. Adjuntar Interrupciones Físicas
  attachInterrupt(digitalPinToInterrupt(BUTTON_PIN), ISR_toggleSistema, FALLING);
  attachInterrupt(digitalPinToInterrupt(INTERRUPT_PIN2), ISR_eventoSecundario, FALLING);

  // 5. Crear Tareas de FreeRTOS
  // Parámetros: Función, Nombre, Tamaño Pila(Stack), Parametro, Prioridad, Handle
  xTaskCreate(TaskControlBoton,      "Boton",       128, NULL, 2, NULL);
  xTaskCreate(TaskEventoSecundario,  "EventoSec",   128, NULL, 2, NULL);
  xTaskCreate(TaskServo,             "Servo",       128, NULL, 1, NULL);
  xTaskCreate(TaskSensoresYControl,  "Sensores",    300, NULL, 1, NULL); // Mayor stack por variables float y String
  
  // En Arduino, el planificador (scheduler) de FreeRTOS inicia automáticamente
  // después del setup()
}

void loop() {
  // En FreeRTOS nativo, el loop() se queda completamente vacío.
  // Todo el trabajo pesado lo hacen las Tareas en paralelo.
}
