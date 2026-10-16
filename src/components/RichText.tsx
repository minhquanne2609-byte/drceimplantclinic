import { toHtml } from "@/lib/rich-text";
import { cn } from "@/lib/utils";

/**
 * Renders owner-authored copy. Formatting comes from the content, layout and
 * typography come from the design system (see `.rich-text` in styles.css).
 */
export function RichText({
  value,
  className,
  as: As = "div",
}: {
  value: string;
  className?: string;
  as?: React.ElementType;
}) {
  return (
    <As
      className={cn("rich-text", className)}
      dangerouslySetInnerHTML={{ __html: toHtml(value) }}
    />
  );
}
