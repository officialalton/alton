// 유형별 문제 품질 계약(2026-09-15 제품 오너).
//
// 목적은 정상 문제를 제한하는 것이 아니라 **질문·자료·정답·학생 화면의 연결 오류를 생성 단계에서 없애는 것**이다.
// 세부 기술 30개마다 다섯 연결을 구조적으로 정의하고 검사한다:
//   1. 질문 대상      — 학생이 무엇을 판단·계산·선택해야 하는가
//   2. 자료 안의 근거 — 대상이 지문 / Text 1·2 / 메모 / 표 / 그래프 / 도형 / 수식 중 어디에 있는가
//   3. 학생 화면 표시 — 빈칸·밑줄·자료 제목·표의 행열·그래프 객체·도형 라벨·선택지 그림으로 어떻게 식별되는가
//   4. 정답 근거      — 정답이 자료·질문과 실제로 맞고, 자료에서 노출되지 않는가
//   5. 답안 형식      — 객관식 / SPR / 로마숫자 조합의 입력·정규화·채점 규칙
// 하나라도 끊기면 초안으로 저장하지 않고 사유를 생성기에 돌려 자동 보완·재생성한다(lib/problem-generation/pipeline).
import type { FigureIssue } from "./problem-figures/templates/_layout";
import { checkFigure } from "./problem-figures/check";
import { checkContent } from "./problem-content-check";
import { checkRwStructure, parseRwStimulus, quotedTargetWord, rwSkillCode } from "./rw-stimulus";
import { composeProblemText } from "./problem-question";
import { judgeMaterialNeed, materialBlocker } from "./problem-material-need";
import { SKILL_BY_CODE, skillLabel } from "./problem-taxonomy";

export type EvidenceKind = "passage" | "text_1_2" | "notes" | "table" | "graph" | "figure" | "equation" | "options_figure";
export type DisplayKind = "blank" | "underline" | "target_word_underline" | "text_sections" | "notes_list" | "data_figure" | "geometry_labels" | "plane_objects" | "figure_choices" | "equation" | "plain";
export type AnswerFormat = "mc" | "spr" | "roman";

export type QualityContract = {
  skillCode: string;
  /** 1. 질문 대상. */
  target: string;
  /** 2. 자료 안의 근거 위치. */
  evidence: EvidenceKind[];
  /** 3. 학생 화면 표시 방식. */
  display: DisplayKind[];
  /** 4. 정답 근거 — 검사 방식 설명. */
  answerBasis: string;
  /** 5. 답안 형식. */
  formats: AnswerFormat[];
  /** 대표 실패 사유(문서용). */
  failureExamples: string[];
};

const RW = (skillCode: string, target: string, evidence: EvidenceKind[], display: DisplayKind[], answerBasis: string, failureExamples: string[]): QualityContract => ({ skillCode, target, evidence, display, answerBasis, formats: ["mc"], failureExamples });
const MATH = (skillCode: string, target: string, evidence: EvidenceKind[], display: DisplayKind[], answerBasis: string, failureExamples: string[], formats: AnswerFormat[] = ["mc", "spr", "roman"]): QualityContract => ({ skillCode, target, evidence, display, answerBasis, formats, failureExamples });

