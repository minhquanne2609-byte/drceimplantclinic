import { supabase } from "@/integrations/supabase/client";
import { normalizeMedia, type MediaItem } from "@/lib/clinic-media";
import { toHtml } from "@/lib/rich-text";
import heroTeam from "@/assets/hero-team.jpg";
import heroBanner from "@/assets/hero-banner.png";
import clinic1 from "@/assets/clinic/clinic-1.png";
import clinic2 from "@/assets/clinic/clinic-2.jpg";
import clinic3 from "@/assets/clinic/clinic-3.jpg";
import baBefore1 from "@/assets/clinic/before-1.jpg";
import baAfter1 from "@/assets/clinic/after-1.jpg";
import drCareLogo from "@/assets/drcare-logo-new-upload.png";
import { PRICE_LISTS } from "@/lib/price-lists";

/** Shipped price-list pages for one category, as media items. */
const priceListMedia = (id: string): MediaItem[] =>
  (PRICE_LISTS.find((p) => p.id === id)?.pages ?? []).map((url, i) => ({
    url,
    alt: `Price list page ${i + 1}`,
    fit: "contain" as const,
    position: "50% 50%",
  }));

/** One editable block of patient-facing copy. Design is owned by the app, never by content. */
export type ContentValue = {
  /** Rich text (sanitized HTML subset). Legacy rows may hold plain text. */
  title: string;
  body: string;
  items: { title: string; lines: string[] }[];
  /** Clinic-owned images belonging to this block (never patient-private). */
  media: MediaItem[];
};

export type ContentKey =
  | "patient_introduction"
  | "advanced_technology"
  | "photos_references"
  | "diagnosis_introduction"
  | "treatment_plan_introduction"
  | "special_treatment_support_package"
  | "package_conditions"
  | "clinic_introduction"
  | "before_after_introduction"
  | "final_cta"
  | "medical_disclaimer"
  | "your_journey"
  | "hero_image"
  | "patient_portrait"
  | "patient_information"
  | "patient_benefits"
  | "price_list"
  | "price_list_categories"
  | "price_list_images_overview"
  | "price_list_images_single"
  | "price_list_images_denture"
  | "price_list_images_allon4"
  | "price_list_images_allon5"
  | "price_list_images_allon6"
  | "clinic_photos"
  | "before_after_media"
  | "clinic_contact"
  | "a4_introduction"
  | "a4_cover_image"
  | "a4_clinic_photos";

export type ContentMap = Record<ContentKey, ContentValue>;

export type ContentSection =
  | "Patient Information"
  | "Advanced Technology"
  | "Photos / X-rays / References"
  | "Diagnosis"
  | "Treatment Plan"
  | "Special Treatment Support Package"
  | "Our Clinic"
  | "Before & After"
  | "Final CTA"
  | "A4 Patient Proposal";

export type ContentMeta = {
  key: ContentKey;
  section: ContentSection;
  label: string;
  hint: string;
  titleLabel: string;
  bodyLabel: string;
  itemsLabel?: string;
  /** When set, the block also owns a clinic image list. */
  mediaLabel?: string;
  maxMedia?: number;
  /** When set, this block is edited inside the combined "Price List Images" card instead of getting its own row. */
  hiddenFromList?: boolean;
};

/** The six price-list category image blocks, grouped under one admin card. Order matches PRICE_LISTS. */
export const PRICE_LIST_IMAGE_KEYS: ContentKey[] = [
  "price_list_images_overview",
  "price_list_images_single",
  "price_list_images_denture",
  "price_list_images_allon4",
  "price_list_images_allon5",
  "price_list_images_allon6",
];

