"use client";

import { useEffect, useRef } from "react";

interface IncubatorCanvasProps {
  angle: number;
  occupied: number;
  capacity: number;
  heaterOn: boolean;
  fanOn: boolean;
  alarm: boolean;
  isOnline: boolean;
  reduceMotion: boolean;
}

function drawEgg(context: CanvasRenderingContext2D, x: number, y: number, scale: number) {
  context.save();
  context.translate(x, y);
  context.scale(scale, scale);
  context.beginPath();
  context.moveTo(0, -21);
  context.bezierCurveTo(15, -9, 17, 12, 0, 17);
  context.bezierCurveTo(-17, 12, -15, -9, 0, -21);
  const shell = context.createLinearGradient(-10, -12, 12, 15);
  shell.addColorStop(0, "#fff3d8");
  shell.addColorStop(1, "#ddcaa6");
  context.fillStyle = shell;
  context.fill();
  context.strokeStyle = "rgba(255, 248, 230, .72)";
  context.lineWidth = 1.4;
  context.stroke();
  context.restore();
}

function drawIncubator(context: CanvasRenderingContext2D, width: number, height: number, time: number, state: IncubatorCanvasProps) {
  const scale = Math.min(width / 620, height / 360, 1.15);
  context.clearRect(0, 0, width, height);
  context.save();
  context.translate(width / 2, height / 2 + 4);
  context.scale(scale, scale);

  const background = context.createRadialGradient(0, -10, 20, 0, 0, 430);
  background.addColorStop(0, "#2f7767");
  background.addColorStop(1, "#17473f");
  context.fillStyle = background;
  context.fillRect(-width / (2 * scale), -height / (2 * scale), width / scale, height / scale);

  context.fillStyle = "rgba(0, 0, 0, .2)";
  context.beginPath();
  context.ellipse(0, 174, 276, 25, 0, 0, Math.PI * 2);
  context.fill();

  if (state.heaterOn) {
    const glow = context.createRadialGradient(-150, -92, 6, -150, -92, 188);
    glow.addColorStop(0, `rgba(239, 181, 86, ${0.2 + (state.reduceMotion ? 0 : Math.sin(time / 340) * 0.035)})`);
    glow.addColorStop(1, "rgba(239, 181, 86, 0)");
    context.fillStyle = glow;
    context.fillRect(-340, -280, 380, 380);
  }

  // Glass chamber and its quiet structural frame.
  context.beginPath();
  context.roundRect(-258, -150, 516, 302, 20);
  context.fillStyle = "rgba(196, 229, 211, .065)";
  context.fill();
  context.strokeStyle = state.alarm ? "rgba(218, 104, 88, .82)" : "rgba(184, 215, 198, .34)";
  context.lineWidth = 2;
  context.stroke();

  context.fillStyle = "rgba(222, 240, 229, .07)";
  context.fillRect(-244, -137, 488, 7);
  context.fillRect(-244, 133, 488, 7);
  context.fillStyle = "#7a8c7e";
  context.fillRect(-267, 145, 534, 16);
  context.fillStyle = "#255f53";
  context.fillRect(-248, 161, 18, 14);
  context.fillRect(230, 161, 18, 14);

  // Heater lamp.
  context.beginPath();
  context.roundRect(-188, -128, 76, 13, 7);
  context.fillStyle = state.heaterOn ? "#f1c368" : "#64746b";
  context.fill();
  context.beginPath();
  context.ellipse(-150, -107, 25, 7, 0, 0, Math.PI * 2);
  context.fillStyle = state.heaterOn ? "rgba(255, 210, 119, .48)" : "rgba(148, 164, 153, .12)";
  context.fill();

  // Fan and airflow.
  context.save();
  context.translate(183, -66);
  context.beginPath();
  context.arc(0, 0, 40, 0, Math.PI * 2);
    context.fillStyle = "rgba(23, 71, 63, .9)";
  context.fill();
  context.strokeStyle = "rgba(176, 207, 188, .48)";
  context.lineWidth = 2;
  context.stroke();
  context.rotate(state.fanOn && !state.reduceMotion ? time / 145 : 0);
  for (let blade = 0; blade < 4; blade += 1) {
    context.rotate(Math.PI / 2);
    context.beginPath();
    context.ellipse(0, -17, 8, 17, 0, 0, Math.PI * 2);
    context.fillStyle = state.fanOn ? "#a7bf9a" : "#788a78";
    context.fill();
  }
  context.beginPath();
  context.arc(0, 0, 5, 0, Math.PI * 2);
  context.fillStyle = "#d7e3d9";
  context.fill();
  context.restore();

  if (state.fanOn) {
    context.save();
    context.strokeStyle = "rgba(119, 189, 164, .34)";
    context.lineWidth = 2;
    context.setLineDash([8, 10]);
    const drift = state.reduceMotion ? 0 : (time / 35) % 18;
    for (let line = 0; line < 3; line += 1) {
      context.beginPath();
      context.moveTo(-60, -45 + line * 18);
      context.bezierCurveTo(5, -60 + line * 18, 65, -8 + line * 18, 125, -37 + line * 18);
      context.lineDashOffset = -drift - line * 5;
      context.stroke();
    }
    context.restore();
  }

  // Rotating tray follows the servo angle reported by the node.
  context.save();
  context.translate(0, 63);
  context.rotate(((state.angle - 90) * Math.PI) / 180);
  context.beginPath();
  context.ellipse(0, 0, 172, 54, 0, 0, Math.PI * 2);
  context.fillStyle = "#6cb7d3";
  context.fill();
  context.strokeStyle = "rgba(207, 235, 243, .78)";
  context.lineWidth = 3;
  context.stroke();
  context.beginPath();
  context.ellipse(0, 0, 145, 39, 0, 0, Math.PI * 2);
  context.strokeStyle = "rgba(48, 109, 128, .42)";
  context.lineWidth = 1;
  context.stroke();
  const eggPositions: Array<[number, number]> = [[-65, -5], [0, 8], [65, -5]];
  eggPositions.forEach(([x, y], index) => {
    context.beginPath();
    context.ellipse(x, y + 11, 24, 13, 0, 0, Math.PI * 2);
    context.fillStyle = "rgba(7, 13, 10, .25)";
    context.fill();
    if (index < state.occupied) drawEgg(context, x, y - 2, 0.82);
    else {
      context.beginPath();
      context.ellipse(x, y - 1, 13, 8, 0, 0, Math.PI * 2);
      context.strokeStyle = "rgba(151, 176, 158, .42)";
      context.lineWidth = 1.5;
      context.stroke();
    }
  });
  context.restore();

  // Small status lights keep the machine legible without turning the scene into a control panel.
  context.fillStyle = state.alarm ? "#de7565" : "#89b08c";
  context.beginPath();
  context.arc(-231, -118, 4, 0, Math.PI * 2);
  context.fill();

  context.restore();
}

