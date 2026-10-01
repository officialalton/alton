// SAT 키워드 재설정 계산(순수 함수) — scripts/keywords/sat-keyword-setup.ts 가 DB I/O 를 맡는다.
import { SAT_KEYWORDS, SAT_KEYWORD_BY_SKILL, type SatExamSystem, type SatKeywordDef } from "./taxonomy";
import { SKILL_BY_CODE } from "../problem-taxonomy";

export type KeywordRow = { id: string; subject_id: string; label: string; status: string; skill_code: string | null; domain_code: string | null };
export type SubjectIds = Record<SatExamSystem, string>;

const norm = (s: string) => s.trim().toLowerCase();

export type KeywordPlan = {
  create: { subject_id: string; label: string; skill_code: string; domain_code: string }[];
  reuse: { id: string; label: string; skill_code: string; domain_code: string }[];
  alreadySet: { id: string; skill_code: string }[];
};

/** 30개 스킬 키워드를 skill_code 기준으로 맞춘다. 이미 skill_code 가 있으면 건너뛰고, 같은 라벨 구 키워드가 있으면 그 행을 재사용한다. */
export function planKeywords(existing: KeywordRow[], subjects: SubjectIds, defs: SatKeywordDef[] = SAT_KEYWORDS): KeywordPlan {
  const plan: KeywordPlan = { create: [], reuse: [], alreadySet: [] };
  for (const d of defs) {
    const subjectId = subjects[d.examSystem];
    const inSubject = existing.filter((k) => k.subject_id === subjectId);
    const bySkill = inSubject.find((k) => k.skill_code === d.skillCode);
    if (bySkill) { plan.alreadySet.push({ id: bySkill.id, skill_code: d.skillCode }); continue; }
    const byLabel = inSubject.find((k) => norm(k.label) === norm(d.label));
    if (byLabel) {
      if (byLabel.skill_code && byLabel.skill_code !== d.skillCode) throw new Error(`라벨 '${d.label}' 키워드가 다른 skill_code(${byLabel.skill_code})를 가짐`);
      plan.reuse.push({ id: byLabel.id, label: d.label, skill_code: d.skillCode, domain_code: d.domainCode });
      continue;
    }
    plan.create.push({ subject_id: subjectId, label: d.label, skill_code: d.skillCode, domain_code: d.domainCode });
  }
  return plan;
}

export type ProblemRow = { id: string; subject_id: string | null; exam_system: string | null; skill_code: string | null };
export type LinkPlan = {
  inserts: { problem_id: string; keyword_id: string }[];
  alreadyLinked: number;
  nullSkill: string[];
  otherSubject: string[];
  unknownSkill: { id: string; skill_code: string }[];
  countBySkill: Record<string, number>;
};

/** confirmed 문항 → (과목, skill_code) 키워드 연결. keywordId(subjectId, skillCode) 는 설정 후 키워드 id. */
export function planProblemLinks(
  problems: ProblemRow[],
  subjects: SubjectIds,
  keywordId: (subjectId: string, skillCode: string) => string | undefined,
  existingLinks: Set<string>,
): LinkPlan {
  const out: LinkPlan = { inserts: [], alreadyLinked: 0, nullSkill: [], otherSubject: [], unknownSkill: [], countBySkill: {} };
  const seen = new Set<string>();
  for (const p of problems) {
    if (!p.skill_code) { out.nullSkill.push(p.id); continue; }
    const def = SAT_KEYWORD_BY_SKILL.get(p.skill_code);
    if (!def || (p.exam_system && p.exam_system !== def.examSystem)) { out.unknownSkill.push({ id: p.id, skill_code: p.skill_code }); continue; }
    const subjectId = subjects[def.examSystem];
    if (p.subject_id !== subjectId) { out.otherSubject.push(p.id); continue; }
    const kw = keywordId(subjectId, p.skill_code);
    if (!kw) { out.unknownSkill.push({ id: p.id, skill_code: p.skill_code }); continue; }
    out.countBySkill[p.skill_code] = (out.countBySkill[p.skill_code] ?? 0) + 1;
    const key = `${p.id}:${kw}`;
    if (existingLinks.has(key)) { out.alreadyLinked += 1; continue; }
    if (seen.has(key)) continue;
    seen.add(key);
    out.inserts.push({ problem_id: p.id, keyword_id: kw });
  }
  return out;
}

