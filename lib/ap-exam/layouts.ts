// AP 공식 섹션 구조(docs/ap/2027-exam-spec-table.md 가 단일 출처). 세트를 만들 때 mock_exam_sets.section_layout 으로 복사한다.
// 라벨 규칙: 공식 구조(문항 수·시간·계산기 파트)를 전부 갖춘 세트만 "Full Practice Exam", MC 만이면 "AP Multiple-Choice Practice", FRQ 만이면 "AP Free-Response Practice".
// AP 1~5 환산 점수는 표시하지 않는다(검증 계획 승인 전).

export type ApCalculator = "allowed" | "not_allowed" | "required" | "na";
export type ApSection = { key: string; kind: "mc" | "frq"; label: string; minutes: number; count: number; calculator: ApCalculator; options?: 4 | 5 };
export type ApSetLabel = "full_practice" | "mc_practice" | "frq_practice";

const s = (key: string, kind: "mc" | "frq", label: string, minutes: number, count: number, calculator: ApCalculator, options?: 4 | 5): ApSection => ({ key, kind, label, minutes, count, calculator, ...(options ? { options } : {}) });

const CALC = [
  s("ap_mc_a", "mc", "Section I, Part A: Multiple Choice (no calculator)", 62, 29, "not_allowed", 4),
  s("ap_mc_b", "mc", "Section I, Part B: Multiple Choice (graphing calculator required)", 38, 13, "required", 4),
  s("ap_frq_a", "frq", "Section II, Part A: Free Response (calculator)", 30, 2, "allowed"),
  s("ap_frq_b", "frq", "Section II, Part B: Free Response (no calculator)", 60, 4, "not_allowed"),
];
const PHYS_42 = [s("ap_mc", "mc", "Section I: Multiple Choice", 85, 42, "allowed", 4), s("ap_frq", "frq", "Section II: Free Response", 95, 4, "allowed")];
export const AP_LAYOUTS: Record<string, ApSection[]> = {
  ap_calculus_ab: CALC,
  ap_calculus_bc: CALC,
  ap_biology: [s("ap_mc", "mc", "Section I: Multiple Choice", 90, 60, "allowed", 4), s("ap_frq", "frq", "Section II: Free Response", 90, 6, "allowed")],
  ap_microeconomics: [s("ap_mc", "mc", "Section I: Multiple Choice", 70, 60, "allowed", 5), s("ap_frq", "frq", "Section II: Free Response (includes 10 minutes of reading)", 60, 3, "allowed")],
  ap_macroeconomics: [s("ap_mc", "mc", "Section I: Multiple Choice", 70, 60, "allowed", 5), s("ap_frq", "frq", "Section II: Free Response (includes 10 minutes of reading)", 60, 3, "allowed")],
  ap_statistics: [s("ap_mc", "mc", "Section I: Multiple Choice", 90, 42, "allowed", 4), s("ap_frq", "frq", "Section II: Free Response", 90, 4, "allowed")],
  ap_chemistry: [s("ap_mc", "mc", "Section I: Multiple Choice", 90, 60, "allowed", 4), s("ap_frq", "frq", "Section II: Free Response", 105, 7, "allowed")],
  ap_physics_1: [s("ap_mc", "mc", "Section I: Multiple Choice", 85, 42, "allowed", 4), s("ap_frq", "frq", "Section II: Free Response", 95, 4, "allowed")],
  ap_computer_science_a: [s("ap_mc", "mc", "Section I: Multiple Choice", 90, 42, "na", 4), s("ap_frq", "frq", "Section II: Free Response", 90, 4, "na")],
  ap_english_language: [s("ap_mc", "mc", "Section I: Multiple Choice", 60, 45, "na", 4), s("ap_frq", "frq", "Section II: Free Response (3 essays)", 135, 3, "na")],
  // Literature: CED(Fall 2024) Exam Overview p.133 + AP Central 시험 페이지 — MC 55 / 60분(4지선다, 지문 5묶음 8~13문항), FRQ 3 / 2시간(시 분석·산문 분석·문학 논증 각 6점). 완전 디지털. 계산기 없음.
  ap_english_literature: [s("ap_mc", "mc", "Section I: Multiple Choice", 60, 55, "na", 4), s("ap_frq", "frq", "Section II: Free Response (3 essays)", 120, 3, "na")],
  // Psychology: CED effective Fall 2025 (Exam Overview p.147-149) — 75 MC / 90 min (4 options, discrete + set-based), 2 FRQ / 70 min (Article Analysis 25 min incl. 10 min reading + Evidence-Based 45 min incl. 15 min reading). No calculator mentioned.
  // US History: CED(effective Fall 2026) p.497 — MC 55/55분(4지선다, 3–4문항 세트), SAQ 3/40분, DBQ 60분(읽기 15 포함)+LEQ 40분 = Section II 100분. 계산기 없음. 완전 디지털.
  // World History: CED(effective Fall 2026) Exam Information p.195-198 — MC 55/55분(4지선다, 3–4문항 세트), SAQ 3/40분, DBQ 60분(읽기 15 포함)+LEQ 40분 = Section II 100분. 계산기 없음. 완전 디지털.
  ap_world_history: [s("ap_mc", "mc", "Section I, Part A: Multiple Choice", 55, 55, "na", 4), s("ap_saq", "frq", "Section I, Part B: Short Answer", 40, 3, "na"), s("ap_frq", "frq", "Section II: Document-Based Question and Long Essay", 100, 2, "na")],
  ap_us_history: [s("ap_mc", "mc", "Section I, Part A: Multiple Choice", 55, 55, "na", 4), s("ap_saq", "frq", "Section I, Part B: Short Answer", 40, 3, "na"), s("ap_frq", "frq", "Section II: Document-Based Question and Long Essay", 100, 2, "na")],
  ap_psychology: [s("ap_mc", "mc", "Section I: Multiple Choice", 90, 75, "na", 4), s("ap_frq", "frq", "Section II: Free Response (Article Analysis + Evidence-Based)", 70, 2, "na")],
  // ── 2026-10-20 추가 10과목(출처·검증 수준: data/ap/curriculum-2027/<code>.json designNotes, docs/ap/new-subjects-plan-2026-10-20.md) ──
  // Physics 2 · Physics C: E&M — CED(Fall 2026 판) Exam Overview: MC 42 / 85분, FRQ 4(MR 10·TBR 12·EDA 10·QQT 8점) / 95분, 계산기 두 섹션 허용. Physics C: Mechanics 는 CED 전문을 읽지 못해 동일 형식을 인용(VERIFY).
  ap_physics_2: PHYS_42,
  ap_physics_c_mechanics: PHYS_42,
  ap_physics_c_electricity_and_magnetism: PHYS_42,
  // Environmental Science — AP Central 시험 페이지: 완전 디지털, MC 80 / 90분, FRQ 3 / 70분, 계산기 허용. 선택지 수 4는 UNVERIFIED.
  ap_environmental_science: [s("ap_mc", "mc", "Section I: Multiple Choice", 90, 80, "allowed", 4), s("ap_frq", "frq", "Section II: Free Response", 70, 3, "allowed")],
  // US Gov — CED(2026): MC 55 / 80분, FRQ 4 (개념 적용 3점·정량 분석 4점·SCOTUS 비교 4점·논증 에세이 6점) / 100분. 계산기 언급 없음.
  ap_us_government_and_politics: [s("ap_mc", "mc", "Section I: Multiple Choice", 80, 55, "na", 4), s("ap_frq", "frq", "Section II: Free Response", 100, 4, "na")],
  // Comparative Gov — CED(2026): MC 55 / 60분, FRQ 4 (개념 4점·정량 5점·비교 5점·논증 5점) / 90분. 계산기 언급 없음.
  ap_comparative_government_and_politics: [s("ap_mc", "mc", "Section I: Multiple Choice", 60, 55, "na", 4), s("ap_frq", "frq", "Section II: Free Response", 90, 4, "na")],
  // Human Geography — CED(posted 2020) + AP Central 시험 페이지: 완전 디지털, MC 60 / 60분, FRQ 3(각 7점) / 75분. 선택지 수 5는 게시된 CED 샘플 근거(2027 확인 필요).
  ap_human_geography: [s("ap_mc", "mc", "Section I: Multiple Choice", 60, 60, "na", 5), s("ap_frq", "frq", "Section II: Free Response", 75, 3, "na")],
  // CS Principles — CED(2023) Exam Overview: MC 70 / 120분(4지선다, 다중 선택 8문항 포함), 작성형 2문항(WR1·2a·2b·2c) / 60분. Create 수행평가(9시간+, 30%)는 시험 당일 레이아웃 밖이다.
  ap_computer_science_principles: [s("ap_mc", "mc", "Section I: Multiple Choice", 120, 70, "na", 4), s("ap_frq", "frq", "Section II: Written Response (about your Create performance task)", 60, 2, "na")],
  // European History — CED(2026): MC 55 / 55분, SAQ 3 / 40분, DBQ 60분(읽기 15 포함) + LEQ 40분 = 100분. 계산기 없음. 완전 디지털.
  ap_european_history: [s("ap_mc", "mc", "Section I, Part A: Multiple Choice", 55, 55, "na", 4), s("ap_saq", "frq", "Section I, Part B: Short Answer", 40, 3, "na"), s("ap_frq", "frq", "Section II: Document-Based Question and Long Essay", 100, 2, "na")],
  // Precalculus — CED(effective Fall 2026): MC 42 (파트 A 29·65분 계산기 불가 / 파트 B 13·40분 그래핑 필수), FRQ 4 (파트 A 2·35분 계산기 / 파트 B 2·35분 불가, 각 6점).
  ap_precalculus: [
    s("ap_mc_a", "mc", "Section I, Part A: Multiple Choice (no calculator)", 65, 29, "not_allowed", 4),
    s("ap_mc_b", "mc", "Section I, Part B: Multiple Choice (graphing calculator required)", 40, 13, "required", 4),
    s("ap_frq_a", "frq", "Section II, Part A: Free Response (graphing calculator required)", 35, 2, "required"),
    s("ap_frq_b", "frq", "Section II, Part B: Free Response (no calculator)", 35, 2, "not_allowed"),
  ],
};

