// 표준 렌더링 엔진 — 템플릿: 벤 다이어그램(두 집합)·수형도(두 단계 확률)
//
// 관계만 받는다. 벤: 두 집합 이름과 네 영역(A 만·A∩B·B 만·바깥)의 값 라벨(+ 전체 개수 라벨). 수형도: 첫 단계 가지(이름·확률 라벨)와 각 가지에서 이어지는 둘째 단계 가지.
// 인쇄되는 값·확률은 모두 `label` 필드(문자열)에 둔다 — 숫자는 정수·분수·소수, 모르는 값은 문자(x)로. 원·선·영역 자리는 여기서 정한다(G8 가 영역 위치와 가지 라벨을 다시 읽어 대조).

import { dedupe, f, labelWidth, type FigureIssue } from "./_layout";

export type VennRegionId = "a" | "ab" | "b" | "out";
export type VennSpec = {
  type: "venn_tree";
  kind: "venn";
  /** 두 집합의 이름(그림 위쪽에 인쇄). */
  sets: [string, string];
  /** 네 영역 — a: 첫째 집합에만, ab: 교집합, b: 둘째 집합에만, out: 어느 쪽에도 속하지 않음. */
  regions: { id: VennRegionId; label: string }[];
  /** 전체 개수 라벨(바깥 사각형 오른쪽 아래). */
  total?: { label: string };
};
export type TreeNext = { name: string; label: string };
export type TreeSpec = {
  type: "venn_tree";
  kind: "tree";
  /** 첫 단계 가지(2~3개). 각 가지의 label 은 확률, next 는 둘째 단계 가지(1단계와 같은 개수가 아니어도 된다). */
  branches: { name: string; label: string; next: TreeNext[] }[];
};
export type VennTreeSpec = VennSpec | TreeSpec;

const isText = (v: unknown, max = 12): v is string => typeof v === "string" && v.trim().length > 0 && v.trim().length <= max;
const NUMISH = /^-?\d+(?:\.\d+)?(?:\/\d+)?$/;

export function validateVennTree(input: unknown): { ok: true; spec: VennTreeSpec } | { ok: false; error: string } {
  if (!input || typeof input !== "object") return { ok: false, error: "그림 데이터가 객체가 아닙니다." };
  const s = input as Record<string, unknown>;
  if (s.type !== "venn_tree") return { ok: false, error: "type 이 venn_tree 가 아닙니다." };
  if (s.kind === "venn") {
    if (!Array.isArray(s.sets) || s.sets.length !== 2 || !s.sets.every((x) => isText(x))) return { ok: false, error: "sets 는 12자 이내 이름 2개입니다." };
    if (s.sets[0] === s.sets[1]) return { ok: false, error: "두 집합 이름이 같습니다." };
    if (!Array.isArray(s.regions) || s.regions.length !== 4) return { ok: false, error: "regions 는 4개(a, ab, b, out)입니다." };
    const ids = new Set<string>();
    for (const r of s.regions as Record<string, unknown>[]) {
      if (!r || !["a", "ab", "b", "out"].includes(String(r.id)) || !isText(r.label, 8)) return { ok: false, error: "regions[] 는 {id: a|ab|b|out, label(8자 이내)} 입니다." };
      ids.add(String(r.id));
    }
    if (ids.size !== 4) return { ok: false, error: "regions 의 id 가 중복되거나 빠졌습니다." };
    if (s.total !== undefined && !(s.total && typeof s.total === "object" && isText((s.total as Record<string, unknown>).label, 10))) return { ok: false, error: "total 은 {label} 입니다." };
    return { ok: true, spec: s as unknown as VennSpec };
  }
  if (s.kind === "tree") {
    if (!Array.isArray(s.branches) || s.branches.length < 2 || s.branches.length > 3) return { ok: false, error: "branches 는 2~3개입니다." };
    const names = new Set<string>();
    for (const b of s.branches as Record<string, unknown>[]) {
      if (!b || !isText(b.name, 10) || !isText(b.label, 8)) return { ok: false, error: "branches[] 는 {name(10자 이내), label(8자 이내), next} 입니다." };
      if (!Array.isArray(b.next) || b.next.length < 2 || b.next.length > 3) return { ok: false, error: "branches[].next 는 2~3개입니다." };
      for (const n of b.next as Record<string, unknown>[]) if (!n || !isText(n.name, 10) || !isText(n.label, 8)) return { ok: false, error: "next[] 는 {name, label} 입니다." };
      names.add(String(b.name));
    }
    if (names.size !== s.branches.length) return { ok: false, error: "첫 단계 가지 이름이 중복됩니다." };
    const leaves = (s.branches as { next: unknown[] }[]).reduce((n, b) => n + b.next.length, 0);
    if (leaves > 8) return { ok: false, error: "잎이 8개를 넘습니다." };
    return { ok: true, spec: s as unknown as TreeSpec };
  }
  return { ok: false, error: "kind 는 venn|tree 입니다." };
}

