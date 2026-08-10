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
  severity: "warning" | "critical" | "resolved";
}

export interface TelemetryPoint {
  at: number;
  temperature: number;
  humidity: number;
}

export interface TelemetryState {
  temperature: number;
  humidity: number;
  servoAngle: number;
  occupied: number;
  capacity: number;
  isOnline: boolean;
  isAlarm: boolean;
  isPaused: boolean;
  history: TelemetryPoint[];
  lots: Lot[];
  alarms: Alarm[];
}
