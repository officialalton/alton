// 레시피 v3 로더·검증기(2026-10-01). v2 레시피 구조(id·instruction·beyondMedium·checklist·minMet)와 호환되며
// 문학 약한 유형용 확장 필드(근거 분산·오답 계획·금지 패턴·지문 단어 범위)를 추가로 검사한다.
import { readFileSync } from "node:fs";
import { effectiveRange, type WordRange } from "./passage-words";

export const DISTRACTOR_KINDS = ["partial_evidence", "passage_wording", "plausible_emotion", "reversed_cause", "overgeneralization"] as const;
export type RecipeV3 = {
  id: string;
  difficulty: "medium" | "hard";
  questionType: string;
  genres: string[];
  passageWords: WordRange;
  instruction: string;
  beyondMedium: string;
  checklist: string[];
  minMet: number;
  evidenceSpread: { minSpans: number; minSentenceGap: number; finalSentenceMustNotStateAnswer: boolean };
  distractorPlan: { id: string; kind: (typeof DISTRACTOR_KINDS)[number]; rule: string }[];
  bannedPatterns: string[];
  evidence: string[];
  officialDifficulty: string | null;
  difficultySource: string;
  /** v4(2026-10-01) 확장 필드 — v3 레시피에는 없다. */
  version?: 4;
  passageDesign?: { evidenceSites: string[]; directStatementBan: string; devices: string[] };
  answerDesign?: { inferenceSteps: number; combine: string };
  selfCheck?: string[];
};
export type RecipesV3 = Record<string, RecipeV3[]>;

export const loadRecipesV3 = (file = "data/mock-exam-generation/recipes-v3-literary.json"): RecipesV3 => {
  const raw = JSON.parse(readFileSync(file, "utf-8")) as Record<string, unknown>;
  const { _readme, ...rest } = raw;
  void _readme;
  return rest as RecipesV3;
};

export const RECIPES_V4_FILE = "data/mock-exam-generation/recipes-v4-literary-hard.json";

/** v3 + v4 를 합친 기본 레시피 집합. 같은 skill·유형·난이도에서 v4 가 앞에 와서(find 가 첫 항목을 고른다) 우선한다. */
export const loadRecipesAll = (v3File?: string, v4File = RECIPES_V4_FILE): RecipesV3 => {
  const merged: RecipesV3 = {};
  for (const [skill, list] of Object.entries(loadRecipesV3(v4File))) merged[skill] = [...list];
  for (const [skill, list] of Object.entries(loadRecipesV3(v3File))) merged[skill] = [...(merged[skill] ?? []), ...list];
  return merged;
};

/** 레시피 조회: 같은 skill·유형·난이도 중 v4 가 있으면 v4, 없으면 v3. */
export const findRecipe = (recipes: RecipesV3, skill: string, questionType: string, difficulty: "easy" | "medium" | "hard") =>
  (recipes[skill] ?? []).find((r) => r.questionType === questionType && r.difficulty === difficulty) ?? null;

export const LITERARY_QUESTION_TYPES = ["narrator_attitude", "main_idea_or_purpose", "character_motivation", "tone_or_mood", "relationship_between_characters", "symbolism", "figurative_language", "word_in_context", "tone_shift", "text_structure", "underlined_portion_function"] as const;

/** v4 문학 hard 레시피 추가 검증: v3 검증 + 11유형 전부·서로 다른 오독 경로 3개·추론 2단계 이상·자기 점검 질문. */
export function validateRecipesV4(recipes: RecipesV3, knownSkills?: string[]): string[] {
  const errs = validateRecipesV3(recipes, knownSkills);
  const all = Object.values(recipes).flat();
  for (const t of LITERARY_QUESTION_TYPES) if (!all.some((r) => r.questionType === t && r.difficulty === "hard")) errs.push(`${t}: v4 hard 레시피 없음`);
  for (const r of all) {
    const at = r.id;
    if (r.version !== 4) errs.push(`${at}: version 4 필요`);
    if (r.difficulty !== "hard") errs.push(`${at}: v4 파일은 hard 전용`);
    if (!r.id.endsWith("_hard_v4")) errs.push(`${at}: id 는 _hard_v4 로 끝나야 함`);
    if (new Set(r.distractorPlan?.map((d) => d.kind)).size !== 3) errs.push(`${at}: 오답 3개는 서로 다른 오독 경로(kind)여야 함`);
    if (!r.passageDesign || r.passageDesign.evidenceSites.length < 3 || !r.passageDesign.directStatementBan) errs.push(`${at}: passageDesign(근거 위치 3곳 이상·직접 서술 금지 범위)`);
    if (!r.answerDesign || r.answerDesign.inferenceSteps < 2 || !r.answerDesign.combine) errs.push(`${at}: answerDesign(추론 2단계 이상·결합)`);
    if (!Array.isArray(r.selfCheck) || r.selfCheck.length < 6) errs.push(`${at}: selfCheck 6개 이상`);
    if ((r.distractorPlan ?? []).some((d) => /always|never|절대어 를 쓴다/.test(d.rule))) errs.push(`${at}: 오답 규칙이 절대어 사용을 권함`);
  }
  return errs;
}

const REQUIRED_BANS = ["마지막 문장", "정반대"]; // 직접 생성 테스트의 두 가지 약점이 금지 패턴에 반드시 들어 있어야 한다.

