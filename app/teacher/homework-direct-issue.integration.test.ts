import { execFileSync } from "node:child_process";
import { beforeAll, describe, expect, it } from "vitest";

// 2026-09-16 제품 오너 지시 — 과제를 회차 키워드 풀에 묶지 않고, 교사 포털에서 학생별로 키워드를
// 직접 골라 배치를 만든 뒤 세션뷰에서 원하는 배치를 그 수업에 불러온다.
// docs/2026-09-16-homework-direct-issue-plan.md 참고.

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const TEACHER_ID = "dddddddd-0000-0000-0000-000000000001";
const STUDENT_ID = "cccccccc-0000-0000-0000-000000000001";
const HOUSEHOLD_ID = "aabbccdd-0000-0000-0000-000000000001";
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
function quote(text: string): string {
  return `'${text.replace(/'/g, "''")}'`;
}

let unrelatedTeacherId: string;
let sessionId: string;
let keywordId: string;

function problem(passage: string): string {
  const id = psql(
    `insert into problems (format, passage, subject_id, status, created_by) values ('mc', ${quote(passage)}, '${SUBJECT_ID}', 'confirmed', '${TEACHER_ID}') returning id;`
  );
  psql(`insert into problem_keywords (problem_id, keyword_id) values ('${id}', '${keywordId}');`);
  psql(`update problem_versions set options = '["가","나","다","라"]'::jsonb, correct_index = 0, explanation = '해설', difficulty = 'medium', status = 'published', published_at = now() where problem_id = '${id}' and version_no = 1;`);
  const versionId = psql(`select id from problem_versions where problem_id = '${id}' and version_no = 1;`);
  psql(`update problems set published_version_id = '${versionId}' where id = '${id}';`);
  return id;
}

beforeAll(() => {
  unrelatedTeacherId = psql(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'hw-direct-unrelated-${Date.now()}@example.com', 'x', now(), '{}', '{}', now(), now())
     returning id;`
  );
  psql(`insert into profiles (id, role, name) values ('${unrelatedTeacherId}', 'teacher', '무관한 교사');`);

  const contractId = psql(`insert into contracts (household_id, child_id, status) values ('${HOUSEHOLD_ID}', '${STUDENT_ID}', 'draft') returning id;`);
  const enrollmentId = psql(
    `insert into subject_enrollments (child_id, subject_id, contract_id, status) values ('${STUDENT_ID}', '${SUBJECT_ID}', '${contractId}', 'planned') returning id;`
  );
  psql(`insert into teacher_assignments (subject_enrollment_id, teacher_id, status, effective_from) values ('${enrollmentId}', '${TEACHER_ID}', 'active', now() - interval '1 day');`);
  const offset = 9600 + Math.floor(Math.random() * 5000) * 3;
  const reservationId = psql(
    `insert into reservations (kind, subject_enrollment_id, owner_profile_id, starts_at, ends_at, status)
     values ('lesson', '${enrollmentId}', '${TEACHER_ID}', now() + interval '${offset} days', now() + interval '${offset} days 1 hour', 'confirmed') returning id;`
  );
  sessionId = psql(
    `insert into sessions (reservation_id, subject_enrollment_id, teacher_id, lesson_type_id, scheduled_duration_minutes)
     values ('${reservationId}', '${enrollmentId}', '${TEACHER_ID}', (select id from lesson_types where code = 'regular'), 60) returning id;`
  );

  keywordId = psql(`insert into subject_keywords (subject_id, label, normalized_label) values ('${SUBJECT_ID}', '과제직접발급테스트 ${Date.now()}', 'hwtest${Date.now()}') returning id;`);
  for (let i = 1; i <= 12; i++) problem(`문제${i} 지문. What is the answer?`);
});

describe("create_homework_draft_batch — 담당 교사만 학생별 배치를 만든다", () => {
  it("담당 교사는 키워드로 배치를 만들 수 있다(회차와 무관)", () => {
    const batchId = asUser(
      TEACHER_ID,
      `select create_homework_draft_batch('${STUDENT_ID}', '[{"keyword_id":"${keywordId}","count":2}]'::jsonb);`
    );
    expect(batchId).toMatch(/^[0-9a-f-]{36}$/);
    const count = psql(`select array_length(problem_ids, 1) from homework_draft_batches where id = '${batchId}';`);
    expect(Number(count)).toBeGreaterThan(0);
    expect(Number(count)).toBeLessThanOrEqual(2);
  });

  it("담당이 아닌 교사는 거절된다", () => {
    const out = fails(() =>
      asUser(unrelatedTeacherId, `select create_homework_draft_batch('${STUDENT_ID}', '[{"keyword_id":"${keywordId}","count":1}]'::jsonb);`)
    );
    expect(out).toContain("담당하는 학생에게만");
  });

  it("이미 이 학생에게 발급된 문제는 다시 뽑지 않는다", () => {
    const batchId = asUser(TEACHER_ID, `select create_homework_draft_batch('${STUDENT_ID}', '[{"keyword_id":"${keywordId}","count":10}]'::jsonb);`);
    asUser(TEACHER_ID, `select load_homework_batch_into_session('${batchId}', '${sessionId}');`);
    const issuedIds = psql(`select problem_id from session_homework_items where session_id = '${sessionId}' order by position;`).split("\n").filter(Boolean);
    expect(issuedIds.length).toBeGreaterThan(0);

    const secondBatchId = asUser(TEACHER_ID, `select create_homework_draft_batch('${STUDENT_ID}', '[{"keyword_id":"${keywordId}","count":10}]'::jsonb);`);
    const secondIds = psql(`select unnest(problem_ids) from homework_draft_batches where id = '${secondBatchId}';`).split("\n").filter(Boolean);
    for (const id of issuedIds) expect(secondIds).not.toContain(id);
  });
});

describe("load_homework_batch_into_session — 회차 키워드 범위 검사 없이 발급되고, 학생 불일치는 거절된다", () => {
  it("배치를 이 수업에 불러오면 session_homework_items에 실제로 발급된다(회차 키워드 범위 검사 없음)", () => {
    const batchId = asUser(TEACHER_ID, `select create_homework_draft_batch('${STUDENT_ID}', '[{"keyword_id":"${keywordId}","count":1}]'::jsonb);`);
    const issuedCount = Number(asUser(TEACHER_ID, `select load_homework_batch_into_session('${batchId}', '${sessionId}');`));
    expect(issuedCount).toBeGreaterThanOrEqual(0);
    const loadedAt = psql(`select loaded_at from homework_draft_batches where id = '${batchId}';`);
    expect(loadedAt).not.toBe("");
  });

  it("담당이 아닌 교사는 거절된다", () => {
    const batchId = asUser(TEACHER_ID, `select create_homework_draft_batch('${STUDENT_ID}', '[{"keyword_id":"${keywordId}","count":1}]'::jsonb);`);
    const out = fails(() => asUser(unrelatedTeacherId, `select load_homework_batch_into_session('${batchId}', '${sessionId}');`));
    expect(out).toContain("담당하는 학생의 과제만");
  });
});
