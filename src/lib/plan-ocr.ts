/**
 * Read a treatment-plan photo/screenshot entirely in the browser (Tesseract OCR,
 * English) — no server, no API key, and the image never leaves this computer.
 * The OCR text is then matched line-by-line against the clinic's service
 * catalog, so even slightly misread names snap to the right service.
 */

export type ImportedRow = {
  /** Service name as read from the image. */
  name: string;
  /** Exact catalog name when a confident match was found, else null. */
  catalogName: string | null;
  tooth: string;
  qty: number;
  unitPriceVnd: number | null;
};
export type ImportedPhase = { title: string | null; rows: ImportedRow[] };
export type ImportedPlan = {
  patientName: string | null;
  phases: ImportedPhase[];
};

/** Draw the image large, grey and contrasty — small table text OCRs far better. */
async function toOcrCanvas(file: Blob): Promise<HTMLCanvasElement> {
  const bmp = await createImageBitmap(file);
  let scale = 1;
  if (bmp.width < 2000) scale = Math.min(3, 2400 / bmp.width);
  else if (bmp.width > 3200) scale = 3200 / bmp.width;
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("Could not process the image.");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.filter = "grayscale(1) contrast(1.25)"; // ignored by browsers without canvas filters
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  return c;
}

export async function ocrImageText(file: Blob, onProgress?: (msg: string) => void): Promise<string> {
  const canvas = await toOcrCanvas(file);
  onProgress?.("Loading text reader (first time only, ~10 MB)…");
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng", 1, {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === "recognizing text") onProgress?.(`Reading text… ${Math.round(m.progress * 100)}%`);
    },
  });
  try {
    await worker.setParameters({ preserve_interword_spaces: "1" });
    const { data } = await worker.recognize(canvas);
    return data.text ?? "";
  } finally {
    await worker.terminate();
  }
}

// ---------------------------------------------------------------- parsing

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

function bigrams(s: string): string[] {
  const t = s.replace(/ /g, "");
  const out: string[] = [];
  for (let i = 0; i < t.length - 1; i++) out.push(t.slice(i, i + 2));
  return out;
}

/** 0..1 — mix of "how much of the catalog name is in the line" and overall similarity. */
function score(lineBg: string[], nameBg: string[]): number {
  if (lineBg.length === 0 || nameBg.length === 0) return 0;
  const pool = new Map<string, number>();
  for (const b of lineBg) pool.set(b, (pool.get(b) ?? 0) + 1);
  let common = 0;
  for (const b of nameBg) {
    const n = pool.get(b) ?? 0;
    if (n > 0) {
      common++;
      pool.set(b, n - 1);
    }
  }
  const contain = common / nameBg.length;
  const dice = (2 * common) / (lineBg.length + nameBg.length);
  return 0.5 * contain + 0.5 * dice;
}

const SKIP_LINE =
  /\b(total|note|healing|disclaimer|exchange rate|warranty|valid|please|page \d|www\.|http|@)\b|^(step|service|teeth|qty|unit|price|discount|vnd|aud|usd)\b/i;