export const CONTENT_META: ContentMeta[] = [
  {
    section: "Patient Information",
    key: "patient_introduction",
    label: "Patient Introduction",
    hint: "Hero title and the opening letter shown above the patient's name.",
    titleLabel: "Hero title",
    bodyLabel: "Introduction letter",
  },
  {
    section: "Advanced Technology",
    key: "advanced_technology",
    label: "Advanced Technology",
    hint: "Use “|” in the title to mark the highlighted part. Three columns are shown in the existing layout.",
    titleLabel: "Heading",
    bodyLabel: "Paragraph",
    itemsLabel: "Columns",
  },
  {
    section: "Diagnosis",
    key: "diagnosis_introduction",
    label: "Diagnosis Introduction",
    hint: "Diagnosis heading and default summary paragraph.",
    titleLabel: "Heading",
    bodyLabel: "Summary",
  },
  {
    section: "Treatment Plan",
    key: "treatment_plan_introduction",
    label: "Treatment Plan Introduction",
    hint: "Heading and optional intro paragraph shown above the phases. Format the text (bold, italic, size, colour) here.",
    titleLabel: "Heading",
    bodyLabel: "Intro text (optional)",
  },
  {
    section: "Treatment Plan",
    key: "package_conditions",
    label: "Package Conditions",
    hint: "Notice shown with the quotation / price lists.",
    titleLabel: "Heading",
    bodyLabel: "Conditions",
  },
  {
    section: "Our Clinic",
    key: "clinic_introduction",
    label: "Our Clinic",
    hint: "Clinic section heading and description.",
    titleLabel: "Heading",
    bodyLabel: "Description",
  },
  {
    section: "Final CTA",
    key: "final_cta",
    label: "Final CTA",
    hint: "Closing call-to-action above the contact details.",
    titleLabel: "Eyebrow",
    bodyLabel: "Button label",
  },
  {
    section: "Treatment Plan",
    key: "medical_disclaimer",
    label: "Medical / Treatment Disclaimer",
    hint: "Important notes shown under the grand total.",
    titleLabel: "Heading",
    bodyLabel: "Note under the total",
    itemsLabel: "Notes",
  },
  {
    section: "Patient Information",
    key: "your_journey",
    label: "Your Journey",
    hint: "Timeline shown under the greeting. Each item matches an existing section — icons and links stay fixed.",
    titleLabel: "Heading",
    bodyLabel: "Intro line",
    itemsLabel: "Journey steps",
  },
  {
    section: "Patient Information",
    key: "hero_image",
    label: "Hero image",
    hint: "Default cover photo at the top of the presentation.",
    titleLabel: "Internal label",
    bodyLabel: "Caption (optional)",
    mediaLabel: "Hero image",
    maxMedia: 1,
  },
  {
    section: "Patient Information",
    key: "patient_portrait",
    label: "Greeting portrait",
    hint: "Round photo shown next to the welcome letter.",
    titleLabel: "Internal label",
    bodyLabel: "Caption (optional)",
    mediaLabel: "Portrait photo",
    maxMedia: 1,
  },
  {
    section: "Patient Information",
    key: "patient_information",
    label: "Patient Information headings",
    hint: "Headings of the patient form, medical history and allergy blocks.",
    titleLabel: "Form heading",
    bodyLabel: "Helper text (optional)",
    itemsLabel: "Sub-headings",
  },
  {
    section: "Special Treatment Support Package",
    key: "patient_benefits",
    label: "Patient Benefits list",
    hint: "Complimentary benefits shown to the patient.",
    titleLabel: "Heading",
    bodyLabel: "Intro sentence",
    itemsLabel: "Benefits",
  },
  {
    section: "Treatment Plan",
    key: "price_list",
    label: "Implant Price List",
    hint: "Price-list heading, brand note and exchange-rate note.",
    titleLabel: "Heading",
    bodyLabel: "Brand note",
    itemsLabel: "Notes",
  },
  {
    section: "Treatment Plan",
    key: "price_list_categories",
    label: "Implant Price List — category buttons",
    hint: "Names shown on the price-list selector buttons (e.g. “General price list”). The line under each name is only used as a hover tooltip. Order matches the buttons shown on the page. To update the price-list photos themselves, edit the matching “images” block below.",
    titleLabel: "Section label (internal, optional)",
    bodyLabel: "Section note (internal, optional)",
    itemsLabel: "Category buttons",
  },
  {
    section: "Treatment Plan",
    key: "price_list_images_overview",
    label: "Price List Images — General price list",
    hint: "Photos shown for the “General price list” button. Add one image per page, in order. Leave empty to keep the images shipped with the app.",
    titleLabel: "Internal label",
    bodyLabel: "Caption (optional)",
    mediaLabel: "General price list pages",
    hiddenFromList: true,
  },
  {
    section: "Treatment Plan",
    key: "price_list_images_single",
    label: "Price List Images — Single service price list",
    hint: "Photos shown for the “Single service price list” button. Add one image per page, in order. Leave empty to keep the images shipped with the app.",
    titleLabel: "Internal label",
    bodyLabel: "Caption (optional)",
    mediaLabel: "Single service price list pages",
    hiddenFromList: true,
  },
  {
    section: "Treatment Plan",
    key: "price_list_images_denture",
    label: "Price List Images — Removable denture price list",
    hint: "Photos shown for the “Removable denture price list” button. Add one image per page, in order. Leave empty to keep the images shipped with the app.",
    titleLabel: "Internal label",
    bodyLabel: "Caption (optional)",
    mediaLabel: "Removable denture price list pages",
    hiddenFromList: true,
  },
  {
    section: "Treatment Plan",
    key: "price_list_images_allon4",
    label: "Price List Images — Full arch All-on-4",
    hint: "Photos shown for the “Full arch — All-on-4” button. Add one image per page, in order. Leave empty to keep the images shipped with the app.",
    titleLabel: "Internal label",
    bodyLabel: "Caption (optional)",
    mediaLabel: "All-on-4 price list pages",
    hiddenFromList: true,
  },
  {
    section: "Treatment Plan",
    key: "price_list_images_allon5",
    label: "Price List Images — Full arch All-on-5",
    hint: "Photos shown for the “Full arch — All-on-5” button. Add one image per page, in order. Leave empty to keep the images shipped with the app.",
    titleLabel: "Internal label",
    bodyLabel: "Caption (optional)",
    mediaLabel: "All-on-5 price list pages",
    hiddenFromList: true,
  },
  {
    section: "Treatment Plan",
    key: "price_list_images_allon6",
    label: "Price List Images — Full arch All-on-6",
    hint: "Photos shown for the “Full arch — All-on-6” button. Add one image per page, in order. Leave empty to keep the images shipped with the app.",
    titleLabel: "Internal label",
    bodyLabel: "Caption (optional)",
    mediaLabel: "All-on-6 price list pages",
    hiddenFromList: true,
  },
  {
    section: "Our Clinic",
    key: "clinic_photos",
    label: "Clinic photos",
    hint: "Default clinic images. Patient-specific photos stay inside each plan.",
    titleLabel: "Internal label",
    bodyLabel: "Caption (optional)",
    mediaLabel: "Clinic photos",
  },
  {
    section: "Our Clinic",
    key: "clinic_contact",
    label: "Contact details",
    hint: "Address, WhatsApp, email, website and working hours.",
    titleLabel: "Heading",
    bodyLabel: "Intro (optional)",
    itemsLabel: "Contact lines",
  },
  {
    section: "A4 Patient Proposal",
    key: "a4_introduction",
    label: "A4 cover copy",
    hint: "Used only by the A4 Patient Proposal export. Leave empty to reuse the web introduction.",
    titleLabel: "Cover title",
    bodyLabel: "Cover letter",
  },
  {
    section: "A4 Patient Proposal",
    key: "a4_cover_image",
    label: "A4 cover image",
    hint: "Photo on the right of the A4 cover page. Choose “Fit whole image” if the photo is cropped badly.",
    titleLabel: "Internal label",
    bodyLabel: "Caption (optional)",
    mediaLabel: "A4 cover image",
    maxMedia: 1,
  },
  {
    section: "A4 Patient Proposal",
    key: "a4_clinic_photos",
    label: "A4 clinic photos",
    hint: "Photo strip on the last A4 page. Add as many photos as you like, crop and align each one.",
    titleLabel: "Internal label",
    bodyLabel: "Caption (optional)",
    mediaLabel: "A4 clinic photos",
  },
  {
    section: "Before & After",
    key: "before_after_media",
    label: "Before & After photos",
    hint: "Default transformation pair. First image is Before, second is After.",
    titleLabel: "Internal label",
    bodyLabel: "Caption (optional)",
    mediaLabel: "Before / After",
    maxMedia: 2,
  },
];
type ShippedValue = {
  title: string;
  body: string;
  items: { title: string; lines: string[] }[];
  media?: MediaItem[];
};

