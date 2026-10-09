import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// 모의고사 '배정' 폐지(2026-10-01) — 공개 세트 공통 노출 + 학생 '시작' RPC 권한 매트릭스, 카탈로그 RPC, 기존 배정 응시 공존,
// 보드 할 일 감사 필드(서버 기록·위조 불가). psql + `set role` + `request.jwt.claim.sub` 로 RLS 를 그대로 태운다.
// 재실행 안전: 실행 ID(RUN)로 이름·이메일을 격리하고, 끝에 이 실행이 만든 학생·세트·응시·할 일만 정리한다.

const DB_URL = process.env.SUPABASE_TEST_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const TEACHER_ID = "dddddddd-0000-0000-0000-000000000001"; // 시드: STUDENT_ID 담당 선생님
const STUDENT_ID = "cccccccc-0000-0000-0000-000000000001"; // 시드: 활성 학생
const GUARDIAN_ID = "bbbbbbbb-0000-0000-0000-000000000001"; // 시드: STUDENT_ID 보호자
const RUN = `oa${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const run = promisify(execFile);

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], { encoding: "utf-8" }).trim();
}
function asSql(role: string, userId: string | null, sql: string): string {
  const claim = userId ? `do $$ begin perform set_config('request.jwt.claim.sub', '${userId}', false); end $$;` : "";
  return `set role ${role}; ${claim} ${sql} reset role;`;
}
function asUser(userId: string, sql: string): string {
  return psql(asSql("authenticated", userId, sql));
}
function fails(fn: () => unknown): string {
  try {
    fn();
  } catch (e) {
    return String((e as { stderr?: string }).stderr ?? e);
  }
  return "";
}
function createProfile(role: string, label: string, status?: "active" | "inactive"): string {
  const id = psql(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', '${RUN}-${label}@example.com', 'x', now(), '{}', '{}', now(), now())
     returning id;`,
  );
  psql(`insert into profiles (id, role, name) values ('${id}', '${role}', '${RUN}-${label}');`);
  if (status) psql(`insert into students (id, status) values ('${id}', '${status}');`);
  return id;
}
function createSet(label: string, status: "draft" | "published" | "archived", format: "fixed" | "mst" = "fixed"): string {
  const archived = status === "archived" ? ", archived_at" : "";
  const archivedVal = status === "archived" ? ", now()" : "";
  const readiness = format === "mst" ? "'incomplete'" : "'not_applicable'";
  return psql(
    `insert into mock_exam_sets (name, difficulty_tier, status, format, readiness_status, published_at${archived})
     values ('${RUN}-${label}', 'standard', '${status}', '${format}', ${readiness}, ${status === "published" ? "now()" : "null"}${archivedVal}) returning id;`,
  );
}
const attemptCount = (studentId: string, setId: string) =>
  Number(psql(`select count(*) from mock_exam_attempts where student_id = '${studentId}' and exam_set_group_id = (select set_group_id from mock_exam_sets where id = '${setId}');`));

let activeA: string, activeB: string, activeC: string, inactive: string, otherGuardian: string;
let pubSet: string, pubSet2: string, draftSet: string, archivedSet: string, mstDraftSet: string;

beforeAll(() => {
  activeA = createProfile("student", "A", "active");
  activeB = createProfile("student", "B", "active");
  activeC = createProfile("student", "C", "active");
  inactive = createProfile("student", "inactive", "inactive");
  otherGuardian = createProfile("parent", "stranger");
  pubSet = createSet("published", "published");
  pubSet2 = createSet("published2", "published");
  draftSet = createSet("draft", "draft");
  archivedSet = createSet("archived", "archived");
  mstDraftSet = createSet("mst-draft", "draft", "mst");
});

