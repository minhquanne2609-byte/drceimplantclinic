// Treatment-plan automation rules: qty from tooth numbers + follow-up procedures.

/** Count how many teeth (or jaws) a tooth-number string refers to. */
export function countTeeth(tooth: string): number {
  const raw = (tooth || "").trim();
  if (!raw || raw === "—") return 0;

  const lower = raw.toLowerCase();
  const jaws =
    (/(upper|maxilla)/.test(lower) ? 1 : 0) + (/(lower|mandib)/.test(lower) ? 1 : 0);
  if (/(jaw|arch|maxilla|mandib|full mouth)/.test(lower)) {
    if (/both|full mouth/.test(lower)) return 2;
    return jaws || 1;
  }

  let total = 0;
  for (const token of raw.split(/[,;+/]/)) {
    const t = token.trim();
    if (!t) continue;
    const range = t.match(/^(\d{2})\s*[-–—]\s*(\d{2})$/);
    if (range) {
      const a = Number(range[1]);
      const b = Number(range[2]);
      if (Math.floor(a / 10) === Math.floor(b / 10)) {
        total += Math.abs(b - a) + 1;
      } else {
        // spans two quadrants (e.g. 16–26): count teeth of both quadrants
        total += (a % 10) + (b % 10);
      }
      continue;
    }
    if (/\d/.test(t)) total += 1;
  }
  return total;
}

/** Expand a token like "13-15" into ["13","14","15"]; other tokens pass through. */
function expandTeethToken(t: string): string[] {
  const m = t.match(/^(\d{2})\s*[-–—]\s*(\d{2})$/);
  if (!m) return [t];
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (a > b) return Array.from({ length: a - b + 1 }, (_, i) => String(a - i));
  return Array.from({ length: b - a + 1 }, (_, i) => String(a + i));
}

/**
 * Union of two tooth-number strings, keeping order and de-duping.
 * Each side is expanded to individual tooth numbers first, so a tooth that
 * appears once as a bare number (e.g. "27") and once inside an old-format
 * range (e.g. "26-27") is only counted once instead of twice.
 */
export function mergeTeeth(a: string, b: string): string {
  const clean = (s: string) =>
    (s || "")
      .split(/[,;+/]/)
      .map((t) => t.trim())
      .filter((t) => t && t !== "—")
      .flatMap(expandTeethToken);
  const out: string[] = [];
  for (const t of [...clean(a), ...clean(b)]) {
    if (!out.some((x) => x.toLowerCase() === t.toLowerCase())) out.push(t);
  }
  return out.join(", ");
}

export type AutoRow = {
  name: string;
  tooth: string;
  /** 0 = same phase, 1 = next phase */
  phaseOffset: 0 | 1;
  /** Always shown as "In package" (no price) */
  inPackage?: boolean;
};

export const isAllOn = (n: string) => /all[-\s]?on[-\s]?([46])/i.test(n);
export const allOnCount = (n: string) => n.match(/all[-\s]?on[-\s]?([46])/i)?.[1] ?? "4";

/** True for a Phase-1 row that is an actual All-on-4/6 implant system (not its denture/frame follow-ups). */
export function isAllOnImplantSystemRow(name: string): boolean {
  const n = (name || "").toLowerCase();
  return isAllOn(name) && /(implant|system)/.test(n) && !/zirconia teeth|denture/.test(n);
}

/** Services that are always complimentary / included in the package. */
export const IN_PACKAGE_SERVICES = [
  "Conebeam CT (3D) scan",
  "Consultation",
  "Blood Test",
];

export function isInPackageService(name: string): boolean {
  const n = (name || "").trim().toLowerCase();
  return IN_PACKAGE_SERVICES.some((s) => s.toLowerCase() === n);
}

/**
 * True when a row justifies auto-adding Sedation Care.
 * Disabled clinic-wide — Sedation Care no longer appears automatically when
 * building an implant treatment plan (still addable by hand if ever needed).
 */
export function qualifiesForSedation(_name: string, _tooth: string): boolean {
  return false;
}

/**
 * Discount applied per unit to the Temporary Fixed Denture on Implant,
 * always given free-of-charge for All-on-4/6 full-arch treatment.
 */
export const TEMP_DENTURE_DISCOUNT_VND = 10_000_000;

/** True for the "Temporary Fixed Denture on Implant" row (All-on-4/6 provisional). */
export function qualifiesForTempDentureDiscount(name: string): boolean {
  const n = (name || "").toLowerCase();
  return /temporary\s+fixed\s+denture\s+on\s+implant/.test(n);
}

