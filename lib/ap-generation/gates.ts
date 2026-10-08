// AP 문항 결정적 게이트(순수 함수, 2026-10-08). LLM 없이 코드로 판정한다. 5가지 채택 기준(docs/ap/acceptance-criteria-and-review-pipeline.md)의 기계 검증 부분.
// 반환: 사유 코드 배열(비어 있으면 통과). 모델 검토·독립 풀이는 보조이며 이 게이트를 대체하지 않는다.

export type McOption = { text: string; why: string | null; value: string | null };
export type McPack = {
  archetype: string; topic: string; skill: string; calculator: "required" | "not_allowed" | "allowed" | "na";
  stem: string; stimulus: { kind: string; description: string; data: unknown }; options: McOption[]; key_index: number; est_seconds: number; facts: string[];
  explanation_en?: string;
};
export type Row = { row_id: string; points: number; criterion: string; required_elements: string[]; requires_row_id?: string | null; requires_both?: boolean; requires_numbers?: boolean; units_row?: boolean };
/** 파트마다 평가 스킬(skill_codes)·토픽(topic_codes)·루브릭 행을 가진다. 번들의 대표 스킬(representative_skill)은 라벨일 뿐 파트 스킬과 별개다. */
export type FrqPart = { label: string; prompt: string; points: number; response_mode: string; skill_codes: string[]; topic_codes?: string[]; model_answer: string; rubric_rows: Row[] };
export type FrqPack = { archetype: string; template: string; topic: string; skill: string; representative_skill?: string; extra_topics?: string[]; calculator: string; title: string; stimulus: { kind: string; description: string; data: unknown }; parts: FrqPart[]; total_points: number; est_minutes: number; facts: string[] };

/** MC 에서 평가되지 않는 공식 스킬(과목별). */
export const NOT_ASSESSED_MC: Record<string, string[]> = {
  ap_calculus_ab: ["1.A", "1.B", "3.A", "4.A", "4.B", "4.C", "4.D", "4.E"],
  ap_microeconomics: ["4.A", "4.B", "4.C"],
};
export const OPTION_COUNT: Record<string, number> = { ap_calculus_ab: 4, ap_biology: 4, ap_microeconomics: 5 };

const NARRATED = /\b(because|incorrectly|mistake|forgets|forgot|ignores|assumes|wrongly|error)\b/i;
const LETTER_REF = /\b(?:[Oo]ption|[Cc]hoice|[Aa]nswer)s?\s+\(?[A-E]\)?(?![a-z])|(?:^|\s)\([A-E]\)(?=\s|$|[.,;])/;
const numbers = (s: string) => (s.match(/-?\d+(?:\.\d+)?/g) ?? []).map((x) => x.replace(/^-/, ""));
const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();
const plain = (s: string) => s.replace(/\$/g, "").replace(/\\[a-zA-Z]+/g, "").replace(/[{}^_]/g, "");


