import { describe, it, expect, vi } from "vitest";

const { requireConsultantMock, loadContractArchiveMock } = vi.hoisted(() => ({
  requireConsultantMock: vi.fn(),
  loadContractArchiveMock: vi.fn(),
}));
vi.mock("@/lib/admin-auth", () => ({ requireConsultant: requireConsultantMock }));
vi.mock("@/app/admin/contract-archive-data", () => ({ loadContractArchive: loadContractArchiveMock }));

import { listMyContractDocumentsAction } from "./documents-actions";

// Phase B(2, 2026-09-23) — 이 액션은 본인 세션 클라이언트(RLS 적용)로만
// loadContractArchive를 호출해야 한다 — service-role 어드민 클라이언트를
// 쓰면 담당 컨설턴트 조회 정책이 적용되지 않아 다른 컨설턴트 담당 건까지
// 새어나갈 수 있다.

describe("listMyContractDocumentsAction", () => {
  it("컨설턴트가 아니면 거부한다", async () => {
    requireConsultantMock.mockRejectedValue(new Error("컨설턴트만 사용할 수 있습니다."));
    await expect(listMyContractDocumentsAction()).rejects.toThrow("컨설턴트만 사용할 수 있습니다.");
    expect(loadContractArchiveMock).not.toHaveBeenCalled();
  });

  it("본인 세션 클라이언트를 loadContractArchive에 그대로 넘긴다(RLS가 범위를 좁힘)", async () => {
    const fakeSupabase = { marker: "session-client" };
    requireConsultantMock.mockResolvedValue({ supabase: fakeSupabase, user: { id: "c1" } });
    loadContractArchiveMock.mockResolvedValue([{ contractId: "k1" }]);

    const result = await listMyContractDocumentsAction({ search: "학생" });

    expect(loadContractArchiveMock).toHaveBeenCalledWith(fakeSupabase, { search: "학생" });
    expect(result).toEqual([{ contractId: "k1" }]);
  });
});
