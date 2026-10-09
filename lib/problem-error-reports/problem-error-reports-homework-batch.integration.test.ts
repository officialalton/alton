import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cleanupPerRunTeacher, createPerRunTeacher } from "@/test/per-run-teacher";
import { ADMIN_ID, SEED_GUARDIAN_ID, SUBJECT_ID, createStudent, psql, rest } from "@/test/mock-exam-routing-fixture";

// 과제 묶음(homework_batches, 문항 스냅샷 jsonb) 출처의 오류 신고·판정·채점 조정 — 실제 로컬 DB/PostgREST.
// 실행 ID(RUN)가 붙은 전용 선생님·학생·문항·배치만 쓴다(공유 시드는 읽지도 쓰지도 않는다). 재실행 안전.
// 판정 처리 기대: 오류 확정(정답 오류·문제 자체 오류)=문항 보관 + 제출된 과제 묶음 문항 전원 정답(mc/spr autoCorrect=true),
//   이미 교사가 채점한 문항은 grade 를 덮어쓰지 않고 '조정 대상'(errorAdjustmentPending)만 표시, 교사가 재채점하면 해제.
//   해설 오류=보관·채점 변경 없음. 오류 아님=조정 원복. 과제 묶음은 여분 문항 자동 교체 대상이 아니다.

const RUN = randomUUID().slice(0, 8);
let TEACHER: string; // 발급 교사
let OTHER_TEACHER: string;
let STUDENT: string;
let OTHER_STUDENT: string;
const P: Record<string, string> = {}; // 문항 id

type Item = Record<string, unknown>;
const q = (t: string) => `'${t.replace(/'/g, "''")}'`;
const mkProblem = (label: string) => {
  const id = psql(`insert into problems (format, passage, subject_id, status, created_by) values ('mc', ${q(`과제 신고 ${label} ${RUN}`)}, '${SUBJECT_ID}', 'confirmed', '${TEACHER}') returning id;`);
  psql(`update problem_versions set options = '["가","나","다","라"]'::jsonb, correct_index = 1, explanation = '해설', difficulty = 'medium', question = '다음 중 옳은 것은?' where problem_id = '${id}';`);
  return id;
};
const item = (problemId: string, position: number, o: Partial<Item> = {}): Item => ({
  problemId, position, format: "mc", passage: `p${position}`, question: "다음 중 옳은 것은?", options: ["가", "나", "다", "라"],
  correctIndex: 1, answers: null, explanation: "해설", statements: null, figure: null,
  response: null, submittedAt: null, autoCorrect: null, graded: false, gradedAt: null, grade: null, gradeComment: null, ...o,
});
const submitted = (problemId: string, position: number, o: Partial<Item> = {}) =>
  item(problemId, position, { response: "0", submittedAt: new Date().toISOString(), autoCorrect: false, ...o });
const mkBatch = (teacher: string, student: string, items: Item[]) =>
  psql(`insert into homework_batches (teacher_id, student_id, label, items) values ('${teacher}', '${student}', ${q(`신고 ${RUN}`)}, ${q(JSON.stringify(items))}::jsonb) returning id;`);
const itemsOf = (batchId: string): Item[] => JSON.parse(psql(`select items from homework_batches where id = '${batchId}';`));
const itemOf = (batchId: string, problemId: string) => itemsOf(batchId).find((i) => i.problemId === problemId)!;
const versionOf = (problemId: string) => psql(`select published_version_id from problems where id = '${problemId}';`);

type RpcJson = Record<string, unknown>;
const report = (uid: string, batchId: string | null, problemId: string, type = "wrong_key", memo?: string) =>
  rest(uid, "rpc/problem_error_report_submit", { method: "POST", body: { p_source: "homework_batch", p_report_type: type, p_memo: memo ?? null, p_homework_batch_id: batchId, p_problem_id: problemId } });
const verdict = (problemId: string, decision: string) =>
  rest(ADMIN_ID, "rpc/problem_error_apply_verdict", { method: "POST", body: { p_problem_id: problemId, p_version_id: versionOf(problemId), p_decision: decision, p_note: null } });
const submitAnswer = (uid: string, batchId: string, problemId: string, response: string) =>
  rest(uid, "rpc/homework_submit_answer", { method: "POST", body: { p_batch_id: batchId, p_problem_id: problemId, p_response: response } });
