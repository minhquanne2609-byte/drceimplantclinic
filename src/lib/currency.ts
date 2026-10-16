import { useEffect, useState } from "react";

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

export function useLiveRates(refreshMs = 5 * 60 * 1000) {
  const [rates, setRates] = useState<Rates>(FALLBACK);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("https://open.er-api.com/v6/latest/VND");
      const json = (await res.json()) as {
        result?: string;
        rates?: Rates;
        time_last_update_utc?: string;
      };
      if (json.result === "success" && json.rates) {
        setRates({ ...FALLBACK, ...json.rates, VND: 1 });
        setUpdatedAt(json.time_last_update_utc ?? new Date().toUTCString());
      }
    } catch {
      /* keep fallback rates */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), refreshMs);
    return () => clearInterval(t);
  }, [refreshMs]);

  return { rates, updatedAt, loading, refresh: load };
}

export const CURRENCY_CODES = Object.keys(FALLBACK);
