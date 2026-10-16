import { mediaStyle, type MediaItem } from "@/lib/clinic-media";

/**
 * Layered photo collage: images overlap each other in a fixed-ratio stage.
 * Positions are percentage based so the layout survives print / PDF scaling.
 */
type Slot = { x: number; y: number; w: number; r: number };

/** Hand-tuned overlapping arrangements, indexed by photo count. */
const PRESETS: Slot[][] = [
  [],
  [{ x: 50, y: 50, w: 78, r: 0 }],
  [
    { x: 36, y: 42, w: 58, r: -3 },
    { x: 68, y: 62, w: 52, r: 3 },
  ],
  [
    { x: 32, y: 38, w: 52, r: -4 },
    { x: 66, y: 34, w: 44, r: 3 },
    { x: 52, y: 72, w: 56, r: 1.5 },
  ],
  [
    { x: 28, y: 30, w: 46, r: -4 },
    { x: 70, y: 26, w: 42, r: 3 },
    { x: 30, y: 72, w: 44, r: 2.5 },
    { x: 72, y: 70, w: 48, r: -2 },
  ],
  [
    { x: 26, y: 28, w: 42, r: -5 },
    { x: 66, y: 22, w: 38, r: 3 },
    { x: 50, y: 52, w: 46, r: -1 },
    { x: 24, y: 76, w: 40, r: 3 },
    { x: 74, y: 72, w: 42, r: -3 },
  ],
];

function slotFor(i: number, total: number): Slot {
  const preset = PRESETS[Math.min(total, PRESETS.length - 1)];
  if (preset && preset[i]) return preset[i]!;
  // Beyond the presets: keep spiralling around the stage.
  const k = i - (PRESETS[PRESETS.length - 1]?.length ?? 0);
  const angle = (k * 2.399) % (Math.PI * 2);
  return {
    x: 50 + Math.cos(angle) * 26,
    y: 50 + Math.sin(angle) * 24,
    w: 38,
    r: (k % 2 ? 1 : -1) * (2 + (k % 3)),
  };
}

export function PhotoCollage({
  items,
  ratio = "4 / 3",
  className = "",
}: {
  items: (MediaItem | { url: string; alt?: string; caption?: string })[];
  /** CSS aspect-ratio for the collage stage. */
  ratio?: string;
  className?: string;
}) {
  if (!items.length) return null;
  return (
    <div className={`relative w-full ${className}`} style={{ aspectRatio: ratio }}>
      {items.map((m, i) => {
        const s = slotFor(i, items.length);
        return (
          <span
            key={`${m.url}-${i}`}
            className="absolute overflow-hidden rounded-[0.9rem] border border-background bg-background shadow-[0_10px_28px_-14px_rgba(0,0,0,0.55)]"
            style={{
              left: `${s.x}%`,
              top: `${s.y}%`,
              width: `${s.w}%`,
              aspectRatio: "4 / 3",
              transform: `translate(-50%, -50%) rotate(${s.r}deg)`,
              zIndex: 10 + i,
            }}
          >
            <img
              src={m.url}
              alt={("alt" in m && m.alt) || m.caption || "Clinic photo"}
              className="h-full w-full"
              style={mediaStyle(m as MediaItem)}
            />
          </span>
        );
      })}
    </div>
  );
}