/**
 * Discount applied per unit to Tooth Extraction (incl. "Tooth Extraction
 * (Provisional)"), always given free-of-charge whenever the plan includes
 * any implant service (single implant or All-on-4/6).
 */
export const EXTRACTION_DISCOUNT_VND = 1_000_000;

/** True for a "Tooth Extraction" / "Tooth Extraction (Provisional)" row. */
export function isToothExtractionRow(name: string): boolean {
  return /^tooth\s+extraction(\s*\(provisional\))?$/i.test((name || "").trim());
}

/** True for a row that places an implant itself (single or All-on-4/6) — not
 * its follow-ups (abutment/crown/denture/temporary/etc). */
export function isImplantServiceRow(name: string): boolean {
  const n = (name || "").toLowerCase();
  if (!n) return false;
  if (isAllOnImplantSystemRow(name)) return true;
  return (
    /implant/.test(n) &&
    !/abutment|removal|crown|denture|temporary|additional fee|all[-\s]?on/.test(n)
  );
}

/** Resolve the automatic per-unit discount (in VND) that applies to a service row. */
export function autoDiscountVnd(name: string, qty: number, planHasImplant = false): number {
  if (qualifiesForTempDentureDiscount(name)) return TEMP_DENTURE_DISCOUNT_VND;
  if (planHasImplant && isToothExtractionRow(name)) return EXTRACTION_DISCOUNT_VND;
  return 0;
}

// ----- Diagnosis → Treatment Plan implant defaults -----
// When a treatment is picked from the Diagnosis tooth chart, the generic label
// ("Implant", "All-on-4 Implant", "All-on-6 Implant") is translated to the
// clinic's default catalog service/brand before it becomes a Treatment Plan row.
const DIAGNOSIS_IMPLANT_DEFAULTS: Record<string, string> = {
  "implant": "Osstem (Korea) Implant",
  "all-on-4 implant": "Neodent (Swiss) Implant System (All-on-4)",
  "all-on-6 implant": "Neodent (Swiss) Implant System (All-on-6)",
};

/**
 * Resolve the default catalog service name for a treatment picked in the
 * Diagnosis tab. Single "Implant" defaults to Osstem (Korea); "All-on-4/6
 * Implant" default to the Neodent (Swiss) Implant System. Any other
 * treatment (including more specific implant picks already naming a brand,
 * e.g. "All-on-6 Implant (4 Standards + 2 Pterygoids)") passes through
 * unchanged.
 */
export function resolveDiagnosisTreatmentName(name: string): string {
  const raw = (name || "").trim();
  const mapped = DIAGNOSIS_IMPLANT_DEFAULTS[raw.toLowerCase()];
  return mapped ?? raw;
}

// ----- Single implant → matching abutment brand -----
// The follow-up Abutment row must be the same brand as the implant that was
// picked (Osstem implant -> Osstem abutment, Dentium implant -> Dentium
// (USA) abutment, Neodent/Straumann likewise) instead of always defaulting
// to Osstem. Checked most-specific brand first (e.g. "Neodent Straumann" and
// "Straumann SLActive" before the plainer "Neodent"/"Straumann SLA") so a
// combo/variant name resolves to its own matching catalog abutment rather
// than the generic one.
const IMPLANT_ABUTMENT_DEFAULTS: { match: RegExp; abutment: string }[] = [
  { match: /straumann\s*slactive/i, abutment: "Straumann SLActive Abutment" },
  { match: /straumann\s*sla/i, abutment: "Straumann SLA (Swiss) Abutment" },
  { match: /neodent\s*straumann/i, abutment: "Neodent Straumann (Swiss) Abutment" },
  { match: /neodent/i, abutment: "Neodent (Swiss) Abutment" },
  { match: /dentium/i, abutment: "Dentium (USA) Abutment" },
  { match: /osstem/i, abutment: "Osstem (Korea) Abutment" },
];

/** Resolve the matching-brand Abutment catalog name for an implant service name. */
export function abutmentForImplant(name: string): string {
  const hit = IMPLANT_ABUTMENT_DEFAULTS.find((entry) => entry.match.test(name || ""));
  // No recognised brand in the name (e.g. a free-typed/custom implant row):
  // fall back to the clinic's previous default.
  return hit ? hit.abutment : "Osstem (Korea) Abutment";
}

/** Every brand-specific Abutment name `abutmentForImplant` can produce — used to
 * recognise an existing linked Abutment row regardless of which brand it is. */
export const IMPLANT_ABUTMENT_NAMES = Array.from(
  new Set(IMPLANT_ABUTMENT_DEFAULTS.map((e) => e.abutment)),
);

