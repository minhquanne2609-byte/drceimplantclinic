import { useEffect, useState } from "react";
import { openMediaFile } from "@/lib/clinic-media";

/**
 * Renders every page of a PDF as a plain image so patients always see pictures,
 * never an embedded PDF viewer (and printing keeps working).
 */
export function PdfPages({ url, alt, className }: { url: string; alt: string; className?: string }) {
  const [pages, setPages] = useState<string[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
        const doc = await pdfjs.getDocument({ url }).promise;
        const out: string[] = [];
        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i);
          const viewport = page.getViewport({ scale: 2 });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext("2d");
          if (!ctx) continue;
          await page.render({ canvas, canvasContext: ctx, viewport } as never).promise;
          out.push(canvas.toDataURL("image/jpeg", 0.92));
        }
        if (!cancelled) setPages(out);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (failed)
    return (
<button
  type="button"
  onClick={() => void openMediaFile(url, `${alt}.pdf`)}
  className="no-print text-sm font-semibold text-primary underline"
>
  Open {alt} (PDF)
</button>
    );

  if (!pages.length)
    return <div className="h-40 w-full animate-pulse rounded-xl border border-border bg-muted/40 no-print" />;

  return (
    <>
      {pages.map((src, i) => (
        <img key={i} src={src} alt={`${alt} — page ${i + 1}`} className={className} />
      ))}
    </>
  );
}
