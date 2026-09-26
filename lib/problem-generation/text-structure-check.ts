// 2026-09-17 — text_structure_purpose(글의 구조·기능) 결정적 검증기.
//
// evidence-model-check.ts와 같은 설계: "이 문단/구간의 수사적 역할이 무엇인가"를 AI 자기보고로
// 끝내지 않고, (1) 생성 시점에 그 구간(evidence_span)이 실제 지문에 축자로 존재하는지 문자열
// 검색으로 확인하고(evidence-model의 verifyEvidenceSpanInSource 재사용), (2) 정답이 태그하는
// 역할과 오답들이 태그하는 역할이 서로 달라야 한다는 것을 결정적으로 검사한다 — 오답은 "다른
// 문단을 가리켰다"가 아니라 "이 문단의 역할을 다른 이름으로 잘못 불렀다"로 틀려야 한다.

import { verifyEvidenceSpanInSource } from "./evidence-model-check";

export const PARAGRAPH_ROLES = ["CLAIM", "EVIDENCE", "COUNTERARGUMENT", "CONCESSION", "CONCLUSION"] as const;
export type ParagraphRole = (typeof PARAGRAPH_ROLES)[number];

export const TEXT_STRUCTURE_SKILLS = ["text_structure_purpose"] as const;
export type TextStructureSkill = (typeof TEXT_STRUCTURE_SKILLS)[number];

export function isTextStructureSkill(skillCode: string | null | undefined): skillCode is TextStructureSkill {
  return Boolean(skillCode) && (TEXT_STRUCTURE_SKILLS as readonly string[]).includes(skillCode as string);
}

export type TextStructureFields = {
  /** 질문 대상 구간이 실제로 하는 수사적 역할(고정 enum) — 정답이 서술하는 "기능"의 진실값. */
  target: string | null;
  /** 질문 대상 구간(문단/문장 뭉치) 축자 인용 — 지문에 실제로 있어야 한다. */
  evidenceSpan: string | null;
  answerRationale: string | null;
  /** 오답(정답 제외) 옵션 순서대로 하나씩 — 그 오답이 (틀리게) 주장하는 역할. */
  distractorErrorTypes: string[] | null;
};

export type TextStructureCheckResult = { ok: true } | { ok: false; reason: string };

export function checkTextStructureFields(
  skillCode: string,
  fields: TextStructureFields,
  sourceText: string,
  distractorCount: number
): TextStructureCheckResult {
  if (!isTextStructureSkill(skillCode)) return { ok: true };

  const target = (fields.target ?? "").trim();
  const evidenceSpan = (fields.evidenceSpan ?? "").trim();
  const answerRationale = (fields.answerRationale ?? "").trim();
  const distractorErrorTypes = fields.distractorErrorTypes ?? [];
  const allowed = new Set(PARAGRAPH_ROLES as readonly string[]);

  if (!target) return { ok: false, reason: "text-structure: target이 비어 있습니다." };
  if (!allowed.has(target)) {
    return { ok: false, reason: `text-structure: target "${target}"이 허용된 값이 아닙니다(허용: ${PARAGRAPH_ROLES.join(", ")}).` };
  }
  if (!evidenceSpan) return { ok: false, reason: "text-structure: evidence_span이 비어 있습니다." };
  if (!answerRationale) return { ok: false, reason: "text-structure: answer_rationale이 비어 있습니다." };

  if (!verifyEvidenceSpanInSource(evidenceSpan, sourceText)) {
    return { ok: false, reason: `text-structure: evidence_span("${evidenceSpan.slice(0, 80)}")이 실제 지문에서 찾아지지 않습니다(질문 대상 구간을 축자 인용해야 합니다).` };
  }

  if (distractorErrorTypes.length !== distractorCount) {
    return { ok: false, reason: `text-structure: distractor_error_types 개수(${distractorErrorTypes.length})가 오답 개수(${distractorCount})와 다릅니다.` };
  }
  for (const tag of distractorErrorTypes) {
    if (!allowed.has(tag)) {
      return { ok: false, reason: `text-structure: distractor_error_types에 알 수 없는 값 "${tag}"이 있습니다(허용: ${PARAGRAPH_ROLES.join(", ")}).` };
    }
    if (tag === target) {
      return {
        ok: false,
        reason: `text-structure: 오답의 distractor_error_types가 정답과 같은 역할(${target})로 태그됐습니다 — 오답은 이 구간의 실제 역할과 다른 역할을 잘못 주장해야 변별력이 생깁니다.`,
      };
    }
  }
  if (new Set(distractorErrorTypes).size !== distractorErrorTypes.length) {
    return { ok: false, reason: `text-structure: distractor_error_types에 중복된 역할이 있습니다(${distractorErrorTypes.join(", ")}) — 오답끼리 서로 다른 역할을 잘못 주장해야 합니다.` };
  }

  return { ok: true };
}
