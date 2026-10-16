export type InlinePart =
  | { kind: "text"; text: string }
  | { kind: "bold"; text: string }
  | { kind: "link"; text: string; href: string };

/** Parses the tiny inline markup used by legal content: **bold** and [label](href). */
export function parseInline(input: string): InlinePart[] {
  const parts: InlinePart[] = [];
  const re = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)]+)\)/g;
  let last = 0;
  for (const m of input.matchAll(re)) {
    if (m.index! > last) parts.push({ kind: "text", text: input.slice(last, m.index) });
    if (m[1] !== undefined) parts.push({ kind: "bold", text: m[1] });
    else parts.push({ kind: "link", text: m[2], href: m[3] });
    last = m.index! + m[0].length;
  }
  if (last < input.length) parts.push({ kind: "text", text: input.slice(last) });
  return parts;
}

export function inlineToPlainText(input: string): string {
  return parseInline(input)
    .map((p) => p.text)
    .join("");
}
