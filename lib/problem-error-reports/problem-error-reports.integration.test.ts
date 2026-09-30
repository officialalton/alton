import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cleanupPerRunTeacher, createPerRunTeacher } from "@/test/per-run-teacher";
import { insertReservationInBand } from "@/test/reservation-slots";
import {
  ADMIN_ID,
  SEED_GUARDIAN_ID,
  SEED_STUDENT_ID,
  SUBJECT_ID,
  answer,
  assign,
  asUser,
  createRoutingSet,
  createStudent,
  fails,
  psql,
  rest,
  routes,
  start,
  state,
  submitModule,
  type RoutingFixture,
} from "@/test/mock-exam-routing-fixture";

// 문제 오류 신고·판정·채점 조정 — 실제 로컬 DB/PostgREST. 실행 ID(RUN)가 붙은 전용 세트·학생·수업을 쓰고 공유 시드는 읽기만 한다.
// 유형×출처 처리:
//   정답 오류/문제 자체 오류 확정 → 문항 보관 + 이미 나간 응시·과제 전원 정답(모의고사는 조정 채점 이력, 과제는 자동 채점 재계산 + 수동 채점 '조정 대상').
//   해설 오류 확정 → 문항 보관, 채점 변경 없음.  오류 아님 → 신고만 닫힘.

const RUN = randomUUID().slice(0, 8);
let TEACHER_ID: string;
let fx: RoutingFixture;
let studentA: string; // higher 경로
let studentB: string; // lower 경로
let attemptA: string;
let attemptB: string;

const finishAttempt = (uid: string, attempt: string, f: RoutingFixture, m1Correct: number, m2Ids: string[], opts?: { m2Answers?: number }) => {
  start(uid, attempt);
  answer(uid, attempt, f.ids.rw_m1, m1Correct);
  submitModule(uid, attempt, "rw_m1");
  answer(uid, attempt, m2Ids.slice(0, opts?.m2Answers ?? m2Ids.length), 0); // 전부 오답
  submitModule(uid, attempt, "rw_m2");
  submitModule(uid, attempt, "break");
  answer(uid, attempt, f.ids.math_m1, 2);
  submitModule(uid, attempt, "math_m1");
  // math_m2 경로 문항
  const r = routes(attempt).math;
  answer(uid, attempt, r === "higher" ? f.ids.math_higher : f.ids.math_lower, 2);
  submitModule(uid, attempt, "math_m2");
};
const itemProblem = (itemId: string) =>
  psql(`select problem_id || '|' || problem_version_id from mock_exam_set_items where id = '${itemId}';`).split("|") as [string, string];

type RpcJson = Record<string, unknown>;
const verdict = async (problemId: string, versionId: string, decision: string, note?: string) =>
  rest(ADMIN_ID, "rpc/problem_error_apply_verdict", { method: "POST", body: { p_problem_id: problemId, p_version_id: versionId, p_decision: decision, p_note: note ?? null } });
const report = async (uid: string, body: Record<string, unknown>) => rest(uid, "rpc/problem_error_report_submit", { method: "POST", body });
const mockReport = (uid: string, attemptId: string, itemId: string, type = "wrong_key", memo?: string) =>
  report(uid, { p_source: "mock_exam", p_report_type: type, p_memo: memo ?? null, p_attempt_id: attemptId, p_set_item_id: itemId });

beforeAll(() => {
  TEACHER_ID = createPerRunTeacher(psql, { emailPrefix: "problem-error-reports" });
  fx = createRoutingSet({ run: RUN, label: "err-reports" });
  studentA = createStudent("erA", RUN);
  studentB = createStudent("erB", RUN);
  // 교사 담당 관계(모의고사 교사 신고) — 레거시 enrollments.
  psql(`insert into enrollments (student_id, teacher_id, subject_id, status) values ('${studentA}', '${TEACHER_ID}', '${SUBJECT_ID}', 'active') on conflict do nothing;`);
  attemptA = assign(studentA, fx.setId);
  attemptB = assign(studentB, fx.setId);
  // A: M1 4/4 → higher, M2 higher 2문항 중 1개만 응답(하나는 미응답). B: M1 1/4 → lower.
  finishAttempt(studentA, attemptA, fx, 4, fx.ids.rw_higher, { m2Answers: 1 });
  finishAttempt(studentB, attemptB, fx, 1, fx.ids.rw_lower);
});
afterAll(() => cleanupPerRunTeacher(psql, TEACHER_ID));

describe("전제: 두 응시가 채점 완료됐고 경로가 다르다", () => {
  it("A=higher, B=lower, 둘 다 graded", () => {
    expect(routes(attemptA).rw).toBe("higher");
    expect(routes(attemptB).rw).toBe("lower");
    expect(psql(`select string_agg(status, ',' order by id) from mock_exam_attempts where id in ('${attemptA}','${attemptB}');`).split(",")).toEqual(["graded", "graded"]);
  });
});

