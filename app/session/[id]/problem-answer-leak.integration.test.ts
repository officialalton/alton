import { createHmac } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import { createPerRunTeacher } from "@/test/per-run-teacher";
import { insertReservationInBand } from "@/test/reservation-slots";
import { loadSessionProblems } from "./session-problem-data";

// 2026-09-29 포털 점검 #9 — 학생·학부모가 publishable key + 로그인 JWT 로 problem_versions 의
// 정답·해설·answers 를 REST 로 직접 읽지 못해야 한다. 교사·관리자는 읽고, 학생 화면(수업 관계자용
// 함수·loadSessionProblems)은 채점 전 가리고 채점 뒤 연다. 실행마다 새 문제·수업을 만들고 그 행만 본다.

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const API_URL = "http://127.0.0.1:54421";
// 로컬 supabase 데모 JWT 시크릿 — 로컬 전용.
const JWT_SECRET = "super-secret-jwt-token-with-at-least-32-characters-long";

const ADMIN_ID = "aaaaaaaa-0000-0000-0000-000000000001";
let TEACHER_ID: string; // 실행마다 새로 만드는 전용 선생님(test/per-run-teacher.ts)
const STUDENT_ID = "cccccccc-0000-0000-0000-000000000001";
const PARENT_ID = "bbbbbbbb-0000-0000-0000-000000000001";
const HOUSEHOLD_ID = "aabbccdd-0000-0000-0000-000000000001";
const SUBJECT_ID = "eeeeeeee-0000-0000-0000-000000000001";

