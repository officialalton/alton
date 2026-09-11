import { beforeEach, describe, expect, it, vi } from "vitest";

const createUserMock = vi.fn();
const generateLinkMock = vi.fn();
const deleteUserMock = vi.fn().mockResolvedValue({ error: null });
const getUserByIdMock = vi.fn();
const rpcMock = vi.fn();
const updateEqMock = vi.fn().mockResolvedValue({ error: null });
// profiles.select().eq().eq().maybeSingle() — "이미 존재하는 보호자 Auth
// 계정에 profiles 행이 있는지"를 확인하는 체인. 기본값은 "있음"(정상적인
// 기존 보호자)으로 두고, 고아 계정 시나리오를 검증하는 테스트만 null로 덮는다.
const profilesMaybeSingleMock = vi.fn().mockResolvedValue({ data: { id: "existing-guardian-id" } });
// trial_onboarding_links.select("id").neq(...).or(...) — 고아 계정이 다른
// 링크에도 걸려 있는지 확인하는 교차 조회. 기본값은 "없음"(정상적인 단일
// 링크 소유).
const crossLinkOrMock = vi.fn().mockResolvedValue({ data: [], error: null });
const fromMock = vi.fn((table: string) => {
  if (table === "profiles") {
    return { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: profilesMaybeSingleMock }) }) }) };
  }
  if (table === "trial_onboarding_links") {
    return { select: () => ({ neq: () => ({ or: crossLinkOrMock }) }) };
  }
  return { update: () => ({ eq: updateEqMock }) };
});
vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: () => ({
    auth: {
      admin: {
        createUser: createUserMock,
        generateLink: generateLinkMock,
        deleteUser: deleteUserMock,
        getUserById: getUserByIdMock,
      },
    },
    rpc: rpcMock,
    from: fromMock,
  }),
}));

const sendEmailMock = vi.fn();
vi.mock("@/lib/email", () => ({
  sendEmail: (params: unknown) => sendEmailMock(params),
  escapeHtml: (v: string) => v,
}));

import { createGuardianAndStudentThenRedirect } from "./trial-onboarding-finalize";

const BASE_PARAMS = {
  url: new URL("https://alton-preview.vercel.app/api/trial-onboarding/confirm-email"),
  linkId: "link-1",
  guardianEmail: "guardian@example.com",
  guardianName: "보호자",
};

// 2026-09-06(복수 자녀 온보딩) — get_trial_onboarding_link_students는 이제
// createGuardianAndStudentThenRedirect 안에서 두 번 호출된다: (1) Auth 계정을
// 만들어야 할 학생 명단 조회, (2) finalize 이후 실제로 created 처리된 학생에게만
// 비밀번호 설정 초대를 보내기 위한 재조회. 테스트에서는 호출 횟수로 두 상태를
// 흉내낸다(첫 호출=pending, 이후 호출=created — finalize가 성공했다고 가정).
let getStudentsCallCount = 0;

// 기본 rpc 응답 — "이 호출이 유일한 진행자"(claim action: 'proceed')를
// 가정한다. busy/already_redeemed를 검증하는 테스트는 이 함수를 감싸
// claim_trial_onboarding_link_finalize 호출만 골라 덮어쓴다(mockImplementationOnce는
// "다음 rpc 호출"을 가로채는데, find_auth_user_id_by_email이 claim보다 먼저
// 호출되므로 함수 이름으로 구분해야 한다).
function defaultRpcImpl(fnName: string): Promise<{ data: unknown; error: unknown }> {
  if (fnName === "claim_trial_onboarding_link_finalize") {
    return Promise.resolve({
      data: [{ action: "proceed", redeemed_auth_user_id: null, pending_guardian_auth_user_id: null, claim_id: "claim-1" }],
      error: null,
    });
  }
  if (fnName === "record_pending_guardian_account") {
    return Promise.resolve({ data: true, error: null });
  }
  if (fnName === "release_trial_onboarding_link_finalize_claim") {
    return Promise.resolve({ data: null, error: null });
  }
  if (fnName === "find_auth_user_id_by_email") {
    return Promise.resolve({ data: null, error: null });
  }
  if (fnName === "get_trial_onboarding_link_students") {
    getStudentsCallCount += 1;
    const created = getStudentsCallCount > 1;
    return Promise.resolve({
      data: [
        {
          id: "ls-1",
          student_name: "학생",
          student_email: "student@example.com",
          student_grade: null,
          student_subject: null,
          status: created ? "created" : "pending",
          child_auth_user_id: created ? "student-id" : null,
          error: null,
        },
      ],
      error: null,
    });
  }
  if (fnName === "finalize_trial_onboarding_students") {
    return Promise.resolve({
      data: [{ household_id: "household-1", guardian_id: "guardian-id", created_count: 1, failed_count: 0 }],
      error: null,
    });
  }
  return Promise.resolve({ data: null, error: null });
}