afterAll(() => {
  // 이 실행이 만든 행만 지운다(RUN 접두). replica 모드로 FK 순서·트리거를 건너뛴다.
  psql(`begin; set local session_replication_role = replica;
    delete from board_manual_tasks where student_id in (select id from profiles where name like '${RUN}-%') or title like '${RUN}-%';
    delete from mock_exam_answers where attempt_id in (select a.id from mock_exam_attempts a join mock_exam_sets s on s.id = a.exam_set_id where s.name like '${RUN}-%');
    delete from mock_exam_attempt_modules where attempt_id in (select a.id from mock_exam_attempts a join mock_exam_sets s on s.id = a.exam_set_id where s.name like '${RUN}-%');
    delete from mock_exam_attempts where exam_set_id in (select id from mock_exam_sets where name like '${RUN}-%');
    delete from mock_exam_sets where name like '${RUN}-%';
    delete from students where id in (select id from profiles where name like '${RUN}-%');
    delete from profiles where name like '${RUN}-%';
    delete from auth.users where email like '${RUN}-%@example.com';
    commit;`);
  expect(psql(`select count(*) from profiles where name like '${RUN}-%';`)).toBe("0");
});

describe("mock_exam_open_start — 권한 매트릭스", () => {
  it("활성 학생은 공개·구성 완료 세트를 시작할 수 있고 응시는 시작 전(assigned)으로 생긴다", () => {
    const id = asUser(activeA, `select mock_exam_open_start('${pubSet}');`);
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(psql(`select status || ',' || student_id from mock_exam_attempts where id = '${id}';`)).toBe(`assigned,${activeA}`);
  });

  it("중복 시작은 멱등 — 같은 응시 id 를 돌려주고 응시는 하나뿐이다", () => {
    const first = asUser(activeA, `select mock_exam_open_start('${pubSet}');`);
    const second = asUser(activeA, `select mock_exam_open_start('${pubSet}');`);
    expect(second).toBe(first);
    expect(attemptCount(activeA, pubSet)).toBe(1);
  });

  it("비활성 학생·학부모·선생님은 거절된다", () => {
    expect(fails(() => asUser(inactive, `select mock_exam_open_start('${pubSet}');`))).toContain("active students");
    expect(fails(() => asUser(GUARDIAN_ID, `select mock_exam_open_start('${pubSet}');`))).toContain("active students");
    expect(fails(() => asUser(otherGuardian, `select mock_exam_open_start('${pubSet}');`))).toContain("active students");
    expect(fails(() => asUser(TEACHER_ID, `select mock_exam_open_start('${pubSet}');`))).toContain("active students");
    expect(attemptCount(inactive, pubSet)).toBe(0);
  });

  it("익명(미로그인)은 거절된다 — 실행 권한 자체가 없다", () => {
    const out = fails(() => psql(asSql("anon", null, `select mock_exam_open_start('${pubSet}');`)));
    expect(out).toMatch(/permission denied/i);
  });

  it("미공개(draft)·보관 세트·없는 세트는 시작할 수 없다", () => {
    expect(fails(() => asUser(activeB, `select mock_exam_open_start('${draftSet}');`))).toContain("published exams");
    expect(fails(() => asUser(activeB, `select mock_exam_open_start('${archivedSet}');`))).toContain("published exams");
    expect(fails(() => asUser(activeB, `select mock_exam_open_start('${mstDraftSet}');`))).toContain("published exams");
    expect(fails(() => asUser(activeB, `select mock_exam_open_start(gen_random_uuid());`))).toContain("Exam not found");
    expect(attemptCount(activeB, draftSet) + attemptCount(activeB, archivedSet) + attemptCount(activeB, mstDraftSet)).toBe(0);
  });

  it("동시 시작 경쟁 — 같은 학생이 동시에 8번 시작해도 응시는 하나, 모두 같은 id 를 받는다", async () => {
    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        run("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", asSql("authenticated", activeB, `select mock_exam_open_start('${pubSet2}');`)]),
      ),
    );
    const ids = new Set(results.map((r) => r.stdout.trim()));
    expect(ids.size).toBe(1);
    expect(attemptCount(activeB, pubSet2)).toBe(1);
  });

  it("학생·교사의 응시 직접 INSERT 와 학생의 응시 직접 UPDATE 는 RLS 가 막는다", () => {
    expect(fails(() => asUser(activeC, `insert into mock_exam_attempts (exam_set_id, student_id) values ('${pubSet}', '${activeC}');`))).toMatch(/row-level security|policy/i);
    expect(fails(() => asUser(TEACHER_ID, `insert into mock_exam_attempts (exam_set_id, student_id, assigned_by) values ('${pubSet}', '${STUDENT_ID}', '${TEACHER_ID}');`))).toMatch(/row-level security|policy/i);
    const id = asUser(activeA, `select mock_exam_open_start('${pubSet}');`);
    asUser(activeA, `update mock_exam_attempts set status = 'graded' where id = '${id}';`);
    expect(psql(`select status from mock_exam_attempts where id = '${id}';`)).toBe("assigned");
  });

  it("DB 고유 제약 — 서비스 롤이 같은 학생·세트를 한 번 더 넣으면 위반", () => {
    expect(fails(() => psql(`insert into mock_exam_attempts (exam_set_id, student_id) values ('${pubSet}', '${activeA}');`))).toMatch(/duplicate key|unique/i);
  });
});

