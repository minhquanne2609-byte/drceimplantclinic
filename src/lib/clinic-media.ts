import type { CSSProperties } from "react";
import { supabase } from "@/integrations/supabase/client";

/** One clinic-owned (never patient-private) image used in the presentation. */
export type MediaItem = {
  url: string;
  path?: string;
  caption?: string;
  alt?: string;
  fit?: "cover" | "contain";
  position?: string; // CSS object-position, e.g. "50% 40%"
  /** Crop zoom, 1 = no zoom. */
  zoom?: number;
  /** Frame height in mm used by the A4 / PDF galleries. */
  heightMm?: number;
  /** Kept in the library but not shown to patients. */
  hidden?: boolean;
  /** How the whole block lays out its visible images. Stored on every item. */
  layout?: "grid" | "collage";
  /** Grid columns for the block (1-4). Stored on every item. */
  columns?: number;
  /** How many images the owner wants shown in this block. Stored on every item. */
  showCount?: number;
};

/** Effective number of images allowed to show in a block. */
export function shownLimit(items: MediaItem[], fallbackMax?: number): number | undefined {
  const wanted = Number(items[0]?.showCount);
  if (wanted > 0) return Math.max(wanted, fallbackMax ?? 0);
  return fallbackMax;
}

/** Images that should actually appear in the patient-facing plan. */
export function visibleMedia(items: MediaItem[]): MediaItem[] {
  return items.filter((m) => !m.hidden);
}

/** True when a media URL points at a PDF file rather than an image. */
export function isPdfUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  return /\.pdf(\?|#|$)/i.test(url);
}

/**
 * Opens a clinic media file (used for PDF pages). Some browsers/extensions block
 * direct navigation to storage domains like supabase.co (ERR_BLOCKED_BY_CLIENT),
 * even though the file itself is public and harmless. Downloading the bytes via
 * fetch and opening them as a local blob sidesteps that domain-based blocking in
 * most cases; if the fetch itself is blocked too, we fall back to a plain new-tab
 * navigation so the user still has a way to reach the file.
 */
export async function openMediaFile(url: string, filename?: string): Promise<void> {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Fetch failed with status ${res.status}`);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.target = "_blank";
    a.rel = "noopener";
    if (filename) a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
  } catch {
    window.open(url, "_blank", "noopener");
  }
}

/** CSS for rendering one framed/cropped image consistently everywhere. */
export function mediaStyle(m?: Partial<MediaItem> | null): CSSProperties {
  const zoom = Math.max(Number(m?.zoom) || 1, 1);
  return {
    objectFit: m?.fit ?? "cover",
    objectPosition: m?.position ?? "50% 50%",
    transform: zoom > 1 ? `scale(${zoom})` : undefined,
  };
}


const BUCKET = "clinic-media";
const TEN_YEARS = 60 * 60 * 24 * 365 * 10;


/** Uploads to the clinic media library and returns a long-lived readable URL. */
export async function uploadClinicMedia(file: File): Promise<MediaItem> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) throw error;
  const { data, error: signErr } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, TEN_YEARS);
  if (signErr || !data?.signedUrl) throw signErr ?? new Error("Could not create image URL.");
  return { url: data.signedUrl, path, fit: "cover", position: "50% 50%" };
}

export async function removeClinicMedia(item: MediaItem): Promise<void> {
  if (!item.path) return;
  await supabase.storage.from(BUCKET).remove([item.path]);
}

export function normalizeMedia(input: unknown): MediaItem[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((m): m is Record<string, unknown> => !!m && typeof m === "object")
    .filter((m) => typeof m['url'] === "string" && m['url'])
    .map((m) => ({
      url: m['url'] as string,
      path: typeof m['path'] === "string" ? m['path'] : undefined,
      caption: typeof m['caption'] === "string" ? m['caption'] : "",
      alt: typeof m['alt'] === "string" ? m['alt'] : "",
      fit: m['fit'] === "contain" ? "contain" : "cover",
      position: typeof m['position'] === "string" ? m['position'] : "50% 50%",
      zoom: Number(m['zoom']) > 1 ? Number(m['zoom']) : 1,
      heightMm: Number(m['heightMm']) > 0 ? Number(m['heightMm']) : undefined,
      hidden: m['hidden'] === true,
      layout: m['layout'] === "collage" ? "collage" : "grid",
      columns: Number(m['columns']) > 0 ? Math.min(4, Number(m['columns'])) : undefined,
      showCount: Number(m['showCount']) > 0 ? Number(m['showCount']) : undefined,
    }));
}