const REJECT = /\b(wrong|incorrect|not|no|never|cannot|fails?|failing|ignores?|ignoring|confus\w*|misappl\w*|mis\w+|mistak\w*|false|instead|neither|nor|rather|however|but|only|treats?|assumes?|uses|using|keeps?|drops?|dropping|forgets?|forgetting|omits?|misses|missing|reverses?|swaps?|doubl\w*|halv\w*|comes? from|contradicts?|(?:option|choice|answer|value|claim|statement|integral|expression|result)s?)\b/i;
const STOP = new Set(["the", "and", "that", "this", "with", "from", "because", "which", "when", "than", "then", "does", "have", "limit", "value", "answer", "choice", "option", "claim", "function", "correct", "exist"]);
const tokens = (t: string) => (plain(t).toLowerCase().match(/[a-z]{4,}|\d+(?:\.\d+)?/g) ?? []).filter((x) => !STOP.has(x));
/** 오답 중 해설에서 배척 진술이 없는 개수. 배척 진술 = 부정·대비 표지를 가진 문장이 (a) 오답 문구/구별 토큰을 언급하거나 (b) 오답 수만큼 별도 문장으로 존재. 의미 정확성은 판단하지 않는다. */
export function distractorsMissing(p: McPack, e: string): number {
  const sents = e.split(/(?<=[.!?])\s+|\n+/).map((x) => x.trim()).filter(Boolean);
  const keyToks = new Set(tokens(p.options[p.key_index].text));
  const dis = p.options.map((o, i) => ({ o, i })).filter((x) => x.i !== p.key_index);
  const rejecting = sents.slice(1).filter((x) => REJECT.test(x));
  const anchored = dis.filter(({ o }) => {
    const txt = plain(o.text).trim(); const dt = tokens(o.text).filter((t) => !keyToks.has(t));
    return rejecting.some((x) => (txt.length > 1 && plain(x).includes(txt)) || dt.some((t) => plain(x).toLowerCase().includes(t))) || (o.value !== null && numbers(e).includes(String(Number(o.value)).replace(/^-/, "")));
  }).length;
  const bySentence = Math.min(dis.length, rejecting.length);
  return dis.length - Math.max(anchored, bySentence);
}

export function gateMc(subject: string, p: McPack): string[] {
  const r: string[] = [];
  const want = OPTION_COUNT[subject] ?? 4;
  if (p.options.length !== want) r.push(`option_count_${p.options.length}`);
  if (!Number.isInteger(p.key_index) || p.key_index < 0 || p.key_index >= p.options.length) { r.push("key_out_of_range"); return r; }
  const texts = p.options.map((o) => norm(o.text));
  if (new Set(texts).size !== texts.length) r.push("duplicate_options");
  p.options.forEach((o, i) => {
    if (i !== p.key_index && (!o.why || o.why.trim().length < 15)) r.push("distractor_without_misconception");
    if (/^ap_calculus/.test(subject) && NARRATED.test(o.text)) r.push("narrated_error_in_option"); // 수학 과목의 값·식 선택지 규칙(Micro 는 설명형 선택지가 공식 형식)
  });
  // 값 유일성(코드가 계산한 값): 오답 값이 정답 값과 같으면 복수 정답
  const kv = p.options[p.key_index].value;
  if (kv !== null) p.options.forEach((o, i) => { if (i !== p.key_index && o.value !== null && Math.abs(Number(o.value) - Number(kv)) < 1e-9) r.push("multiple_correct_same_value"); });
  // 길이 단서
  const lens = p.options.map((o) => plain(o.text).length);
  const mean = lens.reduce((a, b) => a + b, 0) / lens.length;
  if (lens[p.key_index] === Math.max(...lens) && lens[p.key_index] > mean * 1.6 && lens[p.key_index] > 18) r.push("key_much_longer");
  if (Math.min(...lens) > 0 && Math.max(...lens) / Math.min(...lens) > 6 && Math.max(...lens) > 30) r.push("options_not_parallel");
  if (p.stimulus.kind === "table" && !/\b(table|data|values|shown|results?|above|below|given|presented|following|information|trial|measurements?)\b/i.test(p.stem)) r.push("stem_does_not_reference_table");
  if (p.explanation_en && LETTER_REF.test(p.explanation_en)) r.push("explanation_references_option_letter");
  if ((NOT_ASSESSED_MC[subject] ?? []).includes(p.skill)) r.push("skill_not_assessed_in_mc");
  if (!(p.est_seconds >= 30 && p.est_seconds <= 150)) r.push("est_seconds_out_of_range");
  if (p.stem.split(/\s+/).length > 120) r.push("stem_too_long");
  if (/^ap_calculus/.test(subject)) { // 달러 기호가 통화인 과목(Micro)에는 적용하지 않는다
    if (p.stem.replace(/\\\$/g, "").split("$").length % 2 === 0) r.push("unbalanced_math_delimiters");
    if (p.options.some((o) => o.text.replace(/\\\$/g, "").split("$").length % 2 === 0)) r.push("unbalanced_math_delimiters");
  }
  if (p.explanation_en !== undefined) {
    const e = p.explanation_en;
    // 해설의 "The correct answer is X" 가 키 선택지와 같은지(키 인덱스만 바뀐 오류 검출)
    const m = e.match(/^The correct answer is (.+?)\.(?:\s|$)/);
    if (m && plain(m[1]).replace(/\s+/g, "") !== plain(p.options[p.key_index].text).replace(/\s+/g, "")) r.push("explanation_key_mismatch");
    if (e.trim().length < 80) r.push("explanation_too_short");
    // 오답 해설 포함 여부(v2, 2026-10-09): 문구 일치가 아니라 "오답마다 그것을 배척하는 진술이 있는가"를 본다. 진술의 정확성은 동결 검토기의 해설 기준이 판단한다.
    if (distractorsMissing(p, e) > 1) r.push("explanation_does_not_cover_distractors");
  }
  return [...new Set(r)];
}

