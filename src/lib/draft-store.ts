/**
 * Local (on-device) backup of the plan being edited.
 *
 * Why not localStorage: the plan snapshot includes base64 photos, which easily
 * exceed localStorage's ~5 MB quota — the old code swallowed that error, so
 * the "local backup" silently stopped working on photo-heavy plans.
 * IndexedDB has a far larger quota and is async-safe for big values.
 *
 * Every browser session writes under its own key, so opening the page (which
 * starts from a blank plan) can never overwrite the backup of a previous
 * session before the user has had the chance to recover it. Only the newest
 * MAX_DRAFTS entries are kept.
 */

export type Draft = {
  /** Browser-session key (unique per page load). */
  session: string;
  data: unknown;
  at: number;
  /** Cloud plan id this draft belongs to, if it was saved to the cloud. */
  id: string | null;
  name: string;
};

const DB_NAME = "dci-plan-drafts";
const STORE = "drafts";
const MAX_DRAFTS = 6;
const LS_PREFIX = "dci-plan-draft:";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: "session" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
  });
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = run(t.objectStore(STORE));
        t.oncomplete = () => {
          db.close();
          resolve(req.result);
        };
        t.onerror = () => {
          db.close();
          reject(t.error ?? new Error("IndexedDB transaction failed"));
        };
        t.onabort = () => {
          db.close();
          reject(t.error ?? new Error("IndexedDB transaction aborted"));
        };
      }),
  );
}

/** Small localStorage fallback (only used when IndexedDB is unavailable/failing). */
function lsList(): Draft[] {
  const out: Draft[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(LS_PREFIX)) continue;
      const raw = localStorage.getItem(k);
      if (raw) out.push(JSON.parse(raw) as Draft);
    }
  } catch {
    /* ignore */
  }
  return out;
}

/** Newest first. Never throws. */
export async function listDrafts(): Promise<Draft[]> {
  let all: Draft[] = [];
  try {
    all = await tx<Draft[]>("readonly", (s) => s.getAll() as IDBRequest<Draft[]>);
  } catch {
    /* fall through to localStorage */
  }
  const seen = new Set(all.map((d) => d.session));
  for (const d of lsList()) if (!seen.has(d.session)) all.push(d);
  return all.filter((d) => d && d.data).sort((a, b) => b.at - a.at);
}

/** Returns true when the draft was stored somewhere durable. Never throws. */
export async function putDraft(draft: Draft): Promise<boolean> {
  try {
    await tx("readwrite", (s) => s.put(draft));
    try {
      localStorage.removeItem(LS_PREFIX + draft.session);
    } catch {
      /* ignore */
    }
    void pruneDrafts();
    return true;
  } catch {
    try {
      localStorage.setItem(LS_PREFIX + draft.session, JSON.stringify(draft));
      return true;
    } catch {
      return false; // quota exceeded / storage blocked
    }
  }
}

export async function deleteDraft(session: string): Promise<void> {
  try {
    await tx("readwrite", (s) => s.delete(session));
  } catch {
    /* ignore */
  }
  try {
    localStorage.removeItem(LS_PREFIX + session);
  } catch {
    /* ignore */
  }
}

async function pruneDrafts(): Promise<void> {
  const all = await listDrafts();
  for (const d of all.slice(MAX_DRAFTS)) await deleteDraft(d.session);
}