export type LegacyUsage = { docs: number; subjectUnits: number; teacherUnits: number; sections: number };
export type LegacyPlan = {
  linksToDelete: { problem_id: string; keyword_id: string }[];
  keepActive: { id: string; label: string; subject_id: string; usage: LegacyUsage; total: number; candidate: string | null }[];
  archive: { id: string; label: string }[];
};

/** 구 키워드(skill_code null): 문제 연결은 모두 삭제 대상(백업 후), 교재·단원 사용처가 있으면 active 유지, 없으면 archived. */
export function planLegacy(legacy: KeywordRow[], links: { problem_id: string; keyword_id: string }[], usage: Map<string, LegacyUsage>, subjects?: SubjectIds): LegacyPlan {
  const sysOf = (sid: string) => (subjects ? (Object.keys(subjects) as SatExamSystem[]).find((k) => subjects[k] === sid) : undefined);
  const ids = new Set(legacy.map((k) => k.id));
  const out: LegacyPlan = { linksToDelete: links.filter((l) => ids.has(l.keyword_id)), keepActive: [], archive: [] };
  for (const k of legacy) {
    const u = usage.get(k.id) ?? { docs: 0, subjectUnits: 0, teacherUnits: 0, sections: 0 };
    const total = u.docs + u.subjectUnits + u.teacherUnits + u.sections;
    if (total > 0) out.keepActive.push({ id: k.id, label: k.label, subject_id: k.subject_id, usage: u, total, candidate: nearestSkill(k.label, sysOf(k.subject_id)) });
    else if (k.status !== "archived") out.archive.push({ id: k.id, label: k.label });
  }
  out.keepActive.sort((a, b) => b.total - a.total);
  return out;
}

/** 구 라벨 → 가장 가까운 스킬 후보(참고용, 자동 적용 안 함). 한글 힌트 사전 + 영어 단어 겹침. */
const HINTS: [RegExp, string][] = [
  [/이차방정식|방정식.*비선형|nonlinear equation/i, "nonlinear_equations_systems"],
  [/이차|quadratic|비선형|nonlinear|지수|exponential|다항/i, "nonlinear_functions"],
  [/일차방정식|linear equation/i, "linear_equations_one_var"],
  [/연립|system/i, "systems_linear"],
  [/부등식|inequalit/i, "linear_inequalities"],
  [/함수|function/i, "linear_functions"],
  [/식|expression|인수분해/i, "equivalent_expressions"],
  [/확률|probab/i, "probability"],
  [/통계|statistic|data|자료/i, "one_variable_data"],
  [/비율|ratio|rate|단위/i, "ratios_rates_units"],
  [/퍼센트|percent|백분율/i, "percentages"],
  [/원|circle/i, "circles"],
  [/삼각비|trig/i, "right_triangles_trigonometry"],
  [/삼각형|각|triangle|angle|도형|geometry/i, "lines_angles_triangles"],
  [/넓이|부피|area|volume/i, "area_volume"],
  [/voca|어휘|단어|word/i, "words_in_context"],
  [/gramm|grammer|문법|punctuat|구두점/i, "boundaries"],
  [/transition|연결어/i, "transitions"],
  [/writing|작문/i, "rhetorical_synthesis"],
  [/reading|독해|main idea|주제/i, "central_ideas_details"],
  [/추론|inferenc/i, "inferences"],
];
export function nearestSkill(label: string, examSystem?: SatExamSystem): string | null {
  for (const [re, code] of HINTS) {
    if (!re.test(label)) continue;
    const def = SAT_KEYWORD_BY_SKILL.get(code);
    if (def && (!examSystem || def.examSystem === examSystem)) return code;
  }
  return null;
}
export const skillDisplay = (code: string | null) => (code ? `${code} (${SKILL_BY_CODE.get(code)?.label ?? "?"})` : "(수동 지정)");

export const chunk = <T,>(xs: T[], n = 200): T[][] => { const out: T[][] = []; for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n)); return out; };
