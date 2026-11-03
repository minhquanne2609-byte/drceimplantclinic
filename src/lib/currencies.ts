/**
 * World currency list for the plan's currency columns and the converter.
 * Codes are ISO 4217. Names come from the browser's own Intl data, so every
 * code is named in English without a hand-typed table that could go stale.
 */

export const ALL_CURRENCY_CODES: string[] = (
  "AED AFN ALL AMD ANG AOA ARS AUD AWG AZN BAM BBD BDT BGN BHD BIF BMD BND BOB BRL BSD BTN BWP BYN BZD " +
  "CAD CDF CHF CLP CNY COP CRC CUP CVE CZK DJF DKK DOP DZD EGP ERN ETB EUR FJD FKP GBP GEL GHS GIP GMD GNF " +
  "GTQ GYD HKD HNL HTG HUF IDR ILS INR IQD IRR ISK JMD JOD JPY KES KGS KHR KMF KRW KWD KYD KZT LAK LBP LKR " +
  "LRD LSL LYD MAD MDL MGA MKD MMK MNT MOP MRU MUR MVR MWK MXN MYR MZN NAD NGN NIO NOK NPR NZD OMR PAB PEN " +
  "PGK PHP PKR PLN PYG QAR RON RSD RUB RWF SAR SBD SCR SDG SEK SGD SHP SLE SOS SRD SSP STN SYP SZL THB TJS " +
  "TMT TND TOP TRY TTD TWD TZS UAH UGX USD UYU UZS VES VND VUV WST XAF XCD XOF XPF YER ZAR ZMW ZWL"
).split(" ");

/** Shown first when the search box is empty (common for dental-tourism patients). */
export const POPULAR_CURRENCIES = [
  "VND", "USD", "AUD", "EUR", "GBP", "CAD", "NZD", "SGD", "JPY", "KRW", "CNY", "HKD", "TWD", "THB",
  "PHP", "MYR", "IDR", "INR", "AED", "CHF", "ZAR", "SEK", "NOK", "DKK",
];

/** Extra search words (countries / nicknames) the English currency name doesn't contain. */
const KEYWORDS: Record<string, string> = {
  USD: "united states america us usa dollar",
  EUR: "europe european union euro germany france italy spain netherlands ireland",
  GBP: "united kingdom uk britain british england scotland wales pound sterling",
  AUD: "australia aussie",
  CAD: "canada canadian",
  NZD: "new zealand kiwi",
  SGD: "singapore",
  JPY: "japan yen",
  KRW: "korea south korean won",
  CNY: "china chinese renminbi rmb yuan",
  HKD: "hong kong",
  TWD: "taiwan",
  THB: "thailand baht",
  PHP: "philippines peso",
  MYR: "malaysia ringgit",
  IDR: "indonesia rupiah",
  INR: "india rupee",
  AED: "uae emirates dubai abu dhabi dirham",
  SAR: "saudi arabia riyal",
  QAR: "qatar",
  KWD: "kuwait",
  CHF: "switzerland swiss franc",
  ZAR: "south africa rand",
  RUB: "russia ruble",
  TRY: "turkey turkish lira",
  BRL: "brazil real",
  MXN: "mexico peso",
  VND: "vietnam viet nam dong",
  LAK: "laos lao kip",
  KHR: "cambodia riel",
  MMK: "myanmar burma kyat",
  PKR: "pakistan",
  BDT: "bangladesh taka",
  LKR: "sri lanka",
  NPR: "nepal",
  ILS: "israel shekel",
  EGP: "egypt",
  NGN: "nigeria naira",
  KES: "kenya shilling",
  SEK: "sweden swedish krona",
  NOK: "norway norwegian krone",
  DKK: "denmark danish krone",
  PLN: "poland zloty",
  CZK: "czech republic koruna",
  HUF: "hungary forint",
  UAH: "ukraine hryvnia",
};

let namer: Intl.DisplayNames | null | undefined;
export function currencyName(code: string): string {
  if (namer === undefined) {
    try {
      namer = new Intl.DisplayNames(["en"], { type: "currency" });
    } catch {
      namer = null;
    }
  }
  try {
    return namer?.of(code) ?? code;
  } catch {
    return code;
  }
}

export function currencySymbol(code: string): string {
  try {
    const part = new Intl.NumberFormat("en", { style: "currency", currency: code, currencyDisplay: "narrowSymbol" })
      .formatToParts(0)
      .find((p) => p.type === "currency");
    const sym = part?.value ?? "";
    return sym && sym !== code ? sym : "";
  } catch {
    return "";
  }
}

/** True when every word typed appears in the code, name or keywords. */
export function currencyMatches(code: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = `${code} ${currencyName(code)} ${KEYWORDS[code] ?? ""}`.toLowerCase();
  return q.split(/\s+/).every((w) => hay.includes(w));
}
