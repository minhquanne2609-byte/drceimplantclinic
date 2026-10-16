import { createFileRoute, Link } from "@tanstack/react-router";
import { RichEditable } from "@/components/RichTextEditor";
import { RichText } from "@/components/RichText";
import { toPlain, stripLeadingNumber, isEmptyRich } from "@/lib/rich-text";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Upload,
  ImagePlus,
  X,
  Move,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Search,
  Pencil,
  Check,
  GripVertical,
  Undo2,
  Redo2,
  Eraser,
  ArrowUp,
  MessageCircle,
  Phone,
  Mail,
  ClipboardList,
  CalendarDays,
  Coins,
  AlertTriangle,
  Stethoscope,
  LogIn,
  Images,
  ArrowLeftRight,
  Download,
  Copy,
  MapPin,
  Globe,
  Clock,
  Facebook,
  Twitter,
  Youtube,
  Instagram,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import heroTeam from "@/assets/hero-team.jpg";
import clinic1 from "@/assets/clinic/clinic-1.png";
import clinic2 from "@/assets/clinic/clinic-2.jpg";
import clinic3 from "@/assets/clinic/clinic-3.jpg";
import baBefore1 from "@/assets/clinic/before-1.jpg";
import baAfter1 from "@/assets/clinic/after-1.jpg";
import implantIllustration from "@/assets/implant-illustration.png";
import toothIcon from "@/assets/tooth-icon.png";
import drCareLogo from "@/assets/drcare-logo-new-upload.png";
import techDcarerNavigation from "@/assets/clinic/tech-dcarer-navigation.jpg";
import techDigitalControl from "@/assets/clinic/tech-digital-control.webp";
import techSurgicalGuide from "@/assets/clinic/tech-surgical-guide.jpg";
import techPicSystem from "@/assets/clinic/tech-pic-system.jpg";
import tech3ShapeScanner from "@/assets/clinic/tech-3shape-3d.jpg";
import techConebeamCt from "@/assets/clinic/tech-conebeam-ct.jpg";
import techAiNavigation from "@/assets/clinic/tech-ai-navigation.jpg";
import techCustomizedAbutment from "@/assets/clinic/tech-customized-abutment.webp";
import procedureConsultation from "@/assets/clinic/procedure-consultation.jpg";
import procedureChairside from "@/assets/clinic/procedure-chairside.jpg";
import procedureSurgery from "@/assets/clinic/procedure-surgery.jpg";
import { fetchServiceCatalog, SEED_CATALOG as SHIPPED_CATALOG, type CatalogItem } from "@/lib/service-catalog";
import { ToothChart, ALL_TEETH } from "@/components/ToothChart";
import { ToothNumberPicker, parseTokens, expandToken } from "@/components/ToothNumberPicker";
import { TagMultiSelect } from "@/components/TagMultiSelect";
import { ISSUE_OPTIONS, TREATMENT_GROUPS, parseList, joinList } from "@/lib/diagnosis-options";

import { PRICE_LISTS } from "@/lib/price-lists";
import { fetchActiveContent, isContentManager, onContentInvalidated, saveContentAsDefault, type ContentMap } from "@/lib/clinic-content";
import { isPdfUrl, shownLimit, uploadClinicMedia, visibleMedia, type MediaItem } from "@/lib/clinic-media";
import { supabase } from "@/integrations/supabase/client";
import { useZoomCounterScale } from "@/hooks/use-zoom-counter-scale";

/**
 * Framing (fit + position) the owner picked in /content, keyed by image URL.
 * Lets every image on the page honour "Fit whole image" without prop threading.
 */
type MediaFrame = {
  fit: "cover" | "contain";
  position: string;
  zoom: number;
  heightMm?: number;
};

const MediaStyleCtx = createContext<Record<string, MediaFrame>>({});

function useMediaStyle(src?: string | null): React.CSSProperties | undefined {
  const map = useContext(MediaStyleCtx);
  const s = src ? map[src] : undefined;
  if (!s) return undefined;
  return {
    objectFit: s.fit,
    objectPosition: s.position,
    transform: s.zoom > 1 ? `scale(${s.zoom})` : undefined,
    ...(s.heightMm ? { height: `${Math.round(s.heightMm * 3.78)}px` } : {}),
  };
}

function buildMediaStyles(content: ContentMap) {
  const out: Record<string, MediaFrame> = {};
  for (const [key, value] of Object.entries(content)) {
    // A4-only blocks keep their own framing inside the A4 renderer.
    if (key.startsWith("a4_")) continue;
    for (const m of (value.media ?? []) as MediaItem[]) {
      if (!m.url) continue;
      out[m.url] = {
        fit: m.fit ?? "cover",
        position: m.position ?? "50% 50%",
        zoom: Math.max(m.zoom ?? 1, 1),
        heightMm: m.heightMm,
      };
    }
  }
  return out;
}

import {
  autoDiscountVnd,
  autoRowsFor,
  countTeeth,
  EXTRACTION_DISCOUNT_VND,
  findImplantWarranty,
  IMPLANT_ABUTMENT_NAMES,
  isAllOnImplantSystemRow,
  isImplantServiceRow,
  isToothExtractionRow,
  allOnCount,
  isInPackageService,
  isRemovablePartialDenture,
  isRootCanalBase,
  mergeTeeth,
  pulpsForTooth,
  qualifiesForSedation,
  qualifiesForTempDentureDiscount,
  resolveDiagnosisTreatmentName,
  rootCanalVariant,
  rpdTotalVnd,
  RPD_BASE_VND,
} from "@/lib/plan-rules";
import { useLiveRates, CURRENCY_CODES } from "@/lib/currency";
import { SavedPlansBar } from "@/components/SavedPlans";
import { PatientJourneyNav } from "@/components/PatientJourneyNav";
import { SectionHeading } from "@/components/SectionHeading";
import { PhotoCollage } from "@/components/PhotoCollage";
import { PdfPages } from "@/components/PdfPages";

import { toPng, toJpeg } from "html-to-image";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

// Icon glyphs reused, in order, by the editable Advanced Technology columns.
const TECH_ICON_PATHS = [
  "M12 2c2.8 0 4.5 1.9 4.5 4.6 0 2-.7 3.3-1.1 5.2-.5 2.3-.4 4-.8 6.3-.3 1.7-.7 3.9-1.9 3.9-1.1 0-1.2-2.1-1.7-4.1-.2-.8-.6-1.2-1-1.2s-.8.4-1 1.2c-.5 2-.6 4.1-1.7 4.1-1.2 0-1.6-2.2-1.9-3.9-.4-2.3-.3-4-.8-6.3C4.2 9.9 3.5 8.6 3.5 6.6 3.5 3.9 5.2 2 8 2c1.2 0 1.8.5 2 .5s.8-.5 2-.5z",
  "M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z",
  "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4",
].map((d) => <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />);

// Icons reused, in order, by the editable Important Notes entries.
const NOTE_ICONS = [ClipboardList, CalendarDays, Coins, AlertTriangle, Stethoscope];

// Canonical "Special Treatment Support Package" wording — kept as one source of
// truth so the individual "+ Add item" presets and the whole-bundle "Apply offer
// case" presets below never drift out of sync. Headings/titles match the
// clinic's approved package doc; every item carries its full body text.
type OfferItem = { title: string; lines: string[] };

const OFFER_ITEM = {
  consultation: (): OfferItem => ({
    title: "FREE Consultation & Diagnostic Imaging — (Value 30 USD):",
    lines: [
      "Clinical consultation and necessary diagnostic imaging at our clinic, including CBCT/CT scan and X-rays required for treatment planning, are provided at no additional charge.",
    ],
  }),
  transportFullTrip: (): OfferItem => ({
    title: "FREE Airport & Treatment Transportation — (Value 180 USD):",
    lines: [
      "Complimentary private-car transportation is arranged for:",
      "Airport pick-up upon arrival in Ho Chi Minh City.",
      "Airport drop-off at the end of your treatment trip.",
      "Hotel → clinic → hotel transportation for all scheduled treatment appointments during both Trip 1 and Trip 2.",
    ],
  }),
  transportSingleVisit: (): OfferItem => ({
    title: "FREE Airport & Treatment Transportation — (Value 180 USD):",
    lines: [
      "Complimentary private-car transportation is arranged for:",
      "Airport pick-up upon arrival in Ho Chi Minh City.",
      "Airport drop-off at the end of your treatment trip.",
      "Hotel → clinic → hotel transportation for all scheduled treatment appointments on the first consultation day and implant placement day.",
    ],
  }),
  extractions: (): OfferItem => ({
    title: "FREE Implant-Related Extractions:",
    lines: [
      "Any tooth extraction clinically required specifically for the planned implant treatment is provided at no additional charge.",
    ],
  }),
  postSurgery: (): OfferItem => ({
    title: "FREE Post-Surgery Support:",
    lines: [
      "Medications: Antibiotics, anti-inflammatory drugs, and painkillers.",
      "Recovery kit: Ice packs, mouthwash, and soft food (e.g., porridge) provided to aid in your immediate recovery.",
    ],
  }),
  accommodation: (vnd: string, usd: string): OfferItem => ({
    title: `Accommodation Support — (Value ${vnd} VND ~${usd} USD):`,
    lines: [
      `Accommodation support valued at VND ${vnd} is provided for the eligible treatment period, from the start of implant treatment until the fixed temporary restoration is fitted.`,
      "To give you greater flexibility in choosing your preferred accommodation, we do not book the hotel on your behalf. Instead, once you arrive and proceed with the agreed eligible treatment plan, the support value will be deducted directly from your treatment bill.",
    ],
  }),
  fastTrack: (): OfferItem => ({
    title: "FREE Airport Immigration Fast Track — (Value 50 USD):",
    lines: [
      "Upon arrival at the airport, a Fast Track representative will meet you inside the arrival area and assist you through the arrival process, including priority immigration processing and baggage collection assistance.",
      "This service is designed to significantly reduce the usual waiting time at immigration. Depending on airport conditions, the arrival process may take approximately 30 minutes instead of potentially 1–2 hours during busy periods.",
    ],
  }),
  simCard: (): OfferItem => ({
    title: "FREE Vietnam SIM Card:",
    lines: [
      "A local SIM card is provided to help you stay connected with our International Patient Team and access essential communication services throughout your treatment trip.",
    ],
  }),
  visaSupport: (): OfferItem => ({
    title: "Visa Application Support — (Value 40 USD):",
    lines: [
      "If visa assistance is required, we can connect you directly with our supporting visa agency. The current service fee for a single-entry visa is USD 40, with an estimated processing time of 5–7 days.",
      "The service is arranged directly between you and the visa agency and must initially be paid in advance. If you subsequently arrive and proceed with the agreed eligible treatment plan, the USD 40 visa service fee will be credited against your treatment bill.",
    ],
  }),
  tempRestoration: (): OfferItem => ({
    title: "FREE High-Quality Fixed Temporary Restoration — (Value 770 USD):",
    lines: [
      "For qualifying full-arch implant treatment, a high-quality fixed temporary restoration during Trip 1 is included at no additional charge. This provides a fixed provisional set of teeth during the implant healing and osseointegration period before the final restoration is completed.",
    ],
  }),
  languageSupport: (): OfferItem => ({
    title: "English-Language & Interpretation Support Throughout Your Stay:",
    lines: [
      "English-speaking assistance is available throughout your treatment, including communication with doctors, treatment coordination and aftercare.",
      "Our International Patient Team can also provide remote interpretation assistance by phone during your stay in Vietnam when reasonably required, for example, if you experience a language barrier with transportation, accommodation or other practical matters.",
    ],
  }),
  packageConditions: (): OfferItem => ({
    // Title matched by isConditionsOffer() below (regex on "package conditions") —
    // this item is excluded from the 1/2/3 numbering and laid out separately in
    // the PNG export, so keep "Package Conditions" in the title unchanged.
    title: "Package Conditions:",
    lines: [
      "The benefits above apply to eligible implant treatment and are subject to the final confirmed treatment plan. Eligibility for individual benefits may vary according to the type and scope of treatment undertaken. Where a benefit is provided as a treatment credit or reimbursement, the applicable amount will be deducted from the treatment bill after the patient arrives and proceeds with the agreed eligible treatment.",
    ],
  }),
};


/**
 * Build the "+ Add item" preset list and the "Apply offer case" bundles from
 * the clinic's published Content ("Special Treatment Support Package" /
 * patient_benefits) instead of the hardcoded OFFER_ITEM seed above, so both
 * menus always show whatever wording/values/formatting were last published —
 * never a stale, separately-maintained copy.
 *
 * Items that come in amount-specific variants (accommodation, and the
 * full-trip vs. single-visit transportation line) aren't stored twice in
 * Content — there's one canonical entry for each — so those variants are
 * derived from that one entry (swapping the number or the trailing clause)
 * rather than hardcoded separately.
 */
function buildOfferLibrary(content: ContentMap) {
  const items = content.patient_benefits.items;
  const norm = (s: string) =>
    toPlain(s)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  const find = (keyword: string): OfferItem | null => {
    const needle = norm(keyword);
    const hit = items.find((it) => norm(it.title).includes(needle));
    return hit ? { title: hit.title, lines: [...hit.lines] } : null;
  };

  const transportFullTrip = find("transport") ?? OFFER_ITEM.transportFullTrip();
  const transportSingleVisit: OfferItem = {
    title: transportFullTrip.title,
    lines: transportFullTrip.lines.map((l, i, arr) =>
      i === arr.length - 1
        ? l.replace(
            /during both trip 1 and trip 2/i,
            "on the first consultation day and implant placement day",
          )
        : l,
    ),
  };

  const accommodationSeed = find("accommodation") ?? OFFER_ITEM.accommodation("10,000,000", "382");
  const accommodation = (vnd: string, usd: string): OfferItem => {
    const vndMatch = accommodationSeed.title.match(/([\d,]+)\s*VND/i);
    const usdMatch = accommodationSeed.title.match(/([\d,]+)\s*USD/i);
    const swap = (s: string) => {
      let out = s;
      if (vndMatch) out = out.split(vndMatch[1]).join(vnd);
      if (usdMatch) out = out.split(usdMatch[1]).join(usd);
      return out;
    };
    return { title: swap(accommodationSeed.title), lines: accommodationSeed.lines.map(swap) };
  };

  return {
    consultation: find("consultation") ?? OFFER_ITEM.consultation(),
    transportFullTrip,
    transportSingleVisit,
    extractions: find("extraction") ?? OFFER_ITEM.extractions(),
    postSurgery: find("post surgery") ?? OFFER_ITEM.postSurgery(),
    accommodation,
    fastTrack: find("fast track") ?? find("immigration") ?? OFFER_ITEM.fastTrack(),
    simCard: find("sim card") ?? OFFER_ITEM.simCard(),
    visaSupport: find("visa") ?? OFFER_ITEM.visaSupport(),
    tempRestoration: find("temporary restoration") ?? OFFER_ITEM.tempRestoration(),
    languageSupport: find("language") ?? find("interpretation") ?? OFFER_ITEM.languageSupport(),
    packageConditions: find("package condition") ?? OFFER_ITEM.packageConditions(),
  };
}

function buildOfferPresets(lib: ReturnType<typeof buildOfferLibrary>): OfferItem[] {
  return [
    lib.consultation,
    lib.transportFullTrip,
    lib.transportSingleVisit,
    lib.extractions,
    lib.postSurgery,
    lib.accommodation("7,000,000", "268"),
    lib.accommodation("10,000,000", "382"),
    lib.fastTrack,
    lib.simCard,
    lib.visaSupport,
    lib.tempRestoration,
    lib.languageSupport,
    lib.packageConditions,
  ];
}

function buildOfferCases(
  lib: ReturnType<typeof buildOfferLibrary>,
): { label: string; items: OfferItem[] }[] {
  return [
    {
      label: "Single Implant",
      items: [
        lib.consultation,
        lib.transportSingleVisit,
        lib.extractions,
        lib.postSurgery,
        lib.fastTrack,
        lib.visaSupport,
        lib.languageSupport,
        lib.packageConditions,
      ],
    },
    {
      label: "Implant + General (bill ≥ 19,000,000₫)",
      items: [
        lib.consultation,
        lib.transportSingleVisit,
        lib.extractions,
        lib.postSurgery,
        lib.languageSupport,
        lib.packageConditions,
      ],
    },
    {
      label: "Full Arch — Single Arch (All-on-4 / All-on-6, 1 jaw)",
      items: [
        lib.consultation,
        lib.transportFullTrip,
        lib.extractions,
        lib.postSurgery,
        lib.accommodation("7,000,000", "268"),
        lib.fastTrack,
        lib.simCard,
        lib.visaSupport,
        lib.tempRestoration,
        lib.languageSupport,
        lib.packageConditions,
      ],
    },
    {
      label: "Full Arch — Both Arches (2 jaws)",
      items: [
        lib.consultation,
        lib.transportFullTrip,
        lib.extractions,
        lib.postSurgery,
        lib.accommodation("10,000,000", "382"),
        lib.fastTrack,
        lib.simCard,
        lib.visaSupport,
        lib.tempRestoration,
        lib.languageSupport,
        lib.packageConditions,
      ],
    },
  ];
}


// VND per USD used to auto-fill the USD unit price when a service is picked.
const VND_PER_USD = 25400;
const fmtVnd = (n: number) => n.toLocaleString("en-US");

const SEED_CATALOG: CatalogItem[] = SHIPPED_CATALOG;
const CATALOG_STORAGE_KEY = "dental_services_catalog_v1";

function useCatalog() {
  const [items, setItems] = useState<CatalogItem[]>(() => {
    if (typeof window === "undefined") return SEED_CATALOG;
    try {
      const raw = localStorage.getItem(CATALOG_STORAGE_KEY);
      if (raw) return JSON.parse(raw) as CatalogItem[];
    } catch {}
    return SEED_CATALOG;
  });

  // The clinic-published catalog (managed in /content) always wins.
  useEffect(() => {
    let alive = true;
    const pull = () => {
      void fetchServiceCatalog().then((row) => {
        if (alive && row.published) setItems(row.items);
      });
    };
    pull();
    const off = onContentInvalidated(pull);
    return () => {
      alive = false;
      off();
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(CATALOG_STORAGE_KEY, JSON.stringify(items));
    } catch {}
  }, [items]);
  return {
    items,
    add: (item: CatalogItem) => setItems((prev) => [{ name: item.name.trim(), priceVnd: item.priceVnd }, ...prev]),
    update: (index: number, item: CatalogItem) =>
      setItems((prev) => prev.map((it, i) => (i === index ? { name: item.name.trim(), priceVnd: item.priceVnd } : it))),
    remove: (index: number) => setItems((prev) => prev.filter((_, i) => i !== index)),
    reset: () => setItems(SEED_CATALOG),
  };
}

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Personalized Dental Treatment Plan" },
      {
        name: "description",
        content:
          "Editable personalized dental implant treatment plan with patient medical history and multi-currency pricing.",
      },
      { property: "og:title", content: "Personalized Dental Treatment Plan" },
      {
        property: "og:description",
        content:
          "Editable personalized dental implant treatment plan with patient medical history and multi-currency pricing.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PlanPageWithContent,
});

// -------- Types --------
type Row = {
  id: string;
  name: string;
  tooth: string;
  qty: number;
  /** Unit price in VND; null = "In package" */
  unitVnd: number | null;
  /** Discount per unit, in VND */
  discount?: number;
  vnd?: string; // manual override of the VND amount
  fx?: Record<string, string>; // manual override per currency column id
  extra?: Record<string, string>; // values for custom columns
  /** Row generated from the Diagnosis tooth chart (kept in sync with it) */
  dx?: boolean;
  /**
   * Identity of the Diagnosis pick that created this row (the resolved
   * default service name at creation time, e.g. "Neodent (Swiss) Implant
   * System (All-on-4)"). Used to keep tracking the row's tooth/qty from the
   * chart even after the user renames `name` to a different service — the
   * link stays alive, but the service choice itself remains editable.
   */
  dxKey?: string;
  /** Row generated as an automatic follow-up (e.g. abutment/crown after an implant) */
  auto?: boolean;
  /**
   * Once the user directly edits the tooth numbers (or quantity) on a
   * dx-linked / auto-linked row, that field is "unlocked" from the plan
   * rule: the rule keeps running (so the row still appears, still gets
   * discounts, still triggers its own follow-ups, etc.) but stops
   * overwriting this specific field. The plan rule is a convenience default,
   * not a lock — the user can always type a different tooth number or
   * quantity when a case needs it.
   */
  toothManual?: boolean;
  qtyManual?: boolean;
};
type Col = {
  id: string;
  label: string;
  kind: "vnd" | "fx" | "custom";
  currency?: string; // for kind === "fx"
};
type Phase = {
  id: string;
  title: string;
  rows: Row[];
  note?: string; // editable note shown between this phase and the next
};

const uid = () => Math.random().toString(36).slice(2, 9);

// ----- Phase timeline (e.g. "Phase 1 — Implant Placement (14 days)") -----
// The trailing "(... days)" segment of a phase title is edited via a preset
// dropdown, while the rest of the title stays freely editable text.
const PHASE_TIMELINE_OPTIONS = [
  "5-7 days",
  "7-10 days",
  "7-14 days",
  "10-14 days",
  "14-21 days",
  "21-30 days",
];
const PHASE_TIMELINE_CUSTOM = "__custom__";
const PHASE_TIMELINE_RE = /\(\s*([^()]*\bdays?\b[^()]*)\)\s*$/i;
const normalizeDashes = (s: string) => s.replace(/[\u2010-\u2015]/g, "-");

function splitPhaseTitle(title: string): { base: string; timeline: string } {
  const m = (title || "").match(PHASE_TIMELINE_RE);
  if (!m) return { base: (title || "").trim(), timeline: "" };
  return { base: title.slice(0, m.index).trim(), timeline: m[1].trim() };
}
function composePhaseTitle(base: string, timeline: string): string {
  const b = (base || "").trim();
  const t = (timeline || "").trim();
  return t ? `${b} (${t})` : b;
}

// USD -> AUD conversion (editable in UI)
const DEFAULT_USD_TO_AUD = 1.52;
const fmtNum = (n: number, decimals = 2) =>
  n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
const fmtInt = (n: number) => Math.round(n).toLocaleString("en-US");
/** Format a user-typed numeric string with thousand separators; leaves non-numeric text intact. */
const fmtStrNum = (s: string, decimals = 0) => {
  const raw = (s ?? "").toString().trim();
  if (!raw) return raw;
  const cleaned = raw.replace(/,/g, "");
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return raw;
  const n = Number(cleaned);
  return decimals > 0 && cleaned.includes(".") ? fmtNum(n, decimals) : fmtInt(n);
};

// -------- Undo / Redo history --------
function useUndoRedo(snapshot: Record<string, unknown>, restore: (s: any) => void) {
  const json = JSON.stringify(snapshot);
  const past = useRef<string[]>([]);
  const future = useRef<string[]>([]);
  const current = useRef<string>(json);
  const restoring = useRef(false);
  const [, force] = useState(0);

  useEffect(() => {
    if (restoring.current) {
      restoring.current = false;
      current.current = json;
      return;
    }
    if (json === current.current) return;
    const prev = current.current;
    const t = setTimeout(() => {
      past.current.push(prev);
      if (past.current.length > 100) past.current.shift();
      future.current = [];
      current.current = json;
      force((n) => n + 1);
    }, 450);
    return () => clearTimeout(t);
  }, [json]);

  const apply = (s: string) => {
    restoring.current = true;
    current.current = s;
    restore(JSON.parse(s));
    force((n) => n + 1);
  };

  const undo = () => {
    if (json !== current.current) {
      // commit the in-flight edit so it can be redone
      future.current.push(json);
      apply(current.current);
      return;
    }
    const prev = past.current.pop();
    if (prev === undefined) return;
    future.current.push(current.current);
    apply(prev);
  };

  const redo = () => {
    const next = future.current.pop();
    if (next === undefined) return;
    past.current.push(current.current);
    apply(next);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (k === "y" || k === "s") {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Drops every retained undo/redo snapshot. Each snapshot is a full
  // JSON.stringify of the whole page (including any base64-encoded uploaded
  // photos), and up to 100 are kept — after a long editing session with a
  // few images that adds up to hundreds of MB of heap, which is the usual
  // cause of the tab running out of memory. This frees all of it at once
  // without touching the current plan or losing any saved work.
  const clearHistory = () => {
    const dropped = past.current.length + future.current.length;
    past.current = [];
    future.current = [];
    current.current = json;
    force((n) => n + 1);
    return dropped;
  };

  return {
    undo,
    redo,
    clearHistory,
    canUndo: past.current.length > 0 || json !== current.current,
    canRedo: future.current.length > 0,
  };
}

// -------- Editable primitive (rich text) --------
// Owner/staff can format any copy inline (bold, sizes, colour, lists, links);
// the design system still owns font family, palette tokens and spacing.
function Editable({
  value,
  onChange,
  className = "",
  as: As = "span",
  placeholder,
  multiline = false,
  toolbar = false,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  as?: any;
  placeholder?: string;
  multiline?: boolean;
  toolbar?: boolean;
}) {
  return (
    <RichEditable
      value={value}
      onChange={onChange}
      as={As}
      className={className}
      placeholder={placeholder}
      inline={!multiline}
      toolbar={toolbar}
    />
  );
}

function phoneToWhatsAppDigits(raw: string) {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("84")) return digits;
  if (digits.startsWith("0")) return `84${digits.slice(1)}`;
  return `84${digits}`;
}

function isMobileDevice() {
  return (
    typeof navigator !== "undefined" &&
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
  );
}

function whatsAppClickUrl(raw: string) {
  const phone = phoneToWhatsAppDigits(raw);
  return isMobileDevice() ? `https://wa.me/${phone}` : `https://web.whatsapp.com/send?phone=${phone}`;
}

function PhoneLink({
  value,
  onChange,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  const handleWhatsAppClick = (e: React.MouseEvent<HTMLAnchorElement>, raw: string) => {
    e.stopPropagation();
    e.preventDefault();
    window.open(whatsAppClickUrl(raw), "_blank", "noopener,noreferrer");
  };

  const parts = useMemo(() => {
    const regex = /(\(?\+84\)?[\s.-]?\d(?:[\s.-]?\d){8})/g;
    const result: { type: "text" | "phone"; value: string }[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(value)) !== null) {
      if (match.index > lastIndex) {
        result.push({ type: "text", value: value.slice(lastIndex, match.index) });
      }
      result.push({ type: "phone", value: match[0] });
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < value.length) {
      result.push({ type: "text", value: value.slice(lastIndex) });
    }
    return result;
  }, [value]);

  return (
    <span
      contentEditable
      suppressContentEditableWarning
      onBlur={(e) => onChange(e.currentTarget.innerText.replace(/\n/g, " "))}
      className={"outline-none rounded px-1 -mx-1 focus:bg-primary/10 hover:bg-muted transition-colors " + className}
    >
      {parts.map((part, i) =>
        part.type === "phone" ? (
          <a
            key={i}
            href={`https://wa.me/${phoneToWhatsAppDigits(part.value)}`}
            target="_blank"
            rel="noopener noreferrer"
            contentEditable={false}
            className="text-accent underline hover:text-accent/80"
            onClick={(e) => handleWhatsAppClick(e, part.value)}
          >
            {part.value}
          </a>
        ) : (
          <span key={i}>{part.value}</span>
        ),
      )}
    </span>
  );
}

// Splits a service name into its main text and any trailing "(...)" groups,
// e.g. "Neodent (Swiss) Implant System (All-on-6) (4 Standard + 2 Pterygoid Implant)"
// -> { main: "Neodent (Swiss) Implant System", parens: ["(All-on-6)", "(4 Standard + 2 Pterygoid Implant)"] }.
// Used only for print layout, so each trailing group can be dropped onto its own
// centered line without ever being split mid-phrase (e.g. "(All-" / "on-6)").
function splitTrailingParens(name: string): { main: string; parens: string[] } {
  const m = name.match(/^(.*?)((?:\s*\([^()]*\))+)\s*$/);
  if (!m) return { main: name, parens: [] };
  const parens = m[2].match(/\([^()]*\)/g) ?? [];
  return { main: m[1].trim(), parens };
}

function PrintServiceName({ name }: { name: string }) {
  const { main, parens } = splitTrailingParens(name);
  return (
    // Never wraps, by request — "main" used to be whitespace-normal, which
    // is exactly what was breaking long combined names (e.g. "Root Canal
    // Treatment for 1 Pulp") across 3-4 lines even once the column had
    // plenty of room. Forcing it nowrap here means the browser's table
    // auto-layout simply widens the Service column/table to fit the actual
    // text instead of wrapping it — a hard guarantee that doesn't depend on
    // the auto-widen width estimate (see the effect above) being exactly
    // right for every possible service name. The trailing "(...)" qualifier
    // still gets its own line underneath (unchanged, deliberate) rather than
    // running the whole thing together — that's a clean two-line layout, not
    // the multi-line wrap this fixes.
    <span className="hidden print:flex flex-col items-center gap-0.5 leading-snug text-center w-full">
      {main && <span className="whitespace-nowrap" style={{ wordBreak: "keep-all" }}>{main}</span>}
      {parens.map((p, i) => (
        <span key={i} className="whitespace-nowrap" style={{ wordBreak: "keep-all" }}>
          {p}
        </span>
      ))}
    </span>
  );
}

// -------- Service autocomplete (searchable dental services with listed prices) --------
// estimateBrowserZoom / useZoomCounterScale now live in
// @/hooks/use-zoom-counter-scale so the Saved-plans dropdown can share them.

function ServiceCombobox({
  value,
  onPick,
  onFreeText,
  catalog,
  onAddCatalog,
  onUpdateCatalog,
  onRemoveCatalog,
}: {
  value: string;
  onPick: (item: CatalogItem) => void;
  onFreeText: (v: string) => void;
  catalog: CatalogItem[];
  onAddCatalog: (item: CatalogItem) => void;
  onUpdateCatalog: (index: number, item: CatalogItem) => void;
  onRemoveCatalog: (index: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const [highlight, setHighlight] = useState(0);
  const [newPrice, setNewPrice] = useState("");
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const zoomCounterScale = useZoomCounterScale(open);

  useEffect(() => setQuery(value), [value]);

  // matches with their original catalog index (so edit/remove act on the source)
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const indexed = catalog.map((s, idx) => ({ ...s, idx }));
    if (!q) return indexed.slice(0, 10);
    const tokens = q.split(/\s+/);
    return indexed.filter((s) => tokens.every((t) => s.name.toLowerCase().includes(t))).slice(0, 10);
  }, [query, catalog]);

  const exactMatch = useMemo(
    () => catalog.some((s) => s.name.toLowerCase() === query.trim().toLowerCase()),
    [catalog, query],
  );

  useEffect(() => {
    setHighlight(0);
  }, [query, open]);

  const commitPick = (item: CatalogItem) => {
    onPick(item);
    setQuery(item.name);
    setOpen(false);
  };

  const parsePrice = (s: string) => Number(s.replace(/[^\d.]/g, "")) || 0;

  const startEdit = (i: number, item: CatalogItem) => {
    setEditingIdx(i);
    setEditName(item.name);
    setEditPrice(String(item.priceVnd));
  };
  const saveEdit = (i: number) => {
    const price = parsePrice(editPrice);
    if (editName.trim() && price > 0) {
      onUpdateCatalog(i, { name: editName, priceVnd: price });
    }
    setEditingIdx(null);
  };

  const addNew = () => {
    const price = parsePrice(newPrice);
    const name = query.trim();
    if (!name || price <= 0) return;
    const item = { name, priceVnd: price };
    onAddCatalog(item);
    commitPick(item);
    setNewPrice("");
  };

  return (
    <div className="relative">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverAnchor asChild>
          <div className="flex items-center gap-1.5 justify-center">
            <Search className="w-3 h-3 text-muted-foreground shrink-0 print:hidden" />
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(true);
                onFreeText(e.target.value);
              }}
              onFocus={() => setOpen(true)}
              onKeyDown={(e) => {
                if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) setOpen(true);
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setHighlight((h) => Math.min(h + 1, matches.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setHighlight((h) => Math.max(h - 1, 0));
                } else if (e.key === "Enter") {
                  if (open && matches[highlight] && editingIdx === null) {
                    e.preventDefault();
                    commitPick(matches[highlight]);
                  }
                } else if (e.key === "Escape") {
                  setOpen(false);
                }
              }}
              placeholder="Type to search a service…"
              className="bg-transparent outline-none border-b border-dotted border-border focus:border-primary w-full py-0.5 text-center print:hidden"
            />
            <PrintServiceName name={query} />
          </div>
        </PopoverAnchor>
        {/* Portal-rendered (see PopoverContent), so this floats free of the
            Treatment Plan table's own horizontal-scroll wrapper instead of
            being clipped inside it. onOpenAutoFocus is suppressed so opening
            the list never steals focus away from the search input. */}
        <PopoverContent
          align="start"
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="w-auto border-0 bg-transparent p-0 shadow-none print:hidden"
        >
          <div
            className="w-[27.5rem] max-w-[85vw] bg-popover text-popover-foreground border border-border rounded-lg shadow-2xl overflow-hidden"
            style={
              zoomCounterScale > 1
                ? { transform: `scale(${zoomCounterScale})`, transformOrigin: "top left" }
                : undefined
            }
          >
          <div className="max-h-80 overflow-y-auto py-1">
            {matches.length === 0 && (
              <div className="px-3 py-2 text-xs text-muted-foreground">No matches. Add a new service below.</div>
            )}
            {matches.map((s, i) => (
              <div
                key={s.idx}
                onMouseEnter={() => setHighlight(i)}
                className={
                  "group w-full px-3 py-2 flex items-center justify-between gap-2 text-xs " +
                  (i === highlight && editingIdx === null ? "bg-primary/10" : "hover:bg-muted")
                }
              >
                {editingIdx === s.idx ? (
                  <>
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="flex-1 min-w-0 bg-background border border-border rounded px-1.5 py-1 text-xs"
                      autoFocus
                    />
                    <input
                      value={editPrice}
                      onChange={(e) => setEditPrice(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveEdit(s.idx);
                        if (e.key === "Escape") setEditingIdx(null);
                      }}
                      placeholder="VND"
                      className="w-24 bg-background border border-border rounded px-1.5 py-1 text-xs font-mono tabular-nums"
                    />
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        saveEdit(s.idx);
                      }}
                      className="p-1 rounded hover:bg-primary/20 text-primary"
                      title="Save"
                    >
                      <Check className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setEditingIdx(null);
                      }}
                      className="p-1 rounded hover:bg-muted"
                      title="Cancel"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        commitPick({ name: s.name, priceVnd: s.priceVnd });
                      }}
                      className="flex-1 min-w-0 text-left flex items-center justify-between gap-3"
                    >
                      <span className="font-medium truncate">{s.name}</span>
                      <span className="font-mono text-[0.6875rem] tabular-nums text-primary font-bold whitespace-nowrap">
                        {fmtVnd(s.priceVnd)}
                      </span>
                    </button>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          startEdit(s.idx, { name: s.name, priceVnd: s.priceVnd });
                        }}
                        className="p-1 rounded hover:bg-muted"
                        title="Edit"
                      >
                        <Pencil className="w-[0.6875rem] h-[0.6875rem]" />
                      </button>
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          if (confirm(`Remove "${s.name}" from catalog?`)) onRemoveCatalog(s.idx);
                        }}
                        className="p-1 rounded hover:bg-destructive/10 text-destructive"
                        title="Delete"
                      >
                        <Trash2 className="w-[0.6875rem] h-[0.6875rem]" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
          <div className="px-3 py-2 border-t border-border bg-muted/40 flex items-center gap-2">
            {query.trim() && !exactMatch ? (
              <>
                <span className="text-[0.6875rem] text-muted-foreground shrink-0">Add new:</span>
                <span className="text-xs font-medium truncate flex-1" title={query}>
                  {query.trim()}
                </span>
                <input
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addNew();
                    }
                  }}
                  placeholder="Price VND"
                  className="w-24 bg-background border border-border rounded px-1.5 py-1 text-xs font-mono tabular-nums"
                />
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    addNew();
                  }}
                  className="px-2 py-1 rounded bg-primary text-primary-foreground text-[0.6875rem] font-bold hover:opacity-90 flex items-center gap-1"
                >
                  <Plus className="w-[0.6875rem] h-[0.6875rem]" /> Add
                </button>
              </>
            ) : (
              <span className="text-[0.625rem] text-muted-foreground">
                {matches.length} match{matches.length === 1 ? "" : "es"} · hover a row to edit or delete · ↵ to insert
              </span>
            )}
          </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