beforeEach(() => {
  vi.clearAllMocks();
  getStudentsCallCount = 0;
  updateEqMock.mockResolvedValue({ error: null });
  profilesMaybeSingleMock.mockResolvedValue({ data: { id: "existing-guardian-id" } });
  crossLinkOrMock.mockResolvedValue({ data: [], error: null });
  createUserMock
    .mockResolvedValueOnce({ data: { user: { id: "guardian-id" } }, error: null })
    .mockResolvedValueOnce({ data: { user: { id: "student-id" } }, error: null });
  rpcMock.mockImplementation(defaultRpcImpl);
  generateLinkMock.mockImplementation(async ({ email }: { email: string }) => ({
    data: { properties: { hashed_token: `hash-for-${email}` } },
    error: null,
  }));
});

// 2026-09-11(온보딩 링크 재사용 시 혼란스러운 오류 수정) — 실측 재현(공유
// non-prod, matchbox512+alton-uat-p8@gmail.com): 계정 생성까지 실제로는 전부
// 성공했는데 같은 확인 링크를 다시 열면 "유효하지 않거나 만료된 온보딩
// 링크입니다"라는 원인 불명 오류로 로그인 페이지에 떨어졌다. claim_trial_onboarding_link_finalize()의
// action(busy/already_redeemed/proceed)에 따라 분기가 실제로 갈리는지 검증한다.
describe("createGuardianAndStudentThenRedirect — 온보딩 링크 재사용(claim/lease)", () => {
  it("다른 요청이 리스를 쥐고 있으면(action: busy) 계정 생성 없이 재시도 안내로 리다이렉트한다", async () => {
    rpcMock.mockImplementation((fnName: string) =>
      fnName === "claim_trial_onboarding_link_finalize"
        ? Promise.resolve({ data: [{ action: "busy", redeemed_auth_user_id: null, pending_guardian_auth_user_id: null, claim_id: null }], error: null })
        : defaultRpcImpl(fnName)
    );

    const res = await createGuardianAndStudentThenRedirect(BASE_PARAMS);

    expect(createUserMock).not.toHaveBeenCalled();
    expect(res.headers.get("location")).toContain("/login?error=");
    expect(decodeURIComponent(res.headers.get("location") ?? "")).toContain("다른 요청");
  });

  it("이미 redeemed된 링크(같은 이메일로 이미 성공)는 계정을 다시 만들지 않고 로그인 링크로 안내한다", async () => {
    rpcMock.mockImplementation((fnName: string) =>
      fnName === "claim_trial_onboarding_link_finalize"
        ? Promise.resolve({
            data: [{ action: "already_redeemed", redeemed_auth_user_id: "guardian-id", pending_guardian_auth_user_id: null, claim_id: null }],
            error: null,
          })
        : defaultRpcImpl(fnName)
    );
    getUserByIdMock.mockResolvedValueOnce({ data: { user: { email: "guardian@example.com" } }, error: null });

    const res = await createGuardianAndStudentThenRedirect(BASE_PARAMS);

    expect(createUserMock).not.toHaveBeenCalled();
    expect(generateLinkMock).toHaveBeenCalledWith({ type: "recovery", email: "guardian@example.com" });
    expect(res.headers.get("location")).toContain("/set-password");
  });

  it("already_redeemed인데 이메일이 이 요청과 다르면(데이터 불일치) 계정으로 안내하지 않고 관리자 문의로 막는다", async () => {
    rpcMock.mockImplementation((fnName: string) =>
      fnName === "claim_trial_onboarding_link_finalize"
        ? Promise.resolve({
            data: [{ action: "already_redeemed", redeemed_auth_user_id: "other-guardian-id", pending_guardian_auth_user_id: null, claim_id: null }],
            error: null,
          })
        : defaultRpcImpl(fnName)
    );
    getUserByIdMock.mockResolvedValueOnce({ data: { user: { email: "someone-else@example.com" } }, error: null });

    const res = await createGuardianAndStudentThenRedirect(BASE_PARAMS);

    expect(createUserMock).not.toHaveBeenCalled();
    expect(generateLinkMock).not.toHaveBeenCalled();
    expect(decodeURIComponent(res.headers.get("location") ?? "")).toContain("일치하지 않습니다");
  });

  it("보호자 계정 생성 후 학생 계정 생성이 실패해도 재시도 시 pending_guardian_auth_user_id를 재사용해 보호자 계정을 중복 생성하지 않는다", async () => {
    rpcMock.mockImplementation((fnName: string) =>
      fnName === "claim_trial_onboarding_link_finalize"
        ? Promise.resolve({
            data: [{ action: "proceed", redeemed_auth_user_id: null, pending_guardian_auth_user_id: "already-created-guardian-id", claim_id: "claim-1" }],
            error: null,
          })
        : defaultRpcImpl(fnName)
    );
    createUserMock.mockReset().mockResolvedValueOnce({ data: { user: { id: "student-id" } }, error: null });

    await createGuardianAndStudentThenRedirect(BASE_PARAMS);

    // 보호자 계정은 이미 있으므로(pending_guardian_auth_user_id) createUser는
    // 학생 1명분(1회)만 호출돼야 한다 — 보호자용 호출이 없어야 한다.
    expect(createUserMock).toHaveBeenCalledTimes(1);
    expect(createUserMock).toHaveBeenCalledWith(expect.objectContaining({ email: "student@example.com" }));
  });

  it("record_pending_guardian_account가 claim 소유권 상실을 알리면(false) 방금 만든 보호자 계정을 정리하고 재시도를 안내한다", async () => {
    // 2026-09-11(제품 오너 재검토) — createUser() 성공 직후, record 호출
    // 사이에 리스가 만료돼 다른 요청이 새 claim_id로 넘겨받은 상황을 흉내낸다.
    rpcMock.mockImplementation((fnName: string) => {
      if (fnName === "record_pending_guardian_account") {
        return Promise.resolve({ data: false, error: null });
      }
      return defaultRpcImpl(fnName);
    });

    const res = await createGuardianAndStudentThenRedirect(BASE_PARAMS);

    expect(deleteUserMock).toHaveBeenCalledWith("guardian-id");
    // claim을 잃었으므로 학생 계정 생성으로 진행하지 않는다.
    expect(createUserMock).toHaveBeenCalledTimes(1);
    expect(decodeURIComponent(res.headers.get("location") ?? "")).toContain("충돌");
  });
});

