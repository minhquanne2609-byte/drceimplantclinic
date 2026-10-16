import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Download, Loader2, Plus, RotateCcw, Search, Trash2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchServiceCatalog,
  normalizeCatalog,
  saveServiceCatalog,
  SEED_CATALOG,
  type CatalogItem,
} from "@/lib/service-catalog";

const fmt = (n: number) => n.toLocaleString("en-US");

export function ServiceCatalogManager() {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [meta, setMeta] = useState<{ version: number; email: string | null; at: string | null }>({
    version: 0,
    email: null,
    at: null,
  });
  const [query, setQuery] = useState("");
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    const row = await fetchServiceCatalog();
    setItems(row.items);
    setMeta({ version: row.version, email: row.updated_by_email, at: row.updated_at });
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const indexed = items.map((s, idx) => ({ ...s, idx }));
    return q ? indexed.filter((s) => s.name.toLowerCase().includes(q)) : indexed;
  }, [items, query]);

  const addItem = () => {
    const name = newName.trim();
    if (!name) return;
    setItems((prev) => [{ name, priceVnd: Number(newPrice.replace(/[^\d]/g, "")) || 0 }, ...prev]);
    setNewName("");
    setNewPrice("");
    setStatus("Added to the list. Publish to make it live.");
  };

  const publish = async () => {
    setSaving(true);
    setStatus("");
    try {
      const { data } = await supabase.auth.getUser();
      if (!data.user) throw new Error("Your session expired. Please sign in again.");
      const version = await saveServiceCatalog(items, {
        id: data.user.id,
        email: data.user.email ?? null,
      });
      await load();
      setStatus(`Published as clinic service catalog (version ${version}).`);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Could not publish the service catalog.");
    } finally {
      setSaving(false);
    }
  };

  const backup = () => {
    const blob = new Blob([JSON.stringify(items, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `drcare-services-catalog-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const restoreFile = async (file: File) => {
    try {
      const parsed = normalizeCatalog(JSON.parse(await file.text()));
      if (parsed.length === 0) throw new Error("empty");
      setItems(parsed);
      setStatus(`Loaded ${parsed.length} services from the backup file. Publish to make it live.`);
    } catch {
      setStatus("That file is not a valid service catalog backup.");
    }
  };

  return (
    <section className="mt-9">
      <div className="flex items-center gap-3">
        <span className="h-px w-8 bg-accent" aria-hidden />
        <h2 className="text-[11px] font-medium uppercase tracking-[0.28em] text-primary/70">
          Treatment Plan Services
        </h2>
      </div>

      <div className="mt-4 rounded-2xl border border-border bg-card p-5">
        <p className="text-sm text-muted-foreground">
          Every service that can be picked inside a treatment plan, with its price in VND. Add,
          edit, delete, back up or restore the list here, then publish it as the clinic default.
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {loading
            ? "Loading…"
            : meta.version
              ? `Version ${meta.version} · ${items.length} services${
                  meta.at ? ` · updated ${new Date(meta.at).toLocaleDateString()}` : ""
                }${meta.email ? ` by ${meta.email}` : ""}`
              : `Using the ${items.length} services shipped with the app`}
        </p>

        {status && (
          <p className="mt-3 rounded-lg border border-border bg-muted px-4 py-2 text-sm">{status}</p>
        )}

        <div className="mt-5 flex flex-wrap items-end gap-2">
          <div className="min-w-[16rem] flex-1">
            <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              New service
            </label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Zirconia Crown on Implant"
              className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="w-40">
            <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Price (VND)
            </label>
            <input
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value.replace(/[^\d]/g, ""))}
              inputMode="numeric"
              placeholder="0"
              className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-right text-sm"
            />
          </div>
          <button
            onClick={addItem}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            <Plus size={15} /> Add
          </button>
        </div>

        <div className="mt-5 flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
          <Search size={15} className="text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search services…"
            className="w-full bg-transparent text-sm outline-none"
          />
        </div>

        <ul className="mt-3 max-h-[26rem] space-y-2 overflow-y-auto pr-1">
          {filtered.map((s) => (
            <li key={s.idx} className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2">
              <input
                value={s.name}
                onChange={(e) =>
                  setItems((prev) =>
                    prev.map((it, i) => (i === s.idx ? { ...it, name: e.target.value } : it)),
                  )
                }
                className="min-w-0 flex-1 bg-transparent text-sm outline-none"
              />
              <input
                value={fmt(s.priceVnd)}
                onChange={(e) =>
                  setItems((prev) =>
                    prev.map((it, i) =>
                      i === s.idx
                        ? { ...it, priceVnd: Number(e.target.value.replace(/[^\d]/g, "")) || 0 }
                        : it,
                    ),
                  )
                }
                inputMode="numeric"
                className="w-32 rounded-md border border-border bg-card px-2 py-1 text-right text-sm tabular-nums"
              />
              <span className="text-xs text-muted-foreground">₫</span>
              <button
                onClick={() => setItems((prev) => prev.filter((_, i) => i !== s.idx))}
                className="text-destructive hover:opacity-70"
                aria-label={`Delete ${s.name}`}
              >
                <Trash2 size={15} />
              </button>
            </li>
          ))}
          {!loading && filtered.length === 0 && (
            <li className="px-1 py-3 text-sm text-muted-foreground">No service matches “{query}”.</li>
          )}
        </ul>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            onClick={() => void publish()}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
            Publish service list
          </button>
          <button
            onClick={backup}
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-muted"
          >
            <Download size={14} /> Back up (.json)
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-muted"
          >
            <Upload size={14} /> Restore from file
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void restoreFile(f);
              e.target.value = "";
            }}
          />
          <button
            onClick={() => {
              void (async () => {
                await load();
                setStatus("Reloaded the list currently live for treatment plans.");
              })();
            }}
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-muted"
          >
            <RotateCcw size={14} /> Restore published version
          </button>
          <button
            onClick={() => {
              setItems(SEED_CATALOG);
              setStatus("Reset to the original price list. Publish to make it live.");
            }}
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-muted"
          >
            <RotateCcw size={14} /> Reset to original list
          </button>
        </div>
      </div>
    </section>
  );
}