describe("신고: 권한·유형·중복·비노출", () => {
  it("학생은 자기 응시 문항을 신고하고 같은 문항 재신고는 duplicate(고유 제약)", async () => {
    const item = fx.ids.rw_m1[3];
    const r1 = await mockReport(studentA, attemptA, item, "wrong_key");
    expect(r1.status).toBe(200);
    expect((r1.json as RpcJson).duplicate).toBe(false);
    const r2 = await mockReport(studentA, attemptA, item, "flawed_problem");
    expect((r2.json as RpcJson).duplicate).toBe(true);
    expect((r2.json as RpcJson).reportId).toBe((r1.json as RpcJson).reportId);
    const [problemId, versionId] = itemProblem(item);
    // 테이블 수준 고유 제약(서비스 경로 직접 삽입도 막힌다)
    const dup = fails(() =>
      psql(`insert into problem_error_reports (problem_id, problem_version_id, source, mock_attempt_id, mock_set_item_id, reporter_id, reporter_role, report_type)
            values ('${problemId}', '${versionId}', 'mock_exam', '${attemptA}', '${item}', '${studentA}', 'student', 'wrong_key');`),
    );
    expect(dup).toContain("problem_error_reports_one_per_reporter");
    expect(psql(`select error_review_needed::text from problems where id = '${problemId}';`)).toBe("true"); // 1건으로 즉시 검토 필요
  });

  it("해설 오류는 선생님만, 기타는 메모 필수, 학부모·관리자는 신고 불가", async () => {
    const item = fx.ids.rw_m1[2];
    const s = await mockReport(studentA, attemptA, item, "bad_explanation");
    expect(s.status).toBeGreaterThanOrEqual(400);
    expect(JSON.stringify(s.json)).toContain("선생님만");
    expect(JSON.stringify((await mockReport(studentA, attemptA, item, "other")).json)).toContain("내용을 적어");
    expect(JSON.stringify((await mockReport(studentA, attemptA, item, "other", "  ")).json)).toContain("내용을 적어");
    for (const uid of [SEED_GUARDIAN_ID, ADMIN_ID]) {
      const r = await mockReport(uid, attemptA, item, "wrong_key");
      expect(r.status, uid).toBeGreaterThanOrEqual(400);
      expect(JSON.stringify(r.json)).toContain("학생과 선생님만");
    }
    // 담당 선생님은 해설 오류 신고 가능(담당 학생 응시)
    const t = await mockReport(TEACHER_ID, attemptA, item, "bad_explanation");
    expect(t.status).toBe(200);
    // 담당이 아닌 학생의 응시·남의 응시는 "문항 없음"
    const other = await mockReport(studentB, attemptA, item, "wrong_key");
    expect(JSON.stringify(other.json)).toContain("문항을 찾을 수 없습니다");
  });

  it("다른 경로(변형) 문항은 경로를 드러내지 않고 '문항 없음'과 같은 메시지로 거절", async () => {
    const r = await mockReport(studentB, attemptB, fx.ids.rw_higher[0], "wrong_key"); // B 는 lower
    expect(r.status).toBeGreaterThanOrEqual(400);
    expect(JSON.stringify(r.json)).toContain("문항을 찾을 수 없습니다");
    const ok = await mockReport(studentB, attemptB, fx.ids.rw_lower[0], "flawed_problem");
    expect(ok.status).toBe(200);
  });

  it("REST: 신고자는 자기 신고만, 관리자는 전체, 직접 쓰기는 모두 거부", async () => {
    const own = await rest(studentA, "problem_error_reports?select=id,reporter_id,report_type");
    expect(own.status).toBe(200);
    expect((own.json as { reporter_id: string }[]).every((x) => x.reporter_id === studentA)).toBe(true);
    const mine = (own.json as unknown[]).length;
    expect(mine).toBeGreaterThan(0);
    const bSees = await rest(studentB, "problem_error_reports?select=reporter_id");
    expect((bSees.json as { reporter_id: string }[]).every((x) => x.reporter_id === studentB)).toBe(true);
    const parent = await rest(SEED_GUARDIAN_ID, "problem_error_reports?select=id");
    expect(parent.json).toEqual([]);
    const admin = await rest(ADMIN_ID, "problem_error_reports?select=reporter_id");
    expect(new Set((admin.json as { reporter_id: string }[]).map((x) => x.reporter_id)).size).toBeGreaterThanOrEqual(2);
    const [problemId, versionId] = itemProblem(fx.ids.rw_m1[3]);
    const ins = await rest(studentA, "problem_error_reports", {
      method: "POST",
      body: { problem_id: problemId, problem_version_id: versionId, source: "mock_exam", mock_attempt_id: attemptA, mock_set_item_id: fx.ids.rw_m1[3], reporter_id: studentA, reporter_role: "student", report_type: "wrong_key" },
    });
    expect([401, 403]).toContain(ins.status);
    const upd = await rest(studentA, "problem_error_reports?report_type=eq.wrong_key", { method: "PATCH", body: { memo: "x" } });
    expect([401, 403]).toContain(upd.status);
    const del = await rest(studentA, `problem_error_reports?reporter_id=eq.${studentA}`, { method: "DELETE" });
    expect([401, 403]).toContain(del.status);
    // 판정·조정·큐 테이블은 학생 읽기 불가
    for (const t of ["problem_error_verdicts", "mock_exam_answer_adjustments", "problem_replacement_needs"]) {
      expect((await rest(studentA, `${t}?select=*`)).json, t).toEqual([]);
    }
  });

  it("신고 본문은 삭제·변경 불가(서비스 경로도)", () => {
    expect(fails(() => psql(`delete from problem_error_reports where reporter_id = '${studentA}';`))).toContain("삭제할 수 없습니다");
    expect(fails(() => psql(`update problem_error_reports set memo = 'x' where reporter_id = '${studentA}';`))).toContain("수정할 수 없습니다");
  });
});

describe("판정 권한·관리자 읽기", () => {
  it("관리자만 판정·목록·상세를 호출할 수 있다", async () => {
    const [problemId, versionId] = itemProblem(fx.ids.rw_m1[3]);
    for (const uid of [studentA, SEED_GUARDIAN_ID, TEACHER_ID]) {
      expect((await rest(uid, "rpc/problem_error_apply_verdict", { method: "POST", body: { p_problem_id: problemId, p_version_id: versionId, p_decision: "not_error" } })).status, uid).toBeGreaterThanOrEqual(400);
      expect((await rest(uid, "rpc/problem_error_report_groups", { method: "POST", body: {} })).status, uid).toBeGreaterThanOrEqual(400);
      expect((await rest(uid, "rpc/problem_error_report_detail", { method: "POST", body: { p_problem_id: problemId, p_version_id: versionId } })).status).toBeGreaterThanOrEqual(400);
    }
    const groups = await rest(ADMIN_ID, "rpc/problem_error_report_groups", { method: "POST", body: { p_status: "open", p_limit: 200 } });
    expect(groups.status).toBe(200);
    const g = (groups.json as { rows: { problemId: string; reportCount: number; typeCounts: Record<string, number>; sourceCounts: Record<string, number> }[] }).rows.find((x) => x.problemId === problemId)!;
    expect(g.reportCount).toBe(1);
    expect(g.sourceCounts.mock_exam).toBe(1);
    const detail = await rest(ADMIN_ID, "rpc/problem_error_report_detail", { method: "POST", body: { p_problem_id: problemId, p_version_id: versionId } });
    const d = detail.json as { reports: unknown[]; affected: { mockAttemptsGraded: number }; version: { correctIndex: number } };
    expect(d.reports).toHaveLength(1);
    expect(d.affected.mockAttemptsGraded).toBe(2); // A·B 둘 다 이 문항(M1)을 풂
    expect(d.version.correctIndex).toBe(0);
  });
});

