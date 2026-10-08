// 과목별 생성 가이드 설정 형식(2026-10-08). 과목마다 파일 하나(calc-ab.ts, 이후 micro.ts, bio.ts)로 같은 구조를 쓴다.
// docs/ap/generation-guides/<과목>.md 가 사람이 읽는 본문이고, 이 설정이 파이프라인(프롬프트·범위·검증)의 단일 출처다.
export type UnitScope = { unit: string; title: string; inScope: string[]; outOfScope: string[]; mcWeight: [number, number] };
export type SkillRule = { code: string; name: string; mc: boolean; frq: boolean; designRules: string[]; banned: string[] };
export type ArchetypeSpec = { id: string; topic: string; skill: string; calculator: "required" | "not_allowed"; stimulus: string; verifiedBy: string[]; misconceptions: string[] };
export type FrqTemplateSpec = { id: string; template: string; topic: string; extraTopics: string[]; skill: string; calculator: "required" | "not_allowed"; parts: string; points: number; verifiedBy: string[] };
export type SubjectGuide = {
  subject: string; guideDoc: string; examStructure: string;
  units: UnitScope[]; skills: SkillRule[]; archetypes: ArchetypeSpec[]; frqTemplates: FrqTemplateSpec[];
  notation: string[]; calculatorRules: string[]; stimulusTypes: { kind: string; howGenerated: string; howVerified: string }[];
  difficultyAllowed: string[]; difficultyBanned: string[]; loadLimits: { mcSeconds: [number, number]; stemWordsMax: number; mcOptions: number; frqMinutes: number; frqPoints: number };
  frqRubricPatterns: string[]; frqAccepted: string[]; bannedTerms: { pattern: string; why: string }[]; validators: { item: string; checks: string[] }[];
  acceptExamples: { title: string; text: string }[]; rejectExamples: { title: string; text: string; reason: string }[];
};