export const QUALITY_CONTRACTS: Record<string, QualityContract> = {
  // ---------------- Reading & Writing
  words_in_context: RW("words_in_context", "빈칸에 들어갈 가장 논리적·정확한 단어, 또는 인용된 단어의 문맥 의미", ["passage"], ["blank", "target_word_underline"], "빈칸형: 빈칸 정확히 1. 인용형: 대상 단어가 지문에 정확히 한 위치, 다른 인용 표시 없음(렌더러가 밑줄)", ["빈칸 0·2개", "인용 단어가 지문에 없음/둘 이상", "지문에 다른 따옴표 낱말(대상 모호)", "질문 표준 문구 아님"]),
  text_structure_purpose: RW("text_structure_purpose", "지문 전체의 목적 또는 밑줄 문장의 기능", ["passage"], ["underline", "plain"], "underlined 질문이면 밑줄 정확히 1, 아니면 밑줄 없음", ["밑줄 0·2개", "밑줄 있는데 질문이 underlined 아님"]),
  cross_text_connections: RW("cross_text_connections", "Text 1 의 주장에 대한 Text 2 저자의 반응/관계", ["text_1_2"], ["text_sections"], "Text 1·Text 2 제목 구역이 순서대로, 각 20단어 이상, 질문이 텍스트를 가리킴", ["Text 2 없음", "질문이 Text 1/2 미참조"]),
  central_ideas_details: RW("central_ideas_details", "지문의 중심 생각 또는 명시된 세부 정보", ["passage"], ["plain"], "본문+질문 분리, 빈칸·밑줄·Text·메모 구조 없음", ["빈칸 혼입", "질문 미인식"]),
  inferences: RW("inferences", "지문의 논리를 완성하는 절", ["passage"], ["blank"], "지문 끝 빈칸 정확히 1, 질문 'most logically completes'", ["빈칸 ≠1", "질문 문구 아님"]),
  command_of_evidence_text: RW("command_of_evidence_text", "주장을 뒷받침(또는 약화)하는 발견·인용", ["passage"], ["plain", "blank"], "지문의 주장 ↔ 선택지의 근거 문장, 빈칸 ≤1", ["빈칸 2+", "질문 미인식"]),
  command_of_evidence_quant: RW("command_of_evidence_quant", "표·그래프의 특정 값으로 문장을 완성", ["table", "graph", "passage"], ["data_figure"], "data 자료 필수, 지문 단위·항목 ↔ 자료 일치, 정답 선택지의 수치가 자료에 있음, 마크다운 표 금지", ["data 자료 없음", "단위 누락", "정답 수치가 자료에 없음"]),
  rhetorical_synthesis: RW("rhetorical_synthesis", "작성 목표를 이루는 메모 종합 문장", ["notes"], ["notes_list"], "메모 3~6, 'The student wants to' 목표, notes 참조, 정답 선택지가 메모 정보를 사용", ["메모 없음/개수 밖", "목표 문장 없음", "정답이 메모 정보와 무관"]),
  transitions: RW("transitions", "두 문장 사이 논리적 접속 표현", ["passage"], ["blank"], "빈칸 정확히 1, 질문 'most logical transition'", ["빈칸 ≠1"]),
  boundaries: RW("boundaries", "Standard English 관례에 맞는 문장부호·경계", ["passage"], ["blank"], "빈칸 정확히 1, 질문 'conforms to the conventions'", ["빈칸 ≠1"]),
  form_structure_sense: RW("form_structure_sense", "동사형·대명사·수 일치·수식어 위치", ["passage"], ["blank"], "빈칸 정확히 1, 질문 'conforms to the conventions'", ["빈칸 ≠1"]),
  // ---------------- Math
  linear_equations_one_var: MATH("linear_equations_one_var", "일차방정식의 해 또는 해의 해석", ["equation"], ["equation"], "수식 조판·선택지/SPR 형식", ["수식 조판 실패", "SPR 형식"]),
  linear_functions: MATH("linear_functions", "기울기·절편·함숫값·그래프 해석", ["equation", "graph", "table"], ["plane_objects", "data_figure", "equation"], "좌표평면 객체(직선·점) ↔ 지문 좌표·식 일치, 선택지 좌표 점 금지", ["기울기 불일치", "선택지 좌표 노출"]),
  linear_equations_two_var: MATH("linear_equations_two_var", "두 변수 일차방정식·직선 관계", ["equation", "graph"], ["plane_objects", "equation"], "좌표평면 객체 ↔ 지문 일치", ["절편 불일치"]),
  systems_linear: MATH("systems_linear", "연립방정식의 해(교점)·해의 개수", ["equation", "graph", "options_figure"], ["plane_objects", "figure_choices", "equation"], "교점 좌표 대조, 그래프 선택지 정답 자리·편향 없음", ["교점 불일치", "선택지 편향"]),
  linear_inequalities: MATH("linear_inequalities", "부등식의 해 영역·조건", ["equation", "graph"], ["plane_objects", "equation"], "부등호·경계선 종류 대조", ["부등호 불일치"]),
  equivalent_expressions: MATH("equivalent_expressions", "동치 식·인수분해·전개", ["equation"], ["equation"], "수식 조판", ["수식 조판 실패"]),
  nonlinear_equations_systems: MATH("nonlinear_equations_systems", "비선형 방정식·연립의 해·교점", ["equation", "graph"], ["plane_objects", "equation"], "교점 좌표 대조", ["교점 불일치"]),
  nonlinear_functions: MATH("nonlinear_functions", "비선형 함수의 꼭짓점·절편·그래프 식별", ["equation", "graph", "options_figure"], ["plane_objects", "figure_choices", "equation"], "꼭짓점·절편 대조, 포물선 선택지 정답 자리", ["꼭짓점 불일치", "정답 자리 불일치"]),
  ratios_rates_units: MATH("ratios_rates_units", "비율·비례·속도·단위 변환 값", ["table", "equation"], ["data_figure", "equation"], "지문 단위·항목 ↔ 자료 일치", ["단위 누락"]),
  percentages: MATH("percentages", "백분율·증감률", ["table", "graph", "equation"], ["data_figure", "equation"], "지문 값 ↔ 자료 일치", ["항목 불일치"]),
  one_variable_data: MATH("one_variable_data", "평균·중앙값·범위·분포 비교", ["table", "graph"], ["data_figure"], "data 자료 필수(숫자 목록·점도표·히스토그램·상자그림), 값 일치", ["자료 없음", "값 불일치"]),
  two_variable_data: MATH("two_variable_data", "산점도·추세선·표의 두 변수 관계", ["graph", "table"], ["data_figure"], "data 자료 필수, 추세선·점 일치", ["자료 없음"]),
  probability: MATH("probability", "확률·조건부확률", ["table"], ["data_figure"], "양방향표 필수, 합계는 렌더러 계산", ["자료 없음", "값 불일치"]),
  inference_margin_error: MATH("inference_margin_error", "표본 통계로부터의 추론·오차범위", ["table", "passage"], ["data_figure", "plain"], "표본 수·오차범위 ↔ 자료 일치", ["값 불일치"]),
  evaluating_statistical_claims: MATH("evaluating_statistical_claims", "관찰 연구/실험 설계의 타당한 결론", ["passage", "table"], ["plain", "data_figure"], "연구 설계 항목 ↔ 자료 일치", ["항목 불일치"], ["mc"]),
  area_volume: MATH("area_volume", "넓이·부피·음영 영역", ["figure", "equation"], ["geometry_labels", "equation"], "치수 라벨 ↔ 지문 일치, 구하는 값은 미지수", ["치수 불일치", "정답 라벨 노출"]),
  lines_angles_triangles: MATH("lines_angles_triangles", "각·평행선·삼각형 관계에서 구하는 각/길이", ["figure"], ["geometry_labels"], "도형 필수, 선·점·각 이름 ↔ 지문 일치, 방위 표현 금지, 직각은 수직 교점에서만", ["점 누락", "각 라벨 불일치", "방위 표현"]),
  right_triangles_trigonometry: MATH("right_triangles_trigonometry", "직각삼각형의 변·각·삼각비", ["figure"], ["geometry_labels"], "도형 필수, 변·각 라벨 ↔ 지문 일치", ["변 라벨 불일치"]),
  circles: MATH("circles", "원의 현·호·접선·중심각·방정식", ["figure", "equation", "graph"], ["geometry_labels", "plane_objects", "equation"], "중심·점·현·호 이름 ↔ 지문 일치, 등축", ["이름 불일치", "찌그러진 원"]),
};

