import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// 관리자·담당 컨설턴트 학생 열람 감사 RPC(record_staff_student_view, 20261950000000).
// 실행 ID(RUN) 전용 계정만 만들고 afterAll에서 그 행만 정리한다. 재실행 안전.
const DB_URL = process.env.SUPABASE_TEST_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const RUN = `${Date.now()}`;
const ids = {
  admin: randomUUID(), sup: randomUUID(), conA: randomUUID(), conB: randomUUID(),
  student: randomUUID(), otherStudent: randomUUID(), parent: randomUUID(),
};
const all = Object.values(ids);
const list = (l: string[]) => l.map((i) => `'${i}'`).join(",");

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], { encoding: "utf-8" }).trim();
}
function asUser(uid: string, sql: string): string {
  return psql(`begin; set local role authenticated; do $$ begin perform set_config('request.jwt.claim.sub','${uid}',true); end $$; ${sql}; commit;`)
    .split("\n").filter((l) => l === "t" || l === "f").join(",");
}
function fails(fn: () => unknown): string {
  try { fn(); } catch (e) { return String((e as { stderr?: string }).stderr ?? e); }
  return "";
}
const record = (uid: string, student: string, kind = "board") =>
  asUser(uid, `select public.record_staff_student_view('${student}', '${kind}')`);
const count = (viewer: string, student: string, kind?: string) =>
  Number(psql(`select count(*) from staff_student_view_log where viewer_id='${viewer}' and student_id='${student}' ${kind ? `and view_kind='${kind}'` : ""}`));

function cleanup() {
  psql(`set session_replication_role = replica;
    delete from staff_student_view_log where viewer_id in (${list(all)}) or student_id in (${list(all)});
    delete from consultant_assignments where student_id in (${list(all)});
    delete from profiles where id in (${list(all)});
    delete from auth.users where id in (${list(all)});
    set session_replication_role = origin;`);
}

beforeAll(() => {
  cleanup();
  const users = all.map((i) => `('00000000-0000-0000-0000-000000000000','${i}','authenticated','authenticated','${RUN}-${i}@example.com','x',now(),'{}','{}',now(),now())`).join(",");
  const p = (id: string, role: string, tier = "null") => `('${id}','${role}','${RUN}-${role}',${tier === "null" ? "null" : `'${tier}'`})`;
  psql(`set session_replication_role = replica;
    insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values ${users};
    insert into profiles (id,role,name,admin_tier) values ${[
      p(ids.admin, "admin", "full"), p(ids.sup, "admin", "supervisor"), p(ids.conA, "consultant"), p(ids.conB, "consultant"),
      p(ids.student, "student"), p(ids.otherStudent, "student"), p(ids.parent, "parent")].join(",")};
    insert into consultant_assignments (consultant_id, student_id) values ('${ids.conA}','${ids.student}');
    set session_replication_role = origin;`);
}, 60_000);
afterAll(cleanup, 60_000);

describe("record_staff_student_view", () => {
  it("관리자와 담당 컨설턴트는 기록되고, 같은 조합은 10분 안에 1건으로 묶인다", () => {
    expect(record(ids.admin, ids.student)).toBe("t");
    expect(record(ids.admin, ids.student)).toBe("f");
    expect(record(ids.admin, ids.student, "stats")).toBe("t");
    expect(count(ids.admin, ids.student)).toBe(2);
    expect(record(ids.conA, ids.student)).toBe("t");
    expect(count(ids.conA, ids.student, "board")).toBe(1);
  });
  it("타 컨설턴트·학부모·학생·capability 없는 supervisor는 거절된다", () => {
    expect(fails(() => record(ids.conB, ids.student))).toContain("담당 학생만");
    expect(fails(() => record(ids.conA, ids.otherStudent))).toContain("담당 학생만");
    expect(fails(() => record(ids.parent, ids.student))).toContain("권한이 없습니다");
    expect(fails(() => record(ids.student, ids.student))).toContain("권한이 없습니다");
    expect(fails(() => record(ids.sup, ids.student))).toContain("권한이 없습니다");
    expect(count(ids.conB, ids.student)).toBe(0);
  });
  it("기록은 수정·삭제할 수 없고 관리자만 조회한다", () => {
    expect(fails(() => psql(`update staff_student_view_log set view_kind='stats' where viewer_id='${ids.admin}'`))).toContain("수정·삭제할 수 없습니다");
    expect(fails(() => psql(`delete from staff_student_view_log where viewer_id='${ids.admin}'`))).toContain("수정·삭제할 수 없습니다");
    const seen = (uid: string) => psql(`begin; set local role authenticated; do $$ begin perform set_config('request.jwt.claim.sub','${uid}',true); end $$; select count(*) from staff_student_view_log where student_id='${ids.student}'; commit;`).split("\n").pop();
    expect(Number(seen(ids.admin))).toBeGreaterThan(0);
    expect(Number(seen(ids.conA))).toBe(0);
  });
});
