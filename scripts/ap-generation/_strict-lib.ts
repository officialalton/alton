// 엄격 배정 드라이버 공용: 공개 세트 문항과 문장이 너무 비슷한 후보를 찾는다(자카드, 본문+선택지+파트 단어 집합).
import { existsSync, readFileSync } from "node:fs";
import { STOCK_FILES } from "./keys-file";

type Raw = { stockKey: string; apSubjectCode: string; payload: Record<string, any> };
export function loadRaw(subject: string) {
  const rows = new Map<string, Raw>();
  for (const f of STOCK_FILES) { const p = `data/ap/stock/${f}.json`; if (!existsSync(p)) continue; for (const r of JSON.parse(readFileSync(p, "utf-8")) as Raw[]) if (r.apSubjectCode === subject && !rows.has(r.stockKey)) rows.set(r.stockKey, r); }
  return rows;
}
const tok = (r: Raw, mode: "text" | "code" = "text") => {
  const p = r.payload;
  if (mode === "code") { // 코드 문항: 코드 자료(식별자·키워드, 숫자·문자열 상수는 가림)의 단어 집합
    const items = Array.isArray(p.items) ? (p.items as Record<string, any>[]) : [];
    const code = String((p.stimulus as { description?: string } | undefined)?.description ?? "") + " " + String(p.stem ?? "") + " " + items.map((q) => String(q.stem ?? "")).join(" ");
    return new Set(code.replace(/"[^"]*"/g, " S ").replace(/[0-9]+(\.[0-9]+)?/g, "#").toLowerCase().split(/[^a-z_#]+/).filter((w) => w.length > 1));
  }
  const parts = [String(p.stem ?? ""), ...((p.options as { text?: string }[] | undefined) ?? []).map((o) => o.text ?? ""), ...((p.parts as { prompt?: string }[] | undefined) ?? []).map((x) => x.prompt ?? ""), String(p.title ?? "")];
  return new Set(parts.join(" ").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter((w) => w.length > 2));
};
const jac = (a: Set<string>, b: Set<string>) => { let i = 0; for (const x of a) if (b.has(x)) i++; return i / Math.max(1, a.size + b.size - i); };
/** 공개 키 집합과 비교해 유사도가 threshold 이상인 후보 키 -> {nearest, score}. */
export function tooSimilar(subject: string, publishedKeys: Set<string>, candidateKeys: string[], threshold: number, mode: "text" | "code" = "text") {
  const rows = loadRaw(subject);
  const pubTok = [...publishedKeys].map((k) => rows.get(k)).filter((r): r is Raw => !!r).map((r) => ({ key: r.stockKey, t: tok(r, mode) }));
  const out = new Map<string, { nearest: string; score: number }>();
  for (const k of candidateKeys) {
    const r = rows.get(k); if (!r) continue; const t = tok(r, mode); let best = { nearest: "", score: 0 };
    for (const q of pubTok) { const s = jac(t, q.t); if (s > best.score) best = { nearest: q.key, score: s }; }
    if (best.score >= threshold) out.set(k, best);
  }
  return out;
}