/** LLM 이 다듬은 문장이 코드가 정한 수치·기호를 바꾸지 않았는지. */
const DECIMAL3 = /\$-?\d+\.\d{3,}\$/;
/** 계산기 불가 문항의 선택지는 정확값이어야 한다(소수 근사 금지). */
export function gateNoCalcExact(p: McPack): string[] { return p.calculator === "not_allowed" && p.options.some((o) => DECIMAL3.test(o.text)) ? ["decimal_options_in_no_calculator_item"] : []; }

export function wordingPreserves(baseStem: string, polished: string): string[] {
  const r: string[] = [];
  const want = new Set(numbers(plain(baseStem)));
  const have = new Set(numbers(plain(polished)));
  for (const n of want) if (!have.has(n)) r.push(`polished_stem_missing_${n}`);
  for (const n of have) if (!want.has(n) && Number(n) > 0 && !["1", "2", "3"].includes(n) && n.length > 0) r.push(`polished_stem_new_number_${n}`);
  // LaTeX 수식 조각 보존: 기본 stem 의 $...$ 블록이 그대로 들어 있어야 한다
  for (const m of baseStem.match(/\$[^$]+\$/g) ?? []) if (!polished.includes(m)) r.push("polished_stem_changed_math_block");
  return [...new Set(r)];
}

