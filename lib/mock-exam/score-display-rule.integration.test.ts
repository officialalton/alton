import { describe, expect, it } from "vitest";
import { ADMIN_ID, answer, asUser, createRoutingSet, createStudent, psql, routes, start, state } from "../../test/mock-exam-routing-fixture";
import { computeMockExamReport } from "./report";
import { estimateScoreWithPolicy, type ScoreRoute } from "./score-estimate";
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
  const r = routes(att);
  const out = estimateScoreWithPolicy(report.bySection, { rw: r.rw === "-" ? null : (r.rw as ScoreRoute), math: r.math === "-" ? null : (r.math as ScoreRoute) });
  return out.estimate ? { shown: true, status: d.status, total: out.estimate.total, sections: report.bySection.map((x) => `${x.answered}/${x.total}`) } : { shown: false, why: out.reason, status: d.status, sections: report.bySection.map((x) => `${x.answered}/${x.total}`) };
}

describe("예상 점수 범위 표시 규칙 — 80% 응답 정책(표시만 검증, 정확도는 미검증)", () => {
  // 이 픽스처의 응시자가 받는 문항: R&W 6(M1 4 + M2 2), Math 4(M1 2 + M2 2). 80% 기준: R&W 5/6, Math 4/4(3/4=75% 부족).
  it("두 섹션 모두 80% 이상 응답: 범위 표시", () => {
    const { stu, att } = play("full", { rw1: 4, rw2: 2, m1: 2, m2: 2 });
    expect(displayRule(stu, att)).toMatchObject({ shown: true, status: "graded", sections: ["6/6", "4/4"] });
  });
  it("R&W 5/6(83%)·Math 4/4: 표시 / R&W 4/6(66.7%): 응답 부족", () => {
    const ok = play("rw5", { rw1: 4, rw2: 1, m1: 2, m2: 2 });
    expect(displayRule(ok.stu, ok.att)).toMatchObject({ shown: true, sections: ["5/6", "4/4"] });
    const low = play("rw4", { rw1: 4, rw2: 0, m1: 2, m2: 2 });
    expect(displayRule(low.stu, low.att)).toMatchObject({ shown: false, why: "insufficient_responses", status: "graded", sections: ["4/6", "4/4"] });
  });
  it("한 섹션만 임계값 미만(Math 3/4=75%)이면 범위 없음, 결과·정오 분석은 그대로(graded 상세에 정오 있음)", () => {
    const { stu, att } = play("math3", { rw1: 4, rw2: 2, m1: 2, m2: 1 });
    expect(displayRule(stu, att)).toMatchObject({ shown: false, why: "insufficient_responses", sections: ["6/6", "3/4"] });
    const d = JSON.parse(asUser(stu, `select mock_exam_attempt_detail('${att}')::text;`)) as { status: string; items: { correct: boolean | null }[] };
    expect(d.status).toBe("graded"); expect(d.items.filter((i) => i.correct !== null).length).toBe(9);
  });
  it("정답이 아니라 응답 수를 센다: 전부 오답이어도 응답이 충분하면 표시", () => {
    const { stu, att } = play("wrong", { rw1: 0, rw2: 0, m1: 0, m2: 0 }); // 아무것도 안 풀면 부족
    expect(displayRule(stu, att).shown).toBe(false);
    const w = createStudent("allwrong", run);
    const a2 = psql(`insert into mock_exam_attempts (student_id, exam_set_id, status) values ('${w}', '${fx.setId}', 'assigned') returning id;`);
    start(w, a2);
    const sub = (k: string) => asUser(w, `select mock_exam_submit_module('${a2}', '${k}');`);
    const wrongAll = () => { const ids = state(w, a2).items.map((i) => i.setItemId); answer(w, a2, ids, 0); }; // nCorrect=0 → 전부 오답 응답
    wrongAll(); sub("rw_m1"); wrongAll(); sub("rw_m2"); sub("break"); wrongAll(); sub("math_m1"); wrongAll(); sub("math_m2");
    expect(displayRule(w, a2)).toMatchObject({ shown: true, sections: ["6/6", "4/4"] });
  });
  it("공백·빈 응답은 응답이 아니다(섹션별 answered 에서 제외, DB 집계 함수)", () => {
    const { stu, att } = play("blank", { rw1: 4, rw2: 2, m1: 2, m2: 2 });
    const item = psql(`select set_item_id from mock_exam_answers where attempt_id = '${att}' limit 1;`);
    psql(`update mock_exam_answers set response = to_jsonb('   '::text) where attempt_id = '${att}' and set_item_id = '${item}';`);
    const rows = psql(`select section || ':' || answered from _mock_exam_section_answered('${att}') order by 1;`).split("\n");
    expect(rows.join(",")).toMatch(/math:4|rw:5|math:3|rw:6/); // 공백으로 바꾼 한 문항만 빠진다
    expect(rows.map((r) => Number(r.split(":")[1])).reduce((a, b) => a + b, 0)).toBe(9);
    void stu;
  });
  it("통계·관리자 점수 원자료 RPC 도 같은 answered 를 내려준다(마이그레이션 409)", () => {
    const { stu, att } = play("rpc", { rw1: 4, rw2: 1, m1: 2, m2: 2 });
    const f = asUser(ADMIN_ID, `select rw_answered || '/' || rw_total || '|' || math_answered || '/' || math_total from admin_student_mock_attempt_facts('${stu}') where attempt_id = '${att}';`);
    expect(f).toBe("5/6|4/4");
    const agg = JSON.parse(psql(`begin; select set_config('request.jwt.claims','{"role":"service_role"}',true); select student_stats_aggregate('${stu}', true)::text; commit;`).split("\n").filter((l) => l.startsWith("{")).pop() ?? "{}") as { mock: { attemptId: string; sections: { section: string; answered: number }[] }[] };
    const m = agg.mock.find((x) => x.attemptId === att)!;
    expect(m.sections.map((x) => `${x.section}:${x.answered}`).sort()).toEqual(["math:4", "rw:5"]);
  });
  it("모듈을 끝내지 못한 응시(R&W 만)는 graded 가 아니라 결과 화면이 없다", () => {
    const { stu, att } = play("partial", { rw1: 4, rw2: 2, m1: 0, m2: 0 }, { stopAfter: "rw_m2" });
    expect(displayRule(stu, att).shown).toBe(false);
    expect(psql(`select status from mock_exam_attempts where id = '${att}';`)).not.toBe("graded");
  });
});