const regrade = (uid: string, batchId: string, problemId: string, grade: string | null) =>
  rest(uid, "rpc/homework_regrade_item", { method: "POST", body: { p_batch_id: batchId, p_problem_id: problemId, p_grade: grade, p_comment: null } });

let b1: string; // 주 배치: A 제출(채점 전) · B 제출+교사 채점(오답) · C 미제출 · D 제출+교사 채점(정답)
let b2: string; // 판정 이후 새로 제출되는 답 검증용(A 미제출)
let bOther: string; // 다른 학생·다른 교사의 배치

beforeAll(() => {
  TEACHER = createPerRunTeacher(psql, { emailPrefix: "hw-report" });
  OTHER_TEACHER = createPerRunTeacher(psql, { emailPrefix: "hw-report-other" });
  STUDENT = createStudent("hwA", RUN);
  OTHER_STUDENT = createStudent("hwB", RUN);
  for (const k of ["A", "B", "C", "D", "E"]) P[k] = mkProblem(k);
  b1 = mkBatch(TEACHER, STUDENT, [
    submitted(P.A, 1),
    submitted(P.B, 2, { graded: true, gradedAt: new Date().toISOString(), grade: "incorrect", gradeComment: "다시 풀어 보자", savedToPractice: true }),
    item(P.C, 3),
    submitted(P.D, 4, { graded: true, gradedAt: new Date().toISOString(), grade: "correct", response: "1", autoCorrect: true }),
  ]);
  b2 = mkBatch(TEACHER, STUDENT, [item(P.A, 1), item(P.E, 2)]);
  bOther = mkBatch(OTHER_TEACHER, OTHER_STUDENT, [submitted(P.A, 1)]);
});
afterAll(() => cleanupPerRunTeacher(psql, TEACHER));

describe("신고: 권한 매트릭스·유형·중복", () => {
  it("학생은 본인 배치, 발급 교사는 자기 배치 문항을 신고하고 같은 원본(출처 homework_batch)에 쌓인다", async () => {
    const s = await report(STUDENT, b1, P.A, "flawed_problem");
    expect(s.status).toBe(200);
    expect((s.json as RpcJson).duplicate).toBe(false);
    expect((await report(TEACHER, b1, P.A, "bad_explanation")).status).toBe(200);
    expect((await report(STUDENT, b1, P.B, "wrong_key")).status).toBe(200);
    expect((await report(STUDENT, b1, P.D, "wrong_key")).status).toBe(200);
    const row = psql(`select source || '|' || homework_batch_id::text || '|' || coalesce(session_source, '-') || '|' || reporter_role from problem_error_reports where problem_id = '${P.A}' and reporter_id = '${STUDENT}';`);
    expect(row).toBe(`homework_batch|${b1}|-|student`);
    expect(psql(`select error_review_needed::text from problems where id = '${P.A}';`)).toBe("true");
  });

  it("같은 신고자·같은 문항 재신고는 duplicate(고유 제약), 신고자 상태는 '검토 중'", async () => {
    const dup = await report(STUDENT, b1, P.A, "other", "표가 깨져 보임");
    expect(dup.status).toBe(200);
    expect((dup.json as RpcJson).duplicate).toBe(true);
    expect(psql(`select count(*) from problem_error_reports where reporter_id = '${STUDENT}' and problem_id = '${P.A}';`)).toBe("1");
    const mine = await rest(STUDENT, "rpc/problem_error_report_mine", { method: "POST", body: { p_problem_ids: [P.A] } });
    expect((mine.json as { status: string }[])[0].status).toBe("reviewing");
  });

  it("해설 오류는 선생님만, 기타는 메모 필수, 학부모·관리자·다른 학생·다른 교사·배치 밖 문항은 거부", async () => {
    expect(JSON.stringify((await report(STUDENT, b1, P.C, "bad_explanation")).json)).toContain("Only teachers can report an explanation error");
    expect(JSON.stringify((await report(TEACHER, b1, P.C, "other")).json)).toContain("Please describe the issue");
    for (const uid of [SEED_GUARDIAN_ID, ADMIN_ID]) expect((await report(uid, b1, P.C)).status, uid).toBeGreaterThanOrEqual(400);
    // 다른 학생·다른 교사는 남의 배치 존재 여부를 알 수 없다(같은 메시지).
    for (const uid of [OTHER_STUDENT, OTHER_TEACHER]) {
      expect(JSON.stringify((await report(uid, b1, P.C)).json), uid).toContain("Only problems issued in this homework can be reported.");
    }
    // 배치에 없는 문항
    expect(JSON.stringify((await report(STUDENT, b1, P.E)).json)).toContain("Only problems issued in this homework can be reported.");
    // 배치 id 누락
    expect((await report(STUDENT, null, P.C)).status).toBeGreaterThanOrEqual(400);
    expect(psql(`select count(*) from problem_error_reports where problem_id = '${P.C}';`)).toBe("0");
  });

  it("직접 쓰기·타인 신고 조회는 닫혀 있다", async () => {
    const ins = await rest(STUDENT, "problem_error_reports", { method: "POST", body: { problem_id: P.C, problem_version_id: versionOf(P.C), source: "homework_batch", reporter_id: STUDENT, reporter_role: "student", report_type: "wrong_key" } });
    expect(ins.status).toBeGreaterThanOrEqual(400);
    const others = await rest(OTHER_STUDENT, `problem_error_reports?problem_id=eq.${P.A}`);
    expect(others.json).toEqual([]);
  });
});

