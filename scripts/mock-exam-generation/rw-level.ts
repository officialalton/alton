// R&W easy/medium 보충 생성용 순수 헬퍼 (2026-10-01). batch-pipeline.ts cross --difficulty easy|medium 이 쓴다. API·DB 호출 없음.
export type Level = "easy" | "medium" | "hard";

/** easy/medium 공통 난이도 기준. hard 는 레시피(beyond medium)로 만든다. */
export const LEVEL_RULE: Record<"easy" | "medium", string> = {
  easy: "easy: 한 가지 명시적 개념·규칙만으로 푼다. 단서가 지문에 직접 드러나고 추론은 한 단계 이하이다. 어휘·문장은 평이하다. 오답 3개는 해당 규칙을 알면 바로 배제되지만 규칙을 모르는 학생에게는 그럴듯해 보이는 전형적 오개념이어야 한다(말도 안 되는 선택지 금지).",
  medium: "medium: 표준 SAT 중간 난이도. 두 단계 판단(규칙 적용 + 문맥 확인, 또는 두 정보의 연결)이 필요하다. 정답은 정독하면 명확하지만 훑어 읽으면 틀리게 설계한다. 오답 3개 중 최소 2개는 부분적으로 맞는 근거를 가져 비교해야만 배제되고, 나머지 하나도 말이 되어야 한다.",
};

export const SKILL_LEVEL_HINT: Record<string, Record<"easy" | "medium", string>> = {
  boundaries: {
    easy: "독립절 두 개 사이의 쉼표 스플라이스·접속사 유무, 또는 문장 끝 마침표·세미콜론 선택처럼 절 경계가 한눈에 보이는 문제. 선택지는 문장부호/접속 조합 4개.",
    medium: "삽입구·동격·긴 수식어 뒤에서 절 경계(콜론/대시/세미콜론/쉼표+등위접속사)를 판단하거나, 필수/비필수 수식어 쉼표를 가리는 문제. 선택지는 문장부호/접속 조합 4개.",
  },
  form_structure_sense: {
    easy: "수식어가 짧은 주어-동사 수 일치, 시제 일관성, 대명사 격/수 일치처럼 한 규칙을 묻는 문제.",
    medium: "긴 수식어구/도치 뒤의 주어-동사 일치, 병렬 구조, 수식어 위치(dangling modifier), 정동사 vs 분사/부정사 선택처럼 구조 파악이 필요한 문제.",
  },
  transitions: {
    easy: "두 문장 사이 관계(대조·추가·결과·예시)가 명시적 어휘 단서로 분명한 문제. 선택지는 서로 다른 관계를 나타내는 전환어 4개.",
    medium: "관계가 어휘 단서 없이 두 문장의 논리(양보 후 반전, 일반화 후 구체화, 원인 vs 결과 방향)에서 도출되는 문제. 오답 전환어도 일부 관계는 말이 된다.",
  },
  rhetorical_synthesis: {
    easy: "목표가 메모 1~2개와 직접 대응하는 문제(예: 한 대상 소개). 오답은 목표와 무관한 메모나 부정확한 진술.",
    medium: "목표(비교·대조·특징 강조 등)에 맞게 서로 다른 메모를 골라 결합해야 하는 문제. 오답은 정확한 메모를 쓰지만 목표에서 벗어난다.",
  },
};

export const levelInstruction = (skill: string, level: "easy" | "medium") => `- ${LEVEL_RULE[level]}\n- 세부 기술 힌트: ${SKILL_LEVEL_HINT[skill]?.[level] ?? "해당 skill 의 전형적 SAT 문항 형식을 따른다."}`;

export const TARGET_LETTERS = ["A", "B", "C", "D"] as const;

export type LevelCand = { cid: string; skill: string; system: "sat_rw"; method: string; recipeId: null; instruction: string; idx: number; difficulty: "easy" | "medium"; seed: string; targetLetter: string };

/** skill:개수 spec 으로 후보를 만든다. 정답 목표 위치는 후보 전체에서 A~D 순환(정답 위치 게이트), 소재 씨앗도 순환. */
export function buildLevelCands(level: "easy" | "medium", spec: Record<string, number>, seeds: string[], offset = 0): LevelCand[] {
  const out: LevelCand[] = [];
  for (const [skill, n] of Object.entries(spec)) {
    for (let i = offset; i < offset + n; i++) {
      out.push({
        cid: `${level}-${skill}-${String(i).padStart(2, "0")}`.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64), skill, system: "sat_rw", method: level, recipeId: null,
        instruction: levelInstruction(skill, level), idx: i, difficulty: level, seed: seeds[(out.length * 3 + i) % seeds.length], targetLetter: TARGET_LETTERS[(out.length + offset) % 4],
      });
    }
  }
  return out;
}

/** 오답 배제 게이트: 블라인드 풀이자가 '근거 없이 바로 지울 수 있다'고 본 오답 수의 상한(easy 3 = 제한 없음, medium 2 = 오답 1개 이상은 그럴듯해야 함). */
export const MAX_EASILY_ELIMINATED: Record<"easy" | "medium", number> = { easy: 3, medium: 2 };

export const HANGUL = /[가-힣ㄱ-ㅎㅏ-ㅣ]/;

/** 영어 해설 결정론 검사: 존재, 한글 없음, 3~6문장, 지나치게 짧지 않음. */
export function explanationEnIssues(en: string | undefined | null): string[] {
  const t = (en ?? "").trim();
  if (!t) return ["explanation_en_missing"];
  const issues: string[] = [];
  if (HANGUL.test(t)) issues.push("explanation_en_hangul");
  const sentences = t.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0).length;
  if (sentences < 3) issues.push("explanation_en_too_short");
  if (sentences > 8) issues.push("explanation_en_too_long");
  return issues;
}

export type LevelVerdictInput = { answerCorrect: boolean; explanationConsistent: boolean; formatOk: boolean; factualError: boolean; copyrightSuspect: boolean; explanationEnOk: boolean; levelVerdict: string; blindPicked: string; blindOtherDefensible: boolean; eliminated: number };
/** 단일 검수자의 easy/medium 판정. correct = 정답·해설·영어해설·형식, fit = 난이도 적합 + 오답 배제 게이트. */
export function levelVerdict(level: "easy" | "medium", correctLetter: string, v: LevelVerdictInput): { correct: boolean; fit: boolean } {
  const agree = v.blindPicked === correctLetter && !v.blindOtherDefensible;
  const correct = agree && v.answerCorrect && v.explanationConsistent && v.formatOk && !v.factualError && !v.copyrightSuspect && v.explanationEnOk;
  const fit = v.levelVerdict === "fits" && v.eliminated <= MAX_EASILY_ELIMINATED[level];
  return { correct, fit };
}
