import { useEffect, useMemo, useState } from "react";
import { RichText } from "@/components/RichText";
import { isEmptyRich, toPlain } from "@/lib/rich-text";
import {
  ClipboardList,
  CalendarDays,
  Stethoscope,
  Sparkles,
  Images,
  Building2,
  Contrast,
} from "lucide-react";

export type JourneyItem = {
  number: string;
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
};

const JOURNEY_ITEMS: JourneyItem[] = [
  {
    number: "01",
    title: "Patient Information",
    description: "Your personal and treatment information",
    href: "#patient-information",
    icon: <ClipboardList size={16} strokeWidth={1.5} />,
  },
  {
    number: "02",
    title: "Advanced Technology",
    description: "Technology and materials used in your treatment",
    href: "#advanced-technology",
    icon: <Sparkles size={16} strokeWidth={1.5} />,
  },
  {
    number: "03",
    title: "Photos, X-rays & References",
    description: "Your clinical images and supporting references",
    href: "#visual-records",
    icon: <Images size={16} strokeWidth={1.5} />,
  },
  {
    number: "04",
    title: "Diagnosis",
    description: "Your current dental assessment",
    href: "#diagnosis",
    icon: <Stethoscope size={16} strokeWidth={1.5} />,
  },
  {
    number: "05",
    title: "Treatment Plan",
    description: "Your personalized treatment plan",
    href: "#treatment-plan",
    icon: <CalendarDays size={16} strokeWidth={1.5} />,
  },
  {
    number: "06",
    title: "Our Clinic",
    description: "Meet the clinic and treatment environment",
    href: "#our-clinic",
    icon: <Building2 size={16} strokeWidth={1.5} />,
  },
  {
    number: "07",
    title: "Before & After",
    description: "Your smile transformation",
    href: "#before-after",
    icon: <Contrast size={16} strokeWidth={1.5} />,
  },
];

function scrollToAnchor(href: string, offset = 88) {
  if (typeof window === "undefined") return;
  const id = href.replace("#", "");
  const target = document.getElementById(id);
  if (!target) return;

  const rect = target.getBoundingClientRect();
  const top = window.scrollY + rect.top - offset;
  window.scrollTo({ top, behavior: "smooth" });
}

function useActiveSection() {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const ids = JOURNEY_ITEMS.map((i) => i.href.replace("#", ""));

    const compute = () => {
      let current: string | null = null;
      for (const id of ids) {
        const el = document.getElementById(id);
        if (!el) continue;
        const top = el.getBoundingClientRect().top;
        if (top - 140 <= 0) current = id;
      }
      setActive(current);
    };

    compute();
    window.addEventListener("scroll", compute, { passive: true });
    window.addEventListener("resize", compute);
    return () => {
      window.removeEventListener("scroll", compute);
      window.removeEventListener("resize", compute);
    };
  }, []);

  return active;
}


export function PatientJourneyNav({
  heading,
  intro,
  steps,
}: {
  /** Owner-managed heading (rich text). Falls back to the shipped wording. */
  heading?: string;
  intro?: string;
  /** Owner-managed step labels, in the same order as the fixed sections. */
  steps?: { title: string; lines: string[] }[];
} = {}) {
  const active = useActiveSection();
  const items = useMemo(
    () =>
      JOURNEY_ITEMS.map((item, i) => {
        const override = steps?.[i];
        return {
          ...item,
          title: override?.title ? toPlain(override.title) : item.title,
          description: override?.lines?.[0] ? toPlain(override.lines[0]) : item.description,
        };
      }),
    [steps],
  );

  return (
    <section className="journey-nav max-w-[2000px] mx-auto px-12 pb-24 print:py-2">
      <div className="flex items-center justify-center gap-3 py-14 md:py-20 print:hidden">
        <span className="h-px w-16 bg-border" />
        <span className="h-1 w-1 rounded-full bg-accent" />
        <span className="h-px w-16 bg-border" />
      </div>

      {(heading && !isEmptyRich(heading)) || (intro && !isEmptyRich(intro)) ? (
        <header className="mb-6 max-w-4xl">
          {heading && !isEmptyRich(heading) ? (
            <RichText
              value={heading}
              as="h2"
              className="text-[3.5rem] md:text-[4.25rem] font-light tracking-tight text-primary"
            />
          ) : null}
          {intro && !isEmptyRich(intro) ? (
            <RichText
              value={intro}
              as="p"
              className="mt-3 text-[2rem] leading-relaxed text-muted-foreground"
            />
          ) : null}
        </header>
      ) : null}

      {/* Compact journey overview band (matches the A4 proposal) */}
      <div className="rounded-2xl bg-primary px-6 py-8 md:px-10 md:py-9 text-primary-foreground print:rounded-none">
        <p className="print-text-1-75rem text-[1.75rem] font-semibold uppercase tracking-[0.28em] text-primary-foreground/85">
          Your journey overview
        </p>

        <ol className="relative mt-8 grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-4 lg:grid-cols-7 print:grid-cols-7 print:gap-x-2 print:gap-y-9">
          {/* Connecting track across the step badges */}
          <div
            aria-hidden="true"
            className="journey-track pointer-events-none absolute left-[calc(100%/14)] right-[calc(100%/14)] top-[46px] hidden h-px bg-primary-foreground/20 sm:block print:block"
          />
          {items.map((item, i) => {
            const isActive = active === item.href.replace("#", "");
            return (
              <li key={item.number} className="relative text-center">
                <a
                  href={item.href}
                  onClick={(e) => {
                    e.preventDefault();
                    scrollToAnchor(item.href);
                  }}
                  className="group flex flex-col items-center gap-3"
                >
                  <span
                    className={[
                      "journey-step-badge relative z-10 flex h-[92px] w-[92px] flex-col items-center justify-center gap-0.5 rounded-full border bg-primary text-primary-foreground transition-colors",
                      isActive
                        ? "border-accent bg-accent text-primary"
                        : "border-primary-foreground/45 group-hover:border-accent group-hover:text-accent",
                    ].join(" ")}
                  >
                    <span className="journey-badge-icon [&>svg]:h-[24px] [&>svg]:w-[24px]">{item.icon}</span>
                    <span className="journey-badge-number text-[1.5rem] font-semibold tabular-nums leading-none">
                      {item.number}
                    </span>
                  </span>
                  <span className="journey-badge-title px-1 text-[2rem] font-medium leading-snug text-primary-foreground">
                    {item.title}
                  </span>
                </a>
              </li>
            );
          })}
        </ol>

        <div className="mt-8 border-t border-primary-foreground/25 pt-4">
          <p className="print-text-2rem text-[2rem] text-primary-foreground/85">
            We accompany you at every step, from first assessment to long-term care.
          </p>
        </div>
      </div>
    </section>
  );
}
