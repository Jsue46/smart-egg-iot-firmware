export type LotStatus = "incubando" | "observacion" | "completo";

export interface Lot {
  id: string;
  label: string;
  entryDate: string;
  quantity: number;
  requiredTemperature: number;
  status: LotStatus;
  progress: number;
}

export interface Alarm {
  id: string;
  timestamp: string;
  title: string;
  detail: string;
  severity: "info" | "warning" | "critical";
  active?: boolean;
}

export interface Technician {
  name: string;
  id: string;
  role: string;
}

export interface TelemetryPoint {
  at: number;
  temperature: number;
  humidity: number;
}

export interface DoorEvent {
  id: string;
  operador: string | null;
  operador_id: number | null;
  accion: "ABRIR" | "CERRAR";
  cantidad_huevos: number | null;
  timestamp: string;
}

export interface TelemetryState {
  temperature: number;
  humidity: number;
  heaterOn: boolean;
  fanOn: boolean;
  doorOpen: boolean;
  servoAngle: number;
  occupied: number;
  capacity: number;
  isOnline: boolean;
  isMqttConnected: boolean;
  isAlarm: boolean;
  history: TelemetryPoint[];
  lots: Lot[];
  alarms: Alarm[];
  doorEvents: DoorEvent[];
  technician: Technician;
  visionClass: string | null;
  visionConfidence: number | null;
  isVisionLocked: boolean;
  powerWatts: number | null;
  energyKwh: number | null;
  energyLimitWatts: number;
  energyAlert: boolean;
  timerActive: boolean;
  timerSecondsRemaining: number;
}
