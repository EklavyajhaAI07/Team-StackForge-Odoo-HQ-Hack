"use client";

import { NumberTicker } from "./NumberTicker";
import { cn } from "@/lib/cn";

/**
 * 270° gauge. Stroke sweeps via stroke-dashoffset (500ms, §3.4 motion #2).
 * Colour = meaning: 0 → mint, ≤ manager threshold → amber, above → coral.
 */
export function RiskArc({
  value,
  managerMax,
  financeMax,
  size = 176,
  label = "Blended risk",
  className,
}: {
  value: number;
  managerMax: number;
  financeMax: number;
  size?: number;
  label?: string;
  className?: string;
}) {
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const sweep = 0.75; // 270°
  const scaleMax = Math.max(financeMax * 2, managerMax * 3, 10);
  const pct = Math.max(0, Math.min(1, value / scaleMax));
  const dash = c * sweep;
  const offset = dash - dash * pct;
  const color = value <= 0 ? "var(--money)" : value <= managerMax ? "var(--warn)" : "var(--danger)";
  const verdict =
    value <= 0 ? "Within policy" : value <= managerMax ? "Needs manager sign-off" : "Needs manager + finance";

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(135deg)" }}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="var(--raised)"
            strokeWidth={stroke}
            strokeDasharray={`${dash} ${c}`}
            strokeLinecap="round"
          />
          <circle
            className="risk-arc"
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeDasharray={`${dash} ${c}`}
            strokeDashoffset={offset}
            strokeLinecap="round"
          />
          {/* manager threshold tick */}
          <ThresholdTick size={size} r={r} stroke={stroke} fraction={Math.min(1, managerMax / scaleMax)} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <NumberTicker value={value} format={(n) => n.toFixed(1)} className="display text-[36px] leading-none" />
          <span className="mt-1 text-[11px] text-muted">pts over ceiling</span>
        </div>
      </div>
      <p className="mt-1 text-[13px] text-muted">{label}</p>
      <p className="text-[13px] font-medium" style={{ color }}>
        {verdict}
      </p>
    </div>
  );
}

function ThresholdTick({ size, r, stroke, fraction }: { size: number; r: number; stroke: number; fraction: number }) {
  const angle = fraction * 270 * (Math.PI / 180); // relative to the rotated start
  const cx = size / 2;
  const cy = size / 2;
  const inner = r - stroke / 2 - 3;
  const outer = r + stroke / 2 + 3;
  const x1 = cx + inner * Math.cos(angle);
  const y1 = cy + inner * Math.sin(angle);
  const x2 = cx + outer * Math.cos(angle);
  const y2 = cy + outer * Math.sin(angle);
  return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--muted)" strokeWidth={2} strokeLinecap="round" />;
}