/** True for any brand's single-implant Abutment row (Osstem, Dentium, Neodent, Straumann…). */
export function isImplantAbutmentName(name: string): boolean {
  const n = (name || "").trim().toLowerCase();
  return IMPLANT_ABUTMENT_NAMES.some((a) => a.toLowerCase() === n);
}

/** Procedures that should be added automatically when `name` is selected. */
export function autoRowsFor(name: string, tooth: string): AutoRow[] {

  const n = (name || "").toLowerCase();
  const out: AutoRow[] = [];
  if (!n) return out;

  // Full-arch implant systems
  if (isAllOnImplantSystemRow(name)) {
    const k = allOnCount(name);
    out.push({ name: "Temporary Fixed Denture on Implant", tooth, phaseOffset: 0 });
    out.push({
      name: `Zirconia Teeth on Cast Frame for All-on-${k} Implant`,
      tooth,
      phaseOffset: 1,
    });
    return out;
  }

  // Root canal treatment
  if (/root canal treatment/.test(n)) {
    out.push({ name: "Fiberglass Post", tooth, phaseOffset: 0 });
    out.push({ name: "Zirconia Sagemax Crown on RCT Teeth", tooth, phaseOffset: 1 });
    return out;
  }

  // Single implants
  if (
    /implant/.test(n) &&
    !/abutment|removal|crown|denture|temporary|additional fee|all[-\s]?on/.test(n)
  ) {
    out.push({ name: abutmentForImplant(name), tooth, phaseOffset: 1 });
    out.push({ name: "Zirconia Sagemax Crown on Implant", tooth, phaseOffset: 1 });
  }


  return out;
}

// ----- Removable Partial Denture pricing -----
// Base frame fee + a per-tooth fee for every tooth added to the denture.
export const RPD_BASE_VND = 2_000_000;
export const RPD_PER_TOOTH_VND = 1_000_000;

export function isRemovablePartialDenture(name: string): boolean {
  return /remova(b)?le\s+partial\s+denture/i.test(name || "");
}

/** 2,000,000 base + 1,000,000 per tooth (e.g. 4 teeth => 6,000,000). */
export function rpdTotalVnd(qty: number, discountPerTooth = 0): number {
  const n = Math.max(0, Number(qty) || 0);
  return RPD_BASE_VND + n * Math.max(0, RPD_PER_TOOTH_VND - (Number(discountPerTooth) || 0));
}

// ----- Implant systems & warranty (used for the PNG export title) -----
export const IMPLANT_WARRANTY: { brand: string; match: RegExp; warranty: string }[] = [
  { brand: "Straumann SLActive (Switzerland)", match: /straumann\s*slactive/i, warranty: "30 Years" },
  { brand: "Nobel Active (USA)", match: /nobel\s*active/i, warranty: "30 Years" },
  { brand: "Straumann SLA (Switzerland)", match: /straumann\s*sla(?!ctive)/i, warranty: "25 Years" },
  { brand: "JDental Care (Italy)", match: /jdental/i, warranty: "25 Years" },
  { brand: "Neodent (Switzerland)", match: /neodent/i, warranty: "20 Years" },
  { brand: "Dentium (USA)", match: /dentium/i, warranty: "15 Years" },
  { brand: "Osstem (Korea)", match: /osstem/i, warranty: "10 Years" },
];

/** First implant system found in a list of service names, with its warranty. */
export function findImplantWarranty(names: string[]) {
  for (const entry of IMPLANT_WARRANTY) {
    if (names.some((n) => entry.match.test(n || ""))) return entry;
  }
  return null;
}

// ----- Root canal: pick the catalog variant by number of pulps (canals) -----

/** Pulps (canals) treated on an FDI tooth: molars 3, premolars 2, front teeth 1. */
export function pulpsForTooth(tooth: string): number | null {
  const m = (tooth || "").trim().match(/^([1-4])([1-8])$/);
  if (!m) return null;
  const p = Number(m[2]);
  if (p >= 6) return 3;
  if (p >= 4) return 2;
  return 1;
}

/** True for the generic root-canal treatments coming from the diagnosis chart. */
export function isRootCanalBase(name: string): boolean {
  return /^root canal (treatment|re-?treatment)$/i.test((name || "").trim());
}

/** "Root Canal Treatment" + 3 -> "Root Canal Treatment for 3 Pulps". */
export function rootCanalVariant(name: string, pulps: number): string {
  const retreat = /re-?treatment/i.test(name || "");
  const base = retreat ? "Re-root Canal Treatment" : "Root Canal Treatment";
  const unit = pulps === 1 ? "Pulp" : "Pulps";
  return `${base} for ${pulps} ${unit}`;
}
