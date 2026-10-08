import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ADMIN_ID, SUBJECT_ID, TEACHER_ID, createStudent, psql, rest } from "@/test/mock-exam-routing-fixture";

// '확인' 중간 상태 · '수정됨' 자동 분류 · 상세(그림·영어 해설) — 실제 로컬 DB/PostgREST.
// 실행 ID 가 붙은 전용 skill_code(zz<RUN>) 필터로 격리하고, afterAll 에서 이 실행의 행만 지운다.
const RUN = randomUUID().slice(0, 8);
const SKILL = `zz${RUN}`;
let pid: string; let v1: string; let v2: string; let student: string; let pidB: string; let vB: string;

const groups = async (status: string, uid: string | null = ADMIN_ID) => rest(uid, "rpc/problem_error_report_groups", { method: "POST", body: { p_status: status, p_skill: SKILL, p_limit: 50 } });
const mk = () => {
  const id = psql(`insert into problems (format, passage, subject_id, status, created_by, sat_domain, skill_code, created_via)
    values ('mc', 'CONF ${RUN} ${randomUUID().slice(0, 6)}', '${SUBJECT_ID}', 'confirmed', '${TEACHER_ID}', 'algebra', '${SKILL}', 'manual') returning id;`).split("\n")[0];
  psql(`update problem_versions set options = '["a","b"]'::jsonb, correct_index = 0, explanation = '한글', explanation_en = 'English', figure = '{"type":"data","kind":"table","title":"T","columns":["a","b"],"rows":[["x",1]]}'::jsonb, difficulty = 'medium', status = 'published', published_at = now() where problem_id = '${id}' and version_no = 1;`);
  const v = psql(`select id from problem_versions where problem_id = '${id}' and version_no = 1;`);
  psql(`update problems set published_version_id = '${v}' where id = '${id}';`);
  psql(`insert into problem_error_reports (problem_id, problem_version_id, source, session_source, reporter_id, reporter_role, report_type)
        values ('${id}', '${v}', 'session_assignment', 'homework', '${student}', 'student', 'flawed_problem');`);
  return { id, v };
};

beforeAll(() => {
  psql(`insert into problem_skill_codes (code, domain, label, sort) values ('${SKILL}', 'algebra', 'CONF ${RUN}', 9999);`);
  student = createStudent("conf1", RUN);
  ({ id: pid, v: v1 } = mk());
  ({ id: pidB, v: vB } = mk());
});

afterAll(() => {
  const ids = [pid, pidB].filter(Boolean).map((x) => `'${x}'`).join(",");
  if (!ids) return;
  psql(`set session_replication_role = replica;
    delete from problem_error_report_confirmations where problem_id in (${ids});
    delete from problem_error_reports where problem_id in (${ids});
    delete from problem_versions where problem_id in (${ids});
    delete from problems where id in (${ids});
    delete from problem_skill_codes where code = '${SKILL}';
    delete from students where id = '${student}';
    delete from profiles where id = '${student}';
    delete from auth.users where id = '${student}';`);
});

describe("확인·수정됨", () => {
  it("관리자만: 학생은 목록·확인·취소 모두 거부", async () => {
    expect((await groups("open", student)).status).not.toBe(200);
    const c = await rest(student, "rpc/problem_error_report_confirm", { method: "POST", body: { p_problem_id: pid, p_version_id: v1 } });
    expect(c.status).not.toBe(200);
    const sel = await rest(student, "problem_error_report_confirmations?select=*", {});
    expect(sel.status === 200 ? (sel.json as unknown[]).length : 0).toBe(0);
  });

  it("검토 필요 → 확인 → 확인 취소, 운영 동작(보관·판정) 없음", async () => {
    let g = (await groups("open")).json as { counts: Record<string, number>; rows: { problemId: string }[] };
    expect(g.counts).toMatchObject({ review: 2, confirmed: 0, fixed: 0, all: 2 });
    expect((await rest(ADMIN_ID, "rpc/problem_error_report_confirm", { method: "POST", body: { p_problem_id: pid, p_version_id: v1, p_note: "수정 필요" } })).status).toBe(200);
    g = (await groups("open")).json as typeof g;
    expect(g.counts).toMatchObject({ review: 1, confirmed: 1 });
    const c = (await groups("confirmed")).json as { rows: { problemId: string; state: string }[] };
    expect(c.rows.map((r) => [r.problemId, r.state])).toEqual([[pid, "confirmed"]]);
    expect(psql(`select count(*) from problem_error_verdicts where problem_id = '${pid}'`)).toBe("0");
    expect(psql(`select archived_at is null from problems where id = '${pid}'`)).toBe("t");
    expect(psql(`select count(*) from problem_error_reports where problem_id = '${pid}' and resolved_verdict_id is not null`)).toBe("0");
    const exp = await rest(ADMIN_ID, "rpc/problem_error_report_confirmed_export", { method: "POST", body: {} });
    expect((exp.json as { problemId: string; hasExplanationEn: boolean }[]).find((r) => r.problemId === pid)?.hasExplanationEn).toBe(true);
    expect((await rest(ADMIN_ID, "rpc/problem_error_report_unconfirm", { method: "POST", body: { p_problem_id: pid, p_version_id: v1 } })).status).toBe(200);
    g = (await groups("open")).json as typeof g;
    expect(g.counts).toMatchObject({ review: 2, confirmed: 0 });
  });

  it("새 공개 버전이 생기면 신고는 '수정됨'으로 분류되고 검토 필요·확인에서 빠진다(신고 행 불변)", async () => {
    await rest(ADMIN_ID, "rpc/problem_error_report_confirm", { method: "POST", body: { p_problem_id: pid, p_version_id: v1 } });
    psql(`update problem_versions set status = 'archived' where id = '${v1}';
      insert into problem_versions (problem_id, version_no, passage, options, correct_index, explanation, difficulty, status, published_at)
      select problem_id, 2, passage, options, correct_index, explanation, difficulty, 'published', now() from problem_versions where id = '${v1}';`);
    v2 = psql(`select id from problem_versions where problem_id = '${pid}' and version_no = 2;`);
    psql(`update problems set published_version_id = '${v2}' where id = '${pid}';`);
    const g = (await groups("open")).json as { counts: Record<string, number> };
    expect(g.counts).toMatchObject({ review: 1, confirmed: 0, fixed: 1, all: 2 });
    const f = (await groups("fixed")).json as { rows: { problemId: string; versionNo: number; currentVersionNo: number; state: string }[] };
    expect(f.rows).toEqual([expect.objectContaining({ problemId: pid, versionNo: 1, currentVersionNo: 2, state: "fixed" })]);
    expect(psql(`select count(*) from problem_error_reports where problem_id = '${pid}' and problem_version_id = '${v1}'`)).toBe("1");
    const d = (await rest(ADMIN_ID, "rpc/problem_error_report_detail", { method: "POST", body: { p_problem_id: pid, p_version_id: v1 } })).json as { currentVersionNo: number; version: { explanationEn: string; figure: { type: string } } };
    expect(d.currentVersionNo).toBe(2);
    expect(d.version.explanationEn).toBe("English");
    expect(d.version.figure.type).toBe("data");
    expect(vB).toBeTruthy();
  });
});