export function IncubatorCanvas(props: IncubatorCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const propsRef = useRef(props);
  const drawOnceRef = useRef<(() => void) | null>(null);
  const frameRef = useRef(0);
  propsRef.current = props;

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    let width = 0;
    let height = 0;
    const render = (time: number) => drawIncubator(context, width, height, time, propsRef.current);
    drawOnceRef.current = () => render(performance.now());

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      render(performance.now());
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frameRef.current);
      drawOnceRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (props.reduceMotion) {
      window.cancelAnimationFrame(frameRef.current);
      drawOnceRef.current?.();
      return;
    }

    let lastDraw = 0;
    const animate = (time: number) => {
      if (time - lastDraw >= 33) {
        drawOnceRef.current?.();
        lastDraw = time;
      }
      frameRef.current = window.requestAnimationFrame(animate);
    };
    frameRef.current = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frameRef.current);
  }, [props.reduceMotion]);

  useEffect(() => {
    if (props.reduceMotion) drawOnceRef.current?.();
  }, [props.angle, props.alarm, props.fanOn, props.heaterOn, props.occupied, props.capacity, props.reduceMotion]);

  return (
    <canvas
      ref={canvasRef}
      className="incubator-canvas"
      role="img"
      aria-label={`Gemelo digital de SmartEgg. ${props.isOnline ? `Bandeja a ${Math.round(props.angle)} grados, foco ${props.heaterOn ? "encendido" : "apagado"}, ventilador ${props.fanOn ? "encendido" : "apagado"}, ${props.occupied} de ${props.capacity} espacios ocupados` : "Esperando telemetría MQTT del nodo"}${props.alarm ? ", bloqueo crítico activo" : ""}.`}
    />
  );
}
