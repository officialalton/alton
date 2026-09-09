import { createHash } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { describe, expect, it } from "vitest";

// 배치 2-2 corrective(20261258000000) — bypass_invite_protect GUC를
// status_transition_tokens 1회용 토큰으로 교체한 뒤의 회귀 테스트. 대상은
// protect_account_invite_status() 트리거 + resend_account_invite() +
// revoke_account_invite() + claim_account_invite() +
// resolve_manual_review_invite() + mark_expired_invites() 5개 함수뿐이다
// (create_account_invite()/finalize_account_invite()는 이 GUC와 무관 —
// 이 파일이 건드리지 않는다). psql shell-out 패턴은
// app/admin/account-status-protect-token.integration.test.ts와 동일.

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const ADMIN_ID = "aaaaaaaa-0000-0000-0000-000000000001";

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], {
    encoding: "utf-8",
  }).trim();
}

function asUser(userId: string, sql: string): string {
  return psql(`
    set role authenticated;
    select set_config('request.jwt.claim.sub', '${userId}', false);
    ${sql}
    reset role;
  `);
}

function asAnon(sql: string): string {
  return psql(`
    set role anon;
    ${sql}
    reset role;
  `);
}

function lastLine(output: string): string {
  const lines = output.split("\n").filter((l) => l.trim().length > 0);
  return lines[lines.length - 1]?.trim() ?? "";
}