export function apSectionLayout(subject: string): ApSection[] {
  const l = AP_LAYOUTS[subject];
  if (!l) throw new Error(`No AP exam layout for ${subject}`);
  return l;
}

/** 시험 화면·목록에 쓰는 영어 라벨. */
export const AP_LABEL_TEXT: Record<ApSetLabel, string> = {
  full_practice: "Full Practice Exam",
  mc_practice: "AP Multiple-Choice Practice",
  frq_practice: "AP Free-Response Practice",
};

export const AP_SUBJECT_NAME: Record<string, string> = {
  ap_calculus_ab: "AP Calculus AB", ap_calculus_bc: "AP Calculus BC", ap_biology: "AP Biology", ap_microeconomics: "AP Microeconomics",
  ap_macroeconomics: "AP Macroeconomics", ap_statistics: "AP Statistics", ap_chemistry: "AP Chemistry", ap_physics_1: "AP Physics 1",
  ap_computer_science_a: "AP Computer Science A", ap_english_language: "AP English Language", ap_english_literature: "AP English Literature", ap_psychology: "AP Psychology", ap_us_history: "AP U.S. History", ap_world_history: "AP World History: Modern",
  ap_physics_2: "AP Physics 2", ap_physics_c_mechanics: "AP Physics C: Mechanics", ap_physics_c_electricity_and_magnetism: "AP Physics C: Electricity and Magnetism",
  ap_environmental_science: "AP Environmental Science", ap_us_government_and_politics: "AP United States Government and Politics",
  ap_comparative_government_and_politics: "AP Comparative Government and Politics", ap_human_geography: "AP Human Geography",
  ap_computer_science_principles: "AP Computer Science Principles", ap_european_history: "AP European History", ap_precalculus: "AP Precalculus",
};