/** Current wording shipped with the app — also the safe fallback. */
const SHIPPED: Record<ContentKey, ShippedValue> = {
  patient_introduction: {
    title: "Specialized Dental Implant Clinic for International Patients",
    body: "At Dr. Care Implant Clinic, we understand that dental problems affect far more than just your ability to eat comfortably — they can also impact your confidence, overall oral health, and quality of life. After carefully reviewing your clinical records, our doctors have prepared a personalised treatment plan tailored specifically to your current dental condition. Our goal is not only to restore your smile, but also to rebuild long-term function, comfort, stability, and confidence. Please take a moment to review the treatment recommendations below. We hope this report helps you better understand your oral condition, the reasons behind our recommendations, and the treatment options available to you. Our team will be with you every step of the way, and we are always happy to answer any questions you may have.",
    items: [],
  },
  advanced_technology: {
    title: "World-class Technology For|Predictable Treatment Outcomes",
    body: "Every treatment plan is developed using advanced 3D diagnostics, internationally recognised implant systems and digitally guided surgical planning. Our goal is to provide safe, accurate and long-term treatment tailored to your individual clinical condition.",
    items: [
      {
        title: "Implant Systems",
        lines: ["Straumann", "Neodent", "Nobel", "Osstem", "Dentium", "JDental Care"],
      },
      {
        title: "Digital Planning",
        lines: ["CBCT imaging", "3D Surgical Guides", "Digital Smile Design", "Intraoral Scanning"],
      },
      {
        title: "Restorative Materials",
        lines: ["Zirconia Crown", "IPS E.max Veneer", "CAD/CAM Manufacturing", "Customized Abutment"],
      },
    ],
  },
  photos_references: {
    title: "Photos, X-rays & references",
    body: "Upload any images you want to include — before/after photos, scans, notes.",
    items: [],
  },
  diagnosis_introduction: {
    title: "DIAGNOSIS",
    body: "Upper jaw: \nLower jaw: ",
    items: [],
  },
  treatment_plan_introduction: {
    title: "Treatment Plan",
    body: "",
    items: [],
  },
  special_treatment_support_package: {
    title: "Patient benefits",
    body: "To enhance your experience and reduce financial stress, we are pleased to offer the following complimentary benefits:",
    items: [
      {
        title: "FREE Consultation and CT scan:",
        lines: [
          "3D Cone Beam CT scans (initial and additional scans as needed during treatment).",
          "Comprehensive consultation with our dental specialists.",
          "A tailored treatment plan based on your specific needs.",
        ],
      },
      {
        title: "FREE Transportation Services:",
        lines: [
          "Airport pick-up on the day you arrive in Vietnam.",
          "Transportation from your accommodation to the clinic and back on your first visit to our clinic and surgery day.",
        ],
      },
      {
        title: "FREE Tooth Extractions:",
        lines: ["All extractions required for the All-on-4 or All-on-6 procedure are covered."],
      },
      {
        title: "FREE Post-Surgery Support:",
        lines: [
          "Medications: Antibiotics, anti-inflammatory drugs, and painkillers.",
          "Recovery kit: Ice packs, mouthwash, and soft food (e.g., porridge) to aid in recovery.",
        ],
      },
      {
        title: "FREE Hotel Support (Value: 10,000,000 VND / ~544 AUD):",
        lines: [
          "We provide support for 10 nights of accommodation (valued at ~1,000,000 VND per night) for patients undergoing full-mouth implant treatment (All-on-4/All-on-6). This amount (10,000,000 VND) will be directly deducted from your total treatment bill.",
        ],
      },
    ],
  },
  package_conditions: {
    title: "Important notice",
    body: "This treatment plan is for reference only and is not a firm commitment. Final treatment details, timeline, and fees will be confirmed after a clinical examination and discussion with your doctor.",
    items: [],
  },
  clinic_introduction: {
    title: "Our Clinic",
    body: "A specialized implant clinic trusted by international patients, with modern facilities and a team of experienced specialists.",
    items: [],
  },
  before_after_introduction: {
    title: "Before & After",
    body: "Drag the middle handle to adjust the split ratio (default 50:50).",
    items: [],
  },
  final_cta: {
    title: "Contact Us",
    body: "Ask our doctor's assistant here",
    items: [],
  },
  medical_disclaimer: {
    title: "Important Notes",
    body: "*Note: This treatment plan and the estimated costs are based on the doctor's assessment of the current condition and will be finalized after the in-person examination.",
    items: [
      {
        title: "Treatment Plan",
        lines: [
          "This treatment plan is a preliminary estimate based on the records currently available and is intended for reference only. Final diagnosis, procedures, fees, and timeline will be confirmed after a clinical examination and CBCT (3D CT scan).",
        ],
      },
      {
        title: "Treatment Timeline",
        lines: [
          "Treatment duration is estimated only and may vary depending on your clinical condition, healing, laboratory scheduling, surgeon availability, and booking dates. Please contact us before booking flights so we can prepare a personalised treatment schedule.",
        ],
      },
      {
        title: "Currency",
        lines: [
          "All treatment fees are fixed in VND. Foreign currency values are calculated using the Google exchange rate on the date this report is generated and are provided for reference only.",
        ],
      },
      {
        title: "Treatment Changes",
        lines: [
          "If additional findings are identified during your examination or surgery, the treatment plan may be adjusted to achieve the safest and most predictable long-term outcome. Any significant changes will always be discussed with you before treatment proceeds.",
        ],
      },
      {
        title: "Treatment Recommendations",
        lines: [
          "The proposed treatment plan reflects our doctors' professional recommendations based on the clinical information currently available and internationally accepted treatment principles. Patients may choose to modify or decline certain recommended procedures; however, doing so may affect the long-term function, aesthetics, stability, or prognosis of the final treatment outcome.",
        ],
      },
    ],
  },
  your_journey: {
    title: 'Your Journey<span class="block font-normal">to a Healthier Smile</span>',
    body: "From your initial assessment to your personalized treatment plan, every step has been carefully prepared around your needs.",
    items: [
      { title: "Patient Information", lines: ["Your personal and treatment information"] },
      { title: "Advanced Technology", lines: ["Technology and materials used in your treatment"] },
      { title: "Photos, X-rays & References", lines: ["Your clinical images and supporting references"] },
      { title: "Diagnosis", lines: ["Your current dental assessment"] },
      { title: "Treatment Plan", lines: ["Your personalized treatment plan"] },
      { title: "Our Clinic", lines: ["Meet the clinic and treatment environment"] },
      { title: "Before & After", lines: ["Real patient transformations"] },
    ],
  },
  hero_image: {
    title: "Hero image",
    body: "",
    items: [],
    media: [{ url: heroBanner, alt: "Dr. Care Implant Clinic team", fit: "cover", position: "50% 50%" }],
  },
  a4_introduction: {
    title: "",
    body: "",
    items: [],
  },
  a4_cover_image: {
    title: "A4 cover image",
    body: "",
    items: [],
    media: [{ url: heroTeam, alt: "Dr. Care Implant Clinic team", fit: "contain", position: "50% 50%" }],
  },
  patient_portrait: {
    title: "Greeting portrait",
    body: "",
    items: [],
    media: [{ url: drCareLogo, alt: "Dr. Care Implant Clinic", fit: "contain", position: "50% 50%" }],
  },
  patient_information: {
    title: "Overview. PATIENT INFORMATION FORM",
    body: "",
    items: [
      { title: "MEDICAL HISTORY", lines: [] },
      { title: "MEDICATION ALLERGY", lines: [] },
    ],
  },
  patient_benefits: {
    title: "Special Treatment Support Package",
    body: "The following services and benefits are provided as part of our treatment support package for eligible implant treatment. Eligibility may depend on the treatment plan and services undertaken.",
    items: [
      {
        title: "FREE Consultation & Diagnostic Imaging — (Value 30 USD):",
        lines: [
          "Clinical consultation and necessary diagnostic imaging at our clinic, including CBCT/CT scan and X-rays required for treatment planning, are provided at no additional charge.",
        ],
      },
      {
        title: "FREE Airport & Treatment Transportation — (Value 180 USD):",
        lines: [
          "Complimentary private-car transportation is arranged for:",
          "Airport pick-up upon arrival in Ho Chi Minh City.",
          "Airport drop-off at the end of your treatment trip.",
          "Hotel → clinic → hotel transportation for all scheduled treatment appointments during both Trip 1 and Trip 2.",
        ],
      },
      {
        title: "FREE Implant-Related Extractions:",
        lines: [
          "Any tooth extraction clinically required specifically for the planned implant treatment is provided at no additional charge.",
        ],
      },
      {
        title: "FREE Post-Surgery Support:",
        lines: [
          "Medications: Antibiotics, anti-inflammatory drugs, and painkillers.",
          "Recovery kit: Ice packs, mouthwash, and soft food (e.g., porridge) provided to aid in your immediate recovery.",
        ],
      },
      {
        title: "Accommodation Support — (Value 10,000,000 VND ~382 USD):",
        lines: [
          "Accommodation support valued at VND 10,000,000 is provided for the eligible treatment period, from the start of implant treatment until the fixed temporary restoration is fitted.",
          "To give you greater flexibility in choosing your preferred accommodation, we do not book the hotel on your behalf. Instead, once you arrive and proceed with the agreed eligible treatment plan, the support value will be deducted directly from your treatment bill.",
        ],
      },
      {
        title: "FREE Airport Immigration Fast Track — (Value 50 USD):",
        lines: [
          "Upon arrival at the airport, a Fast Track representative will meet you inside the arrival area and assist you through the arrival process, including priority immigration processing and baggage collection assistance.",
          "This service is designed to significantly reduce the usual waiting time at immigration. Depending on airport conditions, the arrival process may take approximately 30 minutes instead of potentially 1–2 hours during busy periods.",
        ],
      },
      {
        title: "FREE Vietnam SIM Card:",
        lines: [
          "A local SIM card is provided to help you stay connected with our International Patient Team and access essential communication services throughout your treatment trip.",
        ],
      },
      {
        title: "Visa Application Support — (Value 40 USD):",
        lines: [
          "If visa assistance is required, we can connect you directly with our supporting visa agency. The current service fee for a single-entry visa is USD 40, with an estimated processing time of 5–7 days.",
          "The service is arranged directly between you and the visa agency and must initially be paid in advance. If you subsequently arrive and proceed with the agreed eligible treatment plan, the USD 40 visa service fee will be credited against your treatment bill.",
        ],
      },
      {
        title: "FREE High-Quality Fixed Temporary Restoration — (Value 770 USD):",
        lines: [
          "For qualifying full-arch implant treatment, a high-quality fixed temporary restoration during Trip 1 is included at no additional charge. This provides a fixed provisional set of teeth during the implant healing and osseointegration period before the final restoration is completed.",
        ],
      },
      {
        title: "English-Language & Interpretation Support Throughout Your Stay:",
        lines: [
          "English-speaking assistance is available throughout your treatment, including communication with doctors, treatment coordination and aftercare.",
          "Our International Patient Team can also provide remote interpretation assistance by phone during your stay in Vietnam when reasonably required, for example, if you experience a language barrier with transportation, accommodation or other practical matters.",
        ],
      },
      {
        title: "Package Conditions:",
        lines: [
          "The benefits above apply to eligible implant treatment and are subject to the final confirmed treatment plan. Eligibility for individual benefits may vary according to the type and scope of treatment undertaken. Where a benefit is provided as a treatment credit or reimbursement, the applicable amount will be deducted from the treatment bill after the patient arrives and proceeds with the agreed eligible treatment.",
        ],
      },
    ],
  },
  price_list: {
    title: "Implant Price List",
    body: "Depending on the condition of your jawbone, our doctors will assign the most suitable implant brand for each case.",
    items: [
      {
        title: "Exchange rate",
        lines: [
          "The USD and AUD amounts are converted from the manually entered VND price for estimation only. Rates may vary depending on the payment date and your bank.",
        ],
      },
    ],
  },
  price_list_categories: {
    title: "Implant Price List — category buttons",
    body: "",
    items: [
      { title: "General price list", lines: ["Dental services at Dr. Care — overview"] },
      { title: "Single service price list", lines: ["Individual treatments, crowns and implants"] },
      { title: "Removable denture price list", lines: ["Removable and partial dentures"] },
      { title: "Full arch — All-on-4", lines: ["Full-arch All-on-4 packages"] },
      { title: "Full arch — All-on-5", lines: ["Full-arch All-on-5 packages"] },
      { title: "Full arch — All-on-6", lines: ["Full-arch All-on-6 packages"] },
    ],
  },
  price_list_images_overview: {
    title: "General price list images",
    body: "",
    items: [],
    media: priceListMedia("overview"),
  },
  price_list_images_single: {
    title: "Single service price list images",
    body: "",
    items: [],
    media: priceListMedia("single"),
  },
  price_list_images_denture: {
    title: "Removable denture price list images",
    body: "",
    items: [],
    media: priceListMedia("denture"),
  },
  price_list_images_allon4: {
    title: "All-on-4 price list images",
    body: "",
    items: [],
    media: priceListMedia("allon4"),
  },
  price_list_images_allon5: {
    title: "All-on-5 price list images",
    body: "",
    items: [],
    media: priceListMedia("allon5"),
  },
  price_list_images_allon6: {
    title: "All-on-6 price list images",
    body: "",
    items: [],
    media: priceListMedia("allon6"),
  },
  clinic_photos: {
    title: "Clinic photos",
    body: "",
    items: [],
    media: [
      { url: clinic1, alt: "Dr. Care Implant Clinic", fit: "cover", position: "50% 50%" },
      { url: clinic2, alt: "Dr. Care Implant Clinic", fit: "cover", position: "50% 50%" },
      { url: clinic3, alt: "Dr. Care Implant Clinic", fit: "cover", position: "50% 50%" },
    ],
  },
  a4_clinic_photos: {
    title: "A4 clinic photos",
    body: "",
    items: [],
    media: [
      { url: clinic1, alt: "Dr. Care Implant Clinic", fit: "cover", position: "50% 50%" },
      { url: clinic2, alt: "Dr. Care Implant Clinic", fit: "cover", position: "50% 50%" },
      { url: clinic3, alt: "Dr. Care Implant Clinic", fit: "cover", position: "50% 50%" },
    ],
  },
  before_after_media: {
    title: "Before & After photos",
    body: "",
    items: [],
    media: [
      { url: baBefore1, alt: "Before treatment", caption: "Before", fit: "cover", position: "50% 50%" },
      { url: baAfter1, alt: "After treatment", caption: "After", fit: "cover", position: "50% 50%" },
    ],
  },
  clinic_contact: {
    title: "Contact details",
    body: "",
    items: [
      {
        title: "Details",
        lines: [
          "Address: P3-0.SH08, Park 3, Vinhomes Central Park, 720A Dien Bien Phu, Thanh My Tay Ward, Binh Thanh District, Ho Chi Minh City, Vietnam.",
          "WhatsApp: (+84) 768738910 / (+84) 77 5138910",
          "Email: tu.nc@drcareimplant.com",
          "Website: https://drcareimplant.com/",
          "Working hours: Mon – Sat, 8:00 – 18:00",
        ],
      },
    ],
  },
};

