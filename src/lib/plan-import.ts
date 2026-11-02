import { createServerFn } from "@tanstack/react-start";
import type { ImportedPlan, ImportedPhase, ImportedRow } from "@/lib/plan-ocr";

export type ExtractInput = {
  /** Raw base64 JPEG (no data: prefix). */
  imageBase64: string;
  /** Names from the clinic's service catalog, so the model can snap to them. */
  catalogNames: string[];
  /** Only checked when the PLAN_IMPORT_CODE env var is set. */
  accessCode?: string;
};

const MAX_BASE64_CHARS = 7_000_000; // ≈5 MB image

const SCHEMA = {
  type: "OBJECT",
  properties: {
    patientName: { type: "STRING", nullable: true },
    phases: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          title: { type: "STRING", nullable: true },
          rows: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                name: { type: "STRING" },
                catalogName: { type: "STRING", nullable: true },
                tooth: { type: "STRING" },
                qty: { type: "NUMBER" },
                unitPriceVnd: { type: "NUMBER", nullable: true },
              },
              required: ["name", "catalogName", "tooth", "qty", "unitPriceVnd"],
            },
          },
        },
        required: ["title", "rows"],
      },
    },
  },
  required: ["patientName", "phases"],
};

export const extractPlanWithGemini = createServerFn({ method: "POST" })
  .inputValidator((d: ExtractInput) => d)
  .handler(async ({ data }): Promise<ImportedPlan> => {
    const required = process.env["PLAN_IMPORT_CODE"];
    if (required && data.accessCode !== required) throw new Error("ACCESS_CODE_REQUIRED");

    const apiKey = process.env["GEMINI_API_KEY"];
    if (!apiKey) throw new Error("AI_NOT_CONFIGURED");

    if (!data.imageBase64 || data.imageBase64.length > MAX_BASE64_CHARS) {
      throw new Error("Image is too large — try a smaller screenshot or photo.");
    }

    const names = (data.catalogNames ?? []).slice(0, 800);
    const prompt = [
      "This image is a dental implant treatment plan / quotation (phone photo, screenshot or scan; English or Vietnamese).",
      "Extract it as JSON matching the schema.",
      "Rules:",
      "- Copy only what is visible. Never invent services, teeth, quantities or prices. Use null / empty string when not shown.",
      "- patientName: the patient/customer full name (near the top, e.g. next to 'Patient', 'Dear', or in the title). Keep diacritics.",
      "- Keep the phases in the order shown (title as written, e.g. 'Phase 1 — Implant Placement (14 days)'). If there are no phase headings, return one phase with title null.",
      "- One row per service line, skipping header rows, subtotals and totals. Tooth numbers as written (FDI), or 'Upper jaw' / 'Lower jaw'.",
      "- unitPriceVnd: unit price in VND as a plain number if shown (e.g. 12,000,000 → 12000000); null if absent or 'In package'. Totals and AUD/USD amounts are NOT unit prices.",
      "- catalogName: the EXACT name from the catalog list below when the line clearly is that service (wording may differ slightly); otherwise null.",
      "",
      "Catalog:",
      names.map((n) => `- ${n}`).join("\n"),
    ].join("\n");

    const model = process.env["GEMINI_MODEL"] || "gemini-2.5-flash";
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ inline_data: { mime_type: "image/jpeg", data: data.imageBase64 } }, { text: prompt }],
          },
        ],
        generationConfig: { responseMimeType: "application/json", responseSchema: SCHEMA, temperature: 0 },
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("[plan-import] Gemini error", res.status, body.slice(0, 500));
      if (res.status === 429) throw new Error("AI_RATE_LIMITED");
      throw new Error(`AI_ERROR_${res.status}`);
    }
    const json = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error("AI_BAD_RESPONSE");
    }
    return normalizePlan(parsed);
  });

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function normalizePlan(input: unknown): ImportedPlan {
  const o = (input ?? {}) as Record<string, unknown>;
  const phasesIn = Array.isArray(o["phases"]) ? (o["phases"] as unknown[]) : [];
  const phases: ImportedPhase[] = phasesIn.map((p) => {
    const po = (p ?? {}) as Record<string, unknown>;
    const rowsIn = Array.isArray(po["rows"]) ? (po["rows"] as unknown[]) : [];
    const rows: ImportedRow[] = rowsIn
      .map((r) => {
        const ro = (r ?? {}) as Record<string, unknown>;
        const qty = Number(ro["qty"]);
        const price = ro["unitPriceVnd"];
        return {
          name: str(ro["name"]) ?? "",
          catalogName: str(ro["catalogName"]),
          tooth: typeof ro["tooth"] === "string" ? (ro["tooth"] as string).trim() : "",
          qty: Number.isFinite(qty) && qty > 0 ? Math.round(qty) : 1,
          unitPriceVnd: typeof price === "number" && Number.isFinite(price) && price >= 0 ? price : null,
        };
      })
      .filter((r) => r.name);
    return { title: str(po["title"]), rows };
  });
  return { patientName: str(o["patientName"]), phases: phases.filter((p) => p.rows.length > 0) };
}
