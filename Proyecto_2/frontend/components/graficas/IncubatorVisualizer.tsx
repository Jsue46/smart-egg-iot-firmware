"use client";

import React from "react";
import { motion } from "motion/react";

export const IncubatorVisualizer: React.FC = () => {
    return (
        <motion.section
        className="incubator-hero p5-visualizer-hero"
        aria-label="Visualización p5.js de la incubadora"
        variants={{ hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0 } }}
        >
        <div className="hero-copy">
            <span className="hero-kicker">
            <span /> Monitoreo en tiempo real
            </span>
            <h2>
            Cámara de incubación <em>interactiva.</em>
            </h2>
            <p>
            La visualización representa el estado de la incubadora y actualiza sus
            lecturas desde la API REST del backend.
            </p>
        </div>
        <div
            className="scene-wrap p5-scene-wrap"
            style={{
            position: "relative",
            width: "100%",
            minHeight: "340px",
            height: "100%",
            display: "flex",
            borderRadius: "16px",
            overflow: "hidden",
            }}
        >
            <iframe
            src="/visualizacion_p5.html"
            title="Visualización p5.js SmartEgg"
            style={{
                width: "100%",
                height: "100%",
                minHeight: "340px",
                border: "none",
                display: "block",
            }}
            />
        </div>
        </motion.section>
    );
};