import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, ChevronRight, Eye, Loader2, Pencil, Plus, RotateCcw, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { RichEditable } from "@/components/RichTextEditor";
import { RichText } from "@/components/RichText";
import { MediaManager } from "@/components/MediaManager";
import { ServiceCatalogManager } from "@/components/ServiceCatalogManager";
import { PhotoCollage } from "@/components/PhotoCollage";
import { mediaStyle, shownLimit, visibleMedia } from "@/lib/clinic-media";
import { isEmptyRich } from "@/lib/rich-text";

import {
  CONTENT_META,
  DEFAULT_CONTENT,
  PRICE_LIST_IMAGE_KEYS,
  fetchActiveContent,
  isContentManager,
  invalidateContentCache,
  saveContentAsDefault,
  type ContentKey,
  type ContentMap,
  type ContentMeta,
  type ContentRow,
  type ContentValue,
} from "@/lib/clinic-content";

export const Route = createFileRoute("/_authenticated/content")({
  head: () => ({
    meta: [
      { title: "Content Management | Dr. Care Implant Clinic" },
      {
        name: "description",
        content:
          "Owner-only content and media management for the patient-facing text and images used in Dr. Care Implant Clinic treatment plans.",
      },
      { property: "og:title", content: "Content Management | Dr. Care Implant Clinic" },
      {
        property: "og:description",
        content: "Edit the clinic's default treatment plan wording and imagery without a developer.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ContentManagementPage,
});

const DRAFT_KEY = "drcare:content-drafts";

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");

function loadDrafts(): Partial<Record<ContentKey, ContentValue>> {
  try {
    return JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function ContentManagementPage() {
  const navigate = useNavigate();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [content, setContent] = useState<ContentMap>(DEFAULT_CONTENT);
  const [rows, setRows] = useState<ContentRow[]>([]);
  const [editing, setEditing] = useState<ContentKey | null>(null);
  const [draft, setDraft] = useState<ContentValue | null>(null);
  const [drafts, setDrafts] = useState<Partial<Record<ContentKey, ContentValue>>>({});
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [preview, setPreview] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [priceListsOpen, setPriceListsOpen] = useState(false);


  const load = async () => {
    const { map, rows: r } = await fetchActiveContent({ force: true });
    setContent(map);
    setRows(r);
  };

  useEffect(() => {
    setDrafts(loadDrafts());
    void (async () => {
      setAllowed(await isContentManager());
      await load();
    })();
  }, []);

  const sections = useMemo(() => {
    const out: { section: string; blocks: ContentMeta[] }[] = [];
    for (const m of CONTENT_META) {
      const bucket = out.find((s) => s.section === m.section);
      if (bucket) bucket.blocks.push(m);
      else out.push({ section: m.section, blocks: [m] });
    }
    return out;
  }, []);

  const meta = (key: ContentKey) => rows.find((r) => r.content_key === key);

  const startEdit = (key: ContentKey) => {
    setEditing(key);
    setStatus("");
    setPreview(false);
    setDraft(structuredClone(drafts[key] ?? content[key]));
  };

  const saveDraft = () => {
    if (!editing || !draft) return;
    const next = { ...drafts, [editing]: draft };
    setDrafts(next);
    localStorage.setItem(DRAFT_KEY, JSON.stringify(next));
    setStatus("Draft saved on this device. It is not live for patients yet.");
  };

  const publish = async () => {
    if (!editing || !draft) return;
    setSaving(true);
    setStatus("");
    try {
      const { data } = await supabase.auth.getUser();
      if (!data.user) throw new Error("Your session expired. Please sign in again.");
      const version = await saveContentAsDefault(editing, draft, {
        id: data.user.id,
        email: data.user.email ?? null,
      });
      await load();
      const nextDrafts = { ...drafts };
      delete nextDrafts[editing];
      setDrafts(nextDrafts);
      localStorage.setItem(DRAFT_KEY, JSON.stringify(nextDrafts));
      setEditing(null);
      setDraft(null);
      setStatus(`Published as clinic default (version ${version}).`);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Could not save this content.");
    } finally {
      setSaving(false);
    }
  };

  if (allowed === null) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <div className="max-w-md rounded-2xl border border-border bg-card p-7 text-center shadow-xl">
          <h1 className="text-xl font-bold text-primary">Owner access only</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Content Management is limited to the clinic owner and admins. Ask the owner to grant
            your account access.
          </p>
          <button
            onClick={() => void navigate({ to: "/" })}
            className="mt-5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Back to the treatment plan
          </button>
        </div>
      </div>
    );
  }

  const editMeta = editing ? CONTENT_META.find((m) => m.key === editing)! : null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-6 py-5">
          <button
            onClick={() => void navigate({ to: "/" })}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
          >
            <ArrowLeft size={16} /> Treatment plan
          </button>
          <h1 className="ml-auto text-[11px] font-medium uppercase tracking-[0.28em] text-primary/70">
            Content &amp; Media
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <p className="max-w-2xl text-sm text-muted-foreground">
          Edit the clinic's default patient-facing wording and imagery. New treatment plans use the
          latest published version; plans already saved keep the content they were created with.
          Patient names, tooth numbers, diagnoses and prices are never edited here.
        </p>

        {status && (
          <p className="mt-4 rounded-lg border border-border bg-muted px-4 py-2 text-sm">{status}</p>
        )}

        

        {!editing && (
          <div className="mt-8 lg:flex lg:items-start lg:gap-8">
            <nav className="lg:sticky lg:top-6 lg:w-56 lg:shrink-0">
              <div className="rounded-2xl border border-border bg-card p-3">
                <div className="px-2 pb-2 text-[10px] font-medium uppercase tracking-[0.28em] text-primary/70">
                  Sections
                </div>
                <ul className="space-y-0.5">
                  {sections.map((g) => (
                    <li key={g.section}>
                      <button
                        onClick={() => {
                          setOpenSections((s) => ({ ...s, [g.section]: true }));
                          requestAnimationFrame(() =>
                            document
                              .getElementById(`sec-${slug(g.section)}`)
                              ?.scrollIntoView({ behavior: "smooth", block: "start" }),
                          );
                        }}
                        className="w-full truncate rounded-lg px-2 py-1.5 text-left text-sm text-foreground/80 hover:bg-muted hover:text-primary"
                      >
                        {g.section}
                      </button>
                    </li>
                  ))}
                  <li>
                    <button
                      onClick={() =>
                        document
                          .getElementById("sec-services")
                          ?.scrollIntoView({ behavior: "smooth", block: "start" })
                      }
                      className="w-full truncate rounded-lg px-2 py-1.5 text-left text-sm text-foreground/80 hover:bg-muted hover:text-primary"
                    >
                      Treatment Plan Services
                    </button>
                  </li>
                </ul>
              </div>
            </nav>

            <div className="min-w-0 flex-1">
              {sections.map((group) => {
                const open = openSections[group.section] ?? false;
                return (
                  <section
                    key={group.section}
                    id={`sec-${slug(group.section)}`}
                    className="mt-4 scroll-mt-6 first:mt-0 overflow-hidden rounded-2xl border border-border bg-card"
                  >
                    <button
                      onClick={() =>
                        setOpenSections((s) => ({ ...s, [group.section]: !open }))
                      }
                      className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-muted/50"
                    >
                      <ChevronRight
                        size={16}
                        className={`text-primary transition-transform ${open ? "rotate-90" : ""}`}
                      />
                      <h2 className="text-[11px] font-medium uppercase tracking-[0.28em] text-primary/70">
                        {group.section}
                      </h2>
                      {(() => {
                        const visibleCount =
                          group.blocks.filter((m) => !m.hiddenFromList).length +
                          (group.blocks.some((m) => PRICE_LIST_IMAGE_KEYS.includes(m.key)) ? 1 : 0);
                        return (
                          <span className="ml-auto text-xs text-muted-foreground">
                            {visibleCount} item{visibleCount > 1 ? "s" : ""}
                          </span>
                        );
                      })()}
                    </button>
                    {open && (
                      <ul className="space-y-3 border-t border-border p-4">
                        {group.blocks
.filter((m) => !m.hiddenFromList && !m.key.startsWith("price_list_images_"))
                          .map((m) => {
                          const row = meta(m.key);
                          const value = content[m.key];
                          return (
                            <li
                              key={m.key}
                              className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-background px-5 py-4"
                            >
                              {value.media[0] && (
                                <img
                                  src={value.media[0].url}
                                  alt=""
                                  className="h-[48px] w-[64px] rounded-lg object-cover"
                                />
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="font-semibold text-primary">{m.label}</div>
                                <div className="mt-0.5 truncate text-xs text-muted-foreground">
                                  {m.hint}
                                </div>
                                <div className="mt-1 text-[11px] text-muted-foreground">
                                  {row
                                    ? `Version ${row.version} · updated ${new Date(row.updated_at).toLocaleDateString()}${
                                        row.updated_by_email ? ` by ${row.updated_by_email}` : ""
                                      }`
                                    : "Using the wording shipped with the app"}
                                  {drafts[m.key] ? " · unpublished draft on this device" : ""}
                                </div>
                              </div>
                              <button
                                onClick={() => startEdit(m.key)}
                                className="inline-flex items-center gap-1.5 rounded-full border border-primary px-4 py-1.5 text-sm font-semibold text-primary hover:bg-primary hover:text-primary-foreground"
                              >
                                <Pencil size={14} /> Edit
                              </button>
                            </li>
                          );
                        })}
                        {group.blocks.some((m) => PRICE_LIST_IMAGE_KEYS.includes(m.key) || m.key.startsWith("price_list_images_")) && (() => {
                          const priceImageMetas = group.blocks.filter((m) =>
                            PRICE_LIST_IMAGE_KEYS.includes(m.key) || m.key.startsWith("price_list_images_"),
                          );
                          const firstImage = priceImageMetas
                            .map((m) => content[m.key]?.media?.[0])
                            .find(Boolean);
                          const customCount = priceImageMetas.filter(
                            (m) => (content[m.key]?.media?.length ?? 0) > 0,
                          ).length;
                          const anyDraft = priceImageMetas.some((m) => drafts[m.key]);
                          return (
                            <li className="overflow-hidden rounded-2xl border border-border bg-background">
                              <button
                                onClick={() => setPriceListsOpen((v) => !v)}
                                className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-muted/50"
                              >
                                <ChevronRight
                                  size={15}
                                  className={`text-primary transition-transform ${priceListsOpen ? "rotate-90" : ""}`}
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="font-semibold text-primary">Price list files</div>
                                  <div className="mt-0.5 text-xs text-muted-foreground">
                                    Photos or PDFs for every price-list category (General, Single service,
                                    Removable denture, All-on-4/5/6). Pick a category inside to edit its pages.
                                  </div>
                                  <div className="mt-1 text-[11px] text-muted-foreground">
                                    {customCount > 0
                                      ? `${customCount} of ${priceImageMetas.length} categories customised`
                                      : "Using the images shipped with the app"}
                                    {anyDraft ? " · unpublished draft on this device" : ""}
                                  </div>
                                </div>
                                {firstImage && (
                                  <img
                                    src={firstImage.url}
                                    alt=""
                                    className="h-[48px] w-[64px] rounded-lg object-cover"
                                  />
                                )}
                                <span className="text-xs text-muted-foreground">
                                  {priceImageMetas.length} categories
                                </span>
                              </button>
                              {priceListsOpen && (
                                <ul className="space-y-2 border-t border-border p-3">
                                  {priceImageMetas.map((m) => {
                                    const row = meta(m.key);
                                    const value = content[m.key] ?? { media: [] };
                                    const label = m.label.replace("Price List Images — ", "");
                                    return (
                                      <li
                                        key={m.key}
                                        className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-4 py-3"
                                      >
                                        {value.media[0] && (
                                          <img
                                            src={value.media[0].url}
                                            alt=""
                                            className="h-[40px] w-[56px] rounded-md object-cover"
                                          />
                                        )}
                                        <div className="min-w-0 flex-1">
                                          <div className="text-sm font-semibold text-primary">{label}</div>
                                          <div className="mt-0.5 text-[11px] text-muted-foreground">
                                            {value.media.length
                                              ? `${value.media.length} file${value.media.length > 1 ? "s" : ""} uploaded`
                                              : "Using the pages shipped with the app"}
                                            {row ? ` · version ${row.version}` : ""}
                                            {drafts[m.key] ? " · unpublished draft on this device" : ""}
                                          </div>
                                        </div>
                                        <button
                                          onClick={() => startEdit(m.key)}
                                          className="inline-flex items-center gap-1.5 rounded-full border border-primary px-3.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary hover:text-primary-foreground"
                                        >
                                          <Pencil size={13} /> Edit
                                        </button>
                                      </li>
                                    );
                                  })}
                                </ul>
                              )}
                            </li>
                          );
                        })()}
                      </ul>
                    )}

                  </section>
                );
              })}

              <div id="sec-services" className="scroll-mt-6">
                <ServiceCatalogManager />
              </div>
            </div>
          </div>
        )}




        {editing && draft && editMeta && (
          <div className="mt-8 rounded-[1.5rem] border border-border bg-card p-6">
            {PRICE_LIST_IMAGE_KEYS.includes(editing) && (
              <div className="mb-5">
                <div className="text-[11px] font-medium uppercase tracking-[0.28em] text-primary/70">
                  Price List Images
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {PRICE_LIST_IMAGE_KEYS.map((key) => {
                    const m = CONTENT_META.find((x) => x.key === key)!;
                    const catLabel = m.label.replace(/^Price List Images\s*—\s*/, "");
                    const active = key === editing;
                    return (
                      <button
                        key={key}
                        onClick={() => startEdit(key)}
                        className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold ${
                          active
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border text-foreground/80 hover:border-primary/50"
                        }`}
                      >
                        {catLabel}
                        {drafts[key] ? " •" : ""}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[11px] font-medium uppercase tracking-[0.28em] text-primary/70">
                  {editMeta.section}
                </div>
                <h2 className="mt-1 text-lg font-bold text-primary">{editMeta.label}</h2>
                <p className="mt-1 text-xs text-muted-foreground">{editMeta.hint}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPreview((p) => !p)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted"
                >
                  <Eye size={13} /> {preview ? "Edit" : "Preview"}
                </button>
                <button
                  onClick={() => {
                    setEditing(null);
                    setDraft(null);
                  }}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Close editor"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {preview ? (
              <div className="mt-6 rounded-2xl border border-border bg-background p-6">
                <RichText value={draft.title} className="text-2xl font-light text-primary" />
                {!isEmptyRich(draft.body) && (
                  <RichText
                    value={draft.body}
                    className="mt-3 text-sm leading-relaxed text-muted-foreground"
                  />
                )}
                {draft.items.length > 0 && (
                  <div className="mt-5 space-y-4">
                    {draft.items.map((item, i) => (
                      <div key={i}>
                        <RichText value={item.title} className="font-semibold text-primary" />
                        <ul className="mt-1 space-y-1">
                          {item.lines.map((l, k) => (
                            <li key={k} className="flex gap-2 text-sm text-muted-foreground">
                              <span className="text-accent">•</span>
                              <RichText value={l} />
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
                {visibleMedia(draft.media).length > 0 && (
                  <div className="mt-5">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Exactly how these images will appear
                    </p>
                    {draft.media[0]?.layout === "collage" ? (
                      <PhotoCollage items={visibleMedia(draft.media).slice(0, shownLimit(draft.media))} />
                    ) : (
                      <div
                        className="grid gap-3"
                        style={{
                          gridTemplateColumns: `repeat(${Math.min(4, Math.max(1, draft.media[0]?.columns ?? 2))}, minmax(0, 1fr))`,
                        }}
                      >
                        {visibleMedia(draft.media)
                          .slice(0, shownLimit(draft.media))
                          .map((m, i) => (
                            <figure key={i}>
                              <img
                                src={m.url}
                                alt={m.alt || ""}
                                className="w-full rounded-xl"
                                style={{
                                  aspectRatio: "4 / 3",
                                  ...mediaStyle(m),
                                }}
                              />
                              {m.caption && (
                                <figcaption className="mt-1 text-xs text-muted-foreground">
                                  {m.caption}
                                </figcaption>
                              )}
                            </figure>
                          ))}
                      </div>
                    )}
                  </div>
                )}

              </div>
            ) : (
              <>
                <label className="mt-8 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {editMeta.titleLabel}
                </label>
                <div className="mt-1.5 rounded-lg border border-border bg-background px-3 py-2 text-sm">
                  <RichEditable
                    value={draft.title}
                    onChange={(v) => setDraft({ ...draft, title: v })}
                  />
                </div>

                <label className="mt-6 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {editMeta.bodyLabel}
                </label>
                <div className="mt-1.5 min-h-[7rem] rounded-lg border border-border bg-background px-3 py-2 text-sm leading-relaxed">
                  <RichEditable
                    value={draft.body}
                    onChange={(v) => setDraft({ ...draft, body: v })}
                  />
                </div>

                {editMeta.itemsLabel && (
                  <div className="mt-7">
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {editMeta.itemsLabel}
                    </div>
                    <div className="mt-3 space-y-4">
                      {draft.items.map((item, i) => (
                        <div key={i} className="rounded-xl border border-border bg-muted/40 p-4">
                          <div className="flex items-start gap-2">
                            <div className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold">
                              <RichEditable
                                value={item.title}
                                onChange={(v) =>
                                  setDraft({
                                    ...draft,
                                    items: draft.items.map((x, j) =>
                                      j === i ? { ...x, title: v } : x,
                                    ),
                                  })
                                }
                              />
                            </div>
                            <button
                              onClick={() =>
                                setDraft({
                                  ...draft,
                                  items: draft.items.filter((_, j) => j !== i),
                                })
                              }
                              className="mt-2 text-destructive hover:opacity-70"
                              aria-label="Remove item"
                            >
                              <X size={16} />
                            </button>
                          </div>
                          <div className="mt-2 space-y-2">
                            {item.lines.map((line, li) => (
                              <div key={li} className="flex items-start gap-2">
                                <div className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm">
                                  <RichEditable
                                    value={line}
                                    onChange={(v) =>
                                      setDraft({
                                        ...draft,
                                        items: draft.items.map((x, j) =>
                                          j === i
                                            ? {
                                                ...x,
                                                lines: x.lines.map((l, k) => (k === li ? v : l)),
                                              }
                                            : x,
                                        ),
                                      })
                                    }
                                  />
                                </div>
                                <button
                                  onClick={() =>
                                    setDraft({
                                      ...draft,
                                      items: draft.items.map((x, j) =>
                                        j === i
                                          ? { ...x, lines: x.lines.filter((_, k) => k !== li) }
                                          : x,
                                      ),
                                    })
                                  }
                                  className="mt-2 text-destructive hover:opacity-70"
                                  aria-label="Remove line"
                                >
                                  <X size={13} />
                                </button>
                              </div>
                            ))}
                            <button
                              onClick={() =>
                                setDraft({
                                  ...draft,
                                  items: draft.items.map((x, j) =>
                                    j === i ? { ...x, lines: [...x.lines, ""] } : x,
                                  ),
                                })
                              }
                              className="text-xs font-semibold text-primary"
                            >
                              + Add line
                            </button>
                          </div>
                        </div>
                      ))}
                      <button
                        onClick={() =>
                          setDraft({
                            ...draft,
                            items: [...draft.items, { title: "", lines: [""] }],
                          })
                        }
                        className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary"
                      >
                        <Plus size={14} /> Add item
                      </button>
                    </div>
                  </div>
                )}

                {editMeta.mediaLabel && (
                  <MediaManager
                    label={editMeta.mediaLabel}
                    items={draft.media}
                    max={editMeta.maxMedia}
                    onChange={(media) => setDraft({ ...draft, media })}
                    allowPdf={PRICE_LIST_IMAGE_KEYS.includes(editing)}
                    compact={PRICE_LIST_IMAGE_KEYS.includes(editing)}

                  />
                )}
              </>
            )}

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                onClick={() => void publish()}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50"
              >
                {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                Publish as clinic default
              </button>
              <button
                onClick={saveDraft}
                className="rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-muted"
              >
                Save draft
              </button>
              <button
                onClick={() => {
                  void (async () => {
                    invalidateContentCache();
                    const { map, rows: r } = await fetchActiveContent({ force: true });
                    setContent(map);
                    setRows(r);
                    setDraft(structuredClone(map[editing]));
                    invalidateContentCache();
                    setStatus("Restored the version currently live for patients. All open pages refreshed.");
                  })();
                }}
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-muted"
              >
                <RotateCcw size={14} /> Restore published version
              </button>
              <button
                onClick={() => setDraft(structuredClone(DEFAULT_CONTENT[editing]))}
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-muted"
              >
                <RotateCcw size={14} /> Reset to original wording
              </button>

            </div>
          </div>
        )}
      </main>
    </div>
  );
}
