// Bio FRQ 무료 결정적 검사: 설계 오류를 LLM 호출 없이 잡는다(오너 2026-10-09). 존재하지 않는 토픽·모호한 대조군·자료와 허용 답의 모순·표시 문구 중복·열 이름 오류·문구 일치 루브릭.
// 한계: 생물학적 사실의 정확성(예: 효소 최적 조건의 현실성)은 증명하지 못한다 — 게시 후 오류 신고 흐름이 처리한다.
type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
export type BioIssue = { code: string; message: string };
const num = (s: string) => { const m = String(s).match(/-?\d+(?:\.\d+)?/); return m ? Number(m[0]) : null; };
const UP = /\b(increase[sd]?|rise[sn]?|rising|goes? up|higher|greater|more)\b/i; const DOWN = /\b(decrease[sd]?|fall[s]?|falling|goes? down|lower|less|fewer)\b/i;
export function tableMeans(stim: Json): { labels: string[]; means: number[]; se2: number[] } | null {
  const rows = stim?.data?.rows; if (!Array.isArray(rows) || !rows.length) return null; const labels: string[] = [], means: number[] = [], se2: number[] = [];
  for (const r of rows) { if (!Array.isArray(r) || r.length < 2) return null; const m = String(r[1]).match(/(-?\d+(?:\.\d+)?)\s*±\s*(\d+(?:\.\d+)?)/); if (!m) return null; labels.push(String(r[0])); means.push(Number(m[1])); se2.push(Number(m[2])); }
  return { labels, means, se2 };
}
export const trendOf = (m: number[]) => { const inc = m.every((v, i) => i === 0 || v > m[i - 1]), dec = m.every((v, i) => i === 0 || v < m[i - 1]); return inc ? "increases" : dec ? "decreases" : m[1] > Math.max(m[0], m[m.length - 1]) ? "peaks" : m[1] < Math.min(m[0], m[m.length - 1]) ? "dips" : "mixed"; };
export function gateBioFrq(p: Json, ctx: { topics: Set<string> }): BioIssue[] {
  const out: BioIssue[] = []; const add = (code: string, message: string) => out.push({ code, message });
  // 1) 존재하지 않는 토픽
  for (const t of [p.topic, ...(p.extra_topics ?? []), ...(p.parts ?? []).flatMap((x: Json) => x.topic_codes ?? [])]) if (t && !ctx.topics.has(t)) add("nonexistent_topic", `공식 토픽이 아니다: ${t}`);
  const tm = tableMeans(p.stimulus); const labels = tm?.labels ?? [];
  // 2) 모호한 대조군: 실험 설계에서는 표에 (control) 표시가 정확히 1개이고, 파트 B 정답이 그 집단을 지목하며, 대조군의 근거(control_rationale)가 설계도에 있어야 한다
  const exp = p.blueprint?.experiment; const hasControlPart = (p.parts ?? []).some((x: Json) => /control/i.test(x.prompt ?? ""));
  if (hasControlPart) {
    const marked = labels.filter((l) => /\(control\)/i.test(l)); if (marked.length !== 1) add("control_group_not_unique", `표에 (control) 표시 집단이 ${marked.length}개(정확히 1개 필요)`);
    if (!exp?.control_rationale) add("control_rationale_missing", "대조군이 기준 조건인 이유가 설계도에 없다");
    const b = (p.parts ?? []).find((x: Json) => /control/i.test(x.prompt ?? "")); const base = marked[0]?.replace(/\s*\(control\)/i, "").trim();
    if (b && base && !String(b.model_answer ?? "").toLowerCase().includes(base.toLowerCase())) add("control_answer_not_in_table", "대조군 정답이 표의 (control) 집단과 다르다");
  }
  // 3) 자료와 허용 답의 모순: 추세 표현이 자료의 추세와 맞는지, 인용한 수가 표에 있는지
  if (tm) {
    const trend = trendOf(tm.means);
    for (const part of p.parts ?? []) for (const r of part.rubric_rows ?? []) for (const a of [...(r.alt_solutions ?? []), part.model_answer ?? ""]) {
      const t = String(a); if (/rises? then falls?|increases? then decreases?|peak/i.test(t) && trend !== "peaks") add("accepted_answer_contradicts_data", `허용 답 "${t}" 는 자료의 추세(${trend})와 모순`);
      if (/falls? then rises?|decreases? then increases?|dip/i.test(t) && trend !== "dips") add("accepted_answer_contradicts_data", `허용 답 "${t}" 는 자료의 추세(${trend})와 모순`);
      if (trend === "increases" && DOWN.test(t) && !UP.test(t) && part.label === "A") add("accepted_answer_contradicts_data", `허용 답 "${t}" 는 증가 추세와 모순`);
      if (trend === "decreases" && UP.test(t) && !DOWN.test(t) && part.label === "A") add("accepted_answer_contradicts_data", `허용 답 "${t}" 는 감소 추세와 모순`);
    }
    const tableNums = new Set([...tm.means.map(String), ...tm.means.map((v) => v.toFixed(1)), ...tm.se2.map(String), ...tm.se2.map((v) => v.toFixed(1)), ...tm.se2.map((v) => v.toFixed(2))]);
    for (const part of p.parts ?? []) for (const n of (String(part.model_answer ?? "").match(/\d+\.\d+/g) ?? [])) { if (!tableNums.has(n) && !(p.facts ?? []).some((f: string) => String(f).includes(n)) && !/%|\$|=/.test(String(part.model_answer))) add("model_answer_number_not_in_data", `모범 답의 수 ${n} 가 표·사실에 없다`); }
  }
  // 4) 표시 문구 중복: (control) (control), 같은 단어 연속
  const texts: string[] = [p.title ?? "", p.stimulus?.description ?? "", ...labels, ...(p.stimulus?.data?.columns ?? []), ...(p.parts ?? []).map((x: Json) => x.prompt ?? "")];
  for (const t of texts) { if (/(\([^)]{2,20}\))\s*\1/i.test(t)) add("duplicated_display_text", `표시 문구 중복: ${t}`); if (/\b(\w{3,})\s+\1\b/i.test(t)) add("repeated_word", `같은 단어 연속: ${t}`); }
  // 5) 열 이름: 빈 이름·중복·pH 오기(Ph)·단위 누락
  const cols: string[] = p.stimulus?.data?.columns ?? []; if (cols.some((c) => !String(c).trim())) add("empty_column_name", "빈 열 이름"); if (new Set(cols.map((c) => String(c).toLowerCase())).size !== cols.length) add("duplicate_column_name", "열 이름 중복");
  for (const t of [...cols, ...texts]) if (/\bPh\b/.test(t)) add("ph_miscased", `"Ph" 는 "pH" 여야 한다: ${t}`);
  // 7) 프롬프트가 자료 형식과 어긋나는 표현: 표 자료인데 "graph"/"error bars"(그래프의 오차 막대)를 말하지 않는다
  if (p.stimulus?.kind === "table") for (const part of p.parts ?? []) if (/\b(graph|error bars?)\b/i.test(part.prompt ?? "")) add("prompt_mentions_graph_for_table", `파트 ${part.label}: 표 자료인데 그래프/오차 막대를 언급`);
  // 8) 토픽 개념 앵커: 토픽의 핵심 개념이 자료 설명 또는 프롬프트에 드러나야 한다(토픽과 약하게만 연결된 번들 방지)
  const ANCHOR: Record<string, RegExp> = { "3.2": /enzyme|substrate|active site|denatur/i, "3.5": /respiration|fermentation|ATP/i, "8.1": /respon|behavior|stimulus|taxis|kinesis|tropism/i };
  const text = [p.title, p.stimulus?.description, ...(p.parts ?? []).map((x: Json) => x.prompt)].join(" ");
  if (ANCHOR[p.topic] && !ANCHOR[p.topic].test(text)) add("topic_concept_anchor_missing", `토픽 ${p.topic} 의 핵심 개념이 번들에 없다`);
  out.push(...meaningRubricIssues(p));
  return out;
}

