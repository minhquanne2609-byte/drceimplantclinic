import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Eye, EyeOff, FileText, Loader2, Trash2, Upload } from "lucide-react";
import { isPdfUrl, mediaStyle, openMediaFile, shownLimit, uploadClinicMedia, visibleMedia, type MediaItem } from "@/lib/clinic-media";

/**
 * Clinic-default image library for one content block.
 * Patient-specific clinical photos are never managed here.
 */
export function MediaManager({
  label,
  items,
  onChange,
  max,
  allowPdf,
  compact,
}: {
  label: string;
  items: MediaItem[];
  onChange: (next: MediaItem[]) => void;
  max?: number;
  /** When true, each page can also be replaced with a PDF file instead of an image. */
  allowPdf?: boolean;
  /** Compact file-list layout (used for price lists) instead of large image cards. */
  compact?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [replaceIndex, setReplaceIndex] = useState<number | null>(null);


  const patch = (i: number, next: Partial<MediaItem>) =>
    onChange(items.map((m, j) => (j === i ? { ...m, ...next } : m)));

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    const a = next[i]!;
    next[i] = next[j]!;
    next[j] = a;
    onChange(next);
  };

  const cap = shownLimit(items, max);

  const toggleHidden = (i: number) => {
    const item = items[i]!;
    if (item.hidden && cap !== undefined && visibleMedia(items).length >= cap) {
      setError(`Only ${cap} image${cap > 1 ? "s" : ""} can be shown here — raise "Show" or hide another one first.`);
      return;
    }
    setError("");
    patch(i, { hidden: !item.hidden });
  };

  const onFiles = async (files: File[]) => {
    setBusy(true);
    setError("");
    try {
      if (replaceIndex !== null) {
        const uploaded = await uploadClinicMedia(files[0]!);
        patch(replaceIndex, { url: uploaded.url, path: uploaded.path });
      } else {
        let next = [...items];
        let hiddenCount = 0;
        for (const file of files) {
          const uploaded = await uploadClinicMedia(file);
          const full = cap !== undefined && visibleMedia(next).length >= cap;
          if (full) hiddenCount += 1;
          next = [...next, { ...uploaded, hidden: full }];
        }
        onChange(next);
        if (hiddenCount > 0)
          setError(
            `${hiddenCount} image${hiddenCount > 1 ? "s were" : " was"} added as hidden — only ${cap} image${cap && cap > 1 ? "s" : ""} can be shown here. Increase "Show" to display more.`,
          );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setReplaceIndex(null);
      setBusy(false);
    }
  };


  const shown = visibleMedia(items).length;
  const layout = items[0]?.layout === "collage" ? "collage" : "grid";
  const columns = Math.min(4, Math.max(1, items[0]?.columns ?? 2));
  const setLayout = (next: "grid" | "collage") =>
    onChange(items.map((m) => ({ ...m, layout: next })));
  const setColumns = (next: number) => onChange(items.map((m) => ({ ...m, columns: next })));
  const setShowCount = (next: number) =>
    onChange(items.map((m) => ({ ...m, showCount: Math.max(1, next) })));

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
          <span className="ml-2 normal-case tracking-normal text-[11px] font-medium text-muted-foreground/80">
            library: {items.length} · shown: {shown}
            {cap !== undefined ? ` / ${cap}` : ""}
          </span>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="flex items-center gap-1 rounded-full border border-border px-2 py-0.5">
            <span className="text-[11px] font-semibold text-muted-foreground">Show</span>
            <button
              type="button"
              onClick={() => setShowCount((cap ?? shown) - 1)}
              className="rounded-full px-1.5 text-sm font-bold text-muted-foreground hover:text-foreground"
              aria-label="Show fewer images"
            >
              −
            </button>
            <span className="min-w-4 text-center text-[11px] font-bold tabular-nums">{cap ?? shown}</span>
            <button
              type="button"
              onClick={() => setShowCount((cap ?? shown) + 1)}
              className="rounded-full px-1.5 text-sm font-bold text-muted-foreground hover:text-foreground"
              aria-label="Show more images"
            >
              +
            </button>
          </div>
          {items.length > 1 && (
            <>
              <div className="flex items-center gap-1 rounded-full border border-border p-0.5">
                {(["grid", "collage"] as const).map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setLayout(l)}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ${
                      layout === l ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {l === "grid" ? "Grid" : "Collage"}
                  </button>
                ))}
              </div>
              {layout === "grid" && (
                <div className="flex items-center gap-1 rounded-full border border-border p-0.5">
                  {[1, 2, 3, 4].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColumns(c)}
                      className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                        columns === c ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                      }`}
                      title={`${c} per row`}
                    >
                      {c}×
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
          <button
            type="button"
            onClick={() => {
              setReplaceIndex(null);
              fileRef.current?.click();
            }}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-full border border-primary px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary hover:text-primary-foreground disabled:opacity-50"
          >
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
{allowPdf ? "Add images or PDF" : "Add images"}
          </button>
        </div>
      </div>
      {allowPdf && (
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          Each page can be a photo or a PDF file — a PDF takes the place of that page.
        </p>
      )}

      <input
        ref={fileRef}
        type="file"
accept={allowPdf ? "image/*,.pdf,application/pdf" : "image/*"}
        multiple
        className="hidden"
        onChange={(e) => {
          const fs = Array.from(e.target.files ?? []);
          e.currentTarget.value = "";
          if (fs.length) void onFiles(replaceIndex !== null ? [fs[0]!] : fs);
        }}
      />



      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}

      {compact ? (
        <ul className="mt-3 divide-y divide-border rounded-xl border border-border">
          {items.map((m, i) => {
            const isPdf = isPdfUrl(m.url);
            return (
              <li key={`${m.url}-${i}`} className={`flex items-center gap-3 p-2.5 ${m.hidden ? "opacity-55" : ""}`}>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted/40">
                  {isPdf ? (
                    <FileText size={16} className="text-primary" />
                  ) : (
                    <img src={m.url} alt="" className="h-full w-full object-cover" />
                  )}
                </span>
<button
  type="button"
  onClick={() => void openMediaFile(m.url, m.caption?.trim() || `page-${i + 1}.pdf`)}
  className="min-w-0 flex-1 truncate text-left text-xs font-semibold text-primary hover:underline"
>
  {m.caption?.trim() || `Page ${i + 1}`} — {isPdf ? "PDF, open" : "image, open"}
</button>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${m.hidden ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground"}`}
                >
                  {m.hidden ? "Hidden" : "Shown"}
                </span>
                <button
                  type="button"
                  onClick={() => toggleHidden(i)}
                  className="rounded-md border border-border p-1 hover:bg-muted"
                  aria-label={m.hidden ? "Show" : "Hide"}
                >
                  {m.hidden ? <Eye size={12} /> : <EyeOff size={12} />}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setReplaceIndex(i);
                    fileRef.current?.click();
                  }}
                  className="rounded-md border border-border px-2 py-1 text-[11px] font-semibold hover:bg-muted"
                >
                  Replace
                </button>
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  className="rounded-md border border-border p-1 hover:bg-muted"
                  aria-label="Move up"
                >
                  <ArrowLeft size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  className="rounded-md border border-border p-1 hover:bg-muted"
                  aria-label="Move down"
                >
                  <ArrowRight size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => onChange(items.filter((_, j) => j !== i))}
                  className="rounded-md p-1 text-destructive hover:bg-destructive/10"
                  aria-label="Remove"
                >
                  <Trash2 size={13} />
                </button>
              </li>
            );
          })}
          {items.length === 0 && (
            <li className="p-3 text-xs text-muted-foreground">No files yet — add images or a PDF.</li>
          )}
        </ul>
      ) : (
      <div className="mt-3 grid gap-4 sm:grid-cols-2">

        {items.map((m, i) => {
          const isPdf = isPdfUrl(m.url);
          return (
          <div
            key={`${m.url}-${i}`}
            className={`rounded-xl border p-3 ${m.hidden ? "border-dashed border-border bg-muted/10" : "border-primary/40 bg-muted/30"}`}
          >
            <div className="relative w-full overflow-hidden rounded-lg bg-background" style={{ aspectRatio: "16 / 9" }}>
{isPdf ? (
<button
  type="button"
  onClick={() => void openMediaFile(m.url, m.caption?.trim() || `page-${i + 1}.pdf`)}

                  className={`flex h-full w-full flex-col items-center justify-center gap-1 text-primary ${m.hidden ? "opacity-40 grayscale" : ""}`}
                >
                  <FileText size={26} />
                  <span className="text-[11px] font-semibold">PDF document — open</span>
                </button>
              ) : (
                <img
                  src={m.url}
                  alt={m.alt || "Clinic image"}
                  className={`h-full w-full ${m.hidden ? "opacity-40 grayscale" : ""}`}
                  style={mediaStyle(m)}
                />
              )}
              <span
                className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${m.hidden ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground"}`}
              >
                {m.hidden ? "Hidden" : "Shown"}
              </span>
              {isPdf && (
                <span className="absolute right-2 top-2 rounded-full bg-background/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  PDF
                </span>
              )}
            </div>


            <div className="mt-2 flex items-center gap-1">
              <button
                type="button"
                onClick={() => toggleHidden(i)}
                className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-semibold hover:bg-muted"
                aria-label={m.hidden ? "Show image" : "Hide image"}
              >
                {m.hidden ? <Eye size={12} /> : <EyeOff size={12} />}
                {m.hidden ? "Show" : "Hide"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setReplaceIndex(i);
                  fileRef.current?.click();
                }}
                className="rounded-md border border-border px-2 py-1 text-[11px] font-semibold hover:bg-muted"
              >
                Replace
              </button>
              <button
                type="button"
                onClick={() => move(i, -1)}
                className="rounded-md border border-border p-1 hover:bg-muted"
                aria-label="Move left"
              >
                <ArrowLeft size={12} />
              </button>
              <button
                type="button"
                onClick={() => move(i, 1)}
                className="rounded-md border border-border p-1 hover:bg-muted"
                aria-label="Move right"
              >
                <ArrowRight size={12} />
              </button>
              <button
                type="button"
                onClick={() => onChange(items.filter((_, j) => j !== i))}
                className="ml-auto rounded-md p-1 text-destructive hover:bg-destructive/10"
                aria-label="Remove image"
              >
                <Trash2 size={13} />
              </button>
            </div>
            <input
              value={m.caption ?? ""}
              onChange={(e) => patch(i, { caption: e.target.value })}
              placeholder="Caption"
              className="mt-2 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
            />
            <input
              value={m.alt ?? ""}
              onChange={(e) => patch(i, { alt: e.target.value })}
              placeholder="Alt text (accessibility)"
              className="mt-1.5 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
            />
{!isPdf && <CropEditor item={m} onPatch={(next) => patch(i, next)} />}

          </div>
          );
        })}
      </div>
      )}

    </div>
  );
}

