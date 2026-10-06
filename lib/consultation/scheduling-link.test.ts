import { beforeEach, describe, expect, it, vi } from "vitest";

const rpcMock = vi.fn();
vi.mock("@/lib/supabase-admin", () => ({ createAdminClient: () => ({ rpc: rpcMock }) }));

import { checkSchedulingLink, toSchedulingLinkFailure } from "./scheduling-link";

describe("checkSchedulingLink", () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });
  it("RPC 성공 → valid", async () => {
    rpcMock.mockResolvedValue({ data: [], error: null });
    expect(await checkSchedulingLink("t")).toBe("valid");
  });
  it("무효 토큰 문구 → invalid", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { code: "P0001", message: "유효하지 않거나 만료된 예약 링크입니다." } });
    expect(await checkSchedulingLink("bogus")).toBe("invalid");
  });
  it("그 밖의 오류·예외 → unknown(폼은 그대로 그린다)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    rpcMock.mockResolvedValue({ data: null, error: { code: "XX000", message: "db down" } });
    expect(await checkSchedulingLink("t")).toBe("unknown");
    rpcMock.mockImplementation(async () => { throw new Error("network"); });
    expect(await checkSchedulingLink("t")).toBe("unknown");
  });
});

describe("toSchedulingLinkFailure", () => {
  it("P0001 사유는 그대로", () => {
    expect(toSchedulingLinkFailure({ code: "P0001", message: "마감" }, "x")).toEqual({ ok: false, reason: "unavailable", error: "마감" });
  });
  it("23P01(같은 컨설턴트 동시 확정 레이스)은 친절한 '이미 다른 상담' 문구", () => {
    expect(toSchedulingLinkFailure({ code: "23P01", message: "conflicting key value violates exclusion constraint" }, "x")).toEqual({
      ok: false,
      reason: "unavailable",
      error: "That time is no longer available. Please choose another time.",
    });
  });
});
