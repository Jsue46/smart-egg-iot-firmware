import type { SVGProps } from "react";

export interface EggIconProps extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?: number;
  color?: string;
}

const common = (size: number, color: string) => ({
  width: size,
  height: size,
  viewBox: "0 0 48 48",
  fill: "none",
  stroke: color,
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
});

function EggShell() {
  return <path d="M24 4.5c-7.1 0-13.4 10.8-13.4 22.3C10.6 37 16.2 43.5 24 43.5S37.4 37 37.4 26.8C37.4 15.3 31.1 4.5 24 4.5Z" />;
}

export function TemperatureIcon({ size = 48, color = "currentColor", ...props }: EggIconProps) {
  return (
    <svg {...common(size, color)} {...props}>
      <EggShell />
      <path d="M22 18.5v10.2a4 4 0 1 0 4 0V18.5a2 2 0 0 0-4 0Z" />
      <path d="M24 24.5v7.2" strokeWidth="2.6" />
      <path d="M28.8 20.5h2.8M28.8 24h2" />
    </svg>
  );
}

export function HumidityIcon({ size = 48, color = "currentColor", ...props }: EggIconProps) {
  return (
    <svg {...common(size, color)} {...props}>
      <EggShell />
      <path d="M24 16.2c0 0-6.4 7.3-6.4 12a6.4 6.4 0 0 0 12.8 0c0-4.7-6.4-12-6.4-12Z" />
      <path d="M21.1 30.6c.8 1.1 1.8 1.6 3.2 1.6" />
    </svg>
  );
}

export function RotationIcon({ size = 48, color = "currentColor", ...props }: EggIconProps) {
  return (
    <svg {...common(size, color)} {...props}>
      <EggShell />
      <path d="M16.5 28.2a8.2 8.2 0 0 0 14.4 3.7M31.5 23.1a8.2 8.2 0 0 0-14.7-3.4" />
      <path d="m14.6 23.1 2.2-3.4 3.7 1.5M33.6 28.6l-2.7 3.3-3.5-2" />
      <circle cx="24" cy="26" r="2.2" />
    </svg>
  );
}

export function AlarmIcon({ size = 48, color = "currentColor", ...props }: EggIconProps) {
  return (
    <svg {...common(size, color)} {...props}>
      <EggShell />
      <circle cx="24" cy="27" r="2.2" fill={color} stroke="none" />
      <path d="M24 17.2v5.5M17.2 20.2l3.2 3M30.8 20.2l-3.2 3M16 27h-3M35 27h-3" />
    </svg>
  );
}

export function CapacityIcon({ size = 48, color = "currentColor", ...props }: EggIconProps) {
  return (
    <svg {...common(size, color)} {...props}>
      <EggShell />
      {[18, 24, 30].flatMap((x, row) =>
        [23, 29].map((y, column) => (
          <ellipse
            key={`${x}-${y}`}
            cx={x}
            cy={y}
            rx="2.3"
            ry="3"
            fill={row + column < 3 ? color : "none"}
          />
        )),
      )}
    </svg>
  );
}

export function LotIcon({ size = 48, color = "currentColor", ...props }: EggIconProps) {
  return (
    <svg {...common(size, color)} {...props}>
      <EggShell />
      <path d="m20 22 8.8-2.7 4.6 4.6-2.7 8.8-8.9-1.1L20 22Z" fill="white" />
      <circle cx="28.6" cy="23.7" r="1.2" fill={color} stroke="none" />
    </svg>
  );
}

export function ConnectionIcon({ size = 48, color = "currentColor", ...props }: EggIconProps) {
  return (
    <svg {...common(size, color)} {...props}>
      <EggShell />
      <circle cx="24" cy="27" r="2.4" fill={color} stroke="none" />
      <path d="M19.7 23.2a6.1 6.1 0 0 1 8.6 0M16.7 20.2a10.4 10.4 0 0 1 14.6 0" />
    </svg>
  );
}

export function ReportIcon({ size = 48, color = "currentColor", ...props }: EggIconProps) {
  return (
    <svg {...common(size, color)} {...props}>
      <EggShell />
      <path d="M17 31.5h14M18.5 28l4-4 3.2 2.5 4.3-6" />
      <circle cx="18.5" cy="28" r="1" fill={color} stroke="none" />
      <circle cx="22.5" cy="24" r="1" fill={color} stroke="none" />
      <circle cx="25.7" cy="26.5" r="1" fill={color} stroke="none" />
      <circle cx="30" cy="20.5" r="1" fill={color} stroke="none" />
    </svg>
  );
}

export function DashboardIcon({ size = 48, color = "currentColor", ...props }: EggIconProps) {
  return (
    <svg {...common(size, color)} {...props}>
      <EggShell />
      <path d="M17.5 29.5a7.2 7.2 0 0 1 13 0M24 28l4-4" />
      <path d="M18.7 25.2h.1M24 22.5h.1M29.3 25.2h.1" strokeWidth="2.4" />
    </svg>
  );
}

