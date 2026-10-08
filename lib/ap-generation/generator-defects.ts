// 생성기 결함 탐지(결정적, LLM 없음). "렌더링이 되는가"(그림 게이트)와 "자료가 정확한가"를 분리하기 위한 별도 검사.
// 결함이 하나라도 있으면 이전에 auto_passed 였더라도 게시 대상에서 제외한다(마이그레이션 402 의 defect_flags → review_env_ready=false).
type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);

/** 학생에게 보이는 모든 문자열(문항·보기·해설·자료 문구·FRQ 파트). */
export function visibleStrings(p: Json): { path: string; text: string }[] {
  const out: { path: string; text: string }[] = []; const walk = (v: unknown, path: string, depth: number) => {
    if (depth > 8) return; if (typeof v === "string") out.push({ path, text: v }); else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`, depth + 1)); else if (isObj(v)) for (const [k, x] of Object.entries(v)) { if (["verification_code", "design_note", "facts", "seed", "pack_id", "archetype"].includes(k)) continue; walk(x, path ? `${path}.${k}` : k, depth + 1); }
  }; walk(p, "", 0); return out;
}
const stripEsc = (s: string) => s.replace(/\\[{}]/g, "");
function braceBalance(s: string): string[] {
  const r: string[] = []; const t = stripEsc(s);
  let d = 0; let neg = false; for (const ch of t) { if (ch === "{") d++; else if (ch === "}") { d--; if (d < 0) { neg = true; d = 0; } } }
  if (d !== 0 || neg) r.push("unbalanced_braces");
  const begins = [...t.matchAll(/\\begin\{(\w+\*?)\}/g)].map((m) => m[1]); const ends = [...t.matchAll(/\\end\{(\w+\*?)\}/g)].map((m) => m[1]);
  if (begins.length !== ends.length || begins.some((b) => !ends.includes(b))) r.push("unclosed_latex_environment");
  if ((t.match(/\\left\b/g) ?? []).length !== (t.match(/\\right\b/g) ?? []).length) r.push("unbalanced_left_right");
  return r;
}
export type DefectFlag = { code: string; where: string };
/** 표 구조 검사: 본문 누락·행 폭 불일치·같은 입력의 값 모순. */
function tableIssues(stim: Json): string[] {
  const r: string[] = []; const data = isObj(stim.data) ? stim.data : null; if (!data) return stim.kind === "table" ? ["table_body_missing"] : [];
  const tables: { cols?: unknown[]; rows?: unknown[] }[] = [];
  if (Array.isArray(data.rows) || Array.isArray(data.columns)) tables.push({ cols: data.columns as unknown[] | undefined, rows: data.rows as unknown[] | undefined });
  for (const k of ["tables", "panels"]) if (Array.isArray(data[k])) for (const t of data[k] as unknown[]) if (isObj(t)) tables.push({ cols: (t.columns ?? t.headers) as unknown[] | undefined, rows: t.rows as unknown[] | undefined });
  if (stim.kind === "table" && !tables.length) return ["table_body_missing"];
  for (const t of tables) {
    const rows = Array.isArray(t.rows) ? t.rows : [];
    if (stim.kind === "table" && rows.length === 0) { r.push("table_body_missing"); continue; }
    const width = Array.isArray(t.cols) && t.cols.length ? t.cols.length : (data.x_label || data.y_label ? 2 : 0);
    const seen = new Map<string, string>();
    for (const row of rows) {
      if (isObj(row) && Array.isArray((row as Json).values)) { if (width && ((row as Json).values as unknown[]).length + 1 !== width && ((row as Json).values as unknown[]).length !== width) r.push("table_row_width_mismatch"); continue; } // {label, values[]} 형식 행
      if (!Array.isArray(row)) { r.push("table_row_not_array"); continue; }
      if (width && row.length !== width) r.push("table_row_width_mismatch");
      if (row.some((c) => c === null || c === undefined || String(c).trim() === "")) r.push("table_empty_cell");
      if (row.length === 2) { const k = String(row[0]); const v = JSON.stringify(row.slice(1)); if (seen.has(k) && seen.get(k) !== v) r.push("table_contradictory_rows"); seen.set(k, v); }
    }
  }
  return [...new Set(r)];
}
export function generatorDefects(payload: Json): DefectFlag[] {
  const out: DefectFlag[] = [];
  for (const { path, text } of visibleStrings(payload)) {
    if (/\[object Object\]/.test(text) || /^\s*\{\s*"?text"?\s*:/.test(text)) out.push({ code: "object_object_option", where: path });
    for (const c of braceBalance(text)) out.push({ code: c, where: path });
  }
  const items = Array.isArray(payload.items) ? (payload.items as Json[]) : [];
  for (const it of [payload, ...items]) for (const [i, o] of (Array.isArray(it.options) ? (it.options as unknown[]) : []).entries()) { if (isObj(o) && typeof o.text !== "string") out.push({ code: "object_object_option", where: `options[${i}]` }); if (o === null || o === undefined || (typeof o === "string" && !o.trim())) out.push({ code: "empty_option", where: `options[${i}]` }); }
  const stim = payload.stimulus;
  if (isObj(stim)) for (const c of tableIssues(stim)) out.push({ code: c, where: "stimulus" });
  const seen = new Set<string>(); return out.filter((d) => (seen.has(d.code + d.where) ? false : (seen.add(d.code + d.where), true)));
}