describe("판정: 오류 확정 → 과제 묶음 전원 정답, 수동 채점 미덮어쓰기", () => {
  it("문제 자체 오류 확정(A): 제출된 모든 배치의 A 를 정답 처리(채점 전), 미제출 문항은 그대로, 문항 보관·신고 종결", async () => {
    const r = await verdict(P.A, "flawed_confirmed");
    expect(r.status).toBe(200);
    // b1 의 A + bOther 의 A (b2 의 A 는 미제출이라 대상 아님)
    expect((r.json as RpcJson).homeworkItemsAdjusted).toBe(2);
    const a = itemOf(b1, P.A);
    expect([a.autoCorrect, a.errorAdjustmentPending, typeof a.errorAdjustedAt, a.graded, a.grade]).toEqual([true, false, "string", false, null]);
    expect(itemOf(bOther, P.A).autoCorrect).toBe(true);
    expect(itemOf(b2, P.A).autoCorrect).toBeNull();
    expect(itemOf(b2, P.A).errorAdjustedAt).toBeUndefined();
    expect(psql(`select (archived_at is not null)::text || ',' || error_review_needed::text from problems where id = '${P.A}';`)).toBe("true,false");
    expect(psql(`select count(*) from problem_error_reports where problem_id = '${P.A}' and resolved_verdict_id is not null;`)).toBe("2");
    // 과제 묶음은 여분 문항 자동 교체 대상이 아니다: 세트 칸이 없으므로 '세트 밖' 큐 1건만 열려 있고 교체 이력은 없다.
    expect((r.json as RpcJson).autoReplaced).toBe(0);
    expect(psql(`select in_mock_set::text from problem_replacement_needs where problem_id = '${P.A}';`)).toBe("false");
  });

  it("정답 오류 확정(B): 교사가 이미 채점한 오답은 덮어쓰지 않고 '조정 대상'으로만 표시, 이미 정답이던 D 는 표시 없이 유지", async () => {
    const r = await verdict(P.B, "key_wrong_confirmed");
    expect((r.json as RpcJson).homeworkItemsAdjusted).toBe(1);
    const b = itemOf(b1, P.B);
    expect([b.grade, b.graded, b.errorAdjustmentPending, typeof b.errorAdjustedAt, b.autoCorrect, b.gradeComment]).toEqual(["incorrect", true, true, "string", true, "다시 풀어 보자"]);
    const d = await verdict(P.D, "flawed_confirmed");
    expect((d.json as RpcJson).homeworkItemsAdjusted).toBe(1);
    const di = itemOf(b1, P.D);
    expect([di.grade, di.errorAdjustmentPending, di.errorAdjustedAt ?? null]).toEqual(["correct", false, null]);
    // 미제출 C 는 판정이 없어도 손대지 않는다.
    expect(itemOf(b1, P.C).errorAdjustmentVerdictId).toBeUndefined();
  });

  it("학생 읽기 경로: 채점 전 문항은 자동채점·정답이 가려지고, 채점된 조정 대상 문항은 안내 표시 키를 본다. 직접 UPDATE 는 불가", async () => {
    const res = await rest(STUDENT, "rpc/homework_batches_for_viewer", { method: "POST", body: { p_student_id: STUDENT } });
    expect(res.status).toBe(200);
    const items = ((res.json as { id: string; items: Item[] }[]).find((b) => b.id === b1) as { items: Item[] }).items;
    const a = items.find((i) => i.problemId === P.A)!;
    expect([a.autoCorrect, a.correctIndex]).toEqual([null, null]); // 채점 전 마스킹
    const b = items.find((i) => i.problemId === P.B)!;
    expect([b.grade, b.errorAdjustmentPending, typeof b.errorAdjustedAt]).toEqual(["incorrect", true, "string"]);
    const upd = await rest(STUDENT, `homework_batches?id=eq.${b1}`, { method: "PATCH", body: { items: [] } });
    expect(Array.isArray(upd.json) ? (upd.json as unknown[]).length : 0).toBe(0);
    expect(itemsOf(b1).length).toBe(4);
  });

  it("선생님 재채점: 발급 교사만, 조정 대상 문항만 — 재채점하면 표시가 해제되고 오답이면 Practice 에 저장", async () => {
    expect(JSON.stringify((await regrade(OTHER_TEACHER, b1, P.B, "correct")).json)).toContain("발급한 교사만");
    expect((await regrade(STUDENT, b1, P.B, "correct")).status).toBeGreaterThanOrEqual(400);
    expect(JSON.stringify((await regrade(TEACHER, b1, P.D, "correct")).json)).toContain("조정 대상 문항이 아닙니다");
    expect((await regrade(TEACHER, b1, P.B, "wrong")).status).toBeGreaterThanOrEqual(400);
    const ok = await regrade(TEACHER, b1, P.B, "correct");
    expect(ok.status).toBeLessThan(300);
    const b = itemOf(b1, P.B);
    expect([b.grade, b.errorAdjustmentPending, b.graded]).toEqual(["correct", false, true]);
    // 이미 해제된 문항은 다시 재채점 대상이 아니다(멱등 차단)
    expect(JSON.stringify((await regrade(TEACHER, b1, P.B, "correct")).json)).toContain("조정 대상 문항이 아닙니다");
  });

  it("판정 이후 새로 제출되는 답도 같은 기준으로 자동 채점된다(학생 제출 RPC)", async () => {
    expect((await submitAnswer(STUDENT, b2, P.A, "0")).status).toBeLessThan(300);
    const a = itemOf(b2, P.A);
    expect([a.autoCorrect, a.errorAdjustmentPending, typeof a.errorAdjustedAt]).toEqual([true, false, "string"]);
    // 판정 없는 문항(E)은 원채점(오답)
    expect((await submitAnswer(STUDENT, b2, P.E, "0")).status).toBeLessThan(300);
    expect(itemOf(b2, P.E).autoCorrect).toBe(false);
    expect(itemOf(b2, P.E).errorAdjustedAt).toBeUndefined();
  });

  it("같은 판정 재적용은 멱등: 새 판정 행·배치 변경 없음(alreadyApplied)", async () => {
    const before = JSON.stringify(itemsOf(b1)) + JSON.stringify(itemsOf(b2));
    const again = await verdict(P.A, "flawed_confirmed");
    expect((again.json as RpcJson).alreadyApplied).toBe(true);
    expect(JSON.stringify(itemsOf(b1)) + JSON.stringify(itemsOf(b2))).toBe(before);
    expect(psql(`select count(*) from problem_error_verdicts where problem_id = '${P.A}';`)).toBe("1");
  });

  it("동시에 같은 판정 2건: 하나만 적용되고 배치 문항은 한 번만 조정된다", async () => {
    const [x, y] = await Promise.all([verdict(P.E, "key_wrong_confirmed"), verdict(P.E, "key_wrong_confirmed")]);
    const applied = [x, y].filter((r) => (r.json as RpcJson).alreadyApplied === false);
    expect(applied.length).toBe(1);
    expect(psql(`select count(*) from problem_error_verdicts where problem_id = '${P.E}';`)).toBe("1");
    expect(itemOf(b2, P.E).autoCorrect).toBe(true);
  });

  it("번복(오류 아님): 조정 표시·자동 채점이 원채점으로 돌아가고 교사가 재채점한 결과는 그대로", async () => {
    const r = await verdict(P.A, "not_error");
    expect((r.json as RpcJson).alreadyApplied).toBe(false);
    for (const [bid] of [[b1], [b2], [bOther]] as const) {
      const a = itemOf(bid, P.A);
      expect([a.autoCorrect, a.errorAdjustmentPending ?? false, a.errorAdjustedAt ?? null, a.errorAdjustmentVerdictId ?? null], bid).toEqual([false, false, null, null]);
    }
    // B 는 판정이 유지되므로 그대로, 재채점 결과(correct) 보존. 교사 채점된 D(정답)도 그대로.
    expect(itemOf(b1, P.B).grade).toBe("correct");
    // D 를 번복하면 자동 채점은 원채점(정답=1 제출)으로, 교사 채점은 그대로
    await verdict(P.D, "not_error");
    const d = itemOf(b1, P.D);
    expect([d.grade, d.autoCorrect, d.errorAdjustmentVerdictId ?? null]).toEqual(["correct", true, null]);
  });

  it("해설 오류 확정(C 출처 배치): 문항 보관만, 채점·자동 채점 변경 없음", async () => {
    const bC = mkBatch(TEACHER, STUDENT, [submitted(P.C, 1)]);
    expect((await report(TEACHER, bC, P.C, "bad_explanation")).status).toBe(200);
    const r = await verdict(P.C, "explanation_confirmed");
    expect((r.json as RpcJson).homeworkItemsAdjusted).toBe(0);
    const c = itemOf(bC, P.C);
    expect([c.autoCorrect, c.errorAdjustedAt ?? null, c.graded]).toEqual([false, null, false]);
    expect(psql(`select (archived_at is not null)::text from problems where id = '${P.C}';`)).toBe("true");
  });
});

