import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";

// 고정형 SAT 모의고사 V1 — 배정 → 응시 → 제출 → 채점 확정 흐름의 DB 레벨(RLS 포함) 검증.
// lib/homework-batch.integration.test.ts 와 같은 방식으로 psql + `set role authenticated` +
// `request.jwt.claim.sub` 로 실제 로컬 DB에 대해 RLS를 그대로 태운다(모킹 없음).

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const TEACHER_ID = "dddddddd-0000-0000-0000-000000000001";
const STUDENT_ID = "cccccccc-0000-0000-0000-000000000001";
const SUBJECT_ID = "eeeeeeee-0000-0000-0000-000000000001";
// 시드 데이터에서 STUDENT_ID는 이미 이 household의 child다(household_members_one_household_per_child
// 유니크 제약 — 학생당 household는 하나뿐이라 새로 만들지 않고 기존 보호자를 재사용한다).
const GUARDIAN_ID = "bbbbbbbb-0000-0000-0000-000000000001";

// PostgREST(실제 REST API)를 직접 태우는 클라이언트 — psql 헬퍼는 raw SQL로 DB에
// 바로 붙기 때문에 nested-select 임베드 문법의 관계 이름 오류(PostgREST 스키마 캐시
// "Could not find a relationship..." 오류)를 전혀 잡아내지 못한다. 실제로 그 문제가
// 있었다(enrollments/mock_exam_attempts → profiles 임베드가 실제로는 students를 가리키는
// FK 제약을 참조해 렌더링이 전부 깨짐) — 그 회귀를 잡으려면 아래처럼 실제 REST API를 호출해야 한다.
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const restClient = createClient("http://127.0.0.1:54421", SERVICE_ROLE_KEY);

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
function fails(fn: () => unknown): string {
  try {
    fn();
  } catch (e) {
    return String((e as { stderr?: string }).stderr ?? e);
  }
  return "";
}
function quote(text: string): string {
  return `'${text.replace(/'/g, "''")}'`;
}

let otherTeacherId: string;
let otherStudentId: string;
let examSetId: string;
let mcItemId: string;
let sprItemId: string;