/** 2026-10-20 추가 10과목(영구 목록). */
export const AP_NEW_SUBJECTS: readonly string[] = [
  "ap_physics_2", "ap_physics_c_mechanics", "ap_physics_c_electricity_and_magnetism", "ap_environmental_science", "ap_us_government_and_politics",
  "ap_comparative_government_and_politics", "ap_human_geography", "ap_computer_science_principles", "ap_european_history", "ap_precalculus",
];
/** 신규 과목 중 세트가 공개돼 공개 과목 페이지·/practice-tests 목록·sitemap·랜딩에 노출하는 과목. 과목의 첫 세트를 공개할 때 총괄이 여기에 한 줄 추가한다(그 밖의 코드 변경 없음). */
export const AP_NEW_SUBJECTS_PUBLIC: readonly string[] = ["ap_physics_c_mechanics", "ap_physics_c_electricity_and_magnetism", "ap_precalculus"];
/** 아직 공개하지 않는 신규 과목(자동 계산: AP_NEW_SUBJECTS − AP_NEW_SUBJECTS_PUBLIC). */
export const AP_PENDING_PUBLIC_SUBJECTS: readonly string[] = AP_NEW_SUBJECTS.filter((c) => !AP_NEW_SUBJECTS_PUBLIC.includes(c));
export const isApPublicSubject = (code: string) => !AP_PENDING_PUBLIC_SUBJECTS.includes(code);

