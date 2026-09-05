const DAY = 86_400_000;

const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });
const dateTimeFmt = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return dateFmt.format(typeof d === "string" ? new Date(d) : d);
}

export function formatDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return dateTimeFmt.format(typeof d === "string" ? new Date(d) : d);
}

export function relativeTime(d: Date | string, now: Date = new Date()): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const diff = now.getTime() - date.getTime();
  const abs = Math.abs(diff);
  const future = diff < 0;
  const mins = Math.round(abs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return future ? `in ${mins}m` : `${mins}m ago`;
  const hours = Math.round(abs / 3_600_000);
  if (hours < 24) return future ? `in ${hours}h` : `${hours}h ago`;
  const days = Math.round(abs / DAY);
  if (days < 30) return future ? `in ${days}d` : `${days}d ago`;
  return formatDate(date);
}

export function daysSince(d: Date | string, now: Date = new Date()): number {
  const date = typeof d === "string" ? new Date(d) : d;
  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / DAY));
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** True when `date` is in the past. Kept in a helper so pages don't read the clock inline. */
export function isPast(date: Date | string | null | undefined): boolean {
  if (!date) return false;
  const d = typeof date === "string" ? new Date(date) : date;
  return d.getTime() < new Date().getTime();
}
