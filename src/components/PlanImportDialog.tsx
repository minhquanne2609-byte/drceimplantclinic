import { useEffect, useRef, useState } from "react";
import { ImageUp, Loader2, X, AlertTriangle, Check } from "lucide-react";
import { extractPlanFromImage, type ImportedPlan } from "@/lib/plan-import";

export type ReviewedRow = {
  key: string;
  use: boolean;
  name: string;
  matched: boolean;
  tooth: string;
  qty: number;
  unitPriceVnd: number | null;
};
export type ReviewedPhase = { key: string; title: string; rows: ReviewedRow[] };

export type ImportResult = {
  patientName: string | null;
  mode: "replace" | "append";
  phases: { title: string | null; rows: { name: string; tooth: string; qty: number; unitPriceVnd: number | null }[] }[];
};

type Props = {
  catalogNames: string[];
  onApply: (result: ImportResult) => void;
};

const CODE_KEY = "dci-import-code";
let seq = 0;
const k = () => `i${++seq}`;

/** Downscale + re-encode so phone photos stay well under the upload limit. */
async function prepareImage(file: File): Promise<{ base64: string; mediaType: "image/jpeg"; preview: string }> {
  const bmp = await createImageBitmap(file);
  const MAX = 1800;
  const scale = Math.min(1, MAX / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not process the image.");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  const dataUrl = canvas.toDataURL("image/jpeg", 0.88);
  return { base64: dataUrl.split(",")[1] ?? "", mediaType: "image/jpeg", preview: dataUrl };
}

export function PlanImportButton({ catalogNames, onApply }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [prepared, setPrepared] = useState<{ base64: string; mediaType: "image/jpeg" } | null>(null);
  const [patientName, setPatientName] = useState("");
  const [applyName, setApplyName] = useState(true);
  const [phases, setPhases] = useState<ReviewedPhase[] | null>(null);
  const [mode, setMode] = useState<"replace" | "append">("replace");
  const fileRef = useRef<HTMLInputElement | null>(null);

  const reset = () => {
    setBusy(false);
    setError("");
    setPreview(null);
    setPrepared(null);
    setPatientName("");
    setApplyName(true);
    setPhases(null);
    setMode("replace");
  };
  const close = () => {
    setOpen(false);
    reset();
  };

  const loadFile = async (file: File | undefined | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file (JPG, PNG, WebP…).");
      return;
    }
    setError("");
    setPhases(null);
    try {
      const p = await prepareImage(file);
      setPreview(p.preview);
      setPrepared({ base64: p.base64, mediaType: p.mediaType });
    } catch {
      setError("Could not open this image. Try a JPG or PNG.");
    }
  };

  // Ctrl+V a screenshot while the dialog is open.
  useEffect(() => {
    if (!open) return;
    const onPaste = (e: ClipboardEvent) => {
      const f = Array.from(e.clipboardData?.files ?? []).find((x) => x.type.startsWith("image/"));
      if (f) {
        e.preventDefault();
        void loadFile(f);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [open]);

  const toReview = (plan: ImportedPlan) => {
    const lower = new Map(catalogNames.map((n) => [n.trim().toLowerCase(), n]));
    setPatientName(plan.patientName ?? "");
    setApplyName(!!plan.patientName);
    setPhases(
      plan.phases.map((p, i) => ({
        key: k(),
        title: p.title ?? `Phase ${i + 1}`,
        rows: p.rows.map((r) => {
          const exact = r.catalogName ? lower.get(r.catalogName.trim().toLowerCase()) : undefined;
          return {
            key: k(),
            use: true,
            name: exact ?? r.name,
            matched: !!exact,
            tooth: r.tooth,
            qty: r.qty,
            unitPriceVnd: r.unitPriceVnd,
          };
        }),
      })),
    );
  };

  const read = async (code?: string) => {
    if (!prepared) return;
    setBusy(true);
    setError("");
    try {
      const plan = await extractPlanFromImage({
        data: {
          imageBase64: prepared.base64,
          mediaType: prepared.mediaType,
          catalogNames,
          accessCode: code ?? (typeof localStorage !== "undefined" ? (localStorage.getItem(CODE_KEY) ?? "") : ""),
        },
      });
      if (!plan.patientName && plan.phases.length === 0) {
        setError("Nothing recognisable was found. Try a sharper or closer image.");
      } else {
        toReview(plan);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.includes("ACCESS_CODE_REQUIRED")) {
        const entered = window.prompt("Enter the import access code:");
        if (entered) {
          try {
            localStorage.setItem(CODE_KEY, entered);
          } catch {
            /* ignore */
          }
          setBusy(false);
          return read(entered);
        }
        setError("An access code is required for this feature.");
      } else {
        setError(msg || "Something went wrong while reading the image.");
      }
    } finally {
      setBusy(false);
    }
  };

  const updateRow = (pk: string, rk: string, patch: Partial<ReviewedRow>) =>
    setPhases((ps) =>
      ps
        ? ps.map((p) => (p.key === pk ? { ...p, rows: p.rows.map((r) => (r.key === rk ? { ...r, ...patch } : r)) } : p))
        : ps,
    );

  const chosen = phases?.reduce((n, p) => n + p.rows.filter((r) => r.use && r.name.trim()).length, 0) ?? 0;

  const apply = () => {
    if (!phases) return;
    onApply({
      patientName: applyName && patientName.trim() ? patientName.trim() : null,
      mode,
      phases: phases
        .map((p) => ({
          title: p.title.trim() || null,
          rows: p.rows
            .filter((r) => r.use && r.name.trim())
            .map((r) => ({
              name: r.name.trim(),
              tooth: r.tooth.trim(),
              qty: Math.max(1, Math.round(Number(r.qty) || 1)),
              unitPriceVnd: r.unitPriceVnd,
            })),
        }))
        .filter((p) => p.rows.length > 0),
    });
    close();
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="no-print print:hidden px-4 py-2 rounded-full border border-primary text-primary text-base font-semibold hover:bg-primary hover:text-primary-foreground transition flex items-center gap-1.5"
        title="Upload a photo/screenshot of a treatment plan and fill in the patient name and services automatically"
      >
        <ImageUp size={16} /> Import from photo
      </button>

      {open && (
        <div className="no-print print:hidden fixed inset-0 z-[80] bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl bg-card border border-border shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <div>
                <h2 className="font-bold text-primary text-lg">Import treatment plan from a photo</h2>
                <p className="text-xs text-muted-foreground">
                  Upload (or paste with Ctrl+V) a photo or screenshot. You can review and fix everything before it is added.
                </p>
              </div>
              <button onClick={close} className="p-1.5 rounded-full hover:bg-muted" aria-label="Close">
                <X size={18} />
              </button>
            </div>

            <div className="overflow-y-auto px-6 py-5 space-y-5">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  void loadFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />

              {!phases && (
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    void loadFile(e.dataTransfer.files?.[0]);
                  }}
                  className="rounded-xl border-2 border-dashed border-border p-6 text-center"
                >
                  {preview ? (
                    <img src={preview} alt="Selected" className="mx-auto max-h-72 rounded-lg border border-border" />
                  ) : (
                    <p className="text-muted-foreground text-sm">Drop an image here, paste a screenshot, or choose a file.</p>
                  )}
                  <div className="mt-4 flex justify-center gap-3">
                    <button
                      onClick={() => fileRef.current?.click()}
                      className="px-4 py-2 rounded-full border border-border text-sm font-semibold hover:bg-muted"
                    >
                      {preview ? "Choose another image" : "Choose image"}
                    </button>
                    <button
                      onClick={() => void read()}
                      disabled={!prepared || busy}
                      className="px-5 py-2 rounded-full bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {busy ? <Loader2 size={15} className="animate-spin" /> : null}
                      {busy ? "Reading…" : "Read image"}
                    </button>
                  </div>
                </div>
              )}

              {error && (
                <div className="flex items-start gap-2 rounded-lg bg-destructive/10 text-destructive px-3 py-2 text-sm">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" /> <span>{error}</span>
                </div>
              )}

              {phases && (
                <>
                  <div className="rounded-xl border border-border p-4">
                    <label className="flex items-center gap-2 text-sm font-semibold">
                      <input type="checkbox" checked={applyName} onChange={(e) => setApplyName(e.target.checked)} />
                      Fill in patient name
                    </label>
                    <input
                      value={patientName}
                      onChange={(e) => setPatientName(e.target.value)}
                      placeholder="Patient name"
                      className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-base"
                    />
                  </div>

                  {phases.map((p) => (
                    <div key={p.key} className="rounded-xl border border-border overflow-hidden">
                      <input
                        value={p.title}
                        onChange={(e) =>
                          setPhases((ps) => ps && ps.map((x) => (x.key === p.key ? { ...x, title: e.target.value } : x)))
                        }
                        className="w-full bg-muted px-4 py-2.5 font-bold text-primary"
                      />
                      <div className="divide-y divide-border">
                        {p.rows.map((r) => (
                          <div key={r.key} className="flex items-center gap-2 px-3 py-2">
                            <input
                              type="checkbox"
                              checked={r.use}
                              onChange={(e) => updateRow(p.key, r.key, { use: e.target.checked })}
                            />
                            <input
                              value={r.name}
                              onChange={(e) => updateRow(p.key, r.key, { name: e.target.value, matched: false })}
                              className={`flex-1 min-w-0 rounded-md border px-2 py-1.5 text-sm ${
                                r.matched ? "border-border" : "border-amber-400 bg-amber-50"
                              }`}
                            />
                            <span
                              className="w-[5.5rem] shrink-0 text-[11px] leading-tight"
                              title={r.matched ? "Matched a service in your catalog" : "Not in your catalog — added as typed, price 0"}
                            >
                              {r.matched ? (
                                <span className="text-emerald-700 flex items-center gap-0.5">
                                  <Check size={12} /> In catalog
                                </span>
                              ) : (
                                <span className="text-amber-700">Not in catalog</span>
                              )}
                            </span>
                            <input
                              value={r.tooth}
                              onChange={(e) => updateRow(p.key, r.key, { tooth: e.target.value })}
                              placeholder="Teeth"
                              className="w-28 shrink-0 rounded-md border border-border px-2 py-1.5 text-sm"
                            />
                            <input
                              type="number"
                              min={1}
                              value={r.qty}
                              onChange={(e) => updateRow(p.key, r.key, { qty: Number(e.target.value) })}
                              className="w-16 shrink-0 rounded-md border border-border px-2 py-1.5 text-sm"
                              title="Quantity"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  <div className="flex flex-wrap items-center gap-5 text-sm">
                    <label className="flex items-center gap-2">
                      <input type="radio" checked={mode === "replace"} onChange={() => setMode("replace")} />
                      Replace the current phases
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="radio" checked={mode === "append"} onChange={() => setMode("append")} />
                      Add after the current phases
                    </label>
                  </div>
                </>
              )}
            </div>

            {phases && (
              <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-border shrink-0">
                <button onClick={reset} className="px-4 py-2 rounded-full border border-border text-sm font-semibold hover:bg-muted">
                  Start over
                </button>
                <button
                  onClick={apply}
                  disabled={chosen === 0 && !(applyName && patientName.trim())}
                  className="px-5 py-2 rounded-full bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50"
                >
                  Import {chosen} service{chosen === 1 ? "" : "s"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
