/**
 * Turns the clinic's shorthand notes (e.g. "Nhổ 26 -> imp nxk gx", "tủy chốt sứ 22, 45")
 * into treatment-plan rows. Matching ignores Vietnamese accents and case, so
 * "nhổ" = "nho" = "NHỔ". Everything is driven by a rule list the clinic can edit.
 */
import { abutmentForImplant, autoRowsFor, countTeeth, mergeTeeth, pulpsForTooth, rootCanalVariant } from "@/lib/plan-rules";

// ------------------------------------------------------------------ rules

export type QtyMode = "teeth" | "regions" | "one";

export type RuleKind =
  | "service" //  adds a catalog service
  | "implant" //  implant (brand picked by a brand rule, otherwise this rule's service)
  | "brand" //    "neodent" → which implant service to use
  | "rct" //      root canal (+ optional fiberglass post / crown)
  | "ignore" //   recognised but adds nothing (e.g. "cắt cầu")
  | "provisional"; // "dự trù" → next service gets "(Provisional)"

export type Rule = {
  id: string;
  kind: RuleKind;
  label: string;
  /** Shorthand words / phrases. Accent- and case-insensitive. */
  triggers: string[];
  /** Catalog service name (service / implant / brand / prosthesis). */
  service?: string;
  /** Starts a new item (verb such as nhổ, cắm) instead of modifying the previous one (gx, nxk). */
  starts?: boolean;
  qtyMode?: QtyMode;
  /** 1 = first trip (placement), 2 = second trip (prosthetics). */
  phase?: 1 | 2;
  /** rct only */
  post?: boolean;
  crown?: boolean;
  /** Used to merge "closed sinus lift + bone graft" into the combined catalog service. */
  group?: "closed-sinus" | "open-sinus" | "graft";
  /** Within a group, the highest rank wins (gx < đm1 < đm2 < GBR): "gx đm2" is ONE Level II graft. */
  rank?: number;
  /** If `service` is not in the catalog, take the price from this catalog service. */
  priceLike?: string;
  enabled?: boolean;
  builtin?: boolean;
};