function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function createParent(label: string): string {
  const now = Date.now();
  const id = psql(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'invite-token-parent-${label}-${now}@example.com', 'x', now(), '{}', '{}', now(), now())
     returning id;`
  );
  psql(`
    insert into profiles (id, role, name) values ('${id}', 'parent', '토큰테스트 학부모(${label})');
    insert into parents (id, status) values ('${id}', 'active');
  `);
  return id;
}

function createHousehold(guardianId: string): string {
  const id = psql(`insert into households (primary_guardian_id) values ('${guardianId}') returning id;`);
  psql(
    `insert into household_members (household_id, profile_id, role, is_primary) values ('${id}', '${guardianId}', 'guardian', true);`
  );
  return id;
}

function grantInviteCapability(profileId: string): void {
  psql(`insert into supervisor_capabilities (profile_id, capability) values ('${profileId}', 'manage_invites');`);
}

// account_invites 행을 직접 INSERT한다(INSERT는 status 보호 트리거 대상이
// 아니므로 GUC/토큰과 무관하게 항상 허용) — create_account_invite()는 이
// corrective의 대상이 아니므로 호출하지 않고 직접 시드한다.
function insertInvite(opts: {
  label: string;
  role: "parent" | "student";
  householdId?: string | null;
  invitedBy: string;
  status?: string;
  expiresInHours?: number;
  rawToken?: string;
}): { inviteId: string; rawToken: string } {
  const rawToken = opts.rawToken ?? `raw-${opts.label}-${Date.now()}-${Math.random()}`;
  const tokenHash = sha256Hex(rawToken);
  const now = Date.now();
  const expiresAt = `now() + interval '${opts.expiresInHours ?? 168} hours'`;
  const householdSql = opts.householdId ? `'${opts.householdId}'` : "null";
  const inviteId = psql(`
    insert into account_invites (
      email_normalized, email_original, invitee_name, role, household_id, invited_by,
      status, token_hash, expires_at
    ) values (
      lower('invite-${opts.label}-${now}@example.com'), 'invite-${opts.label}-${now}@example.com',
      '초대테스트(${opts.label})', '${opts.role}', ${householdSql}, '${opts.invitedBy}',
      '${opts.status ?? "pending"}', '${tokenHash}', ${expiresAt}
    ) returning id;
  `);
  return { inviteId, rawToken };
}

describe("protect_account_invite_status() / 5개 호출자 — status_transition_tokens 1회용 토큰(corrective 회귀)", () => {
  it("① 정상 경로 — resend_account_invite() 본인 경로", () => {
    const inviter = createParent("resend-self");
    const { inviteId } = insertInvite({ label: "resend-self", role: "parent", invitedBy: inviter });

    asUser(inviter, `select resend_account_invite('${inviteId}'::uuid);`);

    const oldStatus = psql(`select status from account_invites where id = '${inviteId}';`);
    expect(oldStatus).toBe("superseded");

    const newRow = psql(
      `select status, token_generation from account_invites where superseded_by_id = '${inviteId}' or email_normalized = (select email_normalized from account_invites where id = '${inviteId}') and id <> '${inviteId}';`
    );
    expect(newRow).toBe("pending|2");

    const tokenLeft = psql(`select count(*) from status_transition_tokens where table_name = 'account_invites' and row_id = '${inviteId}';`);
    expect(tokenLeft).toBe("0");
  });

  it("① 정상 경로 — resend_account_invite() capability 보유자 경로(본인 아님)", () => {
    const inviter = createParent("resend-cap-inviter");
    const supervisor = createParent("resend-cap-supervisor");
    grantInviteCapability(supervisor);
    const { inviteId } = insertInvite({ label: "resend-cap", role: "parent", invitedBy: inviter });

    asUser(supervisor, `select resend_account_invite('${inviteId}'::uuid);`);

    const status = psql(`select status from account_invites where id = '${inviteId}';`);
    expect(status).toBe("superseded");
  });

  it("① 정상 경로 — revoke_account_invite() 본인 경로", () => {
    const inviter = createParent("revoke-self");
    const { inviteId } = insertInvite({ label: "revoke-self", role: "parent", invitedBy: inviter });

    asUser(inviter, `select revoke_account_invite('${inviteId}'::uuid);`);

    const status = psql(`select status from account_invites where id = '${inviteId}';`);
    expect(status).toBe("revoked");

    const tokenLeft = psql(`select count(*) from status_transition_tokens where table_name = 'account_invites' and row_id = '${inviteId}';`);
    expect(tokenLeft).toBe("0");
  });

  it("① 정상 경로 — claim_account_invite() anon 정상 수락(부모)", () => {
    const inviter = createParent("claim-anon-parent-inviter");
    const { inviteId, rawToken } = insertInvite({ label: "claim-anon-parent", role: "parent", invitedBy: inviter });

    const result = asAnon(`select status from claim_account_invite('${rawToken}');`);
    expect(result).toBe("accepted");

    const status = psql(`select status, accepted_at is not null from account_invites where id = '${inviteId}';`);
    expect(status).toBe("accepted|t");
  });

  it("① 정상 경로 — resolve_manual_review_invite() link 분기(관리자)", () => {
    const inviter = createParent("resolve-link-inviter");
    const guardian = createParent("resolve-link-guardian");
    const householdId = createHousehold(guardian);
    const { inviteId } = insertInvite({
      label: "resolve-link",
      role: "student",
      householdId,
      invitedBy: inviter,
      status: "manual_review",
    });
    const targetStudent = createParent("resolve-link-target"); // 프로필만 있으면 되므로 parent 헬퍼 재사용

    asUser(
      ADMIN_ID,
      `select resolve_manual_review_invite('${inviteId}'::uuid, 'link', '${targetStudent}'::uuid, '${targetStudent}'::uuid);`
    );

    const row = psql(`select status, target_profile_id from account_invites where id = '${inviteId}';`);
    expect(row).toBe(`accepted|${targetStudent}`);

    const tokenLeft = psql(`select count(*) from status_transition_tokens where table_name = 'account_invites' and row_id = '${inviteId}';`);
    expect(tokenLeft).toBe("0");
  });

  it("① 정상 경로 — resolve_manual_review_invite() revoke 분기(capability 보유자)", () => {
    const inviter = createParent("resolve-revoke-inviter");
    const supervisor = createParent("resolve-revoke-supervisor");
    grantInviteCapability(supervisor);
    const { inviteId } = insertInvite({ label: "resolve-revoke", role: "parent", invitedBy: inviter, status: "manual_review" });

    asUser(supervisor, `select resolve_manual_review_invite('${inviteId}'::uuid, 'revoke', null, null);`);

    const status = psql(`select status from account_invites where id = '${inviteId}';`);
    expect(status).toBe("revoked");
  });

  it("① 정상 경로 — mark_expired_invites() 배치 처리(1건)", () => {
    const inviter = createParent("expire-batch-single-inviter");
    const { inviteId } = insertInvite({
      label: "expire-batch-single",
      role: "parent",
      invitedBy: inviter,
      expiresInHours: -1,
    });

    const count = lastLine(asUser(ADMIN_ID, `select mark_expired_invites();`));
    expect(Number(count)).toBeGreaterThanOrEqual(1);

    const status = psql(`select status from account_invites where id = '${inviteId}';`);
    expect(status).toBe("expired");
  });

  it("② 익명 사용자 초대 수락에서 토큰이 정확히 소비됨 — 정확히 1회 발급/소비, 좀비 토큰 0건, 기존 anon 인가 로직 불변", () => {
    const inviter = createParent("claim-token-consume-inviter");
    const { inviteId, rawToken } = insertInvite({ label: "claim-token-consume", role: "parent", invitedBy: inviter });

    // claim 이전: 이 초대에 대한 토큰은 아직 없다.
    const before = psql(`select count(*) from status_transition_tokens where table_name = 'account_invites' and row_id = '${inviteId}';`);
    expect(before).toBe("0");

    const status = asAnon(`select status from claim_account_invite('${rawToken}');`);
    expect(status).toBe("accepted");

    // claim 이후: 토큰은 소비되어 0건이어야 한다(발급 1건 + 트리거가 즉시 소비).
    const after = psql(`select count(*) from status_transition_tokens where table_name = 'account_invites' and row_id = '${inviteId}';`);
    expect(after).toBe("0");

    // 기존 anon 인가 로직(해시 비교) 불변 확인 — 틀린 토큰은 여전히 거부.
    const { inviteId: inviteId2, rawToken: rawToken2 } = insertInvite({
      label: "claim-token-consume-wrong",
      role: "parent",
      invitedBy: inviter,
    });
    expect(() => asAnon(`select status from claim_account_invite('wrong-${rawToken2}');`)).toThrow(/invalid_token/);
    const status2 = psql(`select status from account_invites where id = '${inviteId2}';`);
    expect(status2).toBe("pending");

    // 만료 검사(시간 기준, status와 무관) 불변 확인.
    const { rawToken: expiredToken } = insertInvite({
      label: "claim-token-consume-expired",
      role: "parent",
      invitedBy: inviter,
      expiresInHours: -1,
    });
    expect(() => asAnon(`select status from claim_account_invite('${expiredToken}');`)).toThrow(/expired/);
  });

  it("③ 만료 초대 다건 처리에서 행별 토큰이 정확히 소비됨 — 3건 이상, 상호 오염 없음, 좀비 토큰 0건", () => {
    const inviter = createParent("expire-batch-multi-inviter");
    const invites = [
      insertInvite({ label: "expire-batch-multi-1", role: "parent", invitedBy: inviter, expiresInHours: -1 }),
      insertInvite({ label: "expire-batch-multi-2", role: "parent", invitedBy: inviter, expiresInHours: -2 }),
      insertInvite({ label: "expire-batch-multi-3", role: "parent", invitedBy: inviter, expiresInHours: -3 }),
    ];
    // 만료되지 않은 pending 초대 하나를 섞어 배치가 이것까지 건드리지 않는지 확인.
    const stillPending = insertInvite({ label: "expire-batch-multi-still-pending", role: "parent", invitedBy: inviter });

    const processedCount = Number(lastLine(asUser(ADMIN_ID, `select mark_expired_invites();`)));
    expect(processedCount).toBeGreaterThanOrEqual(3);

    for (const { inviteId } of invites) {
      const status = psql(`select status from account_invites where id = '${inviteId}';`);
      expect(status).toBe("expired");
    }
    const stillStatus = psql(`select status from account_invites where id = '${stillPending.inviteId}';`);
    expect(stillStatus).toBe("pending");

    // 좀비 토큰 0건 — 이번에 처리된 모든 행에 대해.
    const ids = invites.map((i) => `'${i.inviteId}'`).join(",");
    const leftover = Number(psql(`select count(*) from status_transition_tokens where table_name = 'account_invites' and row_id in (${ids});`));
    expect(leftover).toBe(0);

    // 각 행이 각자의 'expired' 이벤트를 정확히 1건씩만 남겼는지(교차 오염 없음).
    for (const { inviteId } of invites) {
      const eventCount = Number(
        psql(`select count(*) from account_invite_events where invite_id = '${inviteId}' and event_type = 'expired';`)
      );
      expect(eventCount).toBe(1);
    }
  });

  it("④ 직접 상태 변경 차단 — account_invites.status를 함수 밖에서 직접 UPDATE하면 거부된다", () => {
    const inviter = createParent("direct-update-block-inviter");
    const { inviteId } = insertInvite({ label: "direct-update-block", role: "parent", invitedBy: inviter });

    expect(() => psql(`update account_invites set status = 'revoked' where id = '${inviteId}';`)).toThrow(
      /지정된 함수\(create\/resend\/accept\/finalize\/revoke\)를 통해서만/
    );

    const status = psql(`select status from account_invites where id = '${inviteId}';`);
    expect(status).toBe("pending");
  });

  it("⑤ 레거시 GUC 무효화 — app.bypass_invite_protect를 직접 SET해도 새 설계에는 아무 효과가 없다", () => {
    const inviter = createParent("legacy-guc-noop-inviter");
    const { inviteId } = insertInvite({ label: "legacy-guc-noop", role: "parent", invitedBy: inviter });

    expect(() =>
      psql(`
        set app.bypass_invite_protect = 'true';
        update account_invites set status = 'revoked' where id = '${inviteId}';
      `)
    ).toThrow(/지정된 함수\(create\/resend\/accept\/finalize\/revoke\)를 통해서만/);

    const status = psql(`select status from account_invites where id = '${inviteId}';`);
    expect(status).toBe("pending");
  });

  it("⑥ 임시 테이블 위조 차단 — 세션 로컬 temp table로 위조 토큰을 심어도 거부된다", () => {
    const inviter = createParent("temp-table-attack-inviter");
    const { inviteId } = insertInvite({ label: "temp-table-attack", role: "parent", invitedBy: inviter });

    expect(() =>
      psql(`
        create temp table status_transition_tokens (
          table_name text not null,
          row_id uuid not null,
          action text not null,
          xact_id bigint not null default txid_current(),
          created_at timestamptz not null default now()
        );
        begin;
        insert into status_transition_tokens (table_name, row_id, action, xact_id)
        values ('account_invites', '${inviteId}', 'invite_status_transition', txid_current());
        update account_invites set status = 'revoked' where id = '${inviteId}';
        commit;
      `)
    ).toThrow(/지정된 함수\(create\/resend\/accept\/finalize\/revoke\)를 통해서만/);

    const status = psql(`select status from account_invites where id = '${inviteId}';`);
    expect(status).toBe("pending");
  });

  it("⑦ 재시도 — claim_account_invite()를 이미 accepted인 초대에 다시 호출해도 멱등 성공, 새 토큰/이벤트 없음", () => {
    const inviter = createParent("claim-retry-inviter");
    const { inviteId, rawToken } = insertInvite({ label: "claim-retry", role: "parent", invitedBy: inviter });

    const first = asAnon(`select status from claim_account_invite('${rawToken}');`);
    expect(first).toBe("accepted");

    const eventCountAfterFirst = Number(
      psql(`select count(*) from account_invite_events where invite_id = '${inviteId}' and event_type = 'accepted';`)
    );
    expect(eventCountAfterFirst).toBe(1);

    // 재시도 — 에러 없이 같은 결과.
    const second = asAnon(`select status from claim_account_invite('${rawToken}');`);
    expect(second).toBe("accepted");

    const eventCountAfterSecond = Number(
      psql(`select count(*) from account_invite_events where invite_id = '${inviteId}' and event_type = 'accepted';`)
    );
    expect(eventCountAfterSecond).toBe(1); // 중복 이벤트 없음

    const tokenLeft = Number(
      psql(`select count(*) from status_transition_tokens where table_name = 'account_invites' and row_id = '${inviteId}';`)
    );
    expect(tokenLeft).toBe(0);
  });

  it("⑧ 동시성 — 같은 초대에 대한 두 claim_account_invite() 시도는 정확히 하나만 실질적 전이, 다른 하나는 accepted 멱등/거부", async () => {
    const inviter = createParent("concurrency-same-invite-inviter");
    const { inviteId, rawToken } = insertInvite({ label: "concurrency-same-invite", role: "parent", invitedBy: inviter });

    function callClaim(): Promise<{ ok: boolean; output: string }> {
      return new Promise((resolve) => {
        const child = spawn("psql", [
          DB_URL,
          "-v",
          "ON_ERROR_STOP=1",
          "-q",
          "-t",
          "-A",
          "-c",
          `
            set role anon;
            select status from claim_account_invite('${rawToken}');
            reset role;
          `,
        ]);
        let output = "";
        child.stdout.on("data", (d) => (output += d.toString()));
        child.stderr.on("data", (d) => (output += d.toString()));
        child.on("close", (code) => resolve({ ok: code === 0, output }));
      });
    }

    const [first, second] = await Promise.all([callClaim(), callClaim()]);
    const results = [first, second];

    // for update 잠금 덕분에 둘 다 성공(직렬화됨) — 두 번째는 첫 번째가 이미
    // 커밋한 accepted 상태를 재조회해 멱등 분기로 빠진다. 둘 다 실패하지 않는다.
    expect(results.every((r) => r.ok)).toBe(true);
    expect(results.map((r) => r.output.trim())).toEqual(["accepted", "accepted"]);

    const finalStatus = psql(`select status from account_invites where id = '${inviteId}';`);
    expect(finalStatus).toBe("accepted");

    const eventCount = Number(
      psql(`select count(*) from account_invite_events where invite_id = '${inviteId}' and event_type = 'accepted';`)
    );
    expect(eventCount).toBe(1);

    const tokenLeft = Number(
      psql(`select count(*) from status_transition_tokens where table_name = 'account_invites' and row_id = '${inviteId}';`)
    );
    expect(tokenLeft).toBe(0);
  });

  it("⑧ 동시성 — 서로 다른 두 초대에 대한 동시 revoke는 계속 독립적으로 성공한다", async () => {
    const inviter = createParent("concurrency-diff-invite-inviter");
    const { inviteId: inviteA } = insertInvite({ label: "concurrency-diff-a", role: "parent", invitedBy: inviter });
    const { inviteId: inviteB } = insertInvite({ label: "concurrency-diff-b", role: "parent", invitedBy: inviter });

    function callRevoke(inviteId: string): Promise<{ ok: boolean; output: string }> {
      return new Promise((resolve) => {
        const child = spawn("psql", [
          DB_URL,
          "-v",
          "ON_ERROR_STOP=1",
          "-q",
          "-t",
          "-A",
          "-c",
          `
            set role authenticated;
            select set_config('request.jwt.claim.sub', '${inviter}', false);
            select revoke_account_invite('${inviteId}'::uuid);
            reset role;
          `,
        ]);
        let output = "";
        child.stdout.on("data", (d) => (output += d.toString()));
        child.stderr.on("data", (d) => (output += d.toString()));
        child.on("close", (code) => resolve({ ok: code === 0, output }));
      });
    }

    const [resA, resB] = await Promise.all([callRevoke(inviteA), callRevoke(inviteB)]);
    expect(resA.ok).toBe(true);
    expect(resB.ok).toBe(true);

    expect(psql(`select status from account_invites where id = '${inviteA}';`)).toBe("revoked");
    expect(psql(`select status from account_invites where id = '${inviteB}';`)).toBe("revoked");

    const leftover = Number(
      psql(`select count(*) from status_transition_tokens where table_name = 'account_invites' and row_id in ('${inviteA}', '${inviteB}');`)
    );
    expect(leftover).toBe(0);
  });

  it("⑨ 중간 실패 롤백 — resolve_manual_review_invite() link 분기의 account_invite_events INSERT 실패 시 토큰/status UPDATE/household_members INSERT 전부 롤백된다", () => {
    const inviter = createParent("atomicity-inviter");
    const guardian = createParent("atomicity-guardian");
    const householdId = createHousehold(guardian);
    const { inviteId } = insertInvite({
      label: "atomicity",
      role: "student",
      householdId,
      invitedBy: inviter,
      status: "manual_review",
    });
    const targetStudent = createParent("atomicity-target");

    psql(`
      create or replace function force_invite_event_failure_for_test()
      returns trigger language plpgsql as $$
      begin
        raise exception 'forced failure for invite atomicity test';
      end;
      $$;
    `);
    psql(`
      create trigger force_invite_event_failure
        before insert on account_invite_events
        for each row execute function force_invite_event_failure_for_test();
    `);

    try {
      expect(() =>
        asUser(
          ADMIN_ID,
          `select resolve_manual_review_invite('${inviteId}'::uuid, 'link', '${targetStudent}'::uuid, '${targetStudent}'::uuid);`
        )
      ).toThrow(/forced failure/);

      const status = psql(`select status, target_profile_id from account_invites where id = '${inviteId}';`);
      expect(status).toBe("manual_review|");

      const tokenCount = Number(
        psql(`select count(*) from status_transition_tokens where table_name = 'account_invites' and row_id = '${inviteId}';`)
      );
      expect(tokenCount).toBe(0);

      const hmCount = Number(
        psql(`select count(*) from household_members where household_id = '${householdId}' and profile_id = '${targetStudent}';`)
      );
      expect(hmCount).toBe(0);

      const eventCount = Number(
        psql(`select count(*) from account_invite_events where invite_id = '${inviteId}' and event_type = 'accepted';`)
      );
      expect(eventCount).toBe(0);
    } finally {
      psql(`drop trigger if exists force_invite_event_failure on account_invite_events;`);
      psql(`drop function if exists force_invite_event_failure_for_test();`);
    }
  });
});
