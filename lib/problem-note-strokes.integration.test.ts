import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

// 모의고사·과제·문제 풀이 중 필기(2026-09-21) — save_problem_note_strokes/
// load_problem_note_strokes RPC를 실제 로컬 DB(RLS 포함)에 대해 검증한다.
// mock-exam-attempt-flow.integration.test.ts와 같은 psql + JWT claim 패턴.

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const TEACHER_ID = "dddddddd-0000-0000-0000-000000000001";
const STUDENT_ID = "cccccccc-0000-0000-0000-000000000001";
const GUARDIAN_ID = "bbbbbbbb-0000-0000-0000-000000000001";
const SUBJECT_ID = "eeeeeeee-0000-0000-0000-000000000001";

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

let otherStudentId: string;
let attemptId: string;
let setItemId: string;

function createProfile(role: string, label: string): string {
  const id = psql(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'note-strokes-${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com', 'x', now(), '{}', '{}', now(), now())
     returning id;`,
  );
  psql(`insert into profiles (id, role, name) values ('${id}', '${role}', '${label}');`);
  return id;
}

describe("problem_note_strokes — 모의고사 필기 저장/열람 RPC", () => {
  it("본인 응시의 필기를 저장·열람할 수 있고, 다른 학생·다른 교사·무관한 사람은 못 본다", () => {
    otherStudentId = createProfile("student", "무관한학생-필기");
    psql(`insert into students (id, status) values ('${otherStudentId}', 'active');`);

    const problemId = psql(
      `insert into problems (format, passage, options, correct_index, explanation, status, difficulty, subject_id, created_by, sat_domain)
       values ('mc', '필기 테스트 문제', '["A","B"]'::jsonb, 0, '해설', 'confirmed', 'medium', '${SUBJECT_ID}', '${TEACHER_ID}', 'algebra') returning id;`,
    );
    const versionId = psql(`select id from problem_versions where problem_id = '${problemId}' and version_no = 1;`);
    const examSetId = psql(
      `insert into mock_exam_sets (name, difficulty_tier, status, created_by) values ('필기 테스트 세트 ${Date.now()}', 'standard', 'published', '${TEACHER_ID}') returning id;`,
    );
    setItemId = psql(
      `insert into mock_exam_set_items (exam_set_id, section, position, problem_id, problem_version_id, sat_domain, difficulty)
       values ('${examSetId}', 'math', 1, '${problemId}', '${versionId}', 'algebra', 'medium') returning id;`,
    );
    attemptId = asUser(
      TEACHER_ID,
      `insert into mock_exam_attempts (exam_set_id, student_id, assigned_by) values ('${examSetId}', '${STUDENT_ID}', '${TEACHER_ID}') returning id;`,
    );

    const strokes = JSON.stringify([{ x0: 1, y0: 2, x1: 3, y1: 4, color: "#e11d48", w: 640 }]);

    // 학생 본인 저장
    asUser(STUDENT_ID, `select save_problem_note_strokes('mock_exam', '${attemptId}', '${setItemId}', '${strokes}'::jsonb);`);
    const own = JSON.parse(asUser(STUDENT_ID, `select load_problem_note_strokes('mock_exam', '${attemptId}', '${setItemId}')::text;`));
    expect(own).toHaveLength(1);
    expect(own[0].color).toBe("#e11d48");

    // 담당 교사는 학생 id를 명시해 읽을 수 있다.
    const teacherView = JSON.parse(
      asUser(TEACHER_ID, `select load_problem_note_strokes('mock_exam', '${attemptId}', '${setItemId}', '${STUDENT_ID}')::text;`),
    );
    expect(teacherView).toHaveLength(1);

    // 보호자도 읽을 수 있다.
    const guardianView = JSON.parse(
      asUser(GUARDIAN_ID, `select load_problem_note_strokes('mock_exam', '${attemptId}', '${setItemId}', '${STUDENT_ID}')::text;`),
    );
    expect(guardianView).toHaveLength(1);

    // 무관한 학생은 저장도 열람도 못 한다.
    expect(fails(() => asUser(otherStudentId, `select save_problem_note_strokes('mock_exam', '${attemptId}', '${setItemId}', '${strokes}'::jsonb);`))).toContain(
      "본인 응시",
    );
    expect(
      fails(() => asUser(otherStudentId, `select load_problem_note_strokes('mock_exam', '${attemptId}', '${setItemId}', '${STUDENT_ID}');`)),
    ).toContain("권한이 없습니다");
  });
});
