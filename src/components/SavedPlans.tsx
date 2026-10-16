import { useEffect, useMemo, useRef, useState } from "react";
import {
  Save,
  FolderOpen,
  X,
  Loader2,
  Trash2,
  Maximize2,
  Minimize2,
  RotateCcw,
  Check,
  Search,
  Sparkles,
} from "lucide-react";
import {
  createSavedPlan,
  deleteSavedPlan,
  listSavedPlans,
  loadSavedPlan,
  updateSavedPlan,
  type SavedPlanMeta,
} from "@/lib/saved-plans";
import { useZoomCounterScale } from "@/hooks/use-zoom-counter-scale";

// Plans are kept indefinitely (see the saved_plans_no_expiry migration), so
// the list only ever grows. Past this many, surface a one-click "clean up"
// option instead of letting the list silently get slower to load/search
// forever — the visitor can accept, adjust the selection, or ignore it.
const CLUTTER_THRESHOLD = 80;
// How many of the oldest (by last-updated) plans get pre-selected when
// cleanup starts — a meaningful dent without pre-selecting so many that
// approving the default feels reckless.
const CLEANUP_BATCH_SIZE = 20;

type Props = {
  /** Current editable state of the whole page. */
  getSnapshot: () => unknown;
  /** Apply a previously saved snapshot back into the page. */
  restore: (data: any) => void;
  patientName: string;
};

const DRAFT_KEY = "dci-plan-autosave-v1";

type Draft = { data: unknown; at: number; id: string | null; name: string };

function readDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}

/** Lowercase + strip diacritics so searching "an" also finds "Ẩn", "Ăn", etc. */
function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .trim();
}

