import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ member: null as null | { household_id: string }, count: 3 }));

function builder(table: string) {
  const q: Record<string, unknown> = {
    select: () => q,
    eq: () => q,
    in: () => q,
    gt: () => q,
    limit: () => q,
    maybeSingle: async () => ({ data: table === "household_members" ? state.member : null, error: null }),
    then: (res: (v: unknown) => void) => res({ count: state.count, error: null }),
  };
  return q;
}
// 2026-10-05 S2 — 액션은 requireStudentFeature("consultant_portal")(lib/feature-access)를 거친다.
vi.mock("@/lib/feature-access", () => ({
  requireStudentFeature: async () => ({ user: { id: "st1" }, profile: { role: "student" }, supabase: { from: builder }, featureAccess: [] }),
}));

import { getMyHouseholdMessengerUnreadCountAction, markMyHouseholdMessengerReadAction } from "./consultant-messenger-actions";

describe("getMyHouseholdMessengerUnreadCountAction", () => {
  it("가구 없는 학생은 throw 대신 0", async () => {
    state.member = null;
    expect(await getMyHouseholdMessengerUnreadCountAction()).toBe(0);
  });
  it("가구가 있으면 기존대로 count", async () => {
    state.member = { household_id: "h1" };
    expect(await getMyHouseholdMessengerUnreadCountAction()).toBe(3);
  });
  it("읽음 처리 등 다른 액션은 가구가 없으면 그대로 throw(권한 의미 불변)", async () => {
    state.member = null;
    await expect(markMyHouseholdMessengerReadAction()).rejects.toThrow("소속된 household");
  });
});
