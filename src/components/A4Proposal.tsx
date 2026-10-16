import { useEffect } from "react";
import {
  X, Printer, MessageCircle, Phone, Mail, Globe, MapPin, Clock,
  Plane, CalendarDays, ShieldCheck, Stethoscope, Syringe, HeartPulse, Sparkles, Gift,
} from "lucide-react";
import { PhotoCollage } from "@/components/PhotoCollage";
import { RichText } from "@/components/RichText";
import { ToothChart } from "@/components/ToothChart";
import { parseTokens, expandToken, formatTeethLines } from "@/components/ToothNumberPicker";

/**
 * Dedicated A4 patient proposal renderer.
 *
 * This is NOT the web page shrunk to A4 — it is a separate, purpose-built
 * six-page editorial document that consumes the same underlying plan data.
 */

export type A4Row = {
  name: string;
  tooth: string;
  qty: number;
  inPackage: boolean;
  unitVnd: number;
  vnd: number;
  fx: number;
};
export type A4Phase = {
  title: string;
  note?: string;
  rows: A4Row[];
  vnd: number;
  fx: number;
};
export type A4Photo = {
  url: string;
  fit?: "cover" | "contain";
  position?: string;
  zoom?: number;
  heightMm?: number;
  caption?: string;
};
export type A4Data = {
  clinicName: string;
  logoUrl: string;
  heroUrl: string;
  heroFit?: "cover" | "contain";
  heroPosition?: string;
  heroZoom?: number;
  /** Optional stack of cover photos, rendered top-to-bottom in the cover column. */
  heroImages?: A4Photo[];
  patientName: string;
  greeting: string;
  letter: string;
  coverTitle: string;
  diagnosis: {
    heading: string;
    summary: string;
    teeth: { n: string; s: string; t?: string; note?: string }[];
  };
  phases: A4Phase[];
  totals: { vnd: number; fx: number };
  fxLabel: string;
  benefits: {
    heading: string;
    intro: string;
    items: { title: string; lines: string[] }[];
  };
  clinic: {
    title: string;
    blurb: string;
    address: string;
    phone: string;
    email: string;
    website: string;
    hours: string;
  };
  photos: A4Photo[];
  photosLayout?: "grid" | "collage";
};

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");
const strip = (s: string) => s.replace(/^\s*[A-Za-z ]+:\s*/, "").trim();
const unnumber = (s: string) => s.replace(/(^|>)(\s*)\d+[.)]\s+/, "$1$2");
const textLen = (s: string) => s.replace(/<[^>]*>/g, "").length;

/** Split benefits across as many pages as needed so nothing is ever clipped. */
function paginate<T>(items: T[], weight: (t: T) => number, budget: number): T[][] {
  const out: T[][] = [];
  let cur: T[] = [];
  let acc = 0;
  for (const it of items) {
    const w = Math.max(weight(it), 1);
    if (cur.length && acc + w > budget) {
      out.push(cur);
      cur = [];
      acc = 0;
    }
    cur.push(it);
    acc += w;
  }
  if (cur.length) out.push(cur);
  return out.length ? out : [[]];
}

const JOURNEY_STEPS = [
  { Icon: Stethoscope, title: "Preparation", sub: "Assessment & diagnostics" },
  { Icon: Syringe, title: "Implant Placement", sub: "Surgical phase" },
  { Icon: HeartPulse, title: "Healing", sub: "Osseointegration (3 – 6 months)" },
  { Icon: Sparkles, title: "Final Restoration", sub: "Final crowns placement" },
  { Icon: ShieldCheck, title: "Long-term Care", sub: "Follow-up & maintenance" },
];

const PAGES = [
  { id: "a4-p1", label: "Welcome" },
  { id: "a4-p2", label: "Assessment" },
  { id: "a4-p3", label: "Journey" },
  { id: "a4-p4", label: "Plan & Investment" },
  { id: "a4-p5", label: "Benefits" },
  { id: "a4-p6", label: "Clinic & Next Steps" },
];

