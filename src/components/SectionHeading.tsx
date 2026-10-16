import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Shared editorial section header — the visual language established by
 * the "Your Journey" timeline: hairline rule + spaced eyebrow, a light
 * oversized title, and a calm supporting line.
 */
export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  className,
}: {
  eyebrow: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("max-w-none", className)}>
      <div className="flex items-center gap-3">
        <span className="h-px w-8 bg-accent shrink-0" aria-hidden />
        <span className="text-[1.5rem] font-semibold uppercase tracking-[0.28em] text-primary/70 whitespace-nowrap">
          {eyebrow}
        </span>
      </div>
      <h2 className="mt-5 text-[4.25rem] md:text-[5.5rem] leading-[1.12] font-bold tracking-tight text-primary whitespace-normal break-words">
        {title}
      </h2>
      {subtitle ? (
        <div className="mt-4 max-w-3xl text-[2rem] md:text-[2.25rem] leading-relaxed text-muted-foreground whitespace-normal">
          {subtitle}
        </div>
      ) : null}
    </header>
  );
}