/** 루브릭은 의미 기반: 행마다 meaning_based, 허용 표현 2개 이상(수치 행 제외), 흔한 오류 1개 이상, 필수 요소는 개념 서술(25자 이상). Bio·Micro 공용. */
export function meaningRubricIssues(p: Json): BioIssue[] {
  const out: BioIssue[] = []; const add = (code: string, message: string) => out.push({ code, message });
  for (const part of p.parts ?? []) for (const r of part.rubric_rows ?? []) {
    const numeric = Boolean(r.requires_numbers) && (r.required_elements ?? []).every((e: string) => num(e) !== null);
    if (!r.meaning_based) add("rubric_not_meaning_based", `파트 ${part.label} 행 ${r.row_id}: 의미 기반 채점 표시 없음(문구 일치 루브릭 금지)`);
    if (!numeric && (r.alt_solutions ?? []).length < 2) add("rubric_alternatives_missing", `파트 ${part.label} 행 ${r.row_id}: 허용 표현 2개 이상 필요`);
    if (!(r.common_errors ?? []).length && !numeric) add("rubric_common_errors_missing", `파트 ${part.label} 행 ${r.row_id}: 흔한 오류 필요`);
    if (!numeric && (r.required_elements ?? []).some((e: string) => String(e).length < 25 && !/\d/.test(String(e)))) add("rubric_element_is_phrase", `파트 ${part.label} 행 ${r.row_id}: 필수 요소가 개념 서술이 아니라 짧은 문구(25자 미만)`);
  }
  return out;
}
