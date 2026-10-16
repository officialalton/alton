import { describe, it, expect, vi, beforeEach } from "vitest";

const { requireConsultantMock, recordDocumentAccessMock } = vi.hoisted(() => ({
  requireConsultantMock: vi.fn(),
  recordDocumentAccessMock: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/admin-auth", () => ({ requireConsultant: requireConsultantMock }));
vi.mock("@/lib/document-access-audit", () => ({ recordDocumentAccess: recordDocumentAccessMock }));

import {
  listMyConsultationMaterialsAction,
  recordExternalMaterialOpenAction,
  saveMySessionNoteAction,
  getMySessionNoteAction,
} from "./consultation-session-actions";

beforeEach(() => {
  requireConsultantMock.mockReset();
  recordDocumentAccessMock.mockClear();
});

describe("listMyConsultationMaterialsAction", () => {
  it("공개(비보관) 자료만 매핑해서 반환한다", async () => {
    const supabase = {
      from: () => ({
        select: () => ({
          is: () => ({
            order: () =>
              Promise.resolve({
                data: [{ id: "m1", title: "제목", category: "입시", description: null, drive_file_id: "f1", external_url: null }],
                error: null,
              }),
          }),
        }),
      }),
    };
    requireConsultantMock.mockResolvedValue({ supabase });

    const result = await listMyConsultationMaterialsAction();

    expect(result).toEqual([{ id: "m1", title: "제목", category: "입시", description: null, hasDriveFile: true, externalUrl: null }]);
  });
});

describe("recordExternalMaterialOpenAction", () => {
  it("접근 기록을 남긴다", async () => {
    requireConsultantMock.mockResolvedValue({ user: { id: "c1" } });
    await recordExternalMaterialOpenAction("m1");
    expect(recordDocumentAccessMock).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: "c1", targetKind: "consultation_material", targetId: "m1", action: "download_url_issued" })
    );
  });
});

describe("세션 메모 저장·조회", () => {
  it("저장 후 조회하면 같은 값이 온다(upsert 호출 검증)", async () => {
    const upsertMock = vi.fn(() => Promise.resolve({ error: null }));
    const supabase = { from: () => ({ upsert: upsertMock }) };
    requireConsultantMock.mockResolvedValue({ user: { id: "c1" }, supabase });

    await saveMySessionNoteAction({ sourceKind: "consultation", sourceId: "s1", note: "메모", nextAction: "다음 행동" });

    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ consultant_id: "c1", source_kind: "consultation", source_id: "s1", note: "메모", next_action: "다음 행동" }),
      { onConflict: "source_kind,source_id" }
    );
  });

  it("기록이 없으면 전부 null을 반환한다", async () => {
    const supabase = {
      from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }) }) }) }),
    };
    requireConsultantMock.mockResolvedValue({ user: { id: "c1" }, supabase });

    const result = await getMySessionNoteAction("meeting_request", "r1");

    expect(result).toEqual({ note: null, nextAction: null, updatedAt: null });
  });
});