export type FrqGateOpts = { requirePartTopics?: boolean; topics?: Set<string> };
export function gateFrq(subject: string, p: FrqPack, skills: Set<string>, opts: FrqGateOpts = {}): string[] {
  const r: string[] = [];
  if (!p.parts.length) return ["no_parts"];
  let total = 0;
  const allRows = new Map<string, Row>();
  p.parts.forEach((pt) => pt.rubric_rows.forEach((x) => allRows.set(x.row_id, x)));
  for (const pt of p.parts) {
    total += pt.points;
    if (!pt.rubric_rows.length) r.push(`part_${pt.label}_no_rows`);
    const sum = pt.rubric_rows.reduce((a, b) => a + b.points, 0);
    if (sum !== pt.points) r.push(`part_${pt.label}_rows_sum_${sum}_vs_${pt.points}`);
    for (const s of pt.skill_codes) if (!skills.has(s)) r.push(`part_${pt.label}_unknown_skill_${s}`);
    if (!pt.skill_codes.length) r.push(`part_${pt.label}_no_skill`);
    if (opts.requirePartTopics) { if (!pt.topic_codes?.length) r.push(`part_${pt.label}_no_topic`); else for (const t of pt.topic_codes) if (opts.topics && !opts.topics.has(t)) r.push(`part_${pt.label}_unknown_topic_${t}`); }
    if (!pt.model_answer.trim()) r.push(`part_${pt.label}_no_model_answer`);
    for (const x of pt.rubric_rows) {
      if (x.requires_row_id && !allRows.has(x.requires_row_id)) r.push(`part_${pt.label}_bad_requires_${x.requires_row_id}`);
      if (!x.required_elements.length) r.push(`row_${x.row_id}_no_required_elements`);
      if (!x.criterion.trim()) r.push(`row_${x.row_id}_no_criterion`);
    }
    // 수치 서술 파트에는 정답 행이 있어야 한다
    if (pt.response_mode === "calculate" && !/do not evaluate/i.test(pt.prompt) && !pt.rubric_rows.some((x) => /answer|approximation|value|expression|equation|speed|vector|terms|slope|distance|derivative|correct|comput|calculat|evaluat|result|final|index|rate|percent|units?|solves?|find|determin|exact/i.test(x.criterion))) r.push(`part_${pt.label}_calculation_without_answer_row`);
    // 정당화 파트는 조건/이유 행이 있어야 한다
    if (pt.response_mode === "explain" && pt.skill_codes.some((s) => s.startsWith("3.")) && /justify|give a reason|explain why|reason for/i.test(pt.prompt) && !pt.rubric_rows.some((x) => /reason|justif|condition|continuous|compare|consider|baseline|differ|support|classif|sign change|changes sign/i.test(x.criterion))) r.push(`part_${pt.label}_justification_without_reason_row`);
  }
  if (total !== p.total_points) r.push(`total_points_${total}_vs_${p.total_points}`);
  // 번들 대표 스킬은 어떤 파트의 평가 스킬이어야 하지만, 모든 파트가 같을 필요는 없다(공식 FRQ 는 파트별 스킬이 다르다).
  if (p.representative_skill && !p.parts.some((x) => x.skill_codes.includes(p.representative_skill!))) r.push("representative_skill_not_assessed_by_any_part");
  if (subject !== "ap_biology" && p.est_minutes > (subject === "ap_microeconomics" ? 32 : 20)) r.push("est_minutes_too_long"); // Bio 의 시간은 점수 비례 내부 추정(참고용)이라 반려 사유로 쓰지 않는다
  if (!(p.stimulus.kind && p.stimulus.description)) r.push("missing_stimulus");
  return [...new Set(r)];
}

const shingles = (s: string) => { const t = norm(s).replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(Boolean); const o = new Set<string>(); for (let i = 0; i + 2 < t.length; i++) o.add(t.slice(i, i + 3).join(" ")); return o; };
export const jaccard = (a: Set<string>, b: Set<string>) => { let i = 0; a.forEach((x) => b.has(x) && i++); const u = a.size + b.size - i; return u ? i / u : 0; };
export const textOf = (p: McPack | FrqPack) => ("options" in p ? `${p.stem} ${p.options.map((o) => o.text).join(" ")} ${JSON.stringify(p.stimulus.data)}` : `${p.title} ${p.parts.map((x) => x.prompt).join(" ")} ${JSON.stringify(p.stimulus.data)}`);

/** 근접 중복 게이트: 이미 채택된 문항들과 비교(같은 숫자 세트이거나 3-gram 유사도 > 0.8). */
export function gateDuplicate(p: McPack | FrqPack, accepted: (McPack | FrqPack)[]): string[] {
  const s = shingles(textOf(p));
  for (const a of accepted) {
    if (norm(textOf(a)) === norm(textOf(p))) return ["exact_duplicate"];
    if (jaccard(s, shingles(textOf(a))) > 0.8) return ["near_duplicate"];
  }
  return [];
}

