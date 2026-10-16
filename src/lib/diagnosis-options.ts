/**
 * Clinical option lists used by the Diagnosis section only.
 * No pricing lives here — pricing stays in the Treatment Plan / services catalog.
 */

export const ISSUE_OPTIONS: string[] = [
  "Caries",
  "Large Cavity",
  "Extensive Tooth Decay",
  "Fractured",
  "Cracked",
  "Chipped",
  "Tooth Wear",
  "Severe Tooth Wear",
  "Attrition",
  "Abrasion",
  "Erosion",
  "Discolored",
  "Intrinsic Discoloration",
  "Pulpitis",
  "Reversible Pulpitis",
  "Irreversible Pulpitis",
  "Pulp Necrosis",
  "Previous Root Canal Treatment",
  "Failed Root Canal Treatment",
  "Root Canal Infection",
  "Periapical Infection",
  "Periapical Lesion",
  "Bone Loss",
  "Severe Bone Loss",
  "Periapical Abscess",
  "Gingivitis",
  "Periodontitis",
  "Gum Recession",
  "Deep Periodontal Pocket",
  "Gum Swelling",
  "Periodontal Bone Loss",
  "Mobility",
  "Missing",
  "Impacted",
  "Partially Erupted",
  "Unerupted",
  "Rotated",
  "Tilted",
  "Crowded",
  "Spacing",
  "Extruded",
  "Intruded",
  "Existing Crown",
  "Existing Bridge",
  "Existing Veneer",
  "Existing Filling",
  "Metal Filling",
  "Leaking Filling",
  "Broken Crown",
  "Loose Crown",
  "Defective Filling",
  "Poorly Fitting Crown",
  "Retained Primary Tooth",
  "Infection",
];

export const TREATMENT_GROUPS: { group: string; items: string[] }[] = [
  {
    group: "Surgery / Oral Procedures",
    items: [
      "Extraction",
      "Infection Curettage",
      "Apicoectomy & Retrograde Filling with MTA",
      "Gingivectomy & Alveoloplasty (Gum Contouring)",
    ],
  },
  {
    group: "Endodontics",
    items: ["Root Canal Treatment", "Root Canal Re-treatment"],
  },
  {
    group: "Restorative",
    items: [
      "Inlay/Onlay",
      "Overlay",
      "Endocrown",
      "Fillings",
      "Class I Fillings",
      "Class II, III Fillings",
      "Class IV Fillings",
      "Class V Fillings",
      "Liner and Pulp Protection",
      "Re-cementing Porcelain Crown",
    ],
  },
  {
    group: "Aesthetic / Cosmetic",
    items: ["Teeth Whitening", "E.max Veneer", "Full Zirconia Crown"],
  },
  {
    group: "Periodontal",
    items: [
      "Scaling and Polishing",
      "Mild Periodontal Disease Treatment",
      "Moderate Periodontal Disease Treatment (Root Treatment)",
      "Advanced Periodontal Flap Surgery and Root Treatment",
      "Gum Graft",
    ],
  },
  {
    group: "Bone & Sinus Procedures",
    items: [
      "Closed Sinus Lift",
      "Open Sinus Lift + Bone Graft",
      "Closed Sinus Lift + Bone Graft",
      "Bone Graft Level I",
      "Bone Graft Level II",
      "Bone Graft GBR",
    ],
  },
  {
    group: "Implant",
    items: [
      "Implant",
      "All-on-4 Implant",
      "All-on-6 Implant",
      "All-on-6 Implant (4 Standards + 2 Pterygoids)",
      "Pterygoid Implant",
      "Nasal Floor Implant",
      "Zygomatic Implant",
    ],
  },
  {
    group: "Temporary Restoration",
    items: ["Temporary PMMA Crown", "Temporary PMMA Crown on Temporary Abutment"],
  },
];

export const TREATMENT_OPTIONS: string[] = TREATMENT_GROUPS.flatMap((g) => g.items);

/** Comma-separated string <-> list helpers (keeps saved plans backwards-compatible). */
export const parseList = (v?: string): string[] =>
  (v ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

export const joinList = (v: string[]): string => v.join(", ");