export const DEFAULT_CONTENT: ContentMap = Object.fromEntries(
  Object.entries(SHIPPED).map(([key, value]) => [key, { media: [], ...value }]),
) as ContentMap;

export type ContentRow = {
  content_key: string;
  content_value?: unknown;
  title: string;
  body: string;
  items: unknown;
  version: number;
  updated_at: string;
  updated_by_email: string | null;
};

function normalizeItems(items: unknown): { title: string; lines: string[] }[] {
  if (!Array.isArray(items)) return [];
  return items
    .filter((i): i is Record<string, unknown> => !!i && typeof i === "object")
    .map((i) => ({
      title: typeof i["title"] === "string" ? i["title"] : "",
      lines: Array.isArray(i["lines"]) ? i["lines"].filter((l): l is string => typeof l === "string") : [],
    }));
}

const CONTENT_CHANNEL = "drcare:clinic-content-updated";
const CONTENT_TTL_MS = 30_000;

let contentCache: { at: number; data: { map: ContentMap; rows: ContentRow[] } } | null = null;
let inflight: Promise<{ map: ContentMap; rows: ContentRow[] }> | null = null;

/** Drop every cached copy of the clinic content and tell all tabs/pages to refetch. */
export function invalidateContentCache(): void {
  contentCache = null;
  inflight = null;
  if (typeof window === "undefined") return;
  const stamp = String(Date.now());
  window.dispatchEvent(new CustomEvent(CONTENT_CHANNEL, { detail: stamp }));
  try {
    if ("BroadcastChannel" in window) {
      const ch = new BroadcastChannel(CONTENT_CHANNEL);
      ch.postMessage(stamp);
      ch.close();
    }
    // Cross-tab fallback for browsers without BroadcastChannel.
    localStorage.setItem(CONTENT_CHANNEL, stamp);
  } catch {
    /* storage/broadcast unavailable — the in-page event still fired */
  }
}