/** 구조·정책 검사. 문제 목록(빈 배열이면 통과). */
export function validateRecipesV3(recipes: RecipesV3, knownSkills?: string[]): string[] {
  const errs: string[] = [];
  const ids = new Set<string>();
  for (const [skill, list] of Object.entries(recipes)) {
    if (knownSkills && !knownSkills.includes(skill)) errs.push(`${skill}: 알 수 없는 skill 코드`);
    if (!Array.isArray(list) || list.length === 0) errs.push(`${skill}: 레시피 없음`);
    for (const r of list) {
      const at = `${skill}/${r?.id}`;
      if (!r.id || typeof r.id !== "string") { errs.push(`${at}: id`); continue; }
      if (ids.has(r.id)) errs.push(`${at}: id 중복`);
      ids.add(r.id);
      if (!r.id.startsWith(`${skill}_`)) errs.push(`${at}: id 는 skill 코드로 시작해야 함`);
      if (!["medium", "hard"].includes(r.difficulty)) errs.push(`${at}: difficulty`);
      for (const f of ["instruction", "beyondMedium", "questionType", "difficultySource"] as const) if (typeof r[f] !== "string" || r[f].trim().length < 8) errs.push(`${at}: ${f} 필수`);
      if (!Array.isArray(r.checklist) || r.checklist.length < 3) errs.push(`${at}: checklist 3개 이상`);
      else if (!Number.isInteger(r.minMet) || r.minMet < 1 || r.minMet > r.checklist.length) errs.push(`${at}: minMet 범위`);
      else if (r.difficulty === "hard" && r.minMet < r.checklist.length - 1) errs.push(`${at}: hard 는 minMet ≥ 체크리스트 - 1`);
      try { effectiveRange(r.passageWords); if (r.passageWords.min > r.passageWords.max) errs.push(`${at}: passageWords`); } catch { errs.push(`${at}: passageWords 가 규격 60~220 과 겹치지 않음`); }
      const sp = r.evidenceSpread;
      if (!sp || sp.minSpans < 2) errs.push(`${at}: 근거는 2곳 이상 흩어져야 함(evidenceSpread.minSpans ≥ 2)`);
      else if (r.difficulty === "hard" && (sp.minSentenceGap < 2 || sp.minSpans < 2)) errs.push(`${at}: hard 는 근거 간격 2문장 이상`);
      if (!sp?.finalSentenceMustNotStateAnswer) errs.push(`${at}: 마지막 문장 재진술 금지 규칙 필요`);
      const dp = r.distractorPlan;
      if (!Array.isArray(dp) || dp.length !== 3) errs.push(`${at}: 오답 계획은 정확히 3개`);
      else {
        if (new Set(dp.map((d) => d.id)).size !== 3) errs.push(`${at}: 오답 계획 id 중복`);
        if (dp.some((d) => !DISTRACTOR_KINDS.includes(d.kind))) errs.push(`${at}: 오답 종류`);
        if (!dp.some((d) => d.kind === "partial_evidence" || d.kind === "passage_wording")) errs.push(`${at}: 오답 중 최소 하나는 지문 근거·표현을 활용해야 함`);
        if (dp.some((d) => /정반대|opposite mood|반대 분위기/.test(d.rule) && !/(쓰지 않|없)/.test(d.rule))) errs.push(`${at}: 분위기 정반대 오답 금지`);
      }
      for (const key of REQUIRED_BANS) if (!(r.bannedPatterns ?? []).some((b) => b.includes(key))) errs.push(`${at}: bannedPatterns 에 '${key}' 항목 필요`);
      if (!Array.isArray(r.genres) || r.genres.length === 0) errs.push(`${at}: genres`);
      // v2 호환: 기존 파이프라인이 읽는 필드가 모두 있는가
      for (const f of ["evidence", "officialDifficulty"] as const) if (!(f in r)) errs.push(`${at}: v2 필드 ${f} 누락`);
    }
  }
  return errs;
}

/** 생성 프롬프트에 넣는 레시피 블록. 문학 약한 유형은 이 블록 + 근거 분산 규칙을 같이 준다. */
export function recipePromptBlock(r: RecipeV3): string {
  return [
    `레시피(${r.id}, 난이도 ${r.difficulty}): ${r.instruction}`,
    `근거 분산: 정답을 뒷받침하는 단서를 서로 다른 ${r.evidenceSpread.minSpans}곳 이상(문장 간격 ${r.evidenceSpread.minSentenceGap} 이상)에 두고, 마지막 문장이 정답을 요약·재진술하지 않게 한다.`,
    `오답 설계: ${r.distractorPlan.map((d, i) => `(${i + 1}) ${d.rule}`).join(" ")}`,
    `금지: ${r.bannedPatterns.join(" / ")}`,
    `지문 길이: ${r.passageWords.min}~${r.passageWords.max}단어.`,
    ...(r.passageDesign ? [
      `지문 설계: 근거 위치 — ${r.passageDesign.evidenceSites.join(" / ")}. 직접 서술 금지 — ${r.passageDesign.directStatementBan}.`,
      `정답 설계: 추론 ${r.answerDesign?.inferenceSteps ?? 2}단계 — ${r.answerDesign?.combine ?? ""}. 오답 3개는 지문의 모든 명시 문장과 양립해야 하고(지문 사실과 충돌하는 오답 금지), 선택지 4개는 같은 문장틀·비슷한 길이로 쓴다.`,
    ] : []),
    ...(r.selfCheck?.length ? [`제출 전 자기 점검(하나라도 아니면 고쳐서 제출): ${r.selfCheck.map((q, i) => `(${i + 1}) ${q}`).join(" ")}`] : []),
  ].join("\n");
}
