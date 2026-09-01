import type { jsPDF } from "jspdf";
import { weeklyHistory } from "@/lib/mock-data";
import type { Alarm, Lot, Technician } from "@/lib/types";

type Rgb = readonly [number, number, number];

const palette = {
  shell: [247, 245, 241] as Rgb,
  paper: [255, 255, 255] as Rgb,
  ink: [43, 42, 40] as Rgb,
  muted: [107, 104, 97] as Rgb,
  border: [222, 218, 210] as Rgb,
  forest: [37, 95, 83] as Rgb,
  forestDeep: [23, 71, 63] as Rgb,
  forestSoft: [229, 243, 238] as Rgb,
  yolk: [239, 178, 22] as Rgb,
  yolkDeep: [151, 87, 0] as Rgb,
  yolkSoft: [255, 243, 212] as Rgb,
  sprout: [102, 131, 66] as Rgb,
  sproutSoft: [238, 242, 233] as Rgb,
  water: [0, 143, 150] as Rgb,
  waterSoft: [229, 248, 246] as Rgb,
  alert: [215, 68, 48] as Rgb,
  alertSoft: [251, 235, 231] as Rgb,
} as const;

interface SelectableReportData {
  lots: Lot[];
  alarms: Alarm[];
  technician: Technician;
  temperature: number;
  humidity: number;
  occupied: number;
  capacity: number;
  generatedAt: string;
}

const setFill = (pdf: jsPDF, color: Rgb) => pdf.setFillColor(color[0], color[1], color[2]);
const setDraw = (pdf: jsPDF, color: Rgb) => pdf.setDrawColor(color[0], color[1], color[2]);
const setText = (pdf: jsPDF, color: Rgb) => pdf.setTextColor(color[0], color[1], color[2]);

function fitText(pdf: jsPDF, value: string, maxWidth: number) {
  if (pdf.getTextWidth(value) <= maxWidth) return value;
  let result = value;
  while (result.length > 2 && pdf.getTextWidth(`${result}...`) > maxWidth) result = result.slice(0, -1);
  return `${result.trimEnd()}...`;
}

const formatDate = (value: string) => new Intl.DateTimeFormat("es-GT", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
}).format(new Date(`${value}T00:00:00Z`));

const formatTimestamp = (value: string) => new Intl.DateTimeFormat("es-GT", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
}).format(new Date(value)).replace(",", " -");

const lotStatus = (status: Lot["status"]) => status === "incubando" ? "Incubando" : status === "observacion" ? "Observación" : "Completo";
const severityLabel = (severity: Alarm["severity"]) => severity === "critical" ? "Crítica" : severity === "warning" ? "Advertencia" : "Informativa";

function drawBrand(pdf: jsPDF) {
  setFill(pdf, palette.yolk);
  pdf.ellipse(20, 20, 6, 8, "F");
  setDraw(pdf, palette.paper);
  pdf.setLineWidth(0.55);
  pdf.ellipse(20, 21, 2.4, 3.6, "S");
  setFill(pdf, palette.paper);
  pdf.circle(23, 15.8, 1, "F");

  setText(pdf, palette.ink);
  pdf.setFont("times", "bold");
  pdf.setFontSize(21);
  pdf.text("SmartEgg", 30, 19.5);
  setText(pdf, palette.muted);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.5);
  pdf.text("Incubación precisa - Facultad de Ingeniería USAC", 30, 25);

  setFill(pdf, palette.forestSoft);
  pdf.roundedRect(147, 13.2, 49, 8, 4, 4, "F");
  setText(pdf, palette.forestDeep);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7.2);
  pdf.text("REPORTE DE INCUBACIÓN", 171.5, 18.3, { align: "center" });
  setText(pdf, palette.muted);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7.2);
  pdf.text("Nodo SE-01 - Incubadora principal", 196, 26, { align: "right" });

  setDraw(pdf, palette.border);
  pdf.setLineWidth(0.3);
  pdf.line(14, 32, 196, 32);
}

function drawMeta(pdf: jsPDF, data: SelectableReportData) {
  setText(pdf, palette.muted);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7.4);
  pdf.text(`Generado: ${new Intl.DateTimeFormat("es-GT", { dateStyle: "long", timeStyle: "short" }).format(new Date(data.generatedAt))}`, 14, 37.2);
  pdf.text(`Técnico: ${data.technician.name} - ${data.technician.id}`, 196, 37.2, { align: "right" });
}

function drawKpi(
  pdf: jsPDF,
  x: number,
  label: string,
  value: string,
  detail: string,
  background: Rgb,
  accent: Rgb,
) {
  setFill(pdf, background);
  setDraw(pdf, accent);
  pdf.setLineWidth(0.22);
  pdf.roundedRect(x, 41, 58, 25, 3, 3, "FD");
  setFill(pdf, accent);
  pdf.roundedRect(x + 4, 45, 12, 2.2, 1.1, 1.1, "F");
  setText(pdf, palette.muted);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7.2);
  pdf.text(label, x + 4, 52);
  setText(pdf, palette.ink);
  pdf.setFont("times", "bold");
  pdf.setFontSize(17);
  pdf.text(value, x + 4, 60.2);
  setText(pdf, palette.muted);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(6.8);
  pdf.text(detail, x + 54, 60.2, { align: "right" });
}

