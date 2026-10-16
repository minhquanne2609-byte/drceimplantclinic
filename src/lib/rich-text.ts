import DOMPurify from "dompurify";

/**
 * Owner-authored rich text.
 *
 * Supports:
 * - Bold
 * - Italic
 * - Underline
 * - Strikethrough
 * - Font size
 * - Links
 * - Basic HTML blocks
 *
 * Formatting is stored as HTML and preserved after refresh.
 */

const ALLOWED_TAGS = [
  "b",
  "strong",
  "i",
  "em",
  "u",
  "s",
  "strike",
  "br",
  "p",
  "div",
  "span",
  "ul",
  "ol",
  "li",
  "a",
  "h1",
  "h2",
  "h3",
  "h4",
  "sup",
  "sub",
  "font",
  "blockquote",
];

const ALLOWED_ATTR = ["style", "href", "target", "rel", "class", "color", "size", "face"];

const ALLOWED_URI_REGEXP = /^(?:https?:|mailto:|tel:|#|\/)/i;

/**
 * Decode HTML entities.
 *
 * Example:
 * &lt;strong&gt;Hello&lt;/strong&gt;
 * becomes:
 * <strong>Hello</strong>
 */
function decodeHtmlEntities(value: string): string {
  if (typeof document === "undefined") {
    return value ?? "";
  }

  let result = value ?? "";

  for (let i = 0; i < 3; i++) {
    const textarea = document.createElement("textarea");
    textarea.innerHTML = result;

    const decoded = textarea.value;

    if (decoded === result) {
      break;
    }

    result = decoded;
  }

  return result;
}

/**
 * Detect whether a value contains real HTML tags.
 */
export function isHtml(value: string): boolean {
  return /<\s*(?:\/\s*)?(?:span|strong|b|em|i|u|s|strike|p|div|br|ul|ol|li|a|h[1-4]|sup|sub|font|blockquote)\b[^>]*>/i.test(
    value ?? "",
  );
}

/**
 * Normalize stored rich text.
 *
 * This repairs content that was previously saved as:
 *
 * &lt;span style="font-weight:bold"&gt;Text&lt;/span&gt;
 *
 * or multiple encoded layers.
 */
function normalizeRichHtml(value: string): string {
  let result = value ?? "";

  if (!result) {
    return "";
  }

  for (let i = 0; i < 3; i++) {
    const decoded = decodeHtmlEntities(result);

    if (decoded === result) {
      break;
    }

    result = decoded;
  }

  return result;
}

/**
 * Sanitize HTML while preserving formatting.
 *
 * IMPORTANT:
 * "style" is explicitly allowed so formatting such as:
 *
 * font-weight: bold
 * font-style: italic
 * text-decoration: underline
 * font-size: 20px
 *
 * survives sanitization.
 */
export function sanitizeHtml(html: string): string {
  if (typeof window === "undefined") {
    return stripTags(html);
  }

  const normalized = normalizeRichHtml(html);

  return DOMPurify.sanitize(normalized, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOWED_URI_REGEXP,
  });
}

/**
 * Remove HTML when rendering on the server.
 */
function stripTags(html: string): string {
  const decoded = typeof document !== "undefined" ? decodeHtmlEntities(html ?? "") : (html ?? "");

  return decoded.replace(/<[^>]*>/g, "").replace(/&nbsp;/gi, " ");
}

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
};

/**
 * Escape normal text.
 */
export function escapeHtml(text: string): string {
  return (text ?? "").replace(/[&<>]/g, (character) => ESCAPES[character] ?? character);
}

/**
 * Convert stored content into safe HTML for rendering.
 *
 * IMPORTANT:
 * HTML is NOT escaped.
 *
 * Therefore:
 *
 * <span style="font-weight:bold">
 *   Hello
 * </span>
 *
 * remains real HTML and will render as bold.
 */
export function toHtml(value: string): string {
  const raw = value ?? "";

  if (!raw) {
    return "";
  }

  const normalized = normalizeRichHtml(raw);

  /**
   * If the stored value is already HTML,
   * sanitize it and return it directly.
   */
  if (isHtml(normalized)) {
    return sanitizeHtml(normalized);
  }

  /**
   * Otherwise treat it as ordinary text.
   */
  return escapeHtml(normalized).replace(/\n/g, "<br />");
}

/**
 * Convert rich HTML into readable plain text.
 */
export function toPlain(value: string): string {
  const raw = value ?? "";

  if (!raw) {
    return "";
  }

  const normalized = normalizeRichHtml(raw);

  if (!isHtml(normalized)) {
    return normalized;
  }

  if (typeof document === "undefined") {
    return stripTags(normalized);
  }

  const element = document.createElement("div");

  element.innerHTML = sanitizeHtml(normalized);

  return (element.textContent ?? "").trim();
}

/**
 * Check whether rich text is effectively empty.
 */
export function isEmptyRich(value: string): boolean {
  return (
    toPlain(value)
      .replace(/\u200b/g, "")
      .trim() === ""
  );
}

/**
 * Available font sizes in the rich-text editor.
 */
export const FONT_SIZES = [8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40];

/**
 * Remove manual numbering when the UI already displays
 * a number badge.
 */
export function stripLeadingNumber(value: string): string {
  const v = value ?? "";

  return v.replace(/^((?:\s|<(?:p|div|span|strong|b|em|i|u|h[1-6])[^>]*>|&nbsp;)*)\d{1,2}\s*[.)\u2013-]\s*/i, "$1");
}
