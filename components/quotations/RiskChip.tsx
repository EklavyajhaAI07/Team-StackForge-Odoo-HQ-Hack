import { Pill } from "@/components/ui/Pill";

/** Compact blended-risk indicator for lists and kanban cards. Colour = meaning. */
export function RiskChip({ blended, maxLineOverage, managerMax = 3 }: { blended: number; maxLineOverage: number; managerMax?: number }) {
  if (blended <= 0 && maxLineOverage <= 0) return <Pill tone="money">Within policy</Pill>;
  const tone = blended <= managerMax ? "warn" : "danger";
  return (
    <Pill tone={tone} title={`Blended ${blended.toFixed(1)} pts · worst line ${maxLineOverage.toFixed(1)} pts over`}>
      <span className="num">{blended.toFixed(1)}</span> pts
    </Pill>
  );
}