describe("createGuardianAndStudentThenRedirect — 고아 Auth 계정 복구(부분 실패 후 재시도)", () => {
  it("이메일이 이미 auth.users에 있어도 profiles가 없고 이 온보딩 링크가 만든 계정임이 metadata로 증명되면 재사용한다", async () => {
    // 2026-09-11(제품 오너 재검토) — createUser() 성공 직후(record_pending_guardian_account
    // 호출 전) 프로세스가 죽어 고아 계정만 남은 상태의 재시도를 흉내낸다.
    rpcMock.mockImplementation((fnName: string) => {
      if (fnName === "find_auth_user_id_by_email") {
        return Promise.resolve({ data: "orphan-guardian-id", error: null });
      }
      return defaultRpcImpl(fnName);
    });
    profilesMaybeSingleMock.mockResolvedValue({ data: null }); // profiles 없음 — 고아 상태
    getUserByIdMock.mockResolvedValueOnce({
      // app_metadata(=raw_app_meta_data, service_role만 쓸 수 있음)에만
      // 근거를 둔다 — user_metadata는 신뢰하지 않는다는 것을 아래 테스트가 증명한다.
      data: { user: { email: "guardian@example.com", email_confirmed_at: "2026-09-11T00:00:00Z", app_metadata: { trial_onboarding_link_id: "link-1" }, user_metadata: {} } },
      error: null,
    });
    createUserMock.mockReset().mockResolvedValueOnce({ data: { user: { id: "student-id" } }, error: null });

    await createGuardianAndStudentThenRedirect(BASE_PARAMS);

    // 보호자 계정을 새로 만들지 않고(createUser는 학생 1명분만) 고아 계정(orphan-guardian-id)을
    // 재사용해 finalize까지 이어져야 한다.
    expect(createUserMock).toHaveBeenCalledTimes(1);
    expect(createUserMock).toHaveBeenCalledWith(expect.objectContaining({ email: "student@example.com" }));
    const finalizeCall = rpcMock.mock.calls.find((c) => c[0] === "finalize_trial_onboarding_students");
    expect(finalizeCall?.[1]).toMatchObject({ p_guardian_auth_user_id: "orphan-guardian-id", p_new_guardian: true });
  });

  it("이메일이 auth.users에 있고 profiles도 없는데 이 온보딩 링크가 만든 계정이라는 증거가 없으면(무관한 계정) 병합하지 않고 관리자 문의로 막는다", async () => {
    rpcMock.mockImplementation((fnName: string) => {
      if (fnName === "find_auth_user_id_by_email") {
        return Promise.resolve({ data: "unrelated-account-id", error: null });
      }
      return defaultRpcImpl(fnName);
    });
    profilesMaybeSingleMock.mockResolvedValue({ data: null });
    // app_metadata가 없거나 다른 링크를 가리킴 — 이 온보딩이 만든 계정이라는 증거 없음.
    getUserByIdMock.mockResolvedValueOnce({
      data: { user: { email: "guardian@example.com", email_confirmed_at: "2026-09-11T00:00:00Z", app_metadata: {}, user_metadata: {} } },
      error: null,
    });

    const res = await createGuardianAndStudentThenRedirect(BASE_PARAMS);

    expect(createUserMock).not.toHaveBeenCalled();
    expect(rpcMock).not.toHaveBeenCalledWith("claim_trial_onboarding_link_finalize", expect.anything());
    expect(decodeURIComponent(res.headers.get("location") ?? "")).toContain("이미 사용 중인 이메일");
  });

  it("사용자가 로그인 후 스스로 고쳐 쓸 수 있는 user_metadata에 가짜 trial_onboarding_link_id를 넣어도 소유 증거로 인정하지 않는다(app_metadata만 신뢰)", async () => {
    // 2026-09-11(제품 오너 재검토) — user_metadata(raw_user_meta_data)는
    // supabase.auth.updateUser({ data: {...} })로 사용자 본인이 직접 고칠 수
    // 있다. 이 필드에 다른 사람의 온보딩 링크 id를 넣어 무관한 자기 계정을
    // 그 링크에 연결시키려는 시도를 흉내낸다 — app_metadata가 비어있으므로
    // (또는 다른 값이므로) 거부돼야 한다.
    rpcMock.mockImplementation((fnName: string) => {
      if (fnName === "find_auth_user_id_by_email") {
        return Promise.resolve({ data: "attacker-account-id", error: null });
      }
      return defaultRpcImpl(fnName);
    });
    profilesMaybeSingleMock.mockResolvedValue({ data: null });
    getUserByIdMock.mockResolvedValueOnce({
      data: {
        user: {
          email: "guardian@example.com",
          email_confirmed_at: "2026-09-11T00:00:00Z",
          app_metadata: {}, // 서버만 쓸 수 있는 필드 — 조작되지 않았다.
          user_metadata: { trial_onboarding_link_id: "link-1" }, // 사용자가 직접 써넣은 값.
        },
      },
      error: null,
    });

    const res = await createGuardianAndStudentThenRedirect(BASE_PARAMS);

    expect(createUserMock).not.toHaveBeenCalled();
    expect(decodeURIComponent(res.headers.get("location") ?? "")).toContain("이미 사용 중인 이메일");
  });

  it("app_metadata는 일치해도 이 계정이 다른 온보딩 링크의 pending/redeemed 계정으로도 걸려 있으면(교차 링크) 재사용을 거부한다", async () => {
    rpcMock.mockImplementation((fnName: string) => {
      if (fnName === "find_auth_user_id_by_email") {
        return Promise.resolve({ data: "cross-linked-account-id", error: null });
      }
      return defaultRpcImpl(fnName);
    });
    profilesMaybeSingleMock.mockResolvedValue({ data: null });
    getUserByIdMock.mockResolvedValueOnce({
      data: {
        user: {
          email: "guardian@example.com",
          email_confirmed_at: "2026-09-11T00:00:00Z",
          app_metadata: { trial_onboarding_link_id: "link-1" },
          user_metadata: {},
        },
      },
      error: null,
    });
    crossLinkOrMock.mockResolvedValueOnce({ data: [{ id: "some-other-link" }], error: null });

    const res = await createGuardianAndStudentThenRedirect(BASE_PARAMS);

    expect(createUserMock).not.toHaveBeenCalled();
    expect(decodeURIComponent(res.headers.get("location") ?? "")).toContain("이미 사용 중인 이메일");
  });
});

