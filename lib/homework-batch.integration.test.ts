import { execFileSync } from "node:child_process";
import { beforeAll, describe, expect, it } from "vitest";

// 2026-09-16 제품 오너 2차 정정 — 과제는 수업(세션)과 무관하다. 발급할 때마다 새 배치가 생기고,
// 이 교사↔이 학생 쌍으로만 저장·노출된다(다른 교사·다른 학생에게 노출되면 안 됨).
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

let otherTeacherId: string;
let otherStudentId: string;
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

function createProfile(role: string, label: string): string {
  const id = psql(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'hwbatch-${label}-${Date.now()}@example.com', 'x', now(), '{}', '{}', now(), now())
     returning id;`
  );
  psql(`insert into profiles (id, role, name) values ('${id}', '${role}', '${label}');`);
  return id;
}

beforeAll(() => {
  otherTeacherId = createProfile("teacher", "무관한 교사");
  otherStudentId = createProfile("student", "무관한 학생");
  psql(`insert into students (id, status) values ('${otherStudentId}', 'active');`);

  keywordId = psql(`insert into subject_keywords (subject_id, label, normalized_label) values ('${SUBJECT_ID}', '과제배치테스트 ${Date.now()}', 'hwbatch${Date.now()}') returning id;`);
  for (let i = 1; i <= 50; i++) problem(`문제${i} 지문. What is the answer?`);
  void HOUSEHOLD_ID;
});

describe("issue_homework_batch_v2 — 담당 교사가 학생·키워드만으로(수업 무관) 즉시 발급한다", () => {
  it("담당 교사는 발급할 수 있고, 라벨은 호출부가 넘긴 날짜 라벨 그대로 저장된다", () => {
    const batchId = asUser(TEACHER_ID, `select issue_homework_batch_v2('${STUDENT_ID}', '9월 16일 과제', '[{"keyword_id":"${keywordId}","count":2}]'::jsonb);`);
    expect(batchId).toMatch(/^[0-9a-f-]{36}$/);
    const label = psql(`select label from homework_batches where id = '${batchId}';`);
    expect(label).toBe("9월 16일 과제");
    const count = psql(`select jsonb_array_length(items) from homework_batches where id = '${batchId}';`);
    expect(Number(count)).toBeGreaterThan(0);
    expect(Number(count)).toBeLessThanOrEqual(2);
  });

  it("담당이 아닌 교사는 거절된다", () => {
    const out = fails(() => asUser(otherTeacherId, `select issue_homework_batch_v2('${STUDENT_ID}', '테스트', '[{"keyword_id":"${keywordId}","count":1}]'::jsonb);`));
    expect(out).toContain("담당하는 학생에게만");
  });

  it("발급할 때마다 새 배치가 생긴다(같은 학생에게 두 번 발급하면 배치가 두 개)", () => {
    const before = Number(asUser(TEACHER_ID, `select count(*) from homework_batches where teacher_id = '${TEACHER_ID}' and student_id = '${STUDENT_ID}';`));
    asUser(TEACHER_ID, `select issue_homework_batch_v2('${STUDENT_ID}', '두 번째 발급', '[{"keyword_id":"${keywordId}","count":1}]'::jsonb);`);
    const after = Number(asUser(TEACHER_ID, `select count(*) from homework_batches where teacher_id = '${TEACHER_ID}' and student_id = '${STUDENT_ID}';`));
    expect(after).toBe(before + 1);
  });

  it("이미 이 학생에게 발급된 문제는 다른 배치에서도 다시 뽑지 않는다", () => {
    const batchId = asUser(TEACHER_ID, `select issue_homework_batch_v2('${STUDENT_ID}', '전량발급', '[{"keyword_id":"${keywordId}","count":20}]'::jsonb);`);
    const idsBefore = psql(`select jsonb_array_elements(items)->>'problemId' from homework_batches where id = '${batchId}';`).split("\n").filter(Boolean);
    const out = fails(() => asUser(TEACHER_ID, `select issue_homework_batch_v2('${STUDENT_ID}', '더는없음', '[{"keyword_id":"${keywordId}","count":20}]'::jsonb);`));
    if (out) expect(out).toContain("고를 수 있는 문제가 없습니다");
    const stillThere = psql(`select jsonb_array_elements(items)->>'problemId' from homework_batches where id = '${batchId}';`).split("\n").filter(Boolean);
    expect(stillThere).toEqual(idsBefore);
  });
});

describe("homework_batches RLS — 발급 교사·학생 본인만 보고, 다른 교사·다른 학생에게는 노출되지 않는다", () => {
  it("발급 교사·학생 본인은 조회할 수 있다", () => {
    const batchId = asUser(TEACHER_ID, `select issue_homework_batch_v2('${STUDENT_ID}', 'RLS테스트', '[{"keyword_id":"${keywordId}","count":1}]'::jsonb);`);
    expect(asUser(TEACHER_ID, `select count(*) from homework_batches where id = '${batchId}';`)).toBe("1");
    expect(asUser(STUDENT_ID, `select count(*) from homework_batches where id = '${batchId}';`)).toBe("1");
  });

  it("무관한 교사·무관한 학생에게는 노출되지 않는다", () => {
    const anyBatch = psql(`select id from homework_batches where teacher_id = '${TEACHER_ID}' and student_id = '${STUDENT_ID}' limit 1;`);
    expect(asUser(otherTeacherId, `select count(*) from homework_batches where id = '${anyBatch}';`)).toBe("0");
    expect(asUser(otherStudentId, `select count(*) from homework_batches where id = '${anyBatch}';`)).toBe("0");
  });
});