export const DEFAULT_RULES: Rule[] = [
  {
    id: "extract",
    kind: "service",
    label: "Nhổ = Extraction",
    triggers: ["nhổ", "nhổ răng", "extraction"],
    service: "Teeth Extraction",
    starts: true,
    qtyMode: "teeth",
    phase: 1,
    builtin: true,
  },
  {
    id: "implant",
    kind: "implant",
    label: "Im / Imp / Implant / Cắm = Implant (mặc định Osstem)",
    triggers: ["implant", "imp", "im", "cắm", "trụ"],
    service: "Osstem (Korea) Implant",
    starts: true,
    qtyMode: "teeth",
    phase: 1,
    builtin: true,
  },
  {
    id: "brand-osstem",
    kind: "brand",
    label: "Osstem",
    triggers: ["osstem"],
    service: "Osstem (Korea) Implant",
    builtin: true,
  },
  {
    id: "brand-neodent",
    kind: "brand",
    label: "Neodent",
    triggers: ["neodent"],
    service: "Neodent (Swiss) Implant",
    builtin: true,
  },
  {
    id: "brand-straumann",
    kind: "brand",
    label: "Straumann",
    triggers: ["straumann"],
    service: "Straumann SLA (Swiss) Implant",
    builtin: true,
  },
  {
    id: "brand-slactive",
    kind: "brand",
    label: "Straumann SLActive",
    triggers: ["slactive"],
    service: "Straumann SLActive Implant",
    builtin: true,
  },
  {
    id: "brand-dentium",
    kind: "brand",
    label: "Dentium",
    triggers: ["dentium"],
    service: "Dentium (USA) Implant",
    builtin: true,
  },
  {
    id: "sinus-closed",
    kind: "service",
    label: "Nxk = Nâng xoang kín (Closed sinus lift)",
    triggers: ["nxk", "nâng xoang kín"],
    service: "Closed Sinus Lift",
    qtyMode: "teeth",
    phase: 1,
    group: "closed-sinus",
    builtin: true,
  },
  {
    id: "sinus-open",
    kind: "service",
    label: "Nxh = Nâng xoang hở (Open sinus lift)",
    triggers: ["nxh", "nâng xoang hở"],
    service: "Open Sinus Lift",
    qtyMode: "teeth",
    phase: 1,
    group: "open-sinus",
    builtin: true,
  },
  {
    id: "graft",
    kind: "service",
    label: "Gx = Ghép xương (Bone graft) — 1 vùng = 1 đơn vị",
    triggers: ["gx", "ghép xương"],
    service: "Bone Graft",
    priceLike: "Bone Graft Level I",
    qtyMode: "regions",
    phase: 1,
    group: "graft",
    rank: 0,
    builtin: true,
  },
  {
    id: "graft-1",
    kind: "service",
    label: "Đm1 = Định mức 1 = Bone Graft Level I",
    triggers: ["đm1", "dm1", "gx1", "lv1"],
    service: "Bone Graft Level I",
    qtyMode: "regions",
    phase: 1,
    group: "graft",
    rank: 1,
    builtin: true,
  },
  {
    id: "graft-2",
    kind: "service",
    label: "Đm2 = Định mức 2 = Bone Graft Level II",
    triggers: ["đm2", "dm2", "gx2", "lv2"],
    service: "Bone Graft Level II",
    qtyMode: "regions",
    phase: 1,
    group: "graft",
    rank: 2,
    builtin: true,
  },
  {
    id: "graft-gbr",
    kind: "service",
    label: "GBR = Ghép xương GBR",
    triggers: ["gbr"],
    service: "Bone Graft GBR",
    qtyMode: "regions",
    phase: 1,
    group: "graft",
    rank: 3,
    builtin: true,
  },
  {
    id: "ssa",
    kind: "service",
    label: "SSA = Socket healing abutment",
    triggers: ["ssa"],
    service: "Socket Healing Abutment",
    qtyMode: "teeth",
    phase: 1,
    builtin: true,
  },
  {
    id: "bridge-cut",
    kind: "ignore",
    label: "Cắt cầu = không ghi vào kế hoạch",
    triggers: ["cắt cầu", "tháo cầu"],
    starts: true,
    builtin: true,
  },
  {
    id: "crown",
    kind: "service",
    label: "Phục hình sứ = Zirconia crown (chuyến 2)",
    triggers: ["phục hình sứ", "bọc sứ", "phục hình"],
    service: "Zirconia Sagemax Crown",
    starts: true,
    qtyMode: "teeth",
    phase: 2,
    builtin: true,
  },
  {
    id: "rct-post-crown",
    kind: "rct",
    label: "Tủy chốt sứ = Root canal + Fiberglass post + Crown",
    triggers: ["tủy chốt sứ"],
    starts: true,
    post: true,
    crown: true,
    builtin: true,
  },
  {
    id: "rct-post",
    kind: "rct",
    label: "Tủy chốt = Root canal + Fiberglass post",
    triggers: ["tủy chốt"],
    starts: true,
    post: true,
    crown: false,
    builtin: true,
  },
  {
    id: "rct",
    kind: "rct",
    label: "Tủy / Lấy tủy = Root canal",
    triggers: ["lấy tủy", "tủy"],
    starts: true,
    post: false,
    crown: false,
    builtin: true,
  },
  {
    id: "provisional",
    kind: "provisional",
    label: "Dự trù = thêm (Provisional) phía sau",
    triggers: ["dự trù", "provisional"],
    builtin: true,
  },
];

/** Words that carry no meaning for the plan and are skipped without a warning. */
const FILLER = new Set(
  "uu tien rang vung cho va o tai ben la se de theo gom bao ca cac them khi can".split(" "),
);

// ------------------------------------------------------------------ text helpers

/** Same length as the (NFC) input: lower-case, no accents, đ → d. */
export function fold(s: string): string {
  let out = "";
  for (const ch of s.normalize("NFC")) {
    if (ch === "đ" || ch === "Đ") out += "d";
    else out += ch.normalize("NFD")[0].toLowerCase();
  }
  return out;
}

const UPPER = [
  ["18", "17", "16", "15", "14", "13", "12", "11"],
  ["21", "22", "23", "24", "25", "26", "27", "28"],
];
const LOWER = [
  ["48", "47", "46", "45", "44", "43", "42", "41"],
  ["31", "32", "33", "34", "35", "36", "37", "38"],
];
const ARCH_UPPER = [...UPPER[0], ...UPPER[1]];
const ARCH_LOWER = [...LOWER[0], ...LOWER[1]];