function cleanName(raw: string): string {
  return raw
    .replace(/\d{1,3}(,\d{3})+(\.\d+)?/g, " ")
    .replace(/\bin\s*package\b/gi, " ")
    .replace(/(^|\s)[-—–|_.,:;]+(?=\s|$)/g, " ")
    .replace(/(^|\s)\d{1,2}(?=\s)/g, " ") // step numbers / teeth / qty
    .replace(/\s+/g, " ")
    .replace(/^[^A-Za-z(]+/, "")
    .trim();
}

function extractTooth(raw: string): string {
  const lower = raw.toLowerCase();
  if (/both\s+jaws?|full\s+mouth/.test(lower)) return "Both jaws";
  if (/upper\s+jaw|maxilla/.test(lower)) return "Upper jaw";
  if (/lower\s+jaw|mandib/.test(lower)) return "Lower jaw";
  const noPrices = raw.replace(/\d{1,3}(,\d{3})+(\.\d+)?/g, " ");
  const teeth = (noPrices.match(/(?<![\d.])[1-4][1-8](?![\d.])/g) ?? []).filter((t, i, a) => a.indexOf(t) === i);
  return teeth.join(", ");
}

function findPatientName(lines: string[]): string | null {
  const tidy = (s: string) =>
    s
      .replace(/[^A-Za-zÀ-ỹ'’. -]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  for (const line of lines) {
    const dear = line.match(/\bdear\s+([A-ZÀ-Ỹ][^\n,;:!]{1,40})/i);
    if (dear) {
      const n = tidy(dear[1]);
      if (n.length >= 2) return n;
    }
    const lab = line.match(/\b(?:patient(?:\s*name)?|customer|client|full\s*name)\s*[:\-–]\s*([^\n|]{2,40})/i);
    if (lab) {
      const n = tidy(lab[1]);
      if (n.length >= 2) return n;
    }
    const title = line.match(/^(.{3,40}?)\s+[-–—]\s+(?:personali[sz]ed\s+)?(?:treatment\s+)?plan\b/i);
    if (title) {
      const n = tidy(title[1]);
      if (n.length >= 2 && !/\bphase\b/i.test(n)) return n;
    }
  }
  return null;
}

export function parsePlanText(text: string, catalogNames: string[]): ImportedPlan {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/[|¦]+/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const catalog = catalogNames.map((name) => ({ name, bg: bigrams(norm(name)) }));
  const phases: ImportedPhase[] = [];
  let current: ImportedPhase | null = null;
  const ensure = () => {
    if (!current) {
      current = { title: null, rows: [] };
      phases.push(current);
    }
    return current;
  };

  for (const line of lines) {
    if (/\bphase\s*\d/i.test(line) && !/total/i.test(line)) {
      const start = line.search(/phase\s*\d/i);
      const title = line
        .slice(start)
        .replace(/\s+\d{1,3}(,\d{3})+(\.\d+)?.*$/, "")
        .trim();
      current = { title, rows: [] };
      phases.push(current);
      continue;
    }
    if (SKIP_LINE.test(line)) continue;

    const text = cleanName(line);
    if ((text.match(/[A-Za-z]/g) ?? []).length < 4) continue;

    const lineBg = bigrams(norm(text));
    let best: { name: string; s: number } | null = null;
    for (const c of catalog) {
      const s = score(lineBg, c.bg);
      if (!best || s > best.s) best = { name: c.name, s };
    }
    const matched = best && best.s >= 0.62 ? best.name : null;

    const tooth = extractTooth(line);
    const teethCount = tooth && /^\d/.test(tooth) ? tooth.split(",").length : 0;
    const row: ImportedRow = {
      name: matched ?? text,
      catalogName: matched,
      tooth,
      qty: teethCount > 0 ? teethCount : 1,
      unitPriceVnd: null,
    };
    // Unmatched lines are only kept when they look like a table row
    // (start with a step number, or list teeth).
    if (!matched && !tooth && !/^\d{1,2}[\s.)]+[A-Za-z]/.test(line)) continue;
    ensure().rows.push(row);
  }

  return {
    patientName: findPatientName(lines),
    phases: phases.filter((p) => p.rows.length > 0),
  };
}

export async function readPlanFromImage(
  file: Blob,
  catalogNames: string[],
  onProgress?: (msg: string) => void,
): Promise<ImportedPlan> {
  const text = await ocrImageText(file, onProgress);
  return parsePlanText(text, catalogNames);
}

/** Downscale + re-encode as JPEG (phone photos are huge) → raw base64 for upload. */
export async function fileToBase64Jpeg(file: Blob, maxSide = 1800): Promise<string> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("Could not process the image.");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  return c.toDataURL("image/jpeg", 0.88).split(",")[1] ?? "";
}