function chartY(value: number, top: number, height: number) {
  return top + ((38.5 - value) / 2.5) * height;
}

function drawChart(pdf: jsPDF) {
  const cardX = 14;
  const cardY = 72;
  const cardW = 182;
  const cardH = 61;
  const plotX = 27;
  const plotY = 91;
  const plotW = 161;
  const plotH = 31;

  setFill(pdf, palette.waterSoft);
  setDraw(pdf, [190, 221, 213]);
  pdf.setLineWidth(0.25);
  pdf.roundedRect(cardX, cardY, cardW, cardH, 4, 4, "FD");

  setText(pdf, palette.forestDeep);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7);
  pdf.text("HISTÓRICO SEMANAL", 20, 80);
  setText(pdf, palette.ink);
  pdf.setFont("times", "bold");
  pdf.setFontSize(14);
  pdf.text("Temperatura máxima y mínima", 20, 87);

  setText(pdf, palette.muted);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(6.2);
  pdf.text("Máxima diaria", 156, 80.4);
  pdf.text("Mínima diaria", 181, 80.4);
  pdf.setFontSize(5.2);
  pdf.text("Pico más alto", 156, 83);
  pdf.text("Lectura más baja", 181, 83);
  setDraw(pdf, palette.yolk);
  pdf.setLineWidth(0.8);
  pdf.line(146, 79.8, 153, 79.8);
  setDraw(pdf, palette.sprout);
  pdf.setLineDashPattern([1.5, 1], 0);
  pdf.line(171, 79.8, 178, 79.8);
  pdf.setLineDashPattern([], 0);

  setFill(pdf, palette.sproutSoft);
  const bandTop = chartY(38, plotY, plotH);
  const bandBottom = chartY(36.8, plotY, plotH);
  pdf.rect(plotX, bandTop, plotW, bandBottom - bandTop, "F");

  [36, 36.5, 37, 37.5, 38, 38.5].forEach((tick) => {
    const y = chartY(tick, plotY, plotH);
    setDraw(pdf, palette.border);
    pdf.setLineWidth(0.18);
    pdf.line(plotX, y, plotX + plotW, y);
    setText(pdf, palette.muted);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(6.2);
    pdf.text(tick.toFixed(1), plotX - 2.3, y + 1.5, { align: "right" });
  });

  const maxPoints = weeklyHistory.map((item, index) => ({
    x: plotX + (index / (weeklyHistory.length - 1)) * plotW,
    y: chartY(item.max, plotY, plotH),
  }));
  const minPoints = weeklyHistory.map((item, index) => ({
    x: plotX + (index / (weeklyHistory.length - 1)) * plotW,
    y: chartY(item.min, plotY, plotH),
  }));

  setDraw(pdf, palette.yolk);
  pdf.setLineWidth(0.8);
  maxPoints.slice(1).forEach((point, index) => pdf.line(maxPoints[index].x, maxPoints[index].y, point.x, point.y));
  setDraw(pdf, palette.sprout);
  pdf.setLineDashPattern([1.6, 1.1], 0);
  minPoints.slice(1).forEach((point, index) => pdf.line(minPoints[index].x, minPoints[index].y, point.x, point.y));
  pdf.setLineDashPattern([], 0);

  weeklyHistory.forEach((item, index) => {
    const x = plotX + (index / (weeklyHistory.length - 1)) * plotW;
    setFill(pdf, palette.paper);
    setDraw(pdf, palette.yolk);
    pdf.circle(x, maxPoints[index].y, 1.15, "FD");
    setDraw(pdf, palette.sprout);
    pdf.circle(x, minPoints[index].y, 1.15, "FD");
    setText(pdf, palette.muted);
    pdf.setFontSize(6.2);
    pdf.text(item.day, x, 128.2, { align: "center" });
  });
}

