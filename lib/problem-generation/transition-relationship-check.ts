// 2026-09-17 — transitions(전환어) 논리 관계 결정적 검증기.
//
// checkTransitionParallelism(problem-quality-contract.ts, 2026-09-17 이전 수정)은 선택지들이 "같은 문법
// 형태(짧은 전환어/구)"인지만 본다 — 표면 형태 검사다. 여기서는 그 다음 층인 "의미" 를 검사한다: 두 문장
// 사이에 실제로 성립하는 논리 관계(고정 taxonomy)를 정답에 태그로 달게 하고, 그 태그의 카테고리에 정답
// 전환어가 실제로 속하는지, 오답들의 전환어는 다른 카테고리에 속하는지(=오답이 "틀린 논리 관계를 신호하기
// 때문에" 틀리다는 것)를 자기보고가 아니라 카테고리→단어 매핑으로 직접 확인한다.
export const TRANSITION_RELATIONSHIPS = ["CONTRAST", "CAUSE_EFFECT", "ADDITION", "EXAMPLE", "CONCESSION"] as const;
export type TransitionRelationship = (typeof TRANSITION_RELATIONSHIPS)[number];

export const TRANSITIONS_SKILLS = ["transitions"] as const;
export type TransitionsSkill = (typeof TRANSITIONS_SKILLS)[number];

export function isTransitionsSkill(skillCode: string | null | undefined): skillCode is TransitionsSkill {
  return Boolean(skillCode) && (TRANSITIONS_SKILLS as readonly string[]).includes(skillCode as string);
}

/** 카테고리 → 표준 전환어/구 목록. problem-quality-contract.ts의 TRANSITION_WHITELIST를 논리 관계별로 분류한 것. */
export const CATEGORY_WORDS: Record<TransitionRelationship, readonly string[]> = {
  CONTRAST: ["however", "in contrast", "on the other hand", "conversely", "by contrast", "yet"],
  CONCESSION: ["nevertheless", "nonetheless", "granted", "admittedly", "still", "even so"],
  CAUSE_EFFECT: ["therefore", "consequently", "thus", "hence", "as a result", "accordingly", "for this reason"],
  ADDITION: ["moreover", "furthermore", "additionally", "in addition", "likewise", "similarly", "indeed", "also"],
  EXAMPLE: ["for example", "for instance", "specifically", "in particular"],
};

function normalize(o: string): string {
  return o.trim().replace(/,\s*$/, "").toLowerCase();
}

/** 표준 목록 안에서 이 전환어가 속한 카테고리(들)을 찾는다. 목록 밖 표현은 null(판단 불가). */
function categoryOf(option: string): TransitionRelationship | null {
  const norm = normalize(option);
  for (const cat of TRANSITION_RELATIONSHIPS) {
    if (CATEGORY_WORDS[cat].includes(norm)) return cat;
  }
  return null;
}

export type TransitionRelationshipFields = {
  /** 정답 전환어가 신호하는 논리 관계(고정 enum). */
  relationshipType: string | null;
  /** 오답(정답 제외) 옵션 순서대로 하나씩 — 그 오답이 신호하는(잘못된) 논리 관계. */
  distractorRelationshipTypes: string[] | null;
};

export type TransitionRelationshipCheckResult = { ok: true } | { ok: false; reason: string };

export function checkTransitionRelationshipFields(
  skillCode: string,
  fields: TransitionRelationshipFields,
  correctOption: string,
  distractorOptions: string[]
): TransitionRelationshipCheckResult {
  if (!isTransitionsSkill(skillCode)) return { ok: true };

  const relationshipType = (fields.relationshipType ?? "").trim();
  const distractorRelationshipTypes = fields.distractorRelationshipTypes ?? [];
  const allowed = new Set(TRANSITION_RELATIONSHIPS as readonly string[]);

  if (!relationshipType) return { ok: false, reason: "transition-relationship: relationship_type이 비어 있습니다." };
  if (!allowed.has(relationshipType)) {
    return { ok: false, reason: `transition-relationship: relationship_type "${relationshipType}"이 허용된 값이 아닙니다(허용: ${TRANSITION_RELATIONSHIPS.join(", ")}).` };
  }
  if (distractorRelationshipTypes.length !== distractorOptions.length) {
    return { ok: false, reason: `transition-relationship: distractor_relationship_types 개수(${distractorRelationshipTypes.length})가 오답 개수(${distractorOptions.length})와 다릅니다.` };
  }
  for (const tag of distractorRelationshipTypes) {
    if (!allowed.has(tag)) {
      return { ok: false, reason: `transition-relationship: distractor_relationship_types에 알 수 없는 값 "${tag}"이 있습니다(허용: ${TRANSITION_RELATIONSHIPS.join(", ")}).` };
    }
  }

  // 정답 전환어가 표준 목록에 있으면, 그 카테고리가 태그된 relationshipType과 실제로 일치해야 한다
  // (예: "however"를 CAUSE_EFFECT로 태그하면 거부 — 자기보고와 실제 단어 뜻이 어긋난 경우).
  const correctCat = categoryOf(correctOption);
  if (correctCat && correctCat !== relationshipType) {
    return {
      ok: false,
      reason: `transition-relationship: 정답 전환어 "${correctOption.trim()}"는 ${correctCat} 관계인데 relationship_type은 ${relationshipType}로 태그됐습니다 — 태그가 실제 단어의 논리 관계와 어긋납니다.`,
    };
  }

  // 오답들은 (a) 태그가 정답과 달라야 하고(다른 논리 관계를 신호해야 변별력이 생김),
  // (b) 표준 목록에 있는 단어라면 그 실제 카테고리도 정답과 달라야 한다(태그만 다르고 실제 단어는
  //     같은 카테고리인 경우 — 자기보고 태그가 실제와 다른 또 다른 형태의 불일치 — 거부).
  for (let i = 0; i < distractorOptions.length; i += 1) {
    const tag = distractorRelationshipTypes[i];
    if (tag === relationshipType) {
      return {
        ok: false,
        reason: `transition-relationship: 오답 선택지 "${distractorOptions[i]}"의 relationship_type이 정답과 같은 ${tag}입니다 — 오답은 정답과 다른 논리 관계를 신호해야 논리로만 변별됩니다.`,
      };
    }
    const optCat = categoryOf(distractorOptions[i]);
    if (optCat && optCat !== tag) {
      return {
        ok: false,
        reason: `transition-relationship: 오답 선택지 "${distractorOptions[i]}"는 실제로 ${optCat} 관계 전환어인데 distractor_relationship_types는 ${tag}로 태그했습니다 — 태그가 실제 단어와 어긋납니다.`,
      };
    }
    if (optCat && optCat === relationshipType) {
      return {
        ok: false,
        reason: `transition-relationship: 오답 선택지 "${distractorOptions[i]}"가 실제로는 정답과 같은 ${relationshipType} 관계 전환어입니다 — 오답이 정답과 같은 논리 관계를 신호하면 변별력이 없습니다.`,
      };
    }
  }

  return { ok: true };
}