export type ContractInput = {
  skillCode: string | null | undefined;
  examSystem: string | null | undefined;
  format: string;
  stimulus: string;
  question: string | null;
  options: string[] | null;
  correctIndex: number | null;
  answers: string[] | null;
  statements: string[] | null;
  explanation: string;
  figure: unknown | null;
  /** 2026-09-17 — boundaries/form_structure_sense 등 구조화 필드 스킬의 태그(grammar_rule 등). checkRwStructure의 구조적 구분에 쓰인다. */
  structuredTag?: string | null;
};

export type ContractResult = { ok: boolean; issues: FigureIssue[]; contract: QualityContract | null };

/** 숫자 토큰(1,200 / 3.5 / 12%) → 정규화 문자열. */
function numbersIn(text: string): string[] {
  return Array.from(text.matchAll(/-?\d[\d,]*(?:\.\d+)?/g)).map((m) => m[0].replace(/,/g, "")).filter((n) => n !== "");
}
function dataValues(figure: unknown): Set<string> {
  const out = new Set<string>();
  // 숫자 셀만 — 열 이름("2010")·범주 이름 같은 문자열은 근거 값이 아니다.
  const walk = (v: unknown) => {
    if (typeof v === "number") out.add(String(v));
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v as Record<string, unknown>).forEach(walk);
  };
  walk(figure);
  return out;
}

