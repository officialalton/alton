import { createHmac } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { cleanupPerRunTeacher, createPerRunTeacher } from "@/test/per-run-teacher";
import { insertReservationInBand } from "@/test/reservation-slots";
import { loadSessionProblems } from "./session-problem-data";

// 2026-09-29 포털 점검 후속 — 자동 채점 결과(session_problem_work.auto_correct)와 모의고사 모듈 원점수
// (mock_exam_attempt_modules.raw_correct_count)는 교사 채점 전에 학생·학부모가 REST 로 읽지 못한다.
// 채점(graded_at) 뒤에는 본인 학생·보호자가 session_problem_auto_correct() 로 읽고, 교사·관리자는 항상 읽는다.
// 실행마다 전용 선생님·수업을 새로 만들고 그 행만 본다.

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const API_URL = "http://127.0.0.1:54421";
const JWT_SECRET = "super-secret-jwt-token-with-at-least-32-characters-long";
const ADMIN_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const PARENT_ID = "bbbbbbbb-0000-0000-0000-000000000001";
const STUDENT_ID = "cccccccc-0000-0000-0000-000000000001";
const OTHER_STUDENT_ID = "cccccccc-0000-0000-0000-000000000002";
const HOUSEHOLD_ID = "aabbccdd-0000-0000-0000-000000000001";
const SUBJECT_ID = "eeeeeeee-0000-0000-0000-000000000001";
let TEACHER_ID: string;

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], { encoding: "utf-8" }).trim();
}
function asUser(userId: string, sql: string): string {
  return psql(`
    set role authenticated;
    do $$ begin perform set_config('request.jwt.claim.sub', '${userId}', false); end $$;
    ${sql}
    reset role;
  `);
}
function quote(text: string): string {
  return `'${text.replace(/'/g, "''")}'`;
}
function tokenFor(payload: object): string {
  const enc = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const head = enc({ alg: "HS256", typ: "JWT" });
  const body = enc({ ...payload, exp: Math.floor(Date.now() / 1000) + 3600 });
  return `${head}.${body}.${createHmac("sha256", JWT_SECRET).update(`${head}.${body}`).digest("base64url")}`;
}
function clientWith(token: string): SupabaseClient {
  return createClient(API_URL, token, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
}
const clientFor = (userId: string) => clientWith(tokenFor({ sub: userId, role: "authenticated", aud: "authenticated" }));
const serviceClient = () => clientWith(tokenFor({ role: "service_role", iss: "supabase-demo" }));

let baseUnitId: string;

beforeAll(() => {
  TEACHER_ID = createPerRunTeacher(psql, { emailPrefix: "auto-correct-leak" });
  baseUnitId = psql(`select id from subject_template_units where subject_id = '${SUBJECT_ID}' order by position limit 1;`);
});
afterAll(() => cleanupPerRunTeacher(psql, TEACHER_ID));

/** 객관식 1개(정답 1) · 서술형 1개를 고정한 채 시작된 수업. */
function startedSession(): { sessionId: string; mcId: string; essayId: string } {
  const contractId = psql(
    `insert into contracts (household_id, child_id, status) values ('${HOUSEHOLD_ID}', '${STUDENT_ID}', 'draft') returning id;`
  );
  const enrollmentId = psql(
    `insert into subject_enrollments (child_id, subject_id, contract_id, status)
     values ('${STUDENT_ID}', '${SUBJECT_ID}', '${contractId}', 'planned') returning id;`
  );
  psql(
    `insert into teacher_assignments (subject_enrollment_id, teacher_id, status, effective_from)
     values ('${enrollmentId}', '${TEACHER_ID}', 'active', now() - interval '1 day');`
  );
  const overlayId = asUser(TEACHER_ID, `insert into student_curriculum_overlays (subject_enrollment_id) values ('${enrollmentId}') returning id;`);
  const overlayUnitId = asUser(
    TEACHER_ID,
    `insert into curriculum_overlay_units (overlay_id, source_unit_id, position, unit_title)
     values ('${overlayId}', '${baseUnitId}', 1, '채점 회차') returning id;`
  );
  const keywordId = psql(
    `insert into subject_keywords (subject_id, label) values ('${SUBJECT_ID}', '채점 ${Date.now()}_${Math.random()}') returning id;`
  );
  asUser(TEACHER_ID, `insert into curriculum_overlay_unit_keywords (overlay_unit_id, keyword_id) values ('${overlayUnitId}', '${keywordId}');`);

  function problem(format: "mc" | "essay", passage: string, correct: number | null): string {
    const id = psql(
      `insert into problems (format, passage, subject_id, status, created_by)
       values ('${format}', ${quote(passage)}, '${SUBJECT_ID}', 'confirmed', '${TEACHER_ID}') returning id;`
    );
    psql(`insert into problem_keywords (problem_id, keyword_id) values ('${id}', '${keywordId}');`);
    psql(
      `update problem_versions set options = ${format === "mc" ? `'["가","나","다","라"]'::jsonb` : "null"},
       correct_index = ${correct === null ? "null" : correct}, explanation = '해설', difficulty = 'medium',
       question = '다음 중 옳은 것은?'
       where problem_id = '${id}';`
    );
    return id;
  }
  const mcId = problem("mc", "객관식 지문", 1);
  const essayId = problem("essay", "서술형 지문", null);

  const prepId = asUser(
    TEACHER_ID,
    `insert into curriculum_unit_preps (overlay_unit_id, created_by) values ('${overlayUnitId}', '${TEACHER_ID}') on conflict (overlay_unit_id) do update set created_by = excluded.created_by returning id;`
  );
  asUser(
    TEACHER_ID,
    `insert into curriculum_unit_prep_items (prep_id, content_type, content_id, position) values
     ('${prepId}', 'problem', '${mcId}', 1), ('${prepId}', 'problem', '${essayId}', 2);`
  );
  const reservationId = insertReservationInBand(psql, { band: "problem-grading", enrollmentId: enrollmentId, teacherId: TEACHER_ID });
  const sessionId = psql(
    `insert into sessions (reservation_id, subject_enrollment_id, teacher_id, lesson_type_id, scheduled_duration_minutes)
     values ('${reservationId}', '${enrollmentId}', '${TEACHER_ID}', (select id from lesson_types where code = 'regular'), 60)
     returning id;`
  );
  psql(`select link_unit_prep_to_session('${overlayUnitId}', '${sessionId}', '${TEACHER_ID}');`);
  psql(`select mark_lesson_session_started('${sessionId}', '${TEACHER_ID}');`);
  return { sessionId, mcId, essayId };
}

function studentWork(sessionId: string, problemId: string): string {
  return psql(`select start_problem_work('${sessionId}', '${STUDENT_ID}', '${problemId}', false);`);
}

let ctx: { sessionId: string; mcId: string; essayId: string; workId: string };

const autoRows = async (userId: string, workIds: string[]) => {
  const { data, error } = await clientFor(userId).rpc("session_problem_auto_correct", { p_work_ids: workIds });
  expect(error).toBeNull();
  return (data ?? []) as { work_id: string; auto_correct: boolean | null }[];
};

describe("session_problem_work.auto_correct", () => {
  it("제출 직후(채점 전): 학생·학부모·교사 모두 컬럼 직접 조회·필터·정렬이 막히고 나머지 컬럼은 읽힌다", async () => {
    const s = startedSession();
    const workId = studentWork(s.sessionId, s.mcId);
    psql(`select submit_problem_attempt('${workId}', '${STUDENT_ID}', 1, null);`);
    ctx = { ...s, workId };
    expect(psql(`select auto_correct from session_problem_work where id = '${workId}';`)).toBe("t"); // 서버는 계산해 둔다.
    for (const userId of [STUDENT_ID, PARENT_ID, TEACHER_ID, ADMIN_ID]) {
      const c = clientFor(userId);
      for (const cols of ["auto_correct", "id,auto_correct", "*"]) {
        const { data, error } = await c.from("session_problem_work").select(cols).eq("id", workId);
        expect(error?.code, `${userId} select=${cols}`).toBe("42501");
        expect(data).toBeNull();
      }
      expect((await c.from("session_problem_work").select("id").eq("auto_correct", true).eq("id", workId)).error?.code).toBe("42501");
      expect((await c.from("session_problem_work").select("id").eq("session_id", s.sessionId).order("auto_correct")).error?.code).toBe("42501");
    }
    for (const userId of [STUDENT_ID, PARENT_ID, TEACHER_ID]) {
      const { data, error } = await clientFor(userId)
        .from("session_problem_work")
        .select("id, submitted_choice_index, submitted_at, grade, graded_at")
        .eq("id", workId);
      expect(error, `${userId}`).toBeNull();
      expect(data).toHaveLength(1);
      expect(data![0].submitted_choice_index).toBe(1);
      expect(data![0].graded_at).toBeNull();
    }
  });

  it("채점 전 RPC: 학생·학부모·무관한 학생은 비어 있고, 담당 교사·관리자는 정오를 읽는다", async () => {
    expect(await autoRows(STUDENT_ID, [ctx.workId])).toEqual([]);
    expect(await autoRows(PARENT_ID, [ctx.workId])).toEqual([]);
    expect(await autoRows(OTHER_STUDENT_ID, [ctx.workId])).toEqual([]);
    for (const userId of [TEACHER_ID, ADMIN_ID]) {
      expect(await autoRows(userId, [ctx.workId]), userId).toEqual([{ work_id: ctx.workId, auto_correct: true }]);
    }
    // anon 은 함수 자체를 실행하지 못한다.
    const anon = createClient(API_URL, tokenFor({ role: "anon", aud: "authenticated" }), { auth: { persistSession: false } });
    expect((await anon.rpc("session_problem_auto_correct", { p_work_ids: [ctx.workId] })).error).not.toBeNull();
  });

  it("앱 로더: 학생 JWT 로 읽어도 채점 전 정오가 없고, 교사 로더는 채점 전에도 정오를 본다", async () => {
    const student = await loadSessionProblems(clientFor(STUDENT_ID), ctx.sessionId, { canSeeAnswers: false, studentId: STUDENT_ID });
    const sp = student.find((p) => p.problemId === ctx.mcId)!;
    expect(sp.solved).toBe(true);
    expect(sp.myChoice).toBe(1);
    expect(sp.autoCorrect).toBeNull();
    expect(sp.correctIndex).toBeNull();
    const teacher = await loadSessionProblems(clientFor(TEACHER_ID), ctx.sessionId, { canSeeAnswers: true, studentId: STUDENT_ID });
    expect(teacher.find((p) => p.problemId === ctx.mcId)!.autoCorrect).toBe(true);
  });

  it("교사 채점 후: 본인 학생·학부모가 정오를 읽고 앱 로더도 채워 준다. 교사 채점 흐름(무입력 확정)은 그대로", async () => {
    asUser(TEACHER_ID, `select grade_problem_attempt('${ctx.workId}', null, null);`); // auto_correct 로 확정
    expect(psql(`select grade from session_problem_work where id = '${ctx.workId}';`)).toBe("correct");
    for (const userId of [STUDENT_ID, PARENT_ID]) {
      expect(await autoRows(userId, [ctx.workId]), userId).toEqual([{ work_id: ctx.workId, auto_correct: true }]);
    }
    expect(await autoRows(OTHER_STUDENT_ID, [ctx.workId])).toEqual([]);
    const student = await loadSessionProblems(clientFor(STUDENT_ID), ctx.sessionId, { canSeeAnswers: false, studentId: STUDENT_ID });
    const sp = student.find((p) => p.problemId === ctx.mcId)!;
    expect(sp.graded).toBe(true);
    expect(sp.autoCorrect).toBe(true);
    expect(sp.correctIndex).toBe(1);
  });

  it("다음 회차는 다시 채점 전 상태 — 최신 풀이 기준으로 가려진다", async () => {
    const s = startedSession();
    const w1 = studentWork(s.sessionId, s.mcId);
    psql(`select submit_problem_attempt('${w1}', '${STUDENT_ID}', 0, null);`);
    asUser(TEACHER_ID, `select grade_problem_attempt('${w1}', 'incorrect', null);`);
    const w2 = psql(`select start_problem_work('${s.sessionId}', '${STUDENT_ID}', '${s.mcId}', true);`);
    psql(`select submit_problem_attempt('${w2}', '${STUDENT_ID}', 1, null);`);
    expect(await autoRows(STUDENT_ID, [w1, w2])).toEqual([{ work_id: w1, auto_correct: false }]);
    expect(await autoRows(TEACHER_ID, [w1, w2])).toHaveLength(2);
  });

  it("problem_response_stats 뷰는 학생·학부모 직접 조회가 막히고 서비스 클라이언트(관리자 화면)는 읽는다", async () => {
    for (const userId of [STUDENT_ID, PARENT_ID]) {
      expect((await clientFor(userId).from("problem_response_stats").select("problem_id").limit(1)).error?.code, userId).toBe("42501");
    }
    const { data, error } = await serviceClient().from("problem_response_stats").select("problem_id, responses, correct_pct").eq("problem_id", ctx.mcId);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });
});

describe("mock_exam_attempt_modules.raw_correct_count", () => {
  it("학생·학부모·교사 JWT 는 원점수 컬럼을 REST 로 읽지 못하고 나머지 컬럼은 읽는다", async () => {
    for (const userId of [STUDENT_ID, PARENT_ID, TEACHER_ID]) {
      const c = clientFor(userId);
      for (const cols of ["raw_correct_count", "*"]) {
        expect((await c.from("mock_exam_attempt_modules").select(cols).limit(1)).error?.code, `${userId} ${cols}`).toBe("42501");
      }
      expect((await c.from("mock_exam_attempt_modules").select("id, module_key, locked, submitted_at").limit(1)).error).toBeNull();
    }
  });
});
