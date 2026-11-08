import { useEffect, useMemo, useState } from "react";
import { ALL_CURRENCY_CODES } from "@/lib/currencies";
import { getVcbRates, type VcbRow } from "@/lib/vcb-rates";

/** Live FX rates expressed as: 1 VND = rates[CODE] units of CODE. */
export type Rates = Record<string, number>;

const FALLBACK: Rates = {
  VND: 1,
  AUD: 1 / 16700,
  USD: 1 / 25400,
  EUR: 1 / 27500,
  GBP: 1 / 32000,
  CAD: 1 / 18500,
  NZD: 1 / 15300,
  SGD: 1 / 19000,
  JPY: 1 / 165,
  KRW: 1 / 18,
  CNY: 1 / 3500,
  PHP: 1 / 453.6,
  THB: 1 / 750,
  ZAR: 1 / 1410,
};

export type VcbMode = "sell" | "transfer" | "buy";
const MODE_KEY = "dci-vcb-mode";

export const VCB_MODE_LABEL: Record<VcbMode, string> = {
  sell: "Sell",
  transfer: "Buy (transfer)",
  buy: "Buy (cash)",
};

/** VND per 1 unit of the currency, for the chosen Vietcombank column (falls back to another column). */
function pickVcb(row: VcbRow, mode: VcbMode): number | null {
  const order: Record<VcbMode, (keyof VcbRow)[]> = {
    sell: ["sell", "transfer", "buy"],
    transfer: ["transfer", "buy", "sell"],
    buy: ["buy", "transfer", "sell"],
  };
  for (const k of order[mode]) {
    const v = row[k];
    if (typeof v === "number" && v > 0) return v;
  }
  return null;
}

/**
 * Exchange rates. Vietcombank's board is the primary source (via a server function,
 * because the bank does not allow direct browser requests); currencies Vietcombank
 * does not list fall back to a public market-rate API, then to built-in estimates.
 */
export function useLiveRates(refreshMs = 5 * 60 * 1000) {
  const [market, setMarket] = useState<Rates | null>(null);
  const [marketAt, setMarketAt] = useState<string | null>(null);
  const [vcb, setVcb] = useState<{ updatedAt: string; rows: Record<string, VcbRow> } | null>(null);
  const [mode, setModeState] = useState<VcbMode>("sell");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(MODE_KEY);
      if (saved === "sell" || saved === "transfer" || saved === "buy") setModeState(saved);
    } catch {
      /* ignore */
    }
  }, []);

  const setMode = (m: VcbMode) => {
    setModeState(m);
    try {
      localStorage.setItem(MODE_KEY, m);
    } catch {
      /* ignore */
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const [vcbRes, marketRes] = await Promise.allSettled([
        getVcbRates(),
        fetch("https://open.er-api.com/v6/latest/VND").then((r) => r.json()),
      ]);
      if (vcbRes.status === "fulfilled" && vcbRes.value.ok) {
        setVcb({ updatedAt: vcbRes.value.updatedAt, rows: vcbRes.value.rates });
      }
      if (marketRes.status === "fulfilled") {
        const json = marketRes.value as { result?: string; rates?: Rates; time_last_update_utc?: string };
        if (json.result === "success" && json.rates) {
          setMarket({ ...json.rates, VND: 1 });
          setMarketAt(json.time_last_update_utc ?? new Date().toUTCString());
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), refreshMs);
    return () => clearInterval(t);
  }, [refreshMs]);

  const { rates, vcbCodes } = useMemo(() => {
    const out: Rates = { ...FALLBACK, ...(market ?? {}), VND: 1 };
    const codes = new Set<string>();
    if (vcb) {
      for (const [code, row] of Object.entries(vcb.rows)) {
        const vndPerUnit = pickVcb(row, mode);
        if (vndPerUnit) {
          out[code] = 1 / vndPerUnit;
          codes.add(code);
        }
      }
    }
    return { rates: out, vcbCodes: codes };
  }, [market, vcb, mode]);

  const updatedAt = vcb ? vcb.updatedAt : marketAt;
  const sourceLabel = vcb ? `Vietcombank · ${VCB_MODE_LABEL[mode]}` : marketAt ? "market rates" : "estimated rates";

  return { rates, updatedAt, sourceLabel, vcbCodes, vcbMode: mode, setVcbMode: setMode, loading, refresh: load };
}

export const CURRENCY_CODES = Array.from(new Set([...Object.keys(FALLBACK), ...ALL_CURRENCY_CODES]));
