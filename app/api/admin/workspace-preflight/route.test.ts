import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

const rpcMock = vi.fn();
const supabaseMock = { rpc: rpcMock };
const requireAdminMock = vi.fn().mockResolvedValue({ supabase: supabaseMock, adminUserId: "admin1" });
vi.mock("@/lib/admin-auth", () => ({
  requireAdmin: () => requireAdminMock(),
}));

const getImpersonatedAccessTokenMock = vi.fn();
const getDirectoryApiAccessTokenMock = vi.fn();
vi.mock("@/lib/google-workspace-auth", () => ({
  getImpersonatedAccessToken: () => getImpersonatedAccessTokenMock(),
  getDirectoryApiAccessToken: () => getDirectoryApiAccessTokenMock(),
}));

const getWorkspaceUserByEmailMock = vi.fn();
const listWorkspaceUsersInOrgUnitMock = vi.fn();
vi.mock("@/lib/google-workspace-directory-readonly", () => ({
  getWorkspaceUserByEmail: (email: string) => getWorkspaceUserByEmailMock(email),
  listWorkspaceUsersInOrgUnit: (ou: string) => listWorkspaceUsersInOrgUnitMock(ou),
}));

function setProductionAndReadsAllowed() {
  process.env.VERCEL_ENV = "production";
  process.env.WORKSPACE_PREFLIGHT_ALLOW_REAL_READS = "true";
}

describe("POST /api/admin/workspace-preflight", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...ORIGINAL_ENV };
    requireAdminMock.mockResolvedValue({ supabase: supabaseMock, adminUserId: "admin1" });
    rpcMock.mockImplementation((fn: string) => {
      if (fn === "begin_workspace_preflight_run") return Promise.resolve({ data: "run-1", error: null });
      if (fn === "finish_workspace_preflight_run") return Promise.resolve({ data: null, error: null });
      throw new Error(`unexpected rpc ${fn}`);
    });
  });
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("관리자가 아니면 403을 반환하고 어떤 Workspace 호출도, RPC도 하지 않는다", async () => {
    requireAdminMock.mockRejectedValue(new Error("관리자만 사용할 수 있습니다."));
    const { POST } = await import("./route");
    const res = await POST();
    expect(res.status).toBe(403);
    expect(getImpersonatedAccessTokenMock).not.toHaveBeenCalled();
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("Production 환경이 아니면 차단한다(Preview/개발 등)", async () => {
    process.env.VERCEL_ENV = "preview";
    process.env.WORKSPACE_PREFLIGHT_ALLOW_REAL_READS = "true";
    const { POST } = await import("./route");
    const res = await POST();
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("Production 환경에서만");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("WORKSPACE_PREFLIGHT_ALLOW_REAL_READS가 명시적으로 true가 아니면 차단한다", async () => {
    process.env.VERCEL_ENV = "production";
    delete process.env.WORKSPACE_PREFLIGHT_ALLOW_REAL_READS;
    const { POST } = await import("./route");
    const res = await POST();
    expect(res.status).toBe(403);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("쿨다운 위반(begin RPC 실패) 시 429를 반환하고 실제 Google 호출을 전혀 하지 않는다", async () => {
    setProductionAndReadsAllowed();
    rpcMock.mockImplementation((fn: string) => {
      if (fn === "begin_workspace_preflight_run") {
        return Promise.resolve({ data: null, error: { message: "preflight는 300초에 한 번만 실행할 수 있습니다." } });
      }
      throw new Error(`unexpected rpc ${fn}`);
    });
    const { POST } = await import("./route");
    const res = await POST();
    expect(res.status).toBe(429);
    expect(getImpersonatedAccessTokenMock).not.toHaveBeenCalled();
  });

  it("전체 체인 성공 시 OU 사용자 수·해시만 남기고 실제 이메일/이름은 응답에 없다", async () => {
    setProductionAndReadsAllowed();
    getImpersonatedAccessTokenMock.mockResolvedValue(undefined);
    getDirectoryApiAccessTokenMock.mockResolvedValue(undefined);
    listWorkspaceUsersInOrgUnitMock.mockResolvedValue([
      { googleUserId: "g1", primaryEmail: "real-person@alton.education", suspended: false, orgUnitPath: "/Alton Integration Sandbox/Teachers" },
    ]);
    getWorkspaceUserByEmailMock.mockImplementation((email: string) =>
      Promise.resolve(email === "teacher1@alton.education" ? { googleUserId: "g2" } : null)
    );

    const { POST } = await import("./route");
    const res = await POST();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ouUserCount).toBe(1);
    expect(body.ouUserIdHashes).toHaveLength(1);
    expect(body.ouUserIdHashes[0]).toMatch(/^[0-9a-f]{64}$/); // sha256 hex, not the raw id
    expect(JSON.stringify(body)).not.toContain("real-person@alton.education");
    expect(JSON.stringify(body)).not.toContain("g1"); // 원본 google_user_id도 응답에 없어야 함
    expect(body.targetEmailBaseline).toEqual({
      "teacher1@alton.education": true,
      "teacher2@alton.education": false,
      "teacher-provisioning-test@alton.education": false,
    });
    expect(JSON.stringify(body)).not.toMatch(/token/i);

    expect(rpcMock).toHaveBeenCalledWith(
      "finish_workspace_preflight_run",
      expect.objectContaining({ p_run_id: "run-1", p_ou_user_count: 1 })
    );
  });

  it("impersonation 단계가 실패하면 이후 단계를 시도하지 않고, 그래도 finish로 감사 기록은 남긴다", async () => {
    setProductionAndReadsAllowed();
    getImpersonatedAccessTokenMock.mockRejectedValue(
      new Error("GOOGLE_WORKLOAD_IDENTITY_AUDIENCE 환경변수가 설정되지 않았습니다.")
    );

    const { POST } = await import("./route");
    const res = await POST();
    const body = await res.json();

    expect(body.stages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ stage: "impersonation", ok: false }),
      ])
    );
    expect(getDirectoryApiAccessTokenMock).not.toHaveBeenCalled();
    expect(listWorkspaceUsersInOrgUnitMock).not.toHaveBeenCalled();
    expect(rpcMock).toHaveBeenCalledWith("finish_workspace_preflight_run", expect.anything());
  });
});