describe("createGuardianAndStudentThenRedirect — 학생 비밀번호 설정 메일", () => {
  it("보호자·학생 계정 생성 성공 시 학생 이메일로 비밀번호 설정 링크를 보낸다", async () => {
    await createGuardianAndStudentThenRedirect(BASE_PARAMS);

    expect(generateLinkMock).toHaveBeenCalledWith({ type: "recovery", email: "guardian@example.com" });
    expect(generateLinkMock).toHaveBeenCalledWith({ type: "recovery", email: "student@example.com" });
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    const emailArgs = sendEmailMock.mock.calls[0][0];
    expect(emailArgs.to).toBe("student@example.com");
    expect(emailArgs.html).toContain("hash-for-student%40example.com");
  });

  it("발송 성공 시 trial_onboarding_links.student_invite_status를 sent로 기록한다", async () => {
    await createGuardianAndStudentThenRedirect(BASE_PARAMS);

    expect(fromMock).toHaveBeenCalledWith("trial_onboarding_link_students");
    expect(updateEqMock).toHaveBeenCalledWith("id", "ls-1");
  });

  it("학생 링크 생성이 실패해도 보호자 리다이렉트는 그대로 진행된다(실패 상태를 기록)", async () => {
    generateLinkMock.mockImplementation(async ({ email }: { email: string }) => {
      if (email === "student@example.com") return { data: null, error: { message: "boom" } };
      return { data: { properties: { hashed_token: "hash-guardian" } }, error: null };
    });
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await createGuardianAndStudentThenRedirect(BASE_PARAMS);

    expect(res.status).toBe(307);
    expect(sendEmailMock).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(fromMock).toHaveBeenCalledWith("trial_onboarding_link_students");
    expect(updateEqMock).toHaveBeenCalledWith("id", "ls-1");
    consoleErrorSpy.mockRestore();
  });

  it("이메일 발송 자체가 실패해도(SMTP 등) failed 상태를 기록한다", async () => {
    sendEmailMock.mockRejectedValueOnce(new Error("SMTP down"));
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await createGuardianAndStudentThenRedirect(BASE_PARAMS);

    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(fromMock).toHaveBeenCalledWith("trial_onboarding_link_students");
    expect(updateEqMock).toHaveBeenCalledWith("id", "ls-1");
    consoleErrorSpy.mockRestore();
  });
});

