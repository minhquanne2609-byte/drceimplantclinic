import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useZoomCounterScale } from "@/hooks/use-zoom-counter-scale";

type Group = { group: string; items: string[] };

/**
 * Searchable multi-select rendered as removable chips.
 * Value is a comma-separated string so existing saved plans keep working.
 */
export function TagMultiSelect({
  value,
  onChange,
  options,
  groups,
  addLabel = "Add",
  placeholder = "Search…",
}: {
  value: string[];
  onChange: (next: string[]) => void;
  options?: string[];
  groups?: Group[];
  addLabel?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  // Keeps the search dropdown readable/clickable when the page is zoomed way
  // out (browser Ctrl -) to fit a whole treatment plan on screen.
  const zoomCounterScale = useZoomCounterScale(open);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const allGroups: Group[] = useMemo(
    () => groups ?? [{ group: "", items: options ?? [] }],
    [groups, options]
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return allGroups
      .map((g) => ({
        group: g.group,
        items: g.items.filter(
          (i) => !value.includes(i) && (!needle || i.toLowerCase().includes(needle))
        ),
      }))
      .filter((g) => g.items.length > 0);
  }, [allGroups, q, value]);

  const flat = useMemo(() => filtered.flatMap((g) => g.items), [filtered]);

  useEffect(() => setActive(0), [q, open]);

  const add = (item: string) => {
    if (!value.includes(item)) onChange([...value, item]);
    setQ("");
    inputRef.current?.focus();
  };
  const remove = (item: string) => onChange(value.filter((v) => v !== item));

  return (
    <div className="relative">
      {/* Print / export: plain comma-separated text, no chips, no wrapping boxes */}
      <span className="hidden print:inline dx-print-text text-[12px] leading-snug text-foreground">
        {value.join(", ")}
      </span>

      <div className="flex flex-wrap items-center gap-1.5 print:hidden">
        {value.map((v) => (
          <span
            key={v}
            className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 font-medium text-primary"
          >
            {v}
            <button
              type="button"
              onClick={() => remove(v)}
              className="text-primary/50 hover:text-destructive print:hidden"
              aria-label={`Remove ${v}`}
            >
              <X size={16} />
            </button>
          </span>
        ))}
        <Popover
          open={open}
          onOpenChange={(v) => {
            setOpen(v);
            if (v) setTimeout(() => inputRef.current?.focus(), 0);
          }}
        >
          <PopoverTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-primary/30 px-3 py-1 font-medium text-primary/70 hover:border-accent hover:text-primary print:hidden"
            >
              <Plus size={16} /> {addLabel}
            </button>
          </PopoverTrigger>
          {/* Portal-rendered (see PopoverContent), so this floats free of any
              scrollable/clipped ancestor (e.g. the tooth-notes table's own
              scroll box) instead of being cut off inside it. The card's own
              background/border/shadow live on the inner div so they scale up
              together with the content — see ToothNumberPicker for the same
              pattern. */}
          <PopoverContent align="start" className="w-auto border-0 bg-transparent p-0 shadow-none">
            <div
              className="w-[min(22rem,80vw)] rounded-xl border border-primary/15 bg-background shadow-lg"
              style={
                zoomCounterScale > 1
                  ? { transform: `scale(${zoomCounterScale})`, transformOrigin: "top left" }
                  : undefined
              }
            >
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={placeholder}
                className="w-full border-b border-primary/10 bg-transparent px-3 py-2 text-sm outline-none"
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setActive((a) => Math.min(a + 1, flat.length - 1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setActive((a) => Math.max(a - 1, 0));
                  } else if (e.key === "Enter") {
                    e.preventDefault();
                    const pick = flat[active] ?? (q.trim() ? q.trim() : null);
                    if (pick) add(pick);
                  } else if (e.key === "Escape") {
                    setOpen(false);
                  }
                }}
              />
              <div className="max-h-64 overflow-y-auto py-1">
                {filtered.length === 0 && (
                  <div className="px-3 py-2 text-[12px] text-muted-foreground">
                    {q.trim() ? "Press Enter to add as custom entry" : "No options left"}
                  </div>
                )}
                {filtered.map((g) => (
                  <div key={g.group || "all"}>
                    {g.group && (
                      <div className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.18em] text-primary/45">
                        {g.group}
                      </div>
                    )}
                    {g.items.map((item) => {
                      const idx = flat.indexOf(item);
                      return (
                        <button
                          key={item}
                          type="button"
                          onMouseEnter={() => setActive(idx)}
                          onClick={() => add(item)}
                          className={`block w-full px-3 py-1.5 text-left text-[13px] ${
                            idx === active ? "bg-accent/15 text-primary" : "text-primary/80"
                          }`}
                        >
                          {item}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
