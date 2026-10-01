// SAT 공용 키워드 사전(2026-10-01 오너 확정): College Board 스킬 단위 30개. 원본은 lib/problem-taxonomy 의 SKILL_CODES.
import { SKILL_CODES, DOMAIN_BY_CODE, examSystemOfDomain } from "../problem-taxonomy";

export type SatExamSystem = "sat_math" | "sat_rw";
export type SatKeywordDef = {
  examSystem: SatExamSystem;
  subjectName: string;
  domainCode: string;
  domainLabel: string;
  skillCode: string;
  label: string;
};

export const SAT_SUBJECT_NAME: Record<SatExamSystem, string> = { sat_math: "SAT Math", sat_rw: "SAT Reading & Writing" };

export const SAT_KEYWORDS: SatKeywordDef[] = SKILL_CODES.map((s) => {
  const examSystem = examSystemOfDomain(s.domain) as SatExamSystem;
  return {
    examSystem,
    subjectName: SAT_SUBJECT_NAME[examSystem],
    domainCode: s.domain,
    domainLabel: DOMAIN_BY_CODE.get(s.domain)!.label,
    skillCode: s.code,
    label: s.label,
  };
});

export const SAT_KEYWORD_BY_SKILL = new Map(SAT_KEYWORDS.map((k) => [k.skillCode, k]));
export const satKeywordsFor = (examSystem: SatExamSystem) => SAT_KEYWORDS.filter((k) => k.examSystem === examSystem);
/** 키워드 선택 UI 그룹핑용: skill_code 로 도메인 라벨을 찾는다(구 키워드는 null). */
export const satKeywordDomainLabel = (skillCode: string | null | undefined) => (skillCode ? SAT_KEYWORD_BY_SKILL.get(skillCode)?.domainLabel ?? null : null);
