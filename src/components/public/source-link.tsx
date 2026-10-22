import { FileTextIcon } from "lucide-react";
import { sourceHref, sourceLabel, type Source } from "@/lib/public/model";

/** "Source: 2026 Q2 BIR, Table 4, p. 18" — opens the mirrored PDF at that page. */
export function SourceLink({ source, prefix = "Source" }: { source: Source; prefix?: string }) {
  const href = sourceHref(source);
  const label = sourceLabel(source);
  if (!href) return <span>{prefix}: {label}</span>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      className="inline-flex items-center gap-1 text-[var(--pub-muted)] underline decoration-[var(--pub-line)] underline-offset-2 hover:text-[var(--pub-brand-deep)] hover:decoration-[var(--pub-brand)]"
    >
      <FileTextIcon className="size-3.5" aria-hidden />
      {prefix}: {label}
    </a>
  );
}