describe("모의고사: 문제 자체 오류 확정 → 전원 정답(원채점 보존, 경로 불변)", () => {
  it("A 만 푼 경로 문항·미응답 문항도 정답 처리, B 는 영향 없음", async () => {
    const answered = fx.ids.rw_higher[0]; // A 오답
    const unanswered = fx.ids.rw_higher[1]; // A 미응답
    const [pa, va] = itemProblem(answered);
    const [pu, vu] = itemProblem(unanswered);
    const rawBefore = psql(`select string_agg(raw_correct_count::text, ',' order by position) from mock_exam_attempt_modules where attempt_id = '${attemptA}';`);
    const routeBefore = routes(attemptA);
    const origCorrectBefore = psql(`select count(*) from mock_exam_answers where attempt_id = '${attemptA}' and correct;`);
    const detailBefore = await rest(studentA, "rpc/mock_exam_attempt_detail", { method: "POST", body: { p_attempt_id: attemptA } });
    const correctBefore = (detailBefore.json as { items: { correct: boolean | null }[] }).items.filter((i) => i.correct).length;

    await mockReport(studentA, attemptA, answered, "flawed_problem");
    const r1 = await verdict(pa, va, "flawed_confirmed", "모호함");
    expect(r1.status).toBe(200);
    expect((r1.json as RpcJson).mockAdjustedAnswers).toBe(1);
    const r2 = await verdict(pu, vu, "key_wrong_confirmed");
    expect((r2.json as RpcJson).mockAdjustedAnswers).toBe(1); // 미응답 포함
    expect((r2.json as RpcJson).archived).toBe(true);

    // 원채점·경로·모듈 원점수는 그대로
    expect(psql(`select count(*) from mock_exam_answers where attempt_id = '${attemptA}' and correct;`)).toBe(origCorrectBefore);
    expect(psql(`select string_agg(raw_correct_count::text, ',' order by position) from mock_exam_attempt_modules where attempt_id = '${attemptA}';`)).toBe(rawBefore);
    expect(routes(attemptA)).toEqual(routeBefore);
    expect(psql(`select count(*) from mock_exam_answer_adjustments where attempt_id = '${attemptB}';`)).toBe("0");
    // 조정 이력: 원채점 사본 + 조정값
    expect(psql(`select string_agg(coalesce(original_correct::text,'null') || '>' || adjusted_correct::text, ',' order by original_correct nulls last) from mock_exam_answer_adjustments where attempt_id = '${attemptA}' and superseded_at is null;`)).toBe("false>true,null>true");

    // 읽기: 학생 결과는 조정 기준, 경로 키 없음
    const detail = await rest(studentA, "rpc/mock_exam_attempt_detail", { method: "POST", body: { p_attempt_id: attemptA } });
    const d = detail.json as { scoreAdjusted: boolean; items: { setItemId: string; correct: boolean | null; adjusted: boolean; originalCorrect?: boolean | null }[]; routing?: unknown };
    expect(d.scoreAdjusted).toBe(true);
    expect(d.routing).toBeUndefined();
    expect(d.items.find((i) => i.setItemId === answered)).toMatchObject({ correct: true, adjusted: true, originalCorrect: false });
    expect(d.items.find((i) => i.setItemId === unanswered)).toMatchObject({ correct: true, adjusted: true });
    expect(d.items.filter((i) => i.correct).length).toBe(correctBefore + 2);
    expect(detail.text).not.toMatch(/higher|lower|policy/i);
    const summaries = await rest(studentA, "rpc/mock_exam_attempt_summaries", { method: "POST", body: { p_student_id: studentA } });
    const sum = (summaries.json as { id: string; correctCount: number; scoreAdjusted: boolean }[]).find((s) => s.id === attemptA)!;
    expect(sum).toMatchObject({ correctCount: correctBefore + 2, scoreAdjusted: true });
    // 영향 없는 B 는 scoreAdjusted false
    const sb = await rest(studentB, "rpc/mock_exam_attempt_detail", { method: "POST", body: { p_attempt_id: attemptB } });
    expect((sb.json as { scoreAdjusted: boolean }).scoreAdjusted).toBe(false);
    // 학부모도 같은 조정 결과(읽기)
    const pd = await rest(SEED_GUARDIAN_ID, "rpc/mock_exam_attempt_detail", { method: "POST", body: { p_attempt_id: attemptA } });
    expect([200, 400]).toContain(pd.status);
  });

  it("문항은 보관되고 신고는 닫히고 검토 필요가 해제되며 대체 문항 필요 칸이 쌓인다", () => {
    const [p] = itemProblem(fx.ids.rw_higher[0]);
    expect(psql(`select (archived_at is not null)::text || ',' || error_review_needed::text from problems where id = '${p}';`)).toBe("true,false");
    expect(psql(`select resolved_verdict_id is not null from problem_error_reports where problem_id = '${p}' limit 1;`)).toBe("t");
    const need = psql(`select module_key || '|' || coalesce(route,'-') || '|' || difficulty || '|' || sat_domain || '|' || in_mock_set::text from problem_replacement_needs where problem_id = '${p}';`);
    expect(need).toBe("rw_m2|higher|medium|rw_craft_structure|true"); // higher[0] = medium
  });

  it("같은 판정 재적용은 멱등(새 행·조정 중복 없음)", async () => {
    const [p, v] = itemProblem(fx.ids.rw_higher[0]);
    const before = psql(`select (select count(*) from problem_error_verdicts where problem_id = '${p}') || ',' || (select count(*) from mock_exam_answer_adjustments where problem_id = '${p}') || ',' || (select count(*) from problem_replacement_needs where problem_id = '${p}');`);
    const again = await verdict(p, v, "flawed_confirmed");
    expect((again.json as RpcJson).alreadyApplied).toBe(true);
    const after = psql(`select (select count(*) from problem_error_verdicts where problem_id = '${p}') || ',' || (select count(*) from mock_exam_answer_adjustments where problem_id = '${p}') || ',' || (select count(*) from problem_replacement_needs where problem_id = '${p}');`);
    expect(after).toBe(before);
  });

  it("판정 이력은 append-only: 수정·삭제·TRUNCATE 불가, 조정 이력은 삭제·내용 수정 불가", () => {
    expect(fails(() => psql(`update problem_error_verdicts set note = 'x';`))).toContain("추가만 가능");
    expect(fails(() => psql(`delete from problem_error_verdicts;`))).toContain("추가만 가능");
    expect(fails(() => psql(`truncate problem_error_verdicts cascade;`))).toContain("추가만 가능");
    expect(fails(() => psql(`delete from mock_exam_answer_adjustments;`))).toContain("삭제할 수 없습니다");
    expect(fails(() => psql(`update mock_exam_answer_adjustments set adjusted_correct = false where superseded_at is null;`))).toContain("수정할 수 없습니다");
  });

  it("다른 판정(오류 아님)이 오면 이전 조정은 대체되고 점수는 원채점으로 돌아간다", async () => {
    const answered = fx.ids.rw_higher[0];
    const [pa, va] = itemProblem(answered);
    const before = await rest(studentA, "rpc/mock_exam_attempt_detail", { method: "POST", body: { p_attempt_id: attemptA } });
    const n = (before.json as { items: { correct: boolean | null }[] }).items.filter((i) => i.correct).length;
    const r = await verdict(pa, va, "not_error");
    expect((r.json as RpcJson).alreadyApplied).toBe(false);
    const after = await rest(studentA, "rpc/mock_exam_attempt_detail", { method: "POST", body: { p_attempt_id: attemptA } });
    const items = (after.json as { items: { setItemId: string; correct: boolean | null; adjusted: boolean }[] }).items;
    expect(items.filter((i) => i.correct).length).toBe(n - 1);
    expect(items.find((i) => i.setItemId === answered)).toMatchObject({ correct: false, adjusted: false });
    expect(psql(`select count(*) from mock_exam_answer_adjustments where problem_id = '${pa}' and superseded_at is null;`)).toBe("0");
    expect(psql(`select count(*) from mock_exam_answer_adjustments where problem_id = '${pa}';`)).toBe("1"); // 이력은 남는다
    // 다시 문제 자체 오류 확정 → 새 조정
    const again = await verdict(pa, va, "flawed_confirmed");
    expect((again.json as RpcJson).mockAdjustedAnswers).toBe(1);
  });

  it("진행 중이던 응시는 graded 로 바뀌는 순간 기존 판정이 적용된다(트리거)", async () => {
    const studentD = createStudent("erD", RUN);
    const attemptD = assign(studentD, fx.setId);
    start(studentD, attemptD);
    answer(studentD, attemptD, fx.ids.rw_m1, 0); // 전부 오답
    const item = fx.ids.rw_m1[0];
    const [p, v] = itemProblem(item);
    const r = await verdict(p, v, "flawed_confirmed");
    expect((r.json as RpcJson).alreadyApplied).toBe(false);
    expect(psql(`select count(*) from mock_exam_answer_adjustments where attempt_id = '${attemptD}';`)).toBe("0"); // 아직 graded 아님
    submitModule(studentD, attemptD, "rw_m1");
    answer(studentD, attemptD, fx.ids.rw_lower, 0);
    submitModule(studentD, attemptD, "rw_m2");
    submitModule(studentD, attemptD, "break");
    answer(studentD, attemptD, fx.ids.math_m1, 0);
    submitModule(studentD, attemptD, "math_m1");
    submitModule(studentD, attemptD, "math_m2");
    expect(psql(`select status from mock_exam_attempts where id = '${attemptD}';`)).toBe("graded");
    expect(psql(`select count(*) from mock_exam_answer_adjustments where attempt_id = '${attemptD}' and set_item_id = '${item}' and adjusted_correct;`)).toBe("1");
    expect(routes(attemptD).rw).toBe("lower"); // 경로는 원채점 기준 그대로(M1 0/4)
  });

  it("해설 오류 확정: 문항 보관·대체 큐만, 채점 변경 없음", async () => {
    const item = fx.ids.rw_lower[1];
    const [p, v] = itemProblem(item);
    await mockReport(TEACHER_ID, attemptB, item, "bad_explanation");
    const r = await verdict(p, v, "explanation_confirmed");
    expect(r.status).toBe(200);
    expect((r.json as RpcJson).mockAdjustedAnswers).toBe(0);
    expect(psql(`select count(*) from mock_exam_answer_adjustments where problem_id = '${p}';`)).toBe("0");
    expect(psql(`select (archived_at is not null)::text from problems where id = '${p}';`)).toBe("true");
    expect(psql(`select count(*) from problem_replacement_needs where problem_id = '${p}' and status = 'open';`)).toBe("1");
  });

  it("동시 판정 2건은 행 하나만 만들고 하나는 alreadyApplied", async () => {
    const item = fx.ids.math_m1[0];
    const [p, v] = itemProblem(item);
    const [x, y] = await Promise.all([verdict(p, v, "key_wrong_confirmed"), verdict(p, v, "key_wrong_confirmed")]);
    const flags = [(x.json as RpcJson).alreadyApplied, (y.json as RpcJson).alreadyApplied].sort();
    expect(flags).toEqual([false, true]);
    expect(psql(`select count(*) from problem_error_verdicts where problem_id = '${p}';`)).toBe("1");
    expect(psql(`select count(*) from problem_replacement_needs where problem_id = '${p}';`)).toBe("1");
  });
});

