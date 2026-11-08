import { useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useZoomCounterScale } from "@/hooks/use-zoom-counter-scale";
import {
  ALL_CURRENCY_CODES,
  POPULAR_CURRENCIES,
  currencyMatches,
  currencyName,
  currencySymbol,
} from "@/lib/currencies";

type Props = {
  value: string;
  onChange: (code: string) => void;
  /** 1 VND = rates[CODE]; currencies without a live rate can't be converted. */
  rates: Record<string, number>;
  /** Currencies whose rate comes from Vietcombank (others use a market-rate estimate). */
  vcbCodes?: Set<string>;
  /** "header" inherits the surrounding (white-on-blue) text; "field" looks like a form control. */
  variant?: "header" | "field";
  title?: string;
};

export function CurrencyPicker({ value, onChange, rates, vcbCodes, variant = "header", title = "Change currency" }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const zoomScale = useZoomCounterScale(open);

  const ratesLoaded = Object.keys(rates).length > 30;

  const all = useMemo(() => {
    const codes = new Set<string>([...ALL_CURRENCY_CODES, ...Object.keys(rates).filter((c) => /^[A-Z]{3}$/.test(c)), value]);
    return Array.from(codes).sort((a, b) => a.localeCompare(b));
  }, [rates, value]);

  const hasRate = (c: string) => c === "VND" || (rates[c] ?? 0) > 0;

  const filtered = useMemo(() => all.filter((c) => currencyMatches(c, query)), [all, query]);
  const popular = useMemo(
    () => POPULAR_CURRENCIES.filter((c) => all.includes(c) && currencyMatches(c, query)),
    [all, query],
  );

  const pick = (c: string) => {
    if (!hasRate(c)) return;
    onChange(c);
    setOpen(false);
    setQuery("");
  };

  const Row = ({ code }: { code: string }) => {
    const usable = hasRate(code);
    const sym = currencySymbol(code);
    return (
      <button
        type="button"
        onClick={() => pick(code)}
        disabled={!usable}
        className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm rounded-md ${
          code === value ? "bg-primary/10 text-primary font-semibold" : "hover:bg-muted"
        } ${usable ? "" : "opacity-40 cursor-not-allowed"}`}
      >
        <span className="w-12 font-semibold">{code}</span>
        <span className="w-6 text-muted-foreground text-xs">{sym}</span>
        <span className="flex-1 truncate">{currencyName(code)}</span>
        {!usable && <span className="text-[10px] text-muted-foreground">no live rate</span>}
        {usable && vcbCodes?.has(code) && <span className="text-[10px] font-semibold text-emerald-700">VCB</span>}
        {usable && vcbCodes && vcbCodes.size > 0 && !vcbCodes.has(code) && code !== "VND" && (
          <span className="text-[10px] text-muted-foreground">market</span>
        )}
      </button>
    );
  };

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setQuery("");
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          title={title}
          className={
            variant === "header"
              ? "print:hidden inline-flex items-center gap-1 bg-transparent outline-none font-bold text-inherit cursor-pointer"
              : "inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1.5 text-sm font-medium"
          }
        >
          {value}
          <ChevronDown size={variant === "header" ? 16 : 14} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto border-0 bg-transparent p-0 shadow-none print:hidden">
        <div
          className="w-80 bg-popover text-popover-foreground border border-border rounded-lg shadow-2xl overflow-hidden"
          style={zoomScale > 1 ? { transform: `scale(${zoomScale})`, transformOrigin: "top left" } : undefined}
        >
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
            <Search size={14} className="text-muted-foreground shrink-0" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const first = (query ? filtered : popular).find(hasRate);
                  if (first) pick(first);
                }
              }}
              placeholder="Search currency or country…"
              className="w-full bg-transparent outline-none text-sm"
            />
          </div>
          {!ratesLoaded && (
            <div className="px-3 py-1.5 text-[11px] text-amber-700 bg-amber-50">
              Live rates haven't loaded yet — only a few currencies can be used for now.
            </div>
          )}
          <div className="max-h-80 overflow-y-auto p-1">
            {query === "" && popular.length > 0 && (
              <>
                <div className="px-3 pt-1.5 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Popular
                </div>
                {popular.map((c) => (
                  <Row key={`p-${c}`} code={c} />
                ))}
                <div className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  All currencies (A–Z)
                </div>
              </>
            )}
            {filtered.map((c) => (
              <Row key={c} code={c} />
            ))}
            {filtered.length === 0 && (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">No currency found</div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
