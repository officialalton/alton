import { execFileSync } from "node:child_process";
import { describe, expect, it, afterAll } from "vitest";

// 관리자 Messenger 안읽음 집계 SQL 함수 검증(로컬 supabase 공유 DB).
// 실행마다 고유 프로필·문의를 만들고 전/후 델타로 센다 — 재실행·병렬 안전. 끝나면 정리.
const DB = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const psql = (sql: string) => execFileSync("psql", [DB, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], { encoding: "utf-8" }).trim();
const counts = () => {
  const [t, c, f] = psql("select teachers, consultants, family from admin_messenger_unread_counts()").split("|").map(Number);
  return { t, c, f };
};
const run = `mu${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
const created: { users: string[]; households: string[] } = { users: [], households: [] };

function user(role: "teacher" | "consultant" | "parent" | "admin", label: string): string {
  const id = psql(`insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
    values ('00000000-0000-0000-0000-000000000000',gen_random_uuid(),'authenticated','authenticated','${run}-${label}@example.com','x',now(),'{}','{}',now(),now()) returning id;`).split("\n")[0];
  psql(`insert into profiles (id, role, name) values ('${id}','${role}','${run}${label}');`);
  created.users.push(id);
  return id;
}

afterAll(() => {
  const u = created.users.map((i) => `'${i}'`).join(",");
  if (!u) return;
  psql(`delete from consultant_admin_inquiries where consultant_id in (${u}); delete from teacher_admin_inquiries where teacher_id in (${u});`);
  for (const h of created.households) psql(`delete from household_message_reads where household_id='${h}'; delete from household_messages where household_id='${h}'; delete from household_inquiries where household_id='${h}'; delete from households where id='${h}';`);
  psql(`delete from profiles where id in (${u}); delete from auth.users where id in (${u});`);
});

describe("admin_messenger_unread_counts / admin_unread_staff_inquiry_ids", () => {
  const admin = user("admin", "admin");

  it.each([
    ["teachers", "teacher", "teacher_admin_inquiries", "teacher_admin_messages", "teacher_id", "teacher_admin_inquiry_admin_reads"],
    ["consultants", "consultant", "consultant_admin_inquiries", "consultant_admin_messages", "consultant_id", "consultant_admin_inquiry_admin_reads"],
  ] as const)("%s: 스태프 메시지=안읽음, 읽음 후 0, 새 메시지 후 다시 1, 종료 시 제외, 관리자 답장은 무관", (kind, role, inqT, msgT, col, readT) => {
    const key = kind === "teachers" ? "t" : "c";
    const other = kind === "teachers" ? "c" : "t";
    const staff = user(role, kind);
    const base = counts();
    const inq = psql(`insert into ${inqT} (${col}, opened_by, opened_by_role) values ('${staff}','${admin}','admin') returning id;`).split("\n")[0];
    psql(`insert into ${msgT} (inquiry_id, sender_id, sender_role, body) values ('${inq}','${admin}','admin','hi');`);
    expect(counts()[key] - base[key]).toBe(0); // 관리자 발신만 → 안읽음 아님
    psql(`insert into ${msgT} (inquiry_id, sender_id, sender_role, body) values ('${inq}','${staff}','${role}','q1');`);
    expect(counts()[key] - base[key]).toBe(1);
    expect(counts()[other] - base[other]).toBe(0); // 다른 채널 영향 없음
    expect(psql(`select count(*) from admin_unread_staff_inquiry_ids('${kind}') x where x = '${inq}'`)).toBe("1");
    // 읽음 처리
    psql(`insert into ${readT} (inquiry_id, last_read_at) values ('${inq}', now()) on conflict (inquiry_id) do update set last_read_at = excluded.last_read_at;`);
    expect(counts()[key] - base[key]).toBe(0);
    // 관리자 답장은 안읽음에 영향 없음
    psql(`insert into ${msgT} (inquiry_id, sender_id, sender_role, body) values ('${inq}','${admin}','admin','r');`);
    expect(counts()[key] - base[key]).toBe(0);
    // 이후 도착한 스태프 메시지 → 다시 안읽음
    psql(`select pg_sleep(0.01); insert into ${msgT} (inquiry_id, sender_id, sender_role, body) values ('${inq}','${staff}','${role}','q2');`);
    expect(counts()[key] - base[key]).toBe(1);
    // 종료되면 제외
    psql(`update ${inqT} set status='closed' where id='${inq}';`);
    expect(counts()[key] - base[key]).toBe(0);
  });

  it("가족: 보호자 메시지=안읽음(household 단위 관리자 읽음 기준), 읽음 후 0", () => {
    const base = counts();
    const g = user("parent", "guardian");
    psql(`insert into parents (id) values ('${g}');`);
    const h = psql(`insert into households (primary_guardian_id) values ('${g}') returning id;`).split("\n")[0];
    created.households.push(h);
    const inq = psql(`insert into household_inquiries (household_id, opened_by, opened_by_role) values ('${h}','${g}','guardian') returning id;`).split("\n")[0];
    psql(`insert into household_messages (household_id, inquiry_id, sender_id, sender_role, body) values ('${h}','${inq}','${g}','guardian','문의');`);
    expect(counts().f - base.f).toBe(1);
    psql(`insert into household_message_reads (household_id, viewer_role, last_read_at) values ('${h}','admin', now());`);
    expect(counts().f - base.f).toBe(0);
  });

  it("권한: authenticated/anon 역할은 두 함수를 호출할 수 없다, 읽음 테이블은 비관리자 접근 불가", () => {
    for (const role of ["authenticated", "anon"]) {
      expect(() => psql(`set role ${role}; select * from admin_messenger_unread_counts();`)).toThrow();
      expect(() => psql(`set role ${role}; select * from admin_unread_staff_inquiry_ids('teachers');`)).toThrow();
    }
    // 비관리자 authenticated: 읽음 테이블 쓰기 RLS 거부(0행 조회, insert 거부)
    const staff = user("teacher", "rls");
    expect(() =>
      psql(`set role authenticated; select set_config('request.jwt.claim.sub','${staff}',true); insert into teacher_admin_inquiry_admin_reads (inquiry_id) values (gen_random_uuid());`)
    ).toThrow();
    expect(psql(`select has_function_privilege('service_role','admin_messenger_unread_counts()','execute')`)).toBe("t");
  });
});