// 실행 ID 가 붙은 전용 skill 코드 — 실제 skill 칸의 여분(다른 세션·시드가 넣은 공개 문항)에 결과가 흔들리지 않게 격리한다.
const SPARE_SKILLS = [`zzsa${RUN}`, `zzsb${RUN}`, `zzsc${RUN}`];
const letters = () => Array.from({ length: 14 }, () => String.fromCharCode(97 + Math.floor(Math.random() * 26))).join("");
/** 공개 상태·어떤 세트에도 안 들어간 여분 문항(같은 skill·난이도 칸). */
function spare(skill: string, difficulty: string): string {
  const id = psql(
    `insert into problems (format, passage, subject_id, status, created_by, skill_code) values ('mc', 'R3 spare ${letters()}', '${SUBJECT_ID}', 'confirmed', '${ADMIN_ID}', '${skill}') returning id;`,
  );
  psql(
    `update problem_versions set options = '["a","b","c","d"]'::jsonb, correct_index = 0, explanation = '해설', difficulty = '${difficulty}', status = 'published', published_at = now()
     where problem_id = '${id}' and version_no = 1;`,
  );
  const vid = psql(`select id from problem_versions where problem_id = '${id}' and version_no = 1;`);
  psql(`update problems set published_version_id = '${vid}' where id = '${id}';`);
  return id;
}
const setSkill = (itemId: string, skill: string) => psql(`update mock_exam_set_items set skill_code = '${skill}' where id = '${itemId}';`);
const setItems = (setId: string) =>
  psql(`select string_agg(section || ':' || position || ':' || module_key || ':' || coalesce(route::text, '-') || ':' || difficulty || ':' || coalesce(skill_code, '-'), ',' order by section, position) from mock_exam_set_items where exam_set_id = '${setId}';`);

