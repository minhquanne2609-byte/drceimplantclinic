import { createServerFn } from "@tanstack/react-start";

export type ImportedRow = {
  /** Service name exactly as written on the image. */
  name: string;
  /** Exact catalog name when the model is confident of a match, else null. */
  catalogName: string | null;
  tooth: string;
  qty: number;
  /** Unit price (VND) if the image shows one; null when absent / "included". */
  unitPriceVnd: number | null;
};

export type ImportedPhase = { title: string | null; rows: ImportedRow[] };

export type ImportedPlan = {
  patientName: string | null;
  dob: string | null;
  patientId: string | null;
  treatingDoctor: string | null;
  phases: ImportedPhase[];
};

export type ExtractInput = {
  /** Raw base64 (no data: prefix). */
  imageBase64: string;
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  /** Names from the clinic's service catalog, so the model can snap to them. */
  catalogNames: string[];
  /** Only checked when the PLAN_IMPORT_CODE env var is set. */
  accessCode?: string;
};

const MAX_BASE64_CHARS = 7_000_000; // ≈5 MB image
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

const TOOL = {
  name: "record_treatment_plan",
  description: "Record the patient name and the treatment plan lines read from the image.",
  input_schema: {
    type: "object",
    properties: {
      patientName: { type: ["string", "null"], description: "Patient / customer full name, or null if not visible." },
      dob: { type: ["string", "null"] },
      patientId: { type: ["string", "null"] },
      treatingDoctor: { type: ["string", "null"] },
      phases: {
        type: "array",
        description: "Treatment phases/stages in the order shown. Use one phase if the image has no phase headings.",
        items: {
          type: "object",
          properties: {
            title: { type: ["string", "null"], description: "Phase heading as written, e.g. 'Phase 1 — Implant Placement (14 days)'." },
            rows: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string", description: "Service name as written on the image." },
                  catalogName: {
                    type: ["string", "null"],
                    description: "The EXACT matching name from the provided catalog list, or null if no confident match.",
                  },
                  tooth: { type: "string", description: "Tooth numbers / jaw as written (e.g. '16, 17' or 'Upper jaw'); empty string if none." },
                  qty: { type: "number", description: "Quantity; 1 if not shown." },
                  unitPriceVnd: { type: ["number", "null"], description: "Unit price in VND if shown, else null." },
                },
                required: ["name", "catalogName", "tooth", "qty", "unitPriceVnd"],
              },
            },
          },
          required: ["title", "rows"],
        },
      },
    },
    required: ["patientName", "dob", "patientId", "treatingDoctor", "phases"],
  },
} as const;

export const extractPlanFromImage = createServerFn({ method: "POST" })
  .inputValidator((d: ExtractInput) => d)
  .handler(async ({ data }): Promise<ImportedPlan> => {
    const required = process.env["PLAN_IMPORT_CODE"];
    if (required && data.accessCode !== required) {
      throw new Error("ACCESS_CODE_REQUIRED");
    }
    const apiKey = process.env["ANTHROPIC_API_KEY"];
    if (!apiKey) {
      throw new Error("The server has no ANTHROPIC_API_KEY set (add it in Vercel → Settings → Environment Variables, then redeploy).");
    }
    if (!ALLOWED.has(data.mediaType)) throw new Error("Unsupported image type.");
    if (!data.imageBase64 || data.imageBase64.length > MAX_BASE64_CHARS) {
      throw new Error("Image is too large — try a smaller screenshot or photo.");
    }

    const names = (data.catalogNames ?? []).slice(0, 800);
    const prompt = [
      "This image is a dental implant treatment plan / quotation (it may be a phone photo, a screenshot, or a scan; text may be Vietnamese or English).",
      "Read it and call record_treatment_plan.",
      "Rules:",
      "- Copy only what is visible. Never invent services, teeth, quantities or prices. Use null / empty string when something is not shown.",
      "- patientName: the patient/customer name (often near the top, next to 'Patient', 'Khách hàng', 'Họ tên', 'Dear …'). Keep Vietnamese diacritics.",
      "- Keep the phases in the order shown. If there are no phase headings, return a single phase.",
      "- One row per service line. Tooth numbers in FDI notation as written.",
      "- If a line shows a price per unit, give it in VND as a plain number (e.g. 'VND 12,000,000' → 12000000). Totals and currency conversions (AUD/USD…) are NOT unit prices.",
      "- catalogName: choose from this list ONLY when the line clearly is that service (wording may differ slightly or be in Vietnamese); otherwise null.",
      "",
      "Catalog:",
      names.map((n) => `- ${n}`).join("\n"),
    ].join("\n");

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env["ANTHROPIC_MODEL"] || "claude-sonnet-4-6",
        max_tokens: 4096,
        tools: [TOOL],
        tool_choice: { type: "tool", name: TOOL.name },
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: data.mediaType, data: data.imageBase64 } },
              { type: "text", text: prompt },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("[plan-import] Anthropic error", res.status, body.slice(0, 500));
      throw new Error(`Could not read the image (AI service error ${res.status}).`);
    }
    const json = (await res.json()) as { content?: { type: string; input?: unknown }[] };
    const block = json.content?.find((c) => c.type === "tool_use");
    if (!block?.input) throw new Error("The AI returned nothing readable. Try a clearer image.");
    return normalizePlan(block.input);
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
  return {
    patientName: str(o["patientName"]),
    dob: str(o["dob"]),
    patientId: str(o["patientId"]),
    treatingDoctor: str(o["treatingDoctor"]),
    phases: phases.filter((p) => p.rows.length > 0),
  };
}
