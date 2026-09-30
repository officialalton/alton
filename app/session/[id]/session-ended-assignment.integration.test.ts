import { execFileSync } from "node:child_process";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadNormalizedSession } from "./session-source-data";
import { loadStudentMockExamAttempts } from "@/lib/mock-exam/attempt-data";
import { loadStudentHomeworkBatches, loadTeacherHomeworkBatchesForStudent } from "@/lib/homework-batch-data";
import { emptyOnPermissionDenied } from "@/lib/permission-denied";
import { loadHomeworkItems } from "./homework-data";
import { loadSessionVocabData } from "./vocab-data";
import { loadSessionFreezeState, loadMaterialData } from "./material-data";
import { loadSessionProblems } from "./session-problem-data";
import { loadSessionLessonContext } from "./session-context-data";
import { loadSmartNotesViewUrl } from "@/lib/smart-notes-data";

// 2026-09-29 — 담당이 끝난(teacher_assignments.status='ended') 선생님이 자기 과거 수업(/session/[id])을
// 열 때 페이지가 '이 학생의 모의고사 기록을 볼 권한이 없습니다'로 죽던 회귀. 실행마다 전용 선생님·학생·수강·수업을
// 새로 만든다(실행 ID = 파일 내 RUN). 권한은 넓히지 않는다: 종료된 교사에게 RPC 는 여전히 거부.

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const API = "http://127.0.0.1:54421";
const SERVICE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const PASSWORD = "alton-dev-1234";
const SUBJECT_ID = "eeeeeeee-0000-0000-0000-000000000001"; // SAT Math
const RUN = `endasg${Date.now()}${Math.floor(Math.random() * 1e4)}`;

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], { encoding: "utf-8" }).trim();
}

const admin = createClient(API, SERVICE_KEY);

async function createLoggedInTeacher(tag: string): Promise<{ id: string; client: SupabaseClient }> {
  const email = `${RUN}-${tag}@example.com`;
  const { data, error: createError } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (createError || !data.user) throw new Error(createError?.message ?? "teacher 생성 실패");
  const id = data.user.id;
  psql(`insert into profiles (id, role, name) values ('${id}', 'teacher', '${RUN} 선생님 ${tag}');`);
  psql(`select set_teacher_rate('${id}', 3000000, 'KRW', now() - interval '60 days');`);
  psql(`insert into teachers (id, status) values ('${id}', 'active');`);
  const c = createClient(API, ANON_KEY);
  const { error } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(error.message);
  return { id, client: c };
}

let endedTeacher: { id: string; client: SupabaseClient };
let otherTeacher: { id: string; client: SupabaseClient };
let studentId = "";
let sessionId = "";

describe("담당 종료 선생님의 과거 수업 세션뷰", () => {
  beforeAll(async () => {
    endedTeacher = await createLoggedInTeacher("a");
    otherTeacher = await createLoggedInTeacher("b");

    studentId = psql(
      `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
       values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', '${RUN}-s@example.com', 'x', now(), '{}', '{}', now(), now()) returning id;`,
    );
    psql(`insert into profiles (id, role, name, date_of_birth) values ('${studentId}', 'student', '${RUN} 학생', '2008-01-01');`);
    psql(`insert into students (id, grade, status) values ('${studentId}', '10학년', 'active');`);
    const guardianId = psql(
      `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
       values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', '${RUN}-g@example.com', 'x', now(), '{}', '{}', now(), now()) returning id;`,
    );
    psql(`insert into profiles (id, role, name) values ('${guardianId}', 'parent', '${RUN} 보호자');`);
    psql(`insert into parents (id) values ('${guardianId}');`);
    const householdId = psql(`insert into households (primary_guardian_id) values ('${guardianId}') returning id;`);
    psql(
      `insert into household_members (household_id, profile_id, role, is_primary) values
        ('${householdId}', '${guardianId}', 'guardian', true), ('${householdId}', '${studentId}', 'child', true);`,
    );
    const contractId = psql(`insert into contracts (household_id, child_id, status) values ('${householdId}', '${studentId}', 'active') returning id;`);
    const enrollmentId = psql(
      `insert into subject_enrollments (child_id, subject_id, contract_id, status) values ('${studentId}', '${SUBJECT_ID}', '${contractId}', 'active') returning id;`,
    );
    // 담당 시작은 과거, 그리고 이미 종료(ended) — teaches_student() 는 planned/active 만 인정한다.
    psql(
      `insert into teacher_assignments (subject_enrollment_id, teacher_id, status, effective_from, effective_until, source)
       values ('${enrollmentId}', '${endedTeacher.id}', 'ended', now() - interval '30 days', now() - interval '2 days', 'app');`,
    );
    const startsAt = `now() - interval '10 days'`;
    const reservationId = psql(
      `insert into reservations (kind, subject_enrollment_id, owner_profile_id, starts_at, ends_at, status)
       values ('lesson', '${enrollmentId}', '${endedTeacher.id}', ${startsAt}, ${startsAt} + interval '1 hour', 'confirmed') returning id;`,
    );
    sessionId = psql(
      `insert into sessions (reservation_id, subject_enrollment_id, teacher_id, lesson_type_id, scheduled_duration_minutes, final_status)
       select '${reservationId}', '${enrollmentId}', '${endedTeacher.id}', id, 60, 'completed' from lesson_types where code = 'regular' returning id;`,
    );
  }, 60_000);

  afterAll(() => {
    // 예약·수업권 원장은 append-only 라 전용 행을 남긴다(실행 ID 로 식별, 공식 시드 계정은 건드리지 않음).
  });

  it("전제: 종료된 선생님은 teaches_student() 가 거짓이라 모의고사 RPC 가 거부한다(권한 미확대)", async () => {
    await expect(loadStudentMockExamAttempts(endedTeacher.client, studentId)).rejects.toThrow("권한이 없습니다");
  });

  it("종료된 선생님도 자기 과거 수업을 정규화해 읽고, 페이지 로더들이 던지지 않는다", async () => {
    const s = await loadNormalizedSession(endedTeacher.client, sessionId, endedTeacher.id, "teacher");
    expect(s?.viewerRole).toBe("teacher");
    expect(s?.studentId).toBe(studentId);

    const c = endedTeacher.client;
    await Promise.all([
      loadMaterialData(c, s!.curriculumDocId, sessionId, studentId),
      loadSessionFreezeState(c, sessionId),
      loadSessionVocabData(c, studentId),
      loadHomeworkItems(c, sessionId),
      loadSessionLessonContext(c, sessionId),
      loadSessionProblems(c, sessionId, { canSeeAnswers: true, studentId }),
      loadTeacherHomeworkBatchesForStudent(c, endedTeacher.id, studentId),
      loadSmartNotesViewUrl(c, sessionId),
    ]);
    // 페이지가 쓰는 감싼 형태 — 모의고사는 빈 목록.
    expect(await emptyOnPermissionDenied(loadStudentMockExamAttempts(c, studentId), [])).toEqual([]);
  });

  it("무관한 선생님은 세션 자체가 안 보이고(notFound 대상), 모의고사·과제 RPC 도 거부", async () => {
    const s = await loadNormalizedSession(otherTeacher.client, sessionId, otherTeacher.id, "teacher");
    expect(s).toBeNull();
    await expect(loadStudentMockExamAttempts(otherTeacher.client, studentId)).rejects.toThrow("권한이 없습니다");
    await expect(loadStudentHomeworkBatches(otherTeacher.client, studentId)).rejects.toThrow("권한이 없습니다");
  });
});