/** Subscribe to content invalidations (same page, other tabs, other windows). */
export function onContentInvalidated(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => {
    contentCache = null;
    inflight = null;
    cb();
  };
  const onStorage = (e: StorageEvent) => {
    if (e.key === CONTENT_CHANNEL) handler();
  };
  window.addEventListener(CONTENT_CHANNEL, handler as EventListener);
  window.addEventListener("storage", onStorage);
  let ch: BroadcastChannel | null = null;
  try {
    if ("BroadcastChannel" in window) {
      ch = new BroadcastChannel(CONTENT_CHANNEL);
      ch.onmessage = handler;
    }
  } catch {
    ch = null;
  }
  return () => {
    window.removeEventListener(CONTENT_CHANNEL, handler as EventListener);
    window.removeEventListener("storage", onStorage);
    ch?.close();
  };
}

/**
 * Active clinic content merged over the shipped defaults.
 * Never throws: if the table cannot be read the defaults are returned.
 * Cached briefly; pass `{ force: true }` (or call invalidateContentCache) to bypass.
 */
export async function fetchActiveContent(opts?: { force?: boolean }): Promise<{ map: ContentMap; rows: ContentRow[] }> {
  if (opts?.force) {
    contentCache = null;
    inflight = null;
  } else {
    if (contentCache && Date.now() - contentCache.at < CONTENT_TTL_MS) {
      return {
        map: structuredClone(contentCache.data.map),
        rows: contentCache.data.rows,
      };
    }
    if (inflight) return inflight;
  }
  inflight = loadActiveContent().then((result) => {
    contentCache = { at: Date.now(), data: result };
    inflight = null;
    return result;
  });
  return inflight;
}