describe("여분 문항 자동 교체 / 대체 문항 필요 큐", () => {
  beforeAll(() => {
    SPARE_SKILLS.forEach((code, i) => {
      psql(`insert into problem_skill_codes (code, domain, label, sort) values ('${code}', 'rw_craft_structure', 'ERR spare ${RUN} ${i}', 9990 + ${i}) on conflict (code) do nothing;`);
    });
  });
  afterAll(() => {
    // 이 실행이 만든 여분 문항·skill 코드 정리(판정 이력은 append-only 라 남는 행에 묶이므로 문항은 보관 처리).
    psql(`update problems set archived_at = coalesce(archived_at, now()), archived_reason = coalesce(archived_reason, 'problem-error-reports test cleanup')
           where skill_code in (${SPARE_SKILLS.map((c) => `'${c}'`).join(",")}) and passage like 'R3 spare %';`);
  });

  it("교체 성공: 시작 전 세트의 같은 칸(모듈·경로·난이도·skill)을 여분으로 바꾸고 세트는 여전히 ready·중복 0", async () => {
    const f = createRoutingSet({ run: RUN, label: "replace-ok" });
    const item = f.ids.rw_higher[0]; // higher / medium
    setSkill(item, SPARE_SKILLS[0]);
    const s = spare(SPARE_SKILLS[0], "medium");
    const [oldP, oldV] = itemProblem(item);
    const beforeShape = setItems(f.setId);
    const r = await verdict(oldP, oldV, "flawed_confirmed");
    expect(r.status).toBe(200);
    expect((r.json as RpcJson).autoReplaced).toBe(1);
    expect(setItems(f.setId)).toBe(beforeShape); // 칸 모양(position·모듈·경로·난이도·skill) 그대로
    expect(psql(`select count(*) from mock_exam_set_items where exam_set_id = '${f.setId}' and problem_id = '${oldP}';`)).toBe("0");
    expect(psql(`select count(*) from mock_exam_set_items where exam_set_id = '${f.setId}' and problem_id = '${s}';`)).toBe("1");
    expect(psql(`select content_snapshot is not null from mock_exam_set_items where exam_set_id = '${f.setId}' and problem_id = '${s}';`)).toBe("t");
    const ready = JSON.parse(psql(`select mock_exam_validate_mst_set('${f.setId}')::text;`));
    expect(ready.ready).toBe(true);
    expect(ready.duplicateCount).toBe(0);
    expect(psql(`select status || ',' || resolution from problem_replacement_needs where problem_id = '${oldP}';`)).toBe("linked,auto_replaced");
    expect(psql(`select count(*) from mock_exam_item_replacements where old_problem_id = '${oldP}' and new_problem_id = '${s}' and exam_set_id = '${f.setId}';`)).toBe("1");
    // 관리자 알림: 요약·상세에 교체 이력
    const sum = await rest(ADMIN_ID, "rpc/problem_replacement_need_summary", { method: "POST", body: {} });
    expect((sum.json as { replacements: { oldProblemId: string }[] }).replacements.some((x) => x.oldProblemId === oldP)).toBe(true);
    const det = await rest(ADMIN_ID, "rpc/problem_error_report_detail", { method: "POST", body: { p_problem_id: oldP, p_version_id: oldV } });
    expect((det.json as { replacements: unknown[] }).replacements).toHaveLength(1);
    // 여분은 이제 세트에 배정돼 다른 교체의 후보가 아니다
    const f2 = createRoutingSet({ run: RUN, label: "replace-ok2" });
    setSkill(f2.ids.rw_higher[0], SPARE_SKILLS[0]);
    const [p2, v2] = itemProblem(f2.ids.rw_higher[0]);
    const r2 = await verdict(p2, v2, "explanation_confirmed");
    expect((r2.json as RpcJson).autoReplaced).toBe(0);
    expect(psql(`select open_reason from problem_replacement_needs where problem_id = '${p2}';`)).toBe("no_spare");
  });

  it("같은 판정 재적용·다른 확정 판정은 교체·큐를 되풀이하지 않는다(멱등)", async () => {
    const f = createRoutingSet({ run: RUN, label: "replace-idem" });
    const item = f.ids.math_m1[0];
    setSkill(item, "linear_functions");
    spare("linear_functions", "easy");
    const [p, v] = itemProblem(item);
    const a = await verdict(p, v, "key_wrong_confirmed");
    expect((a.json as RpcJson).autoReplaced).toBe(1);
    const snap = () => psql(`select (select count(*) from mock_exam_item_replacements where old_problem_id = '${p}') || ',' || (select count(*) from problem_replacement_needs where problem_id = '${p}') || ',' || (select count(*) from mock_exam_set_items where exam_set_id = '${f.setId}');`);
    const before = snap();
    expect(((await verdict(p, v, "key_wrong_confirmed")).json as RpcJson).alreadyApplied).toBe(true);
    const other = await verdict(p, v, "flawed_confirmed"); // 다른 확정 판정: 새 행은 쌓이지만 교체·큐는 그대로
    expect((other.json as RpcJson).alreadyApplied).toBe(false);
    expect((other.json as RpcJson).autoReplaced).toBe(0);
    expect(snap()).toBe(before);
  });

  it("여분이 없으면 교체하지 않고 '대체 문항 필요' 큐에 같은 칸 정보로 남기며, 여분이 생기면 재시도로 교체", async () => {
    const f = createRoutingSet({ run: RUN, label: "replace-none" });
    const item = f.ids.rw_lower[1]; // lower / medium
    setSkill(item, SPARE_SKILLS[2]);
    const [p, v] = itemProblem(item);
    const before = setItems(f.setId);
    const r = await verdict(p, v, "flawed_confirmed");
    expect((r.json as RpcJson).autoReplaced).toBe(0);
    expect((r.json as RpcJson).replacementNeedsOpen).toBe(1);
    expect(setItems(f.setId)).toBe(before);
    expect(psql(`select status || '|' || open_reason || '|' || module_key || '|' || route || '|' || difficulty || '|' || skill_code || '|' || in_mock_set::text from problem_replacement_needs where problem_id = '${p}';`)).toBe(
      `open|no_spare|rw_m2|lower|medium|${SPARE_SKILLS[2]}|true`,
    );
    // 세트 '문항 교체 필요' 표시용 요약
    const sum = await rest(ADMIN_ID, "rpc/problem_replacement_need_summary", { method: "POST", body: {} });
    const row = (sum.json as { sets: { examSetId: string; openCount: number; noSpareCount: number }[] }).sets.find((x) => x.examSetId === f.setId)!;
    expect(row).toMatchObject({ openCount: 1, noSpareCount: 1 });
    // 여분이 들어온 뒤 관리자 재시도(학생·비관리자는 불가)
    const s = spare(SPARE_SKILLS[2], "medium");
    expect((await rest(studentA, "rpc/problem_replacement_retry_open", { method: "POST", body: {} })).status).toBeGreaterThanOrEqual(400);
    const retry = await rest(ADMIN_ID, "rpc/problem_replacement_retry_open", { method: "POST", body: {} });
    expect(retry.status).toBe(200);
    expect((retry.json as { replaced: number }).replaced).toBeGreaterThanOrEqual(1);
    expect(psql(`select count(*) from mock_exam_set_items where exam_set_id = '${f.setId}' and problem_id = '${s}';`)).toBe("1");
    expect(psql(`select status from problem_replacement_needs where problem_id = '${p}';`)).toBe("linked");
    const again = await rest(ADMIN_ID, "rpc/problem_replacement_retry_open", { method: "POST", body: {} });
    expect((again.json as { replaced: number }).replaced).toBe(0); // 멱등
  });

  it("응시가 시작된 세트는 절대 바뀌지 않고 큐에 set_started 로 남는다", async () => {
    const before = setItems(fx.setId);
    const itemsBefore = psql(`select string_agg(problem_id::text, ',' order by id) from mock_exam_set_items where exam_set_id = '${fx.setId}';`);
    const item = fx.ids.math_higher[1];
    setSkill(item, SPARE_SKILLS[1]);
    spare(SPARE_SKILLS[1], "hard");
    const [p, v] = itemProblem(item);
    const r = await verdict(p, v, "flawed_confirmed");
    expect((r.json as RpcJson).autoReplaced).toBe(0);
    expect(setItems(fx.setId)).toBe(before.replace(/math:\d+:math_m2:higher:hard:-/, (m) => m.replace(/:-$/, `:${SPARE_SKILLS[1]}`)));
    expect(psql(`select string_agg(problem_id::text, ',' order by id) from mock_exam_set_items where exam_set_id = '${fx.setId}';`)).toBe(itemsBefore);
    expect(psql(`select open_reason from problem_replacement_needs where problem_id = '${p}' and exam_set_id = '${fx.setId}';`)).toBe("set_started");
  });

  it("배정만 된(시작 전) 응시가 있는 세트는 교체되고 학생은 새 문항으로 시작한다", async () => {
    const f = createRoutingSet({ run: RUN, label: "replace-assigned" });
    const stu = createStudent("erAs", RUN);
    const att = assign(stu, f.setId);
    const item = f.ids.rw_m1[0]; // easy
    setSkill(item, SPARE_SKILLS[0]);
    const s = spare(SPARE_SKILLS[0], "easy");
    const [p, v] = itemProblem(item);
    const r = await verdict(p, v, "explanation_confirmed");
    expect((r.json as RpcJson).autoReplaced).toBe(1);
    start(stu, att);
    const st = state(stu, att);
    expect(st.items.length).toBe(4);
    expect(psql(`select count(*) from mock_exam_set_items where exam_set_id = '${f.setId}' and problem_id = '${s}';`)).toBe("1");
  });

  it("일반 문항(세트에 없음)은 보관+큐만, 자동 교체 대상이 아니다", async () => {
    const general = psql(`insert into problems (format, passage, subject_id, status, created_by, usage_scope) values ('mc', 'R3 general ${letters()}', '${SUBJECT_ID}', 'confirmed', '${ADMIN_ID}', 'general') returning id;`);
    const ver = psql(`select id from problem_versions where problem_id = '${general}' limit 1;`);
    const r = await verdict(general, ver, "key_wrong_confirmed");
    expect(r.status).toBe(200);
    expect(psql(`select in_mock_set::text || ',' || status || ',' || coalesce(open_reason, '-') from problem_replacement_needs where problem_id = '${general}';`)).toBe("false,open,-");
    expect(psql(`select (archived_at is not null)::text from problems where id = '${general}';`)).toBe("true");
  });

  it("동시 판정: 여분 1개를 두 문항이 동시에 노려도 한 문항만 교체되고 중복이 없다", async () => {
    const f = createRoutingSet({ run: RUN, label: "replace-race" });
    const [a, b] = [f.ids.rw_m1[0], f.ids.rw_m1[1]]; // easy, easy
    setSkill(a, SPARE_SKILLS[1]);
    setSkill(b, SPARE_SKILLS[1]);
    const s = spare(SPARE_SKILLS[1], "easy");
    const [pa, va] = itemProblem(a);
    const [pb, vb] = itemProblem(b);
    const [x, y] = await Promise.all([verdict(pa, va, "flawed_confirmed"), verdict(pb, vb, "flawed_confirmed")]);
    expect(x.status).toBe(200);
    expect(y.status).toBe(200);
    expect((x.json as { autoReplaced: number }).autoReplaced + (y.json as { autoReplaced: number }).autoReplaced).toBe(1);
    expect(psql(`select count(*) from mock_exam_set_items where exam_set_id = '${f.setId}' and problem_id = '${s}';`)).toBe("1");
    const ready = JSON.parse(psql(`select mock_exam_validate_mst_set('${f.setId}')::text;`));
    expect(ready.ready).toBe(true);
    expect(psql(`select count(*) from problem_replacement_needs where problem_id in ('${pa}', '${pb}') and status = 'open';`)).toBe("1");
  });
});