/** 신규 10과목 FRQ(서술형) 유형 — 공식 CED 의 문항 유형 이름·배점. points=null 은 이 조사에서 공식 값을 확인하지 못한 항목이다(지어내지 않는다). */
export type ApFrqType = { key: string; label: string; points: number | null };
const PHYS_FRQ = (mr: number | null, tbr: number | null, eda: number | null, qqt: number | null): ApFrqType[] => [
  { key: "mr", label: "Mathematical Routines", points: mr }, { key: "tbr", label: "Translation Between Representations", points: tbr },
  { key: "eda", label: "Experimental Design and Analysis", points: eda }, { key: "qqt", label: "Qualitative/Quantitative Translation", points: qqt },
];
export const AP_NEW_SUBJECT_FRQ_TYPES: Record<string, ApFrqType[]> = {
  ap_physics_2: PHYS_FRQ(10, 12, 10, 8),
  ap_physics_c_electricity_and_magnetism: PHYS_FRQ(10, 12, 10, 8),
  ap_physics_c_mechanics: PHYS_FRQ(null, null, null, null),
  ap_environmental_science: [
    { key: "design", label: "Design an investigation", points: null }, { key: "data", label: "Analyze and interpret quantitative data", points: null },
    { key: "calc", label: "Analyze an environmental problem using calculations", points: null },
  ],
  ap_us_government_and_politics: [
    { key: "concept", label: "Concept Application", points: 3 }, { key: "quant", label: "Quantitative Analysis", points: 4 },
    { key: "scotus", label: "SCOTUS Comparison", points: 4 }, { key: "argument", label: "Argument Essay", points: 6 },
  ],
  ap_comparative_government_and_politics: [
    { key: "conceptual", label: "Conceptual Analysis", points: 4 }, { key: "quant", label: "Quantitative Analysis", points: 5 },
    { key: "comparative", label: "Comparative Analysis", points: 5 }, { key: "argument", label: "Argument Essay", points: 5 },
  ],
  ap_human_geography: [
    { key: "frq1", label: "Free response without stimulus", points: 7 }, { key: "frq2", label: "Free response with one stimulus", points: 7 },
    { key: "frq3", label: "Free response with two stimuli", points: 7 },
  ],
  ap_computer_science_principles: [
    { key: "wr1", label: "Written Response 1", points: null }, { key: "wr2a", label: "Written Response 2(a)", points: null },
    { key: "wr2b", label: "Written Response 2(b)", points: null }, { key: "wr2c", label: "Written Response 2(c)", points: null },
  ],
  ap_european_history: [
    { key: "saq_secondary", label: "Short answer: secondary source", points: 3 }, { key: "saq_primary", label: "Short answer: primary source", points: 3 },
    { key: "saq_nontext", label: "Short answer: primary or secondary non-text source", points: 3 },
    { key: "dbq", label: "Document-Based Question", points: 7 }, { key: "leq", label: "Long Essay Question", points: 6 },
  ],
  ap_precalculus: [
    { key: "frq1", label: "Function Concepts", points: 6 }, { key: "frq2", label: "Modeling a Non-Periodic Context", points: 6 },
    { key: "frq3", label: "Modeling a Periodic Context", points: 6 }, { key: "frq4", label: "Symbolic Manipulations", points: 6 },
  ],
};