describe("관리자 읽기: 출처 집계·영향 집계", () => {
  it("목록 sourceCounts 와 상세 affected.homework, 통계 출처 축에 homework_batch 가 잡힌다", async () => {
    const groups = await rest(ADMIN_ID, "rpc/problem_error_report_groups", { method: "POST", body: { p_status: "all", p_limit: 200 } });
    const g = (groups.json as { rows: { problemId: string; sourceCounts: Record<string, number> }[] }).rows.find((x) => x.problemId === P.B)!;
    expect(g.sourceCounts.homework_batch).toBe(1);
    const det = await rest(ADMIN_ID, "rpc/problem_error_report_detail", { method: "POST", body: { p_problem_id: P.B, p_version_id: versionOf(P.B) } });
    const d = det.json as { affected: { homework: { items: number; adjusted: number; pending: number } }; reports: { source: string }[] };
    expect(d.affected.homework).toEqual({ items: 1, adjusted: 1, pending: 0 });
    expect(d.reports[0].source).toBe("homework_batch");
    const stats = await rest(ADMIN_ID, "rpc/problem_error_report_stats", { method: "POST", body: { p_days: null } });
    const src = (stats.json as { axes: { source: { key: string }[] } }).axes.source.map((x) => x.key);
    expect(src).toContain("homework_batch");
    // 관리자 외에는 읽을 수 없다
    expect((await rest(STUDENT, "rpc/problem_error_report_detail", { method: "POST", body: { p_problem_id: P.B, p_version_id: versionOf(P.B) } })).status).toBeGreaterThanOrEqual(400);
  });

  it("배치가 삭제돼도(참조 set null) 신고 본문은 남는다", () => {
    const bTmp = mkBatch(TEACHER, STUDENT, [submitted(P.E, 1)]);
    psql(`insert into problem_error_reports (problem_id, problem_version_id, source, homework_batch_id, reporter_id, reporter_role, report_type)
          values ('${P.E}', '${versionOf(P.E)}', 'homework_batch', '${bTmp}', '${TEACHER}', 'teacher', 'wrong_key') on conflict do nothing;`);
    psql(`delete from homework_batches where id = '${bTmp}';`);
    expect(psql(`select (homework_batch_id is null)::text from problem_error_reports where problem_id = '${P.E}' and reporter_id = '${TEACHER}';`)).toBe("true");
  });
});
