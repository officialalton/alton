import { execFileSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// 2026-10-13 — 마이그레이션 590(시험 스크래치 화이트보드 보드 높이) DB 계약: 높이 저장·복원, 4인자 저장이 높이를 보존, 상한, 본인·잠금·읽기 권한.
// 격리 스택 전용(SUPABASE_TEST_DB_URL 필수 — 가드가 공유 스택을 막는다). 실행 ID(RUN) 접두 행만 만들고 afterAll 에서 지운다.

const DB_URL = process.env.SUPABASE_TEST_DB_URL as string;
const ADMIN_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const RUN = `wbsize${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], { encoding: "utf-8" }).trim();
}
function asUser(userId: string, sql: string): string {
  return psql(`set role authenticated; do $$ begin perform set_config('request.jwt.claim.sub', '${userId}', false); end $$; ${sql} reset role;`);
}
function fails(fn: () => unknown): string {
  try { fn(); } catch (e) { return String((e as { stderr?: string }).stderr ?? e); }
  return "";
}
const q = (t: string) => `'${t.replace(/'/g, "''")}'`;
const json = (v: unknown) => `${q(JSON.stringify(v))}::jsonb`;

type Seg = { x0: number; y0: number; x1: number; y1: number; color: string; w: number };
const seg = (y1: number): Seg => ({ x0: 1, y0: 1, x1: 9, y1, color: "#111111", w: 640 });

let student: string; let other: string; let setId: string; let itemId: string; let attempt: string;

function createStudent(label: string): string {
  const id = psql(`insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', '${RUN}-${label}@example.com', 'x', now(), '{}', '{}', now(), now()) returning id;`);
  psql(`insert into profiles (id, role, name, date_of_birth) values ('${id}', 'student', '${RUN}-${label}', '2010-01-01');`);
  psql(`insert into students (id, status, member_type, signup_source, grade, profile_completed_at) values ('${id}', 'active', 'tutoring', 'admin_direct', '10th', now());`);
  return id;
}
const load = (user = student, author?: string) =>
  JSON.parse(asUser(user, `select load_problem_note_board('mock_exam', '${attempt}', '${itemId}', ${author ? `'${author}'` : "null"});`)) as { strokes: Seg[]; boardHeight: number };

beforeAll(() => {
  student = createStudent("s1"); other = createStudent("s2");
  // 최소 행(FK·트리거는 복제 모드로 건너뛴다): 고정형 세트 1개·문항 1개·진행 중 응시 1개.
  psql(`begin; set local session_replication_role = replica;
    insert into mock_exam_sets (name, difficulty_tier) values (${q(`${RUN}-set`)}, 'standard');
    commit;`);
  setId = psql(`select id from mock_exam_sets where name = ${q(`${RUN}-set`)};`);
  psql(`begin; set local session_replication_role = replica;
    insert into mock_exam_set_items (exam_set_id, section, position, problem_id, problem_version_id, sat_domain, difficulty)
      values ('${setId}', 'math', 1, gen_random_uuid(), gen_random_uuid(), 'x', 'medium');
    insert into mock_exam_attempts (exam_set_id, student_id, exam_set_group_id) values ('${setId}', '${student}', gen_random_uuid());
    commit;`);
  itemId = psql(`select id from mock_exam_set_items where exam_set_id = '${setId}';`);
  attempt = psql(`select id from mock_exam_attempts where exam_set_id = '${setId}';`);
});

afterAll(() => {
  psql(`begin; set local session_replication_role = replica;
    delete from problem_note_strokes where target_id in (select id from mock_exam_attempts where exam_set_id in (select id from mock_exam_sets where name like '${RUN}-%'));
    delete from mock_exam_attempts where exam_set_id in (select id from mock_exam_sets where name like '${RUN}-%');
    delete from mock_exam_set_items where exam_set_id in (select id from mock_exam_sets where name like '${RUN}-%');
    delete from mock_exam_sets where name like '${RUN}-%';
    delete from students where id in (select id from profiles where name like '${RUN}-%');
    delete from profiles where name like '${RUN}-%';
    delete from auth.users where email like '${RUN}-%';
    commit;`);
});

function saveBoard(strokes: unknown[], h: number, user = student): string {
  return asUser(user, `select save_problem_note_strokes('mock_exam', '${attempt}', '${itemId}', ${json(strokes)}, ${h});`);
}

describe("problem_note_strokes.board_height (마이그레이션 590)", () => {
  it("행이 없으면 기본 480·빈 필기", () => {
    expect(load()).toEqual({ strokes: [], boardHeight: 480 });
  });
  it("저장하면 필기와 높이가 함께 복원되고, 4인자 저장은 높이를 보존한다", () => {
    saveBoard([seg(300)], 1000);
    expect(load()).toEqual({ strokes: [seg(300)], boardHeight: 1000 });
    asUser(student, `select save_problem_note_strokes('mock_exam', '${attempt}', '${itemId}', ${json([seg(300), seg(310)])});`);
    const b = load();
    expect(b.strokes).toHaveLength(2);
    expect(b.boardHeight).toBe(1000);
    // 기존 4인자 load 도 그대로 동작
    expect(JSON.parse(asUser(student, `select load_problem_note_strokes('mock_exam', '${attempt}', '${itemId}');`))).toHaveLength(2);
  });
  it("높이 범위(480..1600)와 크기 상한을 서버가 강제한다", () => {
    expect(fails(() => saveBoard([], 300))).toContain("Invalid board size");
    expect(fails(() => saveBoard([], 1601))).toContain("Invalid board size");
    const big = `(select jsonb_agg(${json(seg(5))}) from generate_series(1, 20001))`; // 인자 길이 한도를 피해 SQL 안에서 만든다
    expect(fails(() => asUser(student, `select save_problem_note_strokes('mock_exam', '${attempt}', '${itemId}', ${big}, 800);`))).toContain("too large");
    expect(load().boardHeight).toBe(1000); // 거부된 저장은 아무것도 바꾸지 않는다
  });
  it("본인만 저장, 읽기는 본인·관리자만(다른 학생 거부)", () => {
    expect(fails(() => saveBoard([], 700, other))).toContain("only save notes on your own");
    expect(load(ADMIN_ID, student).boardHeight).toBe(1000);
    expect(fails(() => load(other, student))).toMatch(/not allowed|permission|cannot|can only|authorized/i);
  });
  it("제출 후에는 필기·높이 모두 잠긴다", () => {
    psql(`update mock_exam_attempts set status = 'submitted' where id = '${attempt}';`);
    expect(fails(() => saveBoard([seg(1)], 1400))).toContain("already been submitted");
    expect(load().boardHeight).toBe(1000);
  });
});
