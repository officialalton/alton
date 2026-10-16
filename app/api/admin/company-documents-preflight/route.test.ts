import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const requireAdmin = vi.fn();
const driveFetch = vi.fn();
const getDriveTokenForCurrentEnv = vi.fn();

vi.mock("@/lib/admin-auth", () => ({ requireAdmin: (...a: unknown[]) => requireAdmin(...a) }));
vi.mock("@/lib/drive/fetch", () => ({
  DRIVE_API: "https://drive.test/v3",
  driveFetch: (...a: unknown[]) => driveFetch(...a),
  getDriveTokenForCurrentEnv: (...a: unknown[]) => getDriveTokenForCurrentEnv(...a),
}));

const originalEnv = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  requireAdmin.mockResolvedValue({ supabase: {}, adminUserId: "admin-1" });
  getDriveTokenForCurrentEnv.mockResolvedValue("token");
});

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("회사 문서 Drive 점검", () => {
  it("관리자가 아니면 거부하고 Drive를 호출하지 않는다", async () => {
    requireAdmin.mockRejectedValue(new Error("관리자만"));
    const { GET } = await import("./route");
    const res = await GET();
    expect(res.status).toBe(403);
    expect(getDriveTokenForCurrentEnv).not.toHaveBeenCalled();
  });

  it("서비스 계정이 볼 수 있는 공유 드라이브를 알려준다", async () => {
    driveFetch.mockResolvedValue({
      json: async () => ({ drives: [{ id: "d1", name: "ALTON Company Documents" }] }),
    });
    const { GET } = await import("./route");
    const body = await (await GET()).json();
    expect(body.drives).toEqual([{ id: "d1", name: "ALTON Company Documents" }]);
    expect(body.steps).toContainEqual({ step: "drives_list", ok: true, detail: "1개" });
  });

  it("토큰을 못 받으면 그 단계에서 멈추고 사유는 상태 코드만 남긴다", async () => {
    getDriveTokenForCurrentEnv.mockRejectedValue(new Error("Drive API 요청 실패 (status 403): /secret/path"));
    const { GET } = await import("./route");
    const body = await (await GET()).json();
    expect(body.steps).toContainEqual({ step: "drive_token", ok: false, detail: "status 403" });
    expect(JSON.stringify(body)).not.toContain("/secret/path");
    expect(driveFetch).not.toHaveBeenCalled();
  });

  it("환경변수가 설정돼 있으면 루트 폴더까지 확인한다", async () => {
    process.env.COMPANY_DOCUMENTS_DRIVE_ID = "d1";
    driveFetch
      .mockResolvedValueOnce({ json: async () => ({ drives: [{ id: "d1", name: "X" }] }) })
      .mockResolvedValueOnce({
        json: async () => ({
          files: [
            { name: "법인 서류", mimeType: "application/vnd.google-apps.folder" },
            { name: "읽어보기.txt", mimeType: "text/plain" },
          ],
        }),
      });
    const { GET } = await import("./route");
    const body = await (await GET()).json();
    expect(body.rootFolders).toEqual(["법인 서류"]);
    expect(body.env).toEqual({ enabled: false, hasDriveId: true, hasRootFolderId: false });
  });

  it("아무것도 만들지 않는다(생성·권한 변경 호출이 없다)", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync("app/api/admin/company-documents-preflight/route.ts", "utf-8");
    for (const banned of ["method: \"POST\"", "drives/create", "permissions", "method: \"PATCH\"", "method: \"DELETE\""]) {
      expect(src).not.toContain(banned);
    }
  });
});