function expandRange(a: string, b: string): string[] {
  for (const arch of [ARCH_UPPER, ARCH_LOWER]) {
    const i = arch.indexOf(a);
    const j = arch.indexOf(b);
    if (i >= 0 && j >= 0) {
      return i <= j ? arch.slice(i, j + 1) : arch.slice(j, i + 1).reverse();
    }
  }
  return [a, b];
}

/** Adjacent teeth form one "region" (e.g. 46+47 = 1 bone-graft unit). */
export function regionCount(teeth: string[]): number {
  const set = new Set(teeth);
  if (set.size === 0) return 1;
  let regions = 0;
  for (const arch of [ARCH_UPPER, ARCH_LOWER]) {
    let inRun = false;
    for (const t of arch) {
      if (set.has(t)) {
        if (!inRun) regions++;
        inRun = true;
      } else inRun = false;
    }
  }
  return Math.max(1, regions);
}

const uniq = (a: string[]) => a.filter((t, i) => a.indexOf(t) === i);

// ------------------------------------------------------------------ parsing

export type DraftRow = {
  name: string;
  teeth: string; // "26, 34"
  qty: number;
  /** 0 = Phase 1 (trip 1), 1 = Phase 2 (trip 2) */
  phase: 0 | 1;
  /** Follow-up created by an automatic rule (abutment, crown, post …) */
  auto?: boolean;
  inCatalog: boolean;
  /** Name not in the catalog: price follows this catalog service instead. */
  priceLike?: string;
  /** "teeth": qty follows the tooth count; "fixed": qty was set by a rule / the user's text */
  qtyKind: "teeth" | "fixed";
};

export type LineReport = { text: string; items: string[]; warnings: string[] };

export type ShorthandDraft = {
  rows: DraftRow[];
  /** phase index -> "14 days" */
  timelines: Record<number, string>;
  lines: LineReport[];
  unknown: string[];
};

type Ev =
  | { t: "rule"; rule: Rule; at: number }
  | { t: "teeth"; teeth: string[] }
  | { t: "qty"; n: number }
  | { t: "arrow" }
  | { t: "unknown"; text: string };

type Mod = { rule: Rule; qty?: number; prov?: boolean };
type Seg = {
  rule: Rule | null;
  teeth: string[];
  mods: Mod[];
  prov: boolean;
  qty?: number;
  brand?: Rule;
  clause: number;
};

const TOKEN_RE =
  /->|→|(?<!\d)([1-4][1-8])\s*[-–—]\s*([1-4][1-8])(?!\d)|(?<![\d.])(\d+)\s*(?:dv|don vi|units?)(?![a-z])|(?<![\d.\w])([1-4][1-8])(?![\d\w])|[a-z][a-z0-9]*|[,;+()/]/g;

