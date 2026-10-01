import { describe, expect, it, vi } from "vitest";
import { getAdminMessengerUnreadCounts, totalMessengerUnread } from "./messenger-unread-data";

const clientWith = (result: { data: unknown; error: { message: string } | null }) =>
  ({ rpc: vi.fn().mockResolvedValue(result) }) as unknown as Parameters<typeof getAdminMessengerUnreadCounts>[0];

describe("getAdminMessengerUnreadCounts", () => {
  it("RPC 1회로 세 채널 수를 돌려준다(배열/객체 모두)", async () => {
    const c = clientWith({ data: [{ teachers: 2, consultants: 3, family: 4 }], error: null });
    expect(await getAdminMessengerUnreadCounts(c)).toEqual({ teachers: 2, consultants: 3, family: 4 });
    expect((c as unknown as { rpc: ReturnType<typeof vi.fn> }).rpc).toHaveBeenCalledTimes(1);
    expect(await getAdminMessengerUnreadCounts(clientWith({ data: { teachers: 1, consultants: 0, family: 0 }, error: null }))).toEqual({ teachers: 1, consultants: 0, family: 0 });
  });
  it("결과가 비면 0, 오류면 던진다", async () => {
    expect(await getAdminMessengerUnreadCounts(clientWith({ data: null, error: null }))).toEqual({ teachers: 0, consultants: 0, family: 0 });
    await expect(getAdminMessengerUnreadCounts(clientWith({ data: null, error: { message: "boom" } }))).rejects.toThrow("boom");
  });
});

describe("totalMessengerUnread", () => {
  it("세 채널 합계(0이면 0, 9 초과 표기는 배지 컴포넌트가 담당)", () => {
    expect(totalMessengerUnread({ teachers: 0, consultants: 0, family: 0 })).toBe(0);
    expect(totalMessengerUnread({ teachers: 4, consultants: 5, family: 6 })).toBe(15);
  });
});
