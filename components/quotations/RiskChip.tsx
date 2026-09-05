import { Pill } from "@/components/ui/Pill";

/**
 * Blended risk at a glance. When a quotation is within policy there is nothing to say,
 * so it says nothing loudly: colour is spent only where a human has to look.
 * A column of identical green badges is noise, not information.
 */
export function RiskChip({
  blended,
  maxLineOverage,
  managerMax = 3,
}: {
  blended: number;
  maxLineOverage: number;
  managerMax?: number;
}) {
  if (blended <= 0 && maxLineOverage <= 0) {
    return <span className="text-[12px] text-faint">Within policy</span>;
  }
  const tone = blended <= managerMax ? "warn" : "danger";
  return (
    <Pill tone={tone} title={`Blended ${blended.toFixed(1)} pts · worst line ${maxLineOverage.toFixed(1)} pts over`}>
      <span className="num">{blended.toFixed(1)}</span> pts
    </Pill>
  );
}