describe("createGuardianAndStudentThenRedirect — 부분 실패 시 고아 Auth 계정 정리(2026-09-05 코드 점검 발견)", () => {
  it("학생이 단 1명도 생성되지 못하면 이미 만든 보호자 Auth 계정을 정리한다", async () => {
    createUserMock
      .mockReset()
      .mockResolvedValueOnce({ data: { user: { id: "guardian-id" } }, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: "duplicate email" } });

    await createGuardianAndStudentThenRedirect(BASE_PARAMS);

    expect(deleteUserMock).toHaveBeenCalledWith("guardian-id");
  });

  it("계정 연결(finalize) RPC가 실패하면 보호자·학생 Auth 계정을 모두 정리한다", async () => {
    rpcMock.mockImplementation((fnName: string) => {
      if (fnName === "claim_trial_onboarding_link_finalize") {
        return Promise.resolve({
          data: [{ action: "proceed", redeemed_auth_user_id: null, pending_guardian_auth_user_id: null, claim_id: "claim-1" }],
          error: null,
        });
      }
      if (fnName === "find_auth_user_id_by_email") return Promise.resolve({ data: null, error: null });
      if (fnName === "get_trial_onboarding_link_students") {
        return Promise.resolve({
          data: [
            {
              id: "ls-1",
              student_name: "학생",
              student_email: "student@example.com",
              student_grade: null,
              student_subject: null,
              status: "pending",
              child_auth_user_id: null,
              error: null,
            },
          ],
          error: null,
        });
      }
      if (fnName === "finalize_trial_onboarding_students") {
        return Promise.resolve({ error: { message: "finalize boom" } });
      }
      return defaultRpcImpl(fnName);
    });

    await createGuardianAndStudentThenRedirect(BASE_PARAMS);

    expect(deleteUserMock).toHaveBeenCalledWith("guardian-id");
    expect(deleteUserMock).toHaveBeenCalledWith("student-id");
  });
});