/** 라벨이 요구하는 섹션(조립이 채워야 할 섹션). */
export function sectionsForLabel(subject: string, label: ApSetLabel): ApSection[] {
  const l = apSectionLayout(subject);
  return label === "full_practice" ? l : l.filter((x) => x.kind === (label === "mc_practice" ? "mc" : "frq"));
}

export const CALCULATOR_TEXT: Record<ApCalculator, string> = {
  allowed: "Calculator allowed", not_allowed: "No calculator", required: "Graphing calculator required", na: "",
};
export function totalMinutes(subject: string, label: ApSetLabel): number {
  return sectionsForLabel(subject, label).reduce((a, x) => a + x.minutes, 0);
}

// ── 부분 연습 세트(첫 제품 형태) ────────────────────────────────────────────
// 공식 파트의 문항 수와 시간을 전부 채운 경우에만 "파트 A/B 모의 연습"으로 이름 붙일 수 있다. 현재 재고를 완전한 모의고사로 부르지 않는다(full_practice 는 모든 섹션 충족 때만).
// DB 라벨은 기존 3종(mc_practice|frq_practice)을 그대로 쓴다: 세트의 section_layout 에 해당 파트 섹션만 담고 공개 게이트가 그 섹션의 공식 문항 수를 강제한다.
export type ApPartialId = "noncalc_mc" | "calc_mc" | "frq";
export const AP_PARTIALS: Record<ApPartialId, { label: ApSetLabel; nameSuffix: string; sectionKeys: string[] }> = {
  noncalc_mc: { label: "mc_practice", nameSuffix: "Non-Calculator Practice", sectionKeys: ["ap_mc_a"] },
  calc_mc: { label: "mc_practice", nameSuffix: "Calculator Practice", sectionKeys: ["ap_mc_b"] },
  frq: { label: "frq_practice", nameSuffix: "Free-Response Practice", sectionKeys: ["ap_frq_a", "ap_frq_b"] },
};
/** 부분 세트가 정의되는 과목: 계산기 파트가 나뉜 AB·BC. */
export const AP_PARTIAL_SUBJECTS = ["ap_calculus_ab", "ap_calculus_bc"];
export function partialSetName(subject: string, id: ApPartialId, seq?: number): string {
  return `${AP_SUBJECT_NAME[subject] ?? subject} — ${AP_PARTIALS[id].nameSuffix}${seq && seq > 1 ? ` ${seq}` : ""}`;
}
/** 부분 세트 표시 정책(오너 2026-10-09): 제목·배지·시작 안내가 같은 의미를 전달한다. FRQ 세트도 계산기 사용을 함께 표시한다. UI 는 이 상수를 그대로 쓴다. */
export const AP_PARTIAL_CALCULATOR_NOTE: Record<ApPartialId, string> = {
  noncalc_mc: "No calculator allowed",
  calc_mc: "Graphing calculator required",
  frq: "Part A: calculator allowed · Part B: no calculator",
};
/** 제목(partialSetName) 옆 배지 문구: 예) "No calculator allowed". */
export const partialBadge = (id: ApPartialId) => AP_PARTIAL_CALCULATOR_NOTE[id];
/** 시작 안내 문장(영어): 제목·배지와 같은 의미를 반복한다. */
export function partialStartGuidance(subject: string, id: ApPartialId): string {
  const secs = sectionsForPartial(subject, id); const q = secs.reduce((a, x) => a + x.count, 0); const min = secs.reduce((a, x) => a + x.minutes, 0);
  return `${partialSetName(subject, id)}: ${q} ${id === "frq" ? "free-response questions" : "multiple-choice questions"}, ${min} minutes. ${AP_PARTIAL_CALCULATOR_NOTE[id]}. This is a practice section, not a full practice exam.`;
}
/** "Full Practice Exam" 라벨은 공식 구성(문항 수·시간·계산기 파트·단원·스킬 비중 범위 + 내부 다양성 조건; 공식은 단원별 고정 문항 수를 정하지 않는다)을 만족한 세트에만 붙인다. 만족하지 않으면 항상 false. */
export const fullPracticeLabelAllowed = (officialCompositionSatisfied: boolean) => officialCompositionSatisfied === true;
export function sectionsForPartial(subject: string, id: ApPartialId): ApSection[] {
  if (!AP_PARTIAL_SUBJECTS.includes(subject)) throw new Error(`No partial practice sets for ${subject}`);
  return apSectionLayout(subject).filter((x) => AP_PARTIALS[id].sectionKeys.includes(x.key));
}
/** 파트 라벨 허용 조건: 채운 문항 수가 포함 섹션의 공식 문항 수와 정확히 같을 때만(시간은 공식 값을 복사하므로 항상 일치). */
export function partialLabelAllowed(subject: string, id: ApPartialId, filled: Record<string, number>): boolean {
  return sectionsForPartial(subject, id).every((sec) => filled[sec.key] === sec.count);
}

