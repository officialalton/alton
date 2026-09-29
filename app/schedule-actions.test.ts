import { beforeEach, describe, expect, it, vi } from "vitest";

const rpcMock = vi.fn();
vi.mock("@/lib/supabase-admin", () => ({ createAdminClient: () => ({ rpc: rpcMock }) }));
const syncMock = vi.fn();
vi.mock("@/lib/consultation/calendar-sync", () => ({ syncOneConsultationCalendarEvent: (...a: unknown[]) => syncMock(...a) }));

import { listOpenSlotsForTokenAction, redeemSchedulingLinkAction } from "./schedule-actions";

const INVALID = { code: "P0001", message: "유효하지 않거나 만료된 예약 링크입니다." };

describe("예약 링크 서버 액션 — throw 대신 결과값", () => {
  beforeEach(() => {
    rpcMock.mockReset();
    syncMock.mockReset();
  });

  it("유효 토큰: 슬롯 목록을 그대로 돌려준다", async () => {
    rpcMock.mockResolvedValue({ data: [{ slot_starts_at: "2026-10-01T17:00:00Z" }], error: null });
    expect(await listOpenSlotsForTokenAction("t", "a", "b")).toEqual({ ok: true, slots: [{ startsAt: "2026-10-01T17:00:00Z" }] });
  });

  it("무효·만료 토큰: throw 하지 않고 invalid_link + 안내 문구", async () => {
    rpcMock.mockResolvedValue({ data: null, error: INVALID });
    const r = await listOpenSlotsForTokenAction("bogus", "a", "b");
    expect(r).toEqual({ ok: false, reason: "invalid_link", error: "유효하지 않거나 만료된 예약 링크입니다." });
    expect(await redeemSchedulingLinkAction("bogus", "a")).toMatchObject({ ok: false, reason: "invalid_link" });
  });

  it("인프라 오류는 원문을 숨기고 일반 문구 + 로그", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    rpcMock.mockResolvedValue({ data: null, error: { code: "XX000", message: "connection refused to 10.0.0.1" } });
    const r = await listOpenSlotsForTokenAction("t", "a", "b");
    expect(r).toMatchObject({ ok: false, reason: "unavailable" });
    expect((r as { error: string }).error).not.toContain("10.0.0.1");
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("예약 성공: ok 를 돌려주고 캘린더 동기화를 시도한다(실패해도 확정 유지)", async () => {
    rpcMock.mockResolvedValue({ data: { id: "c1" }, error: null });
    syncMock.mockImplementation(async () => { throw new Error("google down"); });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await redeemSchedulingLinkAction("t", "2026-10-01T17:00:00Z")).toEqual({ ok: true });
    expect(syncMock).toHaveBeenCalledWith("c1");
    spy.mockRestore();
  });

  it("DB 가 직접 raise 한 사유(이미 마감 등)는 그대로 전달한다", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { code: "P0001", message: "이미 마감된 시간입니다." } });
    expect(await redeemSchedulingLinkAction("t", "x")).toEqual({ ok: false, reason: "unavailable", error: "이미 마감된 시간입니다." });
  });
});
