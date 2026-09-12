import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// P4-3 4단계 — Drive 연결 코드를 **실제 Drive 없이** 검증한다.
// 설정 전 안내·권한 없음·빈 폴더·조회 실패·파일 열기를 전부 테스트 데이터로 본다.
// 실제 Drive 생성·서비스 계정 초대·환경변수 설정만 외부 준비로 남는다.

const requireAdmin = vi.fn();
const driveFetch = vi.fn();
const insert = vi.fn(async () => ({ error: null }));

vi.mock("@/lib/admin-auth", () => ({
  requireAdmin: (...a: unknown[]) => requireAdmin(...a),
}));
vi.mock("@/lib/drive/fetch", () => ({
  DRIVE_API: "https://drive.test/v3",
  driveFetch: (...a: unknown[]) => driveFetch(...a),
  getDriveTokenForCurrentEnv: async () => "token",
}));
vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: () => ({ from: () => ({ insert }) }),
}));

const originalEnv = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  requireAdmin.mockResolvedValue({ supabase: {}, adminUserId: "admin-1" });
});

afterEach(() => {
  process.env = { ...originalEnv };
});

function configure() {
  process.env.COMPANY_DOCUMENTS_ENABLED = "true";
  process.env.COMPANY_DOCUMENTS_DRIVE_ID = "drive-1";
  process.env.COMPANY_DOCUMENTS_ROOT_FOLDER_ID = "root-1";
}

function unconfigure() {
  delete process.env.COMPANY_DOCUMENTS_ENABLED;
  delete process.env.COMPANY_DOCUMENTS_DRIVE_ID;
  delete process.env.COMPANY_DOCUMENTS_ROOT_FOLDER_ID;
}

describe("설정 전에는 Drive를 호출하지 않는다", () => {
  it("플래그가 꺼져 있으면 '연결되지 않음'을 돌려준다", async () => {
    unconfigure();
    const { listCompanyDocumentsAction } = await import("./company-documents-actions");
    expect(await listCompanyDocumentsAction()).toEqual({ state: "not_configured" });
    expect(driveFetch).not.toHaveBeenCalled();
  });

  it("드라이브 id가 없으면 켜져 있어도 호출하지 않는다", async () => {
    unconfigure();
    process.env.COMPANY_DOCUMENTS_ENABLED = "true";
    const { listCompanyDocumentsAction } = await import("./company-documents-actions");
    expect(await listCompanyDocumentsAction()).toEqual({ state: "not_configured" });
    expect(driveFetch).not.toHaveBeenCalled();
  });
});

describe("권한", () => {
  it("권한이 없으면 Drive에 손대기 전에 거부된다", async () => {
    configure();
    requireAdmin.mockRejectedValue(new Error("관리자만 사용할 수 있습니다."));
    const { listCompanyDocumentsAction } = await import("./company-documents-actions");
    await expect(listCompanyDocumentsAction()).rejects.toThrow("관리자만 사용할 수 있습니다.");
    expect(driveFetch).not.toHaveBeenCalled();
  });

  it("계정 id를 박지 않고 공통 권한 검사 함수를 쓴다", async () => {
    configure();
    driveFetch.mockResolvedValue({ json: async () => ({ files: [] }) });
    const { listCompanyDocumentsAction } = await import("./company-documents-actions");
    await listCompanyDocumentsAction();
    expect(requireAdmin).toHaveBeenCalled();
  });
});

