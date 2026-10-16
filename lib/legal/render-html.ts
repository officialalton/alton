import { parseInline } from "./inline";
import type { LegalBlock, LegalDocumentData } from "./types";

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function inlineHtml(text: string): string {
  return parseInline(text)
    .map((p) => {
      if (p.kind === "bold") return `<strong>${escapeHtml(p.text)}</strong>`;
      if (p.kind === "link") return `<a href="${escapeHtml(p.href)}">${escapeHtml(p.text)}</a>`;
      return escapeHtml(p.text);
    })
    .join("");
}

/** A paragraph that is entirely bold (e.g. the refund formula) renders as a highlighted formula line. */
function isFormula(text: string): boolean {
  return /^\*\*[^*]+\*\*$/.test(text);
}

export type BulletRewrite = (item: string) => string[] | null;

export type ParagraphRewrite = (text: string) => string[] | null;

export function blocksHtml(blocks: readonly LegalBlock[], rewriteBullet?: BulletRewrite, rewriteParagraph?: ParagraphRewrite): string {
  return blocks
    .map((b) => {
      if (b.t === "h3") return `<h3>${escapeHtml(b.text)}</h3>`;
      if (b.t === "ul") {
        const items = b.items.flatMap((item) => rewriteBullet?.(item) ?? [escapeHtml(item)]);
        return `<ul>${items.map((i) => `<li>${i}</li>`).join("")}</ul>`;
      }
      const replaced = rewriteParagraph?.(b.text);
      if (replaced) return replaced.map((html) => `<p>${html}</p>`).join("\n");
      return isFormula(b.text) ? `<p class="formula">${inlineHtml(b.text)}</p>` : `<p>${inlineHtml(b.text)}</p>`;
    })
    .join("\n");
}

export function documentBodyHtml(doc: LegalDocumentData, opts?: { rewriteBullet?: BulletRewrite; rewriteParagraph?: ParagraphRewrite }): string {
  return doc.sections
    .map((s) => `${s.heading ? `<h2>${escapeHtml(s.heading)}</h2>` : ""}\n${blocksHtml(s.blocks, opts?.rewriteBullet, opts?.rewriteParagraph)}`)
    .join("\n");
}

export const CONTRACT_STYLES = `
    body { font-family: Arial, Helvetica, sans-serif; line-height: 1.6; color: #111; margin: 36px; font-size: 12px; }
    h1 { font-size: 22px; margin: 0 0 6px; }
    h2 { font-size: 15px; margin: 22px 0 8px; page-break-after: avoid; }
    h3 { font-size: 13px; margin: 14px 0 6px; }
    p { margin: 6px 0; }
    ul { margin: 6px 0 8px 22px; padding: 0; }
    li { margin: 4px 0; }
    .meta { color: #444; margin-bottom: 14px; }
    .formula { padding: 8px; background: #f5f5f5; font-weight: 700; }
    .signature { margin-top: 36px; page-break-inside: avoid; }`;