export function parseShorthand(text: string, rules: Rule[], catalogNames: string[]): ShorthandDraft {
  const active = rules.filter((r) => r.enabled !== false);
  const catalogSet = new Set(catalogNames.map((n) => n.trim().toLowerCase()));
  const inCatalog = (n: string) => catalogSet.has(n.trim().toLowerCase());

  // trigger phrases as word arrays, longest first
  const trig: { words: string[]; rule: Rule }[] = [];
  for (const r of active) for (const t of r.triggers) {
    const words = fold(t).match(/[a-z][a-z0-9]*/g);
    if (words?.length) trig.push({ words, rule: r });
  }
  trig.sort((a, b) => b.words.length - a.words.length);

  const draftRows: DraftRow[] = [];
  const timelines: Record<number, string> = {};
  const lines: LineReport[] = [];
  const unknown: string[] = [];

  const push = (row: Omit<DraftRow, "inCatalog">) => {
    draftRows.push({ ...row, inCatalog: inCatalog(row.name) || !!row.priceLike });
  };
  const provName = (n: string) => (/provisional/i.test(n) ? n : `${n} (Provisional)`);

  for (const rawLine of text.split(/\r?\n/)) {
    const original = rawLine.normalize("NFC");
    if (!original.trim()) continue;
    const folded = fold(original);
    const report: LineReport = { text: original.trim(), items: [], warnings: [] };

    // ---- trip / timeline lines: "14 ngày - chuyến 1"
    const days = folded.match(/(\d+)(?:\s*[-–—]\s*(\d+))?\s*(?:ngay|days?)/);
    const trip = folded.match(/(?:chuyen|trip|lan|phase|giai doan)\s*(\d)/);
    if (days && trip) {
      const idx = Number(trip[1]) - 1;
      timelines[idx] = `${days[2] ? `${days[1]}-${days[2]}` : days[1]} days`;
      report.items.push(`Chuyến ${trip[1]}: ${timelines[idx]}`);
      lines.push(report);
      continue;
    }

    // ---- tokenize
    const words: { w: string; start: number; end: number }[] = [];
    const raw: { m: RegExpMatchArray; i: number }[] = [];
    for (const m of folded.matchAll(TOKEN_RE)) raw.push({ m, i: m.index ?? 0 });
    for (const { m, i } of raw) {
      const s = m[0];
      if (/^[a-z]/.test(s)) words.push({ w: s, start: i, end: i + s.length });
    }
    // events, with multi-word shorthand ("nang xoang kin") matched as one phrase
    const cleaned: Ev[] = [];
    {
      let skipUntil = -1;
      for (const { m, i } of raw) {
        if (i < skipUntil) continue;
        const s = m[0];
        if (/^[a-z]/.test(s)) {
          const w = words.findIndex((x) => x.start === i);
          const hit = trig.find((t) => t.words.every((ww, kk) => words[w + kk]?.w === ww));
          if (hit) {
            cleaned.push({ t: "rule", rule: hit.rule, at: i });
            skipUntil = words[w + hit.words.length - 1].end;
          } else if (!FILLER.has(s)) cleaned.push({ t: "unknown", text: original.slice(i, i + s.length) });
        } else if (s === "->" || s === "→") cleaned.push({ t: "arrow" });
        else if (m[1] && m[2]) cleaned.push({ t: "teeth", teeth: expandRange(m[1], m[2]) });
        else if (m[3]) cleaned.push({ t: "qty", n: Number(m[3]) });
        else if (m[4]) cleaned.push({ t: "teeth", teeth: [m[4]] });
      }
    }

    // ---- build segments
    const segs: Seg[] = [];
    let cur: Seg | null = null;
    let pending: string[] = [];
    let clause = 0;
    let provNext = false;
    let lineBrand: Rule | undefined;
    const lastItem = (): { prov?: boolean; qty?: number } | null =>
      cur ? (cur.mods.length ? cur.mods[cur.mods.length - 1] : cur) : null;

    for (let e = 0; e < cleaned.length; e++) {
      const ev = cleaned[e];
      if (ev.t === "arrow") {
        clause++;
        cur = null;
      } else if (ev.t === "teeth") {
        if (cur) cur.teeth.push(...ev.teeth);
        else pending.push(...ev.teeth);
      } else if (ev.t === "qty") {
        const li = lastItem();
        if (li) li.qty = ev.n;
      } else if (ev.t === "unknown") {
        unknown.push(ev.text);
        report.warnings.push(`Chưa hiểu “${ev.text}”`);
      } else {
        const r = ev.rule;
        if (r.kind === "provisional") {
          const nextIsItem = cleaned.slice(e + 1).some((x) => x.t === "rule" && x.rule.kind !== "provisional" && x.rule.kind !== "brand");
          const stopsAtArrow = cleaned.slice(e + 1).findIndex((x) => x.t === "arrow");
          const ahead = cleaned
            .slice(e + 1, stopsAtArrow >= 0 ? e + 1 + stopsAtArrow : undefined)
            .some((x) => x.t === "rule" && x.rule.kind !== "provisional" && x.rule.kind !== "brand");
          if (nextIsItem && ahead) provNext = true;
          else {
            const li = lastItem();
            if (li) li.prov = true;
          }
        } else if (r.kind === "brand") {
          if (cur && cur.rule?.kind === "implant") cur.brand = r;
          lineBrand = r;
        } else if (r.starts) {
          if (cur && cur.rule?.kind === r.kind && cur.teeth.length === 0 && cur.mods.length === 0 && r.kind === "implant") {
            // "cắm im 34" — two words for the same thing
          } else {
            cur = { rule: r, teeth: [...pending], mods: [], prov: provNext, clause };
            pending = [];
            provNext = false;
            segs.push(cur);
          }
        } else {
          if (!cur) {
            cur = { rule: null, teeth: [...pending], mods: [], prov: false, clause };
            pending = [];
            segs.push(cur);
          }
          cur.mods.push({ rule: r, prov: provNext });
          provNext = false;
        }
      }
    }

    // ---- inherit teeth + create rows
    for (let s = 0; s < segs.length; s++) {
      const seg = segs[s];
      seg.teeth = uniq(seg.teeth);
      if (seg.teeth.length === 0) {
        for (let b = s - 1; b >= 0; b--) {
          const prev = segs[b];
          if (prev.teeth.length === 0) continue;
          // an old bridge's span is only handed to a crown written in the same breath
          if (prev.rule?.kind === "ignore" && !(seg.rule?.kind === "service" && seg.rule.phase === 2 && prev.clause === seg.clause)) continue;
          seg.teeth = prev.teeth;
          break;
        }
      }
      const teethStr = seg.teeth.join(", ");
      const qtyFor = (mode: QtyMode | undefined, explicit?: number) =>
        explicit ?? (mode === "one" ? 1 : mode === "regions" ? regionCount(seg.teeth) : Math.max(1, seg.teeth.length));
      const kindOf = (mode: QtyMode | undefined, explicit?: number): "teeth" | "fixed" =>
        explicit !== undefined || mode === "regions" || mode === "one" ? "fixed" : "teeth";

      const r = seg.rule;
      const addService = (
        name: string,
        phase: 0 | 1,
        mode: QtyMode | undefined,
        explicit: number | undefined,
        prov: boolean | undefined,
        label: string,
        priceLike?: string,
      ) => {
        const finalName = prov ? provName(name) : name;
        const q = qtyFor(mode, explicit);
        const known = inCatalog(finalName) || inCatalog(name);
        push({
          name: finalName,
          teeth: teethStr,
          qty: q,
          phase,
          qtyKind: kindOf(mode, explicit),
          ...(!known && priceLike && inCatalog(priceLike) ? { priceLike } : {}),
        });
        report.items.push(`${label}${teethStr ? ` ${teethStr}` : ""}${q > 1 && mode !== "teeth" ? ` ×${q}` : ""}`);
      };
      const addFollowUps = (primaryName: string, keep?: (n: string) => boolean) => {
        for (const a of autoRowsFor(primaryName, teethStr)) {
          if (keep && !keep(a.name)) continue;
          push({ name: a.name, teeth: a.tooth, qty: Math.max(1, countTeeth(a.tooth)), phase: a.phaseOffset === 1 ? 1 : 0, auto: true, qtyKind: "teeth" });
        }
      };

      if (r) {
        if (seg.teeth.length === 0 && r.kind !== "ignore") report.warnings.push(`Thiếu số răng cho “${r.triggers[0]}”`);
        if (r.kind === "service" && r.service) {
          addService(r.service, (r.phase ?? 1) === 2 ? 1 : 0, r.qtyMode, seg.qty, seg.prov, r.service);
        } else if (r.kind === "implant") {
          const base = (seg.brand ?? lineBrand)?.service ?? r.service ?? "Osstem (Korea) Implant";
          addService(base, 0, "teeth", seg.qty, seg.prov, base);
          addFollowUps(base);
        } else if (r.kind === "rct") {
          const groups = new Map<number, string[]>();
          for (const t of seg.teeth) {
            const p = pulpsForTooth(t) ?? 1;
            groups.set(p, [...(groups.get(p) ?? []), t]);
          }
          for (const [p, teeth] of [...groups.entries()].sort((a, b) => a[0] - b[0])) {
            const nm = rootCanalVariant("Root Canal Treatment", p);
            push({ name: seg.prov ? provName(nm) : nm, teeth: teeth.join(", "), qty: teeth.length, phase: 0, qtyKind: "teeth" });
            report.items.push(`${nm} ${teeth.join(", ")}`);
          }
          if (seg.teeth.length) {
            addFollowUps("Root Canal Treatment", (n) => (/fiberglass/i.test(n) ? !!r.post : /crown/i.test(n) ? !!r.crown : false));
            if (r.post) report.items.push(`Fiberglass Post ${teethStr}`);
            if (r.crown) report.items.push(`Crown on RCT ${teethStr}`);
          }
        } else if (r.kind === "ignore") {
          report.items.push(`${r.triggers[0]} ${teethStr} (bỏ qua)`);
        }
      }

      // ---- add-ons (nxk, nxh, gx, đm2, ssa …)
      const serviceMods = seg.mods.filter((m) => m.rule.kind === "service" && m.rule.service);
      // "gx đm2" is ONE graft: the highest level written wins, qty / provisional carry over.
      const graftMods = serviceMods.filter((m) => m.rule.group === "graft");
      let graft: Mod | undefined;
      if (graftMods.length) {
        const best = graftMods.reduce((a, b) => ((b.rule.rank ?? 0) > (a.rule.rank ?? 0) ? b : a));
        const qty = [...graftMods].reverse().find((m) => m.qty !== undefined)?.qty;
        graft = { rule: best.rule, qty, prov: graftMods.some((m) => m.prov) };
      }
      const mods = serviceMods.filter((m) => m.rule.group !== "graft");
      const closed = mods.find((m) => m.rule.group === "closed-sinus");
      const comboName = closed && graft && graft.rule.id === "graft" ? "Closed Sinus Lift + Bone Graft" : null;
      const comboOk = comboName && (inCatalog(comboName) || catalogNames.length === 0);
      if (comboOk) {
        addService(comboName!, 0, "teeth", undefined, !!(closed?.prov || graft?.prov), comboName!);
      }
      for (const m of [...mods, ...(graft ? [graft] : [])]) {
        if (comboOk && (m === closed || m === graft)) continue;
        addService(
          m.rule.service!,
          (m.rule.phase ?? 1) === 2 ? 1 : 0,
          m.rule.qtyMode,
          m.qty,
          m.prov,
          m.rule.service!,
          m.rule.priceLike,
        );
      }
    }

    if (segs.length === 0 && report.warnings.length === 0) report.warnings.push("Không nhận ra dòng này");
    lines.push(report);
  }

  // ---- merge duplicate services (same name + phase): union of teeth, sum / recount qty
  const merged: DraftRow[] = [];
  for (const row of draftRows) {
    const hit = merged.find((x) => x.phase === row.phase && x.name.toLowerCase() === row.name.toLowerCase());
    if (!hit) {
      merged.push({ ...row });
      continue;
    }
    hit.teeth = mergeTeeth(hit.teeth, row.teeth);
    if (hit.qtyKind === "teeth" && row.qtyKind === "teeth") hit.qty = Math.max(1, countTeeth(hit.teeth));
    else {
      hit.qty += row.qty;
      hit.qtyKind = "fixed";
    }
    hit.auto = hit.auto && row.auto;
  }

  return { rows: merged, timelines, lines, unknown: uniq(unknown) };
}

