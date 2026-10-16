import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ElementType,
  type FocusEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Eraser,
  Highlighter,
  Indent,
  Italic,
  Link2,
  List,
  ListOrdered,
  Outdent,
  Palette,
  Strikethrough,
  Subscript,
  Superscript,
  Underline,
} from "lucide-react";
import { FONT_SIZES, sanitizeHtml, toHtml } from "@/lib/rich-text";
import { cn } from "@/lib/utils";

/**
 * Rich-text editor
 *
 * Important:
 * - Formatting is stored as HTML.
 * - Selection is explicitly saved before toolbar interaction.
 * - Selection is restored before formatting commands.
 * - Content is pushed to onChange immediately after formatting/editing.
 * - HTML is normalized and sanitized before being saved.
 *
 * This prevents formatting from disappearing after:
 *   Bold → Save → F5
 *   Italic → Save → F5
 *   Center → Save → F5
 *   Font size → Save → F5
 */

/* -------------------------------------------------------------------------- */
/* Selection helpers                                                          */
/* -------------------------------------------------------------------------- */

function isNodeInside(root: HTMLElement, node: Node | null): boolean {
  if (!node) return false;
  return node === root || root.contains(node);
}

function saveSelection(root: HTMLElement): Range | null {
  const selection = window.getSelection();

  if (!selection || selection.rangeCount === 0) {
    return null;
  }

  const range = selection.getRangeAt(0);

  if (!isNodeInside(root, range.startContainer) || !isNodeInside(root, range.endContainer)) {
    return null;
  }

  return range.cloneRange();
}

function restoreSelection(root: HTMLElement, range: Range | null) {
  if (!range) return;

  if (!isNodeInside(root, range.startContainer) || !isNodeInside(root, range.endContainer)) {
    return;
  }

  const selection = window.getSelection();

  if (!selection) return;

  selection.removeAllRanges();
  selection.addRange(range);
}

/* -------------------------------------------------------------------------- */
/* Formatting commands                                                        */
/* -------------------------------------------------------------------------- */

function runCommand(root: HTMLElement, command: string, value?: string, savedRange?: Range | null) {
  root.focus();

  restoreSelection(root, savedRange ?? null);

  try {
    document.execCommand("styleWithCSS", false, "true");
  } catch {
    // Some browsers may not support styleWithCSS.
  }

  document.execCommand(command, false, value);

  /**
   * Tell React/contentEditable that the DOM changed.
   */
  root.dispatchEvent(
    new InputEvent("input", {
      bubbles: true,
      inputType: "formatBlock",
    }),
  );
}

/**
 * execCommand only supports font sizes 1–7.
 * We use size 7 as a temporary marker and replace it with
 * an explicit CSS font-size.
 */
function applyFontSize(px: string, root: HTMLElement, savedRange?: Range | null) {
  root.focus();

  restoreSelection(root, savedRange ?? null);

  try {
    document.execCommand("styleWithCSS", false, "true");
  } catch {
    // Ignore unsupported browser behavior.
  }

  document.execCommand("fontSize", false, "7");

  root.querySelectorAll('font[size="7"]').forEach((node) => {
    const span = document.createElement("span");

    span.style.fontSize = `${px}px`;
    span.innerHTML = node.innerHTML;

    node.replaceWith(span);
  });

  root.dispatchEvent(
    new InputEvent("input", {
      bubbles: true,
      inputType: "formatFontSize",
    }),
  );
}

/**
 * Increase/decrease current font size.
 */
function applyFontStep(root: HTMLElement, delta: number, savedRange?: Range | null) {
  root.focus();

  restoreSelection(root, savedRange ?? null);

  const selection = window.getSelection();

  if (!selection || selection.rangeCount === 0) {
    return;
  }

  const node = selection.anchorNode;

  const element = node?.nodeType === Node.TEXT_NODE ? node.parentElement : (node as HTMLElement | null);

  const target = element && root.contains(element) ? element : root;

  const current = parseFloat(window.getComputedStyle(target).fontSize) || 16;

  const next = Math.min(120, Math.max(6, Math.round(current + delta)));

  applyFontSize(String(next), root, selection.getRangeAt(0));
}