/**
 * 다섯 연결을 검사한다. 기존 검사(RW 구조·자료 참조·내용)를 그대로 쓰고, 유형별 연결 검사를 더한다.
 * 결과의 issues 가 비어 있어야 초안으로 저장한다.
 */
export function checkQualityContract(input: ContractInput): ContractResult {
  const contract = input.skillCode ? QUALITY_CONTRACTS[input.skillCode] ?? null : null;
  const issues: FigureIssue[] = [];
  const text = composeProblemText(input.stimulus, input.question);
  const opts = (input.options ?? []).map((o) => o.trim());
  const isMc = input.format === "mc";

  // 1. 질문 대상 — 질문이 있어야 한다(모든 유형).
  if (!input.question?.trim()) issues.push({ code: "contract_target", message: "질문이 없습니다 — 학생이 무엇을 판단·계산·선택해야 하는지 알 수 없습니다." });

  // 5. 답안 형식.
  if (isMc) {
    if (opts.length !== 4) issues.push({ code: "contract_format", message: `객관식은 선택지 4개(A~D)여야 합니다(지금 ${opts.length}개).` });
    if (input.correctIndex === null || input.correctIndex < 0 || input.correctIndex >= opts.length) issues.push({ code: "contract_format", message: "정답 자리가 선택지 범위 안에 없습니다." });
    if (opts.some((o) => !o)) issues.push({ code: "contract_format", message: "빈 선택지가 있습니다." });
  } else if (input.format === "spr") {
    if (!input.answers?.length) issues.push({ code: "contract_format", message: "SPR 정답 집합이 없습니다." });
  }
  if (contract && !contract.formats.includes(isMc ? (input.statements?.length ? "roman" : "mc") : (input.format as AnswerFormat))) {
    issues.push({ code: "contract_format", message: `${skillLabel(contract.skillCode)} 문항의 답안 형식(${input.format})이 계약과 맞지 않습니다.` });
  }

  // 2·3. 자료 근거와 표시 — 자료 판정·RW 구조·자료 참조 검사.
  const need = judgeMaterialNeed({ examSystem: input.examSystem ?? null, skillCode: input.skillCode ?? null, text });
  const blocker = materialBlocker(need, input.figure ?? null);
  if (blocker) issues.push({ code: "contract_evidence", message: blocker });
  issues.push(...checkRwStructure({ skillCode: input.skillCode ?? null, passage: text, options: input.options, figure: input.figure ?? null, structuredTag: input.structuredTag }).map((i) => ({ ...i, code: `contract_${i.code}` })));
  const fc = checkFigure(input.figure ?? null, text, input.options, input.correctIndex);
  issues.push(...fc.issues.map((i) => ({ ...i, code: `contract_${i.code}` })));
  // 내용(수식·선택지·진술·SPR 형식)은 RW 검사를 중복하지 않게 skillCode 없이.
  issues.push(...checkContent({ format: input.format, passage: text, options: input.options, correctIndex: input.correctIndex, explanation: input.explanation, answers: input.answers, statements: input.statements, skillCode: null, figure: input.figure ?? null }).map((i) => ({ ...i, code: `contract_${i.code}` })));

  // 유형별 추가 연결.
  const code = input.skillCode ? rwSkillCode(input.skillCode) ?? input.skillCode : null;
  const s = parseRwStimulus(text);
  if (code === "words_in_context") {
    const target = quotedTargetWord(s.question);
    if (target) {
      const body = input.stimulus;
      const re = new RegExp(`\\b${target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
      const n = (body.match(re) ?? []).length;
      if (n > 1) issues.push({ code: "contract_display", message: `인용 단어 “${target}” 가 지문에 ${n}번 나옵니다 — 학생이 어느 자리를 볼지 모호합니다. 한 번만 쓰세요.` });
    }
  }
  if (code === "rhetorical_synthesis" && isMc && input.correctIndex !== null && s.notes) {
    const notesText = s.notes.items.join(" ").toLowerCase();
    const words = (opts[input.correctIndex] ?? "").toLowerCase().match(/[a-z]{5,}/g) ?? [];
    const overlap = words.filter((w) => notesText.includes(w));
    if (words.length && overlap.length === 0) issues.push({ code: "contract_answer", message: "정답 선택지가 메모의 정보를 쓰지 않습니다 — 메모 ↔ 목표 ↔ 정답이 연결되어야 합니다." });
  }
  // 2026-09-18(hard 재검증에서 발견) — command_of_evidence_quant의 정답 수치 검증은 여기서 원래
  // "정확한 셀 값 하나"만 인정했다(dataValues는 파생 통계·차이값을 전혀 모른다). Step 6에서 훨씬
  // 정교한 전용 검증기(quant-evidence-check.ts — 행/열 합·최댓값·최솟값·차이까지 인정)가 생겼는데도
  // 이 구식 검사를 지우지 않아 둘이 같이 돌았다: DIFFERENCE 연산(예: "5.4→3.2는 2.2일 감소")처럼
  // quant-evidence-check.ts는 정확히 인정하는 정당한 정답을, 이 구식 검사가 먼저 "자료에 없는 수치"로
  // 오탐 거부해 pipeline.ts의 checkQuantEvidenceFields(2.4c)까지 가지도 못하고 걸렸다. command_of_
  // evidence_quant는 pipeline.ts에서 항상 이어서 checkQuantEvidenceFields를 돌리므로(다른 경로 없음),
  // 이 구식·더 좁은 검사는 지우고 전용 검증기에 맡긴다(검증 자체를 없앤 게 아니라 중복·열등한 쪽을 정리).
  const mathDataCodes = new Set(["one_variable_data", "two_variable_data", "probability", "percentages", "ratios_rates_units", "inference_margin_error"]);
  if (code && mathDataCodes.has(code) && input.figure && (input.figure as { type?: string }).type === "data") {
    // 질문·지문이 부르는 수치는 자료에 있어야 한다(연도·비율 등 파생 값은 제외 — 자료 값과 하나도 겹치지 않을 때만).
    const vals = dataValues(input.figure);
    const nums = numbersIn(input.stimulus).filter((n) => !/^(19|20)\d\d$/.test(n));
    if (nums.length >= 2 && !nums.some((n) => vals.has(n))) issues.push({ code: "contract_evidence", message: "지문의 수치가 표·그래프 자료의 값과 하나도 겹치지 않습니다 — 자료가 지문의 근거가 아닙니다." });
  }
  // 4. 정답 노출 — 객관식 정답 문구가 지문에 그대로 있으면(RW 완결 문장 선택지) 노출.
  if (isMc && input.correctIndex !== null && code && rwSkillCode(code) && !["words_in_context", "transitions", "boundaries", "form_structure_sense"].includes(code)) {
    const ans = opts[input.correctIndex] ?? "";
    if (ans.length >= 40 && input.stimulus.toLowerCase().includes(ans.toLowerCase().replace(/[.]$/, ""))) issues.push({ code: "contract_answer", message: "정답 선택지 문장이 지문에 그대로 들어 있습니다 — 정답 노출." });
  }

  // Bug A(2026-09-17) — 빈칸 완성형 선택지의 지문 축자 복제.
  if (isMc && code && VERBATIM_ECHO_SKILLS.has(code) && opts.length) {
    const echoIssue = findVerbatimEcho(input.stimulus, opts);
    if (echoIssue) issues.push(echoIssue);
  }
  // Bug B(2026-09-17) — transitions 선택지 구조 비대칭(정답만 문법 형태가 다름).
  if (isMc && code === "transitions" && opts.length) {
    issues.push(...checkTransitionParallelism(opts));
  }

  return { ok: issues.length === 0, issues: dedupeIssues(issues), contract };
}

// ---------------------------------------------------------------------------------- Bug A/B (2026-09-17 제품 오너 발견)
//
// 실제 배치에서 발견된 R&W 콘텐츠 결함 2건 — evidence-model-check 의 "AI 자기 보고를 신뢰하지 않고 문자열로
// 직접 확인" 원칙을 그대로 적용한다.
//
// Bug A — 빈칸 완성형(boundaries/form_structure_sense/transitions/inferences) 선택지가 지문에 이미 있는 문장을
// 그대로(정규화 허용) 복제한 사례(예: Sylvia Earle 지문). 학생이 문법·논리를 판단하지 않고 문자열 패턴매칭으로
// 답을 찾을 수 있게 되어 문항의 취지를 해친다. words_in_context(단어 하나)·command_of_evidence_text(인용이 곧
// 정답 근거이므로 축자 일치가 정상)는 대상에서 제외한다 — 그 두 유형은 지문 내용을 그대로 가리키는 것이 정답 구조다.
const VERBATIM_ECHO_SKILLS = new Set(["boundaries", "form_structure_sense", "transitions", "inferences"]);

function normalizeWords(s: string): string[] {
  return s
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

// 2026-09-18 — 제품 오너 지적 + 실측(25문항 실 파이프라인 배치, inferences/boundaries/
// form_structure_sense/transitions) 반영: 6단어는 "sellers ... in the early years of the ..."
// 같은 평범한 연결구까지 오탐으로 잡는다(관용구·전치사구는 지문·선택지가 같은 사건을 다루면 우연히도
// 자주 겹친다). 실제 결함 사례(Sylvia Earle, 정답 절 전체가 지문과 12단어 이상 동일)는 8단어로 올려도
// 여전히 걸린다. 8단어로 올려 "문장 하나를 통째로 복사"만 잡고 평범한 구 단위 겹침은 통과시킨다.
const ECHO_MIN_WORDS = 8;

/** 선택지 중 하나라도 지문과 8단어 이상 연속으로(정규화 허용) 겹치면 축자 복제로 본다. */
function findVerbatimEcho(passage: string, options: string[]): FigureIssue | null {
  const passageWords = normalizeWords(passage);
  if (passageWords.length < ECHO_MIN_WORDS) return null;
  const passageNgrams = new Set<string>();
  for (let i = 0; i <= passageWords.length - ECHO_MIN_WORDS; i += 1) {
    passageNgrams.add(passageWords.slice(i, i + ECHO_MIN_WORDS).join(" "));
  }
  for (const opt of options) {
    const optWords = normalizeWords(opt);
    if (optWords.length < ECHO_MIN_WORDS) continue;
    for (let i = 0; i <= optWords.length - ECHO_MIN_WORDS; i += 1) {
      const gram = optWords.slice(i, i + ECHO_MIN_WORDS).join(" ");
      if (passageNgrams.has(gram)) {
        return { code: "contract_option_echo", message: `선택지 "${opt.slice(0, 80)}" 가 지문에 이미 있는 문구("${gram}")를 ${ECHO_MIN_WORDS}단어 이상 그대로 복제했습니다 — 빈칸 완성형 선택지는 지문을 복사-붙여넣기 한 것이 아니라 직접 지어낸 문장이어야 합니다(패턴매칭으로 답을 찾을 수 없게).` };
      }
    }
  }
  return null;
}

// Bug B — transitions 문항의 선택지 4개가 서로 다른 문법 형태(예: 정답만 "Given these findings," 같은 분사구/전치사구,
// 나머지는 "Similarly,"/"For instance," 같은 단일 전환어)면 정답이 논리 관계가 아니라 형태만으로 드러난다. 실제
// SAT 전환어 문항의 표준 전환어/구 목록으로 화이트리스트를 두고, 거기 없으면서 지시어+명사(구체적 내용 지칭) 또는
// 4단어를 넘는 선택지를 구조 이질로 본다.
const TRANSITION_WHITELIST = new Set([
  "however", "similarly", "nevertheless", "for example", "for instance", "in fact", "consequently",
  "therefore", "thus", "moreover", "furthermore", "additionally", "in addition", "meanwhile",
  "in contrast", "on the other hand", "conversely", "likewise", "in other words", "as a result",
  "for this reason", "in short", "in summary", "specifically", "indeed", "still", "yet",
  "nonetheless", "accordingly", "hence", "otherwise", "by contrast", "in particular", "above all",
  "in conclusion", "first", "second", "finally", "alternatively", "granted", "admittedly",
]);

function normalizeTransition(o: string): string {
  return o.trim().replace(/,\s*$/, "").toLowerCase();
}

function checkTransitionParallelism(options: string[]): FigureIssue[] {
  const issues: FigureIssue[] = [];
  for (const o of options) {
    const norm = normalizeTransition(o);
    if (TRANSITION_WHITELIST.has(norm)) continue;
    const wordCount = norm.split(/\s+/).filter(Boolean).length;
    const hasDemonstrativeNoun = /\b(this|that|these|those)\s+\w+/i.test(o);
    if (hasDemonstrativeNoun || wordCount > 3) {
      issues.push({
        code: "contract_transition_parallel",
        message: `선택지 "${o}" 가 표준 전환어 목록에 없고 ${hasDemonstrativeNoun ? "지시어+명사로 구체적 내용을 지칭" : `${wordCount}단어로 다른 선택지보다 김`}합니다 — transitions 문항은 4개 선택지 모두 같은 문법 형태(짧은 전환어/구)여야 정답을 논리 관계로만 고를 수 있습니다.`,
      });
    }
  }
  return issues;
}

function dedupeIssues(list: FigureIssue[]): FigureIssue[] {
  const seen = new Set<string>();
  return list.filter((i) => { const k = `${i.code}|${i.message}`; if (seen.has(k)) return false; seen.add(k); return true; });
}

/** 문서·화면용 — 계약 요약. */
export function describeContract(skillCode: string | null | undefined): QualityContract | null {
  if (!skillCode) return null;
  return QUALITY_CONTRACTS[skillCode] ?? QUALITY_CONTRACTS[rwSkillCode(skillCode) ?? ""] ?? null;
}

export const CONTRACT_SKILL_CODES = Object.keys(QUALITY_CONTRACTS);
export function contractCoverageGaps(): string[] {
  return Array.from(SKILL_BY_CODE.keys()).filter((c) => !QUALITY_CONTRACTS[c]);
}
