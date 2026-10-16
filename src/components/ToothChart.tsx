type ToothKind = "molar" | "premolar" | "canine" | "incisor";

const UPPER_RIGHT = [18, 17, 16, 15, 14, 13, 12, 11];
const UPPER_LEFT = [21, 22, 23, 24, 25, 26, 27, 28];
const LOWER_RIGHT = [48, 47, 46, 45, 44, 43, 42, 41];
const LOWER_LEFT = [31, 32, 33, 34, 35, 36, 37, 38];

function kindOf(n: number): ToothKind {
  const p = n % 10;
  if (p >= 6) return "molar";
  if (p >= 4) return "premolar";
  if (p === 3) return "canine";
  return "incisor";
}

/**
 * Anatomical tooth rendered in a 40x64 box (crown on top, roots below) with
 * enamel / dentin gradients so it reads as a real 3D tooth model.
 * Upper and lower teeth get different root counts, like a real FDI chart.
 */
function ToothShape({ kind, upper }: { kind: ToothKind; upper: boolean }) {
  const crown =
    kind === "molar"
      ? "M6 27 C4.8 18, 5.2 10.5, 7.8 7.2 C9.4 5.2, 11.2 8, 12.8 6.8 C14.4 5.6, 15.8 4.6, 17.8 6.4 C19.2 7.6, 20.8 5.2, 22.4 6.4 C24 7.6, 25.6 5, 27.4 6.6 C29 8, 30.6 5.4, 32.2 7.6 C34.8 11, 35.2 18, 34 27 C33 28.4, 7 28.4, 6 27 Z"
      : kind === "premolar"
        ? "M9 27 C7.9 18, 8.4 10.6, 11 7.4 C12.8 5.2, 15 8.2, 17 6.6 C19 5, 21.4 4.8, 23.4 6.8 C25.2 8.6, 27.2 5.4, 29 8 C31.3 11.4, 32.1 18, 31 27 C30 28.3, 10 28.3, 9 27 Z"
        : kind === "canine"
          ? "M12 27 C11.5 17.5, 14 8.4, 19 2.9 C19.6 2.2, 20.4 2.2, 21 2.9 C26 8.4, 28.5 17.5, 28 27 C27 28.3, 13 28.3, 12 27 Z"
          : "M12.6 27 C12 18, 12.7 9.4, 13.3 6.6 C13.6 5.2, 14.2 4.6, 15.2 4.6 L24.8 4.6 C25.8 4.6, 26.4 5.2, 26.7 6.6 C27.3 9.4, 28 18, 27.4 27 C26.4 28.3, 13.6 28.3, 12.6 27 Z";

  const roots: string[] =
    kind === "molar"
      ? [
          "M8.5 26 L15 26 C13.5 36, 10 46, 7.2 54.4 C6.8 55.7, 5.9 55.4, 6.1 54 C7 45, 8 35, 8.5 26 Z",
          "M17.5 26 L22.5 26 C22.7 36, 21.5 47, 20.5 55 C20.3 56.3, 19.6 56.3, 19.5 55 C18.5 47, 17.3 36, 17.5 26 Z",
          "M25 26 L31.5 26 C32 35, 33 45, 33.9 54 C34.1 55.4, 33.2 55.7, 32.8 54.4 C30 46, 26.5 36, 25 26 Z",
        ]
      : kind === "premolar"
        ? [
            "M12.6 26 L17.6 26 C17.2 35, 16.2 44, 15 52.6 C14.8 53.9, 13.9 53.8, 13.8 52.5 C13.4 44, 12.8 35, 12.6 26 Z",
            "M22.4 26 L27.4 26 C27.2 35, 26.6 44, 26.2 52.5 C26.1 53.8, 25.2 53.9, 25 52.6 C23.8 44, 22.8 35, 22.4 26 Z",
          ]
        : kind === "canine"
          ? [
              "M13.2 26 L26.8 26 C26.6 39, 24.6 50, 21.2 60 C20.7 61.4, 19.3 61.4, 18.8 60 C15.4 50, 13.4 39, 13.2 26 Z",
            ]
          : [
              "M14 26 L26 26 C25.7 37, 24.4 47, 21.2 56 C20.7 57.4, 19.3 57.4, 18.8 56 C15.6 47, 14.3 37, 14 26 Z",
            ];



  const cusps =
    kind === "molar"
      ? [
          "M7 19.5 C12 23, 16 24.4, 20 24.4 C24 24.4, 28 23, 33 19.5",
          "M13.4 8 C13 12, 13.2 15.6, 13.8 18.6",
          "M20 7 C19.8 11.5, 19.9 15.5, 20 19.4",
          "M26.6 8 C27 12, 26.8 15.6, 26.2 18.6",
          "M8.5 13.5 C13.5 16.4, 26.5 16.4, 31.5 13.5",
        ]
      : kind === "premolar"
        ? [
            "M10 19.5 C14 22.8, 17 24, 20 24 C23 24, 26 22.8, 30 19.5",
            "M15.4 8 C15 12, 15.2 15.6, 15.8 19",
            "M24.6 8 C25 12, 24.8 15.6, 24.2 19",
          ]
        : kind === "canine"
          ? [
              "M20 4 C19.6 11, 19.8 18, 20 24.6",
              "M14.6 14 C15.8 18, 16.2 21.4, 16 24.8",
              "M25.4 14 C24.2 18, 23.8 21.4, 24 24.8",
            ]
          : [
              "M15 6.5 C15.6 13, 15.8 19.5, 15.6 25",
              "M25 6.5 C24.4 13, 24.2 19.5, 24.4 25",
              "M13.4 22.6 C17 24.2, 23 24.2, 26.6 22.6",
            ];

  const id = `${kind}-${upper ? "u" : "l"}`;
  const gw =
    kind === "molar" ? 16 : kind === "premolar" ? 13 : kind === "canine" ? 11 : 11;


  return (
    <svg
      viewBox="0 0 40 64"
      className="w-full h-full overflow-visible"
      style={upper ? { transform: "scaleY(-1)" } : undefined}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`en-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="42%" stopColor="#f6f4ec" />
          <stop offset="100%" stopColor="#d8d2c1" />
        </linearGradient>
        <linearGradient id={`ro-${id}`} x1="0" y1="0" x2="1" y2="0.4">
          <stop offset="0%" stopColor="#f2ead9" />
          <stop offset="55%" stopColor="#e4d8bf" />
          <stop offset="100%" stopColor="#c9b898" />
        </linearGradient>
        <radialGradient id={`gl-${id}`} cx="0.34" cy="0.28" r="0.5">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`gum-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#eaa79f" />
          <stop offset="45%" stopColor="#dd9088" />
          <stop offset="100%" stopColor="#c8776f" />
        </linearGradient>
      </defs>

      {roots.map((d, i) => (
        <path
          key={`r${i}`}
          d={d}
          fill={`url(#ro-${id})`}
          stroke="#a3927a"
          strokeWidth={0.7}
          strokeLinejoin="round"
        />
      ))}

      {/* Gingival collar hugging the neck of this tooth only */}
      <path
        d={`M${20 - gw} 27.6 C${20 - gw} 24.8, ${20 - gw * 0.55} 23.4, 20 23.4 C${20 + gw * 0.55} 23.4, ${20 + gw} 24.8, ${20 + gw} 27.6 C${20 + gw} 29.8, ${20 + gw * 0.6} 30.6, 20 30.6 C${20 - gw * 0.6} 30.6, ${20 - gw} 29.8, ${20 - gw} 27.6 Z`}
        fill={`url(#gum-${id})`}
        fillOpacity={0.7}
        stroke="#b56a63"
        strokeOpacity={0.3}
        strokeWidth={0.4}

      />


      <path
        d={crown}
        fill={`url(#en-${id})`}
        stroke="#a89f88"
        strokeWidth={0.9}
        strokeLinejoin="round"
      />

      {cusps.map((d, i) => (
        <path
          key={`c${i}`}
          d={d}
          fill="none"
          stroke="#b3a992"
          strokeOpacity={0.7}
          strokeWidth={0.7}
          strokeLinecap="round"
        />
      ))}

      {/* cervical shadow where the crown meets the gum */}
      <path
        d="M8 24.8 C13 26.8, 27 26.8, 32 24.8"
        fill="none"
        stroke="#9b8f78"
        strokeOpacity={0.35}
        strokeWidth={0.8}
        strokeLinecap="round"
      />

      <ellipse cx="15.5" cy="12.5" rx="5" ry="6.5" fill={`url(#gl-${id})`} />
    </svg>
  );
}



