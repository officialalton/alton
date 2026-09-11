import { createClient } from "@supabase/supabase-js";
import { describe, expect, it, beforeAll, afterAll } from "vitest";

// 2026-09-10(P1 성능 배치) — get_emails_by_user_ids(migration 20261271000000)를
// 실제 로컬 Postgres/Auth에 대고 검증한다: 빈 배열, 중복 id, 존재하지 않는
// id, 200명 초과 대상, 대소문자가 섞인 이메일, 그리고 service_role 외
// 역할(authenticated)은 호출할 수 없다는 권한 경계.

const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

const admin = createClient("http://127.0.0.1:54421", SERVICE_ROLE_KEY);

let mixedCaseUserId = "";
const MIXED_CASE_EMAIL = "MixedCase.User+p1@Example.COM";

beforeAll(async () => {
  const { data, error } = await admin.auth.admin.createUser({
    email: MIXED_CASE_EMAIL,
    password: "test-password-12345",
    email_confirm: true,
  });
  if (error) throw error;
  mixedCaseUserId = data.user!.id;
});

afterAll(async () => {
  if (mixedCaseUserId) await admin.auth.admin.deleteUser(mixedCaseUserId);
});

describe("get_emails_by_user_ids RPC", () => {
  it("빈 배열은 빈 결과를 돌려준다(에러 없음)", async () => {
    const { data, error } = await admin.rpc("get_emails_by_user_ids", { p_user_ids: [] });
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("존재하지 않는 id는 결과에서 조용히 빠진다", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const { data, error } = await admin.rpc("get_emails_by_user_ids", { p_user_ids: [fakeId] });
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("중복 id를 넘겨도 실제 존재하는 사용자당 한 행만 돌아온다", async () => {
    const { data, error } = await admin.rpc("get_emails_by_user_ids", {
      p_user_ids: [mixedCaseUserId, mixedCaseUserId, mixedCaseUserId],
    });
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data![0].user_id).toBe(mixedCaseUserId);
  });

  it("대소문자가 섞인 이메일로 가입한 사용자도 auth.users에 저장된 값 그대로 돌려준다(함수가 추가로 변형하지 않음)", async () => {
    // Supabase Auth 자체가 auth.users.email을 소문자로 정규화해 저장한다
    // (이 프로젝트의 다른 로직과 무관한 Auth 계층 동작) — 이 테스트는 그
    // 저장된 값을 함수가 다시 변형(추가 정규화/대소문자 변경)하지 않고
    // 그대로 돌려주는지만 확인한다.
    const { data: userRow } = await admin.auth.admin.getUserById(mixedCaseUserId);
    const storedEmail = userRow.user!.email;
    expect(storedEmail).toBe(MIXED_CASE_EMAIL.toLowerCase());

    const { data, error } = await admin.rpc("get_emails_by_user_ids", { p_user_ids: [mixedCaseUserId] });
    expect(error).toBeNull();
    expect(data![0].email).toBe(storedEmail);
  });

  it("200명을 넘는 대상(대부분 존재하지 않는 id)도 한 번에 처리하고 실제 존재하는 것만 돌려준다", async () => {
    const fakeIds = Array.from(
      { length: 250 },
      (_, i) => `00000000-0000-0000-0000-${String(i).padStart(12, "0")}`
    );
    const { data, error } = await admin.rpc("get_emails_by_user_ids", {
      p_user_ids: [...fakeIds, mixedCaseUserId],
    });
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data![0].user_id).toBe(mixedCaseUserId);
  });

  it("authenticated 역할은 이 함수를 호출할 수 없다(service_role 전용)", async () => {
    const { data: signIn, error: signInError } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: MIXED_CASE_EMAIL,
    });
    expect(signInError).toBeNull();
    // service_role 키 대신 anon 키로 클라이언트를 만들고, 방금 만든 사용자로
    // 로그인해 진짜 authenticated 세션을 얻는다.
    const authedClient = createClient("http://127.0.0.1:54421", ANON_KEY);
    const { error: verifyError } = await authedClient.auth.verifyOtp({
      type: "magiclink",
      token_hash: signIn.properties!.hashed_token,
    });
    expect(verifyError).toBeNull();

    const { error } = await authedClient.rpc("get_emails_by_user_ids", { p_user_ids: [mixedCaseUserId] });
    expect(error).not.toBeNull();
  });
});