function drawLots(pdf: jsPDF, lots: Lot[]) {
  setText(pdf, palette.forestDeep);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7);
  pdf.text("TRAZABILIDAD", 14, 141);
  setText(pdf, palette.ink);
  pdf.setFont("times", "bold");
  pdf.setFontSize(13.5);
  pdf.text("Lotes registrados", 14, 147);
  setText(pdf, palette.muted);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(6.8);
  pdf.text(`${lots.length} registros`, 196, 146.6, { align: "right" });

  const x = 14;
  const y = 151;
  const widths = [26, 40, 29, 20, 27, 40];
  const headers = ["ID", "LOTE", "INGRESO", "CANT.", "TEMP.", "ESTADO"];
  setFill(pdf, palette.forest);
  pdf.roundedRect(x, y, 182, 7.5, 2, 2, "F");
  setText(pdf, palette.paper);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(6.3);
  let cursor = x;
  headers.forEach((header, index) => {
    pdf.text(header, cursor + 3, y + 4.9);
    cursor += widths[index];
  });

  lots.slice(0, 5).forEach((lot, rowIndex) => {
    const rowY = y + 7.5 + rowIndex * 7.3;
    setFill(pdf, rowIndex % 2 === 0 ? palette.paper : palette.shell);
    pdf.rect(x, rowY, 182, 7.3, "F");
    setDraw(pdf, palette.border);
    pdf.setLineWidth(0.15);
    pdf.line(x, rowY + 7.3, x + 182, rowY + 7.3);
    setText(pdf, palette.ink);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(6.8);
    const values = [
      lot.id,
      lot.label,
      formatDate(lot.entryDate),
      String(lot.quantity),
      `${lot.requiredTemperature.toFixed(1)} °C`,
      lotStatus(lot.status),
    ];
    cursor = x;
    values.forEach((value, index) => {
      pdf.text(fitText(pdf, value, widths[index] - 5), cursor + 3, rowY + 4.8);
      cursor += widths[index];
    });
  });
}

function alarmColors(severity: Alarm["severity"]) {
  if (severity === "critical") return { accent: palette.alert, background: palette.alertSoft };
  if (severity === "warning") return { accent: palette.yolkDeep, background: palette.yolkSoft };
  return { accent: palette.forest, background: palette.forestSoft };
}

function drawAlarms(pdf: jsPDF, alarms: Alarm[]) {
  setText(pdf, palette.forestDeep);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7);
  pdf.text("BITÁCORA DEL SISTEMA", 14, 199);
  setText(pdf, palette.ink);
  pdf.setFont("times", "bold");
  pdf.setFontSize(13.5);
  pdf.text("Alarmas y eventos recientes", 14, 205);
  setText(pdf, palette.muted);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(6.8);
  pdf.text(`${alarms.length} eventos únicos`, 196, 204.6, { align: "right" });

  alarms.slice(0, 3).forEach((alarm, index) => {
    const y = 209 + index * 19;
    const colors = alarmColors(alarm.severity);
    setFill(pdf, colors.background);
    setDraw(pdf, colors.accent);
    pdf.setLineWidth(0.22);
    pdf.roundedRect(14, y, 182, 16.5, 2.5, 2.5, "FD");
    setFill(pdf, colors.accent);
    pdf.roundedRect(14, y, 2.2, 16.5, 1, 1, "F");

    setText(pdf, palette.ink);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7.6);
    pdf.text(fitText(pdf, alarm.title, 92), 20, y + 5.6);
    setText(pdf, palette.muted);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(6.6);
    pdf.text(fitText(pdf, alarm.detail, 117), 20, y + 11.5);
    pdf.text(formatTimestamp(alarm.timestamp), 190, y + 5.4, { align: "right" });
    setText(pdf, colors.accent);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(6.2);
    pdf.text(`${severityLabel(alarm.severity).toUpperCase()} - ${alarm.id}`, 190, y + 11.5, { align: "right" });
  });
}

function drawFooter(pdf: jsPDF, technician: Technician) {
  setDraw(pdf, palette.border);
  pdf.setLineWidth(0.25);
  pdf.line(14, 282, 196, 282);
  setText(pdf, palette.muted);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(6.8);
  pdf.text("SmartEgg - Arquitectura de Computadores 2", 14, 287);
  pdf.text(`${technician.name} - ${technician.id}`, 196, 287, { align: "right" });
  setText(pdf, palette.forestDeep);
  pdf.setFont("helvetica", "bold");
  pdf.text("Página 1 de 1", 196, 291.5, { align: "right" });
}

export async function downloadSelectableReport(data: SelectableReportData) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true, putOnlyUsedFonts: true });
  setFill(pdf, palette.shell);
  pdf.rect(0, 0, 210, 297, "F");

  drawBrand(pdf);
  drawMeta(pdf, data);
  drawKpi(pdf, 14, "Temperatura actual", `${data.temperature.toFixed(1)} °C`, "Objetivo 37.5 °C", palette.yolkSoft, palette.yolk);
  drawKpi(pdf, 76, "Humedad actual", `${data.humidity.toFixed(1)} %`, "Rango 50-65 %", palette.waterSoft, palette.water);
  drawKpi(pdf, 138, "Ocupación", `${data.occupied} / ${data.capacity}`, `${data.capacity - data.occupied} libres`, palette.forestSoft, palette.forest);
  drawChart(pdf);
  drawLots(pdf, data.lots);
  drawAlarms(pdf, data.alarms);
  drawFooter(pdf, data.technician);

  pdf.setProperties({
    title: "Reporte de incubación SmartEgg",
    author: `${data.technician.name} (${data.technician.id})`,
    subject: "Monitoreo del nodo SE-01",
    keywords: "SmartEgg, incubación, temperatura, humedad, lotes, alarmas",
  });
  pdf.save(`SmartEgg-reporte-${data.generatedAt.slice(0, 10)}.pdf`);
}