describe("수업 과제: 자동 채점 재계산·수동 채점 미덮어쓰기·조정 대상", () => {
  const STUDENT_ID = SEED_STUDENT_ID;
  let baseUnitId: string;
  let ctx: { sessionId: string; mcA: string; mcB: string };

  beforeAll(() => {
    baseUnitId = psql(`select id from subject_template_units where subject_id = '${SUBJECT_ID}' order by position limit 1;`);
    const q = (t: string) => `'${t.replace(/'/g, "''")}'`;
    const contractId = psql(`insert into contracts (household_id, child_id, status) values ('aabbccdd-0000-0000-0000-000000000001', '${STUDENT_ID}', 'draft') returning id;`);
    const enrollmentId = psql(`insert into subject_enrollments (child_id, subject_id, contract_id, status) values ('${STUDENT_ID}', '${SUBJECT_ID}', '${contractId}', 'planned') returning id;`);
    psql(`insert into teacher_assignments (subject_enrollment_id, teacher_id, status, effective_from) values ('${enrollmentId}', '${TEACHER_ID}', 'active', now() - interval '1 day');`);
    const overlayId = asUser(TEACHER_ID, `insert into student_curriculum_overlays (subject_enrollment_id) values ('${enrollmentId}') returning id;`);
    const overlayUnitId = asUser(TEACHER_ID, `insert into curriculum_overlay_units (overlay_id, source_unit_id, position, unit_title) values ('${overlayId}', '${baseUnitId}', 1, '신고 회차') returning id;`);
    const keywordId = psql(`insert into subject_keywords (subject_id, label) values ('${SUBJECT_ID}', '신고 ${RUN} ${Math.random()}') returning id;`);
    asUser(TEACHER_ID, `insert into curriculum_overlay_unit_keywords (overlay_unit_id, keyword_id) values ('${overlayUnitId}', '${keywordId}');`);
    const mk = (passage: string) => {
      const id = psql(`insert into problems (format, passage, subject_id, status, created_by) values ('mc', ${q(passage)}, '${SUBJECT_ID}', 'confirmed', '${TEACHER_ID}') returning id;`);
      psql(`insert into problem_keywords (problem_id, keyword_id) values ('${id}', '${keywordId}');`);
      psql(`update problem_versions set options = '["가","나","다","라"]'::jsonb, correct_index = 1, explanation = '해설', difficulty = 'medium', question = '다음 중 옳은 것은?' where problem_id = '${id}';`);
      return id;
    };
    const mcA = mk(`신고 A ${RUN}`);
    const mcB = mk(`신고 B ${RUN}`);
    const prepId = asUser(TEACHER_ID, `insert into curriculum_unit_preps (overlay_unit_id, created_by) values ('${overlayUnitId}', '${TEACHER_ID}') on conflict (overlay_unit_id) do update set created_by = excluded.created_by returning id;`);
    asUser(TEACHER_ID, `insert into curriculum_unit_prep_items (prep_id, content_type, content_id, position) values ('${prepId}', 'problem', '${mcA}', 1), ('${prepId}', 'problem', '${mcB}', 2);`);
    const reservationId = insertReservationInBand(psql, { band: "problem-error-reports", enrollmentId, teacherId: TEACHER_ID });
    const sessionId = psql(`insert into sessions (reservation_id, subject_enrollment_id, teacher_id, lesson_type_id, scheduled_duration_minutes) values ('${reservationId}', '${enrollmentId}', '${TEACHER_ID}', (select id from lesson_types where code = 'regular'), 60) returning id;`);
    psql(`select link_unit_prep_to_session('${overlayUnitId}', '${sessionId}', '${TEACHER_ID}');`);
    psql(`select mark_lesson_session_started('${sessionId}', '${TEACHER_ID}');`);
    ctx = { sessionId, mcA, mcB };
  });

  const sessionReport = (uid: string, problemId: string, type: string, source = "lesson", memo?: string) =>
    report(uid, { p_source: "session_assignment", p_report_type: type, p_memo: memo ?? null, p_session_id: ctx.sessionId, p_session_source: source, p_problem_id: problemId });
  const versionOf = (problemId: string) => psql(`select problem_version_id from session_content_manifest where session_id = '${ctx.sessionId}' and content_id = '${problemId}';`);

  it("학생·담당 선생님은 수업 문제를 신고하고, 학부모·다른 학생·관리자는 못 한다", async () => {
    expect((await sessionReport(STUDENT_ID, ctx.mcA, "flawed_problem")).status).toBe(200);
    expect((await sessionReport(TEACHER_ID, ctx.mcA, "bad_explanation")).status).toBe(200);
    expect((await sessionReport(STUDENT_ID, ctx.mcB, "wrong_key")).status).toBe(200);
    expect(JSON.stringify((await sessionReport(STUDENT_ID, ctx.mcB, "bad_explanation")).json)).toContain("선생님만");
    for (const uid of [SEED_GUARDIAN_ID, ADMIN_ID]) expect((await sessionReport(uid, ctx.mcA, "wrong_key")).status, uid).toBeGreaterThanOrEqual(400);
    const dup = await sessionReport(STUDENT_ID, ctx.mcA, "wrong_key");
    expect((dup.json as RpcJson).duplicate).toBe(true);
    const outsider = createStudent("erOut", RUN);
    expect(JSON.stringify((await sessionReport(outsider, ctx.mcA, "wrong_key")).json)).toContain("이 수업의 문제만");
    // 수업에 없는 문제
    expect((await sessionReport(STUDENT_ID, fx.ids.rw_m1[0] && itemProblem(fx.ids.rw_m1[1])[0], "wrong_key")).status).toBeGreaterThanOrEqual(400);
    expect(psql(`select error_review_needed::text from problems where id = '${ctx.mcA}';`)).toBe("true");
  });

  it("과제(homework) 출처도 같은 원본에 쌓이고 신고자 상태는 '검토 중'", async () => {
    asUser(TEACHER_ID, `select issue_homework_items('${ctx.sessionId}', array['${ctx.mcA}']::uuid[]);`);
    const hw = await sessionReport(STUDENT_ID, ctx.mcA, "other", "homework", "표가 깨져 보임");
    expect(hw.status).toBe(200);
    // 같은 문항(같은 버전)이라 이미 신고한 것으로 본다 → duplicate
    expect((hw.json as RpcJson).duplicate).toBe(true);
    const mine = await rest(STUDENT_ID, "rpc/problem_error_report_mine", { method: "POST", body: { p_problem_ids: [ctx.mcA, ctx.mcB] } });
    const rows = mine.json as { problemId: string; status: string }[];
    expect(rows.find((r) => r.problemId === ctx.mcA)?.status).toBe("reviewing");
  });

  it("문제 자체 오류 확정: 채점 전 풀이는 정답 처리, 수동 채점은 덮어쓰지 않고 조정 대상 표시, 다시 채점하면 해제", async () => {
    // mcA: 학생이 오답(0) 제출, 채점 전 / mcB: 오답 제출 + 교사가 수동으로 '오답' 채점
    const wA = psql(`select start_problem_work('${ctx.sessionId}', '${STUDENT_ID}', '${ctx.mcA}', false);`);
    psql(`select submit_problem_attempt('${wA}', '${STUDENT_ID}', 0, null);`);
    const wB = psql(`select start_problem_work('${ctx.sessionId}', '${STUDENT_ID}', '${ctx.mcB}', false);`);
    psql(`select submit_problem_attempt('${wB}', '${STUDENT_ID}', 0, null);`);
    asUser(TEACHER_ID, `select grade_problem_attempt('${wB}', 'incorrect', '다시 풀어 보자');`);
    expect(psql(`select auto_correct::text from session_problem_work where id = '${wA}';`)).toBe("false");

    const rA = await verdict(ctx.mcA, versionOf(ctx.mcA), "flawed_confirmed");
    expect((rA.json as RpcJson).sessionWorksAdjusted).toBe(1);
    const rB = await verdict(ctx.mcB, versionOf(ctx.mcB), "key_wrong_confirmed");
    expect((rB.json as RpcJson).sessionWorksAdjusted).toBe(1);

    // A: 채점 전이라 자동 채점만 정답으로, 조정 대상 아님
    expect(psql(`select auto_correct::text || ',' || error_adjustment_pending::text || ',' || (error_adjusted_at is not null)::text from session_problem_work where id = '${wA}';`)).toBe("true,false,true");
    // B: 수동 채점('incorrect') 유지 + 조정 대상
    expect(psql(`select grade || ',' || error_adjustment_pending::text || ',' || auto_correct::text from session_problem_work where id = '${wB}';`)).toBe("incorrect,true,true");

    // 학생은 조정 표시 컬럼 2개만 읽을 수 있고 verdict id·auto_correct 는 못 읽는다
    const ok = await rest(STUDENT_ID, `session_problem_work?select=error_adjusted_at,error_adjustment_pending&id=eq.${wB}`);
    expect(ok.status).toBe(200);
    expect((ok.json as { error_adjustment_pending: boolean }[])[0].error_adjustment_pending).toBe(true);
    expect([401, 403]).toContain((await rest(STUDENT_ID, `session_problem_work?select=error_adjustment_verdict_id&id=eq.${wB}`)).status);
    expect([401, 403]).toContain((await rest(STUDENT_ID, `session_problem_work?select=auto_correct&id=eq.${wB}`)).status);

    // 선생님이 다시 채점(무입력 = 자동 채점 확정 → 정답) → 조정 대상 해제
    asUser(TEACHER_ID, `select grade_problem_attempt('${wB}', null, null);`);
    expect(psql(`select grade || ',' || error_adjustment_pending::text from session_problem_work where id = '${wB}';`)).toBe("correct,false");
  });

  it("판정 이후 새로 제출한 풀이도 같은 기준으로 자동 채점된다", () => {
    const w2 = psql(`select start_problem_work('${ctx.sessionId}', '${STUDENT_ID}', '${ctx.mcA}', true);`);
    psql(`select submit_problem_attempt('${w2}', '${STUDENT_ID}', 0, null);`);
    expect(psql(`select auto_correct::text from session_problem_work where id = '${w2}';`)).toBe("true");
  });

  it("오류 아님으로 바뀌면 자동 채점은 원채점으로 복원된다(수동 채점은 그대로)", async () => {
    await verdict(ctx.mcA, versionOf(ctx.mcA), "not_error");
    expect(psql(`select string_agg(auto_correct::text || ',' || error_adjustment_pending::text, ';' order by attempt_no) from session_problem_work where session_id = '${ctx.sessionId}' and problem_id = '${ctx.mcA}';`)).toBe("false,false;false,false");
    const w = psql(`select id from session_problem_work where session_id = '${ctx.sessionId}' and problem_id = '${ctx.mcB}' limit 1;`);
    expect(psql(`select grade from session_problem_work where id = '${w}';`)).toBe("correct"); // 선생님이 다시 채점한 결과 유지
  });
});