function createProfile(role: string, label: string): string {
  const id = psql(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'mockexam-${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com', 'x', now(), '{}', '{}', now(), now())
     returning id;`,
  );
  psql(`insert into profiles (id, role, name) values ('${id}', '${role}', '${label}');`);
  return id;
}

function publishedProblem(format: "mc" | "spr", passage: string, opts: { options?: string[]; correctIndex?: number; answers?: string[] }): string {
  const id = psql(
    `insert into problems (format, passage, subject_id, status, created_by, sat_domain) values ('${format}', ${quote(passage)}, '${SUBJECT_ID}', 'confirmed', '${TEACHER_ID}', 'algebra') returning id;`,
  );
  if (format === "mc") {
    psql(
      `update problem_versions set options = '${JSON.stringify(opts.options)}'::jsonb, correct_index = ${opts.correctIndex}, explanation = '해설', difficulty = 'medium', status = 'published', published_at = now() where problem_id = '${id}' and version_no = 1;`,
    );
  } else {
    psql(
      `update problem_versions set answers = '${JSON.stringify(opts.answers)}'::jsonb, explanation = '해설', difficulty = 'medium', status = 'published', published_at = now() where problem_id = '${id}' and version_no = 1;`,
    );
  }
  const versionId = psql(`select id from problem_versions where problem_id = '${id}' and version_no = 1;`);
  psql(`update problems set published_version_id = '${versionId}' where id = '${id}';`);
  return id;
}

beforeAll(() => {
  otherTeacherId = createProfile("teacher", "무관한교사");
  otherStudentId = createProfile("student", "무관한학생");
  psql(`insert into students (id, status) values ('${otherStudentId}', 'active');`);

  const mcProblemId = publishedProblem("mc", "MC 지문. What is the answer?", { options: ["가", "나", "다", "라"], correctIndex: 1 });
  const sprProblemId = publishedProblem("spr", "SPR 지문. 답을 숫자로 쓰세요.", { answers: ["5"] });
  const mcVersionId = psql(`select id from problem_versions where problem_id = '${mcProblemId}' and version_no = 1;`);
  const sprVersionId = psql(`select id from problem_versions where problem_id = '${sprProblemId}' and version_no = 1;`);

  examSetId = psql(
    `insert into mock_exam_sets (name, difficulty_tier, status, created_by) values ('통합테스트 세트 ${Date.now()}', 'standard', 'published', '${TEACHER_ID}') returning id;`,
  );
  mcItemId = psql(
    `insert into mock_exam_set_items (exam_set_id, section, position, problem_id, problem_version_id, sat_domain, difficulty)
     values ('${examSetId}', 'rw', 1, '${mcProblemId}', '${mcVersionId}', 'rw_craft_structure', 'medium') returning id;`,
  );
  sprItemId = psql(
    `insert into mock_exam_set_items (exam_set_id, section, position, problem_id, problem_version_id, sat_domain, difficulty)
     values ('${examSetId}', 'math', 1, '${sprProblemId}', '${sprVersionId}', 'algebra', 'medium') returning id;`,
  );
});

describe("모의고사 배정 — 담당 교사만 학생에게 배정할 수 있다", () => {
  it("담당 교사는 배정(insert)할 수 있다", () => {
    const attemptId = asUser(
      TEACHER_ID,
      `insert into mock_exam_attempts (exam_set_id, student_id, assigned_by) values ('${examSetId}', '${STUDENT_ID}', '${TEACHER_ID}') returning id;`,
    );
    expect(attemptId).toMatch(/^[0-9a-f-]{36}$/);
    expect(psql(`select status from mock_exam_attempts where id = '${attemptId}';`)).toBe("assigned");
  });

  it("담당이 아닌 교사는 배정할 수 없다(RLS insert 거절)", () => {
    const out = fails(() =>
      asUser(
        otherTeacherId,
        `insert into mock_exam_attempts (exam_set_id, student_id, assigned_by) values ('${examSetId}', '${otherStudentId}', '${otherTeacherId}');`,
      ),
    );
    expect(out).toMatch(/row-level security|policy/i);
  });

  it("학생당 시험(세트 계열) 당 응시는 하나 — 같은 학생에게 같은 세트를 다시 배정하면 유니크 위반", () => {
    const out = fails(() =>
      asUser(
        TEACHER_ID,
        `insert into mock_exam_attempts (exam_set_id, student_id, assigned_by) values ('${examSetId}', '${STUDENT_ID}', '${TEACHER_ID}');`,
      ),
    );
    expect(out).toMatch(/duplicate key|unique/i);
  });
});

describe("모의고사 응시 — 학생이 자기 응시만 답하고 제출할 수 있다", () => {
  let attemptId: string;

  beforeAll(() => {
    attemptId = psql(`select id from mock_exam_attempts where exam_set_id = '${examSetId}' and student_id = '${STUDENT_ID}';`);
  });

  // 2026-09-21(P0 보안 차단) — 학생은 mock_exam_attempts UPDATE·mock_exam_answers 직접 쓰기/읽기가
  // 전부 막히고, 답 저장·표시·시간·제출은 SECURITY DEFINER RPC 로만 한다. 정오(correct)는 서버가 계산한다.
  it("학생이 답안 테이블에 직접 쓰거나 응시 상태를 직접 바꾸는 것은 RLS 가 거절한다", () => {
    const ins = fails(() => asUser(STUDENT_ID, `insert into mock_exam_answers (attempt_id, set_item_id, response, correct) values ('${attemptId}', '${mcItemId}', '"1"', true);`));
    expect(ins).toMatch(/row-level security|policy/i);
    asUser(STUDENT_ID, `update mock_exam_attempts set status = 'graded', graded_at = now() where id = '${attemptId}';`);
    expect(psql(`select status from mock_exam_attempts where id = '${attemptId}';`)).toBe("assigned");
  });

  it("학생 본인은 RPC 로 mc 답을 저장하고, 첫 저장에서 assigned → in_progress 로 바뀐다. 정오는 서버가 계산한다", () => {
    asUser(STUDENT_ID, `select mock_exam_save_answer('${attemptId}', '${mcItemId}', '1', null);`);
    expect(psql(`select status from mock_exam_attempts where id = '${attemptId}';`)).toBe("in_progress");
    expect(psql(`select correct from mock_exam_answers where attempt_id = '${attemptId}' and set_item_id = '${mcItemId}';`)).toBe("t");
    asUser(STUDENT_ID, `select mock_exam_save_answer('${attemptId}', '${mcItemId}', '3', null);`);
    expect(psql(`select correct from mock_exam_answers where attempt_id = '${attemptId}' and set_item_id = '${mcItemId}';`)).toBe("f");
    asUser(STUDENT_ID, `select mock_exam_save_answer('${attemptId}', '${mcItemId}', '1', 12);`);
  });

  it("채점 확정 전에는 학생에게 정답·해설·정오가 내려가지 않는다(RPC 마스킹) — 답안 테이블도 직접 읽지 못한다", () => {
    expect(asUser(STUDENT_ID, `select count(*) from mock_exam_answers where attempt_id = '${attemptId}';`)).toBe("0");
    const detail = JSON.parse(asUser(STUDENT_ID, `select mock_exam_attempt_detail('${attemptId}')::text;`));
    const mc = detail.items.find((i: { setItemId: string }) => i.setItemId === mcItemId);
    expect(mc.response).toBe("1");
    expect(mc.correctIndex).toBeNull();
    expect(mc.explanation).toBeNull();
    expect(mc.correct).toBeNull();
    // 담당 교사는 채점 확정 전에도 본다.
    const teacherView = JSON.parse(asUser(TEACHER_ID, `select mock_exam_attempt_detail('${attemptId}')::text;`));
    expect(teacherView.items.find((i: { setItemId: string }) => i.setItemId === mcItemId).correctIndex).toBe(1);
  });

  it("다른 학생은 이 응시의 답을 볼 수도 쓸 수도 없다(RLS·RPC)", () => {
    expect(asUser(otherStudentId, `select count(*) from mock_exam_answers where attempt_id = '${attemptId}';`)).toBe("0");
    expect(fails(() => asUser(otherStudentId, `select mock_exam_save_answer('${attemptId}', '${sprItemId}', '5', null);`))).toContain("본인 응시만");
    expect(fails(() => asUser(otherStudentId, `select mock_exam_attempt_detail('${attemptId}');`))).toContain("권한이 없습니다");
  });

  it("spr 답을 RPC 로 저장한 뒤 제출하면 submitted 가 되고, 이후 답 변경은 거절된다", () => {
    asUser(STUDENT_ID, `select mock_exam_save_answer('${attemptId}', '${sprItemId}', ' 5 ', null);`);
    expect(psql(`select correct from mock_exam_answers where attempt_id = '${attemptId}' and set_item_id = '${sprItemId}';`)).toBe("t");
    asUser(STUDENT_ID, `select mock_exam_submit('${attemptId}');`);
    expect(psql(`select status from mock_exam_attempts where id = '${attemptId}';`)).toBe("submitted");
    expect(fails(() => asUser(STUDENT_ID, `select mock_exam_save_answer('${attemptId}', '${sprItemId}', '6', null);`))).toContain("이미 제출한");
  });

  it("학생은 스스로 채점 확정할 수 없고, 담당 교사는 RPC 로 채점 확정(graded)할 수 있다 — 그 뒤 학생에게 정답이 열린다", () => {
    expect(fails(() => asUser(STUDENT_ID, `select mock_exam_finalize_grading('${attemptId}');`))).toContain("담당 학생의 응시만");
    expect(fails(() => asUser(otherTeacherId, `select mock_exam_finalize_grading('${attemptId}');`))).toContain("담당 학생의 응시만");
    asUser(TEACHER_ID, `select mock_exam_finalize_grading('${attemptId}');`);
    expect(psql(`select status from mock_exam_attempts where id = '${attemptId}';`)).toBe("graded");
    const detail = JSON.parse(asUser(STUDENT_ID, `select mock_exam_attempt_detail('${attemptId}')::text;`));
    const mc = detail.items.find((i: { setItemId: string }) => i.setItemId === mcItemId);
    expect(mc.correctIndex).toBe(1);
    expect(mc.correct).toBe(true);
    const summaries = JSON.parse(asUser(STUDENT_ID, `select mock_exam_attempt_summaries('${STUDENT_ID}')::text;`));
    const mine = summaries.find((s: { id: string }) => s.id === attemptId);
    expect(mine.totalCount).toBe(2);
    expect(mine.correctCount).toBe(2);
  });

  it("학부모는 자녀 응시를 읽을 수 있지만 답을 바꿀 수는 없다", () => {
    expect(asUser(GUARDIAN_ID, `select status from mock_exam_attempts where id = '${attemptId}';`)).toBe("graded");
    const out = fails(() => asUser(GUARDIAN_ID, `update mock_exam_attempts set status = 'assigned' where id = '${attemptId}';`));
    // update 는 영향받은 행이 0개면 에러 없이 조용히 넘어갈 수 있으므로(RLS using 절이 걸러
    // 대상 행이 안 보이는 경우) 실제로 상태가 안 바뀌었는지 별도로 확인한다.
    void out;
    expect(psql(`select status from mock_exam_attempts where id = '${attemptId}';`)).toBe("graded");
  });

  it("무관한 학생·교사에게는 이 응시 기록이 보이지 않는다", () => {
    expect(asUser(otherStudentId, `select count(*) from mock_exam_attempts where id = '${attemptId}';`)).toBe("0");
    expect(asUser(otherTeacherId, `select count(*) from mock_exam_attempts where id = '${attemptId}';`)).toBe("0");
  });
});

// 회귀 테스트 — 위 describe 블록들은 psql(raw SQL)로만 검증해 실제 PostgREST 스키마
// 캐시 오류("Could not find a relationship between 'enrollments'/'mock_exam_attempts'
// and 'profiles' in the schema cache")를 잡아내지 못했다. 아래는 실제 supabase-js
// 클라이언트 + 로컬 REST API로 데이터 레이어 함수를 직접 호출해 그 오류가 재발하지
// 않는지 확인한다(enrollments.student_id/mock_exam_attempts.student_id는 profiles가
// 아니라 students(id)를 참조하므로 `profiles!<fk이름>` 임베드는 항상 깨진다 —
// students.id가 곧 profiles.id인 점을 이용해 profiles를 별도 조회해야 한다).
describe("모의고사 데이터 레이어 — 실제 PostgREST로 profiles 임베드 회귀 확인", () => {
  it("loadTeacherMockExamStudents는 enrollments→profiles 스키마 캐시 오류 없이 학생 이름을 반환한다", async () => {
    const { loadTeacherMockExamStudents } = await import("../../app/teacher/mock-exam-assign-data");
    const students = await loadTeacherMockExamStudents(restClient as never, TEACHER_ID);
    const target = students.find((s) => s.studentId === STUDENT_ID);
    expect(target).toBeDefined();
    expect(target?.studentName).toBe("지훈");
  });

  it("loadStudentMockExamAttempts는 mock_exam_attempts→profiles 스키마 캐시 오류 없이 목록을 반환한다", async () => {
    const { loadStudentMockExamAttempts } = await import("./attempt-data");
    const attempts = await loadStudentMockExamAttempts(restClient as never, STUDENT_ID);
    expect(attempts.length).toBeGreaterThan(0);
    expect(attempts[0].studentId).toBe(STUDENT_ID);
    expect(attempts[0].studentName).toBe("지훈");
  });

  it("loadMockExamAttemptDetail은 응시 상세에서도 학생 이름을 정상 해석한다", async () => {
    const attemptId = psql(`select id from mock_exam_attempts where exam_set_id = '${examSetId}' and student_id = '${STUDENT_ID}';`);
    const { loadMockExamAttemptDetail } = await import("./attempt-data");
    const detail = await loadMockExamAttemptDetail(restClient as never, attemptId);
    expect(detail).not.toBeNull();
    expect(detail?.studentName).toBe("지훈");
  });
});