describe("폴더 목록", () => {
  it("빈 폴더는 '연결되지 않음'과 다른 값으로 돌려준다", async () => {
    configure();
    driveFetch.mockResolvedValue({ json: async () => ({ files: [] }) });
    const { listCompanyDocumentsAction } = await import("./company-documents-actions");
    expect(await listCompanyDocumentsAction()).toEqual({ state: "ok", entries: [] });
  });

  it("폴더와 파일을 구분해 돌려준다", async () => {
    configure();
    driveFetch.mockResolvedValue({
      json: async () => ({
        files: [
          { id: "f1", name: "법인 서류", mimeType: "application/vnd.google-apps.folder" },
          {
            id: "f2",
            name: "w9-blank.pdf",
            mimeType: "application/pdf",
            size: "2048",
            modifiedTime: "2026-09-01T00:00:00Z",
          },
        ],
      }),
    });
    const { listCompanyDocumentsAction } = await import("./company-documents-actions");
    const result = await listCompanyDocumentsAction();
    expect(result).toEqual({
      state: "ok",
      entries: [
        { id: "f1", name: "법인 서류", isFolder: true, sizeBytes: null, modifiedAt: null },
        {
          id: "f2",
          name: "w9-blank.pdf",
          isFolder: false,
          sizeBytes: 2048,
          modifiedAt: "2026-09-01T00:00:00Z",
        },
      ],
    });
  });

  it("Drive 호출이 실패하면 원문 대신 사유만 돌려준다", async () => {
    configure();
    driveFetch.mockRejectedValue(new Error("Drive API 요청 실패 (status 403): /some/path"));
    const { listCompanyDocumentsAction } = await import("./company-documents-actions");
    const result = await listCompanyDocumentsAction();
    expect(result).toEqual({ state: "fetch_failed" });
    expect(JSON.stringify(result)).not.toContain("/some/path");
  });
});

describe("파일 열기", () => {
  it("원본을 확보해 돌려주고 감사에 남긴다", async () => {
    configure();
    driveFetch
      .mockResolvedValueOnce({
        json: async () => ({ id: "f2", name: "w9.pdf", mimeType: "application/pdf", driveId: "drive-1" }),
      })
      .mockResolvedValueOnce({ arrayBuffer: async () => new TextEncoder().encode("pdf").buffer });

    const { openCompanyDocumentAction } = await import("./company-documents-actions");
    const result = await openCompanyDocumentAction("f2");

    expect(result.ok).toBe(true);
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ target_kind: "company_document", action: "file_retrieved" })
    );
  });

  it("다른 드라이브의 파일은 열지 않는다", async () => {
    configure();
    driveFetch.mockResolvedValueOnce({
      json: async () => ({ id: "x", name: "남의 파일", mimeType: "application/pdf", driveId: "other" }),
    });
    const { openCompanyDocumentAction } = await import("./company-documents-actions");
    expect(await openCompanyDocumentAction("x")).toEqual({ ok: false, reason: "not_found" });
    // 내용까지 읽지 않는다(메타 조회 1회로 끝).
    expect(driveFetch).toHaveBeenCalledTimes(1);
  });

  it("설정 전에는 파일도 열지 않는다", async () => {
    unconfigure();
    const { openCompanyDocumentAction } = await import("./company-documents-actions");
    expect(await openCompanyDocumentAction("f2")).toEqual({ ok: false, reason: "not_configured" });
    expect(driveFetch).not.toHaveBeenCalled();
  });
});

// 정책은 "관리자만 접근"이다. 서버가 관리자 자격을 **명시적으로** 확인해야
// 한다 — "지금은 그 capability를 가진 사람이 없으니 사실상 관리자만"은 정책
// 보장이 아니다. 비관리자가 capability를 갖게 되는 순간 뚫린다.
describe("서버가 관리자 자격을 명시적으로 확인한다", () => {
  it("목록 조회는 requireAdmin을 부른다", async () => {
    configure();
    driveFetch.mockResolvedValue({ json: async () => ({ files: [] }) });
    const { listCompanyDocumentsAction } = await import("./company-documents-actions");
    await listCompanyDocumentsAction();
    expect(requireAdmin).toHaveBeenCalled();
  });

  it("파일 열기도 requireAdmin을 부르고, 거부되면 Drive에 손대지 않는다", async () => {
    configure();
    requireAdmin.mockRejectedValue(new Error("관리자만 사용할 수 있습니다."));
    const { openCompanyDocumentAction } = await import("./company-documents-actions");
    await expect(openCompanyDocumentAction("f1")).rejects.toThrow("관리자만 사용할 수 있습니다.");
    expect(driveFetch).not.toHaveBeenCalled();
  });

  it("capability만으로 통과시키는 게이트를 쓰지 않는다", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync("app/admin/company-documents-actions.ts", "utf-8");
    // requireAdminOrCapability는 capability만 있어도 통과시킨다(OR).
    expect(src).not.toContain("requireAdminOrCapability");
    expect(src).not.toContain("requireCapabilityOnly");
  });

  it("계정 id를 코드에 박지 않는다", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync("app/admin/company-documents-actions.ts", "utf-8");
    expect(src).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/);
    expect(src).toContain('from "@/lib/admin-auth"');
  });
});