// Widths in rem (not px) so the tooth icons scale with the root font-size —
// same as everything else during the Full PDF export's "match the Treatment
// Plan's width" scaling — instead of staying a fixed pixel size while the
// tooth numbers below them (also rem-based) grow, ending up visibly smaller
// than the numbers labelling them at larger scale ratios.
// print:w-[...] here used to be dead weight — Tailwind's print: variant
// never actually took effect in this app's compiled CSS (verified: the
// class doesn't even appear in the stylesheet's @media print output), so
// print always fell back to the sm: size below. The tooth-icon-* classes +
// matching rules in styles.css (same proven pattern as .print-text-2rem)
// still handle *print* sizing specifically — the sm: values here are the
// real on-screen size and are capped more conservatively than print's,
// since print also has to fit all 8 teeth in a quadrant side by side on
// one physical A4 page width, which the live page doesn't.
const WIDTH: Record<ToothKind, string> = {
  molar: "w-[2rem] sm:w-[3.25rem] tooth-icon-molar",
  premolar: "w-[1.6875rem] sm:w-[2.75rem] tooth-icon-premolar",
  canine: "w-[1.625rem] sm:w-[2.625rem] tooth-icon-canine",
  incisor: "w-[1.5rem] sm:w-[2.5rem] tooth-icon-incisor",
};