describe("기존 배정 응시와 공존", () => {
  it("이미 배정돼 있던 응시(마감일 포함)는 그대로 유효하고 시작 RPC 가 건드리지 않는다", () => {
    const legacyId = psql(
      `insert into mock_exam_attempts (exam_set_id, student_id, assigned_by, due_at) values ('${pubSet}', '${activeC}', '${TEACHER_ID}', now() + interval '3 days') returning id;`,
    );
    expect(asUser(activeC, `select mock_exam_open_start('${pubSet}');`)).toBe(legacyId);
    expect(psql(`select (assigned_by is not null)::text || ',' || (due_at is not null)::text || ',' || status from mock_exam_attempts where id = '${legacyId}';`)).toBe("true,true,assigned");
    const cat = JSON.parse(asUser(activeC, `select mock_exam_open_catalog('${activeC}')::text;`)) as { examSetId: string; attemptId: string | null }[];
    expect(cat.find((r) => r.examSetId === pubSet)?.attemptId).toBe(legacyId);
  });

  it("세트가 보관된 뒤에도 기존 응시는 시작 RPC 로 그대로 열린다(멱등), 새로 시작은 거절", () => {
    const set = createSet("later-archived", "published");
    const id = asUser(activeA, `select mock_exam_open_start('${set}');`);
    psql(`update mock_exam_sets set status = 'archived', archived_at = now() where id = '${set}';`);
    expect(asUser(activeA, `select mock_exam_open_start('${set}');`)).toBe(id);
    expect(fails(() => asUser(activeB, `select mock_exam_open_start('${set}');`))).toContain("published exams");
  });
});

describe("mock_exam_open_catalog — 공개 세트 + 본인 응시(N+1 없음)", () => {
  it("공개 세트만 한 번에 내려주고, 응시 유무를 함께 돌려준다(draft·보관 제외)", () => {
    const cat = JSON.parse(asUser(activeA, `select mock_exam_open_catalog('${activeA}')::text;`)) as { examSetId: string; attemptId: string | null; attemptStatus: string | null }[];
    const ids = cat.map((r) => r.examSetId);
    expect(ids).toContain(pubSet);
    expect(ids).toContain(pubSet2);
    expect(ids).not.toContain(draftSet);
    expect(ids).not.toContain(archivedSet);
    expect(cat.find((r) => r.examSetId === pubSet)?.attemptStatus).toBe("assigned");
    expect(cat.find((r) => r.examSetId === pubSet2)?.attemptId).toBeNull();
  });

  it("보호자·담당 선생님은 자녀·담당 학생 기준으로 읽고, 무관한 사람은 거절된다", () => {
    expect(JSON.parse(asUser(GUARDIAN_ID, `select mock_exam_open_catalog('${STUDENT_ID}')::text;`))).toBeInstanceOf(Array);
    expect(JSON.parse(asUser(TEACHER_ID, `select mock_exam_open_catalog('${STUDENT_ID}')::text;`))).toBeInstanceOf(Array);
    expect(fails(() => asUser(otherGuardian, `select mock_exam_open_catalog('${activeA}')::text;`))).toContain("do not have permission");
    expect(fails(() => asUser(activeB, `select mock_exam_open_catalog('${activeA}')::text;`))).toContain("do not have permission");
  });
});