async function loadActiveContent(): Promise<{ map: ContentMap; rows: ContentRow[] }> {
  const map: ContentMap = structuredClone(DEFAULT_CONTENT);
  try {
    const { data, error } = await supabase
      .from("clinic_content" as never)
      .select("content_key, title, body, items, content_value, version, updated_at, updated_by_email")
      .eq("is_active", true);
    if (error) throw error;
    const rows = (data ?? []) as unknown as ContentRow[];
    for (const row of rows) {
      const key = row.content_key as ContentKey;
      if (!(key in map)) continue;
      // The saved row IS the clinic default — never fall back to shipped copy,
      // otherwise an intentionally emptied field would silently reappear.
      const value = (row.content_value ?? {}) as Record<string, unknown>;
      map[key] = {
        title: toHtml(row.title ?? ""),
        body: toHtml(row.body ?? ""),
        items: normalizeItems(row.items).map((item) => ({
          title: toHtml(item.title),
          lines: item.lines.map((line) => toHtml(line)),
        })),
        media: normalizeMedia(value["media"]),
      };
    }
    return { map, rows };
  } catch {
    return { map, rows: [] };
  }
}

/** Save a new active version of one content block (previous version is kept). */
export async function saveContentAsDefault(
  key: ContentKey,
  value: ContentValue,
  user: { id: string; email: string | null },
): Promise<number> {
  const { data: existing, error: readErr } = await supabase
    .from("clinic_content" as never)
    .select("id, version")
    .eq("content_key", key)
    .order("version", { ascending: false })
    .limit(1);
  if (readErr) throw readErr;
  const current = (existing ?? [])[0] as { id: string; version: number } | undefined;
  const nextVersion = (current?.version ?? 0) + 1;

  if (current) {
    const { error } = await supabase
      .from("clinic_content" as never)
      .update({ is_active: false } as never)
      .eq("content_key", key);
    if (error) throw error;
  }

  const { error } = await supabase.from("clinic_content" as never).insert({
    content_key: key,
    title: toHtml(value.title),
    body: toHtml(value.body),
    items: value.items.map((item) => ({
      title: toHtml(item.title),
      lines: item.lines.map((line) => toHtml(line)),
    })),
    content_type: "rich",
    content_value: { media: value.media ?? [] },
    version: nextVersion,
    is_active: true,
    updated_by: user.id,
    updated_by_email: user.email,
  } as never);
  if (error) throw error;
  invalidateContentCache();
  return nextVersion;
}

export async function isContentManager(): Promise<boolean> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return false;
  const { data, error } = await supabase
    .from("user_roles" as never)
    .select("role")
    .eq("user_id", auth.user.id);
  if (error) return false;
  return ((data ?? []) as unknown as { role: string }[]).some((r) => r.role === "owner" || r.role === "admin");
}
