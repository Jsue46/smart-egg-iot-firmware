"use client";

import React, { useEffect, useState } from "react";
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend,
    Filler
    } from "chart.js";
    import { Line, Bar } from "react-chartjs-2";

    ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend,
    Filler
    );

    interface Lectura {
    id: number;
    temperatura: number;
    humedad: number;
    espacios_libres: number;
    timestamp: string;
    }

    export const AnalyticsCharts: React.FC = () => {
    const [historial, setHistorial] = useState<Lectura[]>([]);

    const fetchHistorial = async () => {
        try {
        const res = await fetch("http://127.0.0.1:5000/historial");
        if (res.ok) {
            const data: Lectura[] = await res.json();
            setHistorial(data.slice(0, 15).reverse());
        }
        } catch (err) {
        console.error("Error al cargar historial:", err);
        }
    };

    useEffect(() => {
        fetchHistorial();
        const interval = setInterval(fetchHistorial, 4000);
        return () => clearInterval(interval);
    }, []);

    const labels = historial.map((h) => h.timestamp.split(" ")[1] || `${h.id}`);

    const lineData = {
        labels,
        datasets: [
        {
            label: "Temperatura (°C)",
            data: historial.map((h) => h.temperatura),
            borderColor: "#d97706",
            backgroundColor: "rgba(217, 119, 6, 0.08)",
            fill: true,
            tension: 0.35,
            pointBackgroundColor: "#ffffff",
            pointBorderColor: "#d97706",
            pointBorderWidth: 2,
        },
        {
            label: "Humedad (%)",
            data: historial.map((h) => h.humedad),
            borderColor: "#1e3d34",
            backgroundColor: "rgba(30, 61, 52, 0.04)",
            fill: true,
            tension: 0.35,
            pointBackgroundColor: "#ffffff",
            pointBorderColor: "#1e3d34",
            pointBorderWidth: 2,
        },
        ],
    };

    const barData = {
        labels,
        datasets: [
        {
            label: "Huevos en Cámara (0-3)",
            data: historial.map((h) => Math.max(0, 3 - h.espacios_libres)),
            backgroundColor: "#2d5a4c",
            hoverBackgroundColor: "#1e3d34",
            borderRadius: 6,
        },
        ],
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-6">
        {/* Tarjeta Historial de Variables */}
        <div className="bg-[#fdfefe] border border-[#e2e7dd] p-6 rounded-2xl shadow-sm">
            <div className="mb-4">
            <span className="text-[11px] font-bold tracking-wider text-[#5f756b] uppercase">
                Analítica de Sensores
            </span>
            <h3 className="text-[#192e26] font-serif text-lg font-bold mt-0.5">
                Historial Térmico y Humedad Relativa
            </h3>
            </div>
            <Line
            data={lineData}
            options={{
                responsive: true,
                scales: {
                y: {
                    grid: { color: "#f0f2ed" },
                    ticks: { color: "#5f756b", font: { size: 11 } },
                },
                x: {
                    grid: { display: false },
                    ticks: { color: "#5f756b", font: { size: 10 } },
                },
                },
                plugins: {
                legend: {
                    labels: { color: "#192e26", font: { size: 12, weight: 600 } },
                },
                },
            }}
            />
        </div>

        {/* Tarjeta Histórico de Huevos Ocupados */}
        <div className="bg-[#fdfefe] border border-[#e2e7dd] p-6 rounded-2xl shadow-sm">
            <div className="mb-4">
            <span className="text-[11px] font-bold tracking-wider text-[#5f756b] uppercase">
                Registro de Ocupación
            </span>
            <h3 className="text-[#192e26] font-serif text-lg font-bold mt-0.5">
                Capacidad Utilizada en Bandeja 3D
            </h3>
            </div>
            <Bar
            data={barData}
            options={{
                responsive: true,
                scales: {
                y: {
                    min: 0,
                    max: 3,
                    ticks: { stepSize: 1, color: "#5f756b", font: { size: 11 } },
                    grid: { color: "#f0f2ed" },
                },
                x: {
                    grid: { display: false },
                    ticks: { color: "#5f756b", font: { size: 10 } },
                },
                },
                plugins: {
                legend: {
                    labels: { color: "#192e26", font: { size: 12, weight: 600 } },
                },
                },
            }}
            />
        </div>
        </div>
    );
};