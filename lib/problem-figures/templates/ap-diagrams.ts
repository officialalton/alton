// AP Biology 분자 도식 3종 — 후보가 실제로 쓰는 것만(DNA 프로브 정렬, 복제 기포, 리보솜 A/P/E 자리). 엄격한 스펙으로 받아 직접 그린다.
import { esc, f, FONT, labelWidth, type FigureIssue } from "./_layout";

export type StrandPairSpec = {
  type: "ap_diagram"; variant: "strand_pair"; title?: string;
  top: { label: string; leftEnd: string; rightEnd: string; bases: string[] };
  bottom: { label: string; leftEnd: string; rightEnd: string; bases: string[] };
  legend?: string;
};
export type ReplicationBubbleSpec = {
  type: "ap_diagram"; variant: "replication_bubble"; title?: string;
  topEnds: [string, string]; bottomEnds: [string, string];
  /** 새 가닥: 위/아래 템플릿 옆 + 원점 기준 왼/오른쪽. */
  newStrands: { id: string; side: "top" | "bottom"; region: "left" | "right" }[];
  forks: { id: string; side: "left" | "right" }[];
  originLabel: string;
  legend?: string;
};
export type RibosomeSpec = {
  type: "ap_diagram"; variant: "ribosome"; title?: string;
  codons: string[]; leftEnd: string; rightEnd: string;
  sites: { site: "E" | "P" | "A"; codonIndex: number; trna?: string }[];
  codonTable?: Record<string, string>;
};
export type ApDiagramSpec = StrandPairSpec | ReplicationBubbleSpec | RibosomeSpec;

const W = 520;
const strOk = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;

export function validateApDiagram(s: Record<string, unknown>): { ok: true; spec: ApDiagramSpec } | { ok: false; error: string } {
  if (s.type !== "ap_diagram") return { ok: false, error: "type 이 ap_diagram 이 아닙니다." };
  if (s.variant === "strand_pair") {
    for (const k of ["top", "bottom"]) {
      const t = s[k] as Record<string, unknown> | undefined;
      if (!t || !strOk(t.label) || !strOk(t.leftEnd) || !strOk(t.rightEnd) || !Array.isArray(t.bases) || t.bases.length < 2 || t.bases.length > 16 || !t.bases.every(strOk)) return { ok: false, error: `strand_pair.${k} 는 label/leftEnd/rightEnd/bases(2~16)가 필요합니다.` };
    }
    if ((s.top as { bases: unknown[] }).bases.length !== (s.bottom as { bases: unknown[] }).bases.length) return { ok: false, error: "strand_pair 두 가닥의 염기 수가 같아야 합니다." };
    return { ok: true, spec: s as unknown as StrandPairSpec };
  }
  if (s.variant === "replication_bubble") {
    if (!Array.isArray(s.topEnds) || !Array.isArray(s.bottomEnds) || !Array.isArray(s.newStrands) || !Array.isArray(s.forks) || !strOk(s.originLabel)) return { ok: false, error: "replication_bubble 는 topEnds/bottomEnds/newStrands/forks/originLabel 이 필요합니다." };
    return { ok: true, spec: s as unknown as ReplicationBubbleSpec };
  }
  if (s.variant === "ribosome") {
    if (!Array.isArray(s.codons) || s.codons.length < 2 || !s.codons.every(strOk) || !strOk(s.leftEnd) || !strOk(s.rightEnd) || !Array.isArray(s.sites)) return { ok: false, error: "ribosome 은 codons/leftEnd/rightEnd/sites 가 필요합니다." };
    return { ok: true, spec: s as unknown as RibosomeSpec };
  }
  return { ok: false, error: `알 수 없는 ap_diagram variant: ${String(s.variant)}` };
}

