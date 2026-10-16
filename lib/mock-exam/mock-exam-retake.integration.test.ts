import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// 모의고사 재응시(2026-10-08 오너 결정) — 이미 응시한 시험도 모든 학생이 다시 볼 수 있고, 매 응시는 회차(attempt_no)로 따로 기록된다.
// 마이그레이션 20262100000370: 단일 응시 유니크 폐기 → (학생,시험,회차) 유니크 + "진행 중(graded 아님) 응시는 시험당 하나" 부분 유니크.
// 재실행 안전: 실행 ID(RUN)로 학생·세트를 만들고 끝에 이 실행이 만든 행만 지운다(공유 로컬 DB — db reset 금지).

const DB_URL = process.env.SUPABASE_TEST_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const RUN = `rt${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const run = promisify(execFile);

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], { encoding: "utf-8" }).trim();
}
function asSql(userId: string, sql: string): string {
  return `set role authenticated; do $$ begin perform set_config('request.jwt.claim.sub', '${userId}', false); end $$; ${sql} reset role;`;
}
const asUser = (userId: string, sql: string) => psql(asSql(userId, sql));
function fails(fn: () => unknown): string {
  try {
    fn();
  } catch (e) {
    return String((e as { stderr?: string }).stderr ?? e);
  }
  return "";
}
function createStudent(label: string): string {
  const id = psql(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', '${RUN}-${label}@example.com', 'x', now(), '{}', '{}', now(), now())
     returning id;`,
  );
  psql(`insert into profiles (id, role, name) values ('${id}', 'student', '${RUN}-${label}');`);
  psql(`insert into students (id, status) values ('${id}', 'active');`);
  return id;
}
const start = (student: string, setId: string) => asUser(student, `select mock_exam_open_start('${setId}');`);
const grade = (attemptId: string) =>
  psql(`update mock_exam_attempts set status = 'graded', submitted_at = now(), graded_at = now(), attempt_count = 1 where id = '${attemptId}';`);
const attemptRows = (student: string, setId: string) =>
  psql(`select string_agg(attempt_no || ':' || status, ',' order by attempt_no) from mock_exam_attempts where student_id = '${student}' and exam_set_group_id = (select set_group_id from mock_exam_sets where id = '${setId}');`);

let s1: string, s2: string;
let setA: string, setB: string;

beforeAll(() => {
  s1 = createStudent("one");
  s2 = createStudent("two");
  const mk = (label: string) =>
    psql(`insert into mock_exam_sets (name, difficulty_tier, status, format, readiness_status, published_at)
          values ('${RUN}-${label}', 'standard', 'published', 'fixed', 'not_applicable', now()) returning id;`);
  setA = mk("A");
  setB = mk("B");
});

afterAll(() => {
  psql(`begin; set local session_replication_role = replica;
    delete from mock_exam_answers where attempt_id in (select a.id from mock_exam_attempts a join mock_exam_sets s on s.id = a.exam_set_id where s.name like '${RUN}-%');
    delete from mock_exam_attempts where exam_set_id in (select id from mock_exam_sets where name like '${RUN}-%');
    delete from mock_exam_sets where name like '${RUN}-%';
    delete from students where id in (select id from profiles where name like '${RUN}-%');
    delete from profiles where name like '${RUN}-%';
    delete from auth.users where email like '${RUN}-%@example.com';
    commit;`);
  expect(psql(`select count(*) from profiles where name like '${RUN}-%';`)).toBe("0");
});

