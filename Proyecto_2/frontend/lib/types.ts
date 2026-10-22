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
  isAlarm: boolean;
  isPaused: boolean;
  history: TelemetryPoint[];
  lots: Lot[];
  alarms: Alarm[];
  technician: Technician;
  visionClass?: string;
  visionConfidence?: number;
  isVisionLocked?: boolean;
  powerWatts?: number;
  energyKwh?: number;
}