describe("createGuardianAndStudentThenRedirect — 복수 자녀", () => {
  it("학생 2명을 처리하고 각각에게 비밀번호 설정 메일을 보낸다", async () => {
    createUserMock
      .mockReset()
      .mockResolvedValueOnce({ data: { user: { id: "student-a-id" } }, error: null })
      .mockResolvedValueOnce({ data: { user: { id: "student-b-id" } }, error: null });

    let call = 0;
    rpcMock.mockImplementation((fnName: string) => {
      if (fnName === "claim_trial_onboarding_link_finalize") {
        return Promise.resolve({
          data: [{ action: "proceed", redeemed_auth_user_id: null, pending_guardian_auth_user_id: null, claim_id: "claim-1" }],
          error: null,
        });
      }
      if (fnName === "find_auth_user_id_by_email") {
        // 기존 보호자 경로로 흉내낸다 — guardian createUser 호출이 없어도 되게.
        return Promise.resolve({ data: "existing-guardian-id", error: null });
      }
      if (fnName === "get_trial_onboarding_link_students") {
        call += 1;
        const created = call > 1;
        return Promise.resolve({
          data: [
            {
              id: "ls-a",
              student_name: "학생A",
              student_email: "a@example.com",
              student_grade: null,
              student_subject: null,
              status: created ? "created" : "pending",
              child_auth_user_id: created ? "student-a-id" : null,
              error: null,
            },
            {
              id: "ls-b",
              student_name: "학생B",
              student_email: "b@example.com",
              student_grade: null,
              student_subject: null,
              status: created ? "created" : "pending",
              child_auth_user_id: created ? "student-b-id" : null,
              error: null,
            },
          ],
          error: null,
        });
      }
      if (fnName === "finalize_trial_onboarding_students") {
        return Promise.resolve({
          data: [{ household_id: "household-1", guardian_id: "existing-guardian-id", created_count: 2, failed_count: 0 }],
          error: null,
        });
      }
      return defaultRpcImpl(fnName);
    });

    const res = await createGuardianAndStudentThenRedirect(BASE_PARAMS);

    expect(res.status).toBe(307);
    expect(createUserMock).toHaveBeenCalledTimes(2);
    expect(sendEmailMock).toHaveBeenCalledTimes(2);
    const recipients = sendEmailMock.mock.calls.map((c) => c[0].to);
    expect(recipients).toEqual(expect.arrayContaining(["a@example.com", "b@example.com"]));
  });
});
