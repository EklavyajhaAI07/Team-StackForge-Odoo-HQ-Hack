import Image from "next/image";
import mark from "@/public/logo-mark.png";
import lockup from "@/public/logo.png";
import { cn } from "@/lib/cn";

/**
 * The DealFlow360 mark.
 *
 * The supplied artwork sets its wordmark in white, which disappears on the portal's
 * cream ground — so the full lockup is for dark surfaces only, and anywhere light uses
 * `variant="mark"` with live text beside it. Both files are keyed to transparency, so
 * neither carries the original black plate.
 */
export function Logo({
  variant = "mark",
  size = 22,
  withWordmark = false,
  className,
  priority,
}: {
  /** `lockup` is the mark over the wordmark, and only reads on a dark ground. */
  variant?: "mark" | "lockup";
  /** Rendered height in pixels. */
  size?: number;
  /** Set the wordmark in live text beside the mark, so it stays crisp and selectable. */
  withWordmark?: boolean;
  className?: string;
  priority?: boolean;
}) {
  if (variant === "lockup") {
    return (
      <Image
        src={lockup}
        alt="DealFlow360"
        height={size}
        width={Math.round((size * lockup.width) / lockup.height)}
        priority={priority}
        className={cn("h-auto w-auto", className)}
        style={{ height: size }}
      />
    );
  }

  const img = (
    <Image
      src={mark}
      alt={withWordmark ? "" : "DealFlow360"}
      height={size}
      width={size}
      priority={priority}
      style={{ height: size, width: size }}
      className="shrink-0"
    />
  );

  if (!withWordmark) return <span className={className}>{img}</span>;

  return (
    <span className={cn("flex items-center gap-2", className)}>
      {img}
      <span className="display tracking-tight" style={{ fontSize: Math.round(size * 0.62) }}>
        DealFlow<span className="text-primary">360</span>
      </span>
    </span>
  );
}