export function SavedPlansBar({ getSnapshot, restore, patientName }: Props) {

  const [open, setOpen] = useState(false);
  const [plans, setPlans] = useState<SavedPlanMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [currentName, setCurrentName] = useState<string>("");
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [autoSaving, setAutoSaving] = useState(false);
  const [recover, setRecover] = useState<Draft | null>(null);
  const [cleanupMode, setCleanupMode] = useState(false);
  const [cleanupSelected, setCleanupSelected] = useState<Set<string>>(new Set());
  const [cleaningUp, setCleaningUp] = useState(false);

  const lastJsonRef = useRef<string>("");
  const savedJsonRef = useRef<string>("");
  const cloudTimer = useRef<number | null>(null);
  const snapRef = useRef(getSnapshot);
  snapRef.current = getSnapshot;


  /** Offer to recover local work from a previous session. */
  useEffect(() => {
    const d = readDraft();
    if (d && d.data) setRecover(d);
  }, []);

  /** Watch for changes → local autosave immediately, cloud autosave debounced. */
  useEffect(() => {
    const tick = () => {
      let json = "";
      try {
        json = JSON.stringify(snapRef.current());
      } catch {
        return;
      }
      if (json === lastJsonRef.current) return;
      lastJsonRef.current = json;
      if (!savedJsonRef.current) savedJsonRef.current = json;

      // Local backup — always, even without a cloud plan.
      try {
        localStorage.setItem(
          DRAFT_KEY,
          JSON.stringify({ data: JSON.parse(json), at: Date.now(), id: currentId, name: currentName }),
        );
      } catch {
        /* storage full — ignore */
      }

      const isDirty = json !== savedJsonRef.current;
      setDirty(isDirty);

      if (isDirty && currentId) {
        if (cloudTimer.current) window.clearTimeout(cloudTimer.current);
        cloudTimer.current = window.setTimeout(() => {
          void autoSaveCloud();
        }, 4000);
      }
    };
    const t = window.setInterval(tick, 1500);
    return () => {
      window.clearInterval(t);
      if (cloudTimer.current) window.clearTimeout(cloudTimer.current);
    };
  }, [currentId, currentName]);

  /** Warn before leaving with unsaved cloud changes. */
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const autoSaveCloud = async () => {
    if (!currentId) return;
    setAutoSaving(true);
    try {
      const snapshot = getSnapshot();
      await updateSavedPlan(currentId, currentName || patientName || "Untitled plan", patientName, snapshot);
      savedJsonRef.current = JSON.stringify(snapshot);
      setDirty(false);
      setLastSavedAt(Date.now());
    } catch {
      /* keep the local backup; try again on the next change */
    } finally {
      setAutoSaving(false);
    }
  };

  const refresh = async () => {
    setLoading(true);
    try {
      setPlans(await listSavedPlans());
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Could not load saved plans.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) void refresh();
  }, [open]);

  // Reset the search box and any in-progress cleanup selection each time
  // the panel is opened fresh.
  useEffect(() => {
    if (open) {
      setQuery("");
      setCleanupMode(false);
      setCleanupSelected(new Set());
    }
  }, [open]);

  const filteredPlans = useMemo(() => {
    const q = normalize(query);
    if (!q) return plans;
    return plans.filter((p) => normalize(p.name).includes(q) || normalize(p.patient_name || "").includes(q));
  }, [plans, query]);

  const save = async (asNew: boolean) => {
    const suggested = currentName || patientName || "Untitled plan";
    const name =
      asNew || !currentId
        ? (window.prompt("Save this plan as:", suggested) ?? "").trim()
        : currentName;
    if (!name) return;
    setSaving(true);
    setStatus("");
    try {
      const snapshot = getSnapshot();
      if (!asNew && currentId) {
        await updateSavedPlan(currentId, name, patientName, snapshot);
      } else {
        const id = await createSavedPlan(name, patientName, snapshot);
        setCurrentId(id);
      }
      setCurrentName(name);
      savedJsonRef.current = JSON.stringify(snapshot);
      setDirty(false);
      setLastSavedAt(Date.now());
      setStatus(`Saved “${name}” · autosave is on`);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Could not save the plan.");
    } finally {
      setSaving(false);
      setTimeout(() => setStatus(""), 4000);
    }
  };

  const open_ = async (id: string) => {
    setLoading(true);
    try {
      const plan = await loadSavedPlan(id);
      restore(plan.data);
      setCurrentId(plan.id);
      setCurrentName(plan.name);
      savedJsonRef.current = JSON.stringify(plan.data);
      lastJsonRef.current = savedJsonRef.current;
      setDirty(false);
      setLastSavedAt(Date.now());
      setOpen(false);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Could not open this plan.");
    } finally {
      setLoading(false);
    }
  };


  // Keep the popover at its normal on-screen size even when the whole page is
  // zoomed way out (e.g. to see the full treatment plan at once), so its rows
  // stay readable and clickable — same counter-scale the service-search
  // dropdown uses. Only the anchored popover, not the full-screen view.
  const zoomCounterScale = useZoomCounterScale(open && !expanded);

  // Close the popover when clicking outside it. The full-screen "expanded"
  // view is closed only via its own close button.
  const anchorRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open || expanded) return;
    const onDown = (e: MouseEvent) => {
      if (anchorRef.current && !anchorRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, expanded]);

  const remove = async (p: SavedPlanMeta) => {
    if (!window.confirm(`Delete “${p.name}”? This cannot be undone.`)) return;
    setDeletingId(p.id);
    try {
      await deleteSavedPlan(p.id);
      setPlans((prev) => prev.filter((x) => x.id !== p.id));
      if (currentId === p.id) {
        setCurrentId(null);
        setCurrentName("");
      }
      setStatus(`Deleted “${p.name}”`);
      setTimeout(() => setStatus(""), 3000);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Could not delete this plan.");
    } finally {
      setDeletingId(null);
    }
  };

  /** Enter cleanup mode with the oldest (least-recently-updated) plans pre-selected. */
  const startCleanup = () => {
    const oldest = [...plans]
      .sort((a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime())
      .slice(0, CLEANUP_BATCH_SIZE)
      .map((p) => p.id);
    setCleanupSelected(new Set(oldest));
    setCleanupMode(true);
  };

  const cancelCleanup = () => {
    setCleanupMode(false);
    setCleanupSelected(new Set());
  };

  const toggleCleanupSelect = (id: string) => {
    setCleanupSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const confirmCleanup = async () => {
    const ids = Array.from(cleanupSelected);
    if (ids.length === 0) return;
    if (!window.confirm(`Delete ${ids.length} selected plan${ids.length === 1 ? "" : "s"}? This cannot be undone.`))
      return;
    setCleaningUp(true);
    try {
      for (const id of ids) {
        await deleteSavedPlan(id);
      }
      setPlans((prev) => prev.filter((p) => !cleanupSelected.has(p.id)));
      if (currentId && cleanupSelected.has(currentId)) {
        setCurrentId(null);
        setCurrentName("");
      }
      setStatus(`Deleted ${ids.length} plan${ids.length === 1 ? "" : "s"}`);
      setTimeout(() => setStatus(""), 3000);
      cancelCleanup();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Could not delete the selected plans.");
    } finally {
      setCleaningUp(false);
    }
  };


  return (
    <>
      <div className="no-print print:hidden flex items-center gap-2.5">
        {currentId && (
          <button
            onClick={() => void save(false)}
            disabled={saving}
            className="px-4 py-2 rounded-full bg-primary/10 text-primary font-semibold text-base hover:bg-primary/20 transition disabled:opacity-50"
            title="Update the plan you are working on"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : "Update"}
          </button>
        )}
        <button
          onClick={() => void save(true)}
          disabled={saving}
          className="px-4 py-2 rounded-full bg-primary text-primary-foreground font-semibold text-base shadow-md shadow-primary/20 hover:brightness-110 transition disabled:opacity-50 flex items-center gap-1.5"
        >
          <Save size={16} /> Save
        </button>
        {/* Anchored so the list opens right below this button, in front of
            whatever is on the page (e.g. the hero photo), instead of a
            full-screen dimmed dialog. */}
        <div className="relative" ref={anchorRef}>
          <button
            onClick={() => setOpen((v) => !v)}
            className="px-4 py-2 rounded-full border border-border text-base font-semibold hover:bg-muted transition flex items-center gap-1.5"
          >
            <FolderOpen size={16} /> Saved plans
          </button>

          {open && !expanded && (
            <div
              className="no-print print:hidden absolute z-50 left-0 top-full mt-3 w-[26rem] max-w-[92vw] rounded-2xl border border-border bg-card shadow-2xl flex flex-col max-h-[75vh] overflow-hidden"
              style={
                zoomCounterScale > 1
                  ? { transform: `scale(${zoomCounterScale})`, transformOrigin: "top left" }
                  : undefined
              }
            >
              {/* Speech-bubble tail pointing back up at the button. */}
              <span
                className="absolute -top-[7px] left-6 w-3.5 h-3.5 bg-card border-l border-t border-border rotate-45"
                aria-hidden
              />
              <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
                <div>
                  <h2 className="font-bold text-primary">Saved treatment plans</h2>
                  <p className="text-xs text-muted-foreground">
                    Everyone with this link can open these plans. Kept indefinitely.
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setExpanded(true)}
                    className="p-1.5 rounded-full hover:bg-muted"
                    title="Expand to full screen — see many patients at once"
                  >
                    <Maximize2 size={16} />
                  </button>
                  <button onClick={() => setOpen(false)} className="p-1.5 rounded-full hover:bg-muted">
                    <X size={16} />
                  </button>
                </div>
              </div>

              {!cleanupMode && plans.length >= CLUTTER_THRESHOLD && (
                <div className="px-5 py-3 border-b border-border shrink-0 bg-accent/10 flex items-center justify-between gap-3">
                  <p className="text-xs text-foreground">
                    <strong>{plans.length} plans saved.</strong> Clearing out old ones can help this
                    list load faster.
                  </p>
                  <button
                    onClick={startCleanup}
                    className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold hover:brightness-110 transition"
                  >
                    <Sparkles size={12} /> Clean up
                  </button>
                </div>
              )}
              {cleanupMode && (
                <div className="px-5 py-3 border-b border-border shrink-0 bg-accent/10 flex items-center justify-between gap-3">
                  <p className="text-xs text-foreground">
                    <strong>{cleanupSelected.size} selected</strong> — oldest plans pre-checked, tick more or
                    uncheck any.
                  </p>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={cancelCleanup}
                      className="px-3 py-1.5 rounded-full border border-border text-xs font-semibold hover:bg-muted transition"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => void confirmCleanup()}
                      disabled={cleaningUp || cleanupSelected.size === 0}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-destructive text-destructive-foreground text-xs font-semibold hover:brightness-110 transition disabled:opacity-50"
                    >
                      {cleaningUp ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                      Delete {cleanupSelected.size}
                    </button>
                  </div>
                </div>
              )}

              <div className="px-5 py-3 border-b border-border shrink-0">
                <div className="relative">
                  <Search
                    size={15}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search by patient or plan name…"
                    className="w-full rounded-full border border-border bg-background pl-9 pr-9 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  {query && (
                    <button
                      onClick={() => setQuery("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-muted"
                      title="Clear search"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
                {!loading && (
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    {filteredPlans.length} of {plans.length} plan{plans.length === 1 ? "" : "s"}
                  </p>
                )}
              </div>

              <div className="overflow-auto flex-1 max-h-[55vh]">
                {loading && (
                  <div className="p-6 text-sm text-muted-foreground flex items-center gap-2">
                    <Loader2 size={14} className="animate-spin" /> Loading…
                  </div>
                )}
                {!loading && plans.length === 0 && (
                  <div className="p-6 text-sm text-muted-foreground">No saved plans yet.</div>
                )}
                {!loading && plans.length > 0 && filteredPlans.length === 0 && (
                  <div className="p-6 text-sm text-muted-foreground">No plans match “{query}”.</div>
                )}

                {!loading && filteredPlans.length > 0 && (
                  <div className="divide-y divide-border">
                    {filteredPlans.map((p) => (
                      <div
                        key={p.id}
                        className="w-full px-5 py-3 hover:bg-muted transition flex items-center justify-between gap-3"
                      >
                        {cleanupMode && (
                          <input
                            type="checkbox"
                            checked={cleanupSelected.has(p.id)}
                            onChange={() => toggleCleanupSelect(p.id)}
                            className="shrink-0 h-4 w-4 accent-destructive"
                            aria-label={`Select “${p.name}” for deletion`}
                          />
                        )}
                        <button
                          onClick={() => (cleanupMode ? toggleCleanupSelect(p.id) : void open_(p.id))}
                          className="min-w-0 flex-1 text-left"
                        >
                          <span className="block font-semibold truncate">{p.name}</span>
                          <span className="block text-xs text-muted-foreground truncate">
                            {p.patient_name ? `${p.patient_name} · ` : ""}
                            {new Date(p.updated_at).toLocaleString()}
                          </span>
                        </button>
                        {!cleanupMode && (
                          <button
                            onClick={() => void remove(p)}
                            disabled={deletingId === p.id}
                            className="shrink-0 p-1.5 rounded-full text-destructive hover:bg-destructive/10 transition disabled:opacity-50"
                            title="Delete this plan"
                          >
                            {deletingId === p.id ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <Trash2 size={14} />
                            )}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        <span className="text-sm text-muted-foreground flex items-center gap-1 min-w-[100px]">
          {autoSaving || saving ? (
            <>
              <Loader2 size={13} className="animate-spin" /> Saving…
            </>
          ) : dirty ? (
            currentId ? "Unsaved changes" : "Backed up on this device"
          ) : lastSavedAt ? (
            <>
              <Check size={13} className="text-accent" /> Saved{" "}
              {new Date(lastSavedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </>
          ) : null}
        </span>
      </div>

      {recover && (
        <div className="no-print print:hidden fixed bottom-5 left-5 z-50 max-w-sm rounded-xl bg-card border border-border shadow-2xl px-4 py-3 text-sm">
          <p className="font-semibold text-primary flex items-center gap-1.5">
            <RotateCcw size={14} /> Recover unsaved work?
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            A local backup from {new Date(recover.at).toLocaleString()} was found on this device.
          </p>
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => {
                restore(recover.data);
                if (recover.id) setCurrentId(recover.id);
                if (recover.name) setCurrentName(recover.name);
                lastJsonRef.current = JSON.stringify(recover.data);
                setRecover(null);
              }}
              className="px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-semibold"
            >
              Restore
            </button>
            <button
              onClick={() => {
                localStorage.removeItem(DRAFT_KEY);
                setRecover(null);
              }}
              className="px-3 py-1 rounded-full border border-border text-xs font-semibold"
            >
              Discard
            </button>
          </div>
        </div>
      )}





      {status && (
        <div className="no-print print:hidden fixed bottom-5 right-5 z-50 rounded-lg bg-card border border-border shadow-xl px-4 py-2 text-sm">
          {status}
        </div>
      )}

      {/* Full-screen mode (via the expand button) still uses a dimmed overlay,
          since its whole point is scanning many patients at once. */}
      {open && expanded && (
        <div className="no-print print:hidden fixed inset-0 z-50 flex items-stretch justify-stretch bg-black/60 backdrop-blur-sm overflow-auto p-0">
          <div className="w-full h-full bg-card border border-border shadow-2xl flex flex-col rounded-none">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
              <div>
                <h2 className="font-bold text-primary">Saved treatment plans</h2>
                <p className="text-xs text-muted-foreground">
                  Everyone with this link can open these plans. Kept indefinitely.
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setExpanded(false)}
                  className="p-1.5 rounded-full hover:bg-muted"
                  title="Shrink"
                >
                  <Minimize2 size={16} />
                </button>
                <button
                  onClick={() => {
                    setOpen(false);
                    setExpanded(false);
                  }}
                  className="p-1.5 rounded-full hover:bg-muted"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {!cleanupMode && plans.length >= CLUTTER_THRESHOLD && (
              <div className="px-5 py-3 border-b border-border shrink-0 bg-accent/10 flex items-center justify-between gap-3">
                <p className="text-sm text-foreground">
                  <strong>{plans.length} plans saved.</strong> Clearing out old ones can help this list
                  load faster.
                </p>
                <button
                  onClick={startCleanup}
                  className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-semibold hover:brightness-110 transition"
                >
                  <Sparkles size={14} /> Clean up
                </button>
              </div>
            )}
            {cleanupMode && (
              <div className="px-5 py-3 border-b border-border shrink-0 bg-accent/10 flex items-center justify-between gap-3">
                <p className="text-sm text-foreground">
                  <strong>{cleanupSelected.size} selected</strong> — oldest plans pre-checked, tick more or
                  uncheck any.
                </p>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={cancelCleanup}
                    className="px-4 py-2 rounded-full border border-border text-sm font-semibold hover:bg-muted transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => void confirmCleanup()}
                    disabled={cleaningUp || cleanupSelected.size === 0}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-destructive text-destructive-foreground text-sm font-semibold hover:brightness-110 transition disabled:opacity-50"
                  >
                    {cleaningUp ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    Delete {cleanupSelected.size}
                  </button>
                </div>
              </div>
            )}

            <div className="px-5 py-3 border-b border-border shrink-0">
              <div className="relative">
                <Search
                  size={15}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by patient or plan name…"
                  className="w-full rounded-full border border-border bg-background pl-9 pr-9 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
                {query && (
                  <button
                    onClick={() => setQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-muted"
                    title="Clear search"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              {!loading && (
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  {filteredPlans.length} of {plans.length} plan{plans.length === 1 ? "" : "s"}
                </p>
              )}
            </div>

            <div className="overflow-auto flex-1 max-h-none">
              {loading && (
                <div className="p-6 text-sm text-muted-foreground flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin" /> Loading…
                </div>
              )}
              {!loading && plans.length === 0 && (
                <div className="p-6 text-sm text-muted-foreground">No saved plans yet.</div>
              )}
              {!loading && plans.length > 0 && filteredPlans.length === 0 && (
                <div className="p-6 text-sm text-muted-foreground">
                  No plans match “{query}”.
                </div>
              )}

              {/* A grid so many patients are visible on screen at once, instead
                  of scrolling through them one row at a time. */}
              {!loading && filteredPlans.length > 0 && (
                <div className="p-5 grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {filteredPlans.map((p) => (
                    <div
                      key={p.id}
                      className={`rounded-xl border bg-background p-4 hover:shadow-md transition flex flex-col gap-2 ${
                        cleanupMode && cleanupSelected.has(p.id)
                          ? "border-destructive/50 bg-destructive/5"
                          : "border-border hover:border-primary/40"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {cleanupMode && (
                          <input
                            type="checkbox"
                            checked={cleanupSelected.has(p.id)}
                            onChange={() => toggleCleanupSelect(p.id)}
                            className="mt-1 shrink-0 h-4 w-4 accent-destructive"
                            aria-label={`Select “${p.name}” for deletion`}
                          />
                        )}
                        <button
                          onClick={() => (cleanupMode ? toggleCleanupSelect(p.id) : void open_(p.id))}
                          className="min-w-0 flex-1 text-left"
                        >
                          <span className="block font-semibold truncate">{p.name}</span>
                          <span className="block text-xs text-muted-foreground truncate mt-0.5">
                            {p.patient_name || "—"}
                          </span>
                          <span className="block text-[11px] text-muted-foreground truncate mt-1">
                            {new Date(p.updated_at).toLocaleString()}
                          </span>
                        </button>
                      </div>
                      {!cleanupMode && (
                        <div className="flex items-center justify-end mt-1">
                          <button
                            onClick={() => void remove(p)}
                            disabled={deletingId === p.id}
                            className="shrink-0 p-1.5 rounded-full text-destructive hover:bg-destructive/10 transition disabled:opacity-50"
                            title="Delete this plan"
                          >
                            {deletingId === p.id ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <Trash2 size={14} />
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
