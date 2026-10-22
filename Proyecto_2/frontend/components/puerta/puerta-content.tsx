"use client";

import { useAuth } from "@/components/auth/auth-provider";
import { DoorIcon } from "@/components/icons/egg-icons";
import { useTelemetry } from "@/hooks/use-telemetry";
import type { DoorEvent } from "@/lib/types";

const timeFormatter = new Intl.DateTimeFormat("es-GT", { dateStyle: "short", timeStyle: "short" });

function formatEventTime(timestamp: string) {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? "Hora no disponible" : timeFormatter.format(date);
}

function AccessEvent({ event }: { event: DoorEvent }) {
  return (
    <li className="door-event-row">
      <span className={`door-event-action ${event.accion === "ABRIR" ? "open" : "closed"}`}>{event.accion}</span>
      <span className="door-event-copy">
        <strong>{event.operador ?? "Operador"}</strong>
        <small>{event.cantidad_huevos ? `${event.cantidad_huevos} ${event.cantidad_huevos === 1 ? "huevo" : "huevos"} · ` : ""}{formatEventTime(event.timestamp)}</small>
      </span>
    </li>
  );
}

export function PuertaContent() {
  const { user } = useAuth();
  const { doorOpen, isOnline, isMqttConnected, occupied, capacity, doorEvents } = useTelemetry();

  if (!user || user.role === "administrador") return null;

  return (
    <div className="new-lot-layout">
      <section className="form-panel">
        <div className="form-heading">
          <span className="form-step">03</span>
          <div>
            <p className="eyebrow">Acceso físico</p>
            <h2>Estado de la puerta</h2>
            <p>La puerta se opera en la maqueta mediante el lector RFID. El estado y los accesos se reciben directamente por MQTT.</p>
          </div>
        </div>

        <div className="door-live-panel">
          <span className={`door-live-icon ${doorOpen ? "open" : "closed"}`}><DoorIcon size={34} /></span>
          <div className="door-live-copy">
            <small>Estado reportado por SE-01</small>
            <strong>{doorOpen ? "Puerta abierta" : "Puerta cerrada"}</strong>
            <span>{occupied} de {capacity} espacios ocupados</span>
          </div>
          <span className={`door-live-status ${isOnline ? "online" : "offline"}`}><i />{isOnline ? "Nodo en línea" : "Nodo sin conexión"}</span>
        </div>

        <div className="door-rfid-note">
          <span aria-hidden="true">RFID</span>
          <p>Presenta una tarjeta autorizada en el lector de la incubadora para abrirla. Al detectar la acción física, el nodo publica el evento y esta vista se actualiza automáticamente.</p>
        </div>
        {!isMqttConnected ? <p className="field-error" role="status">Sin conexión al broker MQTT. Los eventos aparecerán cuando se restablezca el enlace.</p> : null}
      </section>

      <aside className="registration-side">
        <section className="door-history-card" aria-labelledby="door-history-title">
          <div className="form-heading" style={{ padding: 0, marginBottom: 14 }}>
            <div><p className="eyebrow">Historial en vivo</p><h2 id="door-history-title" style={{ fontSize: 20 }}>Accesos recientes</h2></div>
            <span className="door-event-count">{doorEvents.length}</span>
          </div>
          {doorEvents.length === 0 ? (
            <p className="door-history-empty">Aún no se han recibido eventos de acceso por MQTT.</p>
          ) : (
            <ol className="door-event-list">{doorEvents.slice(0, 12).map((event) => <AccessEvent key={event.id} event={event} />)}</ol>
          )}
        </section>
      </aside>
    </div>
  );
}