describe("보드 할 일 감사 필드 — 서버 기록·위조 불가", () => {
  it("생성 시 생성자·생성일·편집자·편집일이 서버 값으로 기록된다(클라이언트가 보낸 created_by·created_at 은 무시)", () => {
    const id = asUser(
      TEACHER_ID,
      `insert into board_manual_tasks (student_id, title, created_by, created_by_role, created_at, updated_by)
       values ('${STUDENT_ID}', '${RUN}-task1', '${STUDENT_ID}', 'teacher', '2000-01-01', '${STUDENT_ID}') returning id;`,
    );
    const row = psql(`select created_by || '|' || coalesce(created_by_name,'') || '|' || updated_by || '|' || (created_at > now() - interval '1 minute')::text from board_manual_tasks where id = '${id}';`);
    const [cb, cbName, ub, fresh] = row.split("|");
    expect(cb).toBe(TEACHER_ID);
    expect(cbName.length).toBeGreaterThan(0);
    expect(ub).toBe(TEACHER_ID);
    expect(fresh).toBe("true");
  });

  it("이동·완료·수정 시 편집자·편집일이 갱신되고 생성 정보는 바뀌지 않는다(위조 시도 무시)", () => {
    const id = asUser(TEACHER_ID, `insert into board_manual_tasks (student_id, title, created_by, created_by_role) values ('${STUDENT_ID}', '${RUN}-task2', '${TEACHER_ID}', 'teacher') returning id;`);
    const before = psql(`select created_at::text || '|' || updated_at::text from board_manual_tasks where id = '${id}';`);
    psql("select pg_sleep(0.05);");
    // 학생이 이동하면서 created_by·updated_by 를 위조하려 해도 서버가 덮어쓴다.
    asUser(STUDENT_ID, `update board_manual_tasks set status = 'done', created_by = '${GUARDIAN_ID}', created_at = '2001-01-01', updated_by = '${TEACHER_ID}', updated_by_name = '위조' where id = '${id}';`);
    const after = psql(
      `select created_by || '|' || created_at::text || '|' || updated_by || '|' || coalesce(updated_by_name,'') || '|' || (updated_at > '${before.split("|")[1]}'::timestamptz)::text || '|' || status from board_manual_tasks where id = '${id}';`,
    ).split("|");
    expect(after[0]).toBe(TEACHER_ID); // 생성자 불변
    expect(after[1]).toBe(before.split("|")[0]); // 생성일 불변
    expect(after[2]).toBe(STUDENT_ID); // 편집자 = 실제 호출자
    expect(after[3]).not.toBe("위조");
    expect(after[3].length).toBeGreaterThan(0);
    expect(after[4]).toBe("true");
    expect(after[5]).toBe("done");
  });

  it("서비스 롤(호출자 없음) 수정은 편집자를 유지하고 편집일만 갱신한다", () => {
    const id = asUser(TEACHER_ID, `insert into board_manual_tasks (student_id, title, created_by, created_by_role) values ('${STUDENT_ID}', '${RUN}-task3', '${TEACHER_ID}', 'teacher') returning id;`);
    psql(`update board_manual_tasks set status = 'in_progress' where id = '${id}';`);
    expect(psql(`select updated_by from board_manual_tasks where id = '${id}';`)).toBe(TEACHER_ID);
  });
});
