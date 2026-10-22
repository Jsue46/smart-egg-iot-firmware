import { VisionEggIcon } from "@/components/icons/egg-icons";

interface VisionStatusCardProps {
  visionClass: string | null;
  confidence: number | null;
  isLocked: boolean;
}

const VISION_LABELS: Record<string, string> = {
  huevo: "Huevo",
  vacio: "Vacío",
  objeto_extrano: "Objeto extraño",
};

export function VisionStatusCard({ visionClass, confidence, isLocked }: VisionStatusCardProps) {
  const tone = isLocked || visionClass === "objeto_extrano" ? "alert" : visionClass === "huevo" ? "safe" : "neutral";
  const label = isLocked ? "Objeto extraño" : visionClass ? VISION_LABELS[visionClass] ?? visionClass.replaceAll("_", " ") : "Sin lectura";
  const value = confidence === null ? 0 : Math.max(0, Math.min(100, confidence));

  return (
    <article className={`vision-status-card ${tone}`} aria-labelledby="vision-card-title">
      <header className="dashboard-card-heading">
        <span className="dashboard-card-title">
          <span className="dashboard-card-icon vision-icon" aria-hidden="true"><VisionEggIcon size={26} /></span>
          <span id="vision-card-title">Visión artificial</span>
        </span>
        {isLocked ? <span className="vision-state-tag alert">Bloqueo activo</span> : null}
      </header>
      <div className="vision-status-copy">
        <div className="vision-result-row"><strong>{label}</strong></div>
        {confidence !== null ? (
          <div className="vision-confidence-block">
            <div className="vision-confidence-head"><span>Confianza</span><strong>{value.toFixed(1)}%</strong></div>
            <div className="vision-confidence-track" role="progressbar" aria-label="Confianza de clasificación visual" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}>
              <span style={{ width: `${value}%` }} />
            </div>
          </div>
        ) : null}
      </div>
    </article>
  );
}