// -------- Scroll to top button --------
// -------- Site-wide text-size control (scales text only, never images) --------
// Cycles through a few root font-size steps. Real photos in this app are laid
// out with aspect-ratio + % width (see PhotoCollage/ImageSlot), so bumping the
// rem-based text scale never stretches or "zooms" an image — and printing
// always resets to 100% (see styles.css) so PDFs/print stay exactly as tuned.
const FONT_SCALE_STEPS = [1, 1.1, 1.2, 1.35] as const;
const FONT_SCALE_STORAGE_KEY = "site-font-scale";

function applyFontScale(scale: number) {
  document.documentElement.style.setProperty("--user-font-scale", String(scale));
}

function useFontScale() {
  const [scale, setScale] = useState<number>(1);

  useEffect(() => {
    const stored = Number(localStorage.getItem(FONT_SCALE_STORAGE_KEY));
    const initial = (FONT_SCALE_STEPS as readonly number[]).includes(stored) ? stored : 1;
    setScale(initial);
    applyFontScale(initial);
  }, []);

  const increase = () => {
    setScale((prev) => {
      const idx = (FONT_SCALE_STEPS as readonly number[]).indexOf(prev);
      const next = FONT_SCALE_STEPS[(idx + 1) % FONT_SCALE_STEPS.length]!;
      applyFontScale(next);
      localStorage.setItem(FONT_SCALE_STORAGE_KEY, String(next));
      return next;
    });
  };

  return { scale, increase };
}

function FontSizeControl() {
  const { scale, increase } = useFontScale();
  const percent = Math.round(scale * 100);
  return (
    <button
      type="button"
      onClick={increase}
      className="fixed bottom-6 left-6 z-50 flex items-center gap-1.5 rounded-full bg-card text-foreground border border-border shadow-2xl px-4 py-3 font-bold text-sm hover:bg-muted transition-all print:hidden no-print"
      aria-label="Increase text size"
      title="Increase text size"
    >
      <span className="text-sm leading-none">A</span>
      <span className="text-lg leading-none">A</span>
      <span className="ml-1 text-xs font-semibold text-muted-foreground">{percent}%</span>
    </button>
  );
}

// Pinterest glyph — not in lucide-react, drawn in the same stroke style as the
// other social icons so it sits flush next to them.
function PinterestIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M9.5 18c.6-2 1.2-4.3 1.8-6.7" />
      <path d="M8.5 14.5C7.7 12 9 8.5 12.3 8.5c2.6 0 4 1.8 4 4s-1.2 4.3-3.4 4.3c-1 0-1.7-.5-2-1.2" />
    </svg>
  );
}

function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;
  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-primary text-primary-foreground shadow-2xl shadow-primary/30 px-4 py-3 font-bold text-sm hover:brightness-110 transition-all print:hidden no-print"
      aria-label="Scroll to top"
    >
      <ArrowUp size={18} />
      Click to top
    </button>
  );
}
// -------- Faint background watermark (e.g. clinic logo on the overview / phase 1 cards) --------
function Watermark({ src, alt = "" }: { src: string; alt?: string }) {
  if (!src) return null;
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center overflow-hidden"
    >
      <img
        src={src}
        alt={alt}
        className="w-[85%] object-contain opacity-[0.1] print:opacity-[0.13] grayscale"
      />
    </div>
  );
}

function EditableImage({
  src,
  onChange,
  alt = "",
  className = "",
  wrapperClassName = "",
  rounded = "rounded-lg",
}: {
  src: string;
  onChange: (dataUrl: string) => void;
  alt?: string;
  className?: string;
  wrapperClassName?: string;
  rounded?: string;
}) {
  const inputId = "img-" + Math.random().toString(36).slice(2, 8);
  const mediaStyle = useMediaStyle(src);
  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => onChange(String(reader.result));
    reader.readAsDataURL(file);
  };
  return (
    <label
      htmlFor={inputId}
      className={`group relative block cursor-pointer overflow-hidden ${rounded} ${wrapperClassName}`}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const f = e.dataTransfer.files?.[0];
        if (f && f.type.startsWith("image/")) handleFile(f);
      }}
      title="Click or drop an image to replace"
    >
      <img src={src} alt={alt} className={className} style={mediaStyle} />
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/95 text-primary text-xs font-bold shadow-lg">
          <Upload size={14} /> Replace image
        </div>
      </div>
      <input
        id={inputId}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.currentTarget.value = "";
        }}
      />
    </label>
  );
}

// -------- Slot for adding an image where there isn't one --------
function ImageSlot({
  src,
  onChange,
  onRemove,
  label = "Add image",
  aspect = "aspect-video",
  contain = false,
  onPickLibrary,
}: {
  src: string | null;
  onChange: (dataUrl: string) => void;
  onRemove: () => void;
  label?: string;
  aspect?: string;
  /** Show the whole image (X-rays, documents) instead of cropping it. */
  contain?: boolean;
  /** Opens the clinic content-library picker instead of a file upload. */
  onPickLibrary?: () => void;
}) {
  const inputId = "slot-" + Math.random().toString(36).slice(2, 8);
  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => onChange(String(reader.result));
    reader.readAsDataURL(file);
  };
  if (!src) {
    return (
      <label
        htmlFor={inputId}
        className={`group relative flex ${aspect} w-full cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed border-primary/30 bg-muted hover:border-primary hover:bg-primary/5 transition-colors print:hidden`}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files?.[0];
          if (f && f.type.startsWith("image/")) handleFile(f);
        }}
      >
        <div className="flex flex-col items-center gap-2 text-muted-foreground group-hover:text-primary transition-colors">
          <ImagePlus size={32} className="text-primary/60 group-hover:text-primary" />
          <span className="text-sm font-bold">{label}</span>
          <span className="text-xs opacity-70">Click or drop an image here</span>
        </div>
        <input
          id={inputId}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.currentTarget.value = "";
          }}
        />
        {onPickLibrary ? (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onPickLibrary();
            }}
            className="absolute bottom-2 right-2 z-10 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-white/95 text-primary text-[11px] font-bold shadow hover:bg-white"
          >
            <Images size={12} /> Choose from library
          </button>
        ) : null}
      </label>
    );
  }
  return (
    <div className="relative group">
      <EditableImage
        src={src}
        onChange={onChange}
        wrapperClassName={`w-full ${aspect}${contain ? " bg-muted" : ""}`}
        className={`w-full h-full ${contain ? "object-contain" : "object-cover"}`}
        rounded="rounded-xl"
      />
      <button
        onClick={onRemove}
        className="absolute top-2 right-2 p-1.5 rounded-full bg-white/95 text-destructive shadow opacity-0 group-hover:opacity-100 transition"
        aria-label="Remove image"
      >
        <X size={14} />
      </button>
    </div>
  );
}

// -------- Image with drag-to-pan + zoom (for print framing) --------
function PanZoomImage({
  src,
  onChange,
  pos,
  zoom,
  onView,
  alt = "",
  onPickLibrary,
}: {
  src: string;
  onChange: (dataUrl: string) => void;
  pos: { x: number; y: number };
  zoom: number;
  onView: (v: { pos?: { x: number; y: number }; zoom?: number }) => void;
  alt?: string;
  /** Opens the clinic content-library picker instead of a file upload. */
  onPickLibrary?: () => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const mediaStyle = useMediaStyle(src);
  const drag = useRef<{ startX: number; startY: number; posX: number; posY: number } | null>(null);

  const onMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("[data-no-drag]")) return;
    e.preventDefault();
    drag.current = { startX: e.clientX, startY: e.clientY, posX: pos.x, posY: pos.y };
    const move = (ev: MouseEvent) => {
      if (!drag.current || !boxRef.current) return;
      const rect = boxRef.current.getBoundingClientRect();
      const dx = ((ev.clientX - drag.current.startX) / rect.width) * 100;
      const dy = ((ev.clientY - drag.current.startY) / rect.height) * 100;
      onView({
        pos: {
          x: Math.max(0, Math.min(100, drag.current.posX - dx)),
          y: Math.max(0, Math.min(100, drag.current.posY - dy)),
        },
      });
    };
    const up = () => {
      drag.current = null;
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => onChange(String(reader.result));
    reader.readAsDataURL(file);
  };

  return (
    <div
      ref={boxRef}
      onMouseDown={onMouseDown}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const f = e.dataTransfer.files?.[0];
        if (f && f.type.startsWith("image/")) handleFile(f);
      }}
      className="group/pz relative w-full h-full overflow-hidden cursor-grab active:cursor-grabbing select-none"
      title="Drag to reposition · scroll buttons to zoom"
    >
      <img
        src={src}
        alt={alt}
        draggable={false}
        style={{
          objectFit: mediaStyle?.objectFit ?? "cover",
          objectPosition: `${pos.x}% ${pos.y}%`,
          transform: `scale(${zoom})`,
          transformOrigin: `${pos.x}% ${pos.y}%`,
        }}
        className="w-full h-full object-cover pointer-events-none"
      />
      <div
        data-no-drag
        onMouseDown={(e) => e.stopPropagation()}
        className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 opacity-0 group-hover/pz:opacity-100 transition print:hidden"
      >
        <button
          onClick={() => onView({ zoom: Math.max(1, +(zoom - 0.1).toFixed(2)) })}
          className="p-1.5 rounded-full bg-white/95 text-primary shadow hover:bg-white"
          aria-label="Zoom out"
        >
          <ZoomOut size={13} />
        </button>
        <button
          onClick={() => onView({ zoom: Math.min(3, +(zoom + 0.1).toFixed(2)) })}
          className="p-1.5 rounded-full bg-white/95 text-primary shadow hover:bg-white"
          aria-label="Zoom in"
        >
          <ZoomIn size={13} />
        </button>
        <button
          onClick={() => onView({ pos: { x: 50, y: 50 }, zoom: 1 })}
          className="p-1.5 rounded-full bg-white/95 text-primary shadow hover:bg-white"
          aria-label="Reset framing"
        >
          <RotateCcw size={13} />
        </button>
        <label className="cursor-pointer flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-white/95 text-primary text-[11px] font-bold shadow hover:bg-white">
          <Upload size={12} /> Replace
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.currentTarget.value = "";
            }}
          />
        </label>
        {onPickLibrary ? (
          <button
            onClick={onPickLibrary}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-white/95 text-primary text-[11px] font-bold shadow hover:bg-white"
          >
            <Images size={12} /> Library
          </button>
        ) : null}
      </div>
    </div>
  );
}

// -------- Before / After comparison with adjustable split --------
export type Comparison = {
  before: string | null;
  after: string | null;
  split: number;
  beforeLabel: string;
  afterLabel: string;
  beforePos?: { x: number; y: number };
  beforeZoom?: number;
  afterPos?: { x: number; y: number };
  afterZoom?: number;
};

