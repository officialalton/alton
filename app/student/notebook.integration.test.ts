import { execFileSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// 2026-10-08 My Notebook — student_notebook_folders / student_notebook_assignments RLS·제약 통합 테스트
// (20262100000341) + 단어 수 RPC(20262100000340). 공유 로컬 DB(54422)에 실행 ID가 붙은 전용 학생만 만들고
// request.jwt.claims 로 RLS 를 실제로 태운다. 종료 시 실행 ID 단위로 정리한다.

const DB_URL = process.env.SUPABASE_TEST_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const RUN = `nb-${Date.now()}`;

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], { encoding: "utf-8" }).trim();
}
/** 한 트랜잭션 안에서 사용자로 실행하고 롤백하지 않는다(읽기 결과 반환용 마지막 select 만 출력). */
function asUser(userId: string, sql: string): string {
  const claims = `'{"sub":"${userId}","role":"authenticated"}'`;
  return psql(`begin; set local role authenticated; set local request.jwt.claims = ${claims}; ${sql} commit;`);
}
/** 실패해야 하는 문장 — 에러 메시지를 돌려준다. */
function asUserFails(userId: string, sql: string): string {
  const claims = `'{"sub":"${userId}","role":"authenticated"}'`;
  try {
    execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", `begin; set local role authenticated; set local request.jwt.claims = ${claims}; ${sql} commit;`], { encoding: "utf-8", stdio: ["ignore", "ignore", "pipe"] });
  } catch (e) {
    return String((e as { stderr?: Buffer }).stderr ?? e);
  }
  throw new Error("expected failure");
}
function student(label: string): string {
  const id = psql(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', '${RUN}-${label}@example.com', 'x', now(), '{}', '{}', now(), now()) returning id;`,
  ).split("\n")[0];
  psql(`insert into profiles (id, role, name) values ('${id}', 'student', 'NB ${label} ${RUN}');`);
  psql(`insert into students (id, grade, status, member_type, signup_source, profile_completed_at) values ('${id}', '10', 'active', 'free', 'self_signup', now());`);
  return id;
}

let A = "";
let B = "";

beforeAll(() => {
  A = student("a");
  B = student("b");
});
afterAll(() => {
  psql(`delete from profiles where id in ('${A}', '${B}');`);
  psql(`delete from auth.users where email like '${RUN}-%';`);
});

describe("student_notebook_folders", () => {
  it("기본 폴더는 ensure 함수로만 만들어지고 멱등이며, 직접 생성·이름 변경·삭제는 막힌다", () => {
    const id1 = asUser(A, `select ensure_default_notebook_folder('${A}');`).split("\n")[0];
    const id2 = asUser(A, `select ensure_default_notebook_folder('${A}');`).split("\n")[0];
    expect(id1).toBe(id2);
    expect(psql(`select name || '|' || is_default from student_notebook_folders where id = '${id1}'`)).toBe("Review later|true");
    expect(asUserFails(A, `insert into student_notebook_folders (student_id, name, is_default) values ('${A}', 'sneaky', true);`)).toMatch(/row-level security/);
    asUser(A, `update student_notebook_folders set name = 'renamed' where id = '${id1}';`);
    expect(psql(`select name from student_notebook_folders where id = '${id1}'`)).toBe("Review later"); // RLS 로 0행 갱신
    asUser(A, `delete from student_notebook_folders where id = '${id1}';`);
    expect(psql(`select count(*) from student_notebook_folders where id = '${id1}'`)).toBe("1");
  });

  it("다른 학생은 ensure 를 대신 못 만들고, 폴더를 보지도 못한다", () => {
    expect(asUserFails(B, `select ensure_default_notebook_folder('${A}');`)).toMatch(/Only the student/);
    const f = asUser(A, `insert into student_notebook_folders (student_id, name) values ('${A}', 'Mine ${RUN}') returning id;`).split("\n")[0];
    expect(asUser(B, `select count(*) from student_notebook_folders where id = '${f}';`)).toBe("0");
    asUser(B, `update student_notebook_folders set name = 'hacked' where id = '${f}';`);
    asUser(B, `delete from student_notebook_folders where id = '${f}';`);
    expect(psql(`select name from student_notebook_folders where id = '${f}'`)).toBe(`Mine ${RUN}`);
    expect(asUserFails(B, `insert into student_notebook_folders (student_id, name) values ('${A}', 'forged');`)).toMatch(/row-level security/);
  });

  it("이름은 학생별로 대소문자 무시 유일하고, 빈 이름·41자는 거부, 30개 상한", () => {
    asUser(A, `insert into student_notebook_folders (student_id, name) values ('${A}', 'Unique ${RUN}');`);
    expect(asUserFails(A, `insert into student_notebook_folders (student_id, name) values ('${A}', 'unique ${RUN}');`)).toMatch(/duplicate key/);
    // 같은 이름도 다른 학생은 가능
    asUser(B, `insert into student_notebook_folders (student_id, name) values ('${B}', 'Unique ${RUN}');`);
    expect(asUserFails(A, `insert into student_notebook_folders (student_id, name) values ('${A}', '   ');`)).toMatch(/check/);
    expect(asUserFails(A, `insert into student_notebook_folders (student_id, name) values ('${A}', '${"x".repeat(41)}');`)).toMatch(/check/);
    const have = Number(psql(`select count(*) from student_notebook_folders where student_id = '${B}'`));
    for (let i = have; i < 30; i++) asUser(B, `insert into student_notebook_folders (student_id, name) values ('${B}', 'f${i}');`);
    expect(asUserFails(B, `insert into student_notebook_folders (student_id, name) values ('${B}', 'one-too-many');`)).toMatch(/up to 30 folders/);
  });
});