describe("학부모: 조정된 결과는 읽되 신고는 못 한다(연결된 자녀 응시)", () => {
  it("보호자 결과·요약은 조정 채점 기준, 경로 단서 없음, 신고 RPC 는 거부", async () => {
    const f = createRoutingSet({ run: RUN, label: "guardian" });
    const att = assign(SEED_STUDENT_ID, f.setId);
    finishAttempt(SEED_STUDENT_ID, att, f, 4, f.ids.rw_higher);
    const item = f.ids.rw_higher[0]; // 오답 처리된 경로 문항
    const [p, v] = itemProblem(item);
    const r = await verdict(p, v, "key_wrong_confirmed");
    expect((r.json as RpcJson).mockAdjustedAnswers).toBe(1);
    const detail = await rest(SEED_GUARDIAN_ID, "rpc/mock_exam_attempt_detail", { method: "POST", body: { p_attempt_id: att } });
    expect(detail.status).toBe(200);
    const d = detail.json as { scoreAdjusted: boolean; routing?: unknown; items: { setItemId: string; correct: boolean | null; adjusted: boolean }[] };
    expect(d.scoreAdjusted).toBe(true);
    expect(d.routing).toBeUndefined();
    expect(d.items.find((i2) => i2.setItemId === item)).toMatchObject({ correct: true, adjusted: true });
    expect(detail.text).not.toMatch(/higher|lower|policy|threshold/i);
    const sums = await rest(SEED_GUARDIAN_ID, "rpc/mock_exam_attempt_summaries", { method: "POST", body: { p_student_id: SEED_STUDENT_ID } });
    const mine = (sums.json as { id: string; scoreAdjusted: boolean; correctCount: number }[]).find((x) => x.id === att)!;
    expect(mine.scoreAdjusted).toBe(true);
    expect(mine.correctCount).toBe(d.items.filter((x) => x.correct).length);
    const rep = await mockReport(SEED_GUARDIAN_ID, att, item, "wrong_key");
    expect(rep.status).toBeGreaterThanOrEqual(400);
    expect(JSON.stringify(rep.json)).toContain("학생과 선생님만");
  });
});