// ── 표시 문구(제목·배지·시작 안내가 같은 뜻을 전한다) ────────────────────────────────
export type LayoutLike = { key: string; kind?: "mc" | "frq"; count: number; minutes: number; calculator?: ApCalculator }[];
const sameKeys = (a: string[], b: string[]) => a.length === b.length && a.every((k) => b.includes(k));
/** 세트 레이아웃이 부분 연습 정의(파트 A MC / 파트 B MC / FRQ)와 정확히 같은 섹션 구성이면 그 부분 id, 아니면 null. */
export function apPartialOfLayout(layout: LayoutLike | null | undefined): ApPartialId | null {
  if (!layout?.length) return null;
  const keys = layout.map((s) => s.key);
  const exact = (Object.keys(AP_PARTIALS) as ApPartialId[]).find((id) => sameKeys(keys, AP_PARTIALS[id].sectionKeys));
  if (exact) return exact;
  // 짧은 FRQ 연습 세트(2~4 묶음): FRQ 섹션 키의 부분집합이면 Free-Response 부분 세트
  if (keys.every((k) => AP_PARTIALS.frq.sectionKeys.includes(k))) return "frq";
  return null;
}
/** 공식 풀 구성(모든 공식 섹션이 공식 문항 수·시간으로 존재)일 때만 true. */
export function isOfficialFullLayout(subject: string | null | undefined, layout: LayoutLike | null | undefined): boolean {
  if (!subject || !layout?.length || !AP_LAYOUTS[subject]) return false;
  const off = AP_LAYOUTS[subject];
  return layout.length === off.length && off.every((o) => layout.some((s) => s.key === o.key && s.count === o.count && s.minutes === o.minutes));
}
/** 목록·응시·결과 화면의 배지. 부분 연습이면 파트 배지, 풀 구성이 확인될 때만 "Full Practice Exam". 레이아웃을 모르면 풀 시험이라고 말하지 않는다. */
/** 세트 이름이 정확히 "<과목> — <부분 연습 이름>" 이면 그 부분 id. 섹션 구성을 못 받은 경우(요약 행·구버전 응답)의 보조 판별이다. */
export function apPartialOfName(subject: string | null | undefined, name: string | null | undefined): ApPartialId | null {
  if (!subject || !name || !AP_PARTIAL_SUBJECTS.includes(subject)) return null;
  return (Object.keys(AP_PARTIALS) as ApPartialId[]).find((id) => name.replace(/\s+\d+$/, "") === partialSetName(subject, id)) ?? null;
}
export function apBadgeText(o: { subject?: string | null; label?: ApSetLabel | null; layout?: LayoutLike | null; name?: string | null }): string {
  const partial = apPartialOfLayout(o.layout) ?? (o.layout?.length ? null : apPartialOfName(o.subject, o.name));
  if (partial && AP_PARTIAL_SUBJECTS.includes(o.subject ?? "")) return AP_PARTIALS[partial].nameSuffix;
  if (o.label === "full_practice") return isOfficialFullLayout(o.subject, o.layout) ? AP_LABEL_TEXT.full_practice : "Practice Set";
  return o.label ? AP_LABEL_TEXT[o.label] : "Practice Set";
}
const CALC_RULE: Record<ApCalculator, string> = { allowed: "Calculator allowed.", not_allowed: "No calculator is allowed.", required: "A graphing calculator is required.", na: "" };
/** 시작 안내(영어): 파트·계산기 규칙·문항 수·시간. 값은 세트 레이아웃(공식 복사본)에서 읽는다. */
export function apGuidanceLines(o: { subject?: string | null; layout?: (LayoutLike[number] & { label?: string })[] | null; name?: string | null }): string[] {
  const byName = o.layout?.length ? null : apPartialOfName(o.subject, o.name);
  const layout = o.layout?.length ? o.layout : byName ? sectionsForPartial(o.subject as string, byName) : []; if (!layout.length) return [];
  const partial = apPartialOfLayout(layout); const exam = AP_SUBJECT_NAME[o.subject ?? ""] ?? "AP";
  const secOf = (k: string) => layout.find((s) => s.key === k);
  if (partial === "noncalc_mc" || partial === "calc_mc") {
    const s = layout[0]; const part = partial === "noncalc_mc" ? "Part A" : "Part B";
    return [`Practice for ${exam} Section I, ${part}: ${s.count} multiple-choice questions in ${s.minutes} minutes. ${CALC_RULE[s.calculator ?? "na"]}`.trim()];
  }
  if (partial === "frq") {
    const a = secOf("ap_frq_a"), b = secOf("ap_frq_b");
    const n = (a?.count ?? 0) + (b?.count ?? 0), mins = (a?.minutes ?? 0) + (b?.minutes ?? 0);
    const official = a?.count === 2 && b?.count === 4;
    const calc = (x: { calculator?: ApCalculator }) => (x.calculator === "not_allowed" ? "no calculator" : "calculator allowed");
    const q = (x: { count: number }) => `${x.count} question${x.count === 1 ? "" : "s"}`;
    if (official) return [
      `Practice for ${exam} Section II: ${n} free-response questions in ${mins} minutes.`,
      `Part A (${q(a!)}, ${a!.minutes} min): ${calc(a!)}. Part B (${q(b!)}, ${b!.minutes} min): ${calc(b!)}.`,
    ];
    // 짧은 연습 세트: 공식 Part A/B 로 보이지 않게 "Practice Section" 으로 부른다.
    const secs = [a, b].filter(Boolean) as { count: number; minutes: number; calculator?: ApCalculator }[];
    return [
      `Free-response practice: ${n} question${n === 1 ? "" : "s"} in ${mins} minutes. This is a shorter set, not the official ${exam} Section II (6 questions, 90 minutes).`,
      secs.map((x, i) => `Practice Section${secs.length > 1 ? ` ${i + 1}` : ""} (${q(x)}, ${x.minutes} min): ${calc(x)}.`).join(" "),
    ];
  }
  return layout.map((s) => `${(s as { label?: string }).label ?? s.key}: ${s.count} questions · ${s.minutes} min${CALC_RULE[s.calculator ?? "na"] ? ` · ${CALC_RULE[s.calculator ?? "na"].replace(/\.$/, "")}` : ""}`);
}