const T = (x: number, y: number, t: string, o: { anchor?: string; size?: number; bold?: boolean; fill?: string } = {}) =>
  `<text x="${f(x)}" y="${f(y)}" text-anchor="${o.anchor ?? "middle"}" font-size="${o.size ?? 13}" fill="${o.fill ?? "#111"}"${o.bold ? ' font-weight="bold"' : ""}>${esc(t)}</text>`;

export function renderApDiagram(spec: ApDiagramSpec): { svg: string; alt: string; issues: FigureIssue[] } {
  const issues: FigureIssue[] = [];
  const o: string[] = [];
  let H = 200; let alt = "";
  const head = (h: number) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${h}" width="${W}" height="${h}" role="img" font-family="${FONT}">`;
  if (spec.variant === "strand_pair") {
    H = 210;
    const n = spec.top.bases.length, x0 = 90, x1 = W - 90, step = (x1 - x0) / (n - 1 || 1);
    if (spec.title) o.push(T(W / 2, 16, spec.title, { bold: true }));
    const row = (s: StrandPairSpec["top"], y: number) => {
      o.push(T(8, y - 22, s.label, { anchor: "start", size: 12 }));
      o.push(T(x0 - 38, y + 5, `${s.leftEnd}`, { size: 13, bold: true }), T(x1 + 38, y + 5, `${s.rightEnd}`, { size: 13, bold: true }));
      o.push(`<line x1="${x0 - 26}" y1="${y}" x2="${x1 + 26}" y2="${y}" stroke="#9ca3af" stroke-width="1.2"/>`);
      s.bases.forEach((b, i) => o.push(`<rect x="${f(x0 + step * i - 11)}" y="${y - 13}" width="22" height="26" rx="4" fill="#fff" stroke="#111" stroke-width="1.4"/>`, T(x0 + step * i, y + 6, b, { bold: true })));
    };
    row(spec.top, 70); row(spec.bottom, 150);
    for (let i = 0; i < n; i++) o.push(`<line x1="${f(x0 + step * i)}" y1="86" x2="${f(x0 + step * i)}" y2="136" stroke="#6b7280" stroke-width="1.2" stroke-dasharray="3 3"/>`);
    if (spec.legend) { const lg = spec.legend.length > 90 ? spec.legend.slice(0, 87) + "…" : spec.legend; o.push(T(W / 2, 198, lg, { size: 10, fill: "#374151" })); H = 206; }
    alt = `Diagram: ${spec.top.label} (${spec.top.leftEnd} to ${spec.top.rightEnd}) paired with ${spec.bottom.label} (${spec.bottom.leftEnd} to ${spec.bottom.rightEnd}), ${n} base positions.`;
  } else if (spec.variant === "replication_bubble") {
    H = 250;
    if (spec.title) o.push(T(W / 2, 16, spec.title.length > 70 ? spec.title.slice(0, 67) + "…" : spec.title, { bold: true, size: 12 }));
    const cx = W / 2, yt = 80, yb = 170;
    o.push(`<line x1="40" y1="${yt}" x2="${W - 40}" y2="${yt}" stroke="#111" stroke-width="2.6"/><line x1="40" y1="${yb}" x2="${W - 40}" y2="${yb}" stroke="#111" stroke-width="2.6"/>`);
    o.push(T(24, yt + 4, spec.topEnds[0], { bold: true }), T(W - 22, yt + 4, spec.topEnds[1], { bold: true }), T(24, yb + 4, spec.bottomEnds[0], { bold: true }), T(W - 22, yb + 4, spec.bottomEnds[1], { bold: true }));
    o.push(T(cx, 118, spec.originLabel, { size: 12 }), `<line x1="${cx}" y1="${yt + 4}" x2="${cx}" y2="${yb - 4}" stroke="#6b7280" stroke-dasharray="3 3"/>`);
    // 새 가닥: 템플릿에서 안쪽으로 12px 띄운 점선
    for (const ns of spec.newStrands) {
      const y = ns.side === "top" ? yt + 22 : yb - 22;
      const xa = ns.region === "left" ? 90 : cx + 14, xb = ns.region === "left" ? cx - 14 : W - 90;
      o.push(`<line x1="${xa}" y1="${y}" x2="${xb}" y2="${y}" stroke="#C8102E" stroke-width="2.2" stroke-dasharray="7 5"/>`, T((xa + xb) / 2, y + (ns.side === "top" ? -7 : 18), ns.id, { fill: "#C8102E", bold: true }));
    }
    for (const fk of spec.forks) { const x = fk.side === "left" ? 90 : W - 90; o.push(`<circle cx="${x}" cy="${(yt + yb) / 2}" r="5" fill="#111"/>`, T(x, (yt + yb) / 2 + 22, fk.id, { size: 12 })); }
    o.push(T(W / 2, 238, "solid = parental template, dashed = newly synthesized strand", { size: 10, fill: "#374151" }));
    alt = `Replication bubble with ${spec.forks.length} forks and new strands ${spec.newStrands.map((s) => s.id).join(", ")}. Top template ${spec.topEnds[0]} to ${spec.topEnds[1]}; bottom template ${spec.bottomEnds[0]} to ${spec.bottomEnds[1]}.`;
  } else {
    H = 250;
    if (spec.title) o.push(T(W / 2, 16, spec.title, { bold: true }));
    const n = spec.codons.length, cw = 84, startX = (W - n * cw) / 2;
    const y = 190;
    o.push(T(startX - 14, y + 5, spec.leftEnd, { anchor: "end", bold: true }), T(startX + n * cw + 14, y + 5, spec.rightEnd, { anchor: "start", bold: true }));
    spec.codons.forEach((c, i) => o.push(`<rect x="${f(startX + i * cw + 3)}" y="${y - 16}" width="${cw - 6}" height="32" rx="4" fill="#fff" stroke="#111" stroke-width="1.6"/>`, T(startX + i * cw + cw / 2, y + 5, c, { bold: true })));
    const sitesSorted = spec.sites;
    for (const st of sitesSorted) {
      const cx = startX + st.codonIndex * cw + cw / 2;
      o.push(`<rect x="${f(cx - cw / 2 + 3)}" y="${y - 70}" width="${cw - 6}" height="46" rx="6" fill="${st.trna ? "#e5eefb" : "#f3f4f6"}" stroke="#1B6FB0" stroke-width="1.4" stroke-dasharray="${st.trna ? "none" : "4 3"}"/>`);
      o.push(T(cx, y - 52, `${st.site} site`, { size: 12, bold: true }), T(cx, y - 35, st.trna ?? "empty", { size: 11 }));
    }
    o.push(`<path d="M${f(startX + 6)} ${y - 92} H${f(startX + n * cw - 6)}" stroke="#9ca3af" stroke-width="1"/>`);
    o.push(T(W / 2, y - 98, "Ribosome", { size: 11, fill: "#374151" }));
    if (spec.codonTable) { const t = Object.entries(spec.codonTable).map(([k, v]) => `${k}: ${v}`).join("   "); o.push(T(W / 2, 236, t.length > 100 ? t.slice(0, 97) + "…" : t, { size: 10.5, fill: "#374151" })); }
    alt = `Ribosome on mRNA (${spec.leftEnd} ${spec.codons.join(" ")} ${spec.rightEnd}); ${spec.sites.map((s) => `${s.site} site over ${spec.codons[s.codonIndex]}${s.trna ? ` holding ${s.trna}` : " empty"}`).join("; ")}.`;
  }
  // 라벨 폭 점검(가장 긴 라벨이 도식 폭을 넘으면 알림)
  const longest = spec.variant === "strand_pair" ? Math.max(labelWidth(spec.top.label, 12), labelWidth(spec.bottom.label, 12)) : 0;
  if (longest > W - 20) issues.push({ code: "label_too_long", message: "가닥 라벨이 도식 폭을 넘습니다." });
  return { svg: head(H) + o.join("") + "</svg>", alt, issues };
}
