import { supabase } from "@/integrations/supabase/client";
import { invalidateContentCache } from "@/lib/clinic-content";
import servicesCatalog from "@/lib/services-catalog.json";

export type CatalogItem = { name: string; priceVnd: number };

export const SEED_CATALOG: CatalogItem[] = servicesCatalog as CatalogItem[];

export const CATALOG_CONTENT_KEY = "services_catalog";

export function normalizeCatalog(input: unknown): CatalogItem[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((i): i is Record<string, unknown> => !!i && typeof i === "object")
    .map((i) => ({
      name: typeof i['name'] === "string" ? i['name'].trim() : "",
      priceVnd: Number(i['priceVnd']) || 0,
    }))
    .filter((i) => i.name.length > 0);
}

export type CatalogRow = {
  items: CatalogItem[];
  version: number;
  updated_at: string | null;
  updated_by_email: string | null;
  /** false when no published catalog exists yet (shipped list is used) */
  published: boolean;
};

/** Published clinic service catalog, or the shipped list when nothing is published. */
export async function fetchServiceCatalog(): Promise<CatalogRow> {
  try {
    const { data, error } = await supabase
      .from("clinic_content" as never)
      .select("content_value, version, updated_at, updated_by_email")
      .eq("content_key", CATALOG_CONTENT_KEY)
      .eq("is_active", true)
      .limit(1);
    if (error) throw error;
    const row = ((data ?? [])[0] ?? null) as {
      content_value?: { items?: unknown };
      version?: number;
      updated_at?: string;
      updated_by_email?: string | null;
    } | null;
    const items = normalizeCatalog(row?.content_value?.items);
    if (!row || items.length === 0) {
      return { items: SEED_CATALOG, version: 0, updated_at: null, updated_by_email: null, published: false };
    }
    return {
      items,
      version: row.version ?? 1,
      updated_at: row.updated_at ?? null,
      updated_by_email: row.updated_by_email ?? null,
      published: true,
    };
  } catch {
    return { items: SEED_CATALOG, version: 0, updated_at: null, updated_by_email: null, published: false };
  }
}

/** Publish a new active version of the service catalog. */
export async function saveServiceCatalog(
  items: CatalogItem[],
  user: { id: string; email: string | null },
): Promise<number> {
  const clean = normalizeCatalog(items);
  const { data: existing, error: readErr } = await supabase
    .from("clinic_content" as never)
    .select("id, version")
    .eq("content_key", CATALOG_CONTENT_KEY)
    .order("version", { ascending: false })
    .limit(1);
  if (readErr) throw readErr;
  const current = (existing ?? [])[0] as { id: string; version: number } | undefined;
  const nextVersion = (current?.version ?? 0) + 1;

  if (current) {
    const { error } = await supabase
      .from("clinic_content" as never)
      .update({ is_active: false } as never)
      .eq("content_key", CATALOG_CONTENT_KEY);
    if (error) throw error;
  }

  const { error } = await supabase.from("clinic_content" as never).insert({
    content_key: CATALOG_CONTENT_KEY,
    title: "Service catalog",
    body: "",
    items: [],
    content_type: "catalog",
    content_value: { items: clean },
    version: nextVersion,
    is_active: true,
    updated_by: user.id,
    updated_by_email: user.email,
  } as never);
  if (error) throw error;
  invalidateContentCache();
  return nextVersion;
}