// ── 다루는 단원 안내(부분 세트는 과목 전체가 아니라 일부 단원만 다룬다) ─────────────────────────
/** sat_domain("ap:4.3") 목록 → 정렬된 단원 번호("4"). */
export function apUnitsFromDomains(domains: (string | null | undefined)[]): string[] {
  return [...new Set(domains.map((d) => /^ap:U?(\d+)\./.exec(d ?? "")?.[1]).filter((u): u is string => !!u))].sort((a, b) => Number(a) - Number(b));
}
const unitList = (u: string[]) => (u.length === 1 ? `Unit ${u[0]}` : `Units ${u.join(", ")}`);
/** 시작·결과 화면의 단원 안내. 공식 풀 구성에는 붙이지 않는다. 내부의 단원 불균형은 UI 에 "전범위 커버"로 주장하지 않는다. */
export function apCoverageLines(o: { subject?: string | null; units?: string[] | null; layout?: LayoutLike | null; name?: string | null; label?: ApSetLabel | null; result?: boolean }): string[] {
  const units = o.units ?? []; if (!units.length) return [];
  if (o.label === "full_practice" && isOfficialFullLayout(o.subject, o.layout)) return [];
  const exam = AP_SUBJECT_NAME[o.subject ?? ""] ?? "AP";
  return [
    `Covers ${unitList(units)}.`,
    o.result
      ? `Your result reflects only ${units.length === 1 ? "this unit" : "these units"}. It is not a measure of your achievement across the whole ${exam} course.`
      : `This practice set covers only ${units.length === 1 ? "this unit" : "these units"}, so a result on it should not be read as achievement across the whole ${exam} course.`,
  ];
}

/** 짧은 FRQ 연습 세트(공식 6문항·Part A 2 + Part B 4 가 아닌 구성)인가. */
export function isShortFrqLayout(layout: LayoutLike | null | undefined): boolean {
  if (apPartialOfLayout(layout) !== "frq") return false;
  const a = layout!.find((x) => x.key === "ap_frq_a"), b = layout!.find((x) => x.key === "ap_frq_b");
  return !(a?.count === 2 && b?.count === 4);
}
/** 응시 화면 섹션 탭 이름. 짧은 FRQ 연습 세트는 공식 "Part A/B" 로 보이지 않게 "Practice Section: Free Response (…)" 로 보인다(공식 풀 시험은 DB 라벨 그대로). */
export function apSectionDisplayLabel(sec: { key: string; label: string; calculator?: ApCalculator }, layout: LayoutLike | null | undefined): string {
  if (!isShortFrqLayout(layout)) return sec.label;
  const idx = layout!.findIndex((x) => x.key === sec.key);
  const calc = sec.calculator === "not_allowed" ? "no calculator" : "calculator allowed";
  return `Practice Section${layout!.length > 1 ? ` ${idx + 1}` : ""}: Free Response (${calc})`;
}