describe("mock_exam_open_start — 재응시 상태 전이", () => {
  it("첫 응시는 1회차, 진행 중에 다시 시작하면 같은 응시를 이어서 돌려준다", () => {
    const first = start(s1, setA);
    expect(attemptRows(s1, setA)).toBe("1:assigned");
    expect(start(s1, setA)).toBe(first);
    psql(`update mock_exam_attempts set status = 'in_progress', started_at = now() where id = '${first}';`);
    expect(start(s1, setA)).toBe(first);
    expect(attemptRows(s1, setA)).toBe("1:in_progress");
  });

  it("채점이 끝난 시험을 다시 시작하면 새 회차(2회차)가 생기고 1회차 기록은 그대로다", () => {
    const first = psql(`select id from mock_exam_attempts where student_id = '${s1}' and attempt_no = 1 and exam_set_id = '${setA}';`);
    grade(first);
    const second = start(s1, setA);
    expect(second).not.toBe(first);
    expect(attemptRows(s1, setA)).toBe("1:graded,2:assigned");
    expect(psql(`select status from mock_exam_attempts where id = '${first}';`)).toBe("graded");
    // 2회차 진행 중 재시작은 멱등(이어하기) — 3회차가 생기지 않는다.
    expect(start(s1, setA)).toBe(second);
    expect(attemptRows(s1, setA)).toBe("1:graded,2:assigned");
  });

  it("2회차도 채점되면 3회차를 시작할 수 있다(횟수 제한 없음)", () => {
    const second = psql(`select id from mock_exam_attempts where student_id = '${s1}' and attempt_no = 2 and exam_set_id = '${setA}';`);
    grade(second);
    start(s1, setA);
    expect(attemptRows(s1, setA)).toBe("1:graded,2:graded,3:assigned");
  });

  it("제출됐지만 아직 채점 전(submitted)이면 새 회차를 만들지 않고 그 응시를 돌려준다", () => {
    const third = psql(`select id from mock_exam_attempts where student_id = '${s1}' and attempt_no = 3 and exam_set_id = '${setA}';`);
    psql(`update mock_exam_attempts set status = 'submitted', submitted_at = now() where id = '${third}';`);
    expect(start(s1, setA)).toBe(third);
    expect(attemptRows(s1, setA)).toBe("1:graded,2:graded,3:submitted");
  });

  it("다른 학생·다른 시험의 회차 번호는 서로 독립이다", () => {
    start(s2, setA);
    start(s1, setB);
    expect(attemptRows(s2, setA)).toBe("1:assigned");
    expect(attemptRows(s1, setB)).toBe("1:assigned");
  });

  it("동시 재시작 경쟁 — 채점 직후 같은 학생이 8번 동시에 시작해도 새 회차는 하나, 모두 같은 id", async () => {
    const open = psql(`select id from mock_exam_attempts where student_id = '${s2}' and attempt_no = 1 and exam_set_id = '${setA}';`);
    grade(open);
    const results = await Promise.all(
      Array.from({ length: 8 }, () => run("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", asSql(s2, `select mock_exam_open_start('${setA}');`)])),
    );
    expect(new Set(results.map((r) => r.stdout.trim())).size).toBe(1);
    expect(attemptRows(s2, setA)).toBe("1:graded,2:assigned");
  });

  it("DB 제약 — 진행 중 응시를 직접 하나 더 넣거나 회차 번호를 겹치게 할 수 없다", () => {
    expect(fails(() => psql(`insert into mock_exam_attempts (exam_set_id, student_id) values ('${setA}', '${s2}');`))).toContain("mock_exam_attempts_one_open_per_student_per_exam");
    // 트리거가 항상 max+1 을 부여하므로 번호를 직접 겹치려면 갱신해야 한다.
    expect(fails(() => psql(`update mock_exam_attempts set attempt_no = 1 where student_id = '${s2}' and attempt_no = 2 and exam_set_id = '${setA}';`))).toContain("mock_exam_attempts_student_exam_attempt_no");
  });

  it("공개가 내려간(보관) 시험은 진행 중 응시는 이어갈 수 있지만 새 회차는 시작할 수 없다", () => {
    const setC = psql(`insert into mock_exam_sets (name, difficulty_tier, status, format, readiness_status, published_at)
      values ('${RUN}-C', 'standard', 'published', 'fixed', 'not_applicable', now()) returning id;`);
    const a1 = start(s1, setC);
    psql(`update mock_exam_sets set status = 'archived', archived_at = now() where id = '${setC}';`);
    expect(start(s1, setC)).toBe(a1); // 진행 중 — 이어하기
    grade(a1);
    expect(fails(() => start(s1, setC))).toContain("published exams");
    expect(attemptRows(s1, setC)).toBe("1:graded");
  });
});