describe("student_notebook_assignments", () => {
  it("본인 폴더에만 배정되고(다른 학생 폴더 불가), 옮기기·빼기가 되며, 폴더 삭제는 배정만 지운다", () => {
    const fa = asUser(A, `insert into student_notebook_folders (student_id, name) values ('${A}', 'Assign ${RUN}') returning id;`).split("\n")[0];
    const fb = asUser(B, `select id from student_notebook_folders where student_id = '${B}' limit 1;`).split("\n")[0];
    const key = `mock:${RUN}:item1`;
    asUser(A, `insert into student_notebook_assignments (student_id, problem_key, folder_id) values ('${A}', '${key}', '${fa}');`);
    // 다른 학생의 폴더에 넣으려는 시도·다른 학생 이름으로 넣으려는 시도
    expect(asUserFails(A, `insert into student_notebook_assignments (student_id, problem_key, folder_id) values ('${A}', '${key}-x', '${fb}');`)).toMatch(/row-level security/);
    expect(asUserFails(B, `insert into student_notebook_assignments (student_id, problem_key, folder_id) values ('${A}', '${key}-y', '${fa}');`)).toMatch(/row-level security/);
    expect(asUser(B, `select count(*) from student_notebook_assignments where problem_key = '${key}';`)).toBe("0");
    // 같은 문제는 한 폴더에만(upsert 로 이동)
    const fa2 = asUser(A, `insert into student_notebook_folders (student_id, name) values ('${A}', 'Assign2 ${RUN}') returning id;`).split("\n")[0];
    asUser(A, `insert into student_notebook_assignments (student_id, problem_key, folder_id) values ('${A}', '${key}', '${fa2}') on conflict (student_id, problem_key) do update set folder_id = excluded.folder_id;`);
    expect(psql(`select folder_id = '${fa2}' from student_notebook_assignments where student_id = '${A}' and problem_key = '${key}'`)).toBe("t");
    // 폴더 삭제 → 배정 행만 사라지고(문제 원본은 이 테이블 밖), 다른 폴더 배정은 유지
    asUser(A, `insert into student_notebook_assignments (student_id, problem_key, folder_id) values ('${A}', '${key}-2', '${fa}');`);
    asUser(A, `delete from student_notebook_folders where id = '${fa2}';`);
    expect(psql(`select count(*) from student_notebook_assignments where student_id = '${A}' and problem_key = '${key}'`)).toBe("0");
    expect(psql(`select count(*) from student_notebook_assignments where student_id = '${A}' and problem_key = '${key}-2'`)).toBe("1");
    // 폴더에서 빼기
    asUser(A, `delete from student_notebook_assignments where student_id = '${A}' and problem_key = '${key}-2';`);
    expect(psql(`select count(*) from student_notebook_assignments where student_id = '${A}'`)).toBe("0");
  });
});

describe("vocab_library_book_word_counts (단어장 속도)", () => {
  it("권별 단어 수가 직접 센 값과 같고, 로그인하지 않은 호출은 막힌다", () => {
    const direct = psql(`select string_agg(book_id::text || ':' || n, ',' order by book_id) from (select book_id, count(*) n from vocab_library_words group by book_id) t`);
    const viaRpc = asUser(A, `select string_agg(book_id::text || ':' || word_count, ',' order by book_id) from vocab_library_book_word_counts();`);
    expect(viaRpc).toBe(direct);
    expect(() => psql(`begin; set local role anon; select * from vocab_library_book_word_counts(); commit;`)).toThrow();
  });
});
