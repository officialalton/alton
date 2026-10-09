// 키워드용 "실제 스킬" 복원(순수). APP_SKILL_OVERRIDE 때문에 problems.skill_code 가 central_ideas_details 로 저장된
// 문학 4유형(인물 동기·어조/분위기·인물 관계·상징)을 원래 스킬(inferences)로 되돌린다.
import { QTYPES } from "../rw-generation/batch-plan";
import { SAT_KEYWORD_BY_SKILL } from "../../lib/sat-keywords/taxonomy";

const SKILL_BY_QTYPE = new Map(QTYPES.map((q) => [q.type, q.skill]));
const valid = (s: unknown): s is string => typeof s === "string" && SAT_KEYWORD_BY_SKILL.has(s);

export type IntendedSource = "quality.intendedSkill" | "adopted.planSkill" | "quality.questionType" | "skill_code";

/** 우선순위: 저장된 intendedSkill → 채택 파일 planSkill(gid) → questionType 표(QTYPES) → problems.skill_code. */
export function resolveIntendedSkill(input: { quality?: Record<string, unknown> | null; skillCode?: string | null; planSkillFromFile?: string | null }): { skill: string | null; source: IntendedSource | null } {
  const q = input.quality ?? {};
  const meg = (q.mockExamGeneration ?? {}) as Record<string, unknown>;
  if (valid(meg.intendedSkill)) return { skill: meg.intendedSkill, source: "quality.intendedSkill" };
  if (valid(input.planSkillFromFile)) return { skill: input.planSkillFromFile, source: "adopted.planSkill" };
  const qt = q.questionType;
  if (typeof qt === "string" && valid(SKILL_BY_QTYPE.get(qt))) return { skill: SKILL_BY_QTYPE.get(qt)!, source: "quality.questionType" };
  if (valid(input.skillCode)) return { skill: input.skillCode, source: "skill_code" };
  return { skill: null, source: null };
}
