// 표 값 ↔ 본문·해설·사실 진술 일치 검사(결정적). "f(2)=7" 처럼 문장에 쓰인 함수값이 같은 문항의 표와 모순되면 결함이다.
// 모순된 표 값은 풀이에 쓰이지 않는 칸이어도 자료 오류이므로(키가 안 바뀌어도) 결함으로 센다 — 독립 풀이가 못 잡는 칸을 코드가 잡는다.
type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);
const num = (v: unknown) => { const n = Number(String(v).replace(/[,\s]/g, "")); return Number.isFinite(n) ? n : null; };
const norm = (s: string) => s.replace(/\\prime|\^\{\\prime\}|′|’/g, "'").replace(/\\dfrac|\\frac/g, "frac").replace(/[$\\{}]/g, "").replace(/\s+/g, "");
/** 열 머리글에서 함수 이름(예 f, f', g) 추출. x/입력 열이면 null. */
function labelOf(h: string): string | null {
  const t = norm(h); const m = t.match(/^([a-zA-Z])('*)(?:\(x\)|\(t\))?$/); if (!m) return null; return /^[xt]$/i.test(m[1]) && !m[2] ? null : m[1] + m[2];
}
export type TableMap = Map<string, Map<string, number>>; // 라벨 → (입력값 문자열 → 값)
export function tableValues(stim: unknown): TableMap {
  const out: TableMap = new Map(); if (!isObj(stim) || !isObj(stim.data)) return out; const d = stim.data;
  const add = (label: string, x: unknown, v: unknown) => { const n = num(v); const xs = num(x); if (n === null || xs === null) return; (out.get(label) ?? out.set(label, new Map()).get(label)!).set(String(xs), n); };
  const tables: { cols: unknown[]; rows: unknown[] }[] = [];
  if (Array.isArray(d.columns) && Array.isArray(d.rows)) tables.push({ cols: d.columns, rows: d.rows });
  for (const k of ["tables", "panels"]) if (Array.isArray(d[k])) for (const t of d[k] as unknown[]) if (isObj(t) && Array.isArray(t.rows)) tables.push({ cols: (t.columns ?? t.headers ?? []) as unknown[], rows: t.rows });
  for (const t of tables) {
    const labels = t.cols.map((c) => labelOf(String(c)));
    for (const row of t.rows) {
      if (Array.isArray(row)) labels.forEach((lb, ci) => { if (lb && ci > 0) add(lb, row[0], row[ci]); });
      else if (isObj(row) && Array.isArray(row.values) && typeof row.label === "string") { const lb = labelOf(String(row.label)); if (lb) (row.values as unknown[]).forEach((v, i) => add(lb, t.cols[i + 1], v)); } // 가로형: 열 머리글이 입력값
    }
  }
  if (Array.isArray(d.rows) && (d.x_label || d.y_label) && !tables.length) for (const row of d.rows as unknown[][]) { const lb = labelOf(String(d.y_label ?? "f")) ?? "f"; if (Array.isArray(row)) add(lb, row[0], row[1]); }
  return out;
}
const STMT = /([a-zA-Z])\s*((?:'|′|\\prime|\^\{\\prime\})*)\s*\(\s*(-?\d+(?:\.\d+)?)\s*\)\s*=\s*(-?\d+(?:\.\d+)?)(?![\d.]*\s*\()/g;
function texts(p: Json): string[] {
  const out: string[] = []; const push = (v: unknown) => { if (typeof v === "string") out.push(v); };
  push(p.stem); push(p.explanation_en); if (Array.isArray(p.facts)) p.facts.forEach(push);
  if (Array.isArray(p.options)) for (const o of p.options) push(isObj(o) ? o.text : o);
  if (Array.isArray(p.parts)) for (const x of p.parts as Json[]) { push(x.prompt); push(x.model_answer); }
  return out;
}
export type TableIssue = { label: string; x: string; table: number; text: number; where: string };
/** 문장에 나온 f(a)=b 가 표의 같은 라벨·같은 입력의 값과 다르면 모순. 표에 없는 입력/라벨은 건너뛴다. */
export function tableTextContradictions(payload: Json): TableIssue[] {
  const tv = tableValues(payload.stimulus); if (!tv.size) return []; const out: TableIssue[] = [];
  for (const t of texts(payload)) { for (const m of t.matchAll(STMT)) { const label = m[1] + (m[2] ? "'".repeat((m[2].match(/'|′|prime/g) ?? []).length) : ""); const col = tv.get(label); if (!col) continue; const x = String(Number(m[3])); const have = col.get(x); const say = Number(m[4]); if (have === undefined) continue; if (Math.abs(have - say) > 1e-9 * Math.max(1, Math.abs(have))) out.push({ label, x, table: have, text: say, where: t.slice(Math.max(0, (m.index ?? 0) - 20), (m.index ?? 0) + 30) }); } }
  return out;
}