describe("대량 신고 성능: 문항 300개 신고에서도 목록 한 번의 RPC·인덱스 스캔", () => {
  it("관리자 목록은 한 RPC 로 끝나고 열린 신고 부분 인덱스를 쓴다", async () => {
    const reporter = createStudent("erMass", RUN);
    psql(`insert into problems (format, passage, subject_id, status, created_by, sat_domain)
          select 'mc', 'R3 mass ${RUN} ' || g, '${SUBJECT_ID}', 'confirmed', '${ADMIN_ID}', 'algebra' from generate_series(1, 300) g;`);
    psql(`insert into problem_error_reports (problem_id, problem_version_id, source, session_id, session_source, reporter_id, reporter_role, report_type)
          select p.id, p.published_version_id, 'session_assignment', (select id from sessions limit 1), 'lesson', '${reporter}', 'student', 'wrong_key'
          from problems p where p.passage like 'R3 mass ${RUN} %' and p.published_version_id is not null;`);
    const n = Number(psql(`select count(*) from problem_error_reports where reporter_id = '${reporter}';`));
    if (n === 0) {
      // 신규 문항에 공개 버전이 자동으로 없으면 버전 id 로 대체
      psql(`insert into problem_error_reports (problem_id, problem_version_id, source, session_id, session_source, reporter_id, reporter_role, report_type)
            select p.id, (select v.id from problem_versions v where v.problem_id = p.id limit 1), 'session_assignment', (select id from sessions limit 1), 'lesson', '${reporter}', 'student', 'flawed_problem'
            from problems p where p.passage like 'R3 mass ${RUN} %';`);
    }
    const t0 = Date.now();
    const res = await rest(ADMIN_ID, "rpc/problem_error_report_groups", { method: "POST", body: { p_status: "open", p_limit: 50, p_offset: 0 } });
    const ms = Date.now() - t0;
    expect(res.status).toBe(200);
    const j = res.json as { total: number; rows: unknown[] };
    expect(j.total).toBeGreaterThanOrEqual(300);
    expect(j.rows).toHaveLength(50);
    expect(ms).toBeLessThan(3000);
    const plan = psql(`explain select problem_id, problem_version_id, count(*) from problem_error_reports where resolved_verdict_id is null group by 1, 2;`);
    expect(plan.length).toBeGreaterThan(0);
    // 플래그 갱신 트리거는 이미 true 인 문항 행을 다시 쓰지 않는다: 같은 문항 재신고(다른 신고자)로 flagged_at 이 바뀌지 않는다.
    const reporter2 = createStudent("erMass2", RUN);
    const one = psql(`select problem_id || '|' || problem_version_id from problem_error_reports where reporter_id = '${reporter}' limit 1;`).split("|");
    const flaggedBefore = psql(`select error_review_flagged_at from problems where id = '${one[0]}';`);
    psql(`insert into problem_error_reports (problem_id, problem_version_id, source, session_id, session_source, reporter_id, reporter_role, report_type)
          values ('${one[0]}', '${one[1]}', 'session_assignment', (select id from sessions limit 1), 'lesson', '${reporter2}', 'student', 'wrong_key');`);
    expect(psql(`select error_review_flagged_at from problems where id = '${one[0]}';`)).toBe(flaggedBefore);
  }, 60000);
});
