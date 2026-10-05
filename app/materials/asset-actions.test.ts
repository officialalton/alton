import { describe, expect, it, vi } from "vitest";

// 2026-10-05 무료 회원 S3 — 서명 URL 은 요청 사용자 권한으로 버전 행이 읽힐 때만 나온다.
// 비공개 교재의 버전 id 를 직접 넘겨도(RLS 가 0행) 서명 URL 을 만들지 않는다.
const { mockMaybeSingle, mockCreateSignedUrl, mockRequire } = vi.hoisted(() => ({
  mockMaybeSingle: vi.fn(),
  mockCreateSignedUrl: vi.fn(),
  mockRequire: vi.fn(),
}));

vi.mock("@/lib/feature-access", () => ({ requireStudentFeature: mockRequire }));
vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: () => ({ storage: { from: () => ({ createSignedUrl: mockCreateSignedUrl }) } }),
}));

import { getAssetVersionUrlAction } from "./asset-actions";

function sessionClient() {
  return { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mockMaybeSingle }) }) }) };
}

describe("getAssetVersionUrlAction", () => {
  it("materials_free 키를 요구한다(무료 회원 가드와 같은 함수)", async () => {
    mockRequire.mockResolvedValue({ supabase: sessionClient() });
    mockMaybeSingle.mockResolvedValue({ data: null });
    await getAssetVersionUrlAction("v1");
    expect(mockRequire).toHaveBeenCalledWith("materials_free");
  });

  it("RLS 로 버전 행이 안 읽히면(비공개 교재) 서명 URL 을 만들지 않는다", async () => {
    mockRequire.mockResolvedValue({ supabase: sessionClient() });
    mockMaybeSingle.mockResolvedValue({ data: null });
    mockCreateSignedUrl.mockClear();
    expect(await getAssetVersionUrlAction("private-version")).toEqual({ ok: false, error: "이 자료를 볼 수 없습니다." });
    expect(mockCreateSignedUrl).not.toHaveBeenCalled();
  });

  it("버전 행이 읽히면(무료 공개 교재) 10분 서명 URL 을 돌려준다", async () => {
    mockRequire.mockResolvedValue({ supabase: sessionClient() });
    mockMaybeSingle.mockResolvedValue({ data: { id: "v1", snapshot: { kind: "pdf", asset: { bucket: "curriculum-assets", path: "a/b.pdf", mimeType: "application/pdf" } } } });
    mockCreateSignedUrl.mockResolvedValue({ data: { signedUrl: "https://signed" }, error: null });
    expect(await getAssetVersionUrlAction("v1")).toEqual({ ok: true, url: "https://signed", mimeType: "application/pdf", expiresInSeconds: 600 });
  });
});
