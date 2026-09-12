import { describe, expect, it, vi, beforeEach } from "vitest";

// P4-3 3단계 — **실제 요청이 거부되는지**를 본다(권한 함수의 반환값 테스트와
// 구분한다). 거부된 요청에서는 파일 조회도, 서명 URL 발급도 일어나지 않아야
// 한다 — 게이트를 통과한 뒤에야 저장소에 손을 댄다.
//
// 2026-09-12 정정: 현재는 기존 관리자 계정으로 조회·다운로드한다. 정산
// capability를 필수 조건으로 두지 않는다.

const requireAdminOrCapability = vi.fn();
const from = vi.fn();
const createSignedUrl = vi.fn();
const insert = vi.fn(async () => ({ error: null }));

vi.mock("@/lib/admin-auth", () => ({
  requireAdminOrCapability: (...args: unknown[]) => requireAdminOrCapability(...args),
}));

vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === "document_access_events") return { insert };
      return from(table);
    },
    storage: { from: () => ({ createSignedUrl }) },
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

function denyGate() {
  requireAdminOrCapability.mockRejectedValue(new Error("이 작업을 수행할 권한이 없습니다."));
}

function allowGate() {
  requireAdminOrCapability.mockResolvedValue({ supabase: {}, actorUserId: "admin-1" });
}

describe("권한 없는 요청은 파일에 손대기 전에 거부된다", () => {
  it("목록 조회가 거부되고, 저장소·테이블을 읽지 않는다", async () => {
    denyGate();
    const { listTeacherDocumentSummariesAction } = await import("./teacher-documents-actions");
    await expect(listTeacherDocumentSummariesAction()).rejects.toThrow(
      "이 작업을 수행할 권한이 없습니다."
    );
    expect(from).not.toHaveBeenCalled();
  });

  it("교사별 상세 조회가 거부되고, 테이블을 읽지 않는다", async () => {
    denyGate();
    const { listTeacherDocumentsAction } = await import("./teacher-documents-actions");
    await expect(listTeacherDocumentsAction("t1")).rejects.toThrow(
      "이 작업을 수행할 권한이 없습니다."
    );
    expect(from).not.toHaveBeenCalled();
  });

  it("다운로드 링크 발급이 거부되고, 서명 URL을 만들지 않는다", async () => {
    denyGate();
    const { getTeacherDocumentDownloadUrlAction } = await import("./teacher-documents-actions");
    await expect(getTeacherDocumentDownloadUrlAction("d1")).rejects.toThrow(
      "이 작업을 수행할 권한이 없습니다."
    );
    expect(createSignedUrl).not.toHaveBeenCalled();
    // 거부된 요청은 감사에도 남지 않는다(접근 자체가 없었다).
    expect(insert).not.toHaveBeenCalled();
  });

  it("게이트에 정산 capability 이름을 넘긴다", async () => {
    denyGate();
    const { listTeacherDocumentSummariesAction } = await import("./teacher-documents-actions");
    await expect(listTeacherDocumentSummariesAction()).rejects.toThrow();
    expect(requireAdminOrCapability).toHaveBeenCalledWith("정산권한");
  });
});

describe("권한이 있으면 발급까지 진행한다", () => {
  it("서명 URL을 발급하고 '발급'으로만 감사에 남긴다", async () => {
    allowGate();
    from.mockReturnValue({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: { id: "d1", teacher_id: "t1", storage_path: "t1/w9.pdf", file_name: "w9.pdf" },
          }),
        }),
      }),
    });
    createSignedUrl.mockResolvedValue({ data: { signedUrl: "https://signed/x" }, error: null });

    const { getTeacherDocumentDownloadUrlAction } = await import("./teacher-documents-actions");
    const result = await getTeacherDocumentDownloadUrlAction("d1");

    expect(result).toEqual({ ok: true, url: "https://signed/x" });
    expect(createSignedUrl).toHaveBeenCalled();
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ action: "download_url_issued", target_kind: "teacher_document" })
    );
  });

  it("없는 서류는 서명 URL을 만들지 않고 사유만 돌려준다", async () => {
    allowGate();
    from.mockReturnValue({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }),
    });

    const { getTeacherDocumentDownloadUrlAction } = await import("./teacher-documents-actions");
    expect(await getTeacherDocumentDownloadUrlAction("missing")).toEqual({
      ok: false,
      reason: "not_found",
    });
    expect(createSignedUrl).not.toHaveBeenCalled();
  });
});
