import { execFileSync } from "node:child_process";
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

  it("학생 본인은 mc 답을 저장하고 상태를 in_progress 로 바꿀 수 있다", () => {
    asUser(STUDENT_ID, `insert into mock_exam_answers (attempt_id, set_item_id, response, correct) values ('${attemptId}', '${mcItemId}', '1', true);`);
    asUser(STUDENT_ID, `update mock_exam_attempts set status = 'in_progress', started_at = now() where id = '${attemptId}';`);
    expect(psql(`select status from mock_exam_attempts where id = '${attemptId}';`)).toBe("in_progress");
    expect(psql(`select correct from mock_exam_answers where attempt_id = '${attemptId}' and set_item_id = '${mcItemId}';`)).toBe("t");
  });

  it("다른 학생은 이 응시의 답을 볼 수도 쓸 수도 없다(RLS)", () => {
    expect(asUser(otherStudentId, `select count(*) from mock_exam_answers where attempt_id = '${attemptId}';`)).toBe("0");
    const out = fails(() => asUser(otherStudentId, `insert into mock_exam_answers (attempt_id, set_item_id, response) values ('${attemptId}', '${sprItemId}', '5');`));
    expect(out).toMatch(/row-level security|policy/i);
  });

  it("spr 답을 저장한 뒤 제출하면 상태가 submitted 로 바뀌고 더 이상 학생이 정답을 못 본다(애플리케이션 정책 — 정답 컬럼 자체는 채점 확정 전에도 채워져 있다)", () => {
    asUser(STUDENT_ID, `insert into mock_exam_answers (attempt_id, set_item_id, response, correct) values ('${attemptId}', '${sprItemId}', '5', true);`);
    asUser(STUDENT_ID, `update mock_exam_attempts set status = 'submitted', submitted_at = now() where id = '${attemptId}';`);
    expect(psql(`select status from mock_exam_attempts where id = '${attemptId}';`)).toBe("submitted");
  });

  it("담당 교사는 제출된 응시를 채점 확정(graded)할 수 있다", () => {
    asUser(TEACHER_ID, `update mock_exam_attempts set status = 'graded', graded_at = now() where id = '${attemptId}';`);
    expect(psql(`select status from mock_exam_attempts where id = '${attemptId}';`)).toBe("graded");
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
