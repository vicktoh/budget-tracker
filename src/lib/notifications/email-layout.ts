/**
 * Email-safe HTML building blocks shared by every notification template.
 * Email clients ignore stylesheets and most layout CSS, so everything is
 * table-based with inline styles. Values passed as `text` are escaped; values
 * passed as `html` must already be safe markup built from these helpers.
 */

export const EMAIL_FONT = "-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
export const GREEN = "#166534";
export const INK = "#1a1a1a";
export const MUTED = "#5b5b5b";
export const LINE = "#e5e7eb";
export const SOFT = "#f6f7f6";
export const RED = "#b91c1c";
export const AMBER = "#b45309";
export const OK = "#15803d";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const e = escapeHtml;

export function emailShell({
  body,
  preheader,
  width = 560,
}: {
  body: string;
  preheader: string;
  width?: number;
}): string {
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#eef0ee;">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;">${e(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef0ee;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:${width}px;background:#ffffff;border-radius:10px;border:1px solid ${LINE};">
<tr><td style="padding:18px 28px;border-bottom:1px solid ${LINE};font-family:${EMAIL_FONT};">
<span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${GREEN};vertical-align:middle;"></span>
<span style="font-size:13px;font-weight:600;color:${INK};vertical-align:middle;margin-left:6px;">Kano Health Finance Tracker</span>
</td></tr>
<tr><td style="padding:28px;font-family:${EMAIL_FONT};color:${INK};">
${body}
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

export function heading(text: string): string {
  return `<h1 style="font-size:20px;line-height:1.3;margin:0 0 12px;color:${INK};">${e(text)}</h1>`;
}

export function eyebrow(text: string): string {
  return `<div style="font-size:12px;color:${MUTED};margin:0 0 6px;">${e(text)}</div>`;
}

export function paragraph(
  html: string,
  { size = 14, color = MUTED, marginBottom = 16 }: { size?: number; color?: string; marginBottom?: number } = {},
): string {
  return `<p style="font-size:${size}px;line-height:1.6;margin:0 0 ${marginBottom}px;color:${color};">${html}</p>`;
}

export function strong(text: string): string {
  return `<strong>${e(text)}</strong>`;
}

export function link(text: string, href: string, { bold = false }: { bold?: boolean } = {}): string {
  return `<a href="${e(href)}" style="color:${GREEN};${bold ? "font-weight:600;" : ""}">${e(text)}</a>`;
}

export function button(label: string, href: string, { primary = true }: { primary?: boolean } = {}): string {
  const style = primary
    ? `background:${GREEN};color:#ffffff;border:1px solid ${GREEN};`
    : `background:#ffffff;color:${GREEN};border:1px solid ${GREEN};`;
  return `<a href="${e(href)}" style="display:inline-block;${style}text-decoration:none;font-size:14px;font-weight:600;padding:11px 18px;border-radius:6px;margin:0 8px 8px 0;">${e(label)}</a>`;
}

export type CalloutTone = "amber" | "red" | "grey";

export function callout(html: string, tone: CalloutTone = "amber"): string {
  const [bg, border, fg] = {
    amber: ["#fffbeb", "#f5d48a", "#7a4a00"],
    red: ["#fef2f2", "#f3b4b4", "#8a1c1c"],
    grey: [SOFT, LINE, MUTED],
  }[tone];
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;"><tr><td style="background:${bg};border:1px solid ${border};border-radius:6px;padding:12px 14px;font-size:13px;line-height:1.55;color:${fg};">${html}</td></tr></table>`;
}

/** Label/value rows. Values are HTML. */
export function keyValueTable(rows: Array<[label: string, valueHtml: string]>): string {
  const body = rows
    .map(([label, value], index) => {
      const border = index ? `border-top:1px solid ${LINE};` : "";
      return `<tr><td style="${border}padding:9px 12px;color:${MUTED};width:38%;">${e(label)}</td><td style="${border}padding:9px 12px;color:${INK};">${value}</td></tr>`;
    })
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${LINE};border-radius:6px;margin:0 0 20px;font-size:13px;">${body}</table>`;
}

export function quote({
  author,
  meta,
  text,
  highlight = true,
}: {
  author: string;
  meta: string;
  text: string;
  highlight?: boolean;
}): string {
  const bar = highlight ? GREEN : "#c7cbc7";
  const bg = highlight ? SOFT : "#ffffff";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 12px;"><tr><td style="border-left:3px solid ${bar};background:${bg};padding:12px 14px;border-radius:0 6px 6px 0;"><div style="font-size:12px;color:${MUTED};margin:0 0 6px;"><strong style="color:${INK};">${e(author)}</strong> · ${e(meta)}</div><div style="font-size:14px;line-height:1.55;color:${INK};white-space:pre-line;">${e(text)}</div></td></tr></table>`;
}

export function footer(html: string): string {
  return `<hr style="border:none;border-top:1px solid ${LINE};margin:24px 0 16px;"><p style="font-size:12px;line-height:1.6;color:#7a7a7a;margin:0;">${html}</p>`;
}

export function sectionTitle(text: string): string {
  return `<h2 style="font-size:13px;text-transform:uppercase;letter-spacing:.06em;color:${GREEN};margin:28px 0 12px;">${e(text)}</h2>`;
}

export const TH_STYLE = `padding:9px 12px;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:${MUTED};background:${SOFT};text-align:left;`;

/** A bordered data table. `head` cells and row cells are HTML. */
export function dataTable({
  head,
  rows,
  align = [],
}: {
  head: string[];
  rows: string[][];
  align?: Array<"left" | "right" | "center" | undefined>;
}): string {
  const headHtml = head
    .map((cell, i) => `<td style="${TH_STYLE}text-align:${align[i] ?? "left"};">${cell}</td>`)
    .join("");
  const bodyHtml = rows
    .map((row, r) => {
      const border = r ? `border-top:1px solid ${LINE};` : `border-top:1px solid ${LINE};`;
      return `<tr>${row
        .map((cell, i) => `<td align="${align[i] ?? "left"}" style="${border}padding:10px 12px;vertical-align:top;">${cell}</td>`)
        .join("")}</tr>`;
    })
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${LINE};border-radius:6px;font-size:13px;margin:0 0 12px;"><tr>${headHtml}</tr>${bodyHtml}</table>`;
}

export function coloured(text: string, color: string, { bold = true }: { bold?: boolean } = {}): string {
  return `<span style="color:${color};${bold ? "font-weight:600;" : ""}">${e(text)}</span>`;
}

export function muted(text: string): string {
  return `<span style="color:#8a8a8a;">${e(text)}</span>`;
}

export function progressBar(fraction: number, color: string = GREEN): string {
  const width = Math.max(1, Math.min(100, Math.round(fraction * 100)));
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eceeec;border-radius:3px;"><tr><td width="${width}%" style="background:${color};height:6px;border-radius:3px;font-size:0;line-height:0;">&nbsp;</td><td style="font-size:0;line-height:0;">&nbsp;</td></tr></table>`;
}

export function statTiles(tiles: Array<{ label: string; value: string; sub: string }>): string {
  const width = Math.floor(100 / Math.max(1, tiles.length));
  const cells = tiles
    .map(
      (tile) =>
        `<td width="${width}%" valign="top" style="padding:4px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="border:1px solid ${LINE};border-radius:6px;padding:12px;"><div style="font-size:11px;color:${MUTED};text-transform:uppercase;letter-spacing:.04em;">${e(tile.label)}</div><div style="font-size:19px;font-weight:700;color:${INK};margin:4px 0 2px;">${e(tile.value)}</div><div style="font-size:12px;color:${MUTED};">${e(tile.sub)}</div></td></tr></table></td>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:12px 0 0;"><tr>${cells}</tr></table>`;
}

export function bulletList(itemsHtml: string[]): string {
  return `<ul style="margin:8px 0 0;padding-left:18px;font-size:13px;line-height:1.6;color:${INK};">${itemsHtml
    .map((item) => `<li style="margin:0 0 4px;">${item}</li>`)
    .join("")}</ul>`;
}

/** Plain-text alternative for the multipart email, derived from the HTML. */
export function htmlToText(html: string): string {
  return html
    .replace(/<span style="display:none[^>]*>[\s\S]*?<\/span>/, "")
    .replace(/<a ([^>]*)href="([^"]+)"([^>]*)>([\s\S]*?)<\/a>/g, (_m, before: string, href: string, after: string, label: string) => {
      const text = label.replace(/<[^>]+>/g, "").trim();
      const rendered = text && text !== href ? `${text} (${href})` : href;
      // Buttons sit on their own line.
      return /inline-block/.test(before + after) ? `\n${rendered}\n` : rendered;
    })
    .replace(/<(h1|h2|table|ul|p)[\s>]/gi, "\n$&")
    .replace(/<(br|\/p|\/h1|\/h2|\/tr|\/li|\/div|hr)[^>]*>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<\/td>/gi, "  ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export type RenderedEmail = { subject: string; html: string; text: string };
