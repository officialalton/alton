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

/** 결과 화면용 사람이 읽는 영어 이름 — 코드 문자열을 그대로 노출하지 않는다(모르는 코드는 단어로 풀어 쓴다). */
const humanizeCode = (code: string) => {
  const s = code.replace(/^rw_/, "").replace(/_/g, " ").trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : code;
};
export const satDomainDisplayName = (code: string | null | undefined) =>
  code ? DOMAIN_BY_CODE.get(code as never)?.label ?? humanizeCode(code) : "";
export const satSkillDisplayName = (code: string | null | undefined) =>
  code ? SAT_KEYWORD_BY_SKILL.get(code)?.label ?? humanizeCode(code) : "";