describe("재응시 읽기 RPC — 회차 분리", () => {
  it("summaries: 응시마다 한 행, attemptNo·attemptTotal 이 실리고 다른 학생 것은 섞이지 않는다", () => {
    const rows = JSON.parse(asUser(s1, `select mock_exam_attempt_summaries('${s1}');`)) as { attemptNo: number; attemptTotal: number; examSetId: string; status: string; setGroupId: string }[];
    const a = rows.filter((r) => r.examSetId === setA).sort((x, y) => x.attemptNo - y.attemptNo);
    expect(a.map((r) => r.attemptNo)).toEqual([1, 2, 3]);
    expect(a.every((r) => r.attemptTotal === 3)).toBe(true);
    expect(rows.filter((r) => r.examSetId === setB).map((r) => r.attemptNo)).toEqual([1]);
    expect(new Set(a.map((r) => r.setGroupId)).size).toBe(1);
  });

  it("catalog: 시험당 한 행(중복 없음), 최신 회차 id·상태와 전체 회차 수를 싣는다", () => {
    const rows = JSON.parse(asUser(s1, `select mock_exam_open_catalog('${s1}');`)) as { examSetId: string; attemptId: string; attemptNo: number; attemptTotal: number; attemptStatus: string }[];
    const mine = rows.filter((r) => r.examSetId === setA);
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ attemptNo: 3, attemptTotal: 3, attemptStatus: "submitted" });
    const latest = psql(`select id from mock_exam_attempts where student_id = '${s1}' and attempt_no = 3 and exam_set_id = '${setA}';`);
    expect(mine[0].attemptId).toBe(latest);
  });

  it("detail: attemptNo·attemptTotal 이 실리고 기존 attemptCount(제출 플래그)는 덮어쓰지 않는다", () => {
    const first = psql(`select id from mock_exam_attempts where student_id = '${s1}' and attempt_no = 1 and exam_set_id = '${setA}';`);
    const d = JSON.parse(asUser(s1, `select mock_exam_attempt_detail('${first}');`)) as { attemptNo: number; attemptTotal: number; attemptCount: number };
    expect(d).toMatchObject({ attemptNo: 1, attemptTotal: 3, attemptCount: 1 });
  });

  it("다른 학생은 이 학생의 회차 목록을 읽을 수 없다", () => {
    expect(fails(() => asUser(s2, `select mock_exam_attempt_summaries('${s1}');`))).toContain("permission");
  });

  it("weakness: 같은 시험을 여러 번 봐도 시험당 최신 채점 응시만 센다", () => {
    // 이 시험(setA)에 문항 하나를 붙이고 1회차는 오답, 2회차는 정답으로 기록한다.
    const pv = psql(`select id from problem_versions limit 1;`);
    const problem = psql(`select problem_id from problem_versions where id = '${pv}';`);
    const item = psql(`insert into mock_exam_set_items (exam_set_id, section, position, problem_id, problem_version_id, sat_domain, skill_code, difficulty)
      select '${setA}', 'rw', 1, '${problem}', '${pv}', 'rw_craft_structure', 'words_in_context', 'medium' returning id;`);
    const ids = psql(`select string_agg(id::text, ',' order by attempt_no) from mock_exam_attempts where student_id = '${s1}' and exam_set_id = '${setA}';`).split(",");
    psql(`insert into mock_exam_answers (attempt_id, set_item_id, response, correct) values ('${ids[0]}', '${item}', '0', false), ('${ids[1]}', '${item}', '1', true);`);
    const w = JSON.parse(asUser(s1, `select mock_exam_weakness_summary('${s1}');`)) as { gradedAttemptCount: number; byDomain: { key: string; total: number; correct: number }[] };
    const dom = w.byDomain.find((d) => d.key === "rw_craft_structure");
    expect(dom).toMatchObject({ total: 1, correct: 1 }); // 2회차(최신 채점)만 — 1회차 오답은 중복 집계하지 않는다
    expect(w.gradedAttemptCount).toBeGreaterThanOrEqual(2);
  });
});