const RUN = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const SECRET_EXPLANATION = `SECRET-EXPL-${RUN}`;
const SECRET_ANSWER = `SECRET-ANS-${RUN}`;
const ANSWER_COLUMNS =
  "id,correct_index,explanation,explanation_en,answers,answer_rationale,evidence_target,evidence_span,distractor_error_types";

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
function jwtFor(userId: string): string {
  const enc = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const head = enc({ alg: "HS256", typ: "JWT" });
  const body = enc({ sub: userId, role: "authenticated", aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 });
  const sig = createHmac("sha256", JWT_SECRET).update(`${head}.${body}`).digest("base64url");
  return `${head}.${body}.${sig}`;
}
function clientFor(userId: string): SupabaseClient {
  const token = jwtFor(userId);
  return createClient(API_URL, token, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

let sessionId: string;
let firstProblemId: string;
let secondProblemId: string;
let firstVersionId: string;
let draftVersionId: string;
let workId: string;

beforeAll(() => {
  TEACHER_ID = createPerRunTeacher(psql, { emailPrefix: "problem-answer-leak" });
  const baseUnitId = psql(`select id from subject_template_units where subject_id = '${SUBJECT_ID}' order by position limit 1;`);
  const contractId = psql(`insert into contracts (household_id, child_id, status) values ('${HOUSEHOLD_ID}', '${STUDENT_ID}', 'draft') returning id;`);
  const enrollmentId = psql(
    `insert into subject_enrollments (child_id, subject_id, contract_id, status) values ('${STUDENT_ID}', '${SUBJECT_ID}', '${contractId}', 'planned') returning id;`
  );
  const reservationId = insertReservationInBand(psql, { band: "problem-answer-leak", enrollmentId, teacherId: TEACHER_ID });
  sessionId = psql(
    `insert into sessions (reservation_id, subject_enrollment_id, teacher_id, lesson_type_id, scheduled_duration_minutes)
     values ('${reservationId}', '${enrollmentId}', '${TEACHER_ID}', (select id from lesson_types where code = 'regular'), 60) returning id;`
  );
  psql(
    `insert into teacher_assignments (subject_enrollment_id, teacher_id, status, effective_from)
     values ('${enrollmentId}', '${TEACHER_ID}', 'active', now() - interval '1 day');`
  );
  const overlayId = asUser(TEACHER_ID, `insert into student_curriculum_overlays (subject_enrollment_id) values ('${enrollmentId}') returning id;`);
  const overlayUnitId = asUser(
    TEACHER_ID,
    `insert into curriculum_overlay_units (overlay_id, source_unit_id, position, unit_title) values ('${overlayId}', '${baseUnitId}', 1, '정답유출 ${RUN}') returning id;`
  );
  const keywordId = psql(`insert into subject_keywords (subject_id, label) values ('${SUBJECT_ID}', '정답유출 ${RUN}') returning id;`);
  asUser(TEACHER_ID, `insert into curriculum_overlay_unit_keywords (overlay_unit_id, keyword_id) values ('${overlayUnitId}', '${keywordId}');`);

  function problem(passage: string, correct: number): string {
    const id = psql(
      `insert into problems (format, passage, subject_id, status, created_by) values ('mc', ${quote(passage)}, '${SUBJECT_ID}', 'confirmed', '${TEACHER_ID}') returning id;`
    );
    psql(`insert into problem_keywords (problem_id, keyword_id) values ('${id}', '${keywordId}');`);
    psql(
      `update problem_versions set options = '["가","나","다","라"]'::jsonb, correct_index = ${correct},
       explanation = ${quote(SECRET_EXPLANATION)}, answers = '["${SECRET_ANSWER}"]'::jsonb, answer_rationale = 'SECRET-RAT-${RUN}', difficulty = 'medium'
       where problem_id = '${id}';`
    );
    return id;
  }
  firstProblemId = problem(`유출점검 첫 문제 ${RUN}`, 2);
  secondProblemId = problem(`유출점검 둘째 문제 ${RUN}`, 1);

  const prepId = asUser(
    TEACHER_ID,
    `insert into curriculum_unit_preps (overlay_unit_id, created_by) values ('${overlayUnitId}', '${TEACHER_ID}') on conflict (overlay_unit_id) do update set created_by = excluded.created_by returning id;`
  );
  asUser(
    TEACHER_ID,
    `insert into curriculum_unit_prep_items (prep_id, content_type, content_id, position) values
     ('${prepId}', 'problem', '${firstProblemId}', 1), ('${prepId}', 'problem', '${secondProblemId}', 2);`
  );
  psql(`select link_unit_prep_to_session('${overlayUnitId}', '${sessionId}', '${TEACHER_ID}');`);
  psql(`select mark_lesson_session_started('${sessionId}', '${TEACHER_ID}');`);

  firstVersionId = psql(`select problem_version_id from session_content_manifest where session_id = '${sessionId}' and content_id = '${firstProblemId}';`);
  // 공개 전 초안 — 학생·학부모에게는 이 행도 보이면 안 된다.
  draftVersionId = psql(`select create_problem_draft_version('${secondProblemId}', '초안 지문 ${RUN}', null, null, null, null, '${ADMIN_ID}');`);
  psql(`update problem_versions set correct_index = 3, explanation = ${quote(SECRET_EXPLANATION)} where id = '${draftVersionId}';`);
  workId = psql(`select start_problem_work('${sessionId}', '${STUDENT_ID}', '${firstProblemId}', false);`);
  psql(`select submit_problem_attempt('${workId}', '${STUDENT_ID}', 1, null);`);
});

async function restSelect(client: SupabaseClient, columns: string) {
  const { data, error } = await client.from("problem_versions").select(columns).in("problem_id", [firstProblemId, secondProblemId]);
  return { data: (data ?? []) as unknown as Record<string, unknown>[], error };
}

describe("problem_versions REST 직접 조회 — 정답·해설 유출 차단", () => {
  for (const [label, userId] of [["학생", STUDENT_ID], ["학부모", PARENT_ID]] as const) {
    it(`${label} JWT 는 공개·초안·고정 버전 어느 것도 정답 컬럼을 읽지 못한다`, async () => {
      // 사전 조건: 공개 버전이 실제로 있다.
      expect(psql(`select count(*) from problem_versions where problem_id in ('${firstProblemId}','${secondProblemId}') and status = 'published';`)).toBe("2");
      const client = clientFor(userId);
      for (const cols of [ANSWER_COLUMNS, "*", "id,correct_index", "id,explanation", "id,answers"]) {
        const { data } = await restSelect(client, cols);
        expect(data, `${label} select=${cols}`).toEqual([]);
      }
      // 필터로 캐 봐도(correct_index=2) 행 자체가 없다.
      const { data: probe } = await client.from("problem_versions").select("id").eq("correct_index", 2).in("problem_id", [firstProblemId]);
      expect(probe ?? []).toEqual([]);
      const { data: byId } = await client.from("problem_versions").select("id,correct_index").eq("id", draftVersionId);
      expect(byId ?? []).toEqual([]);
    });
  }

  it("교사·관리자는 여전히 정답 컬럼을 읽는다", async () => {
    for (const userId of [TEACHER_ID, ADMIN_ID]) {
      const { data, error } = await restSelect(clientFor(userId), ANSWER_COLUMNS);
      expect(error).toBeNull();
      const row = data.find((r) => r.id === firstVersionId);
      expect(row?.correct_index).toBe(2);
      expect(row?.explanation).toBe(SECRET_EXPLANATION);
      expect(row?.answers).toEqual([SECRET_ANSWER]);
    }
  });
});

describe("수업 관계자용 함수·loadSessionProblems — 채점 전에는 가리고 채점 뒤에 연다", () => {
  const rpc = (client: SupabaseClient) =>
    client.rpc("session_problem_versions", {
      p_session_id: sessionId,
      p_version_ids: [firstVersionId],
      p_source: "lesson",
    });

  it("채점 전: 학생·학부모는 지문·보기만 받고 정답 계열은 null, 교사·관리자는 받는다", async () => {
    for (const userId of [STUDENT_ID, PARENT_ID]) {
      const { data, error } = await rpc(clientFor(userId));
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(data![0].passage).toBe(`유출점검 첫 문제 ${RUN}`);
      expect(data![0].options).toEqual(["가", "나", "다", "라"]);
      expect(data![0].correct_index).toBeNull();
      expect(data![0].explanation).toBeNull();
      expect(data![0].answers).toBeNull();
    }
    for (const userId of [TEACHER_ID, ADMIN_ID]) {
      const { data } = await rpc(clientFor(userId));
      expect(data![0].correct_index).toBe(2);
      expect(data![0].answers).toEqual([SECRET_ANSWER]);
    }
  });

  it("다른 수업의 버전·관계없는 사용자는 함수로도 받지 못한다", async () => {
    // 이 수업에 고정되지 않은 초안 버전을 요청.
    const { data } = await clientFor(STUDENT_ID).rpc("session_problem_versions", {
      p_session_id: sessionId,
      p_version_ids: [draftVersionId],
      p_source: "lesson",
    });
    expect(data ?? []).toEqual([]);
    // 이 수업과 관계없는 다른 학생.
    const { data: other } = await clientFor("cccccccc-0000-0000-0000-000000000002").rpc("session_problem_versions", {
      p_session_id: sessionId,
      p_version_ids: [firstVersionId],
      p_source: "lesson",
    });
    expect(other ?? []).toEqual([]);
  });

  it("loadSessionProblems(학생 JWT): 제출만으로는 가리고, 교사 채점 뒤에만 정답·해설을 준다", async () => {
    const student = clientFor(STUDENT_ID);
    const before = await loadSessionProblems(student, sessionId, { canSeeAnswers: false, studentId: STUDENT_ID });
    expect(before.map((p) => p.number)).toEqual([1, 2]);
    expect(before[0].passage).toBe(`유출점검 첫 문제 ${RUN}`);
    expect(before[0].solved).toBe(true);
    expect(before[0].correctIndex).toBeNull();
    expect(before[0].explanation).toBeNull();
    expect(before[1].correctIndex).toBeNull();

    asUser(TEACHER_ID, `select grade_problem_attempt('${workId}', null, null);`);

    for (const client of [student, clientFor(PARENT_ID)]) {
      const after = await loadSessionProblems(client, sessionId, { canSeeAnswers: false, studentId: STUDENT_ID });
      expect(after[0].graded).toBe(true);
      expect(after[0].correctIndex).toBe(2);
      expect(after[0].explanation).toBe(SECRET_EXPLANATION);
      // 풀지 않은 둘째 문제는 여전히 가려져 있다.
      expect(after[1].correctIndex).toBeNull();
      expect(after[1].explanation).toBeNull();
    }
    // 채점 뒤에도 REST 테이블 직접 조회는 여전히 막혀 있다.
    const { data } = await restSelect(student, ANSWER_COLUMNS);
    expect(data).toEqual([]);
  });

  it("그림 열람 확인 함수: 공개 버전은 학생에게 열리고 초안은 닫힌다", async () => {
    const pubPath = `problem-assets/leak-${RUN}-pub.png`;
    const draftPath = `problem-assets/leak-${RUN}-draft.png`;
    psql(`update problem_versions set figure = '{"path":"${pubPath}"}'::jsonb where id = '${firstVersionId}';`);
    psql(`update problem_versions set figure = '{"path":"${draftPath}"}'::jsonb where id = '${draftVersionId}';`);
    const student = clientFor(STUDENT_ID);
    expect((await student.rpc("problem_figure_visible", { p_path: pubPath })).data).toBe(true);
    expect((await student.rpc("problem_figure_visible", { p_path: draftPath })).data).toBe(false);
    expect((await clientFor(ADMIN_ID).rpc("problem_figure_visible", { p_path: draftPath })).data).toBe(true);
  });
});