/** 공식 샘플 분석에서 얻은 참조 패턴(reference-item-analysis.md): 부하·시간·구조 범위. */
export const REFERENCE_PROFILE = {
  mc: { estSeconds: [45, 130], stemWords: [3, 100], options: 4, minDistinctMisconceptions: 3 },
  frq9: { points: 9, parts: [3, 6], rowsPerPart: [1, 5], minutes: [12, 18] }, // Calculus: 섹션 90분/54점 = 문항당 약 15분(점당 1.67분). 공식 예) 2026 Calc Q3 는 1/1/2/5점 4파트
  frq4: { points: 4, parts: [4, 4], rowsPerPart: [1, 1], minutes: [6, 10] },
};
export function calibrateMc(subject: string, p: McPack): string[] {
  const r: string[] = [];
  const P = REFERENCE_PROFILE.mc;
  if (false) r.push("");
  if (p.est_seconds < P.estSeconds[0] || p.est_seconds > P.estSeconds[1]) r.push("reference_time_out_of_range");
  const words = p.stem.replace(/\$[^$]*\$/g, " ").split(/\s+/).filter(Boolean).length;
  if (words < 3 || words > P.stemWords[1]) r.push("reference_stem_length_out_of_range");
  const whys = new Set(p.options.filter((_, i) => i !== p.key_index).map((o) => norm(o.why ?? "")));
  if (whys.size < Math.min(P.minDistinctMisconceptions, p.options.length - 1)) r.push("reference_distractor_misconceptions_not_distinct");
  return r;
}
/** Biology: 섹션 II 90분 / 34점(긴 9×2 + 짧은 4×4) = 점당 약 2.65분 → 9점 약 24분, 4점 약 10.6분(점수 비례 추정; 공식은 총 시간만 공시). 짧은 문항은 정확히 4개의 1점 파트. */
export const BIO_PROFILE = { long: { points: 9, parts: [3, 6] as [number, number], rowsPerPart: [1, 5] as [number, number], minutes: [18, 26] as [number, number] }, short: { points: 4, parts: [4, 4] as [number, number], rowsPerPart: [1, 1] as [number, number], minutes: [7, 13] as [number, number] } };
/** Microeconomics: 섹션 60분(읽기 10분 포함) 중 쓰기 50분 / 20점(긴 10 + 짧은 5×2) = 점당 2.5분 → 10점 약 25분, 5점 약 12.5분. */
export const MICRO_PROFILE = { long: { points: 10, parts: [4, 8] as [number, number], rowsPerPart: [1, 5] as [number, number], minutes: [20, 30] as [number, number] }, short: { points: 5, parts: [3, 6] as [number, number], rowsPerPart: [1, 3] as [number, number], minutes: [10, 16] as [number, number] } };
export function calibrateFrq(p: FrqPack, subject = "ap_calculus_ab"): string[] {
  const r: string[] = [];
  const prof = subject === "ap_microeconomics" ? (p.total_points >= 10 ? MICRO_PROFILE.long : MICRO_PROFILE.short) : subject === "ap_biology" ? (p.total_points >= 9 ? BIO_PROFILE.long : BIO_PROFILE.short) : p.total_points >= 9 ? REFERENCE_PROFILE.frq9 : REFERENCE_PROFILE.frq4;
  if (p.total_points !== prof.points) r.push("reference_points_mismatch");
  if (p.parts.length < prof.parts[0] || p.parts.length > prof.parts[1]) r.push("reference_part_count_out_of_range");
  if (subject !== "ap_biology" && (p.est_minutes < prof.minutes[0] || p.est_minutes > prof.minutes[1])) r.push("reference_time_out_of_range");
  for (const pt of p.parts) if (pt.rubric_rows.length < prof.rowsPerPart[0] || pt.rubric_rows.length > prof.rowsPerPart[1]) r.push(`reference_rows_per_part_${pt.label}`);
  return r;
}

/** Bio 시간 편차는 반려 사유가 아니라 참고 표시(점수 비례 내부 추정, 공식 문항별 시간 아님). 실제 과제량·풀이 검토로 판단한다. */
export function advisoryBioTime(p: FrqPack): string[] { return p.est_minutes < BIO_PROFILE.short.minutes[0] || p.est_minutes > BIO_PROFILE.long.minutes[1] ? ["advisory_time_deviation_from_internal_estimate"] : []; }