export function PlusEggIcon({ size = 24, color = "currentColor", ...props }: EggIconProps) {
  return (
    <svg {...common(size, color)} {...props}>
      <EggShell />
      <path d="M24 19v14M17 26h14" strokeWidth="2" />
    </svg>
  );
}

export function MenuIcon({ size = 24, color = "currentColor", ...props }: EggIconProps) {
  return (
    <svg {...common(size, color)} {...props}>
      <EggShell />
      <path d="M17.5 20.5h13M17.5 25.5h13M17.5 30.5h9" strokeWidth="1.9" />
    </svg>
  );
}

export function PauseIcon({ size = 20, color = "currentColor", ...props }: EggIconProps) {
  return (
    <svg {...common(size, color)} {...props} viewBox="0 0 24 24">
      <path d="M7 5h3v14H7zM14 5h3v14h-3z" fill={color} stroke="none" />
    </svg>
  );
}

export function PlayIcon({ size = 20, color = "currentColor", ...props }: EggIconProps) {
  return (
    <svg {...common(size, color)} {...props} viewBox="0 0 24 24">
      <path d="m8 5 11 7-11 7V5Z" fill={color} stroke="none" />
    </svg>
  );
}

export function DownloadIcon({ size = 20, color = "currentColor", ...props }: EggIconProps) {
  return (
    <svg {...common(size, color)} {...props} viewBox="0 0 24 24">
      <path d="M12 3v12m-5-5 5 5 5-5M5 20h14" />
    </svg>
  );
}

export function ExpandIcon({ size = 20, color = "currentColor", ...props }: EggIconProps) {
  return (
    <svg {...common(size, color)} {...props} viewBox="0 0 24 24">
      <path d="M8 4H4v4M16 4h4v4M4 16v4h4M20 16v4h-4" />
    </svg>
  );
}

export function CloseIcon({ size = 20, color = "currentColor", ...props }: EggIconProps) {
  return (
    <svg {...common(size, color)} {...props} viewBox="0 0 24 24">
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}

export function RotateLeftIcon({ size = 20, color = "currentColor", ...props }: EggIconProps) {
  return (
    <svg {...common(size, color)} {...props} viewBox="0 0 24 24">
      <path d="M8 6H4v4M4.5 9.5A8 8 0 1 0 7 5.7" />
      <path d="M4 10V6h4" />
    </svg>
  );
}

export function RotateRightIcon({ size = 20, color = "currentColor", ...props }: EggIconProps) {
  return (
    <svg {...common(size, color)} {...props} viewBox="0 0 24 24">
      <path d="M16 6h4v4M19.5 9.5A8 8 0 1 1 17 5.7" />
      <path d="M20 10V6h-4" />
    </svg>
  );
}

export function ZoomOutIcon({ size = 20, color = "currentColor", ...props }: EggIconProps) {
  return (
    <svg {...common(size, color)} {...props} viewBox="0 0 24 24">
      <circle cx="10.8" cy="10.8" r="6.4" />
      <path d="M8.1 10.8h5.4M15.5 15.5 20 20" />
    </svg>
  );
}

export function ZoomInIcon({ size = 20, color = "currentColor", ...props }: EggIconProps) {
  return (
    <svg {...common(size, color)} {...props} viewBox="0 0 24 24">
      <circle cx="10.8" cy="10.8" r="6.4" />
      <path d="M8.1 10.8h5.4M10.8 8.1v5.4M15.5 15.5 20 20" />
    </svg>
  );
}

export function UserIcon({ size = 20, color = "currentColor", ...props }: EggIconProps) {
  return (
    <svg {...common(size, color)} {...props} viewBox="0 0 48 48">
      <EggShell />
      <circle cx="24" cy="19.5" r="5.5" />
      <path d="M15.5 34c1.7-4.6 5-6.9 8.5-6.9s6.8 2.3 8.5 6.9" />
    </svg>
  );
}

export function LogoutIcon({ size = 20, color = "currentColor", ...props }: EggIconProps) {
  return (
    <svg {...common(size, color)} {...props} viewBox="0 0 24 24">
      <path d="M10 5H5v14h5M14 8l4 4-4 4M9 12h9" />
    </svg>
  );
}

export function DoorIcon({ size = 48, color = "currentColor", ...props }: EggIconProps) {
  return (
    <svg {...common(size, color)} {...props}>
      <EggShell />
      <path d="M14 42V16c0-2.8 2.2-5 5-5h10c2.8 0 5 2.2 5 5v26" />
      <path d="M14 42h20M21.5 42V27h5v15" />
      <circle cx="29.5" cy="23" r="1.5" fill={color} stroke="none" />
    </svg>
  );
}

export function AdminIcon({ size = 48, color = "currentColor", ...props }: EggIconProps) {
  return (
    <svg {...common(size, color)} {...props}>
      <EggShell />
      <path d="M18 21v11.5c0 0 6 4.2 6 4.2s6-4.2 6-4.2V21" />
      <path d="M20.5 26l2.6 2.6 4.4-4.6" strokeWidth="2" />
    </svg>
  );
}