function Page({
  id,
  index,
  kicker,
  patientName,
  logoUrl,
  clinicName,
  children,
  bleed,
}: {
  id: string;
  index: number;
  kicker?: string;
  patientName: string;
  logoUrl: string;
  clinicName: string;
  children: React.ReactNode;
  bleed?: boolean;
}) {
  return (
    <section id={id} className="a4-page" data-clinic={clinicName}>
      <img src={logoUrl} alt="" className="a4-watermark" aria-hidden />
      <div className={bleed ? "a4-body a4-body--bleed" : "a4-body"}>
        {kicker ? (
          <div className="a4-kicker">
            <span className="a4-kicker-num">{String(index).padStart(2, "0")}</span>
            <span className="a4-kicker-rule" />
            <span>{kicker}</span>
          </div>
        ) : null}
        {children}
      </div>
      <footer className="a4-foot">
        <span>
          Prepared exclusively for <strong>{patientName || "our patient"}</strong>
        </span>
        <span className="a4-foot-num">{String(index).padStart(2, "0")}</span>
      </footer>

    </section>
  );
}

export function A4Proposal({ data, onClose }: { data: A4Data; onClose: () => void }) {
  const name = data.patientName || "Our patient";

  useEffect(() => {
    document.body.classList.add("a4-mode");
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.classList.remove("a4-mode");
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const marked = new Set(
    data.diagnosis.teeth.flatMap((t) => parseTokens(t.n).flatMap(expandToken)),
  );
  // Condense benefits so the print page never breaks mid-card:
  // drop the duplicated "Package conditions" entry and summarise each card
  // to a value line + one short sentence.
  const plain = (s: string) =>
    s.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
  const clip = (s: string, max: number) => {
    if (s.length <= max) return s;
    const cut = s.slice(0, max);
    const at = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf(" "));
    return cut.slice(0, at > 40 ? at : max).replace(/[,;:.\s]+$/, "") + ".";
  };
  const condensed = data.benefits.items
    .map((it, i) => ({ ...it, i }))
    .filter((it) => !/package\s*condition/i.test(plain(it.title)))
    .map((it) => {
      const src = it.lines.map(plain).filter(Boolean);
      const values = src.filter((l) => /value|usd|vnd|free|complimentary/i.test(l));
      const rest = src.filter((l) => !values.includes(l)).join(" ");
      const lines: string[] = [];
      if (rest) lines.push(clip(rest, 150));
      values.forEach((v) => lines.push(clip(v, 60)));
      return { ...it, title: plain(it.title), lines };
    });

  // Rough rendered height in mm per benefit card, flowed over two columns.
  const benefitHeight = (it: { title: string; lines: string[] }) =>
    6 +
    Math.max(Math.ceil(textLen(it.title) / 32) * 4.4, 8) +
    it.lines.reduce((a, l) => a + Math.ceil(textLen(l) / 42) * 3.8, 0) +
    4;
  const benefitPages = paginate(
    condensed,
    benefitHeight,
    // two columns × usable column height (less the intro block / conditions box)
    2 * (data.benefits.intro ? 150 : 195),
  );



  return (
    <div className="a4-shell" style={{ position: "fixed", inset: 0, zIndex: 90 }}>
      <div className="a4-toolbar">
        <span className="a4-toolbar-title">A4 Patient Proposal — {name}</span>
        <nav className="a4-toolbar-nav">
          {PAGES.map((p, i) => (
            <a key={p.id} href={`#${p.id}`}>
              {String(i + 1).padStart(2, "0")} {p.label}
            </a>
          ))}
        </nav>
        <button onClick={() => window.print()} className="a4-btn a4-btn--go">
          <Printer size={14} /> Print / Save A4 PDF
        </button>
        <button onClick={onClose} className="a4-btn">
          <X size={14} /> Close
        </button>
      </div>

      <div className="a4-scroll">
        {/* ---------------- 01 · Cover ---------------- */}
        <Page id="a4-p1" index={1} patientName={name} logoUrl={data.logoUrl} clinicName={data.clinicName} bleed>
          <div className="a4-cover">
            <div className="a4-cover-left">
              <div className="a4-brandline">
                <img src={data.logoUrl} alt={data.clinicName} />
              </div>

              <p className="a4-cover-eyebrow">Your personalized</p>
              <h1 className="a4-cover-title">
                {data.coverTitle || "Dental Treatment Plan"}
              </h1>
              <p className="a4-cover-prepared">Prepared exclusively for</p>
              <p className="a4-cover-name">{name}</p>
              <div className="a4-rule" />
              <p className="a4-cover-greeting">{data.greeting || `Dear ${name},`}</p>
              <RichText value={data.letter} className="a4-cover-letter" />
              <ul className="a4-cover-meta">
                <li>
                  <MapPin size={11} /> {strip(data.clinic.address).split(",").slice(-3).join(",").trim()}
                </li>
                <li>
                  <Globe size={11} /> {strip(data.clinic.website)}
                </li>
              </ul>
            </div>
            {(() => {
              const stack: A4Photo[] =
                data.heroImages && data.heroImages.length
                  ? data.heroImages
                  : data.heroUrl
                    ? [
                        {
                          url: data.heroUrl,
                          fit: data.heroFit,
                          position: data.heroPosition,
                          zoom: data.heroZoom,
                        },
                      ]
                    : [];
              if (!stack.length) return <div className="a4-cover-photo" />;
              return (
                <div className={`a4-cover-photo${stack.length > 1 ? " is-stack" : ""}`}>
                  {stack.map((p, i) => (
                    <div
                      key={`${p.url}-${i}`}
                      className="a4-cover-slot"
                      style={
                        {
                          "--a4-hero-fit": p.fit ?? "contain",
                          "--a4-hero-pos": p.position ?? "50% 50%",
                        } as React.CSSProperties
                      }
                    >
                      <img
                        src={p.url}
                        alt="Dr. Care Implant Clinic"
                        style={(p.zoom ?? 1) > 1 ? { transform: `scale(${p.zoom})` } : undefined}
                      />
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>

          <div className="a4-journeybar">
            <p className="a4-journeybar-title">Your journey overview</p>
            <ol className="a4-journeybar-steps">
              {PAGES.slice(1).map((p, i) => (
                <li key={p.id}>
                  <a href={`#${p.id}`}>
                    <span className="a4-journeybar-dot">{String(i + 1).padStart(2, "0")}</span>
                    <span className="a4-journeybar-label">{p.label}</span>
                  </a>
                </li>
              ))}
            </ol>
            <p className="a4-journeybar-foot">
              We accompany you at every step, from first assessment to long-term care.
            </p>
          </div>
        </Page>

        {/* ---------------- 02 · Assessment ---------------- */}
        <Page id="a4-p2" index={2} kicker="Your dental assessment" patientName={name} logoUrl={data.logoUrl} clinicName={data.clinicName}>
          <h2 className="a4-h1">{data.diagnosis.heading || "Your Dental Assessment"}</h2>
          {data.diagnosis.summary ? (
            <RichText value={data.diagnosis.summary} className="a4-lead" />
          ) : null}

          {data.diagnosis.teeth.length ? (
            <table className="a4-table a4-table--dx">
              <thead>
                <tr>
                  <th style={{ width: "14%" }}>Tooth</th>
                  <th style={{ width: "36%" }}>Clinical findings</th>
                  <th style={{ width: "34%" }}>Recommended treatment</th>
                  <th style={{ width: "16%" }}>Note</th>
                </tr>
              </thead>
              <tbody>
                {data.diagnosis.teeth.map((t, i) => (
                  <tr key={i}>
                    <td className="a4-td-tooth">
                      <span className="a4-toothpill">{t.n || "—"}</span>
                    </td>
                    <td>{t.s || "—"}</td>
                    <td>{t.t || "—"}</td>
                    <td>{t.note || ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}

          <p className="a4-sublabel">Tooth chart</p>
          <div className="a4-chart">
            <ToothChart marked={marked} />
          </div>
        </Page>

        {/* ---------------- 03 · Journey ---------------- */}
        <Page id="a4-p3" index={3} kicker="Your treatment journey" patientName={name} logoUrl={data.logoUrl} clinicName={data.clinicName}>
          <h2 className="a4-h1">Your Treatment Journey</h2>
          <p className="a4-lead">
            Your treatment is carefully planned in phases to ensure safety, comfort and the best
            long-term results.
          </p>

          <ol className="a4-steps">
            {JOURNEY_STEPS.map((s, i) => (
              <li key={s.title}>
                <span className="a4-step-icon">
                  <s.Icon size={16} strokeWidth={1.6} />
                </span>
                <span className="a4-step-num">{String(i + 1).padStart(2, "0")}</span>
                <span className="a4-step-title">{s.title}</span>
                <span className="a4-step-sub">{s.sub}</span>
              </li>
            ))}
          </ol>

          <div className="a4-facts">
            {[
              { Icon: Plane, k: "Estimated time in Vietnam", v: "7 – 10 days", s: "for Trip 1" },
              { Icon: CalendarDays, k: "Healing period", v: "3 – 6 months", s: "before final restoration" },
              { Icon: Plane, k: "Trip 2", v: "7 – 10 days", s: "for final restoration" },
            ].map((f) => (
              <div key={f.k} className="a4-fact">
                <f.Icon size={14} strokeWidth={1.6} />
                <div>
                  <p className="a4-fact-k">{f.k}</p>
                  <p className="a4-fact-v">{f.v}</p>
                  <p className="a4-fact-s">{f.s}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="a4-support">
            <ShieldCheck size={16} strokeWidth={1.6} />
            <p>
              We will support you throughout your journey, from your arrival in Vietnam until
              long-term care.
            </p>
          </div>
        </Page>


        {/* ---------------- 04 · Plan & Investment ---------------- */}
        <Page id="a4-p4" index={4} kicker="Your treatment plan & investment" patientName={name} logoUrl={data.logoUrl} clinicName={data.clinicName}>
          <h2 className="a4-h1">Your Treatment Plan &amp; Investment</h2>

          {data.phases.map((ph, pi) => (
            <div key={pi} className="a4-phase">
              <p className="a4-phase-title">{ph.title}</p>
              <table className="a4-table">
                <thead>
                  <tr>
                    <th style={{ width: "38%" }} className="a4-c">Treatment</th>
                    <th style={{ width: "14%" }}>Tooth</th>
                    <th style={{ width: "8%" }}>Qty</th>
                    <th style={{ width: "16%" }}>Unit price (VND)</th>
                    <th style={{ width: "14%" }}>Amount (VND)</th>
                    <th style={{ width: "10%" }}>{data.fxLabel}</th>
                  </tr>
                </thead>
                <tbody>
                  {ph.rows.map((r, i) => {
                    const teethLines = formatTeethLines(r.tooth, 4);
                    return (
                    <tr key={i}>
                      <td className="a4-td-name">{r.name}</td>
                      <td className="a4-c">
                        {teethLines.length
                          ? teethLines.map((line, li) => <div key={li}>{line}</div>)
                          : "—"}
                      </td>
                      <td className="a4-c">{r.qty || ""}</td>
                      <td className="a4-c">{r.inPackage ? "In package" : fmt(r.unitVnd)}</td>
                      <td className="a4-c">{r.inPackage ? "—" : fmt(r.vnd)}</td>
                      <td className="a4-c">{r.inPackage ? "—" : fmt(r.fx)}</td>
                    </tr>
                    );
                  })}
                  <tr className="a4-subtotal">
                    <td colSpan={4}>{ph.title.split("—")[0]!.trim()} total</td>
                    <td className="a4-c">{fmt(ph.vnd)}</td>
                    <td className="a4-c">{fmt(ph.fx)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ))}

          <div className="a4-grand">
            <span>Grand total estimated investment</span>
            <span className="a4-grand-vnd">{fmt(data.totals.vnd)} VND</span>
            <span className="a4-grand-fx">
              ≈ {fmt(data.totals.fx)} {data.fxLabel}
            </span>
          </div>
          <p className="a4-fineprint">
            * The exchange rate is indicative and may vary. The final treatment plan is confirmed
            after your clinical examination in Ho Chi Minh City.
          </p>
        </Page>

        {/* ---------------- 05 · Benefits ---------------- */}
        {benefitPages.map((group, gi) => (
          <Page
            key={gi}
            id={gi === 0 ? "a4-p5" : `a4-p5-${gi}`}
            index={5}
            kicker={gi === 0 ? "Your patient benefits" : "Your patient benefits (continued)"}
            patientName={name}
            logoUrl={data.logoUrl}
            clinicName={data.clinicName}
          >
            {gi === 0 ? (
              <>
                <h2 className="a4-h1">{data.benefits.heading || "Your Patient Benefits"}</h2>
                {data.benefits.intro ? (
                  <RichText value={data.benefits.intro} className="a4-lead" />
                ) : null}
              </>
            ) : null}

            <div className="a4-benefits">
              {group.map((it) => (
                <div key={it.i} className="a4-benefit">
                  <span className="a4-benefit-icon">
                    <Gift size={13} strokeWidth={1.6} />
                  </span>
                  <div>
                    <RichText value={unnumber(it.title)} className="a4-benefit-title" />
                    {it.lines.filter(Boolean).map((l, j) => (
                      <RichText
                        key={j}
                        value={l}
                        className={
                          /value|usd|vnd|free/i.test(l.replace(/<[^>]*>/g, ""))
                            ? "a4-benefit-value"
                            : "a4-benefit-line"
                        }
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {gi === benefitPages.length - 1 ? (
              <div className="a4-conditions">
                <p className="a4-conditions-title">Package conditions</p>
                <p>
                  These benefits are included as part of your treatment plan. They are
                  non-transferable, non-refundable and subject to eligibility and the final
                  confirmed treatment plan.
                </p>
              </div>
            ) : null}


          </Page>
        ))}

        {/* ---------------- 06 · Clinic & Next Steps ---------------- */}
        <Page id="a4-p6" index={6} kicker="Our clinic & next steps" patientName={name} logoUrl={data.logoUrl} clinicName={data.clinicName}>
          <h2 className="a4-h1">Our Clinic &amp; Next Steps</h2>

          <div className="a4-clinic">
            <div>
              <p className="a4-sublabel">{data.clinic.title || "Our clinic"}</p>
              <RichText value={data.clinic.blurb} className="a4-lead" />
              <ul className="a4-clinic-meta">
                <li>
                  <MapPin size={12} /> {strip(data.clinic.address)}
                </li>
                <li>
                  <Clock size={12} /> {strip(data.clinic.hours)}
                </li>
              </ul>
            </div>
            {data.photosLayout === "collage" ? (
              <PhotoCollage items={data.photos} ratio="4 / 3" />
            ) : (
            <div
              className="a4-photos"
              style={{
                gridTemplateColumns: `repeat(${Math.min(Math.max(data.photos.length, 1), 2)}, 1fr)`,
              }}
            >
              {data.photos.map((p, i) => (
                <span
                  key={i}
                  className="a4-photo"
                  style={{ height: `${p.heightMm ?? 27}mm` }}
                >
                  <img
                    src={p.url}
                    alt={p.caption || "Dr. Care Implant Clinic"}
                    style={{
                      objectFit: p.fit ?? "cover",
                      objectPosition: p.position ?? "50% 50%",
                      transform: (p.zoom ?? 1) > 1 ? `scale(${p.zoom})` : undefined,
                    }}
                  />
                </span>
              ))}
            </div>
            )}
          </div>

          <div className="a4-next">
            <p className="a4-next-title">Ready to start your journey?</p>
            <p className="a4-next-sub">
              Our International Patient Team will be happy to assist you with every step of your
              treatment journey in Vietnam.
            </p>
            <div className="a4-contacts">
              <a href="https://wa.me/84768738910" target="_blank" rel="noopener noreferrer">
                <MessageCircle size={14} />
                <span>
                  <em>WhatsApp</em>
                  {strip(data.clinic.phone)}
                </span>
              </a>
              <a href={`tel:${strip(data.clinic.phone).replace(/[^\d+]/g, "")}`}>
                <Phone size={14} />
                <span>
                  <em>Phone</em>
                  {strip(data.clinic.phone)}
                </span>
              </a>
              <a href={`mailto:${strip(data.clinic.email)}`}>
                <Mail size={14} />
                <span>
                  <em>Email</em>
                  {strip(data.clinic.email)}
                </span>
              </a>
            </div>
          </div>

          <div className="a4-signoff">
            <div>
              <p className="a4-signoff-title">Prepared exclusively for {name}</p>
              <p className="a4-signoff-sub">
                This treatment plan is confidential and intended solely for the addressee.
              </p>
            </div>
            <img src={data.logoUrl} alt="" />
          </div>
        </Page>
      </div>
    </div>
  );
}