const FONT = "Georgia, 'Times New Roman', serif";
export const VENN_GEOM = { W: 432, H: 262, RX1: 14, RY1: 12, RX2: 418, RY2: 250, CAX: 150, CBX: 276, CY: 134, R: 84 } as const;
/** 영역 라벨의 자리(중심). */
export const vennSpots = () => { const { CAX, CBX, CY, R, RX2, RY2, RX1 } = VENN_GEOM; const lens = (CAX + CBX) / 2; return { a: [CAX - R / 2 - 4, CY] as [number, number], ab: [lens, CY] as [number, number], b: [CBX + R / 2 + 4, CY] as [number, number], out: [RX1 + 26, RY2 - 20] as [number, number], total: [RX2 - 8, RY2 - 10] as [number, number] }; };
const esc = (t: string) => t.replace(/[&<>"']/g, "").replace(/ - /g, " − ");

export function renderVennTree(spec: VennTreeSpec): { svg: string; alt: string; issues: FigureIssue[] } {
  return spec.kind === "venn" ? renderVenn(spec) : renderTree(spec);
}

function renderVenn(spec: VennSpec) {
  const { W, H, RX1, RY1, RX2, RY2, CAX, CBX, CY, R } = VENN_GEOM;
  const spots = vennSpots();
  const lab = (id: VennRegionId) => spec.regions.find((r) => r.id === id)!.label;
  const out: string[] = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="venn" font-family="${FONT}" font-size="15" style="max-width:100%;height:auto">`);
  out.push(`<rect x="${RX1}" y="${RY1}" width="${RX2 - RX1}" height="${RY2 - RY1}" fill="none" stroke="#111" stroke-width="2"/>`);
  out.push(`<circle cx="${CAX}" cy="${CY}" r="${R}" fill="none" stroke="#111" stroke-width="2"/>`);
  out.push(`<circle cx="${CBX}" cy="${CY}" r="${R}" fill="none" stroke="#111" stroke-width="2"/>`);
  out.push(`<text x="${CAX - 30}" y="${RY1 + 22}" text-anchor="middle" fill="#111" font-style="italic" font-size="16">${esc(spec.sets[0])}</text>`);
  out.push(`<text x="${CBX + 30}" y="${RY1 + 22}" text-anchor="middle" fill="#111" font-style="italic" font-size="16">${esc(spec.sets[1])}</text>`);
  for (const id of ["a", "ab", "b", "out"] as VennRegionId[]) { const [x, y] = spots[id]; out.push(`<text x="${f(x)}" y="${f(y + 5)}" text-anchor="middle" fill="#111" font-size="16">${esc(lab(id))}</text>`); }
  if (spec.total) out.push(`<text x="${f(spots.total[0])}" y="${f(spots.total[1])}" text-anchor="end" fill="#111" font-size="14">Total: ${esc(spec.total.label)}</text>`);
  out.push("</svg>");
  const issues: FigureIssue[] = [];
  const wide = (t: string, maxW: number, what: string) => { if (labelWidth(t, 16) > maxW) issues.push({ code: "clipped", message: `${what} '${t}' 가 영역에 들어가지 않습니다.` }); };
  wide(lab("ab"), 40, "교집합 라벨"); wide(lab("a"), 110, "A 만 영역 라벨"); wide(lab("b"), 110, "B 만 영역 라벨");
  const alt = `벤 다이어그램: ${spec.sets[0]} 만 ${lab("a")}, 교집합 ${lab("ab")}, ${spec.sets[1]} 만 ${lab("b")}, 어느 쪽도 아님 ${lab("out")}${spec.total ? `, 전체 ${spec.total.label}` : ""}.`;
  return { svg: out.join("").replace('aria-label="venn"', `aria-label="${esc(alt)}"`), alt, issues };
}

export const TREE_GEOM = { W: 468, X0: 26, X1: 188, X2: 360, TOP: 28, LEAF_GAP: 44 } as const;
/** 수형도의 잎·가지 좌표(그림과 G8 가 같은 계산을 쓴다). */
export function treeLayout(spec: TreeSpec) {
  const { X0, X1, X2, TOP, LEAF_GAP } = TREE_GEOM;
  const leaves = spec.branches.reduce((n, b) => n + b.next.length, 0); const H = TOP * 2 + (leaves - 1) * LEAF_GAP + 6;
  let k = 0; const l1: { x: number; y: number; name: string; label: string; kids: { x: number; y: number; name: string; label: string }[] }[] = [];
  for (const b of spec.branches) { const kids = b.next.map((n) => ({ x: X2, y: TOP + 3 + LEAF_GAP * k++, name: n.name, label: n.label })); l1.push({ x: X1, y: kids.reduce((s, q) => s + q.y, 0) / kids.length, name: b.name, label: b.label, kids }); }
  return { H, root: [X0, H / 2] as [number, number], l1 };
}
function renderTree(spec: TreeSpec) {
  const { W, X0 } = TREE_GEOM; const L = treeLayout(spec); const H = L.H;
  const out: string[] = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="tree" font-family="${FONT}" font-size="15" style="max-width:100%;height:auto">`);
  const issues: FigureIssue[] = [];
  const placed: { x1: number; y1: number; x2: number; y2: number }[] = [];
  const seg = (a: [number, number], b: [number, number], label: string, up: boolean) => {
    out.push(`<line x1="${f(a[0])}" y1="${f(a[1])}" x2="${f(b[0])}" y2="${f(b[1])}" stroke="#111" stroke-width="2" stroke-linecap="round"/>`);
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2; const w = labelWidth(label, 14), h = 16;
    // 가지에 수직인 방향(위쪽 법선)으로 띄운다 — 가지가 기울어도 라벨이 선에 닿지 않는다. 위로 가는 가지는 선 위쪽, 아래로 가는 가지는 선 아래쪽에 둔다.
    const ex = b[0] - a[0], ey = b[1] - a[1], len = Math.hypot(ex, ey) || 1; let nx = -ey / len, ny = ex / len; if (ny > 0) { nx = -nx; ny = -ny; } if (!up && Math.abs(ey) >= 4) { nx = -nx; ny = -ny; }
    const off = 10 + (Math.abs(nx) * w) / 2 + Math.abs(ny) * 8; const cx = mx + nx * off, cy = my + ny * off;
    const box = { x1: cx - w / 2, y1: cy - h / 2, x2: cx + w / 2, y2: cy + h / 2 };
    if (box.x1 < 2 || box.x2 > W - 2 || box.y1 < 2 || box.y2 > H - 2) issues.push({ code: "clipped", message: `가지 라벨 '${label}' 가 그림 밖으로 나갑니다.` });
    if (placed.some((q) => box.x1 < q.x2 + 1 && q.x1 < box.x2 + 1 && box.y1 < q.y2 + 1 && q.y1 < box.y2 + 1)) issues.push({ code: "label_collision", message: `가지 라벨 '${label}' 가 다른 라벨과 겹칩니다.` });
    placed.push(box);
    out.push(`<text x="${f(cx)}" y="${f(cy + 5)}" text-anchor="middle" fill="#111" font-size="14" stroke="#fff" stroke-width="3" paint-order="stroke">${esc(label)}</text>`);
  };
  out.push(`<circle cx="${X0}" cy="${f(L.root[1])}" r="3" fill="#111"/>`);
  for (const b of L.l1) {
    seg(L.root, [b.x, b.y], b.label, b.y < L.root[1] - 1);
    out.push(`<circle cx="${b.x}" cy="${f(b.y)}" r="3" fill="#111"/>`);
    out.push(`<text x="${b.x + 8}" y="${f(b.y - 12)}" fill="#111" font-style="italic" font-size="15" stroke="#fff" stroke-width="3" paint-order="stroke">${esc(b.name)}</text>`);
    for (const q of b.kids) { seg([b.x, b.y], [q.x, q.y], q.label, q.y < b.y - 1); out.push(`<circle cx="${q.x}" cy="${f(q.y)}" r="3" fill="#111"/>`); out.push(`<text x="${q.x + 9}" y="${f(q.y + 5)}" fill="#111" font-style="italic" font-size="15">${esc(q.name)}</text>`); }
  }
  out.push("</svg>");
  const alt = `수형도: ${spec.branches.map((b) => `${b.name}(${b.label}) → ${b.next.map((n) => `${n.name}(${n.label})`).join(", ")}`).join("; ")}.`;
  return { svg: out.join("").replace('aria-label="tree"', `aria-label="${esc(alt)}"`), alt, issues: dedupe(issues) };
}

/** 지문 참조 검사 — "tree diagram"/"Venn diagram" 낱말이 그림 종류와 맞는가. */
export function lintVennTreeAgainstText(spec: VennTreeSpec, passage: string): FigureIssue[] {
  const issues: FigureIssue[] = [];
  const text = passage.replace(/\$/g, "");
  if (spec.kind === "venn" && /\btree diagram\b/i.test(text)) issues.push({ code: "ref_mismatch", message: "지문은 수형도라는데 그림은 벤 다이어그램입니다." });
  if (spec.kind === "tree" && /\bvenn diagram\b/i.test(text)) issues.push({ code: "ref_mismatch", message: "지문은 벤 다이어그램이라는데 그림은 수형도입니다." });
  if (spec.kind === "venn") for (const m of text.matchAll(/\b[Ss]et\s+([A-Z])\b/g)) if (!spec.sets.includes(m[1])) issues.push({ code: "ref_missing", message: `지문의 집합 ${m[1]} 가 그림에 없습니다.` });
  return dedupe(issues);
}
export { NUMISH };