function Row({
  numbers,
  upper,
  marked,
  onToggle,
  numbersFirst,
  mirrored,
}: {
  numbers: number[];
  upper: boolean;
  marked: Set<string>;
  onToggle?: (n: string) => void;
  numbersFirst?: boolean;
  mirrored?: boolean;
}) {
  const teeth = (
    <div className="tooth-row-gap flex items-end justify-center gap-[2px] sm:gap-[3px]">
      {numbers.map((n) => {
        const on = marked.has(String(n));
        return (
          <button
            key={n}
            type="button"
            onClick={() => onToggle?.(String(n))}
            title={`Tooth ${n}`}
            className={`${WIDTH[kindOf(n)]} tooth-icon-h h-[3.375rem] sm:h-[5.25rem] rounded-md transition ${
              on ? "bg-accent/25 ring-1 ring-accent" : "hover:bg-primary/5"
            }`}
            style={{
              filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.22))",
              transform: mirrored ? "scaleX(-1)" : undefined,
            }}
          >
            <ToothShape kind={kindOf(n)} upper={upper} />
          </button>
        );
      })}
    </div>
  );
  const labels = (
    <div className="tooth-row-gap flex items-center justify-center gap-[2px] sm:gap-[3px]">
      {numbers.map((n) => (
        <span
          key={n}
          className={`${WIDTH[kindOf(n)]} tooth-num-label dx-print-text text-center text-sm sm:text-[20px] font-semibold tabular-nums ${
            marked.has(String(n)) ? "text-accent" : "text-primary/70"
          }`}
        >
          {n}
        </span>
      ))}
    </div>
  );

  return (
    <div className="flex flex-col gap-1">
      {numbersFirst ? (
        <>
          {labels}
          {teeth}
        </>
      ) : (
        <>
          {teeth}
          {labels}
        </>
      )}
    </div>
  );
}

const GROUP_LABEL: Record<ToothKind, [string, string]> = {
  molar: ["Molars", "6–8"],
  premolar: ["Premolars", "4–5"],
  canine: ["Canines", "3"],
  incisor: ["Incisors", "1–2"],
};

function GroupBrackets({ numbers }: { numbers: number[] }) {
  const groups: { kind: ToothKind; items: number[] }[] = [];
  numbers.forEach((n) => {
    const k = kindOf(n);
    const last = groups[groups.length - 1];
    if (last && last.kind === k) last.items.push(n);
    else groups.push({ kind: k, items: [n] });
  });

  return (
    <div className="flex justify-center gap-[2px] sm:gap-[3px]">
      {groups.map((g) => (
        <div key={g.kind} className="flex flex-col items-center">
          <div className="flex gap-[2px] sm:gap-[3px]">
            {g.items.map((n) => (
              <span key={n} className={`${WIDTH[kindOf(n)]} block`} />
            ))}
          </div>
          <div className="w-full h-[6px] border-l border-r border-b border-primary/30 rounded-b-[4px]" />
          <span className="tooth-group-label mt-[3px] text-center text-[11px] sm:text-[15px] leading-[1.15] text-primary/55">
            {GROUP_LABEL[g.kind][0]}
            <br />
            {GROUP_LABEL[g.kind][1]}
          </span>

        </div>
      ))}
    </div>
  );
}


export function ToothChart({
  marked = new Set<string>(),
  onToggle,
}: {
  marked?: Set<string>;
  onToggle?: (n: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-primary/15 bg-background/60 p-4 sm:p-6 print:p-6">
      <div className="tooth-quadrant-header flex justify-between text-sm sm:text-[22px] font-bold uppercase tracking-wider text-primary/60 border-b border-primary/20 pb-1">
        <span>Upper right</span>
        <span>Upper left</span>
      </div>

      <div className="relative pt-3 pb-1">
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-primary/20" />
        <div className="grid grid-cols-2 gap-x-3 sm:gap-x-6">
          <Row numbers={UPPER_RIGHT} upper marked={marked} onToggle={onToggle} />
          <Row numbers={UPPER_LEFT} upper marked={marked} onToggle={onToggle} mirrored />
        </div>
      </div>

      <div className="h-px bg-primary/25" />

      <div className="relative pt-1 pb-2">
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-primary/20" />
        <div className="grid grid-cols-2 gap-x-3 sm:gap-x-6">
          <Row numbers={LOWER_RIGHT} upper={false} marked={marked} onToggle={onToggle} numbersFirst />
          <Row numbers={LOWER_LEFT} upper={false} marked={marked} onToggle={onToggle} numbersFirst mirrored />
        </div>
      </div>

      {/* Group brackets under the lower arch only */}
      <div className="grid grid-cols-2 gap-x-3 sm:gap-x-6 pb-1">
        <GroupBrackets numbers={LOWER_RIGHT} />
        <GroupBrackets numbers={LOWER_LEFT} />
      </div>

      <div className="tooth-quadrant-header flex justify-between text-sm sm:text-[22px] font-bold uppercase tracking-wider text-primary/60 border-t border-primary/20 pt-1">
        <span>Lower right</span>
        <span>Lower left</span>
      </div>

    </div>
  );
}

export const ALL_TEETH = [
  ...UPPER_RIGHT,
  ...UPPER_LEFT,
  ...LOWER_RIGHT,
  ...LOWER_LEFT,
].map(String);
