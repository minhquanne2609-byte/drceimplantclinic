import { createServerFn } from "@tanstack/react-start";

/** One row of Vietcombank's public exchange-rate board (VND per 1 unit of the currency). */
export type VcbRow = { name: string; buy: number | null; transfer: number | null; sell: number | null };

export type VcbResult =
  | { ok: true; updatedAt: string; rates: Record<string, VcbRow> }
  | { ok: false; error: string };

const VCB_URL = process.env["VCB_RATES_URL"] || "https://portal.vietcombank.com.vn/Usercontrols/TVPortal.TyGia/pXML.aspx";
const CACHE_MS = 2 * 60 * 1000;

let cache: { at: number; value: Extract<VcbResult, { ok: true }> } | null = null;

const toNum = (s: string | undefined): number | null => {
  if (!s) return null;
  const n = Number(s.replace(/,/g, "").trim());
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** Parses the board's XML:  <Exrate CurrencyCode="USD" CurrencyName="US DOLLAR" Buy=".." Transfer=".." Sell=".."/> */
export function parseVcbXml(xml: string): Extract<VcbResult, { ok: true }> | null {
  const rates: Record<string, VcbRow> = {};
  const tagRe = /<Exrate\b([^>]*?)\/?>/gi;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(xml))) {
    const attrs: Record<string, string> = {};
    const attrRe = /([A-Za-z]+)\s*=\s*"([^"]*)"/g;
    let a: RegExpExecArray | null;
    while ((a = attrRe.exec(m[1]))) attrs[a[1].toLowerCase()] = a[2];
    const code = (attrs["currencycode"] ?? "").trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(code)) continue;
    const row: VcbRow = {
      name: (attrs["currencyname"] ?? code).trim(),
      buy: toNum(attrs["buy"]),
      transfer: toNum(attrs["transfer"]),
      sell: toNum(attrs["sell"]),
    };
    if (row.buy || row.transfer || row.sell) rates[code] = row;
  }
  if (Object.keys(rates).length === 0) return null;
  const when = xml.match(/<DateTime>\s*([^<]+?)\s*<\/DateTime>/i)?.[1] ?? new Date().toISOString();
  return { ok: true, updatedAt: when, rates };
}

/**
 * Vietcombank blocks cross-origin browser requests (CORS), so the page asks this
 * server function, which fetches the board and caches it for a couple of minutes.
 */
export const getVcbRates = createServerFn({ method: "POST" }).handler(async (): Promise<VcbResult> => {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(VCB_URL, {
      signal: ctrl.signal,
      headers: { "user-agent": "Mozilla/5.0 (compatible; DrCarePlan/1.0)", accept: "application/xml,text/xml,*/*" },
    }).finally(() => clearTimeout(timer));
    if (!res.ok) return { ok: false, error: `Vietcombank returned ${res.status}` };
    const parsed = parseVcbXml(await res.text());
    if (!parsed) return { ok: false, error: "Vietcombank rate board could not be read" };
    cache = { at: Date.now(), value: parsed };
    return parsed;
  } catch (e) {
    // Serve the last good board (even if a bit old) rather than nothing.
    if (cache) return cache.value;
    return { ok: false, error: e instanceof Error ? e.message : "Could not reach Vietcombank" };
  }
});
