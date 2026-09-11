"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { API_BASE_URL } from "@/lib/config";
import { AdminIcon, AlarmIcon, DoorIcon, GrafanaIcon, LotIcon, RotateLeftIcon, UserIcon } from "@/components/icons/egg-icons";

interface OperatorRow {
  id: number;
  nombre: string;
  rol: string;
  lotes: number;
  accesos: number;
}

interface AlarmRow {
  id: number;
  tipo: string;
  severidad: "info" | "warning" | "critical";
  activa: boolean;
  mensaje: string;
  inicio_at?: string;
  resolucion_at?: string;
  timestamp: string;
}

interface DoorRow {
  id: number;
  operador: string | null;
  accion: string;
  cantidad_huevos: number | null;
  timestamp: string;
}

const timeFormatter = new Intl.DateTimeFormat("es-GT", { dateStyle: "short", timeStyle: "short" });

function durationText(start?: string, end?: string): string | null {
  if (!start) return null;
  const from = new Date(start).getTime();
  if (Number.isNaN(from)) return null;
  const to = end ? new Date(end).getTime() : Date.now();
  if (Number.isNaN(to)) return null;
  const seconds = Math.max(0, Math.round((to - from) / 1000));
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes} min ${seconds % 60} s`;
}

const ALARMS_PER_PAGE = 5;

export function AdminConsole() {
  const { user } = useAuth();
  const [operators, setOperators] = useState<OperatorRow[]>([]);
  const [lots, setLots] = useState<any[]>([]);
  const [alarms, setAlarms] = useState<AlarmRow[]>([]);
  const [doors, setDoors] = useState<DoorRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [alarmPage, setAlarmPage] = useState(1);

  const load = useCallback(async () => {
    setRefreshing(true);
    setAlarmPage(1);
    try {
      const [opRes, lotRes, alarmRes, doorRes] = await Promise.all([
        fetch(`${API_BASE_URL}/operadores`, { cache: "no-store" }),
        fetch(`${API_BASE_URL}/huevos`, { cache: "no-store" }),
        fetch(`${API_BASE_URL}/alarmas?limit=50`, { cache: "no-store" }),
        fetch(`${API_BASE_URL}/accesos-puerta?limit=30`, { cache: "no-store" }),
      ]);
      const [opData, lotData, alarmData, doorData] = await Promise.all([
        opRes.ok ? opRes.json() : [],
        lotRes.ok ? lotRes.json() : [],
        alarmRes.ok ? alarmRes.json() : [],
        doorRes.ok ? doorRes.json() : [],
      ]);

      setLots(lotData);
      setAlarms(alarmData);
      setDoors(doorData);
      setOperators(
        (opData as any[]).map((operator) => ({
          id: operator.id,
          nombre: operator.nombre,
          rol: operator.rol,
          lotes: (lotData as any[]).filter((lot) => lot.tecnico === operator.nombre).length,
          accesos: (doorData as any[]).filter((door) => door.operador === operator.nombre).length,
        })),
      );
    } catch {
      // Los datos se muestran parcialmente; el botón de refrescar reintenta.
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (!user || user.role !== "administrador") return null;

  const incubating = lots.filter((lot) => lot.status !== "completo").length;
  const activeAlarms = alarms.filter((alarm) => alarm.activa).length;
  const doorOpens = doors.filter((door) => door.accion === "ABRIR").length;
  const alarmPageCount = Math.max(1, Math.ceil(alarms.length / ALARMS_PER_PAGE));
  const currentAlarmPage = Math.min(alarmPage, alarmPageCount);
  const visibleAlarms = alarms.slice((currentAlarmPage - 1) * ALARMS_PER_PAGE, currentAlarmPage * ALARMS_PER_PAGE);

  const kpis = [
    { label: "Lotes registrados", value: `${lots.length}`, detail: `${incubating} en incubación`, icon: LotIcon, color: "var(--sprout)" },
    { label: "Alarmas activas", value: `${activeAlarms}`, detail: "condiciones fuera de rango", icon: AlarmIcon, color: "var(--alert)" },
    { label: "Accesos a puerta", value: `${doors.length}`, detail: `${doorOpens} aperturas registradas`, icon: DoorIcon, color: "var(--aqua)" },
    { label: "Operadores", value: `${operators.length}`, detail: "equipo de incubación", icon: UserIcon, color: "var(--violet)" },
  ];

  return (
    <div className="new-lot-layout">
      <section className="form-panel">
        <div className="form-heading">
          <span className="form-step">05</span>
          <div>
            <p className="eyebrow">Solo administrador</p>
            <h2>Consola de administración</h2>
            <p>Visión ejecutiva del sistema: operadores, lotes, alarmas y accesos de la incubadora.</p>
          </div>
          <button type="button" className="button secondary compact" style={{ marginLeft: "auto", alignSelf: "flex-start" }} onClick={load} disabled={refreshing}>
            <RotateLeftIcon size={18} /> {refreshing ? "Actualizando…" : "Actualizar"}
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 }}>
          {kpis.map(({ label, value, detail, icon: Icon, color }) => (
            <div className="mini-stat" key={label}>
              <Icon size={28} color={color} />
              <span>
                <small>{label}</small>
                <strong>{value} <span style={{ color: "var(--muted)", fontSize: 11, fontWeight: 400 }}>· {detail}</span></strong>
              </span>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 22 }}>
          <div className="form-heading" style={{ padding: 0, marginBottom: 12 }}>
            <div><p className="eyebrow">Equipo operativo</p><h2 style={{ fontSize: 20 }}>Operadores</h2></div>
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {operators.length === 0 ? (
              <p style={{ color: "var(--muted)", fontSize: 12, margin: 0 }}>No hay operadores registrados en el sistema.</p>
            ) : (
              operators.map((operator) => (
                <div key={operator.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "#fdfcf9", border: "1px solid var(--border)", borderRadius: 13 }}>
                  <AdminIcon size={28} color="var(--forest)" />
                  <div style={{ minWidth: 0 }}>
                    <strong style={{ fontSize: 13, fontWeight: 500, display: "block" }}>{operator.nombre}</strong>
                    <small style={{ color: "var(--muted)", fontSize: 11 }}>{operator.rol}</small>
                  </div>
                  <span style={{ marginLeft: "auto", display: "flex", gap: 14, color: "var(--muted)", fontSize: 12 }}>
                    <span><strong style={{ color: "var(--ink)", fontWeight: 500 }}>{operator.lotes}</strong> lotes</span>
                    <span><strong style={{ color: "var(--ink)", fontWeight: 500 }}>{operator.accesos}</strong> accesos</span>
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div style={{ marginTop: 22 }}>
          <div className="admin-section-heading">
            <div><p className="eyebrow">Historial</p><h2 style={{ fontSize: 20 }}>Últimas alarmas</h2></div>
            {alarms.length > 0 ? <span className="admin-count-chip">{alarms.length} registradas</span> : null}
          </div>
          <div className="admin-alarm-list">
            {alarms.length === 0 ? (
              <p style={{ color: "var(--muted)", fontSize: 12, margin: 0 }}>Sin alarmas registradas en el sistema.</p>
            ) : (
              visibleAlarms.map((alarm) => (
                <div key={alarm.id} className={`alarm-item ${alarm.severidad === "warning" ? "warning" : "critical"}`}>
                  <div className="alarm-item-head">
                    <span className={alarm.activa ? "alarm-status activa" : "alarm-status resuelta"}>{alarm.activa ? "Activa" : "Resuelta"}</span>
                    <strong>{alarm.tipo}</strong>
                    <time>{timeFormatter.format(new Date(alarm.timestamp))}</time>
                  </div>
                  <p>{alarm.mensaje}</p>
                  <small style={{ color: "var(--muted)", fontSize: 11 }}>Duración: {alarm.activa ? `${durationText(alarm.inicio_at) ?? "—"} (en curso)` : durationText(alarm.inicio_at, alarm.resolucion_at) ?? "—"}</small>
                </div>
              ))
            )}
          </div>
          {alarms.length > ALARMS_PER_PAGE ? (
            <div className="admin-pagination" aria-label="Paginación de últimas alarmas">
              <button
                type="button"
                className="button ghost compact"
                onClick={() => setAlarmPage((page) => Math.max(1, page - 1))}
                disabled={currentAlarmPage === 1}
                aria-label="Ver alarmas anteriores"
              >
                Anteriores
              </button>
              <span aria-live="polite"><strong>{currentAlarmPage}</strong> / {alarmPageCount}<small>5 por página</small></span>
              <button
                type="button"
                className="button ghost compact"
                onClick={() => setAlarmPage((page) => Math.min(alarmPageCount, page + 1))}
                disabled={currentAlarmPage === alarmPageCount}
                aria-label="Ver alarmas siguientes"
              >
                Siguientes
              </button>
            </div>
          ) : null}
        </div>
      </section>

      <div className="registration-side admin-side" style={{ display: "grid", gap: 16 }}>
        <section style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 22, boxShadow: "var(--shadow-soft)", padding: "20px" }}>
          <div className="form-heading" style={{ padding: 0, marginBottom: 12 }}>
            <div><p className="eyebrow">Accesos</p><h2 style={{ fontSize: 20 }}>Todas las aperturas</h2></div>
          </div>
          {doors.length === 0 ? (
            <p style={{ color: "var(--muted)", fontSize: 12, margin: 0 }}>Sin accesos registrados.</p>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {doors.slice(0, 10).map((door) => (
                <div key={door.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 13px", background: "#fdfcf9", border: "1px solid var(--border)", borderRadius: 12 }}>
                  <span style={{ padding: "2px 8px", borderRadius: 999, color: "#fff", background: door.accion === "ABRIR" ? "var(--aqua)" : "var(--sprout)", font: "600 10px var(--font-mono), monospace", letterSpacing: ".05em" }}>{door.accion}</span>
                  <div style={{ minWidth: 0 }}>
                    <strong style={{ fontSize: 12, fontWeight: 500, display: "block" }}>{door.operador ?? "Operador"}</strong>
                    <small style={{ color: "var(--muted)", fontSize: 11 }}>{door.cantidad_huevos ? `${door.cantidad_huevos} huevos · ` : ""}{timeFormatter.format(new Date(door.timestamp))}</small>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="grafana-card">
          <div className="grafana-card-head">
            <div className="grafana-brand">
              <span className="grafana-mark"><GrafanaIcon size={28} color="currentColor" /></span>
              <div><p className="eyebrow">Observabilidad</p><h2>Grafana</h2></div>
            </div>
            <span className="grafana-status"><i /> Local</span>
          </div>
          <p className="grafana-card-copy">Observa la incubadora con el pulso del broker y el contexto histórico de PostgreSQL.</p>
          <div className="grafana-signal-grid" aria-label="Fuentes de observabilidad">
            <span><strong>Tiempo real</strong><small>MQTT · streaming</small></span>
            <span><strong>Histórico</strong><small>PostgreSQL · SQL</small></span>
          </div>
          <div className="grafana-card-foot">
            <a href="http://localhost:3000" target="_blank" rel="noreferrer" className="button grafana-launch">Abrir Grafana <span aria-hidden="true">↗</span></a>
            <span className="grafana-endpoint">localhost:3000</span>
          </div>
        </section>
      </div>
    </div>
  );
}
