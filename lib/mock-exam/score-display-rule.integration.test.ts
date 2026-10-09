import { describe, expect, it } from "vitest";
import { answer, asUser, createRoutingSet, createStudent, psql, routes, start, state } from "../../test/mock-exam-routing-fixture";
import { computeMockExamReport } from "./report";
import { estimateScore, type ScoreRoute } from "./score-estimate";
import type { MockExamAttemptItem } from "./attempt-data";

// "예상 점수 범위(Estimated Score Range)"가 언제 나오는지 실제 DB 응답(mock_exam_attempt_detail + 경로)으로 확인한다.
// 표시 규칙(코드: attempt-data.ts computeScoreEstimate + MockExamResultView): MST 응시가 채점 완료(graded)이고, 두 섹션 모두 채점된 문항이 있고, 두 섹션의 M2 경로가 확정돼 있으면 보인다.
// 미응답 문항은 correct=null(채점 안 됨)이라 "섹션에 응답이 하나도 없으면" 그 섹션 점수가 없어 범위가 나오지 않는다. 총 응답 수 하한은 없다(섹션당 1개면 표시). 모듈을 다 끝내지 못한 응시는 graded 가 되지 않아 결과 화면(과 범위)이 없다.
// 이 테스트는 표시 조건만 검증한다 — 점수 모델의 정확도는 검증하지 않았다.
const run = `sd${Date.now().toString(36)}`;
const fx = createRoutingSet({ run });

function play(label: string, plan: { rw1: number; rw2: number; m1: number; m2: number }, opts: { stopAfter?: "rw_m1" | "rw_m2" } = {}) {
  const stu = createStudent(label, run);
  const att = psql(`insert into mock_exam_attempts (student_id, exam_set_id, status) values ('${stu}', '${fx.setId}', 'assigned') returning id;`);
  start(stu, att);
  const doModule = (n: number) => { const ids = state(stu, att).items.map((i) => i.setItemId); answer(stu, att, ids.slice(0, Math.min(ids.length, n)), n); };
  const submit = (k: string) => asUser(stu, `select mock_exam_submit_module('${att}', '${k}');`);
  if (plan.rw1 > 0) doModule(plan.rw1); submit("rw_m1");
  if (opts.stopAfter === "rw_m1") return { stu, att };
  if (plan.rw2 > 0) doModule(plan.rw2); submit("rw_m2");
  if (opts.stopAfter === "rw_m2") return { stu, att };
  submit("break");
  if (plan.m1 > 0) doModule(plan.m1); submit("math_m1");
  if (plan.m2 > 0) doModule(plan.m2); submit("math_m2");
  return { stu, att };
}
function displayRule(stu: string, att: string) {
  const d = JSON.parse(asUser(stu, `select mock_exam_attempt_detail('${att}')::text;`)) as { status: string; format: string; items: MockExamAttemptItem[] };
  if (d.format !== "mst") return { shown: false, why: "not_mst" };
  const report = computeMockExamReport(d.items);
  if (report.bySection.some((s) => s.correct === null)) return { shown: false, why: "section_not_graded", status: d.status, answered: report.answeredCount };
  const r = routes(att);
  const est = estimateScore(report.bySection, { rw: r.rw === "-" ? null : (r.rw as ScoreRoute), math: r.math === "-" ? null : (r.math as ScoreRoute) });
  return est ? { shown: true, status: d.status, answered: report.answeredCount, total: est.total } : { shown: false, why: "route_missing", status: d.status, answered: report.answeredCount };
}

describe("예상 점수 범위 표시 규칙(표시만 검증, 정확도는 미검증)", () => {
  it("모든 모듈을 끝냈지만 응답이 한 섹션(R&W)에만 있으면 — 미응답 문항은 correct=null 이라 Math 가 '채점된 문항 없음' — 범위가 없다", () => {
    const { stu, att } = play("barely1", { rw1: 1, rw2: 0, m1: 0, m2: 0 });
    expect(displayRule(stu, att)).toMatchObject({ shown: false, why: "section_not_graded", status: "graded", answered: 1 });
  });
  it("두 섹션에 응답이 하나씩만 있어도(총 2문항) 범위가 표시된다 — 표시 하한은 '섹션당 응답 1개'일 뿐 응답 수 하한이 아니다", () => {
    const { stu, att } = play("barely2", { rw1: 1, rw2: 0, m1: 1, m2: 0 });
    expect(displayRule(stu, att)).toMatchObject({ shown: true, status: "graded", answered: 2 });
  });
  it("정상 응시(대부분 응답)도 표시된다", () => {
    const { stu, att } = play("normal", { rw1: 4, rw2: 2, m1: 2, m2: 2 });
    expect(displayRule(stu, att)).toMatchObject({ shown: true, status: "graded" });
  });
  it("모듈을 다 끝내지 못한 응시(R&W 만 하고 Math 안 함)는 graded 가 아니라 결과 화면 자체가 없고, 상세에는 채점된 Math 문항이 없어 범위 조건이 성립하지 않는다", () => {
    const { stu, att } = play("partial", { rw1: 4, rw2: 2, m1: 0, m2: 0 }, { stopAfter: "rw_m2" });
    const r = displayRule(stu, att);
    expect(r.shown).toBe(false);
    expect(psql(`select status from mock_exam_attempts where id = '${att}';`)).not.toBe("graded");
  });
  it("M1 만 하고 멈춘 응시도 마찬가지(범위 없음)", () => {
    const { stu, att } = play("m1only", { rw1: 3, rw2: 0, m1: 0, m2: 0 }, { stopAfter: "rw_m1" });
    expect(displayRule(stu, att).shown).toBe(false);
    expect(psql(`select status from mock_exam_attempts where id = '${att}';`)).not.toBe("graded");
  });
});