function BeforeAfterCard({
  item,
  onChange,
  onRemove,
  onPickLibrary,
}: {
  item: Comparison;
  onChange: (patch: Partial<Comparison>) => void;
  onRemove: () => void;
  /** Opens the clinic content-library picker for the "before" or "after" slot. */
  onPickLibrary?: (slot: "before" | "after") => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const setFromClientX = (clientX: number) => {
    const el = boxRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const pct = Math.min(90, Math.max(10, ((clientX - r.left) / r.width) * 100));
    onChange({ split: Math.round(pct) });
  };

  useEffect(() => {
    const move = (e: MouseEvent) => dragging.current && setFromClientX(e.clientX);
    const up = () => (dragging.current = false);
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  });

  return (
    <div className={`relative group avoid-break ${!item.before && !item.after ? "print:hidden" : ""}`}>
      <div
        ref={boxRef}
        className="relative flex w-full overflow-hidden rounded-3xl border border-border shadow-xl bg-muted select-none"
        style={{ aspectRatio: "16 / 7" }}
      >
        <div className="relative h-full overflow-hidden" style={{ width: `${item.split}%` }}>
          {item.before ? (
            <PanZoomImage
              src={item.before}
              onChange={(u) => onChange({ before: u })}
              pos={item.beforePos ?? { x: 50, y: 50 }}
              zoom={item.beforeZoom ?? 1}
              onView={(v) =>
                onChange({
                  ...(v.pos ? { beforePos: v.pos } : {}),
                  ...(v.zoom !== undefined ? { beforeZoom: v.zoom } : {}),
                })
              }
              alt="Before"
              onPickLibrary={onPickLibrary ? () => onPickLibrary("before") : undefined}
            />
          ) : (
            <ImageSlot
              src={null}
              onChange={(u) => onChange({ before: u })}
              onRemove={() => {}}
              label="Add BEFORE photo"
              aspect="h-full"
              onPickLibrary={onPickLibrary ? () => onPickLibrary("before") : undefined}
            />
          )}
          <span className="absolute top-3 left-3 px-3 py-1 rounded-lg bg-foreground/80 text-background text-[1.25rem] font-bold">
            <Editable
              value={item.beforeLabel}
              onChange={(v) => onChange({ beforeLabel: v })}
              className="text-background"
            />
          </span>
        </div>
        <div className="relative h-full overflow-hidden flex-1">
          {item.after ? (
            <PanZoomImage
              src={item.after}
              onChange={(u) => onChange({ after: u })}
              pos={item.afterPos ?? { x: 50, y: 50 }}
              zoom={item.afterZoom ?? 1}
              onView={(v) =>
                onChange({
                  ...(v.pos ? { afterPos: v.pos } : {}),
                  ...(v.zoom !== undefined ? { afterZoom: v.zoom } : {}),
                })
              }
              alt="After"
              onPickLibrary={onPickLibrary ? () => onPickLibrary("after") : undefined}
            />
          ) : (
            <ImageSlot
              src={null}
              onChange={(u) => onChange({ after: u })}
              onRemove={() => {}}
              label="Add AFTER photo"
              aspect="h-full"
              onPickLibrary={onPickLibrary ? () => onPickLibrary("after") : undefined}
            />
          )}
          <span className="absolute top-3 right-3 px-3 py-1 rounded-lg bg-foreground/80 text-background text-[1.25rem] font-bold">
            <Editable
              value={item.afterLabel}
              onChange={(v) => onChange({ afterLabel: v })}
              className="text-background"
            />
          </span>
        </div>

        {/* Divider handle */}
        <div
          className="absolute top-0 bottom-0 w-1 bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.1)] cursor-col-resize no-print"
          style={{ left: `${item.split}%`, transform: "translateX(-50%)" }}
          onMouseDown={(e) => {
            e.preventDefault();
            dragging.current = true;
          }}
        >
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center text-primary">
            <Move size={16} />
          </div>
        </div>
        {/* Print-safe divider line */}
        <div
          className="hidden print:block absolute top-0 bottom-0 w-[3px] bg-white"
          style={{ left: `${item.split}%`, transform: "translateX(-50%)" }}
        />
      </div>
      <div className="no-print mt-2 flex items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-semibold">
            Ratio {item.split}:{100 - item.split}
          </span>
          <button
            onClick={() => onChange({ split: 50 })}
            className="px-2 py-0.5 rounded-full border border-border hover:bg-muted font-semibold"
          >
            50 : 50
          </button>
        </div>
        <button onClick={onRemove} className="text-destructive hover:opacity-70" aria-label="Remove comparison">
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

// -------- Modal for picking an existing image out of the clinic content library --------
function MediaLibraryModal({
  open,
  items,
  onClose,
  onSelect,
}: {
  open: boolean;
  items: MediaItem[];
  onClose: () => void;
  onSelect: (url: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Choose from content library</DialogTitle>
        </DialogHeader>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No images in the content library yet. Upload photos elsewhere in the plan first.
          </p>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {items.map((m, i) => (
              <button
                key={m.url + i}
                type="button"
                onClick={() => {
                  onSelect(m.url);
                  onClose();
                }}
                className="group relative aspect-square overflow-hidden rounded-xl border border-border hover:border-primary hover:ring-2 hover:ring-primary/40 transition"
                title={m.caption || "Use this image"}
              >
                <img src={m.url} alt={m.alt || m.caption || ""} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors" />
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

const TOOTH_STATUSES = [
  "Missing",
  "Intact",
  "Decayed",
  "Filled",
  "Crown",
  "Bridge",
  "Implant",
  "Root canal treated",
  "To be extracted",
  "Mobile",
  "Impacted",
];

function ToothStatusSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [custom, setCustom] = useState(value !== "" && !TOOTH_STATUSES.includes(value));
  if (custom) {
    return (
      <span className="flex-1 min-w-0 flex items-center gap-1">
        <input
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 min-w-0 bg-transparent outline-none text-sm focus:bg-primary/5 rounded px-1 border-b border-primary/20"
        />
        <button
          onClick={() => {
            setCustom(false);
            onChange("Missing");
          }}
          className="text-primary/50 hover:text-primary text-[11px] font-bold print:hidden"
        >
          list
        </button>
      </span>
    );
  }
  return (
    <select
      value={TOOTH_STATUSES.includes(value) ? value : ""}
      onChange={(e) => {
        if (e.target.value === "__other") {
          setCustom(true);
          onChange("");
        } else onChange(e.target.value);
      }}
      className="flex-1 min-w-0 bg-transparent outline-none text-sm focus:bg-primary/5 rounded px-1 cursor-pointer appearance-none"
    >
      <option value="">—</option>
      {TOOTH_STATUSES.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
      <option value="__other">Other…</option>
    </select>
  );
}

/**
 * Loads the clinic's active default wording once, then renders the plan with it.
 * Falls back to the wording shipped with the app if the content cannot be read.
 */
function PlanPageWithContent() {
  const [content, setContent] = useState<ContentMap | null>(null);
  useEffect(() => {
    let cancelled = false;
    const load = (force = false) => {
      void fetchActiveContent(force ? { force: true } : undefined).then(({ map }) => {
        if (cancelled) return;
        setContent((prev) => (prev && JSON.stringify(prev) === JSON.stringify(map) ? prev : map));
      });
    };
    load();
    // Pick up freshly published clinic content as soon as the tab is used again.
    const onFocus = () => load(true);
    const onVisible = () => {
      if (document.visibilityState === "visible") load(true);
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    // Instant refresh when the owner publishes/restores content in any tab.
    // A short follow-up read covers the brief moment right after a write.
    const timers: ReturnType<typeof setTimeout>[] = [];
    const unsubscribe = onContentInvalidated(() => {
      load(true);
      timers.push(setTimeout(() => load(true), 1200));
      timers.push(setTimeout(() => load(true), 3000));
    });
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
      unsubscribe();
    };
  }, []);

  if (!content) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <span className="sr-only">Loading treatment plan…</span>
      </div>
    );
  }
  return (
    <MediaStyleCtx.Provider value={buildMediaStyles(content)}>
      <PlanPage content={content} />
    </MediaStyleCtx.Provider>
  );
}

function PlanPage({ content }: { content: ContentMap }) {
  const catalog = useCatalog();

  // Owners/admins get an entry point to the content management page.
  const [contentManager, setContentManager] = useState(false);
  useEffect(() => {
    void isContentManager().then(setContentManager);
  }, []);

  /**
   * Hero image and clinic photos are shared clinic branding (the same
   * `clinic_content` row every plan reads from — see the resync effect
   * below), not per-patient data. Editing them here writes straight to that
   * shared row so the change shows up everywhere immediately, exactly like
   * publishing from /content. Only signed-in content managers can do this;
   * everyone else's edits are rejected with a hint to sign in.
   */
  const ensureContentManager = (): boolean => {
    if (!contentManager) {
      window.alert("Đây là ảnh dùng chung cho toàn bộ trang web. Vui lòng đăng nhập Content Management (nút Sign in) để chỉnh sửa.");
      return false;
    }
    return true;
  };
  const commitMediaContent = async (key: "hero_image" | "clinic_photos", media: MediaItem[]): Promise<boolean> => {
    if (!ensureContentManager()) return false;
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      window.alert("Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.");
      return false;
    }
    try {
      await saveContentAsDefault(key, { ...content[key], media }, { id: data.user.id, email: data.user.email ?? null });
      return true;
    } catch {
      window.alert("Lưu thất bại, vui lòng thử lại.");
      return false;
    }
  };

  // ----- End-of-page custom sections -----
  const [priceSheets, setPriceSheets] = useState<string[]>([]);
  const [selectedPriceLists, setSelectedPriceLists] = useState<string[]>([]);
  // Lets the plan builder drop individual pages from a fixed price-list category
  // (e.g. remove 1 of the 4 All-on-4 photos) without touching the shared/admin images.
  // Keyed by price-list id -> the removed page URLs.
  const [removedPriceListPages, setRemovedPriceListPages] = useState<Record<string, string[]>>({});
  const priceListCategoryLabels = content.price_list_categories?.items ?? [];
  /** Maps each fixed price-list category to the content block that can override its page images. */
  const PRICE_LIST_IMAGE_KEYS: Record<string, keyof ContentMap> = {
    overview: "price_list_images_overview",
    single: "price_list_images_single",
    denture: "price_list_images_denture",
    allon4: "price_list_images_allon4",
    allon5: "price_list_images_allon5",
    allon6: "price_list_images_allon6",
  };
  const priceLists = PRICE_LISTS.map((p, i) => {
    const override = priceListCategoryLabels[i];
    const title = override?.title && !isEmptyRich(override.title) ? toPlain(override.title) : p.title;
    const description =
      override?.lines[0] && !isEmptyRich(override.lines[0]) ? toPlain(override.lines[0]) : p.description;
    const imageKey = PRICE_LIST_IMAGE_KEYS[p.id];
    // Only trust an override entry if it actually carries a URL — an override
    // array that exists but holds empty/blank url values (e.g. wiped via the
    // content editor without truly removing the rows) must still fall back to
    // the shipped default pages below, or every image in the category
    // silently renders as a blank <img src="">.
    const imageOverrides = imageKey
      ? visibleMedia(content[imageKey]?.media ?? []).filter((m) => !!m.url)
      : [];
    const pages = imageOverrides.length ? imageOverrides.map((m) => m.url) : p.pages;
    return { ...p, title, description, pages };
  });
  const [priceSheetTitle, setPriceSheetTitle] = useState(content.price_list.title);
  const [priceSheetNote, setPriceSheetNote] = useState(content.price_list.body);
  const [priceSheetDisclaimerHeading, setPriceSheetDisclaimerHeading] = useState(content.package_conditions.title);
  const [priceSheetDisclaimer, setPriceSheetDisclaimer] = useState(content.package_conditions.body);
  const [priceSheetExchangeHeading, setPriceSheetExchangeHeading] = useState(
    content.price_list.items[0]?.title ?? "Exchange rate",
  );
  const [priceSheetExchange, setPriceSheetExchange] = useState(content.price_list.items[0]?.lines[0] ?? "");
  const clinicMedia = visibleMedia(content.clinic_photos.media);
  const [clinicPhotos, setClinicPhotos] = useState<string[]>(
    clinicMedia.length ? clinicMedia.map((m) => m.url) : [clinic1, clinic2, clinic3],
  );
  const [clinicLayout, setClinicLayout] = useState<"row" | "two" | "three" | "collage">(() => {
    const first = clinicMedia[0];
    if (first?.layout === "collage") return "collage";
    if (first?.columns === 2) return "two";
    if (first?.columns && first.columns >= 3) return "three";
    return "row";
  });
  // Clinic photos are shared branding too (content key "clinic_photos") —
  // same deal as the hero image above: edits here publish straight to the
  // shared content row instead of living only in this one plan.
  const commitClinicPhotos = (photos: string[], layout: typeof clinicLayout = clinicLayout): Promise<boolean> =>
    commitMediaContent(
      "clinic_photos",
      photos.map((url) => ({
        url,
        fit: "cover",
        position: "50% 50%",
        layout: layout === "collage" ? "collage" : "grid",
        columns: layout === "two" ? 2 : layout === "three" ? 3 : undefined,
      })),
    );
  const uploadClinicPhotoDataUrl = async (dataUrl: string): Promise<string> => {
    const blob = await fetch(dataUrl).then((r) => r.blob());
    const file = new File([blob], `clinic-photo.${blob.type.split("/")[1] || "jpg"}`, { type: blob.type });
    const item = await uploadClinicMedia(file);
    return item.url;
  };
  const contactLines = content.clinic_contact.items[0]?.lines ?? [];
  const contactLine = (i: number, fallback: string) => contactLines[i] || fallback;
  const [clinicInfo, setClinicInfo] = useState({
    title: content.clinic_introduction.title,
    address: contactLine(
      0,
      "Address: P3-0.SH08, Park 3, Vinhomes Central Park, 720A Dien Bien Phu, Thanh My Tay Ward, Binh Thanh District, Ho Chi Minh City, Vietnam.",
    ),
    phone: contactLine(1, "WhatsApp: (+84) 768738910 / (+84) 77 5138910"),
    email: contactLine(2, "Email: tu.nc@drcareimplant.com"),
    website: contactLine(3, "Website: https://drcareimplant.com/"),
    hours: contactLine(4, "Working hours: Mon – Sat, 8:00 – 18:00"),
    blurb: content.clinic_introduction.body,
  });
  // All clinic-owned images across every content block, deduped by URL — the "content library"
  // patients' before/after photos can be picked from instead of uploading a new file.
  const mediaLibrary = useMemo(() => {
    const seen = new Set<string>();
    const all: MediaItem[] = [];
    for (const key of Object.keys(content) as (keyof ContentMap)[]) {
      for (const m of content[key].media ?? []) {
        if (!m.url || seen.has(m.url)) continue;
        seen.add(m.url);
        all.push(m);
      }
    }
    return all;
  }, [content]);
  const [libraryPicker, setLibraryPicker] = useState<{ onSelect: (url: string) => void } | null>(null);
  const baMedia = visibleMedia(content.before_after_media.media);
  /** Visible before/after images are paired up, so 4 shown images = 2 comparisons. */
  const comparisonsFromMedia = (media: MediaItem[]): Comparison[] => {
    const pairs: Comparison[] = [];
    for (let i = 0; i < media.length; i += 2) {
      pairs.push({
        before: media[i]?.url ?? baBefore1,
        after: media[i + 1]?.url ?? baAfter1,
        split: 50,
        beforeLabel: media[i]?.caption || "Before",
        afterLabel: media[i + 1]?.caption || "After",
        beforePos: { x: 50, y: 50 },
        beforeZoom: 1,
        afterPos: { x: 50, y: 50 },
        afterZoom: 1,
      });
    }
    return pairs;
  };
  const [comparisons, setComparisons] = useState<Comparison[]>(
    baMedia.length
      ? comparisonsFromMedia(baMedia)
      : [
          {
            before: baBefore1,
            after: baAfter1,
            split: 50,
            beforeLabel: "Before",
            afterLabel: "After",
            beforePos: { x: 50, y: 50 },
            beforeZoom: 1,
            afterPos: { x: 50, y: 50 },
            afterZoom: 1,
          },
        ],
  );

  // ----- Clinic + patient letter -----
  const [clinicName, setClinicName] = useState("Dr. Care Implant Clinic");
  const [heroTitle, setHeroTitle] = useState(content.patient_introduction.title);
  const [greeting, setGreeting] = useState("Dear Jodie,");
  const [letter, setLetter] = useState(content.patient_introduction.body);

  // ----- Patient info -----
  const [patient, setPatient] = useState({
    fullName: "",
    dob: "",
    patientId: "",
    treatingDoctor: "",
    sex: "" as "" | "Male" | "Female",
    othersHistory: "",
    othersAllergy: "",
    notes: "",
  });

  // Medical history checkboxes
  const defaultHistory = [
    "Asthma",
    "Arthritis",
    "Insomnia",
    "Diabetes",
    "Stomach ulcers",
    "Headache",
    "Dizziness",
    "Hernia",
    "Contact lenses",
    "Heart disease",
    "Depression",
    "Blood disorder",
    "High blood pressure",
    "Low blood pressure",
    "Musculoskeletal problems",
    "Chronic headaches",
  ];
  const [historyItems, setHistoryItems] = useState<string[]>(defaultHistory);
  const [historyChecked, setHistoryChecked] = useState<Record<string, boolean>>({});

  // Medication allergy checkboxes
  const defaultAllergies = [
    "Penicillin",
    "Amoxicillin",
    "Aspirin",
    "Ibuprofen",
    "Sulfa drugs",
    "Cephalosporins",
    "Local anesthetics (Lidocaine)",
    "Codeine",
    "NSAIDs",
    "Latex",
    "Iodine / Contrast dye",
    "Erythromycin",
  ];
  const [allergyItems, setAllergyItems] = useState<string[]>(defaultAllergies);
  const [allergyChecked, setAllergyChecked] = useState<Record<string, boolean>>({});

  // Section titles (editable)
  const [formHeading, setFormHeading] = useState(content.patient_information.title);
  const [historyHeading, setHistoryHeading] = useState(
    content.patient_information.items[0]?.title ?? "MEDICAL HISTORY",
  );
  const [allergyHeading, setAllergyHeading] = useState(
    content.patient_information.items[1]?.title ?? "MEDICATION ALLERGY",
  );
  // Overview print visibility: empty sections are skipped when printing/exporting
  const hasPatientFields = !!(
    toPlain(patient.fullName) ||
    toPlain(patient.dob) ||
    toPlain(patient.patientId) ||
    toPlain(patient.treatingDoctor) ||
    patient.sex
  );
  const hasHistory = historyItems.some((it, i) => historyChecked[it + i]) || !!toPlain(patient.othersHistory);
  const hasAllergy = allergyItems.some((it, i) => allergyChecked[it + i]) || !!toPlain(patient.othersAllergy);
  const hasNotes = !!toPlain(patient.notes);
  const hasOverview = hasPatientFields || hasHistory || hasAllergy || hasNotes;
  const [historyOpen, setHistoryOpen] = useState(true);
  const [allergyOpen, setAllergyOpen] = useState(true);

  // ----- Copy-to-clipboard feedback for "send to patient" buttons -----
  const [notesCopied, setNotesCopied] = useState(false);
  const [offersCopied, setOffersCopied] = useState(false);
  const copyToClipboard = async (text: string, setCopied: (v: boolean) => void) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.alert("Copy failed, please try again.");
    }
  };

  // ----- Special offers -----
  const [offersOpen, setOffersOpen] = useState(true);
  const [offersHeading, setOffersHeading] = useState(content.patient_benefits.title);
  const [offerService, setOfferService] = useState("All-on-4 implant");
  const [offerServiceCustom, setOfferServiceCustom] = useState(false);
  const [offerIntro, setOfferIntro] = useState(content.patient_benefits.body);

  const [offers, setOffers] = useState<{ id: string; title: string; lines: string[] }[]>(
    content.patient_benefits.items.map((it, i) => ({ id: `o${i + 1}`, ...it })),
  );

  // "+ Add item" and "Apply offer case" always reflect what's currently
  // published in Content, not a separately-maintained hardcoded copy.
  const offerLibrary = useMemo(() => buildOfferLibrary(content), [content]);
  const offerPresetsLive = useMemo(() => buildOfferPresets(offerLibrary), [offerLibrary]);
  const offerCasesLive = useMemo(() => buildOfferCases(offerLibrary), [offerLibrary]);

  // ----- Diagnosis / current situation -----
  const [dxKicker, setDxKicker] = useState("Your current situation");
  const [dxHeading, setDxHeading] = useState(content.diagnosis_introduction.title);
  const [dxSummaryTitle, setDxSummaryTitle] = useState("Summary");
  const [dxSummary, setDxSummary] = useState(content.diagnosis_introduction.body);

  // ----- Treatment plan heading / intro (rich text, format managed in /content) -----
  const [treatmentPlanHeading, setTreatmentPlanHeading] = useState(content.treatment_plan_introduction.title);
  const [treatmentPlanIntro, setTreatmentPlanIntro] = useState(content.treatment_plan_introduction.body);
  const [dxOpen, setDxOpen] = useState({ summary: true, chart: true });
  const [chartTitle, setChartTitle] = useState("Tooth chart & tooth conditions");
  const [toothNotes, setToothNotes] = useState<{ n: string; s: string; t?: string; note?: string }[]>([
    { n: "16", s: "Missing", t: "" },
    { n: "36", s: "Decayed", t: "" },
  ]);

  // ----- Editable images -----
  const heroMedia = visibleMedia(content.hero_image.media)[0];
  const [heroImg, setHeroImg] = useState<string>(heroMedia?.url ?? heroTeam);
  const heroMediaStyle = useMediaStyle(heroImg);
  const parsePos = (p?: string) => {
    const [x, y] = (p ?? "50% 50%").split(" ").map((v) => Number(v.replace("%", "")) || 50);
    return { x: x ?? 50, y: y ?? 50 };
  };
  const [heroPos, setHeroPos] = useState<{ x: number; y: number }>(parsePos(heroMedia?.position));
  const [heroZoom, setHeroZoom] = useState<number>(Math.max(heroMedia?.zoom ?? 1, 1));
  const [heroHeight, setHeroHeight] = useState<number>(520);
  // Keep the hero exactly as framed in /content (fit, position, zoom).
  const heroSig = `${heroMedia?.url ?? ""}|${heroMedia?.position ?? ""}|${heroMedia?.zoom ?? 1}`;
  useEffect(() => {
    if (!heroMedia?.url) return;
    setHeroImg(heroMedia.url);
    setHeroPos(parsePos(heroMedia.position));
    setHeroZoom(Math.max(heroMedia.zoom ?? 1, 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heroSig]);

  const heroBoxRef = useRef<HTMLDivElement>(null);
  const heroDrag = useRef<{ startX: number; startY: number; posX: number; posY: number } | null>(null);
  const onHeroMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("[data-no-drag]")) return;
    if (!contentManager) return; // hero framing is shared content — only a content manager can reposition it
    heroDrag.current = { startX: e.clientX, startY: e.clientY, posX: heroPos.x, posY: heroPos.y };
    let moved = false;
    let last = { x: heroPos.x, y: heroPos.y };
    const move = (ev: MouseEvent) => {
      if (!heroDrag.current || !heroBoxRef.current) return;
      const rect = heroBoxRef.current.getBoundingClientRect();
      const dx = ((ev.clientX - heroDrag.current.startX) / rect.width) * 100;
      const dy = ((ev.clientY - heroDrag.current.startY) / rect.height) * 100;
      const nx = Math.max(0, Math.min(100, heroDrag.current.posX - dx));
      const ny = Math.max(0, Math.min(100, heroDrag.current.posY - dy));
      moved = true;
      last = { x: nx, y: ny };
      setHeroPos(last);
    };
    const up = () => {
      heroDrag.current = null;
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      if (moved) {
        const current = visibleMedia(content.hero_image.media)[0];
        void commitMediaContent("hero_image", [
          { ...current, url: heroImg, fit: current?.fit ?? "cover", position: `${last.x}% ${last.y}%`, zoom: heroZoom },
        ]);
      }
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };
  const [patientImg, setPatientImg] = useState<string>(drCareLogo);
  const [featureImg, setFeatureImg] = useState<string>(implantIllustration);
  const [logoImg, setLogoImg] = useState<string>(drCareLogo);
  const [gallery, setGallery] = useState<string[]>([]);
  const addGallery = (url: string) => setGallery((g) => [...g, url]);
  const removeGallery = (i: number) => setGallery((g) => g.filter((_, idx) => idx !== i));
  const updateGallery = (i: number, url: string) => setGallery((g) => g.map((v, idx) => (idx === i ? url : v)));

  /**
   * Clinic defaults published from /content are applied to the live page as soon
   * as they change, so an owner sees exactly what they saved without a reload.
   * Patient-specific data is never touched.
   */
  const contentKeyRef = useRef(JSON.stringify(content));
  useEffect(() => {
    const key = JSON.stringify(content);
    if (key === contentKeyRef.current) return;
    contentKeyRef.current = key;

    setHeroTitle(content.patient_introduction.title);
    setLetter(content.patient_introduction.body);
    setFormHeading(content.patient_information.title);
    setHistoryHeading(content.patient_information.items[0]?.title ?? "MEDICAL HISTORY");
    setAllergyHeading(content.patient_information.items[1]?.title ?? "MEDICATION ALLERGY");
    setOffersHeading(content.patient_benefits.title);
    setOfferIntro(content.patient_benefits.body);
    setOffers(content.patient_benefits.items.map((it, i) => ({ id: `o${i + 1}`, ...it })));
    setDxHeading(content.diagnosis_introduction.title);
    setDxSummary(content.diagnosis_introduction.body);
    setTreatmentPlanHeading(content.treatment_plan_introduction.title);
    setTreatmentPlanIntro(content.treatment_plan_introduction.body);
    setPriceSheetTitle(content.price_list.title);
    setPriceSheetNote(content.price_list.body);
    setPriceSheetDisclaimerHeading(content.package_conditions.title);
    setPriceSheetDisclaimer(content.package_conditions.body);
    setPriceSheetExchangeHeading(content.price_list.items[0]?.title ?? "Exchange rate");
    setPriceSheetExchange(content.price_list.items[0]?.lines[0] ?? "");

    const lines = content.clinic_contact.items[0]?.lines ?? [];
    setClinicInfo((prev) => ({
      ...prev,
      title: content.clinic_introduction.title,
      blurb: content.clinic_introduction.body,
      address: lines[0] || prev.address,
      phone: lines[1] || prev.phone,
      email: lines[2] || prev.email,
      website: lines[3] || prev.website,
      hours: lines[4] || prev.hours,
    }));

    const photos = visibleMedia(content.clinic_photos.media);
    if (photos.length) setClinicPhotos(photos.map((m) => m.url));
    const hero = visibleMedia(content.hero_image.media)[0];
    if (hero?.url) setHeroImg(hero.url);
    const portrait = visibleMedia(content.patient_portrait.media)[0];
    if (portrait?.url) setPatientImg(portrait.url);
    const ba = visibleMedia(content.before_after_media.media);
    if (ba.length)
      setComparisons((prev) =>
        comparisonsFromMedia(ba).map((next, i) => ({ ...next, split: prev[i]?.split ?? next.split })),
      );
    const clinicFirst = photos[0];
    if (clinicFirst?.layout === "collage") setClinicLayout("collage");
    else if (clinicFirst?.columns === 2) setClinicLayout("two");
    else if (clinicFirst?.columns && clinicFirst.columns >= 3) setClinicLayout("three");
  }, [content]);

  // ----- Treatment plan table: resizable "Service" / "Teeth" columns -----
  // Both columns default to a width that works for most plans, but a long
  // tooth list can still crowd the service name — so these are user-adjustable
  // by dragging the small handle on the right edge of each header. The same
  // widths are used on screen and in every export (PNG/PDF), since export
  // captures this exact DOM node, so resizing here IS the print preview.
  const PLAN_COL_DEFAULTS = { service: 640, teeth: 190 } as const;
  const [planColWidths, setPlanColWidths] = useState<{ service: number; teeth: number }>({
    ...PLAN_COL_DEFAULTS,
  });
  // Once the user drags the Service column themselves, their choice always
  // wins — the auto-widening effect below (added once `phases` exists,
  // further down) stops adjusting it until "Reset columns" is used.
  const serviceColManuallySet = useRef(false);
  const resizingColRef = useRef<{ col: "service" | "teeth"; startX: number; startWidth: number } | null>(null);
  const startPlanColResize = (e: React.MouseEvent, col: "service" | "teeth") => {
    e.preventDefault();
    e.stopPropagation();
    if (col === "service") serviceColManuallySet.current = true;
    resizingColRef.current = { col, startX: e.clientX, startWidth: planColWidths[col] };
    const min = col === "teeth" ? 70 : 160;
    const onMove = (ev: MouseEvent) => {
      const st = resizingColRef.current;
      if (!st) return;
      const next = Math.max(min, Math.round(st.startWidth + (ev.clientX - st.startX)));
      setPlanColWidths((w) => ({ ...w, [st.col]: next }));
    };
    const onUp = () => {
      resizingColRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };
  const resetPlanColWidths = () => {
    serviceColManuallySet.current = false;
    setPlanColWidths({ ...PLAN_COL_DEFAULTS });
  };

  // ----- Amount columns (editable, add/remove) & live FX rates -----
  const [cols, setCols] = useState<Col[]>([
    { id: "vnd", label: "VND", kind: "vnd" },
    { id: "fx1", label: "AUD", kind: "fx", currency: "AUD" },
  ]);
  const { rates, updatedAt: ratesUpdatedAt, loading: ratesLoading, refresh: refreshRates } = useLiveRates();
  // Currencies that can be recognized as a live-FX column: the curated list
  // plus whatever the live rates API actually returned (so any currency code
  // typed in later that the API supports — even ones not in the curated list —
  // still auto-converts and totals correctly).
  const knownCurrencyCodes = Array.from(new Set([...CURRENCY_CODES, ...Object.keys(rates)]));
  const updateCol = (id: string, label: string) =>
    setCols((c) =>
      c.map((col) => {
        if (col.id !== id) return col;
        // Typing a valid currency code turns the column into a live-FX column
        // converted from the VND amount of each row.
        const code = label.trim().toUpperCase();
        const match = knownCurrencyCodes.find((x) => x === code);
        if (match && col.kind !== "vnd") return { ...col, label: match, kind: "fx" as const, currency: match };
        if (col.kind === "fx") return { ...col, label, kind: "custom" as const, currency: undefined };
        return { ...col, label };
      }),
    );
  const setColCurrency = (id: string, currency: string) =>
    setCols((c) => c.map((col) => (col.id === id ? { ...col, currency, label: currency } : col)));

  // ----- Quick currency converter (next to "Add phase") -----
  const [converterOpen, setConverterOpen] = useState(false);
  // Same counter-scale the service-search dropdown and Saved plans popover use,
  // so this panel stays readable instead of shrinking to illegible size when
  // the whole page is zoomed way out to see the full treatment plan at once.
  const converterZoomScale = useZoomCounterScale(converterOpen);
  // VND always listed first regardless of the live-rates API's own key order.
  const converterCurrencyCodes = ["VND", ...knownCurrencyCodes.filter((c) => c !== "VND")];
  const [converterAmount, setConverterAmount] = useState("5000000");
  const [converterFrom, setConverterFrom] = useState("VND");
  const [converterTo, setConverterTo] = useState("USD");
  const converterResult = (() => {
    const amt = parseFloat(converterAmount.replace(/,/g, ""));
    const rFrom = rates[converterFrom] ?? 0;
    const rTo = rates[converterTo] ?? 0;
    if (!Number.isFinite(amt) || !rFrom || !rTo) return null;
    // rates[CODE] = units of CODE per 1 VND, so amount -> VND -> target.
    return (amt / rFrom) * rTo;
  })();
  const swapConverterCurrencies = () => {
    setConverterFrom(converterTo);
    setConverterTo(converterFrom);
  };

  const addCol = () => setCols((c) => [...c, { id: uid(), label: "New column", kind: "custom" }]);
  const removeCol = (id: string) => setCols((c) => c.filter((col) => col.id !== id));
  const moveCol = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    setCols((c) => {
      const from = c.findIndex((x) => x.id === fromId);
      const to = c.findIndex((x) => x.id === toId);
      if (from < 0 || to < 0) return c;
      const next = [...c];
      const [m] = next.splice(from, 1);
      next.splice(to, 0, m);
      return next;
    });
  };
  const [dragCol, setDragCol] = useState<string | null>(null);
  const [dragRow, setDragRow] = useState<{ phaseId: string; rowId: string } | null>(null);
  const [dragOffer, setDragOffer] = useState<string | null>(null);

  // Helpers for computing per-row amounts
  const netUnitVnd = (r: Row) => (r.unitVnd === null ? 0 : Math.max(0, r.unitVnd - (Number(r.discount) || 0)));
  const computeVnd = (r: Row) =>
    isRemovablePartialDenture(toPlain(r.name)) ? rpdTotalVnd(r.qty, r.discount) : netUnitVnd(r) * (Number(r.qty) || 0);
  const rowVnd = (r: Row) => {
    if (r.vnd && r.vnd.trim() !== "") return Number(r.vnd.replace(/[^\d.]/g, "")) || 0;
    return computeVnd(r);
  };
  const rowFx = (r: Row, col: Col) => {
    const override = r.fx?.[col.id];
    if (override && override.trim() !== "") return Number(override.replace(/[^\d.]/g, "")) || 0;
    return rowVnd(r) * (rates[col.currency ?? "AUD"] ?? 0);
  };

  // Look up a catalog price by service name
  const catalogPrice = (name: string): number | null => {
    const hit = catalog.items.find((i) => i.name.trim().toLowerCase() === toPlain(name).toLowerCase());
    return hit ? hit.priceVnd : null;
  };

  // ----- Phases / plan -----
  const [phases, setPhases] = useState<Phase[]>([
    {
      id: uid(),
      title: "Phase 1 — Implant Placement (14 days)",
      note: "Healing Period (3–6 months): The implant is left undisturbed to allow natural bone integration (osseointegration), creating a stable foundation for the final restoration. Healing duration varies according to bone quality, implant stability, and individual healing capacity.",
      rows: [
        { id: uid(), name: "Consultation", tooth: "", qty: 1, unitVnd: null },
        { id: uid(), name: "Conebeam CT (3D) scan", tooth: "", qty: 1, unitVnd: null },
        { id: uid(), name: "Blood Test", tooth: "", qty: 1, unitVnd: null },
      ],
    },
    {
      id: uid(),
      title: "Phase 2 — Prosthetics Restoration (14–21 days)",
      rows: [],
    },
  ]);
  const [openPhases, setOpenPhases] = useState<Record<string, boolean>>({});
  const isOpen = (id: string) => openPhases[id] ?? true;
  const [customTimelinePhases, setCustomTimelinePhases] = useState<Record<string, boolean>>({});

  // Auto-widen the Service column for plans that have long service names
  // (e.g. "Root Canal Treatment for 2 Pulps (Provisional)") — by default,
  // with no manual resizing needed, and without shrinking any other column
  // to make room. Grows the shared Service width based on the single
  // longest service name across every phase (they all share one column
  // width), floored at the normal default so short-name plans are
  // unaffected. Stops adjusting once the user drags the column themselves
  // (see serviceColManuallySet above) — their choice always wins from then
  // on, until "Reset columns".
  useEffect(() => {
    if (serviceColManuallySet.current) return;
    const longest = Math.max(0, ...phases.flatMap((ph) => ph.rows.map((r) => toPlain(r.name).length)));
    // Wide enough that even the longest real-world service name (e.g. "Root
    // Canal Treatment for 3 Pulps (Provisional)", ~47 chars) fits on ONE
    // line — no wrapping, ever, per request. The previous 14px/char + 1100px
    // cap under-shot long combined names (they still wrapped 3-4 lines), so
    // this uses a more generous per-char estimate and a much higher cap;
    // PLAN_MAX_WIDTH_CAP below is raised to match so the section actually
    // has room to grow this wide instead of the extra width being clamped
    // away.
    const auto = Math.min(2200, PLAN_COL_DEFAULTS.service + Math.max(0, longest - 20) * 22);
    setPlanColWidths((w) => (w.service === auto ? w : { ...w, service: auto }));
  }, [phases]);

  // ----- Treatment Plan section width: grows with the number of amount
  // columns AND with how long the plan itself is -----
  // The Treatment Plan image/PDF export captures this ONE section in full
  // (title, phase headers, cards, table together) — so if the table needs
  // more room, the WHOLE section should widen with it, instead of only the
  // table poking out wider than everything else around it.
  // Two columns (VND + one more) and up to ~10 rows is the default,
  // unchanged width (site's max-w-[2000px], 2000px). Each additional amount
  // column reserves the same width the currency columns already use on
  // screen. Beyond ~10 rows total, the section also widens a little per
  // extra row — long plans wrap long service names onto 2-3 lines at the
  // default width, which makes the exported image look like a tall, narrow
  // strip; a bit more width keeps rows shorter and the page better
  // proportioned. Capped so it never grows unreasonably wide.
  const AMOUNT_COL_WIDTH = 170; // widened to fit the larger table type
  // Widened on request: the Full web/PDF export used to leave a lot of grey
  // dead space around the page in a viewer wider than the export itself —
  // raising this baseline/cap makes every section (via --pdf-content-width,
  // see the effect below) render wider during that export, so the page
  // fills closer to the viewer's own width instead of floating in the middle
  // of it.
  const PLAN_BASE_MAX_WIDTH = 2800; // wider baseline than the site's max-w-[2000px] container
  // Raised alongside the Service column's own cap (see the auto-widen effect
  // above) — a long-named plan can now legitimately need Service width well
  // past 1500px on top of the base width, and this cap must not claw that
  // back down (which would squeeze Service again, defeating the "never
  // wrap" fix) once the section's ideal width exceeds it.
  const PLAN_MAX_WIDTH_CAP = 5600;
  const PLAN_ROW_THRESHOLD = 6; // rows before the section starts widening further for breathing room
  const PLAN_ROW_WIDTH = 30; // extra px per row beyond the threshold
  const planExtraCols = Math.max(0, cols.length - 2);
  const planRowCount = phases.reduce((n, ph) => n + ph.rows.length, 0);
  const planLengthExtra = Math.max(0, planRowCount - PLAN_ROW_THRESHOLD) * PLAN_ROW_WIDTH;
  // How much the Service column has grown past its own default (either the
  // auto-widen-for-long-names effect above, or the user's own manual drag) —
  // added here so the section itself widens right along with it, instead of
  // the table just overflowing into a horizontal scrollbar inside an
  // unchanged-width section.
  const planServiceExtra = Math.max(0, planColWidths.service - PLAN_COL_DEFAULTS.service);
  const planMaxWidth = Math.min(
    PLAN_MAX_WIDTH_CAP,
    PLAN_BASE_MAX_WIDTH + planExtraCols * AMOUNT_COL_WIDTH + planLengthExtra + planServiceExtra,
  );

  // Keep the Full PDF export's "match the Treatment Plan's width" CSS (see
  // .max-w-\[2000px\] override under body.fullpdf-export in styles.css) in
  // sync with the plan's actual current width. Harmless on screen and during
  // the PNG export — these variables are only ever read from rules scoped to
  // body.fullpdf-export. --pdf-scale also scales up the root font-size
  // during that export, so text/icons/spacing grow along with the wider
  // sections instead of looking thin and stretched inside them. Restored on
  // request after being reverted for causing occasional Full PDF capture
  // issues — see the comment in styles.css for the history.
  //
  // The Treatment Plan's own Service/Teeth columns (now also auto-widened
  // to fit the longest service name — see the effect above) and the
  // currency columns' width are set as literal pixel widths, not rem — so
  // scaling the root font-size (above) makes their TEXT grow without the
  // columns themselves growing to match, squeezing them tighter than
  // before. Publishing their current widths here too lets the matching CSS
  // rules scale the columns by the same ratio as the text, so they stay in
  // proportion instead of getting cramped.
  useEffect(() => {
    document.documentElement.style.setProperty("--pdf-content-width", `${planMaxWidth}px`);
    document.documentElement.style.setProperty("--pdf-scale", String(planMaxWidth / 2000));
    document.documentElement.style.setProperty("--plan-col-service", `${planColWidths.service}px`);
    document.documentElement.style.setProperty("--plan-col-teeth", `${planColWidths.teeth}px`);
    document.documentElement.style.setProperty("--plan-col-amount", `${AMOUNT_COL_WIDTH}px`);
  }, [planMaxWidth, planColWidths.service, planColWidths.teeth]);

  /**
   * Rule-linked rows (Diagnosis picks, and the automatic follow-up procedures
   * such as Sedation Care / Temporary Denture / Zirconia Cast Frame) are kept
   * in sync automatically. But the user must always be able to delete or edit
   * them — once dismissed, a linked row stays gone even while its rule is
   * still active. The dismissal itself only resets once the rule's underlying
   * condition goes away and later becomes true again (a fresh occurrence).
   */
  const [dismissedAuto, setDismissedAuto] = useState<Set<string>>(new Set());
  const dismissAuto = (key: string) =>
    setDismissedAuto((s) => (s.has(key) ? s : new Set(s).add(key)));
  const undismissAutoIf = (keys: string[], keep: (key: string) => boolean) =>
    setDismissedAuto((s) => {
      let next: Set<string> | null = null;
      for (const k of keys) {
        if (s.has(k) && !keep(k)) {
          if (!next) next = new Set(s);
          next.delete(k);
        }
      }
      return next ?? s;
    });
  /** Stable identity for a rule's auto-generated row, keyed by its service name. */
  const autoRuleKeyForName = (name: string): string | null => {
    const n = toPlain(name).trim().toLowerCase();
    // Any brand's matching Abutment row (see abutmentForImplant) shares the
    // same stable key, so dismissing/deleting it is remembered regardless of
    // which implant brand it followed.
    if (IMPLANT_ABUTMENT_NAMES.some((a) => a.toLowerCase() === n)) return "auto:abutment";
    if (n === "zirconia sagemax crown on implant") return "auto:crown";
    if (n === "temporary fixed denture on implant") return "auto:temp-denture";
    if (n === "sedation care") return "auto:sedation";
    const z = n.match(/^zirconia teeth on cast frame for all-on-([46]) implant$/);
    if (z) return `auto:zirconia-${z[1]}`;
    return null;
  };
  /** Stable identity for a rule-linked row, used to remember an explicit delete. */
  const autoDismissKeyFor = (r: Row): string | null => {
    if (r.dx && r.dxKey) return `dx:${r.dxKey}`;
    if (!r.auto) return null;
    return autoRuleKeyForName(r.name);
  };

  // Tooth Extraction / Tooth Extraction (Provisional) are always complimentary
  // (VND 1,000,000 off/unit) whenever the plan includes any implant service
  // (single implant or All-on-4/6), and revert to no discount otherwise.
  // Toggles only between those two auto states, so a discount the team has
  // manually set to something else is left alone.
  const planHasImplant = useMemo(
    () => phases.some((ph) => ph.rows.some((r) => isImplantServiceRow(toPlain(r.name)))),
    [phases],
  );
  useEffect(() => {
    setPhases((p) => {
      let changed = false;
      const next = p.map((ph) => {
        let rowsChanged = false;
        const rows = ph.rows.map((r) => {
          if (!isToothExtractionRow(toPlain(r.name))) return r;
          const current = r.discount ?? 0;
          const want = planHasImplant ? EXTRACTION_DISCOUNT_VND : 0;
          if (current !== want && current !== 0 && current !== EXTRACTION_DISCOUNT_VND) return r;
          if (current === want) return r;
          rowsChanged = true;
          return { ...r, discount: want };
        });
        if (!rowsChanged) return ph;
        changed = true;
        return { ...ph, rows };
      });
      return changed ? next : p;
    });
  }, [planHasImplant]);

  const updatePhase = (id: string, patch: Partial<Phase>) =>
    setPhases((p) => p.map((ph) => (ph.id === id ? { ...ph, ...patch } : ph)));

  const updateRow = (phaseId: string, rowId: string, patch: Partial<Row>) =>
    setPhases((p) =>
      p.map((ph) =>
        ph.id === phaseId
          ? {
              ...ph,
              rows: ph.rows.map((r) => {
                if (r.id !== rowId) return r;
                const next = { ...r, ...patch };
                // Only recompute the auto discount when a field that actually
                // drives it (name/qty) changed, and never clobber a manually
                // entered discount on a row that doesn't qualify for the
                // automatic rule (unrelated edits — price, tooth, fx, etc. —
                // used to silently reset/override the discount every time).
                if (!("discount" in patch) && ("name" in patch || "qty" in patch)) {
                  next.discount = qualifiesForTempDentureDiscount(next.name)
                    ? autoDiscountVnd(next.name, next.qty)
                    : (r.discount ?? 0);
                }
                return next;
              }),
            }
          : ph,
      ),
    );

  /** Insert the follow-up procedures required by the selected service. */
  const applyAutoRows = (phaseId: string, name: string, tooth: string) => {
    const auto = autoRowsFor(name, tooth);
    setPhases((p) => {
      const idx = p.findIndex((ph) => ph.id === phaseId);
      if (idx < 0) return p;
      const next = p.map((ph) => ({ ...ph, rows: [...ph.rows] }));
      for (const a of auto) {
        const target = idx + a.phaseOffset;
        if (!next[target]) {
          next.push({
            id: uid(),
            title: `Phase ${next.length + 1} — Prosthetics Restoration`,
            rows: [],
          });
        }
        const phase = next[target];
        const existing = phase.rows.find((r) => toPlain(r.name).toLowerCase() === a.name.trim().toLowerCase());
        if (existing) {
          // Don't create a duplicate row — extend the tooth list and the quantity,
          // unless the user has already typed their own tooth/qty on this row.
          const tooth = existing.toothManual ? existing.tooth : mergeTeeth(existing.tooth, a.tooth);
          const qty = existing.qtyManual
            ? existing.qty
            : Math.max(1, countTeeth(existing.toothManual ? existing.tooth : tooth));
          if (tooth !== existing.tooth || qty !== existing.qty || !existing.auto) {
            const i = phase.rows.indexOf(existing);
            phase.rows[i] = {
              ...existing,
              tooth,
              qty,
              discount: qualifiesForTempDentureDiscount(existing.name)
                ? autoDiscountVnd(existing.name, qty)
                : (existing.discount ?? 0),
              auto: true,
            };
          }
          continue;
        }
        // Explicitly (re-)selecting this treatment is a fresh ask for its follow-ups,
        // so it overrides any earlier delete of that same auto row.
        const ruleKey = autoRuleKeyForName(a.name);
        if (ruleKey) {
          setDismissedAuto((s) => {
            if (!s.has(ruleKey)) return s;
            const n = new Set(s);
            n.delete(ruleKey);
            return n;
          });
        }
        const qty = Math.max(1, countTeeth(a.tooth));
        phase.rows.push({
          id: uid(),
          name: a.name,
          tooth: a.tooth,
          qty,
          unitVnd: a.inPackage || isInPackageService(a.name) ? null : (catalogPrice(a.name) ?? 0),
          discount: autoDiscountVnd(a.name, qty),
          auto: true,
        });
      }

      // Sedation Care auto-row only stays while an All-on-4/6 or 4+ implant row
      // exists. A manually added Sedation Care row (auto !== true) is left alone
      // either way, so the team can add it freely regardless of implant count.
      const sedationNeeded = next.some((ph) => ph.rows.some((r) => qualifiesForSedation(r.name, r.tooth)));
      if (!sedationNeeded) {
        for (const ph of next) {
          ph.rows = ph.rows.filter((r) => !(r.auto && toPlain(r.name).toLowerCase() === "sedation care"));
        }
      }
      return next;
    });
  };

  /**
   * Link the Diagnosis tooth chart with Phase 1 of the treatment plan:
   * every treatment picked for a tooth becomes / updates a Phase 1 row,
   * with the tooth list and quantity following the chart automatically.
   */
  const dxLinkKey = toothNotes.map((t) => `${t.n}|${t.t ?? ""}`).join(";");
  useEffect(() => {
    // treatment name -> teeth
    const map = new Map<string, string[]>();
    for (const t of toothNotes) {
      const teeth = parseTokens(t.n).flatMap(expandToken);
      if (teeth.length === 0) continue;
      for (const name of parseList(t.t)) {
        const picked = name.trim();
        if (!picked) continue;
        // "Implant" / "All-on-4 Implant" / "All-on-6 Implant" resolve to the
        // clinic's default catalog brand (Osstem / Neodent) before becoming a row.
        const raw = resolveDiagnosisTreatmentName(picked);
        // Root canal splits per tooth type: molars 3 pulps, premolars 2, front teeth 1
        const groups = new Map<string, string[]>();
        if (isRootCanalBase(raw)) {
          for (const x of teeth) {
            const pulps = pulpsForTooth(x);
            const key = pulps ? rootCanalVariant(raw, pulps) : raw;
            groups.set(key, [...(groups.get(key) ?? []), x]);
          }
        } else {
          groups.set(raw, teeth);
        }
        for (const [key, list] of groups) {
          const prev = map.get(key) ?? [];
          for (const x of list) if (!prev.includes(x)) prev.push(x);
          map.set(key, prev);
        }
      }
    }

    // A dx dismissal only makes sense while its pick is still on the chart;
    // once removed, clear it so picking the same treatment again later re-links normally.
    undismissAutoIf(
      Array.from(dismissedAuto).filter((k) => k.startsWith("dx:")),
      (k) => map.has(k.slice(3)),
    );

    setPhases((p) => {
      if (p.length === 0) return p;
      const next = p.map((ph) => ({ ...ph, rows: [...ph.rows] }));
      const first = next[0];
      let changed = false;

      // Drop linked rows whose treatment was removed from the diagnosis.
      // Matched by dxKey (the diagnosis pick's identity), NOT by the row's
      // current name — so a row the user has renamed to a different service
      // stays linked (tooth/qty keep following the chart) instead of being
      // deleted and replaced by a fresh default-named row.
      const keep = first.rows.filter((r) => !r.dx || map.has(r.dxKey ?? ""));
      if (keep.length !== first.rows.length) {
        first.rows = keep;
        changed = true;
      }

      for (const [key, teeth] of map) {
        const chartTooth = teeth.join(", ");
        const chartQty = Math.max(1, countTeeth(chartTooth));
        const i = first.rows.findIndex((r) => r.dx && r.dxKey === key);
        if (i >= 0) {
          const r = first.rows[i];
          // The rule is a convenience default: once the user has typed their
          // own tooth numbers / quantity on this row, leave that field alone
          // and only keep following the chart for whichever field they
          // haven't touched.
          const tooth = r.toothManual ? r.tooth : chartTooth;
          const qty = r.qtyManual ? r.qty : r.toothManual ? Math.max(1, countTeeth(tooth)) : chartQty;
          if (r.tooth === tooth && r.qty === qty) continue;
          // Discount follows the row's current (possibly user-edited) service name.
          first.rows[i] = {
            ...r,
            tooth,
            discount: qualifiesForTempDentureDiscount(r.name)
              ? autoDiscountVnd(r.name, r.qty)
              : (r.discount ?? 0),
          };
          changed = true;
        } else if (!dismissedAuto.has(`dx:${key}`)) {
          const tooth = chartTooth;
          const qty = chartQty;
          first.rows.push({
            id: uid(),
            name: key,
            tooth,
            qty,
            unitVnd: isInPackageService(key) ? null : (catalogPrice(key) ?? 0),
            discount: autoDiscountVnd(key, qty),

            dx: true,
            dxKey: key,
          });
          changed = true;
        }
      }

      return changed ? next : p;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dxLinkKey]);

  /**
   * Keep the plan consistent:
   * - Phase 2 abutment / implant-crown tooth lists follow Phase 1, while quantities remain editable.
   * - Sedation Care exists only when needed and sits right before the implant procedure.
   */
  const isSingleImplantName = (n: string) =>
    /implant/i.test(n) && !/abutment|removal|crown|denture|temporary|additional fee|all[-\s]?on/i.test(n);
  const isImplantProcedure = (n: string) =>
    /all[-\s]?on[-\s]?[46]/i.test(n) ? /(implant|system)/i.test(n) : isSingleImplantName(n);

  const planSyncKey = phases.map((ph) => ph.rows.map((r) => `${toPlain(r.name)}|${r.tooth}`).join(";")).join("||");
  useEffect(() => {
    // Clear dismissals whose rule condition is no longer true, so a later,
    // fresh occurrence of the same rule (e.g. picking All-on-4 again after
    // removing it) links down to Phase 2 normally instead of staying hidden.
    {
      const first0 = phases[0];
      let allOnTeeth0 = "";
      const allOnByCount0: Record<string, string> = {};
      if (first0) {
        for (const r of first0.rows) {
          const rn = toPlain(r.name);
          if (isAllOnImplantSystemRow(rn)) {
            allOnTeeth0 = mergeTeeth(allOnTeeth0, r.tooth);
            const k = allOnCount(rn);
            allOnByCount0[k] = mergeTeeth(allOnByCount0[k] || "", r.tooth);
          }
        }
      }
      const sedationNeeded0 = phases.some((ph) => ph.rows.some((r) => qualifiesForSedation(toPlain(r.name), r.tooth)));
      undismissAutoIf(["auto:temp-denture", "auto:zirconia-4", "auto:zirconia-6", "auto:sedation"], (k) => {
        if (k === "auto:temp-denture") return countTeeth(allOnTeeth0) > 0;
        if (k === "auto:zirconia-4") return countTeeth(allOnByCount0["4"] || "") > 0;
        if (k === "auto:zirconia-6") return countTeeth(allOnByCount0["6"] || "") > 0;
        if (k === "auto:sedation") return sedationNeeded0;
        return true;
      });
    }
    setPhases((p) => {
      if (p.length === 0) return p;
      const next = p.map((ph) => ({ ...ph, rows: [...ph.rows] }));
      let changed = false;
      const first = next[0];
      const second = next[1];

      // --- implant teeth from Phase 1 (single implants only) ---
      let implantTeeth = "";
      for (const r of first.rows) {
        if (isSingleImplantName(toPlain(r.name))) implantTeeth = mergeTeeth(implantTeeth, r.tooth);
      }
      const implantQty = countTeeth(implantTeeth);

      if (second) {
        // Abutment brand now follows the implant that was picked (see
        // abutmentForImplant), so every brand's Abutment name has to be
        // recognised here, not just Osstem's.
        for (const name of [...IMPLANT_ABUTMENT_NAMES, "Zirconia Sagemax Crown on Implant"]) {
          const i = second.rows.findIndex((r) => r.auto && toPlain(r.name).trim().toLowerCase() === name.toLowerCase());
          if (implantQty > 0) {
            if (i >= 0) {
              const r = second.rows[i];
              const tooth = r.toothManual ? r.tooth : implantTeeth;
              const qty = r.qtyManual ? r.qty : r.toothManual ? Math.max(1, countTeeth(tooth)) : implantQty;
              if (r.tooth !== tooth || r.qty !== qty) {
                second.rows[i] = { ...r, tooth, qty };
                changed = true;
              }
            }
          } else if (i >= 0) {
            second.rows.splice(i, 1);
            changed = true;
          }
        }
      }

      // --- All-on-4/6: Temporary Fixed Denture (Phase 1) + Zirconia Cast-Frame Teeth (Phase 2) ---
      // Kept in sync no matter how the All-on-4/6 system row got onto the plan
      // (typed directly into Treatment Plan, or linked from the Diagnosis tooth chart).
      {
        let allOnTeeth = "";
        const allOnByCount: Record<string, string> = {};
        for (const r of first.rows) {
          const rn = toPlain(r.name);
          if (isAllOnImplantSystemRow(rn)) {
            allOnTeeth = mergeTeeth(allOnTeeth, r.tooth);
            const k = allOnCount(rn);
            allOnByCount[k] = mergeTeeth(allOnByCount[k] || "", r.tooth);
          }
        }

        // Temporary Fixed Denture on Implant — single merged row in Phase 1.
        const tempName = "Temporary Fixed Denture on Implant";
        const tempQty = countTeeth(allOnTeeth);
        const tempIdx = first.rows.findIndex(
          (r) => r.auto && toPlain(r.name).trim().toLowerCase() === tempName.toLowerCase(),
        );
        if (tempQty > 0) {
          if (tempIdx >= 0) {
            const r = first.rows[tempIdx];
            const tooth = r.toothManual ? r.tooth : allOnTeeth;
            const qty = r.qtyManual ? r.qty : r.toothManual ? Math.max(1, countTeeth(tooth)) : tempQty;
            if (r.tooth !== tooth || r.qty !== qty) {
              first.rows[tempIdx] = {
                ...r,
                tooth,
                qty,
                discount: autoDiscountVnd(r.name, qty),
              };
              changed = true;
            }
          } else if (!dismissedAuto.has("auto:temp-denture")) {
            const at = first.rows.findIndex((r) => isAllOnImplantSystemRow(toPlain(r.name)));
            const insertAt = at < 0 ? first.rows.length : at + 1;
            first.rows.splice(insertAt, 0, {
              id: uid(),
              name: tempName,
              tooth: allOnTeeth,
              qty: tempQty,
              unitVnd: catalogPrice(tempName) ?? 0,
              discount: autoDiscountVnd(tempName, tempQty),
              auto: true,
            });
            changed = true;
          }
        } else if (tempIdx >= 0) {
          first.rows.splice(tempIdx, 1);
          changed = true;
        }

        // Zirconia Teeth on Cast Frame for All-on-4/6 Implant — Phase 2, one row per arch size.
        for (const k of ["4", "6"]) {
          const tooth = allOnByCount[k] || "";
          const qty = countTeeth(tooth);
          const rowName = `Zirconia Teeth on Cast Frame for All-on-${k} Implant`;
          let target = next[1];
          if (!target && qty > 0) {
            target = { id: uid(), title: `Phase ${next.length + 1} — Prosthetics Restoration`, rows: [] };
            next.push(target);
          }
          if (!target) continue;
          const i = target.rows.findIndex(
            (r) => r.auto && toPlain(r.name).trim().toLowerCase() === rowName.toLowerCase(),
          );
          if (qty > 0) {
            if (i >= 0) {
              const r = target.rows[i];
              const rowTooth = r.toothManual ? r.tooth : tooth;
              const rowQty = r.qtyManual ? r.qty : r.toothManual ? Math.max(1, countTeeth(rowTooth)) : qty;
              if (r.tooth !== rowTooth || r.qty !== rowQty) {
                target.rows[i] = { ...r, tooth: rowTooth, qty: rowQty };
                changed = true;
              }
            } else if (!dismissedAuto.has(`auto:zirconia-${k}`)) {
              target.rows.push({
                id: uid(),
                name: rowName,
                tooth,
                qty,
                unitVnd: catalogPrice(rowName) ?? 0,
                auto: true,
              });
              changed = true;
            }
          } else if (i >= 0) {
            target.rows.splice(i, 1);
            changed = true;
          }
        }
      }

      // --- Sedation Care ---
      // Auto-added/removed based on whether the plan qualifies, but once present its
      // position is left alone so the user can freely drag/reorder it like any other row.
      // A manually added Sedation Care row (auto !== true) is never touched by this rule,
      // so the team can add it freely no matter how many implants/units are on the plan.
      const sedationNeeded = next.some((ph) => ph.rows.some((r) => qualifiesForSedation(toPlain(r.name), r.tooth)));
      const isSedation = (r: Row) => toPlain(r.name).trim().toLowerCase() === "sedation care";
      const isAutoSedation = (r: Row) => !!r.auto && isSedation(r);
      const hasAnySedationRow = next.some((ph) => ph.rows.some(isSedation));

      let existingPhaseIdx = -1;
      let existingRowIdx = -1;
      for (let pi = 0; pi < next.length; pi++) {
        const ri = next[pi].rows.findIndex(isAutoSedation);
        if (ri >= 0) {
          existingPhaseIdx = pi;
          existingRowIdx = ri;
          break;
        }
      }

      if (!sedationNeeded) {
        // No longer qualifies: remove the auto row only, if one exists.
        if (existingPhaseIdx >= 0) {
          next[existingPhaseIdx].rows = next[existingPhaseIdx].rows.filter((r) => !isAutoSedation(r));
          changed = true;
        }
      } else if (existingPhaseIdx === -1) {
        // Newly qualifies and no auto row exists yet: insert once, right before the implant
        // procedure — unless the user explicitly deleted it while this rule was active, or
        // already has a manually added Sedation Care row on the plan.
        if (!dismissedAuto.has("auto:sedation") && !hasAnySedationRow) {
          const at = first.rows.findIndex((r) => isImplantProcedure(toPlain(r.name)));
          const idx = at < 0 ? first.rows.length : at;
          first.rows.splice(idx, 0, {
            id: uid(),
            name: "Sedation Care",
            tooth: "",
            qty: 1,
            unitVnd: null,
            auto: true,
          });
          changed = true;
        }
      } else if (existingPhaseIdx !== 0) {
        // Exists but stranded outside Phase 1: move it back, but don't reset its position
        // within Phase 1 on every future update.
        const [row] = next[existingPhaseIdx].rows.splice(existingRowIdx, 1);
        const at = first.rows.findIndex((r) => isImplantProcedure(toPlain(r.name)));
        const idx = at < 0 ? first.rows.length : at;
        first.rows.splice(idx, 0, row);
        changed = true;
      }
      // else: already sitting in Phase 1 — leave its position exactly as the user set it.

      return changed ? next : p;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planSyncKey]);

  const addRow = (phaseId: string) =>
    setPhases((p) =>
      p.map((ph) =>
        ph.id === phaseId
          ? {
              ...ph,
              rows: [...ph.rows, { id: uid(), name: "New procedure", tooth: "", qty: 1, unitVnd: 0 }],
            }
          : ph,
      ),
    );

  const removeRow = (phaseId: string, rowId: string) => {
    setPhases((p) => {
      const ph = p.find((x) => x.id === phaseId);
      const row = ph?.rows.find((r) => r.id === rowId);
      const key = row ? autoDismissKeyFor(row) : null;
      if (key) dismissAuto(key);
      return p.map((x) => (x.id === phaseId ? { ...x, rows: x.rows.filter((r) => r.id !== rowId) } : x));
    });
  };

  const moveRow = (phaseId: string, fromId: string, toId: string) => {
    if (fromId === toId) return;
    setPhases((p) =>
      p.map((ph) => {
        if (ph.id !== phaseId) return ph;
        const from = ph.rows.findIndex((r) => r.id === fromId);
        const to = ph.rows.findIndex((r) => r.id === toId);
        if (from < 0 || to < 0) return ph;
        const rows = [...ph.rows];
        const [m] = rows.splice(from, 1);
        rows.splice(to, 0, m);
        return { ...ph, rows };
      }),
    );
  };

  const moveOffer = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    setOffers((p) => {
      const from = p.findIndex((o) => o.id === fromId);
      const to = p.findIndex((o) => o.id === toId);
      if (from < 0 || to < 0) return p;
      const next = [...p];
      const [m] = next.splice(from, 1);
      next.splice(to, 0, m);
      return next;
    });
  };

  const addPhase = () =>
    setPhases((p) => [
      ...p,
      {
        id: uid(),
        title: `Phase ${p.length + 1} — New Phase`,
        rows: [{ id: uid(), name: "New procedure", tooth: "", qty: 1, unitVnd: 0 }],
      },
    ]);

  const removePhase = (id: string) => setPhases((p) => p.filter((ph) => ph.id !== id));

  // Hotel support: manual deductions (VND) subtracted from the grand TOTAL
  // (e.g. the clinic covers part of the patient's hotel for the 2 trips).
  const [hotelSupports, setHotelSupports] = useState<{ id: string; label: string; vnd: number }[]>([]);
  const addHotelSupport = () =>
    setHotelSupports((h) => [...h, { id: uid(), label: "Hotel support", vnd: 0 }]);
  const updateHotelSupport = (id: string, patch: Partial<{ label: string; vnd: number }>) =>
    setHotelSupports((h) => h.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const removeHotelSupport = (id: string) => setHotelSupports((h) => h.filter((x) => x.id !== id));
  const hotelTotalVnd = useMemo(
    () => hotelSupports.reduce((sum, h) => sum + (Number(h.vnd) || 0), 0),
    [hotelSupports],
  );

  const phasesSubtotal = useMemo(() => {
    let vnd = 0;
    for (const ph of phases) for (const r of ph.rows) vnd += rowVnd(r);
    return vnd;
  }, [phases]);
  const grandTotals = useMemo(() => ({ vnd: Math.max(0, phasesSubtotal - hotelTotalVnd) }), [phasesSubtotal, hotelTotalVnd]);
  const grandFx = (col: Col) => grandTotals.vnd * (rates[col.currency ?? "AUD"] ?? 0);

  // ----- Export scope: all phases or a single phase -----
  const [printScope, setPrintScope] = useState<string>("all");
  const inScope = (index: number) => printScope === "all" || printScope === String(index);
  const scopedVnd = useMemo(() => {
    if (printScope === "all") return grandTotals.vnd;
    const ph = phases[Number(printScope)];
    return ph ? ph.rows.reduce((s, r) => s + rowVnd(r), 0) : 0;
  }, [printScope, phases, grandTotals.vnd]);
  const scopedFx = (col: Col) => scopedVnd * (rates[col.currency ?? "AUD"] ?? 0);

  // Patient name comes from the "Dear [Name]," greeting line (fallback: patient record)
  const displayName = useMemo(() => {
    const g = toPlain(greeting || "")
      .replace(/^\s*(dear|hi|hello)\b/i, "")
      .replace(/[,.!]+\s*$/, "")
      .trim();
    return g || toPlain(patient.fullName || "");
  }, [greeting, patient.fullName]);

  // Title line shown only in the PNG export, e.g.
  // "Peter Kelly - Plan Using Implant Osstem (Korea) 10 Years Warranty"
  const pngTitle = useMemo(() => {
    const names = phases.filter((_, pi) => inScope(pi)).flatMap((ph) => ph.rows.map((r) => toPlain(r.name)));
    const hit = findImplantWarranty(names);
    if (!hit) return "";
    const who = displayName || "Patient";
    return `${who} - Plan Using Implant ${hit.brand} ${hit.warranty} Warranty`;
  }, [phases, printScope, displayName]);

  // Trim uniform blank margins around an exported PNG so the image has no dead space.
  // Returns the actual pixel size of the returned image alongside it — callers that
  // place this image at an explicit size (the Full PDF) need the REAL post-crop
  // dimensions, not the pre-crop ones, or they end up stretching the (now smaller)
  // image to fill the old, larger size and overlapping whatever comes after it.
  async function autoCropDataUrl(
    dataUrl: string,
    pad = 12,
  ): Promise<{ dataUrl: string; width: number; height: number }> {
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = reject;
        i.src = dataUrl;
      });
      const c = document.createElement("canvas");
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext("2d");
      if (!ctx) return { dataUrl, width: img.naturalWidth, height: img.naturalHeight };
      ctx.drawImage(img, 0, 0);
      const { data, width, height } = ctx.getImageData(0, 0, c.width, c.height);
      const isBlank = (idx: number) => {
        const r = data[idx],
          g = data[idx + 1],
          b = data[idx + 2],
          a = data[idx + 3];
        return a < 8 || (r > 246 && g > 246 && b > 246);
      };
      let top = 0,
        bottom = height - 1,
        left = 0,
        right = width - 1;
      const rowBlank = (y: number) => {
        for (let x = 0; x < width; x++) if (!isBlank((y * width + x) * 4)) return false;
        return true;
      };
      const colBlank = (x: number) => {
        for (let y = top; y <= bottom; y++) if (!isBlank((y * width + x) * 4)) return false;
        return true;
      };
      while (top < bottom && rowBlank(top)) top++;
      while (bottom > top && rowBlank(bottom)) bottom--;
      while (left < right && colBlank(left)) left++;
      while (right > left && colBlank(right)) right--;
      top = Math.max(0, top - pad);
      left = Math.max(0, left - pad);
      bottom = Math.min(height - 1, bottom + pad);
      right = Math.min(width - 1, right + pad);
      const w = right - left + 1;
      const h = bottom - top + 1;
      if (w < 32 || h < 32 || (w === width && h === height)) {
        return { dataUrl, width, height };
      }
      const out = document.createElement("canvas");
      out.width = w;
      out.height = h;
      const octx = out.getContext("2d");
      if (!octx) return { dataUrl, width, height };
      octx.fillStyle = "#ffffff";
      octx.fillRect(0, 0, w, h);
      octx.drawImage(c, left, top, w, h, 0, 0, w, h);
      // JPEG at high quality: visually lossless for this kind of document but a
      // fraction of the size of the PNG re-encode, which is what actually kept
      // exported files at 6-7MB.
      const result = { dataUrl: out.toDataURL("image/jpeg", 0.92), width: w, height: h };
      // Full-size source canvas/image are no longer needed once the (much
      // smaller, cropped) output above is extracted — a Full PDF export can
      // hold a dozen+ of these mid-flight, so releasing each one's backing
      // pixel buffer as soon as we're done with it (rather than waiting for
      // GC to notice) meaningfully lowers peak memory during a big export.
      c.width = 0;
      c.height = 0;
      out.width = 0;
      out.height = 0;
      return result;
    } catch {
      return { dataUrl, width: 0, height: 0 };
    }
  }

  // ----- Export the Treatment Plan section only, as a PNG image -----

  const planRef = useRef<HTMLElement | null>(null);
  const [exportingPng, setExportingPng] = useState(false);
  const diagnosisRef = useRef<HTMLDivElement | null>(null);
  const [exportingDxPng, setExportingDxPng] = useState(false);

  // Some content — most commonly the plan table once it carries several
  // currency columns — ends up visually wider than its own container: each
  // extra currency column adds an unbreakable number (e.g. "20,670.00")
  // that the browser will not wrap, so the table's real rendered width can
  // exceed the fixed-width column it lives in. During export we force
  // `overflow: visible` so that excess isn't scrolled out of view, but the
  // container's own box does not grow to match, so a capture that trusts
  // only the container's own getBoundingClientRect() width silently crops
  // that overflow — which is exactly what produced the clipped right-hand
  // currency column. This walks every descendant and returns the true
  // right-most extent so every export captures everything actually being
  // rendered, not just what fits in the container's nominal width.
  const measureCaptureWidth = (el: HTMLElement): number => {
    const rect = el.getBoundingClientRect();
    let maxRight = rect.right;
    const kids = el.querySelectorAll<HTMLElement>("*");
    for (let i = 0; i < kids.length; i++) {
      const r = kids[i]!.getBoundingClientRect();
      if (r.width > 0 && r.right > maxRight) maxRight = r.right;
    }
    return Math.max(rect.width, maxRight - rect.left);
  };

  // --- Special offers rendered inside the PNG export -------------------------
  const isConditionsOffer = (t: string) => /package\s*conditions?/i.test(toPlain(t));
  const pngOfferItems = useMemo(() => offers.filter((o) => !isConditionsOffer(o.title)), [offers]);
  const pngConditions = useMemo(() => offers.find((o) => isConditionsOffer(o.title)), [offers]);
  /**
   * Special offers are exported inline with the treatment plan (image 1) as long as
   * the offer list is short. Once it grows past this count, the full special-offer
   * list is exported as its own second image instead — regardless of how tall the
   * rendered plan actually measures.
   *
   * Special offers always export as their own second image (image 2), separate
   * from the treatment plan (image 1) — whether the plan is short or long, and
   * whether there are 1 or 20 special offers. This keeps every export the same
   * shape, which is simpler to send/print than a plan that sometimes carries
   * the offers inline and sometimes doesn't.
   */
  const [pngSeparateOffers, setPngSeparateOffers] = useState(false);
  const pngOffersListRef = useRef<HTMLOListElement | null>(null);
  const pngOffers2Ref = useRef<HTMLDivElement | null>(null);
  const notesRef = useRef<HTMLDivElement | null>(null);
  const [pngOffersWidth, setPngOffersWidth] = useState<number | string>("980px");

  const renderPngOffers = (
    items: { id: string; title: string; lines: string[] }[],
    startIndex: number,
    withIntro: boolean,
    listRef?: React.RefObject<HTMLOListElement | null>,
  ) => (
    <div className="rounded-2xl border-2 border-accent/30 bg-card overflow-hidden">
      <div className="bg-primary text-primary-foreground px-6 py-4 font-medium uppercase tracking-[0.28em] text-[3rem]">
        <RichText value={offersHeading} as="span" />
        {startIndex > 0 ? <span> (continued)</span> : null}
      </div>
      <div className="p-6">
        {withIntro && toPlain(offerIntro) ? (
          <RichText value={offerIntro} className="text-[2rem] leading-relaxed text-foreground mb-4" />
        ) : null}
        <ol ref={listRef} className="space-y-4">
          {items.map((o, i) => (
            <li key={o.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start gap-3">
                <span className="shrink-0 w-12 h-12 rounded-full bg-accent text-accent-foreground text-[1.5rem] font-bold inline-flex items-center justify-center">
                  {startIndex + i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <RichText value={stripLeadingNumber(o.title)} className="text-[2rem] font-semibold text-primary" />
                  <ul className="mt-1.5 space-y-1">
                    {o.lines
                      .filter((l) => toPlain(l))
                      .map((l, j) => (
                        <li key={j} className="text-[1.75rem] leading-relaxed text-foreground">
                          <RichText value={l.replace(/(?:\s|<br\s*\/?>)+$/i, "")} className="flex-1" />
                        </li>
                      ))}
                  </ul>
                </div>
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-5 rounded-xl border border-primary/20 bg-secondary/40 p-4">
          <p className="text-[2rem] font-bold uppercase tracking-[0.2em] text-primary">
            {pngConditions ? toPlain(pngConditions.title) : "Package conditions"}
          </p>
          {pngConditions && pngConditions.lines.filter((l) => toPlain(l)).length ? (
            <ul className="mt-2 space-y-1">
              {pngConditions.lines
                .filter((l) => toPlain(l))
                .map((l, j) => (
                  <li key={j} className="text-[1.75rem] leading-relaxed text-foreground/85">
                    <RichText value={l} className="flex-1" />
                  </li>
                ))}
            </ul>
          ) : (
            <p className="mt-2 text-[1.75rem] leading-relaxed text-foreground/85">
              These benefits are included as part of your treatment plan. They are non-transferable, non-refundable and
              subject to eligibility and the final confirmed treatment plan.
            </p>
          )}
        </div>
      </div>
    </div>
  );

  const scopeLabel = () =>
    printScope === "all"
      ? ""
      : ` (${toPlain(phases[Number(printScope)]?.title || `Phase ${Number(printScope) + 1}`)
          .split("—")[0]!
          .trim()})`;
  // Preview of the plan PNG(s) before download — same idea as the Full PDF
  // preview below: capture exactly what export would produce and let the
  // user check it (and, if needed, go back and drag the column handles)
  // before committing to a file.
  type PlanPngCapture = { images: { dataUrl: string; filename: string; widthCss: number; heightCss: number }[] };
  const [pngPreview, setPngPreview] = useState<PlanPngCapture | null>(null);

  const raf2 = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

  // Shared high-quality single-shot capture — used for the standalone plan
  // image export AND (below) reused inside the Full PDF export, so the
  // Treatment Plan / Special Offers pages inside a Full PDF are the exact
  // same crisp, single-image renders as "Export plan image" produces,
  // instead of a lower-quality capture tuned for a very long continuous page.
  const shootPretty = async (
    el: HTMLElement,
  ): Promise<{ dataUrl: string; widthCss: number; heightCss: number }> => {
    const rect = el.getBoundingClientRect();
    const widthCss = Math.ceil(measureCaptureWidth(el)) || 1000;
    const heightCss = Math.ceil(rect.height) || 1000;
    // Render at roughly Full HD (~1920px) on the width for a crisp but light
    // file — sharp enough to read/zoom on a phone, without the multi-MB size
    // that came from rasterizing at ~6K and saving as lossless PNG.
    // IMPORTANT: the per-dimension safety cap must win over any "minimum
    // quality" floor — a floor that ignores a tall element's height cap
    // (e.g. a long special-offers list) asks the browser for a canvas
    // taller than it can allocate, which silently comes back blank
    // instead of throwing. So we clamp to the safe ratio FIRST, and only
    // then try to get as close to the target resolution as that allows.
    const maxCanvasPx = 16000; // Chromium-safe per-dimension canvas limit
    const targetLongEdgePx = 1920; // aim for ~1080p-class resolution
    const safeRatio = Math.min(maxCanvasPx / widthCss, maxCanvasPx / heightCss);
    const ratio = Math.max(1, Math.min(safeRatio, targetLongEdgePx / widthCss));
    const dataUrl = await toJpeg(el, {
      pixelRatio: ratio,
      width: widthCss,
      height: heightCss,
      backgroundColor: "#ffffff",
      cacheBust: true,
      quality: 0.92,
      style: {
        margin: "0",
        textRendering: "geometricPrecision",
        WebkitFontSmoothing: "antialiased",
      } as React.CSSProperties as Record<string, string>,
    });
    const cropped = await autoCropDataUrl(dataUrl);
    // autoCropDataUrl trims blank margins, so its output is very often smaller
    // than the pre-crop widthCss/heightCss above. Anything that places this
    // image at an explicit size (the Full PDF) must use the image's REAL size,
    // converted from cropped pixels back to CSS px at the same ratio it was
    // captured at — otherwise the (now smaller) image gets stretched to fill
    // the old, larger box and spills into whatever comes right after it.
    return {
      dataUrl: cropped.dataUrl,
      widthCss: cropped.width > 0 ? cropped.width / ratio : widthCss,
      heightCss: cropped.height > 0 ? cropped.height / ratio : heightCss,
    };
  };

  // ----- Export the Diagnosis section only, as its own JPG image -----
  // Same clean-shot approach as "Export plan image": toggling body.png-export
  // hides every print:hidden/no-print control (chevrons, +Add buttons, tag
  // remove ×s, …) for the shot, exactly like it does for print, so the
  // exported image shows only the diagnosis content a patient should see.
  const exportDiagnosisPng = async () => {
    const node = diagnosisRef.current;
    if (!node) return;
    setExportingDxPng(true);
    document.body.classList.add("png-export");
    try {
      await raf2();
      const shot = await shootPretty(node);
      const a = document.createElement("a");
      a.href = shot.dataUrl;
      a.download = `${displayName ? `${displayName} - ` : ""}Diagnosis.jpg`;
      a.click();
    } catch (err) {
      console.error("Diagnosis image export failed", err);
      window.alert("Không tạo được ảnh Diagnosis — có thể do một hình ảnh bị lỗi hoặc mạng chập chờn. Vui lòng thử lại.");
    } finally {
      document.body.classList.remove("png-export");
      setExportingDxPng(false);
    }
  };

  // Some tables (fixed-width Service/Teeth columns plus several currency
  // columns with long unbreakable numbers, or a long combined implant +
  // abutment name kept on one line by design — see PrintServiceName) can
  // render wider than the width just forced on the section below. That
  // forced width comes from a JS estimate (planMaxWidth), not a live
  // measurement, so it can undershoot the table's real rendered width.
  // Left alone, `overflow: visible` (forced during export) lets the table
  // poke out past the section's own box without clipping it, but the box
  // itself — and everything sized to 100% of it, like the phase title bars
  // and the plan title banner — stays at the narrower forced width, leaving
  // a visible gap next to a wider table. Re-measuring after layout and
  // growing the box to match the true content width closes that gap.
  const growToFitContent = async (el: HTMLElement) => {
    const measured = Math.ceil(measureCaptureWidth(el));
    if (measured > el.getBoundingClientRect().width + 1) {
      el.style.width = `${measured}px`;
      el.style.maxWidth = `${measured}px`;
      await raf2();
    }
  };

  // Each phase's card (header bar + table) sizes itself off its OWN table's
  // content — the browser's table auto-layout expands a table to fit its
  // own widest un-wrapped cell (long tooth lists, long service names) with
  // no awareness of any other phase's table, so two phases with different
  // content can legitimately render at different widths even though the
  // shared column CSS vars give them the same starting hint. Left alone,
  // that means Phase 1 and Phase 2's boxes can end at different right edges
  // in the export. This finds the widest phase card and stretches every
  // card to match it, so every phase's box lines up exactly.
  //
  // It forces EVERY card to that width, not just the ones currently narrower
  // than the widest. When a card's own table has overflowed its box — the
  // table's min-content is wider than the width the card gave it, so
  // `width: 100%` is ignored and the table pokes ~50–100px past the card,
  // the blue phase-title bar and the row cells — that card "measures", via
  // measureCaptureWidth (which walks descendants), as wide as the overflow.
  // So it can BE the widest card and still be visually broken: the header
  // row and totals row jut out past the title bar and the card's right edge
  // (in the export: the thin blue tab at the card's top-right, and the
  // clipped right-hand currency column). This was the Phase 1 vs Phase 2
  // "Phase 1 is missing that strip" bug. Pinning that card to the same width
  // as the rest makes its box actually contain its own table again, and
  // `width: 100%` on the table (forced in the export CSS) then fits.
  const equalizePhaseCardWidths = async (node: HTMLElement): Promise<() => void> => {
    const cards = Array.from(node.querySelectorAll<HTMLElement>("[data-plan-phase-card]"));
    if (!cards.length) return () => {};
    const widths = cards.map((c) => Math.ceil(measureCaptureWidth(c)));
    const maxWidth = Math.max(...widths);
    const touched = cards.map((c) => ({ el: c, prevWidth: c.style.width, prevMaxWidth: c.style.maxWidth }));
    for (const c of cards) {
      c.style.width = `${maxWidth}px`;
      c.style.maxWidth = `${maxWidth}px`;
    }
    // Two frames, not one: right after a card's width changes, its rounded
    // corner clip can briefly lag the new box size in some browsers'
    // rasterizer (html-to-image serializes whatever the DOM reports at
    // capture time), which can show up as a sliver of the card's own
    // background peeking through right at the corner. Giving it a second
    // frame to fully settle before shooting avoids that.
    await raf2();
    await raf2();
    return () => {
      for (const { el, prevWidth, prevMaxWidth } of touched) {
        el.style.width = prevWidth;
        el.style.maxWidth = prevMaxWidth;
      }
    };
  };

  const capturePlanPng = async (): Promise<PlanPngCapture | null> => {
    const node = planRef.current;
    if (!node) return null;
    document.body.classList.add("png-export");
    // Force the plan section to its full intended width for every export,
    // no matter how wide the browser window happens to be on the machine
    // doing the exporting. The section's own CSS only sets a max-width, so
    // on a narrower window/laptop it quietly renders narrower too — which
    // gives the phase title bar and the "VND"/"AUD" table headers less
    // room and can wrap them differently ("Phase 1 — Implant Placement
    // (7 days)" splitting onto two lines, "VND" splitting into "VN"/"D")
    // even though nothing about the plan's content changed. Pinning both
    // width and max-width here makes every export use the exact same
    // fixed width, so the layout is identical from any computer.
    const prevWidth = node.style.width;
    const prevMaxWidth = node.style.maxWidth;
    node.style.width = `${planMaxWidth}px`;
    node.style.maxWidth = `${planMaxWidth}px`;
    // Pinning the section's own width above is not enough on its own: its
    // ancestors still sit at the browser window's width, so on a narrower
    // window the phase cards and their tables are laid out in a cramped box
    // and the browser's table auto-layout squeezes columns unevenly — one
    // phase's table then renders wider than its card (the white "notch" at
    // the card's top-right) and past the capture frame (the clipped AUD
    // column). "Export full web" avoids this by widening the whole page
    // root before it captures (see exportFullPdf) — which is exactly why the
    // Treatment Plan looks right there but not in the standalone plan image.
    // Do the same here.
    const rootEl = pageRootRef.current;
    const prevRootMinWidth = rootEl ? rootEl.style.minWidth : "";
    const prevRootPosition = rootEl ? rootEl.style.position : "";
    const prevRootLeft = rootEl ? rootEl.style.left : "";
    const prevRootTop = rootEl ? rootEl.style.top : "";
    if (rootEl) {
      rootEl.style.minWidth = `${Math.max(2000, planMaxWidth)}px`;
      // Off-screen instead of visibly widening in front of the visitor —
      // see the matching comment in exportFullPdf.
      rootEl.style.position = "fixed";
      rootEl.style.left = "-20000px";
      rootEl.style.top = "0";
    }
    try {
      // Important notes are never part of the PNG export.
      // Start with special offers shown inline, then measure the actual
      // rendered height to see if the plan image still fits the allowed frame.
      setPngSeparateOffers(false);
      await raf2();
      await raf2();
      try {
        await (document as Document & { fonts?: FontFaceSet }).fonts?.ready;
      } catch {
        /* ignore */
      }

      let rect = node.getBoundingClientRect();
      setPngOffersWidth(`${Math.ceil(rect.width)}px`);

      // Special offers (if any) always go on their own, second image — never
      // inline with the treatment plan — regardless of how short or long
      // either list is.
      const hasOffers = pngOfferItems.length > 0 || !!pngConditions;
      if (hasOffers) {
        setPngSeparateOffers(true);
        await raf2();
        await raf2();
        rect = node.getBoundingClientRect();
      }

      await growToFitContent(node);
      const restoreCardWidths = await equalizePhaseCardWidths(node);

      const base = `${displayName || "Patient"} - Treatment plan${scopeLabel()}`;
      const planShot = await shootPretty(node);
      const images = [{ ...planShot, filename: `${base}.jpg` }];
      restoreCardWidths();

      if (hasOffers && pngOffers2Ref.current) {
        const offersShot = await shootPretty(pngOffers2Ref.current);
        images.push({ ...offersShot, filename: `${displayName || "Patient"} - Special offers.jpg` });
      }
      return { images };
    } finally {
      document.body.classList.remove("png-export");
      setPngSeparateOffers(false);
      node.style.width = prevWidth;
      node.style.maxWidth = prevMaxWidth;
      if (rootEl) {
        rootEl.style.minWidth = prevRootMinWidth;
        rootEl.style.position = prevRootPosition;
        rootEl.style.left = prevRootLeft;
        rootEl.style.top = prevRootTop;
      }
    }
  };

  const downloadPlanPngCapture = (cap: PlanPngCapture) => {
    cap.images.forEach(({ dataUrl, filename }) => {
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = filename;
      a.click();
    });
  };

  const exportPlanPng = async (mode: "download" | "preview" = "download") => {
    setExportingPng(true);
    try {
      const cap = await capturePlanPng();
      if (!cap) return;
      if (mode === "preview") {
        setPngPreview(cap);
      } else {
        downloadPlanPngCapture(cap);
      }
    } catch (err) {
      console.error("Plan image export failed", err);
      window.alert(
        "Không tạo được ảnh treatment plan — có thể do một hình ảnh bị lỗi hoặc mạng chập chờn. Vui lòng thử lại.",
      );
    } finally {
      setExportingPng(false);
    }
  };

  // Re-shoot the Treatment Plan section as ONE crisp image (same quality/
  // framing as "Export plan image"), for use as a single page inside the
  // Full PDF — instead of the generic tall-page capture, which can split a
  // long plan into several stitched sub-images. Offers are always pushed to
  // their own separate page (captured below), never shown inline here.
  // Uses the exact same "png-export" toggle as "Export plan image" itself
  // (proven reliable), which also keeps Important Notes out of this shot —
  // that's captured as its own separate chunk right below, see
  // capturePrettyNotesForFullPdf.
  const capturePrettyTreatmentPlanForFullPdf = async () => {
    const node = planRef.current;
    if (!node) return null;
    document.body.classList.add("png-export");
    // Same fix as capturePlanPng above: force the section to its full
    // intended width before shooting it, instead of trusting whatever width
    // it happens to have inherited from the page root's forced min-width.
    // The section itself is centered with mx-auto and (for a short plan)
    // only ever gets a max-width, never an explicit width — so on a export
    // machine with a narrower window it can still render narrower than
    // planMaxWidth, and the Service/Teeth columns (which DO have fixed
    // pixel widths) get proportionally squeezed by the browser's table
    // auto-layout to fit inside that narrower box, without the other
    // (naturally-sized) columns shrinking at all — exactly the "Service
    // column looks cramped in the full web/PDF export" symptom.
    const prevWidth = node.style.width;
    const prevMaxWidth = node.style.maxWidth;
    node.style.width = `${planMaxWidth}px`;
    node.style.maxWidth = `${planMaxWidth}px`;
    try {
      setPngSeparateOffers(true);
      await raf2();
      await raf2();
      await growToFitContent(node);
      const restoreCardWidths = await equalizePhaseCardWidths(node);
      const shot = await shootPretty(node);
      restoreCardWidths();
      return shot;
    } finally {
      document.body.classList.remove("png-export");
      setPngSeparateOffers(false);
      node.style.width = prevWidth;
      node.style.maxWidth = prevMaxWidth;
    }
  };

  // Important Notes is deliberately excluded from the Treatment Plan shot
  // above (same as "Export plan image"), so it's captured here on its own —
  // no toggling needed, since it's always visible outside of png-export.
  const capturePrettyNotesForFullPdf = async () => {
    const node = notesRef.current;
    if (!node) return null;
    return await shootPretty(node);
  };

  // Re-shoot Special Offers as the same clean, boxed layout "Export plan
  // image" produces (numbered cards + a highlighted Package Conditions box),
  // instead of capturing the raw on-page editor section.
  const capturePrettyOffersForFullPdf = async () => {
    if (!(pngOfferItems.length > 0 || pngConditions)) return null;
    // Keep the offers box the same width as the plan itself, regardless of
    // whether the Treatment Plan chunk was captured earlier in this pass.
    if (planRef.current) {
      setPngOffersWidth(`${Math.ceil(planRef.current.getBoundingClientRect().width)}px`);
    }
    document.body.classList.add("png-export");
    try {
      setPngSeparateOffers(true);
      await raf2();
      await raf2();
      const node = pngOffers2Ref.current;
      if (!node) return null;
      return await shootPretty(node);
    } finally {
      document.body.classList.remove("png-export");
      setPngSeparateOffers(false);
    }
  };


  // ----- Export the WHOLE document as a continuous, full-length digital PDF -----
  const pageRootRef = useRef<HTMLDivElement | null>(null);
  const [fullPdfStage, setFullPdfStage] = useState<null | "prep" | "gen">(null);
  // 0-100, how far the "gen" stage's section-by-section capture loop has
  // gotten — shown as a percentage under the Export/Preview full web
  // buttons instead of the page itself visibly widening in front of the
  // user (see the off-screen positioning in exportFullPdf below).
  const [fullPdfProgress, setFullPdfProgress] = useState(0);

  type FullPdfCapture = {
    dataUrl: string;
    cssWidth: number;
    links: {
      x: number;
      y: number;
      w: number;
      h: number;
      url?: string;
      targetY?: number;
    }[];
  };

  // Blob URL of a real, fully-paginated PDF (built the exact same way
  // "Download PDF" builds the final file) — shown in an <iframe> so the
  // preview always genuinely matches what gets downloaded.
  const [fullPdfPreviewUrl, setFullPdfPreviewUrl] = useState<string | null>(null);

  // Shared by both the quick on-screen preview and the real export: find every
  // clickable link inside the captured node and record its position relative
  // to the node, plus (for internal #anchors) where it should jump to.
  const collectFullPdfLinks = (node: HTMLElement, rect: { top: number; left: number }): FullPdfCapture["links"] => {
    const links: FullPdfCapture["links"] = [];

    node.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((a) => {
      const href = a.getAttribute("href") || "";
      const r = absRect(a);

      if (r.width < 2 || r.height < 2) return;

      const style = window.getComputedStyle(a);
      if (style.display === "none" || style.visibility === "hidden") return;

      // Internal Agenda link: #diagnosis, #treatment-plan, etc.
      if (href.startsWith("#")) {
        const targetId = href.substring(1);
        const target = document.getElementById(targetId);
        if (!target) return;

        const targetRect = absRect(target);

        links.push({
          x: r.left - rect.left,
          y: r.top - rect.top,
          w: r.width,
          h: r.height,
          targetY: targetRect.top - rect.top,
        });
        return;
      }

      // External link: website / email / phone / WhatsApp.
      if (!/^(https?:|mailto:|tel:)/i.test(href)) return;

      links.push({
        x: r.left - rect.left,
        y: r.top - rect.top,
        w: r.width,
        h: r.height,
        url: href,
      });
    });

    return links;
  };

  // `.complete` can be true before a large image has actually finished
  // decoding/painting — which is exactly what produced blank-looking gaps
  // in photo-heavy sections (Photos & X-rays, clinic photos, Before & After)
  // in the Full PDF: the chunk was "captured" before its image had any
  // pixels yet. `img.decode()` waits for real, paintable pixel data.
  const waitForImages = (node: HTMLElement) =>
    Promise.all(
      Array.from(node.querySelectorAll("img")).map(async (img) => {
        if (typeof img.decode === "function") {
          try {
            await img.decode();
            return;
          } catch {
            // Fall through to the load/error listener below.
          }
        }
        if (img.complete) return;
        await new Promise((res) => {
          img.onload = img.onerror = () => res(null);
        });
      }),
    );

  const exportFullPdf = async (mode: "download" | "preview" = "download") => {
    const node = pageRootRef.current;
    if (!node || fullPdfStage) return;
    setFullPdfStage("prep");
    setFullPdfProgress(0);

    // Most sections are centered with a "max-width" (e.g. 2000px) — which
    // only reaches that width if the browser window is actually at least
    // that wide. On an ordinary laptop window (or normal 100% zoom) it's
    // usually narrower, so those sections quietly shrink to fit — which is
    // exactly why zooming out to ~67% "fixed" it: zooming out gives the page
    // more effective CSS pixels to work with, finally clearing 2000px. This
    // forces that width directly, so the export always reaches full design
    // width no matter what the browser window/zoom happens to be.
    const prevMinWidth = node.style.minWidth;
    // The Treatment Plan section can widen past 2000px on its own (extra
    // currency columns, a long plan, or a long service name — see
    // PLAN_BASE_MAX_WIDTH/planServiceExtra), so the capture viewport needs
    // to be at least that wide too, or the extra width has no room to
    // actually render into.
    node.style.minWidth = `${Math.max(2000, planMaxWidth)}px`;

    // The widening above used to happen right in front of the visitor — the
    // whole live page visibly stretching out to 2000px+ before their eyes,
    // which reads as the site "zooming in"/jumping around rather than a
    // deliberate export step. Moving the page off-screen (fixed + a huge
    // negative offset — the same technique already used for the
    // Special-Offers-image clone above) keeps it fully rendered, so capture
    // still sees and measures everything normally, while nobody watches it
    // happen. The Export/Preview full web buttons show a percentage instead
    // (see fullPdfProgress).
    const prevPosition = node.style.position;
    const prevLeft = node.style.left;
    const prevTop = node.style.top;
    node.style.position = "fixed";
    node.style.left = "-20000px";
    node.style.top = "0";

    document.body.classList.add("fullpdf-export");
    try {
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      try {
        await (document as Document & { fonts?: FontFaceSet }).fonts?.ready;
      } catch {
        /* ignore */
      }

      // Let lazy images settle before capturing the document.
      await waitForImages(node);

      setFullPdfStage("gen");
      const captured = await captureFullPdfPageImages(node, setFullPdfProgress);
      await buildFullPdfFromChunks(captured, mode);
    } catch (err) {
      console.error("Full web export failed", err);
      window.alert(
        "Không tạo được bản PDF đầy đủ trang web — có thể do một hình ảnh bị lỗi hoặc mạng chập chờn. Vui lòng thử lại; nếu vẫn lỗi, hãy kiểm tra các ảnh đã tải lên.",
      );
    } finally {
      document.body.classList.remove("fullpdf-export");
      node.style.minWidth = prevMinWidth;
      node.style.position = prevPosition;
      node.style.left = prevLeft;
      node.style.top = prevTop;
      setFullPdfStage(null);
      setFullPdfProgress(0);
    }
  };

  type FullPdfChunk = { dataUrl: string; xCss: number; topCss: number; widthCss: number; heightCss: number };
  // "Export full web" is ONE continuous digital page — the whole site from
  // top to bottom in a single scrollable PDF page, meant to be sent to a
  // customer to view on a screen — so there's no paper-size pagination data
  // to carry here at all, just the full captured content and its links.
  type FullPdfCaptureData = {
    chunks: FullPdfChunk[];
    cssWidth: number;
    cssHeight: number;
    links: FullPdfCapture["links"];
  };

  // Per-chunk resolution budget. Kept independent of the document's total
  // height, which is the actual thing that used to make long exports blurry.
  const CHUNK_MAX_CANVAS_PX = 16000; // Chromium-safe per-dimension canvas limit
  const CHUNK_MAX_PIXELS = 30_000_000; // safe per-chunk pixel budget
  const CHUNK_TARGET_RATIO = 2; // crisp on screen, much lighter than print-grade 3x

  const chunkRatio = (w: number, h: number) =>
    Math.max(
      1,
      Math.min(
        CHUNK_TARGET_RATIO,
        CHUNK_MAX_CANVAS_PX / Math.max(1, w),
        CHUNK_MAX_CANVAS_PX / Math.max(1, h),
        Math.sqrt(CHUNK_MAX_PIXELS / Math.max(1, w * h)),
      ),
    );

  const isCapturableEl = (el: Element): el is HTMLElement => {
    if (!(el instanceof HTMLElement)) return false;
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") return false;
    const r = el.getBoundingClientRect();
    return r.width >= 2 && r.height >= 2;
  };

  // Document-absolute position of an element (viewport rect + current scroll
  // offset). Capturing many chunks is asynchronous and can take several
  // seconds on a long page, and plain getBoundingClientRect() is relative to
  // the *viewport* — if the page scrolls even slightly while a later chunk
  // is being measured (scroll anchoring as images/content settle, etc.),
  // chunks measured at different times end up placed at the wrong offset
  // and overlap each other in the final image. Anchoring every measurement
  // to the document instead of the viewport keeps offsets correct no matter
  // when, or at what scroll position, each chunk is captured.
  const absRect = (el: Element) => {
    const r = el.getBoundingClientRect();
    return { top: r.top + window.scrollY, left: r.left + window.scrollX, width: r.width, height: r.height };
  };

  // Captures one real, LIVE section of the page (never a clone) with toPng —
  // the same call already used successfully elsewhere in this file for the
  // Treatment Plan PNG export. If a section is itself too tall to rasterize
  // sharply in one shot, it is split further by descending into its own
  // children, so every actual capture always targets a real DOM element at
  // its natural size.
  const captureSection = async (
    el: HTMLElement,
    nodeRect: { top: number; left: number },
    depth: number,
  ): Promise<FullPdfChunk[]> => {
    const r = absRect(el);
    const widthCss = Math.ceil(measureCaptureWidth(el));
    const heightCss = Math.ceil(r.height);
    const tooTallForOneCanvas = heightCss > CHUNK_MAX_CANVAS_PX;
    const children = depth < 6 ? Array.from(el.children).filter(isCapturableEl) : [];

    if (tooTallForOneCanvas && children.length > 1) {
      const results: FullPdfChunk[] = [];
      for (const child of children) {
        results.push(...(await captureSection(child, nodeRect, depth + 1)));
      }
      return results;
    }

    const ratio = chunkRatio(widthCss, heightCss);
    // JPEG instead of lossless PNG cuts file size dramatically for a
    // multi-section, multi-page export like this (photos especially), while
    // staying sharp enough to read on screen — the same trade-off already
    // used for the lighter PNG share-image export below.
    const dataUrl = await toJpeg(el, {
      pixelRatio: ratio,
      width: widthCss,
      height: heightCss,
      backgroundColor: "#ffffff",
      cacheBust: true,
      quality: 0.88,
      style: {
        margin: "0",
        textRendering: "geometricPrecision",
        WebkitFontSmoothing: "antialiased",
      } as React.CSSProperties as Record<string, string>,
    });

    return [
      {
        dataUrl,
        xCss: r.left - nodeRect.left,
        topCss: r.top - nodeRect.top,
        widthCss,
        heightCss,
      },
    ];
  };

  const captureFullPdfPageImages = async (
    node: HTMLElement,
    onProgress?: (pct: number) => void,
  ): Promise<FullPdfCaptureData> => {
    // Every ordinary section (hero, journey, diagnosis, ...) widens to match
    // the Treatment Plan via --pdf-content-width (see .max-w-\[2000px\] in
    // styles.css), but that variable normally just tracks planMaxWidth — a
    // JS *estimate* of the plan's width. The plan's real rendered width can
    // come out wider than that estimate (a long service name kept on one
    // line — see PrintServiceName — or a phase table that needed
    // equalizePhaseCardWidths below to line up with its siblings), which
    // left every other section visibly narrower than the plan itself in the
    // export. Measuring the plan's TRUE width up front and syncing the CSS
    // var to that real number — before any section is captured — keeps
    // every section, including the plan, honestly matched to the same width.
    let prevPdfContentWidthVar: string | null = null;
    if (planRef.current) {
      const planNode = planRef.current;
      const prevW = planNode.style.width;
      const prevMW = planNode.style.maxWidth;
      planNode.style.width = `${planMaxWidth}px`;
      planNode.style.maxWidth = `${planMaxWidth}px`;
      await raf2();
      await raf2();
      await growToFitContent(planNode);
      const restoreCardWidths = await equalizePhaseCardWidths(planNode);
      const trueWidth = Math.ceil(measureCaptureWidth(planNode));
      restoreCardWidths();
      prevPdfContentWidthVar = document.documentElement.style.getPropertyValue("--pdf-content-width");
      document.documentElement.style.setProperty("--pdf-content-width", `${trueWidth}px`);
      planNode.style.width = prevW;
      planNode.style.maxWidth = prevMW;
      await raf2();
      await raf2();
    }

    // Capture at the page's own natural (viewport) width — whatever size the
    // site is currently showing at is exactly what gets exported, with no
    // extra logic trying to trim, rescale, or otherwise "optimize" the width.
    const nodeRect = absRect(node);
    const cssWidth = Math.ceil(measureCaptureWidth(node)) || 1200;
    const links = collectFullPdfLinks(node, nodeRect);

    const topLevelSections = Array.from(node.children).filter(isCapturableEl);
    const sections = topLevelSections.length > 0 ? topLevelSections : [node];

    // Some sections above are replaced with a separately-rendered "pretty"
    // image (Treatment Plan, Special Offers) that is usually a different
    // height than the live, on-page section it stands in for — Special
    // Offers especially, since its shot comes from a whole separate
    // off-screen clone, so the live section here keeps its full, uncropped
    // editing-mode height no matter how short the shot is. Whatever comes
    // next is still positioned from the LIVE document, so left alone this
    // leaves a blank gap (shot shorter than the live section) or an overlap
    // (shot taller) wherever the two heights disagree. Resizing the live
    // section to match its shot's actual height — then restoring it once
    // every section has been captured — keeps the rest of the document
    // flowing directly against each shot's real size instead.
    const collapsedSections: { el: HTMLElement; prevHeight: string; prevOverflow: string }[] = [];
    const collapseToMatch = (el: HTMLElement, heightCss: number) => {
      collapsedSections.push({ el, prevHeight: el.style.height, prevOverflow: el.style.overflow });
      el.style.height = `${heightCss}px`;
      el.style.overflow = "hidden";
    };

    const chunks: FullPdfChunk[] = [];
    let cssHeight = 0;
    try {
      for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex++) {
        const section = sections[sectionIndex]!;
        const reportProgress = () => onProgress?.(Math.round(((sectionIndex + 1) / sections.length) * 100));
        // Treatment Plan and Special Offers are re-shot as the same single,
        // crisp images "Export plan image" produces (see capturePretty...
        // ForFullPdf above), instead of the generic tall-page splitter — this
        // avoids a long plan being stitched from several sub-images, and gives
        // Special Offers the same clean boxed layout instead of the raw
        // on-page editor. Both keep their natural position in the document.
        if (section.id === "treatment-plan") {
          const r = absRect(section);
          const shot = await capturePrettyTreatmentPlanForFullPdf();
          if (shot) {
            chunks.push({
              dataUrl: shot.dataUrl,
              xCss: r.left - nodeRect.left,
              topCss: r.top - nodeRect.top,
              widthCss: shot.widthCss,
              heightCss: shot.heightCss,
            });
            // Important Notes is excluded from the shot above (same as
            // "Export plan image"), so it's inserted here as its own chunk,
            // right after the plan, at its own natural position in the page.
            let sectionBottom = r.top + shot.heightCss;
            if (notesRef.current) {
              const nr = absRect(notesRef.current);
              const notesShot = await capturePrettyNotesForFullPdf();
              if (notesShot) {
                chunks.push({
                  dataUrl: notesShot.dataUrl,
                  xCss: nr.left - nodeRect.left,
                  topCss: nr.top - nodeRect.top,
                  widthCss: notesShot.widthCss,
                  heightCss: notesShot.heightCss,
                });
                sectionBottom = nr.top + notesShot.heightCss;
              }
            }
            collapseToMatch(section, sectionBottom - r.top);
            await raf2();
            reportProgress();
            continue;
          }
        }
        if (section.id === "special-offers") {
          const r = absRect(section);
          const shot = await capturePrettyOffersForFullPdf();
          if (shot) {
            chunks.push({
              dataUrl: shot.dataUrl,
              xCss: r.left - nodeRect.left,
              topCss: r.top - nodeRect.top,
              widthCss: shot.widthCss,
              heightCss: shot.heightCss,
            });
            collapseToMatch(section, shot.heightCss);
            await raf2();
            reportProgress();
            continue;
          }
        }
        chunks.push(...(await captureSection(section, nodeRect, 0)));
        reportProgress();
      }
      // Measured only now, after any collapses above — so the page count
      // below reflects the document's real final height instead of the
      // taller, pre-collapse height from before Special Offers/Treatment
      // Plan were resized to match their shots.
      cssHeight = Math.ceil(node.scrollHeight || node.getBoundingClientRect().height);
    } finally {
      for (const { el, prevHeight, prevOverflow } of collapsedSections) {
        el.style.height = prevHeight;
        el.style.overflow = prevOverflow;
      }
      if (prevPdfContentWidthVar !== null) {
        if (prevPdfContentWidthVar) {
          document.documentElement.style.setProperty("--pdf-content-width", prevPdfContentWidthVar);
        } else {
          document.documentElement.style.removeProperty("--pdf-content-width");
        }
      }
    }
    // Every chunk is centered on the page width, regardless of how wide it
    // is relative to the others — a long Treatment Plan naturally renders
    // wider than the rest, so without this every narrower section (Photos,
    // Diagnosis, Contact, ...) would sit off-center against it.
    for (const chunk of chunks) {
      chunk.xCss = Math.max(0, (cssWidth - chunk.widthCss) / 2);
    }
    chunks.sort((a, b) => a.topCss - b.topCss);

    return { chunks, cssWidth, cssHeight, links };
  };

  // CSS px -> PDF pt at the standard 96dpi assumption (1px = 0.75pt).
  const CSS_PX_TO_PT = 0.75;
  // Adobe/most PDF viewers refuse (or badly mis-render) a page edge longer
  // than 200in — 14,400pt. A very long export (many sections, a long
  // treatment plan) can exceed that in one continuous page, so the whole
  // page is scaled down uniformly to fit under the cap rather than ever
  // being split into several pages — it's still one single scrollable page,
  // just proportionally smaller; a PDF viewer's zoom makes up the rest.
  const MAX_PAGE_PT = 14_400;

  // Builds the actual jsPDF document from a set of captured chunks, without
  // saving or previewing it — split out so buildFullPdfFromChunks below can
  // build it more than once (at lower image quality) if the first pass
  // comes out over the size cap, without duplicating the page-geometry math.
  const buildFullPdfDoc = async (data: FullPdfCaptureData) => {
    const { chunks, cssWidth, cssHeight, links } = data;
    const { jsPDF } = await import("jspdf");

    // "Export full web" is one continuous digital page — the whole site
    // captured top to bottom exactly as it renders (Treatment Plan widened,
    // every other section matched to its width — see planMaxWidth /
    // body.fullpdf-export above), with no paper-size pagination at all.
    // Meant to be opened and scrolled through on a screen, not printed.
    // The margin is kept at a fixed size (never shrunk along with the page)
    // so a very long export — where `scale` below can get quite small —
    // still has real breathing room on every edge. Scaling the margin down
    // with everything else (as before) could shrink it to just a few points,
    // which reads as content sitting flush against, or clipped by, the page
    // edge (most visibly the eyebrow label right above "Treatment Plan").
    const MARGIN_PT = 24;
    const availableWidthPt = Math.max(1, MAX_PAGE_PT - MARGIN_PT * 2);
    const availableHeightPt = Math.max(1, MAX_PAGE_PT - MARGIN_PT * 2);
    const scale = Math.min(
      1,
      availableWidthPt / (cssWidth * CSS_PX_TO_PT),
      availableHeightPt / (cssHeight * CSS_PX_TO_PT),
    );
    const cssToPt = CSS_PX_TO_PT * scale;
    const marginPt = MARGIN_PT;
    const PDF_W = cssWidth * cssToPt + marginPt * 2;
    const PDF_H = cssHeight * cssToPt + marginPt * 2;

    const pdf = new jsPDF({
      orientation: PDF_W >= PDF_H ? "landscape" : "portrait",
      unit: "pt",
      format: [PDF_W, PDF_H],
      compress: true,
    });
    pdf.setFillColor(255, 255, 255);
    pdf.rect(0, 0, PDF_W, PDF_H, "F");

    for (const chunk of chunks) {
      const xPt = marginPt + chunk.xCss * cssToPt;
      const yPt = marginPt + chunk.topCss * cssToPt;
      const wPt = chunk.widthCss * cssToPt;
      const hPt = chunk.heightCss * cssToPt;
      pdf.addImage(chunk.dataUrl, "JPEG", xPt, yPt, wPt, hPt, undefined, "FAST");
    }

    links.forEach((link) => {
      const x = marginPt + link.x * cssToPt;
      const y = marginPt + link.y * cssToPt;
      const w = link.w * cssToPt;
      const h = link.h * cssToPt;

      if (link.url) {
        pdf.link(x, y, w, h, { url: link.url });
        return;
      }

      if (link.targetY !== undefined) {
        pdf.link(x, y, w, h, { pageNumber: 1, top: marginPt + link.targetY * cssToPt });
      }
    });

    return pdf;
  };

  // Re-encodes one already-captured JPEG chunk at a lower quality (and,
  // once that alone isn't enough, a lower resolution too) — much cheaper
  // than re-rendering the DOM again, and enough to bring a large export
  // under the size cap below. widthCss/heightCss (where the chunk is placed
  // and how big it appears in the PDF) never change — only how many actual
  // pixels back that placement, i.e. how sharp/heavy the image is.
  const reencodeJpeg = (dataUrl: string, quality: number, resScale: number): Promise<string> =>
    new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const w = Math.max(1, Math.round(img.naturalWidth * resScale));
        const h = Math.max(1, Math.round(img.naturalHeight * resScale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(dataUrl);
        ctx.drawImage(img, 0, 0, w, h);
        const out = canvas.toDataURL("image/jpeg", quality);
        // Release this canvas's backing pixel buffer right away instead of
        // waiting for GC — see the same pattern in autoCropDataUrl.
        canvas.width = 0;
        canvas.height = 0;
        resolve(out);
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });

  // Dr. Care's own hard cap on the exported file, regardless of how long or
  // photo-heavy the plan is — big enough to stay sharp at the first step,
  // but re-compresses (then, if that alone isn't enough, also downscales)
  // in a few progressively more aggressive passes until the file fits,
  // rather than ever handing back a PDF too big to comfortably email.
  // Raised from 10MB: even a short, simple plan's first-pass capture was
  // already landing around ~12MB (this site's own marketing sections are
  // photo-heavy), so the old cap meant almost every export paid for at
  // least one re-encode pass. 20MB is still comfortably emailable/shareable
  // and lets most plans skip that extra (now sequential, but still not
  // free) work entirely.
  const MAX_PDF_BYTES = 20 * 1024 * 1024;
  const PDF_SIZE_REDUCTION_STEPS: { quality: number; resScale: number }[] = [
    { quality: 1, resScale: 1 }, // as originally captured — most exports never need to go further
    { quality: 0.8, resScale: 1 },
    { quality: 0.6, resScale: 1 },
    { quality: 0.45, resScale: 0.8 },
    { quality: 0.35, resScale: 0.6 },
  ];

  const buildFullPdfFromChunks = async (data: FullPdfCaptureData, mode: "download" | "preview" = "download") => {
    const fileName = `Dr_Care_Treatment_Plan_${(displayName || "Patient").replace(/\s+/g, "_")}.pdf`;

    let workingChunks = data.chunks;
    let pdf = await buildFullPdfDoc({ ...data, chunks: workingChunks });
    let blob = pdf.output("blob") as Blob;

    for (let i = 1; i < PDF_SIZE_REDUCTION_STEPS.length && blob.size > MAX_PDF_BYTES; i++) {
      const { quality, resScale } = PDF_SIZE_REDUCTION_STEPS[i]!;
      // Re-encoded one chunk at a time, not via Promise.all: a Full PDF can
      // carry a dozen+ multi-megabyte captures, and firing every image
      // decode + canvas draw for all of them at once means all of their
      // backing buffers are alive simultaneously — exactly the peak-memory
      // spike that was crashing the tab ("Out of memory") on export. Doing
      // this sequentially keeps at most one extra decoded image + canvas in
      // memory at a time, trading a little wall-clock time for headroom.
      workingChunks = [];
      for (const c of data.chunks) {
        workingChunks.push({ ...c, dataUrl: await reencodeJpeg(c.dataUrl, quality, resScale) });
      }
      pdf = await buildFullPdfDoc({ ...data, chunks: workingChunks });
      blob = pdf.output("blob") as Blob;
    }

    const url = URL.createObjectURL(blob);
    if (mode === "preview") {
      // Same real PDF as "Download" produces — shown in an <iframe>, which
      // every browser renders with its own native PDF viewer (scroll, zoom),
      // so the preview always genuinely matches what gets downloaded.
      // "#view=FitH" asks the browser's built-in PDF viewer to fit the page
      // to the iframe's width instead of "fit whole page" (its usual
      // default), which is what was leaving empty space down one side
      // whenever the page's own proportions didn't match the iframe's.
      setFullPdfPreviewUrl(`${url}#view=FitH`);
      return;
    }
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  // ----- Undo (Ctrl+Z) / Redo (Ctrl+S) -----
  const undoSnapshot = {
    priceSheets,
    priceSheetTitle,
    priceSheetNote,
    priceSheetDisclaimerHeading,
    priceSheetDisclaimer,
    priceSheetExchangeHeading,
    priceSheetExchange,
    clinicInfo,
    comparisons,
    clinicName,
    heroTitle,
    greeting,
    letter,
    patient,
    historyItems,
    historyChecked,
    allergyItems,
    allergyChecked,
    formHeading,
    historyHeading,
    allergyHeading,
    offerService,
    offerServiceCustom,
    offerIntro,
    offers,
    offersHeading,
    selectedPriceLists,
    removedPriceListPages,
    dxOpen,
    historyOpen,
    allergyOpen,
    offersOpen,
    openPhases,
    printScope,

    dxKicker,
    dxHeading,
    dxSummaryTitle,
    dxSummary,
    treatmentPlanHeading,
    treatmentPlanIntro,
    chartTitle,
    toothNotes,
    // heroImg/heroPos/heroZoom and clinicPhotos/clinicLayout are intentionally
    // NOT snapshotted here: they're shared clinic branding (content key
    // "hero_image" / "clinic_photos"), always read live from `content` (see
    // the resync effect above) so every plan — old or new — reflects the
    // latest published version instead of freezing whatever was live when
    // this plan was last saved.
    heroHeight,
    patientImg,
    featureImg,
    logoImg,
    gallery,
    cols,
    phases,
    hotelSupports,
  };
  const restoreSnapshot = (s: any) => {
    setPriceSheets(s.priceSheets);
    setPriceSheetTitle(s.priceSheetTitle);
    setPriceSheetNote(s.priceSheetNote);
    setPriceSheetDisclaimerHeading(s.priceSheetDisclaimerHeading);
    setPriceSheetDisclaimer(s.priceSheetDisclaimer);
    setPriceSheetExchangeHeading(s.priceSheetExchangeHeading);
    setPriceSheetExchange(s.priceSheetExchange);
    setClinicInfo(s.clinicInfo);
    setComparisons(s.comparisons);
    setClinicName(s.clinicName);
    setHeroTitle(s.heroTitle);
    setGreeting(s.greeting);
    setLetter(s.letter);
    setPatient(s.patient);
    setHistoryItems(s.historyItems);
    setHistoryChecked(s.historyChecked);
    setAllergyItems(s.allergyItems);
    setAllergyChecked(s.allergyChecked);
    setFormHeading(s.formHeading);
    setHistoryHeading(s.historyHeading);
    setAllergyHeading(s.allergyHeading);
    setOfferService(s.offerService);
    setOfferServiceCustom(s.offerServiceCustom);
    setOfferIntro(s.offerIntro);
    setOffers(s.offers);
    if (s.offersHeading !== undefined) setOffersHeading(s.offersHeading);
    if (s.selectedPriceLists) setSelectedPriceLists(s.selectedPriceLists);
    setRemovedPriceListPages(s.removedPriceListPages ?? {});
    if (s.dxOpen) setDxOpen(s.dxOpen);
    if (s.historyOpen !== undefined) setHistoryOpen(s.historyOpen);
    if (s.allergyOpen !== undefined) setAllergyOpen(s.allergyOpen);
    if (s.offersOpen !== undefined) setOffersOpen(s.offersOpen);
    if (s.openPhases) setOpenPhases(s.openPhases);
    if (s.printScope) setPrintScope(s.printScope);
    setDxKicker(s.dxKicker);
    setDxHeading(s.dxHeading);
    setDxSummaryTitle(s.dxSummaryTitle);
    setDxSummary(s.dxSummary);
    if (s.treatmentPlanHeading !== undefined) setTreatmentPlanHeading(s.treatmentPlanHeading);
    if (s.treatmentPlanIntro !== undefined) setTreatmentPlanIntro(s.treatmentPlanIntro);
    setChartTitle(s.chartTitle);
    setToothNotes(s.toothNotes);
    setHeroHeight(s.heroHeight);
    setPatientImg(s.patientImg);
    setFeatureImg(s.featureImg);
    setLogoImg(s.logoImg);
    setGallery(s.gallery);
    setCols(s.cols);
    setPhases(s.phases);
    setHotelSupports(s.hotelSupports ?? []);
  };
  const { undo, redo, clearHistory, canUndo, canRedo } = useUndoRedo(undoSnapshot, restoreSnapshot);

  // Opening a saved plan restores everything from its own snapshot — except
  // Patient Benefits, which is clinic-wide policy rather than per-patient
  // content. A plan saved before the package was last edited should still
  // show whatever is currently published (e.g. a removed benefit stays
  // removed), so those three fields are always re-pulled from the live
  // content instead of the plan's frozen copy. Undo/redo still uses
  // restoreSnapshot directly and is unaffected.
  const restoreSavedPlan = (s: any) => {
    restoreSnapshot(s);
    setOffersHeading(content.patient_benefits.title);
    setOfferIntro(content.patient_benefits.body);
    setOffers(content.patient_benefits.items.map((it, i) => ({ id: `o${i + 1}`, ...it })));
  };

  // ----- "Clear cache" — free memory after a long session / many exports -----
  // Repeated image/PDF exports and a deep undo history (each step is a full
  // JSON snapshot of the page, base64 photos included) are what make the tab
  // slowly run out of memory. This drops all of that in one click without
  // touching the current plan or any saved/auto-saved work.
  const [clearingCache, setClearingCache] = useState(false);
  const [cacheMsg, setCacheMsg] = useState<string | null>(null);
  const clearRuntimeCaches = async () => {
    setClearingCache(true);
    try {
      const dropped = clearHistory();

      // Release any export preview still held in memory (a multi-MB base64
      // JPEG for the plan image, a blob URL for the full-web PDF).
      setPngPreview(null);
      setFullPdfPreviewUrl((prev) => {
        if (prev) {
          try {
            URL.revokeObjectURL(prev.split("#")[0]!);
          } catch {
            /* ignore */
          }
        }
        return null;
      });

      // Clear the browser's Cache Storage (old build assets kept by the
      // service worker / preview host) — safe, they re-download on demand.
      try {
        if (typeof caches !== "undefined") {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        }
      } catch {
        /* not available / blocked — ignore */
      }

      // Hint the engine to collect now, if this build exposes it (most don't).
      try {
        (window as unknown as { gc?: () => void }).gc?.();
      } catch {
        /* ignore */
      }

      setCacheMsg(dropped > 0 ? `Freed ${dropped} step${dropped === 1 ? "" : "s"} ✓` : "Cleared ✓");
    } finally {
      setClearingCache(false);
      window.setTimeout(() => setCacheMsg(null), 4000);
    }
  };

  // Export / print file name: "[Name] - Personalized treatment plan"
  useEffect(() => {
    const scoped =
      printScope === "all"
        ? ""
        : ` (${toPlain(phases[Number(printScope)]?.title || `Phase ${Number(printScope) + 1}`)
            .split("—")[0]!
            .trim()})`;
    const fileName = `${displayName || "Patient"} - Personalized treatment plan${scoped}`;
    const original = document.title;
    const before = () => {
      document.title = fileName;
    };
    const after = () => {
      document.title = original;
    };
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", after);
    return () => {
      window.removeEventListener("beforeprint", before);
      window.removeEventListener("afterprint", after);
    };
  }, [displayName, printScope, phases]);

  return (
    <>
      <div id="web-root" ref={pageRootRef} className="min-h-screen bg-background text-foreground font-sans">
        {/* Undo / Redo */}
        <div className="no-print print:hidden fixed bottom-5 left-5 z-50 flex items-center gap-1 rounded-full bg-card/95 border border-border shadow-xl backdrop-blur px-2 py-1.5">
          <button
            onClick={undo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
            className="p-2 rounded-full text-primary disabled:opacity-30 hover:bg-primary/10 transition"
          >
            <Undo2 size={16} />
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            title="Redo (Ctrl+S or Ctrl+Shift+Z)"
            className="p-2 rounded-full text-primary disabled:opacity-30 hover:bg-primary/10 transition"
          >
            <Redo2 size={16} />
          </button>
        </div>

        {/* Top accent bar */}

        <div className="h-1.5 w-full bg-gradient-to-r from-primary via-accent to-primary no-print" />

        {/* Sticky toolbar */}
        <div className="no-print sticky top-0 z-30 backdrop-blur-xl bg-card/90 border-b border-border shadow-sm print:hidden">
          <div className="max-w-[2000px] mx-auto flex flex-wrap items-center gap-4 px-5 py-4">
            <div className="flex items-center gap-3">
              <EditableImage
                src={logoImg}
                onChange={setLogoImg}
                alt="Clinic logo"
                wrapperClassName="h-[46px] rounded-lg bg-primary/10 px-2.5 py-1.5 flex items-center justify-center"
                className="h-[36px] w-auto object-contain"
                rounded="rounded-lg"
              />
              <Editable value={clinicName} onChange={setClinicName} className="font-bold text-primary text-lg" />
            </div>
            <div className="ml-auto flex items-center gap-3.5 text-base">
              <div className="no-print print:hidden text-muted-foreground flex items-center gap-2 bg-muted px-4 py-2 rounded-full">
                <span className="font-semibold text-foreground">Live FX</span>
                <span className="text-sm">{ratesUpdatedAt ? `updated ${ratesUpdatedAt}` : "using fallback rates"}</span>
                <button
                  onClick={() => void refreshRates()}
                  disabled={ratesLoading}
                  className="text-primary hover:opacity-70 disabled:opacity-40"
                  title="Refresh exchange rates"
                >
                  <RotateCcw size={16} />
                </button>
              </div>

              <SavedPlansBar getSnapshot={() => undoSnapshot} restore={restoreSavedPlan} patientName={displayName} />

              {contentManager && (
                <Link
                  to="/content"
                  className="no-print print:hidden rounded-full border border-primary/40 px-4 py-2 text-sm font-semibold text-primary hover:bg-primary hover:text-primary-foreground"
                  title="Edit the clinic's default wording"
                >
                  Content
                </Link>
              )}

              <select
                value={printScope}
                onChange={(e) => setPrintScope(e.target.value)}
                title="Choose which phases to export"
                className="no-print print:hidden rounded-full border border-border bg-muted px-4 py-2 text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 max-w-[220px]"
              >
                <option value="all">All phases</option>
                {phases.map((ph, i) => (
                  <option key={ph.id} value={String(i)}>
                    {toPlain(ph.title).split("—")[0]!.trim() || `Phase ${i + 1}`} only
                  </option>
                ))}
              </select>

              <button
                onClick={() => void exportPlanPng("preview")}
                disabled={exportingPng}
                title="See exactly how the plan image(s) will look before downloading"
                className="no-print print:hidden px-5 py-2 rounded-full border border-primary text-primary font-semibold hover:bg-primary hover:text-primary-foreground transition disabled:opacity-60"
              >
                Preview plan image
              </button>

              <button
                onClick={() => void exportPlanPng()}
                disabled={exportingPng}
                title="Export the Treatment Plan and Special Offers as JPG images"
                className="px-5 py-2 rounded-full bg-primary text-primary-foreground font-semibold shadow-md shadow-primary/20 hover:brightness-110 transition disabled:opacity-60"
              >
                {exportingPng ? "Exporting…" : "Export plan image"}
              </button>

              <button
                onClick={() => void exportFullPdf("preview")}
                disabled={!!fullPdfStage}
                title="See exactly how the full web export will look before downloading — the page itself stays put, no visible resizing"
                className="no-print print:hidden px-5 py-2 rounded-full border border-primary text-primary font-semibold hover:bg-primary hover:text-primary-foreground transition disabled:opacity-60"
              >
                Preview full web
              </button>

              <button
                onClick={() => void exportFullPdf()}
                disabled={!!fullPdfStage}
                title="One continuous page capturing the whole site, top to bottom — to send to the customer. The page itself stays put, no visible resizing."
                className="px-5 py-2 rounded-full bg-primary text-primary-foreground font-semibold shadow-md shadow-primary/20 hover:brightness-110 transition disabled:opacity-60"
              >
                Export full web
              </button>

              <button
                onClick={() => void clearRuntimeCaches()}
                disabled={clearingCache}
                title="Frees memory after a long session or many exports: drops the undo history and any export preview. Your current plan and all saved / auto-saved work are kept."
                className="no-print print:hidden inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-border text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition disabled:opacity-60"
              >
                <Eraser size={15} />
                {clearingCache ? "Clearing…" : cacheMsg ?? "Clear cache"}
              </button>
            </div>
          </div>
        </div>

        {/* Plan PNG preview */}
        {pngPreview && (
          <div className="no-print print:hidden fixed inset-0 z-[999] flex flex-col bg-black/70 backdrop-blur-sm">
            <div className="flex items-center justify-between gap-3 border-b border-white/15 px-5 py-3">
              <p className="text-sm font-semibold text-white">Plan image preview — exactly what will be exported</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setPngPreview(null);
                    resetPlanColWidths();
                  }}
                  title="Reset the Service/Teeth column widths to default"
                  className="rounded-full border border-white/40 px-4 py-1.5 text-xs font-semibold text-white hover:bg-white/10"
                >
                  Reset columns &amp; close
                </button>
                <button
                  onClick={() => {
                    const cap = pngPreview;
                    setPngPreview(null);
                    downloadPlanPngCapture(cap);
                  }}
                  className="rounded-full bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground hover:brightness-110"
                >
                  Download image{pngPreview.images.length > 1 ? "s" : ""}
                </button>
                <button
                  onClick={() => setPngPreview(null)}
                  className="rounded-full border border-white/40 px-4 py-1.5 text-xs font-semibold text-white hover:bg-white/10"
                >
                  Close &amp; adjust columns
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-6 space-y-6">
              {pngPreview.images.map((img, i) => (
                <img
                  key={i}
                  src={img.dataUrl}
                  alt="Treatment plan image preview"
                  className="mx-auto w-full max-w-4xl rounded-lg bg-white shadow-2xl"
                />
              ))}
            </div>
          </div>
        )}

        {/* Full web preview */}
        {fullPdfPreviewUrl && (
          <div className="no-print print:hidden fixed inset-0 z-[999] flex flex-col bg-black/70 backdrop-blur-sm">
            <div className="flex items-center justify-between gap-3 border-b border-white/15 px-5 py-3">
              <p className="text-sm font-semibold text-white">Full web preview — exactly what will be exported</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setFullPdfPreviewUrl(null);
                    void exportFullPdf("download");
                  }}
                  className="rounded-full bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground hover:brightness-110"
                >
                  Download PDF
                </button>
                <button
                  onClick={() => setFullPdfPreviewUrl(null)}
                  className="rounded-full border border-white/40 px-4 py-1.5 text-xs font-semibold text-white hover:bg-white/10"
                >
                  Close
                </button>
              </div>
            </div>
            <div className="flex-1 bg-neutral-600">
              <iframe title="Full web preview" src={fullPdfPreviewUrl} className="w-full h-full border-0 bg-white" />
            </div>
          </div>
        )}

        {/* Hero */}
        <header className="pt-0 pb-8">
          <div className="no-print print:hidden flex justify-end px-6 pt-4">
            <Link
              to="/auth"
              search={{ next: "/content" }}
              className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-card px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary shadow-sm transition hover:bg-primary hover:text-primary-foreground"
            >
              <LogIn size={14} /> Sign in
            </Link>
          </div>
          <div
            ref={heroBoxRef}
            onMouseDown={onHeroMouseDown}
            style={{ height: heroHeight }}
            className={`print-hero group relative overflow-hidden w-full mb-10 shadow-2xl shadow-primary/15 select-none ${contentManager ? "cursor-grab active:cursor-grabbing" : ""}`}
          >
            <img
              src={heroImg}
              alt="Clinic hero"
              draggable={false}
              style={{
                objectFit: heroMediaStyle?.objectFit ?? "cover",
                objectPosition: `${heroPos.x}% ${heroPos.y}%`,
                transform: `scale(${heroZoom})`,
                transformOrigin: `${heroPos.x}% ${heroPos.y}%`,
              }}
              className="w-full h-full object-cover transition-transform duration-100 pointer-events-none"
            />

            {/* Toolbar (no-drag) — hero is shared clinic branding, so only a
                signed-in content manager can edit it here (writes straight
                through to the shared content row; see commitMediaContent). */}
            {contentManager && (
              <div
                data-no-drag
                className="absolute top-4 right-4 z-20 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition print:hidden"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => {
                    const z = Math.max(1, +(heroZoom - 0.1).toFixed(2));
                    const current = visibleMedia(content.hero_image.media)[0];
                    void commitMediaContent("hero_image", [
                      { ...current, url: heroImg, fit: current?.fit ?? "cover", position: `${heroPos.x}% ${heroPos.y}%`, zoom: z },
                    ]).then((ok) => ok && setHeroZoom(z));
                  }}
                  className="p-2 rounded-full bg-white/95 text-primary shadow-lg hover:bg-white"
                  aria-label="Zoom out"
                >
                  <ZoomOut size={15} />
                </button>
                <button
                  onClick={() => {
                    const z = Math.min(3, +(heroZoom + 0.1).toFixed(2));
                    const current = visibleMedia(content.hero_image.media)[0];
                    void commitMediaContent("hero_image", [
                      { ...current, url: heroImg, fit: current?.fit ?? "cover", position: `${heroPos.x}% ${heroPos.y}%`, zoom: z },
                    ]).then((ok) => ok && setHeroZoom(z));
                  }}
                  className="p-2 rounded-full bg-white/95 text-primary shadow-lg hover:bg-white"
                  aria-label="Zoom in"
                >
                  <ZoomIn size={15} />
                </button>
                <button
                  onClick={() => {
                    const current = visibleMedia(content.hero_image.media)[0];
                    void commitMediaContent("hero_image", [
                      { ...current, url: heroImg, fit: current?.fit ?? "cover", position: "50% 50%", zoom: 1 },
                    ]).then((ok) => {
                      if (ok) {
                        setHeroPos({ x: 50, y: 50 });
                        setHeroZoom(1);
                      }
                    });
                  }}
                  className="p-2 rounded-full bg-white/95 text-primary shadow-lg hover:bg-white"
                  aria-label="Reset position"
                >
                  <RotateCcw size={15} />
                </button>
                <label className="cursor-pointer flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/95 text-primary text-xs font-bold shadow-lg hover:bg-white">
                  <Upload size={14} /> Replace
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      e.currentTarget.value = "";
                      if (!f) return;
                      let uploaded: MediaItem;
                      try {
                        uploaded = await uploadClinicMedia(f);
                      } catch {
                        window.alert("Tải ảnh lên thất bại, vui lòng thử lại.");
                        return;
                      }
                      const media: MediaItem = { ...uploaded, position: `${heroPos.x}% ${heroPos.y}%`, zoom: heroZoom };
                      const ok = await commitMediaContent("hero_image", [media]);
                      if (ok) setHeroImg(media.url);
                    }}
                  />
                </label>
              </div>
            )}

            {/* Height resize handle */}
            <div
              data-no-drag
              onMouseDown={(e) => {
                e.stopPropagation();
                const startY = e.clientY;
                const startH = heroHeight;
                const move = (ev: MouseEvent) => {
                  setHeroHeight(Math.max(280, Math.min(800, startH + (ev.clientY - startY))));
                };
                const up = () => {
                  window.removeEventListener("mousemove", move);
                  window.removeEventListener("mouseup", up);
                };
                window.addEventListener("mousemove", move);
                window.addEventListener("mouseup", up);
              }}
              className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 w-20 h-2.5 rounded-full bg-white/80 hover:bg-white cursor-ns-resize opacity-0 group-hover:opacity-100 transition print:hidden shadow"
              title="Drag to resize height"
            />

            {/* Drag hint */}
            {contentManager && (
              <div className="absolute bottom-4 left-4 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/50 text-white text-xs font-semibold backdrop-blur opacity-0 group-hover:opacity-100 transition print:hidden">
                <Move size={12} /> Drag to reposition
              </div>
            )}
          </div>

          {/* Hero title — its own band under the photo, never overlapping faces */}
          <div className="bg-primary text-primary-foreground">
            <div className="max-w-[2000px] mx-auto px-8 md:px-14 py-10 md:py-14 flex flex-col items-center text-center">
              <Editable
                as="h1"
                value={heroTitle}
                onChange={setHeroTitle}
                className="block text-[2.75rem] md:text-[4.5rem] font-semibold leading-[1.1] tracking-tight max-w-4xl"
              />
            </div>
          </div>

          <div className="max-w-[2000px] mx-auto px-12 pb-24">
            <div className="grid gap-8 items-center p-8 md:p-12 rounded-[1.75rem] bg-[color-mix(in_oklab,var(--card)_92%,var(--secondary))] border border-border/70 shadow-[0_30px_60px_-40px_color-mix(in_oklab,var(--primary)_45%,transparent)] relative overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 bg-accent/10 rounded-full blur-3xl" />
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-5">
                  <span className="h-px w-8 bg-accent" aria-hidden />
                  <span className="text-[1.5rem] font-bold uppercase tracking-[0.28em] text-primary/70">
                    A message from your care team
                  </span>
                </div>
                <Editable
                  as="p"
                  value={greeting}
                  onChange={setGreeting}
                  className="print-text-3-5rem block text-[3.5rem] md:text-[4rem] font-bold tracking-tight text-primary"
                />
                <Editable
                  as="p"
                  value={letter}
                  onChange={setLetter}
                  multiline
                  className="print-text-2rem block mt-5 leading-relaxed text-muted-foreground whitespace-pre-wrap text-[2rem]"
                />
              </div>
            </div>
          </div>
        </header>

        {/* Your Journey - premium navigation */}
        <PatientJourneyNav
          heading={content.your_journey.title}
          intro={content.your_journey.body}
          steps={content.your_journey.items}
        />

        {/* Patient Form - overview style */}
        <section
          id="patient-information"
          className={`max-w-[2000px] mx-auto px-12 py-24 print:py-4 ${hasOverview ? "" : "print:hidden"}`}
        >
          <div className="relative bg-card rounded-[1.75rem] border border-border/70 p-8 md:p-12 shadow-[0_30px_60px_-40px_color-mix(in_oklab,var(--primary)_45%,transparent)] overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-accent to-transparent" />
            <div className="absolute -right-20 -top-20 w-64 h-64 bg-accent/5 rounded-full blur-3xl print:hidden" />
            <Watermark src={logoImg} alt="" />

            <div className="relative z-10">
              <SectionHeading
                eyebrow="Patient Record"
                title={<Editable as="span" value={formHeading} onChange={setFormHeading} className="block" />}
                className="mb-10"
              />

              {/* Underlined inputs */}
              <div className="space-y-5 text-foreground text-[2rem]">
                {[
                  ["fullName", "Full Name:"],
                  ["dob", "Date of Birth [dd/mm/yyyy]:"],
                  ["patientId", "Patient ID:"],
                  ["treatingDoctor", "Treating doctor:"],
                ].map(([key, label]) => (
                  <div
                    key={key}
                    className={`flex items-baseline gap-3 flex-wrap ${
                      toPlain((patient as any)[key] || "") ? "" : "print:hidden"
                    }`}
                  >
                    <label className="font-bold whitespace-nowrap text-primary/90">{label}</label>
                    <input
                      value={(patient as any)[key]}
                      onChange={(e) => setPatient({ ...patient, [key]: e.target.value })}
                      className="flex-1 min-w-[200px] bg-transparent outline-none border-b-2 border-dotted border-primary/40 focus:border-primary px-1 py-1 text-foreground print:hidden"
                    />
                    <span className="hidden print:inline-block flex-1 px-1 py-1 border-b-2 border-dotted border-primary/40 break-words">
                      {(patient as any)[key]}
                    </span>
                  </div>
                ))}

                {/* Sex */}
                <div className={`flex items-center gap-6 pt-2 ${patient.sex ? "" : "print:hidden"}`}>
                  <span className="font-bold text-primary/90">Sex:</span>
                  {(["Male", "Female"] as const).map((s) => (
                    <label
                      key={s}
                      className={`flex items-center gap-2 cursor-pointer select-none font-medium ${
                        patient.sex === s ? "" : "print:hidden"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={patient.sex === s}
                        onChange={() => setPatient({ ...patient, sex: patient.sex === s ? "" : s })}
                        className="w-6 h-6 accent-primary"
                      />
                      <span>{s}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* MEDICAL HISTORY */}
              <div className={`mt-12 ${hasHistory ? "" : "print:hidden"}`}>
                <button
                  type="button"
                  onClick={() => setHistoryOpen((v) => !v)}
                  className="w-full flex items-center justify-between group print:hidden"
                  aria-expanded={historyOpen}
                >
                  <Editable
                    as="h3"
                    value={historyHeading}
                    onChange={setHistoryHeading}
                    className="block text-[2rem] md:text-[2.25rem] font-bold tracking-tight text-primary mb-0"
                  />
                  <span className="text-primary/70 group-hover:text-primary transition">
                    {historyOpen ? <ChevronUp size={22} /> : <ChevronDown size={22} />}
                  </span>
                </button>
                <h3 className="hidden print:block text-xl md:text-2xl font-bold tracking-tight text-primary mb-5">
                  {historyHeading}
                </h3>
                <div className={`${historyOpen ? "block" : "hidden"} print:block`}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-3.5 pl-4 md:pl-10 text-[2rem]">
                    {historyItems.map((item, i) => (
                      <label
                        key={i}
                        className={`flex items-center gap-3 group ${historyChecked[item + i] ? "" : "print:hidden"}`}
                      >
                        <input
                          type="checkbox"
                          checked={!!historyChecked[item + i]}
                          onChange={(e) => setHistoryChecked({ ...historyChecked, [item + i]: e.target.checked })}
                          className="w-6 h-6 accent-primary"
                        />
                        <input
                          value={item}
                          onChange={(e) => {
                            const next = [...historyItems];
                            next[i] = e.target.value;
                            setHistoryItems(next);
                          }}
                          className="flex-1 bg-transparent outline-none focus:bg-muted rounded px-1 py-0.5"
                        />
                        <button
                          onClick={() => setHistoryItems(historyItems.filter((_, idx) => idx !== i))}
                          className="opacity-0 group-hover:opacity-100 text-destructive transition print:hidden"
                          aria-label="Remove"
                        >
                          <Trash2 size={14} />
                        </button>
                      </label>
                    ))}
                  </div>
                  <div className="pl-4 md:pl-10 mt-4 print:hidden">
                    <button
                      onClick={() => setHistoryItems([...historyItems, "New condition"])}
                      className="inline-flex items-center gap-1.5 text-sm font-bold text-primary hover:underline"
                    >
                      <Plus size={14} /> Add condition
                    </button>
                  </div>
                  <div
                    className={`flex items-baseline gap-3 mt-6 text-[2rem] ${toPlain(patient.othersHistory) ? "" : "print:hidden"}`}
                  >
                    <label className="font-bold whitespace-nowrap text-primary/90">Others:</label>
                    <input
                      value={patient.othersHistory}
                      onChange={(e) => setPatient({ ...patient, othersHistory: e.target.value })}
                      className="flex-1 bg-transparent outline-none border-b-2 border-dotted border-primary/40 focus:border-primary px-1 py-1 print:hidden"
                    />
                    <span className="hidden print:inline-block flex-1 px-1 py-1 border-b-2 border-dotted border-primary/40 break-words">
                      {patient.othersHistory}
                    </span>
                  </div>
                </div>
              </div>

              {/* MEDICATION ALLERGY */}
              <div
                className={`mt-12 print:break-before-page print:mt-0 print:pt-8 ${hasAllergy ? "" : "print:hidden"}`}
              >
                <button
                  type="button"
                  onClick={() => setAllergyOpen((v) => !v)}
                  className="w-full flex items-center justify-between group print:hidden"
                  aria-expanded={allergyOpen}
                >
                  <Editable
                    as="h3"
                    value={allergyHeading}
                    onChange={setAllergyHeading}
                    className="block text-[2rem] md:text-[2.25rem] font-bold tracking-tight text-primary mb-0"
                  />
                  <span className="text-primary/70 group-hover:text-primary transition">
                    {allergyOpen ? <ChevronUp size={22} /> : <ChevronDown size={22} />}
                  </span>
                </button>
                <h3 className="hidden print:block text-xl md:text-2xl font-bold tracking-tight text-primary mb-5">
                  {allergyHeading}
                </h3>
                <div className={`${allergyOpen ? "block" : "hidden"} print:block`}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-3.5 pl-4 md:pl-10 text-[2rem]">
                    {allergyItems.map((item, i) => (
                      <label
                        key={i}
                        className={`flex items-center gap-3 group ${allergyChecked[item + i] ? "" : "print:hidden"}`}
                      >
                        <input
                          type="checkbox"
                          checked={!!allergyChecked[item + i]}
                          onChange={(e) => setAllergyChecked({ ...allergyChecked, [item + i]: e.target.checked })}
                          className="w-6 h-6 accent-destructive"
                        />
                        <input
                          value={item}
                          onChange={(e) => {
                            const next = [...allergyItems];
                            next[i] = e.target.value;
                            setAllergyItems(next);
                          }}
                          className="flex-1 bg-transparent outline-none focus:bg-destructive/5 rounded px-1 py-0.5"
                        />
                        <button
                          onClick={() => setAllergyItems(allergyItems.filter((_, idx) => idx !== i))}
                          className="opacity-0 group-hover:opacity-100 text-destructive transition print:hidden"
                          aria-label="Remove"
                        >
                          <Trash2 size={14} />
                        </button>
                      </label>
                    ))}
                  </div>
                  <div className="pl-4 md:pl-10 mt-4 print:hidden">
                    <button
                      onClick={() => setAllergyItems([...allergyItems, "New allergy"])}
                      className="inline-flex items-center gap-1.5 text-sm font-bold text-destructive hover:underline"
                    >
                      <Plus size={14} /> Add allergy
                    </button>
                  </div>
                  <div
                    className={`flex items-baseline gap-3 mt-6 text-[2rem] ${toPlain(patient.othersAllergy) ? "" : "print:hidden"}`}
                  >
                    <label className="font-bold whitespace-nowrap text-primary/90">Others:</label>
                    <input
                      value={patient.othersAllergy}
                      onChange={(e) => setPatient({ ...patient, othersAllergy: e.target.value })}
                      className="flex-1 bg-transparent outline-none border-b-2 border-dotted border-primary/40 focus:border-primary px-1 py-1 print:hidden"
                    />
                    <span className="hidden print:inline-block flex-1 px-1 py-1 border-b-2 border-dotted border-primary/40 break-words">
                      {patient.othersAllergy}
                    </span>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className={`mt-12 text-[2rem] ${hasNotes ? "" : "print:hidden"}`}>
                <label className="block font-bold text-primary/90 mb-2">Additional notes:</label>
                <textarea
                  value={patient.notes}
                  onChange={(e) => setPatient({ ...patient, notes: e.target.value })}
                  rows={3}
                  className="w-full bg-transparent outline-none border-2 border-dotted border-primary/40 focus:border-primary rounded-xl px-4 py-3 resize-y print:hidden"
                />
                <div className="hidden print:block w-full border-2 border-dotted border-primary/40 rounded-xl px-4 py-3 whitespace-pre-wrap break-words leading-relaxed">
                  {patient.notes}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Decorative feature strip */}
        <section id="advanced-technology" className="max-w-[2000px] mx-auto px-12 py-24">
          <div
            className="relative overflow-hidden rounded-[1.75rem] text-white border border-white/10 shadow-[0_40px_80px_-24px_color-mix(in_oklab,var(--primary)_45%,transparent)]"
            style={{
              background:
                "linear-gradient(145deg, var(--primary) 0%, color-mix(in oklab, var(--primary) 55%, black) 100%)",
            }}
          >
            {/* Ambient accent */}
            <div className="absolute -top-32 -right-32 w-[420px] h-[420px] rounded-full bg-accent/15 blur-[120px]" />

            <div className="relative z-10 p-8 md:p-14 flex flex-col">
              <div className="flex flex-col md:flex-row gap-10 items-start">
                <div className="flex-1 min-w-0">
                  <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/20 backdrop-blur-xl mb-7">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-2 w-2 rounded-full bg-accent opacity-75 animate-ping print:hidden" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
                    </span>
                    <span className="text-[1.5rem] font-medium uppercase tracking-[0.28em] text-accent">
                      Advanced technology
                    </span>
                  </span>

                  <h3 className="text-[4.25rem] md:text-[6rem] font-light leading-[1.12] tracking-tight mb-5">
                    <RichText value={content.advanced_technology.title.split("|")[0] ?? ""} as="span" />{" "}
                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-white to-accent">
                      <RichText value={content.advanced_technology.title.split("|")[1] ?? ""} as="span" />
                    </span>
                  </h3>

                  <p className="print-text-2rem text-[1.375rem] md:text-[1.5rem] text-white/70 leading-relaxed max-w-3xl">
                    <RichText value={content.advanced_technology.body} as="span" />
                  </p>
                </div>
              </div>

              <div className="mt-10 mb-8 border-t border-white/10" />

              <div className="grid gap-5 sm:grid-cols-3">
                {content.advanced_technology.items
                  .map((c, ci) => ({
                    title: c.title,
                    icon: TECH_ICON_PATHS[ci % TECH_ICON_PATHS.length]!,
                    items: c.lines,
                  }))
                  .map((col) => (
                    <div
                      key={col.title}
                      className="group relative overflow-hidden rounded-2xl bg-white/5 border border-white/20 backdrop-blur-2xl px-5 py-5 break-inside-avoid transition-all duration-300 hover:bg-white/10 hover:border-accent/40"
                    >
                      <div className="flex items-center gap-3 mb-4">
                        <span className="p-2.5 rounded-lg bg-accent text-white shadow-[0_6px_16px_-4px_rgba(0,0,0,0.4)] shrink-0">
                          <svg
                            className="w-6 h-6"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                          >
                            {col.icon}
                          </svg>
                        </span>
                        <h4 className="print-text-2rem text-[2rem] font-bold tracking-wide leading-tight">
                          <RichText value={col.title} as="span" />
                        </h4>
                      </div>
                      <ul className="space-y-2.5">
                        {col.items.map((it) => (
                          <li
                            key={it}
                            className="print-text-2rem text-[2rem] font-medium text-white/70 leading-snug"
                          >
                            <RichText value={it} as="span" />
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
              </div>

              <div className="mt-8 flex flex-col md:flex-row gap-8 items-start">
                <div className="w-full md:basis-[36%] flex flex-col gap-5">
                  <div className="rounded-2xl bg-white/5 border border-white/10 p-2">
                    <img
                      src={techDcarerNavigation}
                      alt="DCarer Navigation — advanced technology for safer implants"
                      className="w-full h-auto rounded-xl block"
                    />
                  </div>
                  <div className="rounded-2xl bg-white/5 border border-white/10 p-2">
                    <img
                      src={techDigitalControl}
                      alt="Digital technology — precise planning and control"
                      className="w-full h-auto rounded-xl block"
                    />
                  </div>
                  <div className="flex-1 min-h-[100px] flex items-center justify-center">
                    <img
                      src={drCareLogo}
                      alt="Dr. Care Implant Clinic"
                      className="w-[180px] h-auto opacity-90"
                      style={{ filter: "brightness(0) invert(1)" }}
                    />
                  </div>
                </div>

                <div className="w-full md:flex-1 grid grid-cols-2 gap-5">
                  {[
                    { src: techSurgicalGuide, alt: "Implant Surgical Guide" },
                    { src: techPicSystem, alt: "PIC — Precise Implant Captures" },
                    { src: tech3ShapeScanner, alt: "3Shape 3D scanner" },
                    { src: techConebeamCt, alt: "Conebeam CT" },
                    { src: techAiNavigation, alt: "AI-guided implant navigation" },
                    { src: techCustomizedAbutment, alt: "100% customized abutment design" },
                  ].map((photo) => (
                    <div key={photo.alt} className="rounded-2xl bg-white/5 border border-white/10 p-2.5">
                      <img
                        src={photo.src}
                        alt={photo.alt}
                        className="w-full aspect-square object-cover rounded-xl block"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Custom image gallery */}
        <section id="visual-records" className="max-w-[2000px] mx-auto px-12 py-24">
          <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
            <div>
              <SectionHeading
                eyebrow="Visual records"
                title="Photos, X-rays & references"
                subtitle={
                  <span className="no-print print:hidden">
                    Upload any images you want to include — before/after photos, scans, notes.
                  </span>
                }
              />

              {gallery.length === 0 && (
                <p className="hidden print:block text-sm italic text-muted-foreground mt-3">Not taken</p>
              )}
            </div>
          </div>
          <div
            className={`grid gap-5 ${
              gallery.length <= 1
                ? "grid-cols-1"
                : gallery.length === 2
                  ? "grid-cols-1 md:grid-cols-2 print:grid-cols-2"
                  : "grid-cols-2 md:grid-cols-3 print:grid-cols-2"
            } ${gallery.length === 0 ? "print:hidden" : ""}`}
          >
            {gallery.map((src, i) => (
              <ImageSlot
                key={i}
                src={src}
                onChange={(u) => updateGallery(i, u)}
                onRemove={() => removeGallery(i)}
                aspect={gallery.length === 1 ? "aspect-[21/9]" : gallery.length === 2 ? "aspect-[4/3]" : "aspect-video"}
                contain
              />
            ))}
            <div className="no-print contents">
              <ImageSlot
                src={null}
                onChange={addGallery}
                onRemove={() => {}}
                label="Add photo"
                aspect={gallery.length === 0 ? "aspect-[21/9]" : "aspect-video"}
              />
            </div>
          </div>
        </section>

        {/* DIAGNOSIS / current situation */}
        <section id="diagnosis" className="max-w-[2000px] mx-auto px-12 py-24">
          <div
            ref={diagnosisRef}
            className="relative overflow-hidden rounded-[1.75rem] border border-primary/12 shadow-[0_30px_60px_-40px_color-mix(in_oklab,var(--primary)_45%,transparent)]"
          >
            <div className="relative overflow-hidden bg-primary px-8 md:px-12 py-8 md:py-10">
              <div
                className="absolute -top-16 -right-16 w-[240px] h-[240px] rounded-full bg-accent/25 blur-[90px]"
                aria-hidden
              />
              <div className="relative flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <span className="h-px w-8 bg-accent" aria-hidden />
                    <Editable
                      as="span"
                      value={dxKicker}
                      onChange={setDxKicker}
                      className="block text-[1.5rem] font-bold uppercase tracking-[0.28em] text-white/70"
                    />
                  </div>
                  <Editable
                    as="h3"
                    value={dxHeading}
                    onChange={setDxHeading}
                    className="block text-[4.25rem] md:text-[5.5rem] font-bold tracking-tight text-white leading-[1.12] mt-4"
                  />
                </div>

                <button
                  type="button"
                  onClick={exportDiagnosisPng}
                  disabled={exportingDxPng}
                  className="no-print shrink-0 inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-white/20 bg-white/15 text-white text-[2rem] font-semibold shadow-sm hover:bg-white/25 disabled:opacity-60 print:hidden"
                  title="Export the Diagnosis section as an image"
                >
                  <Download size={28} /> {exportingDxPng ? "Exporting…" : "Export"}
                </button>
              </div>
            </div>

            <div className="bg-card p-8 md:p-12">

            {/* Summary */}
            <div className="border-b border-primary/15 py-4">
              <div className="flex items-center gap-3">
                <Editable
                  as="h4"
                  value={dxSummaryTitle}
                  onChange={setDxSummaryTitle}
                  className="flex-1 min-w-0 text-[2rem] font-bold text-primary"
                />
                <button
                  onClick={() => setDxOpen({ ...dxOpen, summary: !dxOpen.summary })}
                  className="text-primary/60 print:hidden"
                  aria-label="Toggle"
                >
                  {dxOpen.summary ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
              </div>
              {dxOpen.summary && (
                <Editable
                  as="div"
                  value={dxSummary}
                  onChange={setDxSummary}
                  multiline
                  className="block mt-2 w-full pl-8 leading-relaxed text-[2rem] whitespace-pre-wrap break-words"
                />
              )}
            </div>

            {/* Tooth chart + per-tooth conditions */}
            <div className="border-b border-primary/15 py-4">
              <div className="flex items-center gap-3">
                <Editable
                  as="h4"
                  value={chartTitle}
                  onChange={setChartTitle}
                  className="flex-1 min-w-0 text-[2rem] font-bold text-primary"
                />
                <button
                  onClick={() => setDxOpen({ ...dxOpen, chart: !dxOpen.chart })}
                  className="text-primary/60 print:hidden"
                  aria-label="Toggle"
                >
                  {dxOpen.chart ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
              </div>

              {dxOpen.chart && (
                <div className="mt-4">
                  <ToothChart
                    marked={new Set(toothNotes.flatMap((t) => parseTokens(t.n).flatMap(expandToken)))}
                    onToggle={(n) => {
                      const existingIdx = toothNotes.findIndex((t) =>
                        parseTokens(t.n)
                          .flatMap(expandToken)
                          .some((x) => x === n),
                      );
                      if (existingIdx >= 0) {
                        const note = toothNotes[existingIdx];
                        const remaining = parseTokens(note.n)
                          .flatMap(expandToken)
                          .filter((x) => x !== n);
                        const next = [...toothNotes];
                        if (remaining.length === 0) {
                          next.splice(existingIdx, 1);
                        } else {
                          next[existingIdx] = { ...note, n: remaining.join(", ") };
                        }
                        setToothNotes(next);
                      } else {
                        setToothNotes([...toothNotes, { n, s: "", t: "" }]);
                      }
                    }}
                  />

                  <div className="mt-5 overflow-x-auto">
                    <table className="w-full text-[2rem] border-collapse">
                      <thead>
                        <tr className="border-b border-primary/25 text-left text-[1.25rem] font-bold uppercase tracking-wide text-primary/70">
                          <th className="py-2 pr-3 w-24">Tooth</th>
                          <th className="py-2 pr-3">Issues</th>
                          <th className="py-2 pr-3">Treatments</th>
                          <th
                            className={`py-2 pr-3 w-56${
                              toothNotes.some((x) => (x.note ?? "").trim()) ? "" : " print:hidden"
                            }`}
                          >
                            Note
                          </th>
                          <th className="py-2 w-8 print:hidden" />
                        </tr>
                      </thead>
                      <tbody>
                        {toothNotes.map((t, i) => (
                          <tr key={i} className="group border-b border-primary/10 align-top">
                            <td className="py-1.5 pr-3 min-w-[110px]">
                              <ToothNumberPicker
                                value={t.n}
                                printAlign="text-left"
                                onChange={(n) => {
                                  const next = [...toothNotes];
                                  next[i] = { ...next[i], n };
                                  setToothNotes(next);
                                }}
                              />
                            </td>
                            <td className="py-2 pr-3">
                              <TagMultiSelect
                                value={parseList(t.s)}
                                onChange={(v) => {
                                  const next = [...toothNotes];
                                  next[i] = { ...next[i], s: joinList(v) };
                                  setToothNotes(next);
                                }}
                                options={ISSUE_OPTIONS}
                                addLabel="Add Issue"
                                placeholder="Search issues…"
                              />
                            </td>
                            <td className="py-2 pr-3">
                              <TagMultiSelect
                                value={parseList(t.t)}
                                onChange={(v) => {
                                  const next = [...toothNotes];
                                  next[i] = { ...next[i], t: joinList(v) };
                                  setToothNotes(next);
                                }}
                                groups={TREATMENT_GROUPS}
                                addLabel="Add Treatment"
                                placeholder="Search treatments…"
                              />
                            </td>

                            <td
                              className={`py-2 pr-3 align-top${
                                toothNotes.some((x) => (x.note ?? "").trim()) ? "" : " print:hidden"
                              }`}
                            >
                              <input
                                value={t.note ?? ""}
                                onChange={(e) => {
                                  const next = [...toothNotes];
                                  next[i] = { ...next[i], note: e.target.value };
                                  setToothNotes(next);
                                }}
                                placeholder="Add note…"
                                className="w-full bg-transparent outline-none rounded px-1 py-0.5 focus:bg-primary/5 print:hidden"
                              />
                              <span className="hidden print:block dx-print-text break-words">{t.note ?? ""}</span>
                            </td>

                            <td className="py-1.5 print:hidden">
                              <button
                                onClick={() => setToothNotes(toothNotes.filter((_, x) => x !== i))}
                                className="opacity-0 group-hover:opacity-100 text-destructive transition"
                                aria-label="Remove"
                              >
                                <Trash2 size={13} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-3 print:hidden">
                    <button
                      onClick={() => setToothNotes([...toothNotes, { n: "", s: "", t: "" }])}
                      className="inline-flex items-center gap-1.5 text-sm font-bold text-primary hover:underline"
                    >
                      <Plus size={14} /> Add tooth
                    </button>
                  </div>
                </div>
              )}
            </div>
            </div>
          </div>
        </section>

        {/* Treatment plan */}
        <section
          id="treatment-plan"
          ref={planRef}
          className="mx-auto px-12 py-24 bg-background"
          style={
            // A short plan behaves as before — capped at the base width but
            // never forced wider than the viewport. A long plan needs an
            // *explicit* width (not just max-width) to actually render wider
            // than the browser window — max-width alone only ever shrinks a
            // box, it can't force one to grow past its container/viewport.
            planRowCount > PLAN_ROW_THRESHOLD ? { width: planMaxWidth } : { maxWidth: planMaxWidth }
          }
        >
          {pngTitle && (
            <div className="png-only mb-4 w-full box-border rounded-[1.5rem] bg-primary px-6 py-5 text-center text-[3.5rem] font-bold text-primary-foreground">
              {pngTitle}
            </div>
          )}

          <div className="plan-head-row flex items-end justify-between mb-8 gap-4 flex-wrap">
            <div className="plan-head-col">
              <SectionHeading
                eyebrow="The solution for you"
                title={<Editable as="span" value={treatmentPlanHeading} onChange={setTreatmentPlanHeading} />}
                subtitle={
                  displayName ? (
                    <span className="text-foreground whitespace-nowrap">{displayName} — Personalized Treatment Plan</span>
                  ) : undefined
                }
              />
              {toPlain(treatmentPlanIntro) && (
                <Editable
                  as="p"
                  value={treatmentPlanIntro}
                  onChange={setTreatmentPlanIntro}
                  multiline
                  className="block mt-3 max-w-3xl text-[2rem] md:text-[2rem] leading-relaxed text-muted-foreground"
                />
              )}
            </div>
            <div className="no-print flex items-center gap-3 print:hidden">
              <Popover open={converterOpen} onOpenChange={setConverterOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-border bg-card text-foreground text-[2rem] font-semibold shadow-sm hover:bg-muted"
                    title="Quick currency converter"
                  >
                    <ArrowLeftRight size={28} /> Convert
                  </button>
                </PopoverTrigger>
                {/* Portal-rendered, so wrapped in its own scaled box (like the
                    service-search dropdown / Saved plans popover) instead of
                    relying on PopoverContent's own sizing — otherwise this
                    shrinks to an illegible size whenever the page is zoomed
                    way out to see the full treatment plan at once. */}
                <PopoverContent align="end" className="w-auto border-0 bg-transparent p-0 shadow-none print:hidden">
                  <div
                    className="w-72 bg-popover text-popover-foreground border border-border rounded-lg shadow-2xl p-4 space-y-3"
                    style={
                      converterZoomScale > 1
                        ? { transform: `scale(${converterZoomScale})`, transformOrigin: "top right" }
                        : undefined
                    }
                  >
                    <div className="text-sm font-semibold text-foreground">Currency converter</div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={fmtStrNum(converterAmount, 2)}
                        onChange={(e) => setConverterAmount(e.target.value.replace(/,/g, ""))}
                        className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm"
                        placeholder="Amount"
                      />
                      <select
                        value={converterFrom}
                        onChange={(e) => setConverterFrom(e.target.value)}
                        className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                      >
                        {converterCurrencyCodes.map((code) => (
                          <option key={code} value={code}>
                            {code}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center justify-center">
                      <button
                        type="button"
                        onClick={swapConverterCurrencies}
                        className="rounded-full border border-border p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                        aria-label="Swap currencies"
                        title="Swap"
                      >
                        <ArrowLeftRight size={14} className="rotate-90" />
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="w-full rounded-md border border-border bg-muted/40 px-3 py-1.5 text-sm font-semibold">
                        {converterResult === null ? "—" : fmtNum(converterResult, converterTo === "VND" ? 0 : 2)}
                      </div>
                      <select
                        value={converterTo}
                        onChange={(e) => setConverterTo(e.target.value)}
                        className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                      >
                        {converterCurrencyCodes.map((code) => (
                          <option key={code} value={code}>
                            {code}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="text-xs text-muted-foreground">
                      {ratesLoading
                        ? "Updating live rates…"
                        : ratesUpdatedAt
                          ? `Live rates as of ${ratesUpdatedAt}`
                          : "Using fallback rates"}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              <button
                onClick={addPhase}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-primary-foreground text-[2rem] font-semibold shadow-lg shadow-primary/20 hover:brightness-110"
              >
                <Plus size={28} /> Add phase
              </button>
            </div>
          </div>

          <div className="no-print print:hidden -mt-4 mb-5 flex items-center gap-2 text-[1.5rem] text-muted-foreground">
            <span>Tip: drag the edge of the "Service" or "Teeth" header to resize those columns.</span>
            <button
              onClick={resetPlanColWidths}
              className="rounded-full border border-border px-2.5 py-0.5 font-semibold text-foreground hover:bg-muted"
            >
              Reset columns
            </button>
          </div>

          <div className="space-y-5">
            {phases.map((phase, pi) => {
              const phaseVnd = phase.rows.reduce((s, r) => s + rowVnd(r), 0);
              return (
                <div
                  key={phase.id}
                  data-export={inScope(pi) ? "show" : "hide"}
                  className={`space-y-5 ${inScope(pi) ? "" : "print:hidden"}`}
                >
                  <div
                    data-plan-phase-card
                    className="relative rounded-[1.5rem] border border-border bg-card overflow-hidden shadow-lg shadow-primary/5 avoid-break"
                  >
                    {pi === 0 && <Watermark src={logoImg} alt="" />}
                    <div className="relative z-10">
                      <div className="flex items-center gap-4 px-6 py-5 bg-primary text-white rounded-t-[1.5rem]">
                        {(() => {
                          const { base, timeline } = splitPhaseTitle(phase.title);
                          const isPreset = PHASE_TIMELINE_OPTIONS.includes(normalizeDashes(timeline));
                          const isCustom =
                            (!!timeline && !isPreset) || !!customTimelinePhases[phase.id];
                          return (
                            <div className="flex-1 min-w-0 flex items-center flex-nowrap gap-x-2 overflow-x-auto">
                              <Editable
                                value={base}
                                onChange={(v) => updatePhase(phase.id, { title: composePhaseTitle(v, timeline) })}
                                className="font-bold text-[2.5rem] whitespace-nowrap"
                                toolbar={false}
                              />
                              <span className="hidden print:inline font-bold text-[2.5rem]">
                                {timeline ? ` (${timeline})` : ""}
                              </span>
                              <span className="no-print print:hidden inline-flex items-center gap-1.5 font-bold text-[2.5rem] whitespace-nowrap shrink-0">
                                {timeline || isCustom ? <span>(</span> : null}
                                <select
                                  value={isCustom ? PHASE_TIMELINE_CUSTOM : timeline ? normalizeDashes(timeline) : ""}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    if (v === PHASE_TIMELINE_CUSTOM) {
                                      // Switch to manual entry; keep any existing text as the starting point.
                                      setCustomTimelinePhases((o) => ({ ...o, [phase.id]: true }));
                                      return;
                                    }
                                    setCustomTimelinePhases((o) => ({ ...o, [phase.id]: false }));
                                    updatePhase(phase.id, { title: composePhaseTitle(base, v) });
                                  }}
                                  title="Timeline"
                                  className="bg-white/10 border border-white/25 rounded-full px-2.5 py-0.5 text-[2rem] font-semibold text-white outline-none cursor-pointer [&>option]:text-foreground"
                                >
                                  <option value="">No timeline</option>
                                  {PHASE_TIMELINE_OPTIONS.map((o) => (
                                    <option key={o} value={o}>
                                      {o}
                                    </option>
                                  ))}
                                  <option value={PHASE_TIMELINE_CUSTOM}>Nhập tay…</option>
                                </select>
                                {isCustom && (
                                  <Editable
                                    value={timeline}
                                    onChange={(v) => updatePhase(phase.id, { title: composePhaseTitle(base, v) })}
                                    className="min-w-[3.5rem] px-1 border-b border-white/40 text-[2rem] font-semibold text-white whitespace-nowrap"
                                    toolbar={false}
                                    placeholder="vd: 20-25 days"
                                  />
                                )}
                                {timeline || isCustom ? <span>)</span> : null}
                              </span>
                            </div>
                          );
                        })()}
                        <div className="no-print print:hidden flex items-center gap-0.5" data-export="hide">
                          <button
                            onClick={() => setOpenPhases((o) => ({ ...o, [phase.id]: !isOpen(phase.id) }))}
                            className="p-2 rounded-full hover:bg-white/15"
                            aria-label="Toggle"
                          >
                            {isOpen(phase.id) ? <ChevronUp size={32} /> : <ChevronDown size={32} />}
                          </button>
                          <button
                            onClick={() => removePhase(phase.id)}
                            className="p-2 rounded-full hover:bg-white/15"
                            aria-label="Remove phase"
                          >
                            <Trash2 size={28} />
                          </button>
                        </div>
                      </div>

                      {isOpen(phase.id) && (
                        <div>
                          <div className="overflow-x-auto print:overflow-visible rounded-[1.5rem]">
                            <table className="plan-table w-full text-[2.25rem] print:text-[11px] print:table-fixed">
                              <thead>
                                <tr className="text-left bg-primary text-primary-foreground text-[2.25rem] uppercase tracking-wide">
                                  <th className="w-6 print:hidden bg-primary" />
                                  <th className="py-2.5 px-2 font-bold w-20 text-center align-middle">Step</th>
                                  <th
                                    style={{ width: planColWidths.service }}
                                    className="plan-col-service py-2.5 px-3 font-bold align-middle relative group/resize text-center"
                                  >
                                    Service
                                    <span
                                      onMouseDown={(e) => startPlanColResize(e, "service")}
                                      title="Drag to resize the Service column"
                                      className="no-print print:hidden absolute top-0 right-0 h-full w-2.5 -mr-1 cursor-col-resize z-10 flex items-center justify-center opacity-0 group-hover/resize:opacity-100 hover:opacity-100"
                                    >
                                      <span className="h-2/3 w-[3px] rounded-full bg-white/60" />
                                    </span>
                                  </th>
                                  <th
                                    style={{ width: planColWidths.teeth }}
                                    className="plan-col-teeth py-2.5 px-3 font-bold text-center align-middle relative group/resize"
                                  >
                                    Teeth
                                    <span
                                      onMouseDown={(e) => startPlanColResize(e, "teeth")}
                                      title="Drag to resize the Teeth column"
                                      className="no-print print:hidden absolute top-0 right-0 h-full w-2.5 -mr-1 cursor-col-resize z-10 flex items-center justify-center opacity-0 group-hover/resize:opacity-100 hover:opacity-100"
                                    >
                                      <span className="h-2/3 w-[3px] rounded-full bg-white/60" />
                                    </span>
                                  </th>
                                  <th className="py-2.5 px-3 font-bold w-20 text-center align-middle">Qty</th>
                                  <th className="py-2.5 px-3 font-bold w-40 text-center align-middle">Unit price</th>
                                  <th className="py-2.5 px-3 font-bold w-40 text-center align-middle">
                                    Discount / unit
                                  </th>

                                  {cols.map((col) => (
                                    <th
                                      key={col.id}
                                      draggable
                                      onDragStart={() => setDragCol(col.id)}
                                      onDragOver={(e) => e.preventDefault()}
                                      onDrop={() => {
                                        if (dragCol) moveCol(dragCol, col.id);
                                        setDragCol(null);
                                      }}
                                      onDragEnd={() => setDragCol(null)}
                                      title="Drag to reorder column"
                                      style={{ width: AMOUNT_COL_WIDTH }}
                                      className={`plan-col-amount py-3 px-3 font-bold text-center align-middle cursor-move ${
                                        dragCol === col.id ? "opacity-50" : ""
                                      }`}
                                    >
                                      <span className="inline-flex items-center gap-1 justify-center group/col">
                                        <GripVertical
                                          size={12}
                                          className="opacity-0 group-hover/col:opacity-60 print:hidden"
                                        />
                                        {col.kind === "fx" ? (
                                          <>
                                            <span className="print:inline hidden font-bold">{col.label}</span>
                                            <select
                                              value={col.currency ?? "AUD"}
                                              onChange={(e) => setColCurrency(col.id, e.target.value)}
                                              className="print:hidden bg-transparent outline-none font-bold text-inherit cursor-pointer [&>option]:text-foreground"
                                              title="Change currency"
                                            >
                                              {Array.from(
                                                new Set([
                                                  ...CURRENCY_CODES,
                                                  ...(col.currency ? [col.currency] : []),
                                                ]),
                                              ).map((c) => (
                                                <option key={c} value={c}>
                                                  {c}
                                                </option>
                                              ))}
                                            </select>
                                          </>
                                        ) : (
                                          <Editable
                                            value={col.label}
                                            onChange={(v) => updateCol(col.id, v)}
                                            className="font-bold"
                                            toolbar={false}
                                          />
                                        )}

                                        <button
                                          onClick={() => removeCol(col.id)}
                                          className="opacity-0 group-hover/col:opacity-100 focus:opacity-100 text-destructive transition print:hidden"
                                          aria-label={`Remove column ${col.label}`}
                                        >
                                          <X size={12} />
                                        </button>
                                      </span>
                                    </th>
                                  ))}

                                  <th className="w-8 print:hidden bg-primary text-primary-foreground">
                                    <button
                                      onClick={addCol}
                                      className="p-1.5 rounded-full text-primary-foreground hover:bg-primary-foreground/20 transition"
                                      aria-label="Add column"
                                      title="Add column"
                                    >
                                      <Plus size={14} />
                                    </button>
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {phase.rows.map((row, ri) => {
                                  return (
                                    <tr
                                      key={row.id}
                                      onDragOver={(e) => e.preventDefault()}
                                      onDrop={() => {
                                        if (dragRow && dragRow.phaseId === phase.id)
                                          moveRow(phase.id, dragRow.rowId, row.id);
                                        setDragRow(null);
                                      }}
                                      className={`group align-top hover:bg-muted/40 transition-colors ${
                                        dragRow?.rowId === row.id ? "opacity-50" : ""
                                      }`}
                                    >
                                      <td className="w-6 align-middle print:hidden">
                                        <span
                                          draggable
                                          onDragStart={() => setDragRow({ phaseId: phase.id, rowId: row.id })}
                                          onDragEnd={() => setDragRow(null)}
                                          title="Drag to reorder row"
                                          className="flex justify-center cursor-grab active:cursor-grabbing text-muted-foreground opacity-0 group-hover:opacity-70"
                                        >
                                          <GripVertical size={14} />
                                        </span>
                                      </td>
                                      <td className="py-2 px-2 text-center tabular-nums text-muted-foreground align-middle">
                                        {ri + 1}
                                      </td>
                                      <td className="plan-col-service py-3 px-3 text-[2.5rem]" style={{ width: planColWidths.service, minWidth: 0 }}>
                                        <ServiceCombobox
                                          value={row.name}
                                          onFreeText={(v) =>
                                            updateRow(phase.id, row.id, {
                                              name: v,
                                              ...(isInPackageService(v)
                                                ? { unitVnd: null, discount: 0, vnd: undefined, fx: undefined }
                                                : {}),
                                            })
                                          }
                                          onPick={(item) => {
                                            const free = isInPackageService(item.name);
                                            updateRow(phase.id, row.id, {
                                              name: item.name,
                                              unitVnd: free
                                                ? null
                                                : isRemovablePartialDenture(item.name)
                                                  ? RPD_BASE_VND
                                                  : item.priceVnd,
                                              vnd: undefined,
                                              fx: undefined,
                                            });
                                            applyAutoRows(phase.id, item.name, row.tooth);
                                          }}
                                          catalog={catalog.items}
                                          onAddCatalog={catalog.add}
                                          onUpdateCatalog={catalog.update}
                                          onRemoveCatalog={catalog.remove}
                                        />
                                      </td>
                                      <td
                                        className="plan-col-teeth py-3 px-3 print:px-2 print:text-center align-middle"
                                        style={{ width: planColWidths.teeth, minWidth: 0 }}
                                      >
                                        <ToothNumberPicker
                                          value={row.tooth}
                                          className=""
                                          printClassName=""
                                          onChange={(tooth) => {
                                            updateRow(phase.id, row.id, {
                                              tooth,
                                              qty: row.qtyManual ? row.qty : Math.max(1, countTeeth(tooth)),
                                              // Free-typed/edited tooth numbers stick — the plan rule
                                              // stops overwriting this row's tooth field from here on,
                                              // but keeps following the qty (unless that's also manual).
                                              toothManual: true,
                                            });
                                            applyAutoRows(phase.id, row.name, tooth);
                                          }}
                                        />
                                      </td>
                                      <td className="py-3 px-3 text-center">
                                        <input
                                          type="number"
                                          min={0}
                                          value={row.qty}
                                          onChange={(e) =>
                                            updateRow(phase.id, row.id, {
                                              qty: Number(e.target.value),
                                              // Typed quantity sticks — the plan rule stops
                                              // recomputing qty for this row from the tooth count.
                                              qtyManual: true,
                                            })
                                          }
                                          className="w-16 text-center bg-transparent outline-none border-b border-transparent focus:border-primary print:hidden"
                                        />
                                        <span className="hidden print:block tabular-nums">{row.qty}</span>
                                      </td>
                                      <td className="py-2 px-2 text-center">
                                        <input
                                          type="text"
                                          inputMode="numeric"
                                          value={
                                            row.unitVnd === null || row.unitVnd === undefined ? "" : fmtInt(row.unitVnd)
                                          }
                                          placeholder="In package"
                                          onChange={(e) => {
                                            const digits = e.target.value.replace(/[^\d]/g, "");
                                            updateRow(phase.id, row.id, {
                                              unitVnd: digits === "" ? null : Number(digits),
                                              vnd: undefined,
                                              fx: undefined,
                                            });
                                          }}
                                          className="w-40 text-center bg-transparent outline-none border-b border-dotted border-border focus:border-primary tabular-nums print:hidden"
                                        />

                                        <span className="hidden print:block tabular-nums whitespace-nowrap">
                                          {row.unitVnd === null ? "In package" : fmtInt(row.unitVnd)}
                                        </span>
                                      </td>
                                      <td className="py-2 px-2 text-center">
                                        <input
                                          type="text"
                                          inputMode="numeric"
                                          value={row.discount ? fmtInt(row.discount) : ""}
                                          placeholder="0"
                                          onChange={(e) =>
                                            updateRow(phase.id, row.id, {
                                              discount: Number(e.target.value.replace(/[^\d]/g, "")) || 0,
                                            })
                                          }
                                          className="w-32 text-center bg-transparent outline-none border-b border-dotted border-border focus:border-primary print:hidden"
                                        />
                                        <span className="hidden print:block tabular-nums">
                                          {row.discount ? fmtInt(row.discount) : "—"}
                                        </span>
                                      </td>
                                      {cols.map((col) => (
                                        <td key={col.id} className="py-2 px-2 text-center">
                                          {col.kind === "vnd" && (
                                            <>
                                              <input
                                                type="text"
                                                value={
                                                  row.vnd !== undefined
                                                    ? fmtStrNum(row.vnd)
                                                    : row.unitVnd === null
                                                      ? ""
                                                      : fmtInt(computeVnd(row))
                                                }
                                                placeholder={row.unitVnd === null ? "In package" : "—"}
                                                onChange={(e) => updateRow(phase.id, row.id, { vnd: e.target.value })}
                                                className="w-40 text-center bg-transparent outline-none border-b border-dotted border-border focus:border-primary print:hidden"
                                              />
                                              <span className="hidden print:block tabular-nums whitespace-nowrap">
                                                {row.vnd !== undefined
                                                  ? fmtStrNum(row.vnd)
                                                  : row.unitVnd === null
                                                    ? "In package"
                                                    : fmtInt(computeVnd(row))}
                                              </span>
                                            </>
                                          )}
                                          {col.kind === "fx" && (
                                            <>
                                              <input
                                                type="text"
                                                value={
                                                  row.fx?.[col.id] !== undefined
                                                    ? fmtStrNum(row.fx[col.id], 2)
                                                    : row.unitVnd === null
                                                      ? ""
                                                      : fmtNum(rowFx(row, col))
                                                }
                                                placeholder={row.unitVnd === null ? "In package" : "—"}
                                                onChange={(e) =>
                                                  updateRow(phase.id, row.id, {
                                                    fx: { ...(row.fx ?? {}), [col.id]: e.target.value },
                                                  })
                                                }
                                                className="w-32 text-center bg-transparent outline-none border-b border-dotted border-border focus:border-primary print:hidden"
                                              />
                                              <span className="hidden print:block tabular-nums whitespace-nowrap">
                                                {row.fx?.[col.id] !== undefined
                                                  ? fmtStrNum(row.fx[col.id], 2)
                                                  : row.unitVnd === null
                                                    ? "In package"
                                                    : fmtNum(rowFx(row, col))}
                                              </span>
                                            </>
                                          )}
                                          {col.kind === "custom" && (
                                            <>
                                              <input
                                                type="text"
                                                value={fmtStrNum(row.extra?.[col.id] ?? "", 2)}
                                                placeholder="—"
                                                onChange={(e) =>
                                                  updateRow(phase.id, row.id, {
                                                    extra: { ...(row.extra ?? {}), [col.id]: e.target.value },
                                                  })
                                                }
                                                className="w-32 text-center bg-transparent outline-none border-b border-dotted border-border focus:border-primary print:hidden"
                                              />
                                              <span className="hidden print:block break-words">
                                                {fmtStrNum(row.extra?.[col.id] ?? "", 2) || "—"}
                                              </span>
                                            </>
                                          )}
                                        </td>
                                      ))}
                                      <td className="py-3 px-3 text-right print:hidden border-0">
                                        <button
                                          onClick={() => removeRow(phase.id, row.id)}
                                          className="opacity-0 group-hover:opacity-100 transition p-1.5 rounded-full hover:bg-destructive/10 text-destructive"
                                          aria-label="Remove row"
                                        >
                                          <Trash2 size={14} />
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                              <tfoot>
                                <tr className="bg-secondary font-bold text-foreground text-[3rem]">
                                  <td className="py-3 px-3 print:hidden border-0" />
                                  <td className="py-2.5 px-3 text-center" colSpan={6}>
                                    {toPlain(phase.title).split("—")[0]!.trim() || `Phase ${pi + 1}`}&apos;s Total
                                  </td>

                                  {cols.map((col) => (
                                    <td key={col.id} className="py-3 px-3 text-center">
                                      {col.kind === "vnd" && fmtInt(phaseVnd)}
                                      {col.kind === "fx" && fmtNum(phaseVnd * (rates[col.currency ?? "AUD"] ?? 0))}
                                    </td>
                                  ))}
                                  <td className="print:hidden border-0" />
                                </tr>
                              </tfoot>
                            </table>
                          </div>

                          <div className="flex items-center justify-between mt-4 px-4 pb-4 print:hidden">
                            <button
                              onClick={() => addRow(phase.id)}
                              className="inline-flex items-center gap-2 text-[2rem] text-primary hover:text-primary/80 font-bold"
                            >
                              <Plus size={28} /> Add treatment row
                            </button>
                            <div className="text-[1.5rem] text-muted-foreground bg-muted px-3 py-1 rounded-full">
                              Tip: Qty follows the tooth numbers · foreign amounts use live rates · every cell can be
                              overridden
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {pi === 0 && (
                    <>
                  {/* Hotel support: manual deductions under Phase 1, subtracted from the grand total */}
                  <div
                    data-plan-phase-card
                    className={`avoid-break rounded-2xl border-2 border-primary/30 bg-card shadow-lg overflow-hidden ${
                      hotelSupports.length === 0 || printScope !== "all" ? "print:hidden" : ""
                    } ${hotelSupports.length === 0 ? "png-hide" : ""}`}
                  >
                    {hotelSupports.length > 0 && (
                      <div>
                        {hotelSupports.map((h) => (
                          <div
                            key={h.id}
                            className="grid items-center border-b border-primary/15 last:border-b-0"
                            style={{ gridTemplateColumns: `minmax(0,1fr) repeat(${cols.length}, minmax(22rem, 34rem))` }}
                          >
                            <div className="px-6 py-3 flex items-center gap-3">
                              <input
                                type="text"
                                value={h.label}
                                onChange={(e) => updateHotelSupport(h.id, { label: e.target.value })}
                                className="flex-1 min-w-0 bg-transparent outline-none border-b border-dotted border-border focus:border-primary text-[1.75rem] md:text-[2rem] font-semibold text-foreground print:hidden"
                              />
                              <span className="hidden print:inline text-[1.75rem] md:text-[2rem] font-semibold text-foreground">
                                {h.label}
                              </span>
                              <button
                                type="button"
                                onClick={() => removeHotelSupport(h.id)}
                                title="Remove hotel support"
                                className="print:hidden shrink-0 text-muted-foreground hover:text-destructive"
                              >
                                <Trash2 size={20} />
                              </button>
                            </div>
                            {cols.map((col) => (
                              <div
                                key={col.id}
                                className="px-4 py-3 text-center tabular-nums text-[1.75rem] md:text-[2rem] text-destructive font-semibold border-l-2 border-primary/15"
                              >
                                {col.kind === "vnd" && (
                                  <>
                                    <span>−</span>
                                    <input
                                      type="text"
                                      inputMode="numeric"
                                      value={h.vnd ? fmtInt(h.vnd) : ""}
                                      placeholder="0"
                                      onChange={(e) =>
                                        updateHotelSupport(h.id, { vnd: Number(e.target.value.replace(/[^\d]/g, "")) || 0 })
                                      }
                                      className="w-52 text-center bg-transparent outline-none border-b border-dotted border-border focus:border-primary print:hidden"
                                    />
                                    <span className="hidden print:inline">{fmtInt(h.vnd || 0)}</span>
                                  </>
                                )}
                                {col.kind === "fx" && `−${fmtNum((h.vnd || 0) * (rates[col.currency ?? "AUD"] ?? 0))}`}
                                {col.kind === "custom" && "—"}
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center justify-between px-4 py-4 print:hidden png-hide">
                      <button
                        type="button"
                        onClick={addHotelSupport}
                        className="inline-flex items-center gap-2 text-[2rem] text-primary hover:text-primary/80 font-bold"
                      >
                        <Plus size={28} /> Add hotel support
                      </button>
                      <div className="text-[1.5rem] text-muted-foreground bg-muted px-3 py-1 rounded-full">
                        Tip: amount is deducted from the TOTAL below · the phase prices stay unchanged
                      </div>
                    </div>
                  </div>
                    </>
                  )}

                  {/* Note between this phase and the next (e.g. healing time) */}
                  {pi < phases.length - 1 && (
                    <div className="avoid-break rounded-2xl border-2 border-dashed border-accent/50 bg-accent/10 px-6 py-4 flex items-start gap-3">
                      <span className="mt-0.5 shrink-0 inline-flex items-center px-2.5 py-1 rounded-full bg-accent text-accent-foreground text-[1.375rem] font-bold uppercase tracking-wider">
                        Between phases
                      </span>
                      <Editable
                        value={
                          phase.note ??
                          "Healing Period (3–6 months): The implant is left undisturbed to allow natural bone integration (osseointegration), creating a stable foundation for the final restoration. Healing duration varies according to bone quality, implant stability, and individual healing capacity."
                        }
                        onChange={(v) => updatePhase(phase.id, { note: v })}
                        className="flex-1 font-semibold text-foreground text-[2rem]"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Grand total */}
          <div
            data-plan-phase-card
            className="mt-8 avoid-break border-[3px] border-primary rounded-2xl overflow-hidden shadow-2xl"
          >
            <div
              className="grid rounded-t-xl"
              style={{ gridTemplateColumns: `minmax(0,1fr) repeat(${cols.length}, minmax(22rem, 34rem))` }}
            >
              <div className="bg-[color-mix(in_oklab,var(--accent)_45%,white)] text-foreground font-extrabold uppercase tracking-[0.18em] px-6 py-5 text-[3.5rem] md:text-[5rem] rounded-tl-xl flex items-center justify-center text-center">
                Total
              </div>
              {cols.map((col, ci) => (
                <div
                  key={col.id}
                  className={`bg-[color-mix(in_oklab,var(--accent)_45%,white)] text-foreground text-center px-4 py-4 tabular-nums border-l-2 border-primary/30 ${ci === cols.length - 1 ? "rounded-tr-xl" : ""}`}
                >
                  <div className="text-[1.5rem] md:text-[1.75rem] font-extrabold uppercase tracking-[0.18em] text-primary/90">
                    {col.label}
                  </div>
                  <div className="font-extrabold text-[3.5rem] md:text-[4.5rem] leading-tight text-primary whitespace-nowrap">
                    <span className="scope-live print:hidden">
                      {col.kind === "vnd" && fmtInt(grandTotals.vnd)}
                      {col.kind === "fx" && fmtNum(grandFx(col))}
                      {col.kind === "custom" && "—"}
                    </span>
                    <span className="scope-print hidden print:inline">
                      {col.kind === "vnd" && fmtInt(scopedVnd)}
                      {col.kind === "fx" && fmtNum(scopedFx(col))}
                      {col.kind === "custom" && "—"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="bg-card px-5 py-3 text-primary font-bold italic text-[1.25rem] md:text-[1.5rem] border-t-2 border-primary">
              *Note: This treatment plan and the estimated costs are based on the doctor&apos;s assessment of the
              current condition and will be finalized after the in-person examination.
            </div>
            {cols.some((c) => c.kind === "fx") && (
              <div className="bg-card px-5 pb-4 text-[1.25rem] md:text-[1.375rem] text-muted-foreground rounded-b-xl">
                Foreign-currency amounts are converted from VND using live exchange rates
                {ratesUpdatedAt ? ` (updated ${ratesUpdatedAt})` : ""}. At this time:{" "}
                {cols
                  .filter((c) => c.kind === "fx" && (rates[c.currency ?? "AUD"] ?? 0) > 0)
                  .map((c) => {
                    const code = c.currency ?? "AUD";
                    return `1 ${code} ≈ ${fmtInt(Math.round(1 / (rates[code] ?? 1)))} VND`;
                  })
                  .join(" · ")}
                .
              </div>
            )}
          </div>

          {/* Important notes — never included in the PNG export */}
          <div
            ref={notesRef}
            className="png-hide mt-8 avoid-break rounded-2xl border-2 border-primary/25 bg-card shadow-lg overflow-hidden"
          >
            <div className="bg-primary text-primary-foreground px-6 py-4 flex items-center justify-between gap-4">
              <span className="font-medium uppercase tracking-[0.28em] text-[1.5rem] md:text-[1.75rem]">
                <RichText value={content.medical_disclaimer.title} as="span" />
              </span>
              <button
                type="button"
                onClick={() => {
                  const text = [
                    toPlain(content.medical_disclaimer.title).toUpperCase(),
                    "",
                    ...content.medical_disclaimer.items.flatMap((n) => [toPlain(n.title), n.lines.join(" "), ""]),
                  ]
                    .join("\n")
                    .trim();
                  copyToClipboard(text, setNotesCopied);
                }}
                className="no-print print:hidden shrink-0 inline-flex items-center gap-1.5 rounded-full bg-white/15 hover:bg-white/25 px-3 py-1.5 text-[1.1rem] font-medium transition-colors"
                aria-label="Copy important notes to send to patient"
              >
                {notesCopied ? <Check size={16} /> : <Copy size={16} />}
                {notesCopied ? "Copied" : "Copy"}
              </button>
            </div>

            <div className="p-6 flex flex-col gap-4">
              {content.medical_disclaimer.items
                .map((n, ni) => ({
                  Icon: NOTE_ICONS[ni % NOTE_ICONS.length]!,
                  title: n.title,
                  body: n.lines.join(" "),
                }))
                .map((n) => (
                  <div
                    key={n.title}
                    className="avoid-break group relative overflow-hidden rounded-[1.25rem] border border-primary/15 bg-gradient-to-r from-secondary/40 to-card px-5 py-4 flex items-start gap-4 shadow-sm"
                  >
                    <span className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-primary to-accent" />
                    <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/20">
                      <n.Icon size={20} />
                    </span>
                    <div className="min-w-0">
                      <RichText
                        value={n.title}
                        className="font-semibold text-primary text-[2rem] md:text-[2.25rem] tracking-tight"
                      />
                      <RichText value={n.body} className="mt-1 text-[1.75rem] md:text-[2rem] leading-relaxed text-foreground/85" />
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Special offers — shown inline in the PNG export unless they'd push the image past the allowed frame height */}
          {pngSeparateOffers ? null : (
            <div className="png-only mt-8">{renderPngOffers(pngOfferItems, 0, true, pngOffersListRef)}</div>
          )}
        </section>

        {/* Standalone PNG page: the complete special-offer list */}
        <div
          className="png-only"
          style={{ position: "fixed", left: "-20000px", top: 0, width: pngOffersWidth }}
          aria-hidden
        >
          <div ref={pngOffers2Ref} className="bg-background" style={{ padding: "24px", width: "100%" }}>
            {pngSeparateOffers ? renderPngOffers(pngOfferItems, 0, true) : null}
          </div>
        </div>

        {/* Special offers */}
        <section id="special-offers" className="max-w-[2000px] mx-auto px-12 py-24">
          <div className="relative overflow-hidden rounded-[1.75rem] border border-accent/30 shadow-[0_30px_60px_-40px_color-mix(in_oklab,var(--primary)_45%,transparent)] avoid-break">
            <div className="relative overflow-hidden bg-primary px-8 md:px-10 py-7 md:py-9">
              <div
                className="absolute -top-16 -right-16 w-[240px] h-[240px] rounded-full bg-accent/25 blur-[90px]"
                aria-hidden
              />
              <div
                role="button"
                tabIndex={0}
                onClick={() => setOffersOpen((o) => !o)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setOffersOpen((o) => !o);
                  }
                }}
                aria-expanded={offersOpen}
                className="relative w-full flex items-start justify-between gap-4 text-left cursor-pointer"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-3 mb-5">
                    <span className="h-px w-8 bg-accent" aria-hidden />
                    <span className="text-[1.5rem] font-bold uppercase tracking-[0.28em] text-white/70">
                      Patient benefits
                    </span>
                  </div>
                  <h2 className="text-[4.25rem] md:text-[5.5rem] font-bold tracking-tight text-white leading-[1.12] uppercase">
                    <span onClick={(e) => e.stopPropagation()} className="inline-flex">
                      <Editable value={offersHeading} onChange={setOffersHeading} />
                    </span>
                  </h2>
                </div>

                <div className="no-print print:hidden shrink-0 flex items-center gap-2 mt-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      let n = 0;
                      const body = offers
                        .map((o) => {
                          const isConditions = /package\s*conditions/i.test(toPlain(o.title));
                          if (!isConditions) n += 1;
                          const cleanTitle = toPlain(stripLeadingNumber(o.title));
                          const prefix = isConditions ? "" : `${n}. `;
                          const lines = o.lines.map((l) => toPlain(l)).filter(Boolean);
                          return [`${prefix}${cleanTitle}`, ...lines].join("\n");
                        })
                        .join("\n\n");
                      const text = [toPlain(offersHeading).toUpperCase(), "", toPlain(offerIntro), "", body]
                        .join("\n")
                        .trim();
                      copyToClipboard(text, setOffersCopied);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-full bg-white/15 hover:bg-white/25 text-white px-3 py-1.5 text-[1.1rem] font-medium transition-colors"
                    aria-label="Copy patient benefits to send to patient"
                  >
                    {offersCopied ? <Check size={16} /> : <Copy size={16} />}
                    {offersCopied ? "Copied" : "Copy"}
                  </button>
                  <span className="text-white">
                    {offersOpen ? <ChevronUp size={22} /> : <ChevronDown size={22} />}
                  </span>
                </div>
              </div>
            </div>

            <div className="relative overflow-hidden bg-[color-mix(in_oklab,var(--accent)_8%,var(--card))] p-8 md:p-10">
            <Watermark src={logoImg} alt="" />
            <div className="relative z-10">

            <div className={`${offersOpen ? "block" : "hidden"} print:block mt-4`}>
              <div
                className="no-print print:hidden mb-5 flex flex-wrap items-center gap-4"
                onClick={(e) => e.stopPropagation()}
              >
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" className="text-sm font-bold text-accent">
                    + Add item
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-80 max-h-80 overflow-y-auto">
                  {offerPresetsLive.map((preset, i) => (
                    <DropdownMenuItem
                      key={i}
                      onSelect={() =>
                        setOffers((p) => [
                          ...p,
                          { id: crypto.randomUUID(), title: preset.title, lines: [...preset.lines] },
                        ])
                      }
                      className="whitespace-normal"
                    >
                      {stripLeadingNumber(preset.title)}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() =>
                      setOffers((p) => [
                        ...p,
                        { id: crypto.randomUUID(), title: "FREE New benefit:", lines: ["Detail"] },
                      ])
                    }
                  >
                    + Blank custom item
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" className="text-sm font-bold text-primary/70">
                    Apply offer case ▾
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-80">
                  {offerCasesLive.map((c, i) => (
                    <DropdownMenuItem
                      key={i}
                      onSelect={() => {
                        if (
                          offers.length > 0 &&
                          !confirm(`Replace the ${offers.length} current benefit(s) with "${c.label}"?`)
                        ) {
                          return;
                        }
                        setOffers(
                          c.items.map((it, j) => ({ id: crypto.randomUUID() + "-" + j, title: it.title, lines: [...it.lines] })),
                        );
                      }}
                      className="whitespace-normal"
                    >
                      {c.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              </div>
              <p className="text-[2rem] md:text-[2rem] text-foreground leading-relaxed">
                <Editable value={offerIntro} onChange={setOfferIntro} />
              </p>
              <ol className="mt-6 space-y-5">
                {(() => {
                  let n = 0;
                  return offers.map((o) => {
                    const isConditions = /package\s*conditions/i.test(toPlain(o.title));
                    if (!isConditions) n += 1;
                    const num = n;
                    const cleanTitle = stripLeadingNumber(o.title);
                    return (
                      <li
                        key={o.id}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => {
                          if (dragOffer) moveOffer(dragOffer, o.id);
                          setDragOffer(null);
                        }}
                        className={`avoid-break group relative rounded-2xl bg-card border border-border p-5 pr-10 pl-11 transition-opacity ${
                          dragOffer === o.id ? "opacity-50" : ""
                        }`}
                      >
                        <span
                          draggable
                          onDragStart={() => setDragOffer(o.id)}
                          onDragEnd={() => setDragOffer(null)}
                          title="Drag to reorder"
                          className="no-print print:hidden absolute left-3 top-5 cursor-grab active:cursor-grabbing text-muted-foreground opacity-0 group-hover:opacity-70"
                        >
                          <GripVertical size={16} />
                        </span>
                        <div className="flex items-start gap-3">
                          {!isConditions && (
                            <span className="shrink-0 w-10 h-10 rounded-full bg-accent text-accent-foreground text-[1.25rem] font-bold inline-flex items-center justify-center">
                              {num}
                            </span>
                          )}
                          <div className="flex-1">
                            <h3 className="font-semibold text-primary text-[2rem]">
                              <Editable
                                value={cleanTitle}
                                onChange={(v) =>
                                  setOffers((p) => p.map((x) => (x.id === o.id ? { ...x, title: v } : x)))
                                }
                              />
                            </h3>

                            <ul className="mt-2 space-y-1.5">
                              {o.lines.map((ln, li) => (
                                <li
                                  key={li}
                                  className="text-[2rem] text-foreground leading-relaxed"
                                >
                                  <Editable
                                    value={ln.replace(/(?:\s|<br\s*\/?>)+$/i, "")}
                                    onChange={(v) =>
                                      setOffers((p) =>
                                        p.map((x) =>
                                          x.id === o.id
                                            ? { ...x, lines: x.lines.map((l, j) => (j === li ? v : l)) }
                                            : x,
                                        ),
                                      )
                                    }
                                    className="flex-1"
                                    toolbar={false}
                                  />
                                  <button
                                    onClick={() =>
                                      setOffers((p) =>
                                        p.map((x) =>
                                          x.id === o.id ? { ...x, lines: x.lines.filter((_, j) => j !== li) } : x,
                                        ),
                                      )
                                    }
                                    className="no-print print:hidden opacity-0 group-hover:opacity-100 text-destructive"
                                    aria-label="Remove line"
                                  >
                                    <X size={12} />
                                  </button>
                                </li>
                              ))}
                            </ul>
                            <button
                              onClick={() =>
                                setOffers((p) =>
                                  p.map((x) => (x.id === o.id ? { ...x, lines: [...x.lines, "New detail"] } : x)),
                                )
                              }
                              className="no-print print:hidden mt-2 text-xs font-semibold text-accent"
                            >
                              + Add line
                            </button>
                          </div>
                        </div>
                        <button
                          onClick={() => setOffers((p) => p.filter((x) => x.id !== o.id))}
                          className="no-print print:hidden absolute top-3 right-3 p-1.5 rounded-full bg-background text-destructive opacity-0 group-hover:opacity-100 transition"
                          aria-label="Remove offer"
                        >
                          <X size={14} />
                        </button>
                      </li>
                    );
                  });
                })()}
              </ol>
            </div>
            </div>
            </div>
          </div>
        </section>

        {/* Implant price list images */}
        <section
          className={`max-w-[2000px] mx-auto px-12 py-24 print:break-before-page ${
            selectedPriceLists.length === 0 && priceSheets.length === 0 ? "print:hidden print:break-before-auto" : ""
          }`}
        >
          <SectionHeading
            eyebrow="Quotation"
            title={<Editable value={priceSheetTitle} onChange={setPriceSheetTitle} />}
            subtitle={<Editable value={priceSheetNote} onChange={setPriceSheetNote} />}
            className="max-w-none"
          />
          <div className="no-print print:hidden flex flex-wrap gap-2 mt-6">
            {priceLists.map((p) => {
              const on = selectedPriceLists.includes(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() =>
                    setSelectedPriceLists((s) => (s.includes(p.id) ? s.filter((x) => x !== p.id) : [...s, p.id]))
                  }
                  className={`px-4 py-2 rounded-full text-sm font-semibold border transition ${
                    on
                      ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20"
                      : "bg-card text-foreground border-border hover:border-primary/50"
                  }`}
                  title={p.description}
                >
                  {on ? <Check size={14} className="inline mr-1.5 -mt-0.5" /> : null}
                  {p.title}
                </button>
              );
            })}
          </div>

          <div className="mt-6 space-y-10">
            {priceLists.filter((p) => selectedPriceLists.includes(p.id)).map((p) => {
              const pages = p.pages
                .filter((url) => !!url)
                .filter((url) => !(removedPriceListPages[p.id] ?? []).includes(url));
              const removePage = (url: string) =>
                setRemovedPriceListPages((prev) => ({
                  ...prev,
                  [p.id]: [...(prev[p.id] ?? []), url],
                }));
              return (
                <div key={p.id} className="print:break-before-page">
                  <h3 className="text-[1.75rem] font-medium uppercase tracking-[0.28em] text-primary/70 mb-3">{p.title}</h3>
                  <div className="space-y-4">
                    {pages.map((url, i) => (
                      <div key={url} className="relative group avoid-break print:break-inside-avoid space-y-4">
                        {isPdfUrl(url) ? (
                          <PdfPages
                            url={url}
                            alt={`${p.title} — page ${i + 1}`}
                            className="w-full rounded-xl border border-border shadow-sm print:mx-auto print:max-h-[245mm] print:w-auto print:border-0 print:shadow-none"
                          />
                        ) : (
                          <img
                            src={url}
                            alt={`${p.title} — page ${i + 1}`}
                            loading="lazy"
                            className="w-full rounded-xl border border-border shadow-sm print:mx-auto print:max-h-[245mm] print:w-auto print:border-0 print:shadow-none"
                          />
                        )}
                        <button
                          type="button"
                          onClick={() => removePage(url)}
                          className="no-print absolute top-3 right-3 p-1.5 rounded-full bg-white/95 text-destructive shadow opacity-0 group-hover:opacity-100 transition print:hidden"
                          aria-label={`Remove ${p.title} page ${i + 1}`}
                          title="Remove this image"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                  {(removedPriceListPages[p.id] ?? []).length > 0 && (
                    <button
                      type="button"
                      onClick={() => setRemovedPriceListPages((prev) => ({ ...prev, [p.id]: [] }))}
                      className="no-print print:hidden mt-3 text-[11px] font-medium text-muted-foreground hover:text-primary underline underline-offset-2"
                    >
                      Restore {(removedPriceListPages[p.id] ?? []).length} removed image
                      {(removedPriceListPages[p.id] ?? []).length > 1 ? "s" : ""}
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-6 space-y-6">
            {priceSheets.map((src, i) => (
              <div key={i} className="relative group avoid-break print:break-inside-avoid">
                <EditableImage
                  src={src}
                  onChange={(u) => setPriceSheets((p) => p.map((s, j) => (j === i ? u : s)))}
                  wrapperClassName="w-full border border-border shadow-xl print:border-0 print:shadow-none"
                  className="w-full h-auto object-contain print:mx-auto print:max-h-[245mm] print:w-auto"
                  rounded="rounded-2xl"
                />
                <button
                  onClick={() => setPriceSheets((p) => p.filter((_, j) => j !== i))}
                  className="no-print absolute top-3 right-3 p-1.5 rounded-full bg-white/95 text-destructive shadow opacity-0 group-hover:opacity-100 transition print:hidden"
                  aria-label="Remove price sheet"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
            <div className="no-print print:hidden">
              <ImageSlot
                src={null}
                onChange={(u) => setPriceSheets((p) => [...p, u])}
                onRemove={() => {}}
                label="Insert implant price list image"
                aspect="aspect-[16/6]"
              />
            </div>
          </div>
        </section>

        {/* Dental implant procedure */}
        <section id="implant-procedure" className="max-w-[2000px] mx-auto px-12 py-24">
          <div className="rounded-[1.75rem] border border-border/70 bg-card shadow-[0_30px_60px_-40px_color-mix(in_oklab,var(--primary)_45%,transparent)] overflow-hidden avoid-break">
            <div className="grid md:grid-cols-2">
              <div className="p-8 md:p-12">
                <SectionHeading eyebrow="Step by step" title="Dental Implant Procedure" className="max-w-none" />
                <p className="mt-6 text-[2rem] leading-relaxed text-muted-foreground">
                  Dental implant placement is a procedure in which a Titanium implant post is surgically inserted
                  into the jawbone to replace the root of a missing tooth. Once the bone has successfully
                  integrated with the implant surface, the dentist proceeds with attaching a prosthetic
                  restoration, such as a dental crown, bridge, or denture, ensuring a stable, non-slip fit within
                  the mouth.
                </p>
                <div className="mt-8 flex flex-col gap-3">
                  <img
                    src={procedureConsultation}
                    alt="Consultation and treatment planning"
                    className="w-full aspect-[3/2] object-cover rounded-2xl"
                  />
                  <img
                    src={procedureChairside}
                    alt="Chairside X-ray review before treatment"
                    className="w-full aspect-[3/2] object-cover rounded-2xl"
                  />
                  <img
                    src={procedureSurgery}
                    alt="Implant placement surgery"
                    className="w-full aspect-[3/2] object-cover rounded-2xl"
                  />
                </div>
              </div>

              <div className="relative overflow-hidden bg-primary text-white p-8 md:p-12 flex flex-col">
                <div className="absolute -top-24 -right-24 w-[320px] h-[320px] rounded-full bg-accent/20 blur-[100px]" aria-hidden />
                <div className="absolute -bottom-24 -left-24 w-[280px] h-[280px] rounded-full bg-white/10 blur-[100px]" aria-hidden />
                <div className="relative flex-1 flex flex-col justify-between">
                  <div className="absolute left-5 top-5 bottom-5 w-px bg-white/20" aria-hidden />
                  {[
                    {
                      title: "Initial Consultation and Treatment Planning",
                      duration: "50 - 60 mins",
                      body: "Comprehensive dental check-up and treatment planning using Implant Studio / Nobel Clinician software.",
                    },
                    {
                      title: "Implant Placement Surgery",
                      duration: "20 - 30 mins",
                      body: "Precisely place the implant fixture into the jawbone as per the treatment plan.",
                    },
                    {
                      title: "Follow-Up & Suture Removal",
                      duration: "20 - 30 mins",
                      body: "Post-surgical check-up and removal of sutures after 7–10 days.",
                    },
                    {
                      title: "Follow-Up & Dental Impression",
                      duration: "20 - 30 mins",
                      body: "Re-examination and taking an impression for the custom porcelain crown after 3 months.",
                    },
                    {
                      title: "Abutment & Temporary Crown Placement",
                      duration: "60 mins",
                      body: "Attaching the abutment and placing a temporary dental crown after 3 days.",
                    },
                    {
                      title: "Final Crown Placement & Completion",
                      duration: "60 mins",
                      body: "Place the permanent porcelain crown on the implant after 3–5 days. Treatment completed.",
                    },
                  ].map((step, i) => (
                    <div key={step.title} className="relative flex gap-5">
                      <span className="relative z-10 shrink-0 w-10 h-10 rounded-full bg-white text-primary font-bold text-[1.5rem] flex items-center justify-center">
                        {i + 1}
                      </span>
                      <div className="flex-1 pt-0.5">
                        <h4 className="font-bold text-[2rem] leading-tight">{step.title}</h4>
                        <span className="inline-block mt-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-white/85 text-[1.25rem] font-medium">
                          {step.duration}
                        </span>
                        <div className="h-px bg-white/20 my-3" />
                        <p className="text-white/80 text-[1.75rem] leading-relaxed">{step.body}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Clinic information */}
        <section id="our-clinic" className="max-w-[2000px] mx-auto px-12 py-24">
          <div className="rounded-[1.75rem] border border-border/70 bg-card shadow-[0_30px_60px_-40px_color-mix(in_oklab,var(--primary)_45%,transparent)] p-8 md:p-12 avoid-break">
            <SectionHeading
              eyebrow="Our clinic"
              title={<Editable value={clinicInfo.title} onChange={(v) => setClinicInfo((c) => ({ ...c, title: v }))} />}
              subtitle={
                <Editable value={clinicInfo.blurb} onChange={(v) => setClinicInfo((c) => ({ ...c, blurb: v }))} />
              }
              className="max-w-none"
            />
            <div className="grid sm:grid-cols-2 gap-3 mt-6 text-[2rem] font-medium text-foreground">
              <div className="flex items-start gap-3 rounded-xl bg-muted border border-border px-4 py-3">
                <span className="shrink-0 mt-0.5 p-2 rounded-lg bg-accent text-white shadow-[0_6px_16px_-4px_rgba(0,0,0,0.3)]">
                  <MapPin size={18} />
                </span>
                <Editable value={clinicInfo.address} onChange={(v) => setClinicInfo((c) => ({ ...c, address: v }))} />
              </div>
              <div className="flex items-start gap-3 rounded-xl bg-muted border border-border px-4 py-3">
                <span className="shrink-0 mt-0.5 p-2 rounded-lg bg-accent text-white shadow-[0_6px_16px_-4px_rgba(0,0,0,0.3)]">
                  <Phone size={18} />
                </span>
                <PhoneLink value={clinicInfo.phone} onChange={(v) => setClinicInfo((c) => ({ ...c, phone: v }))} />
              </div>
              <div className="flex items-start gap-3 rounded-xl bg-muted border border-border px-4 py-3">
                <span className="shrink-0 mt-0.5 p-2 rounded-lg bg-accent text-white shadow-[0_6px_16px_-4px_rgba(0,0,0,0.3)]">
                  <Mail size={18} />
                </span>
                <Editable value={clinicInfo.email} onChange={(v) => setClinicInfo((c) => ({ ...c, email: v }))} />
              </div>
              <div className="flex items-start gap-3 rounded-xl bg-muted border border-border px-4 py-3">
                <span className="shrink-0 mt-0.5 p-2 rounded-lg bg-accent text-white shadow-[0_6px_16px_-4px_rgba(0,0,0,0.3)]">
                  <Globe size={18} />
                </span>
                <Editable value={clinicInfo.website} onChange={(v) => setClinicInfo((c) => ({ ...c, website: v }))} />
              </div>
              <div className="flex items-start gap-3 rounded-xl bg-muted border border-border px-4 py-3 sm:col-span-2">
                <span className="shrink-0 mt-0.5 p-2 rounded-lg bg-accent text-white shadow-[0_6px_16px_-4px_rgba(0,0,0,0.3)]">
                  <Clock size={18} />
                </span>
                <Editable value={clinicInfo.hours} onChange={(v) => setClinicInfo((c) => ({ ...c, hours: v }))} />
              </div>
            </div>

            <div className="mt-4 flex items-center gap-3">
              {(
                [
                  { Icon: Facebook, label: "Facebook" },
                  { Icon: Twitter, label: "Twitter / X" },
                  { Icon: Youtube, label: "YouTube" },
                  { Icon: Instagram, label: "Instagram" },
                  { Icon: PinterestIcon, label: "Pinterest" },
                ] as const
              ).map(({ Icon, label }) => (
                <a
                  key={label}
                  href="#"
                  onClick={(e) => e.preventDefault()}
                  aria-label={label}
                  title={`${label} (add link later)`}
                  className="no-print print:hidden inline-flex h-10 w-10 items-center justify-center rounded-full bg-accent text-white hover:brightness-110 transition"
                >
                  <Icon size={18} />
                </a>
              ))}
            </div>

            <div className="mt-8 flex items-center gap-2 no-print print:hidden">
              <span className="text-[11px] font-medium uppercase tracking-[0.28em] text-primary/70">Photo layout</span>
              {(
                [
                  { k: "row", l: "One row" },
                  { k: "two", l: "2 columns" },
                  { k: "three", l: "3 columns" },
                  { k: "collage", l: "Collage (layered)" },
                ] as const
              ).map((o) => (
                <button
                  key={o.k}
                  type="button"
                  onClick={async () => {
                    if (await commitClinicPhotos(clinicPhotos, o.k)) setClinicLayout(o.k);
                  }}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    clinicLayout === o.k
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border hover:border-primary hover:text-primary"
                  }`}
                >
                  {o.l}
                </button>
              ))}
            </div>

            {clinicLayout === "collage" ? (
              <div className="clinic-print-gallery is-collage mt-3">
                <PhotoCollage items={clinicPhotos.map((src) => ({ url: src }))} ratio="16 / 10" />
                <div className="no-print print:hidden mt-2 flex flex-wrap gap-1.5">
                  {clinicPhotos.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={async () => {
                        const next = clinicPhotos.filter((_, j) => j !== i);
                        if (await commitClinicPhotos(next)) setClinicPhotos(next);
                      }}
                      className="rounded-full border border-border px-2.5 py-1 text-[11px] font-medium hover:border-destructive hover:text-destructive"
                    >
                      Remove photo {i + 1}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div
                className={`clinic-print-gallery mt-3 gap-2 print:gap-0 ${
                  clinicLayout === "row"
                    ? "grid"
                    : clinicLayout === "two"
                      ? "grid grid-cols-2"
                      : "grid grid-cols-2 md:grid-cols-3"
                }`}
                style={
                  clinicLayout === "row"
                    ? { gridTemplateColumns: `repeat(${Math.max(clinicPhotos.length, 1)}, minmax(0, 1fr))` }
                    : undefined
                }
              >
                {clinicPhotos.map((src, i) => (
                  <div className="clinic-print-photo" key={i}>
                    <ImageSlot
                      src={src}
                      onChange={async (dataUrl) => {
                        if (!ensureContentManager()) return;
                        let url: string;
                        try {
                          url = await uploadClinicPhotoDataUrl(dataUrl);
                        } catch {
                          window.alert("Tải ảnh lên thất bại, vui lòng thử lại.");
                          return;
                        }
                        const next = clinicPhotos.map((s, j) => (j === i ? url : s));
                        if (await commitClinicPhotos(next)) setClinicPhotos(next);
                      }}
                      onRemove={async () => {
                        const next = clinicPhotos.filter((_, j) => j !== i);
                        if (await commitClinicPhotos(next)) setClinicPhotos(next);
                      }}
                    />
                  </div>
                ))}
              </div>
            )}
            <div className="no-print print:hidden mt-2 max-w-xs">
              <ImageSlot
                src={null}
                onChange={async (dataUrl) => {
                  if (!ensureContentManager()) return;
                  let url: string;
                  try {
                    url = await uploadClinicPhotoDataUrl(dataUrl);
                  } catch {
                    window.alert("Tải ảnh lên thất bại, vui lòng thử lại.");
                    return;
                  }
                  const next = [...clinicPhotos, url];
                  if (await commitClinicPhotos(next)) setClinicPhotos(next);
                }}
                onRemove={() => {}}
                label="Add clinic photo"
              />
            </div>
          </div>
        </section>

        {/* Before & After */}
        <section
          id="before-after"
          className={`max-w-[2000px] mx-auto px-12 py-24 ${
            comparisons.some((c) => c.before || c.after) ? "" : "print:hidden"
          }`}
        >
          <div className="flex items-end justify-between flex-wrap gap-3 mb-6">
            <div>
              <SectionHeading
                eyebrow="Transformations"
                title={<>Before &amp; After</>}
                subtitle={
                  <span className="no-print print:hidden">
                    Drag the middle handle to adjust the split ratio (default 50:50).
                  </span>
                }
              />
            </div>
            <button
              onClick={() =>
                setComparisons((c) => [
                  ...c,
                  { before: null, after: null, split: 50, beforeLabel: "Before", afterLabel: "After" },
                ])
              }
              className="no-print inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-primary-foreground font-semibold shadow-lg shadow-primary/20 hover:brightness-110 print:hidden"
            >
              <Plus size={16} /> Add comparison
            </button>
          </div>
          <div className="space-y-8">
            {comparisons.map((item, i) => (
              <BeforeAfterCard
                key={i}
                item={item}
                onChange={(patch) => setComparisons((c) => c.map((x, j) => (j === i ? { ...x, ...patch } : x)))}
                onRemove={() => setComparisons((c) => c.filter((_, j) => j !== i))}
                onPickLibrary={(slot) =>
                  setLibraryPicker({
                    onSelect: (url) =>
                      setComparisons((c) =>
                        c.map((x, j) => (j === i ? { ...x, [slot]: url } : x)),
                      ),
                  })
                }
              />
            ))}
          </div>
        </section>

        <footer className="max-w-[2000px] mx-auto px-12 py-24 text-center relative">
          <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
          <div className="mt-8 max-w-4xl mx-auto space-y-4 text-[2rem] md:text-[2.25rem] text-foreground/85 leading-relaxed">
            <p>Thank you for taking the time to review your personalised treatment plan.</p>
            <p>
              Please take the time you need to consider the proposed treatment, timeline, and estimated costs. If you
              have any questions or would like to discuss alternative treatment options, materials, implant systems, or
              treatment timing, our International Patient Team will be happy to assist you.
            </p>
            <p>
              When you are ready to proceed, please contact us to confirm your treatment schedule and coordinate your
              visit to Vietnam.
            </p>
          </div>

          {/* Ask our doctor's assistant */}
          <div className="mt-10 avoid-break">
            <p className="text-[1rem] md:text-[1.125rem] font-bold uppercase tracking-[0.28em] text-primary/70">
              <RichText value={content.final_cta.title} as="span" />
            </p>
            <h2 className="mt-3 text-[2.25rem] md:text-[3.5rem] font-extrabold tracking-tight bg-gradient-to-r from-primary via-primary/80 to-accent bg-clip-text text-transparent">
              Have questions about your plan?
            </h2>
            <p className="mx-auto mt-2 max-w-2xl text-[1.25rem] md:text-[1.5rem] text-muted-foreground">
              Our International Patient Team replies within minutes — no question is too small.
            </p>
            <div className="group mt-4 inline-flex w-full max-w-3xl flex-col items-center gap-3 rounded-[1.75rem] border border-accent/40 bg-gradient-to-br from-primary to-primary/85 px-8 py-7 shadow-[0_30px_60px_-30px_color-mix(in_oklab,var(--primary)_70%,transparent)] transition-transform hover:-translate-y-0.5 hover:shadow-2xl">
              <a
                href="https://wa.me/84768738910"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 text-[1.5rem] md:text-[2rem] font-semibold uppercase tracking-[0.08em] text-primary-foreground transition-transform hover:scale-[1.02]"
                onClick={(e) => {
                  e.preventDefault();
                  window.open(whatsAppClickUrl("(+84) 768 738 910"), "_blank", "noopener,noreferrer");
                }}
              >
                <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-md">
                  <MessageCircle size={30} />
                </span>
                <RichText value={content.final_cta.body} as="span" />
              </a>
              <span className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-[1.125rem] md:text-[1.25rem] text-primary-foreground/90">
                <span className="inline-flex items-center gap-1.5">
                  <MessageCircle size={20} className="text-accent" />
                  <a
                    href="https://wa.me/84768738910"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-accent-foreground"
                    onClick={(e) => {
                      e.preventDefault();
                      window.open(whatsAppClickUrl("(+84) 768 738 910"), "_blank", "noopener,noreferrer");
                    }}
                  >
                    WhatsApp: (+84) 768 738 910
                  </a>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Phone size={20} className="text-accent" />
                  <a
                    href="https://wa.me/84775138910"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-accent-foreground"
                    onClick={(e) => {
                      e.preventDefault();
                      window.open(whatsAppClickUrl("(+84) 77 513 8910"), "_blank", "noopener,noreferrer");
                    }}
                  >
                    (+84) 77 513 8910
                  </a>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Mail size={20} className="text-accent" />
                  <a href="mailto:tu.nc@drcareimplant.com" className="underline hover:text-accent-foreground">
                    tu.nc@drcareimplant.com
                  </a>
                </span>
              </span>
            </div>
          </div>
          <div className="mt-12 flex flex-col items-center">
            <img
              src={drCareLogo}
              alt="Dr. Care Implant Clinic logo"
              className="h-[110px] w-auto object-contain"
            />
            <div className="mt-6 flex flex-col items-center gap-1 text-[1.25rem] text-foreground">
              <p className="font-bold">Dr. Care Implant Clinic</p>
              <p>Ho Chi Minh City, Vietnam</p>
              <p className="pt-4">www.drcareimplant.com</p>
            </div>
          </div>
        </footer>
        <ScrollToTop />
        <FontSizeControl />
      </div>
      {/* Full web / plan image export progress. Rendered as a SIBLING of
          #web-root (not inside it) on purpose: exportFullPdf/capturePlanPng
          push #web-root off-screen while they capture it, so anything
          inside #web-root — including the Export button's own label —
          disappears along with it. This stays put, fixed to the top of the
          viewport right where the toolbar/button normally sit, so there's
          still a clear "it's working" signal instead of the page just
          going blank. Deliberately NOT using the .no-print or .fixed
          classes: body.fullpdf-export/.png-export force every .no-print
          AND every .fixed element to display:none (see styles.css) —
          exactly the state this is shown during, and exactly what was
          hiding this element (same as it hides the toolbar it replaces).
          `position: fixed` is set inline instead, which those selectors
          don't touch. */}
      {(fullPdfStage || exportingPng) && (
        <div
          className="inset-x-0 top-0 z-[200] flex flex-col items-center gap-2 bg-card/95 backdrop-blur-xl border-b border-border shadow-lg px-5 py-4"
          style={{ position: "fixed" }}
        >
          <p className="text-sm font-semibold text-foreground">
            {fullPdfStage === "prep" || (exportingPng && !fullPdfStage)
              ? "Preparing your treatment plan…"
              : `Generating PDF… ${fullPdfProgress}%`}
          </p>
          <div className="h-1.5 w-full max-w-sm rounded-full bg-border overflow-hidden">
            <div
              className="h-full bg-accent transition-[width] duration-200"
              style={{ width: `${fullPdfStage === "gen" ? Math.max(5, fullPdfProgress) : 12}%` }}
            />
          </div>
        </div>
      )}
      <MediaLibraryModal
        open={!!libraryPicker}
        items={mediaLibrary}
        onClose={() => setLibraryPicker(null)}
        onSelect={(url) => libraryPicker?.onSelect(url)}
      />
    </>
  );
}
