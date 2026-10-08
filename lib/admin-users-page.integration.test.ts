import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

// admin_users_page() — 사용자 탭 서버 페이지네이션. 전부 트랜잭션 안에서 rollback한다(공유 로컬 DB 보호).
const DB_URL = process.env.SUPABASE_TEST_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54422/postgres";

function psql(sql: string): { ok: boolean; out: string } {
  try {
    const out = execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-F", "|", "-c", sql], {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
    return { ok: true, out };
  } catch (e) {
    return { ok: false, out: String((e as { stderr?: string }).stderr ?? e) };
  }
}

const run = `uip${randomUUID().slice(0, 8)}`;
const ZERO = "00000000-0000-0000-0000-000000000000";

// 학부모 25명(이름 ${run} P01..P25), 학생 12명(그중 3명 free), 선생님 3명, 가구 2개(하나는 아카이브).
const setup = `
  create temp table u as select gen_random_uuid() id, g from generate_series(1,40) g;
  insert into auth.users (id, instance_id, aud, role, email)
    select id,'${ZERO}','authenticated','authenticated','${run}-'||g||'@t.test' from u;
  insert into profiles (id, role, name)
    select id, (case when g<=25 then 'parent' when g<=37 then 'student' else 'teacher' end)::profile_role,
      '${run} '||(case when g<=25 then 'P' when g<=37 then 'S' else 'T' end)||lpad(g::text,2,'0') from u;
  insert into parents (id, joined_at) select id, now() - (g||' minutes')::interval from u where g<=25;
  insert into students (id, member_type, joined_at) select id, case when g in (26,27,28) then 'free' else 'tutoring' end, now() - (g||' minutes')::interval from u where g>25 and g<=37;
  insert into teachers (id) select id from u where g>37;
  -- 가구 A: 보호자 g=1 + 자녀 g=26 (활성) / 가구 B: 보호자 g=2 + 자녀 g=27 (아카이브)
  create temp table hh as select gen_random_uuid() hid, (select id from u where g=1) pid, (select id from u where g=26) cid, null::timestamptz arch
    union all select gen_random_uuid(), (select id from u where g=2), (select id from u where g=27), now();
  insert into households (id, primary_guardian_id, archived_at) select hid,pid,arch from hh;
  insert into household_members (household_id, profile_id, role, is_primary) select hid,pid,'guardian',true from hh;
  insert into household_members (household_id, profile_id, role) select hid,cid,'child' from hh;`;

const q = (call: string) => psql(`begin; ${setup} ${call}; rollback;`);

describe("admin_users_page", () => {
  it("학부모: 10명씩 잘라 반환하고 전체 건수는 한 쿼리에서 나온다(아카이브 가구 보호자 제외)", () => {
    const p1 = q(`select count(*), max(total_count) from admin_users_page('parent','${run}',null,10,0)`);
    expect(p1.out).toContain("10|24");
    const p3 = q(`select count(*), max(total_count) from admin_users_page('parent','${run}',null,10,20)`);
    expect(p3.out).toContain("4|24");
  });
  it("범위를 벗어난 페이지는 빈 결과", () => {
    expect(q(`select count(*) from admin_users_page('parent','${run}',null,10,500)`).out).toContain("0");
  });
  it("최신 가입순으로 정렬한다", () => {
    const r = q(`select p.name from admin_users_page('parent','${run}',null,3,0) a join profiles p on p.id=a.id order by (select joined_at from parents where id=a.id) desc`);
    expect(r.out.split("\n")).toEqual([`${run} P01`, `${run} P03`, `${run} P04`]);
  });
  it("이름·이메일 검색, LIKE 특수문자는 리터럴로 취급", () => {
    expect(q(`select count(*) from admin_users_page('parent','${run} P07',null,10,0)`).out).toContain("1");
    expect(q(`select count(*) from admin_users_page('parent','${run}-9@t',null,10,0)`).out).toContain("1");
    expect(q(`select count(*) from admin_users_page('parent','%',null,10,0)`).out).toContain("0");
  });
  it("학생: 회원 유형 필터·보호자 이름 검색·아카이브 가구 자녀 제외", () => {
    expect(q(`select max(total_count) from admin_users_page('student','${run}',null,10,0)`).out).toContain("11");
    expect(q(`select max(total_count) from admin_users_page('student','${run}','free',10,0)`).out).toContain("2");
    expect(q(`select max(total_count) from admin_users_page('student','${run}','tutoring',10,0)`).out).toContain("9");
    // 보호자 "P01"의 자녀(S26) 한 명만 검색됨
    expect(q(`select count(*) from admin_users_page('student','${run} P01',null,10,0)`).out).toContain("1");
  });
  it("선생님·잘못된 role", () => {
    expect(q(`select max(total_count) from admin_users_page('teacher','${run}',null,10,0)`).out).toContain("3");
    expect(q(`select * from admin_users_page('admin',null,null,10,0)`).ok).toBe(false);
  });
  it("service_role만 실행할 수 있다", () => {
    const r = psql(`begin; set local role authenticated; select * from admin_users_page('parent',null,null,1,0); rollback;`);
    expect(r.ok).toBe(false);
  });
});