// ------------------------------------------------------------------ rule storage

const RULES_KEY = "dci-shorthand-rules-v1";

export function loadRules(): Rule[] {
  try {
    const raw = localStorage.getItem(RULES_KEY);
    if (!raw) return DEFAULT_RULES.map((r) => ({ ...r }));
    const saved = JSON.parse(raw) as Rule[];
    const byId = new Map(saved.map((r) => [r.id, r]));
    const merged = DEFAULT_RULES.map((d) => ({ ...d, ...(byId.get(d.id) ?? {}), builtin: true }));
    const custom = saved.filter((r) => !DEFAULT_RULES.some((d) => d.id === r.id)).map((r) => ({ ...r, builtin: false }));
    return [...merged, ...custom];
  } catch {
    return DEFAULT_RULES.map((r) => ({ ...r }));
  }
}

export function saveRules(rules: Rule[]): void {
  try {
    localStorage.setItem(RULES_KEY, JSON.stringify(rules));
  } catch {
    /* storage unavailable — rules last for this session only */
  }
}

export function resetRules(): Rule[] {
  try {
    localStorage.removeItem(RULES_KEY);
  } catch {
    /* ignore */
  }
  return DEFAULT_RULES.map((r) => ({ ...r }));
}

export { abutmentForImplant };