/** Drag-to-position + zoom crop tool for one image. */
function CropEditor({
  item,
  onPatch,
}: {
  item: MediaItem;
  onPatch: (next: Partial<MediaItem>) => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [x, y] = (item.position ?? "50% 50%")
    .split(" ")
    .map((v) => Number(v.replace("%", "")) || 50);
  const zoom = Math.max(item.zoom ?? 1, 1);

  const setPos = (nx: number, ny: number) =>
    onPatch({
      position: `${Math.min(100, Math.max(0, Math.round(nx)))}% ${Math.min(100, Math.max(0, Math.round(ny)))}%`,
    });

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    const box = boxRef.current?.getBoundingClientRect();
    if (!box) return;
    // Dragging the photo moves the visible window in the opposite direction.
    setPos((x ?? 50) - (e.movementX / box.width) * 140, (y ?? 50) - (e.movementY / box.height) * 140);
  };

  return (
    <div className="mt-3 rounded-lg border border-border bg-background/60 p-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Crop &amp; alignment
        </span>
        <button
          type="button"
          onClick={() => onPatch({ position: "50% 50%", zoom: 1 })}
          className="rounded-md border border-border px-2 py-0.5 text-[10px] font-semibold hover:bg-muted"
        >
          Reset
        </button>
      </div>

      <div
        ref={boxRef}
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          setDragging(true);
        }}
        onPointerUp={() => setDragging(false)}
        onPointerLeave={() => setDragging(false)}
        onPointerMove={onPointerMove}
        className={`relative mt-2 w-full overflow-hidden rounded-md bg-muted ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
        style={{ aspectRatio: "16 / 9", touchAction: "none" }}
      >
        <img
          src={item.url}
          alt=""
          draggable={false}
          className="pointer-events-none h-full w-full select-none"
          style={mediaStyle(item)}
        />
        <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <span key={i} className="border border-white/25" />
          ))}
        </div>
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">Drag the photo to align it inside the frame.</p>

      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
          Fit
          <select
            value={item.fit ?? "cover"}
            onChange={(e) => onPatch({ fit: e.target.value as "cover" | "contain" })}
            className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-[11px]"
          >
            <option value="cover">Fill frame (crop)</option>
            <option value="contain">Fit whole image</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
          Zoom
          <input
            type="range"
            min={100}
            max={250}
            step={5}
            value={Math.round(zoom * 100)}
            onChange={(e) => onPatch({ zoom: Number(e.target.value) / 100 })}
            className="w-full"
          />
          <span className="tabular-nums">{Math.round(zoom * 100)}%</span>
        </label>
        <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
          Left / right
          <input
            type="range"
            min={0}
            max={100}
            value={x ?? 50}
            onChange={(e) => setPos(Number(e.target.value), y ?? 50)}
            className="w-full"
          />
        </label>
        <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
          Up / down
          <input
            type="range"
            min={0}
            max={100}
            value={y ?? 50}
            onChange={(e) => setPos(x ?? 50, Number(e.target.value))}
            className="w-full"
          />
        </label>
        <label className="flex items-center gap-2 text-[11px] text-muted-foreground sm:col-span-2">
          Frame height (print)
          <input
            type="range"
            min={18}
            max={70}
            step={1}
            value={item.heightMm ?? 27}
            onChange={(e) => onPatch({ heightMm: Number(e.target.value) })}
            className="w-full"
          />
          <span className="tabular-nums">{item.heightMm ?? 27}mm</span>
        </label>
      </div>
    </div>
  );
}
