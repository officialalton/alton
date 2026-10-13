// SQL 생성기 골든 테스트(순수 문자열). 실행 의미(멱등·드리프트·롤백·원자성)는 PGlite 하니스로 따로 확인했다(보고서 참고).
import { describe, expect, it } from "vitest";
import { planPatch, planSets, type ProblemReadout, type SetRow, type VersionRow } from "./plan";
import { emitApplySql, emitRollbackSql, emitVerifySql, toSqlPlan, PLAN_TAG } from "./sql";

const pub: VersionRow = {
  id: "00000000-0000-0000-0000-000000000201", version_no: 1, status: "published", passage: "Which is the sum of $2+2$?", question: null, options: ["3", "4", "5", "6"], correct_index: 1, answers: null,
  explanation: "정답은 B이다.", explanation_en: "The answer is B.", difficulty: "medium", figure: null, figure_checked: false, statements: null, render_check: { ok: true }, quality: { mockExamGeneration: { gid: "g1" } },
  evidence_target: null, evidence_span: null, answer_rationale: null, distractor_error_types: null,
};
const pr: ProblemReadout = {
  gid: "g1", problem_id: "00000000-0000-0000-0000-000000000101", published_version_id: pub.id, pstatus: "confirmed", pformat: "mc", usage_scope: "mock_exam", exam_system: "sat_math", skill_code: null,
  versions: [{ id: pub.id, no: 1, status: "published" }], pub,
  placements: [{ set_id: "00000000-0000-0000-0000-0000000000c1", set_name: "SAT Practice Test X", set_version: 1, set_status: "published", format: "mst", section: "math", position: 1, module_key: "math_m1", route: null, item_version_id: pub.id }],
};
const sets: SetRow[] = [{ id: "00000000-0000-0000-0000-0000000000c1", set_group_id: "00000000-0000-0000-0000-0000000000b1", name: "SAT Practice Test X", version_no: 1, status: "published", format: "mst", access_tier: "free", published_at: "2026-10-08T00:00:00Z", published_by: "00000000-0000-0000-0000-0000000000a1", archived_at: null }];
const plan = planPatch({ id: "T-1", gid: "g1", changes: [{ field: "passage", old: "Which is the sum of $2+2$?", new: "What is the sum of $2+2$?" }] }, pr, { now: "2026-10-13T00:00:00.000Z" });
const sqlPlan = toSqlPlan([plan], planSets([plan], sets, new Map([[pr.problem_id, pub.id]])).sets, "test");

describe("SQL 생성", () => {
  it("실행 SQL 은 하나의 DO 블록(= 한 트랜잭션)이고 골든과 같다", () => {
    const sql = emitApplySql(sqlPlan);
    expect(sql.match(/^do \$audit\$$/gm)?.length).toBe(1);
    expect(sql).toContain("public.save_problem_draft_version(");
    expect(sql).toContain("public.confirm_and_publish_problem_version(v_new, v_actor)");
    expect(sql).toContain("public.mock_exam_publish_set(v_new_set, v_actor)");
    expect(sql).not.toMatch(/\b(delete from|drop table|truncate)\b/i);
    expect(sql).toMatchFileSnapshot("./__golden__/apply-mini.sql");
  });
  it("계획 JSON 에는 바뀌는 필드의 옛/새 값, 렌더 검사, auditFix 표식만 실린다", () => {
    const u = sqlPlan.problems[0];
    expect(u.expect).toEqual({ passage: "Which is the sum of $2+2$?" }); expect(u.set).toEqual({ passage: "What is the sum of $2+2$?" });
    expect(u.audit_fix).toMatchObject({ patch: "T-1", fromVersionId: pub.id, fromVersionNo: 1 });
    expect(sqlPlan.sets[0]).toMatchObject({ name: "SAT Practice Test X", problem_ids: [pr.problem_id] });
  });
  it("롤백 SQL 은 문항을 먼저 되돌리고(세트 공개 게이트가 현재 공개 버전을 요구) 그다음 세트를 되돌린다", () => {
    const sql = emitRollbackSql(sqlPlan, [{ setId: sets[0].id, setGroupId: sets[0].set_group_id, accessTier: "free", publishedAt: sets[0].published_at, publishedBy: sets[0].published_by }]);
    expect(sql.indexOf("update problem_versions set status = 'archived'")).toBeGreaterThan(0);
    expect(sql.indexOf("update problem_versions set status = 'archived'")).toBeLessThan(sql.indexOf("update mock_exam_sets set status = 'published'"));
    expect(sql).toContain("quality->'auditFix'->>'patch'");
    expect(sql).toMatchFileSnapshot("./__golden__/rollback-mini.sql");
  });
  it("검증 SQL 은 SELECT 만 담는다", () => {
    const sql = emitVerifySql(sqlPlan);
    const body = sql.split("\n").filter((l) => !l.startsWith("--")).join("\n");
    expect(body).not.toMatch(/\b(insert|update|delete|drop|alter|truncate|create)\b/i);
    expect(body.match(/\bselect\b/gi)?.length).toBeGreaterThanOrEqual(2);
  });
  it("달러 인용 태그가 지문 안에 있으면 거부한다", () => {
    const bad = { ...sqlPlan, problems: [{ ...sqlPlan.problems[0], set: { passage: `x $${PLAN_TAG}$ y` } }] };
    expect(() => emitApplySql(bad)).toThrow(/dollar-quote/);
  });
  it("AP 문항은 ap_attach_new_version 호출 정보를 싣는다", () => {
    const apPlan = planPatch({ id: "AP-1", apCandidateKey: "run1:ap_calculus_ab-f02-k5", changes: [{ field: "passage", old: "Which is the sum of $2+2$?", new: "What is it?" }] }, { ...pr, ap_candidate_key: "run1:ap_calculus_ab-f02-k5", ap_item_index: 0 });
    expect(toSqlPlan([apPlan], []).problems[0].ap).toEqual({ candidate_key: "run1:ap_calculus_ab-f02-k5", item_index: 0 });
  });
});
