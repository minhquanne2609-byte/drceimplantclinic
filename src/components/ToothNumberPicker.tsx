import { useMemo, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { X } from "lucide-react";
import { useZoomCounterScale } from "@/hooks/use-zoom-counter-scale";

const QUADRANTS: { label: string; teeth: number[] }[] = [
  { label: "Upper right (Q1)", teeth: [11, 12, 13, 14, 15, 16, 17, 18] },
  { label: "Upper left (Q2)", teeth: [21, 22, 23, 24, 25, 26, 27, 28] },
  { label: "Lower right (Q4)", teeth: [41, 42, 43, 44, 45, 46, 47, 48] },
  { label: "Lower left (Q3)", teeth: [31, 32, 33, 34, 35, 36, 37, 38] },
];

const JAWS = ["Upper jaw", "Lower jaw"];

const ALL_TEETH_NUMBERS = QUADRANTS.flatMap((q) => q.teeth);

export function parseTokens(value: string): string[] {
  return (value || "")
    .split(/[,;+/]/)
    .map((t) => t.trim())
    .filter((t) => t && t !== "—");
}

/** Expand a token like "13-15" into [13,14,15]. Jaw labels pass through. */
export function expandToken(t: string): string[] {
  const m = t.match(/^(\d{2})\s*[-–—]\s*(\d{2})$/);
  if (!m) return [t];
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (a > b) return Array.from({ length: a - b + 1 }, (_, i) => String(a - i));
  return Array.from({ length: b - a + 1 }, (_, i) => String(a + i));
}

/**
 * List a sorted, deduped set of tooth numbers as individual entries — e.g.
 * 26 and 27 become "26, 27", never collapsed into a dash range like
 * "26-27". Kept as one canonical format so the count of teeth always
 * matches the number of entries shown, with nothing to mis-parse.
 */
function collapseToRanges(items: string[]): string[] {
  const uniq = Array.from(new Set(items));
  const nums = uniq
    .filter((t) => /^\d{2}$/.test(t))
    .map(Number)
    .sort((a, b) => a - b)
    .map(String);
  const others = uniq.filter((t) => !/^\d{2}$/.test(t));
  return [...nums, ...others];
}

/**
 * Break a tooth-number value into evenly-sized lines for display (e.g. 4
 * tooth entries per line) instead of one long comma-separated run. Each
 * "entry" here is a single tooth number, matching how the entries are shown
 * on screen (never a collapsed "13-15" range).
 */
export function formatTeethLines(value: string, perLine = 4): string[] {
  const tokens = parseTokens(value);
  const expanded = tokens.flatMap(expandToken);
  const ranges = collapseToRanges(expanded);
  if (ranges.length === 0) return [];
  const lines: string[] = [];
  for (let i = 0; i < ranges.length; i += perLine) {
    lines.push(ranges.slice(i, i + perLine).join(", "));
  }
  return lines;
}

/**
 * Multi-select tooth-number picker: pick any number of teeth across the four
 * quadrants, plus whole-jaw options. Also allows free text entry.
 *
 * Each pick is always listed individually (e.g. "26, 27"), never collapsed
 * into a dash range like "26-27" — this keeps the tooth count and the
 * displayed entries always in agreement. Shift+click two teeth to select
 * the whole range between them.
 */
export function ToothNumberPicker({
  value,
  onChange,
  className = "text-[2rem]",
  printClassName = "dx-print-text",
  printAlign = "text-center",
}: {
  value: string;
  onChange: (v: string) => void;
  /** Wrapper font-size class. Override when the surrounding table already
   * sets the size this should match (e.g. the Treatment Plan's Teeth column,
   * which should read at the same size as its Qty column, not its own fixed
   * size). */
  className?: string;
  /** Extra class on the print-only span, on top of `className` above. Pass
   * "" to skip it (e.g. so the print size just follows `className`/the
   * ambient table size instead of the Diagnosis table's own fixed print size). */
  printClassName?: string;
  /** Text alignment for the print-only span. The Diagnosis table's "Tooth"
   * header is left-aligned, so its centered default made the tooth number
   * visibly drift right of the header above it — pass "text-left" there. */
  printAlign?: string;
}) {
  const [open, setOpen] = useState(false);
  // Keeps the quadrant grid readable/clickable when the page is zoomed way
  // out (browser Ctrl -) to fit a whole treatment plan on screen — without
  // this the popover shrinks along with everything else and the tooth
  // numbers become too small to read or hit.
  const zoomCounterScale = useZoomCounterScale(open);
  const [rangeAnchor, setRangeAnchor] = useState<string | null>(null);
  const tokens = parseTokens(value);
  const expanded = useMemo(() => tokens.flatMap(expandToken), [tokens]);

  const has = (t: string) => tokens.some((x) => x.toLowerCase() === t.toLowerCase());
  const hasNumber = (n: number) => expanded.includes(String(n));

  const commit = (nextTokens: string[]) => {
    onChange(collapseToRanges(nextTokens).join(", "));
  };

  const toggle = (t: string, e?: React.MouseEvent) => {
    if (/^\d{2}$/.test(t) && e?.shiftKey && rangeAnchor) {
      // Shift+click: select everything between anchor and clicked tooth
      const a = Number(rangeAnchor);
      const b = Number(t);
      const [lo, hi] = a < b ? [a, b] : [b, a];
      const range = ALL_TEETH_NUMBERS.filter((n) => n >= lo && n <= hi).map(String);
      const next = Array.from(new Set([...expanded, ...range]));
      commit(next);
      setRangeAnchor(null);
      return;
    }

    if (/^\d{2}$/.test(t)) {
      setRangeAnchor(t);
      // Work on the expanded list so a tooth already inside a range (e.g. 13-15)
      // is recognised and never added twice.
      const next = hasNumber(Number(t)) ? expanded.filter((x) => x !== t) : Array.from(new Set([...expanded, t]));
      commit(next);
      return;
    }

    const next = has(t)
      ? tokens.filter((x) => x.toLowerCase() !== t.toLowerCase())
      : Array.from(new Set([...tokens, t]));
    commit(next);
  };

  const toggleQuadrant = (teeth: number[]) => {
    const all = teeth.map(String);
    const allOn = all.every((t) => hasNumber(Number(t)));
    const next = allOn ? expanded.filter((x) => !all.includes(x)) : Array.from(new Set([...expanded, ...all]));
    commit(next);
  };

  const displayRanges = useMemo(() => collapseToRanges(expanded), [expanded]);
  const printLines = useMemo(() => formatTeethLines(value, 4), [value]);

  return (
    <div className={className}>
      {/* Print: even rows of teeth (4 per line), never one long staggered line */}
      <span className={`hidden print:block leading-snug ${printAlign}${printClassName ? ` ${printClassName}` : ""}`}>
        {printLines.length
          ? printLines.map((line, i) => (
              <span key={i} className="block whitespace-nowrap">
                {line}
              </span>
            ))
          : "—"}
      </span>
      <div className="flex flex-wrap items-center gap-1.5 print:hidden max-h-[7rem] overflow-y-auto">
        {displayRanges.length === 0 && <span className="text-muted-foreground print:hidden">—</span>}

        {displayRanges.map((t) => (
          <span
            key={t}
            className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2.5 py-1 font-medium text-primary"
          >
            {t}
            <button
              type="button"
              onClick={() => {
                const next = expanded.filter((x) => x.toLowerCase() !== t.toLowerCase() && !expandToken(t).includes(x));
                commit(next);
              }}
              className="print:hidden opacity-60 hover:opacity-100"
              aria-label={`Remove ${t}`}
            >
              <X size={14} />
            </button>
          </span>
        ))}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="print:hidden rounded-md border border-dashed border-border px-2.5 py-1 text-muted-foreground hover:border-primary hover:text-primary"
            >
              + Teeth
            </button>
          </PopoverTrigger>
          {/* The card's own background/border/shadow live on this inner div
              (not on PopoverContent) so they scale up together with the
              content below — otherwise the counter-scaled numbers spill out
              past a small, unscaled white box left behind by Radix. */}
          <PopoverContent align="start" className="w-auto border-0 bg-transparent p-0 shadow-none">
            <div
              className="w-[340px] rounded-md border bg-popover p-3 text-popover-foreground shadow-md"
              style={
                zoomCounterScale > 1
                  ? { transform: `scale(${zoomCounterScale})`, transformOrigin: "top left" }
                  : undefined
              }
            >
              <div className="mb-2 flex items-center justify-between text-[10px] text-muted-foreground">
                <span>Shift-click two teeth to select a range</span>
                {rangeAnchor && (
                  <span className="rounded bg-primary/10 px-1.5 py-0.5 text-primary">Anchor: {rangeAnchor}</span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                {QUADRANTS.map((q) => (
                  <div key={q.label}>
                    <button
                      type="button"
                      onClick={() => toggleQuadrant(q.teeth)}
                      className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground hover:text-primary"
                    >
                      {q.label}
                    </button>
                    <div className="grid grid-cols-4 gap-1">
                      {q.teeth.map((n) => {
                        const on = hasNumber(n);
                        return (
                          <button
                            key={n}
                            type="button"
                            onClick={(e) => toggle(String(n), e)}
                            className={`rounded-md border px-1 py-1 text-[11px] tabular-nums transition-colors ${
                              on
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border hover:border-primary hover:bg-primary/5"
                            } ${rangeAnchor === String(n) ? "ring-1 ring-accent" : ""}`}
                          >
                            {n}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex flex-wrap gap-1 border-t border-border pt-3">
                {JAWS.map((j) => (
                  <button
                    key={j}
                    type="button"
                    onClick={() => toggle(j)}
                    className={`rounded-md border px-2 py-1 text-[11px] transition-colors ${
                      has(j)
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border hover:border-primary hover:bg-primary/5"
                    }`}
                  >
                    {j}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    onChange("");
                    setRangeAnchor(null);
                  }}
                  className="ml-auto rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:text-destructive"
                >
                  Clear
                </button>
              </div>

              <input
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder="Or type freely: 13-15, 16, Upper jaw…"
                className="mt-3 w-full rounded-md border border-border bg-transparent px-2 py-1 text-xs outline-none focus:border-primary"
              />
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