/* -------------------------------------------------------------------------- */
/* Toolbar configuration                                                      */
/* -------------------------------------------------------------------------- */

const HEADINGS: { label: string; block: string }[] = [
  { label: "Body text", block: "p" },
  { label: "Heading 1", block: "h1" },
  { label: "Heading 2", block: "h2" },
  { label: "Heading 3", block: "h3" },
  { label: "Heading 4", block: "h4" },
];

const TEXT_COLORS = ["#0f172a", "#17607F", "#6FC08C", "#b91c1c", "#a16207", "#64748b"];

const HIGHLIGHTS = ["transparent", "#FEF3C7", "#DCFCE7", "#DBEAFE", "#FEE2E2"];

/* -------------------------------------------------------------------------- */
/* Toolbar button                                                             */
/* -------------------------------------------------------------------------- */

function Btn({
  onMouseDown,
  onClick,
  title,
  children,
  active,
}: {
  onMouseDown?: () => void;
  onClick: () => void;
  title: string;
  children: ReactNode;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onMouseDown={(event) => {
        /**
         * Prevent browser from collapsing the text selection.
         */
        event.preventDefault();

        onMouseDown?.();
      }}
      onClick={onClick}
      className={cn(
        "inline-flex h-7 w-7 items-center justify-center rounded-md text-foreground/80 hover:bg-muted",
        active && "bg-primary/10 text-primary",
      )}
    >
      {children}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Rich toolbar                                                               */
/* -------------------------------------------------------------------------- */

export function RichToolbar({ getRoot, compact = false }: { getRoot: () => HTMLElement | null; compact?: boolean }) {
  const savedSelectionRef = useRef<Range | null>(null);

  const root = () => getRoot();

  const rememberSelection = useCallback(() => {
    const el = root();

    if (!el) return;

    const range = saveSelection(el);

    if (range) {
      savedSelectionRef.current = range;
    }
  }, [getRoot]);

  const command = useCallback(
    (name: string, value?: string) => {
      const el = root();

      if (!el) return;

      runCommand(el, name, value, savedSelectionRef.current);
    },
    [getRoot],
  );

  return (
    <div
      className="flex flex-nowrap items-center gap-0.5 rounded-xl border border-border bg-card/95 p-1 shadow-lg backdrop-blur"
      onMouseDown={(event) => {
        /**
         * Save the selection BEFORE the toolbar steals focus.
         */
        rememberSelection();

        /**
         * Never allow toolbar interaction to collapse
         * the editor selection.
         */
        event.preventDefault();
      }}
    >
      <Btn title="Bold" onMouseDown={rememberSelection} onClick={() => command("bold")}>
        <Bold size={14} />
      </Btn>

      <Btn title="Italic" onMouseDown={rememberSelection} onClick={() => command("italic")}>
        <Italic size={14} />
      </Btn>

      <Btn title="Underline" onMouseDown={rememberSelection} onClick={() => command("underline")}>
        <Underline size={14} />
      </Btn>

      <Btn title="Strikethrough" onMouseDown={rememberSelection} onClick={() => command("strikeThrough")}>
        <Strikethrough size={14} />
      </Btn>

      <span className="mx-1 h-5 w-px bg-border" />

      {/* ------------------------------------------------------------------ */}
      {/* Font size                                                           */}
      {/* ------------------------------------------------------------------ */}

      <select
        title="Font size"
        defaultValue=""
        onMouseDown={() => {
          rememberSelection();
        }}
        onChange={(event) => {
          const el = root();
          const value = event.target.value;

          event.currentTarget.value = "";

          if (!el || !value) return;

          if (value === "custom") {
            const px = window.prompt("Font size in px (6–120)", "18");

            const number = Number(px);

            if (!number || number < 6 || number > 120) {
              return;
            }

            applyFontSize(String(number), el, savedSelectionRef.current);

            return;
          }

          applyFontSize(value, el, savedSelectionRef.current);
        }}
        className="h-7 rounded-md border border-border bg-background px-1 text-xs"
      >
        <option value="">Size</option>

        {FONT_SIZES.map((size) => (
          <option key={size} value={size}>
            {size}
          </option>
        ))}

        <option value="custom">Custom…</option>
      </select>

      <Btn
        title="Decrease font size"
        onMouseDown={rememberSelection}
        onClick={() => {
          const el = root();

          if (!el) return;

          applyFontStep(el, -2, savedSelectionRef.current);
        }}
      >
        <span className="text-[11px] font-semibold">A-</span>
      </Btn>

      <Btn
        title="Increase font size"
        onMouseDown={rememberSelection}
        onClick={() => {
          const el = root();

          if (!el) return;

          applyFontStep(el, 2, savedSelectionRef.current);
        }}
      >
        <span className="text-[13px] font-semibold">A+</span>
      </Btn>

      {/* ------------------------------------------------------------------ */}
      {/* Text style                                                          */}
      {/* ------------------------------------------------------------------ */}

      {!compact && (
        <select
          title="Text style"
          defaultValue=""
          onMouseDown={() => {
            rememberSelection();
          }}
          onChange={(event) => {
            const value = event.target.value;

            event.currentTarget.value = "";

            if (!value) return;

            command("formatBlock", `<${value}>`);
          }}
          className="h-7 rounded-md border border-border bg-background px-1 text-xs"
        >
          <option value="">Style</option>

          {HEADINGS.map((heading) => (
            <option key={heading.block} value={heading.block}>
              {heading.label}
            </option>
          ))}
        </select>
      )}

      <span className="mx-1 h-5 w-px bg-border" />

      {/* ------------------------------------------------------------------ */}
      {/* Text colour                                                         */}
      {/* ------------------------------------------------------------------ */}

      <span className="flex items-center gap-0.5" title="Text colour">
        {TEXT_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            title={`Text colour ${color}`}
            aria-label={`Text colour ${color}`}
            onMouseDown={() => {
              rememberSelection();
            }}
            onClick={() => {
              command("foreColor", color);
            }}
            className="h-4 w-4 rounded-full border border-border"
            style={{ backgroundColor: color }}
          />
        ))}

        <label
          title="Custom text colour"
          className="inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-md hover:bg-muted"
          onMouseDown={() => {
            rememberSelection();
          }}
        >
          <Palette size={14} />

          <input
            type="color"
            className="sr-only"
            onChange={(event) => {
              command("foreColor", event.target.value);
            }}
          />
        </label>
      </span>

      <span className="mx-1 h-5 w-px bg-border" />

      {/* ------------------------------------------------------------------ */}
      {/* Highlight                                                           */}
      {/* ------------------------------------------------------------------ */}

      <span className="flex items-center gap-0.5" title="Highlight">
        {HIGHLIGHTS.map((color) => (
          <button
            key={color}
            type="button"
            title={color === "transparent" ? "No highlight" : `Highlight ${color}`}
            aria-label={color === "transparent" ? "No highlight" : `Highlight ${color}`}
            onMouseDown={() => {
              rememberSelection();
            }}
            onClick={() => {
              command("hiliteColor", color);
            }}
            className="h-4 w-4 rounded-sm border border-border"
            style={{
              backgroundColor: color === "transparent" ? "var(--background)" : color,
            }}
          />
        ))}

        <label
          title="Custom highlight"
          className="inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-md hover:bg-muted"
          onMouseDown={() => {
            rememberSelection();
          }}
        >
          <Highlighter size={14} />

          <input
            type="color"
            className="sr-only"
            onChange={(event) => {
              command("hiliteColor", event.target.value);
            }}
          />
        </label>
      </span>

      <span className="mx-1 h-5 w-px bg-border" />

      {/* ------------------------------------------------------------------ */}
      {/* Alignment                                                           */}
      {/* ------------------------------------------------------------------ */}

      <Btn title="Align left" onMouseDown={rememberSelection} onClick={() => command("justifyLeft")}>
        <AlignLeft size={14} />
      </Btn>

      <Btn title="Align center" onMouseDown={rememberSelection} onClick={() => command("justifyCenter")}>
        <AlignCenter size={14} />
      </Btn>

      <Btn title="Align right" onMouseDown={rememberSelection} onClick={() => command("justifyRight")}>
        <AlignRight size={14} />
      </Btn>

      <Btn title="Justify" onMouseDown={rememberSelection} onClick={() => command("justifyFull")}>
        <AlignJustify size={14} />
      </Btn>

      <span className="mx-1 h-5 w-px bg-border" />

      {/* ------------------------------------------------------------------ */}
      {/* Lists                                                               */}
      {/* ------------------------------------------------------------------ */}

      <Btn title="Bullet list" onMouseDown={rememberSelection} onClick={() => command("insertUnorderedList")}>
        <List size={14} />
      </Btn>

      <Btn title="Numbered list" onMouseDown={rememberSelection} onClick={() => command("insertOrderedList")}>
        <ListOrdered size={14} />
      </Btn>

      <Btn title="Decrease indent" onMouseDown={rememberSelection} onClick={() => command("outdent")}>
        <Outdent size={14} />
      </Btn>

      <Btn title="Increase indent" onMouseDown={rememberSelection} onClick={() => command("indent")}>
        <Indent size={14} />
      </Btn>

      <span className="mx-1 h-5 w-px bg-border" />

      {/* ------------------------------------------------------------------ */}
      {/* Superscript / subscript                                             */}
      {/* ------------------------------------------------------------------ */}

      <Btn title="Superscript" onMouseDown={rememberSelection} onClick={() => command("superscript")}>
        <Superscript size={14} />
      </Btn>

      <Btn title="Subscript" onMouseDown={rememberSelection} onClick={() => command("subscript")}>
        <Subscript size={14} />
      </Btn>

      {/* ------------------------------------------------------------------ */}
      {/* Link                                                                */}
      {/* ------------------------------------------------------------------ */}

      <Btn
        title="Link"
        onMouseDown={rememberSelection}
        onClick={() => {
          const url = window.prompt("Link URL (https://, mailto: or tel:)");

          if (!url) return;

          command("createLink", url);
        }}
      >
        <Link2 size={14} />
      </Btn>

      {/* ------------------------------------------------------------------ */}
      {/* Remove formatting                                                   */}
      {/* ------------------------------------------------------------------ */}

      <Btn
        title="Remove formatting"
        onMouseDown={rememberSelection}
        onClick={() => {
          command("removeFormat");
          command("unlink");
        }}
      >
        <Eraser size={14} />
      </Btn>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Editable field                                                             */
/* -------------------------------------------------------------------------- */

export function RichEditable({
  value,
  onChange,
  className = "",
  as: As = "div",
  placeholder,
  toolbar = true,
  inline = false,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  as?: ElementType;
  placeholder?: string;
  toolbar?: boolean;
  inline?: boolean;
}) {
  const ref = useRef<HTMLElement | null>(null);

  /**
   * Keep the latest value available without relying on React
   * finishing a render before Save/Publish is clicked.
   */
  const latestValueRef = useRef(value ?? "");

  /**
   * Keep the latest selection inside the editor.
   */
  const selectionRef = useRef<Range | null>(null);

  const [focused, setFocused] = useState(false);

  useEffect(() => {
    latestValueRef.current = value ?? "";
  }, [value]);

  /**
   * Save the current browser selection.
   */
  const rememberCurrentSelection = useCallback(() => {
    const el = ref.current;

    if (!el) return;

    const range = saveSelection(el);

    if (range) {
      selectionRef.current = range;
    }
  }, []);

  /**
   * Normalize current editor HTML.
   */
  const normalizeCurrentHtml = useCallback((html: string) => {
    const normalized = toHtml(html);
    return sanitizeHtml(normalized);
  }, []);

  /**
   * Push editor changes to React immediately.
   *
   * This is the important part:
   *
   * OLD:
   *     content changed
   *          ↓
   *     wait for blur
   *          ↓
   *     save
   *
   * NEW:
   *     content changed
   *          ↓
   *     normalize
   *          ↓
   *     onChange immediately
   */
  const commitHtml = useCallback(
    (html: string) => {
      const clean = normalizeCurrentHtml(html);

      latestValueRef.current = clean;

      onChange(clean);

      return clean;
    },
    [normalizeCurrentHtml, onChange],
  );

  /**
   * Put external value into the editor only when the editor
   * is not actively being edited.
   */
  useEffect(() => {
    const el = ref.current;

    if (!el || focused) {
      return;
    }

    const normalized = toHtml(value ?? "");

    if (el.innerHTML !== normalized) {
      el.innerHTML = normalized;
    }

    latestValueRef.current = normalized;
  }, [value, focused]);

  /**
   * Repair old/encoded HTML before editing starts.
   */
  const normalizeEditor = useCallback(() => {
    const el = ref.current;

    if (!el) return;

    const normalized = normalizeCurrentHtml(el.innerHTML);

    if (el.innerHTML !== normalized) {
      el.innerHTML = normalized;
    }

    latestValueRef.current = normalized;
  }, [normalizeCurrentHtml]);

  /**
   * Capture selection whenever the user changes it.
   *
   * This protects against:
   *
   * select text → click toolbar → selection disappears.
   */
  useEffect(() => {
    if (!focused) return;

    const handleSelectionChange = () => {
      const el = ref.current;

      if (!el) return;

      const range = saveSelection(el);

      if (range) {
        selectionRef.current = range;
      }
    };

    document.addEventListener("selectionchange", handleSelectionChange);

    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
    };
  }, [focused]);

  return (
    <span className={cn("relative", inline ? "inline align-baseline" : "inline-block w-full align-top")}>
      {toolbar && focused && (
        <span className="sticky top-2 left-0 z-50 mb-2 block w-max max-w-[92vw] whitespace-nowrap print:hidden">
          <RichToolbar getRoot={() => ref.current} />
        </span>
      )}

      <As
        ref={ref as never}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onFocus={() => {
          normalizeEditor();

          setFocused(true);

          /**
           * Wait one frame so the browser has restored
           * the actual caret/selection.
           */
          requestAnimationFrame(() => {
            rememberCurrentSelection();
          });
        }}
        onPointerDown={() => {
          setFocused(true);
        }}
        onClick={() => {
          setFocused(true);

          requestAnimationFrame(() => {
            rememberCurrentSelection();
          });
        }}
        onKeyUp={() => {
          rememberCurrentSelection();
        }}
        onMouseUp={() => {
          rememberCurrentSelection();
        }}
        onInput={(event: React.FormEvent<HTMLElement>) => {
          /**
           * Every typing/formatting operation is saved immediately.
           */
          const html = event.currentTarget.innerHTML;

          commitHtml(html);

          requestAnimationFrame(() => {
            rememberCurrentSelection();
          });
        }}
        onKeyDown={(event: KeyboardEvent<HTMLElement>) => {
          if (inline && event.key === "Enter") {
            event.preventDefault();
            return;
          }

          /**
           * Save selection before keyboard formatting shortcuts.
           */
          if ((event.ctrlKey || event.metaKey) && ["b", "i", "u"].includes(event.key.toLowerCase())) {
            rememberCurrentSelection();
          }
        }}
        onBlur={(event: FocusEvent<HTMLElement>) => {
          /**
           * Normalize one final time when leaving the editor.
           */
          const clean = commitHtml(event.currentTarget.innerHTML);

          event.currentTarget.innerHTML = clean;

          setFocused(false);
        }}
        className={cn(
          "rich-text outline-none rounded px-1 -mx-1 focus:bg-primary/10 hover:bg-muted transition-colors",
          className,
        )}
      />
    </span>
  );
}
