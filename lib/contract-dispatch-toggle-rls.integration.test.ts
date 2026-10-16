import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

// contract_dispatch_settings RLS — 관리자만 조회, 직접 쓰기는 누구도 불가, RPC는 관리자만 + 감사 기록.
// 모든 시나리오는 트랜잭션 안에서 rollback — 공유 로컬 DB를 오염시키지 않는다.
const DB_URL = process.env.SUPABASE_TEST_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54422/postgres";

function psql(sql: string): { ok: boolean; out: string } {
  try {
    const out = execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
    return { ok: true, out };
  } catch (e) {
    return { ok: false, out: String((e as { stderr?: string }).stderr ?? e) };
  }
}
const asUser = (uid: string, body: string) =>
  `begin; set local role authenticated; select set_config('request.jwt.claim.sub','${uid}',true); ${body}; rollback;`;

describe("contract_dispatch_settings RLS", () => {
  const adminId = randomUUID();
  const userId = randomUUID();
  const setup = `
    insert into auth.users (id, instance_id, aud, role, email) values
      ('${adminId}','00000000-0000-0000-0000-000000000000','authenticated','authenticated','a-${adminId}@t.test'),
      ('${userId}','00000000-0000-0000-0000-000000000000','authenticated','authenticated','u-${userId}@t.test');
    insert into profiles (id, role, name) values ('${adminId}','admin','t-admin'), ('${userId}','student','t-user');`;
  const run = (uid: string, body: string) => psql(`begin; ${setup} set local role authenticated; select set_config('request.jwt.claim.sub','${uid}',true); ${body}; rollback;`);

  it("기본값은 켜짐", () => {
    const r = psql("select auto_dispatch_enabled from contract_dispatch_settings where id = true");
    expect(r.out).toBe("t");
  });
  it("비관리자는 조회·갱신·RPC 모두 불가", () => {
    expect(run(userId, "select count(*) from contract_dispatch_settings").out).toContain("0");
    const upd = run(userId, "update contract_dispatch_settings set auto_dispatch_enabled=false where id=true; select 1");
    expect(upd.out).not.toContain("UPDATE 1");
    const rpc = run(userId, "select set_contract_auto_dispatch_enabled(false)");
    expect(rpc.ok).toBe(false);
    expect(rpc.out).toContain("관리자만");
  });
  it("관리자는 조회·RPC 가능, 변경은 감사 기록에 남고 직접 UPDATE는 효과 없음", () => {
    const r = run(
      adminId,
      `select auto_dispatch_enabled from contract_dispatch_settings;
       select set_contract_auto_dispatch_enabled(false);
       select auto_dispatch_enabled from contract_dispatch_settings;
       select old_enabled || ':' || new_enabled || ':' || (changed_by = '${adminId}') from contract_dispatch_settings_audit order by id desc limit 1`
    );
    expect(r.out).not.toMatch(/ERROR/); expect(r.ok).toBe(true);
    expect(r.out).toContain("true:false:true");
  });
});
