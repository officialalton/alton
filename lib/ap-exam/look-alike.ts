// 구조적 look-alike 판정(2026-10-09 오너): 문항군 ID 만 믿지 않는다. 숫자·함수만 다르고 상황·표현·질문·풀이 절차가 같으면 같은 문항군으로 센다.
// 같은 개념(예: 적분 누적)이 반복되는 것은 금지가 아니다 — 개념 키 중복 규칙은 두지 않는다.
export type LookAlikeInput = { key: string; family: string; archetype?: string | null; topic: string; stimKind: string; stem: string; thinking?: string[] };
const maskMath = (s: string) => s.replace(/\$[^$]*\$/g, " M ").replace(/[0-9]+(\.[0-9]+)?/g, "#").replace(/\s+/g, " ").trim().toLowerCase();
export const stemTemplate = (s: string) => maskMath(s);
const toks = (s: string) => new Set(maskMath(s).split(/[^a-z#]+/).filter((w) => w.length > 2));
const jac = (a: Set<string>, b: Set<string>) => { let i = 0; for (const x of a) if (b.has(x)) i++; return i / Math.max(1, a.size + b.size - i); };
export type LookAlikeReason = "family" | "template" | "archetype";
/** 두 문항이 같은 문항군으로 취급되어야 하는 이유(없으면 null). */
export function lookAlikeReason(a: LookAlikeInput, b: LookAlikeInput): LookAlikeReason | null {
  if (a.family === b.family) return "family";
  if (a.topic !== b.topic || a.stimKind !== b.stimKind) return null;
  if (maskMath(a.stem) === maskMath(b.stem)) return "template";
  const sig = (x: LookAlikeInput) => (x.thinking ?? []).map(maskMath).join("|");
  if (a.archetype && a.archetype === b.archetype && sig(a) === sig(b) && jac(toks(a.stem), toks(b.stem)) >= 0.7) return "archetype";
  return null;
}
/** 연결 요소(union-find). effectiveFamily: key -> 군집 대표 키 기반 ID, clusters: 2개 이상 군집과 연결 근거. */
export function clusterLookAlikes(items: LookAlikeInput[]) {
  const p = items.map((_, i) => i); const find = (i: number): number => (p[i] === i ? i : (p[i] = find(p[i])));
  const edges: { i: number; j: number; r: LookAlikeReason }[] = [];
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) { const r = lookAlikeReason(items[i], items[j]); if (!r) continue; edges.push({ i, j, r }); p[find(j)] = find(i); }
  const eff = new Map<string, string>(); const groups = new Map<number, string[]>(); const why = new Map<number, Set<LookAlikeReason>>();
  items.forEach((it, i) => { const r = find(i); eff.set(it.key, `la:${items[r].key}`); groups.set(r, [...(groups.get(r) ?? []), it.key]); });
  for (const e of edges) { const r = find(e.i); (why.get(r) ?? why.set(r, new Set()).get(r)!).add(e.r); }
  return { effectiveFamily: eff, clusters: [...groups].filter(([, v]) => v.length > 1).map(([r, keys]) => ({ id: `la:${items[r].key}`, keys, reasons: [...(why.get(r) ?? [])] })) };
}
