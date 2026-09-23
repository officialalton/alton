import { describe, it, expect, vi, beforeEach } from "vitest";

const { requireUserMock } = vi.hoisted(() => ({ requireUserMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireUser: requireUserMock }));

import { createMyTimeOffAction, cancelMyTimeOffAction, listMyTimeOffAction } from "./time-off-actions";

type Row = Record<string, unknown>;

function makeSupabase(opts: {
  meetings?: Row[];
  consultations?: Row[];
  insertResult?: { data: Row | null; error: { message: string } | null };
  listResult?: Row[];
}) {
  const deleteFn = vi.fn(() => ({
    eq: () => ({ eq: () => Promise.resolve({ error: null }) }),
  }));
  return {
    from: (table: string) => {
      if (table === "meeting_requests") {
        return {
          select: () => ({
            eq: () => ({
              in: () => ({
                not: () => ({
                  lt: () => ({ gt: () => Promise.resolve({ data: opts.meetings ?? [], error: null }) }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === "consultations") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                not: () => ({
                  lt: () => ({ gt: () => Promise.resolve({ data: opts.consultations ?? [], error: null }) }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === "consultant_time_off") {
        return {
          select: () => ({
            eq: () => ({
              order: () => Promise.resolve({ data: opts.listResult ?? [], error: null }),
            }),
          }),
          insert: () => ({
            select: () => ({
              single: () => Promise.resolve(opts.insertResult ?? { data: { id: "t1" }, error: null }),
            }),
          }),
          delete: deleteFn,
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
}

beforeEach(() => {
  requireUserMock.mockReset();
});

describe("createMyTimeOffAction", () => {
  it("겹치는 확정 일정이 있으면 등록하지 않고 충돌 목록을 반환한다", async () => {
    requireUserMock.mockResolvedValue({
      user: { id: "c1" },
      profile: { role: "consultant" },
      supabase: makeSupabase({
        meetings: [{ starts_at: "2026-10-01T01:00:00Z", ends_at: "2026-10-01T02:00:00Z", status: "scheduled", child: { name: "학생A" } }],
      }),
    });

    const result = await createMyTimeOffAction({
      startsAt: "2026-10-01T00:00:00Z",
      endsAt: "2026-10-01T23:59:00Z",
      allDay: true,
    });

    expect("conflicts" in result && result.conflicts).toEqual([
      { kind: "meeting_request", label: "학생A", startsAt: "2026-10-01T01:00:00Z" },
    ]);
  });

  it("충돌이 없으면 정상 등록된다", async () => {
    requireUserMock.mockResolvedValue({
      user: { id: "c1" },
      profile: { role: "consultant" },
      supabase: makeSupabase({}),
    });

    const result = await createMyTimeOffAction({
      startsAt: "2026-10-01T00:00:00Z",
      endsAt: "2026-10-01T23:59:00Z",
      allDay: true,
      reason: "개인 사정",
    });

    expect(result).toEqual({ id: "t1" });
  });

  it("종료 시각이 시작 시각보다 빠르면 에러를 던진다", async () => {
    requireUserMock.mockResolvedValue({
      user: { id: "c1" },
      profile: { role: "consultant" },
      supabase: makeSupabase({}),
    });

    await expect(
      createMyTimeOffAction({ startsAt: "2026-10-01T10:00:00Z", endsAt: "2026-10-01T09:00:00Z", allDay: false })
    ).rejects.toThrow("종료 시각은 시작 시각보다 나중이어야 합니다.");
  });

  it("컨설턴트가 아니면 거부한다", async () => {
    requireUserMock.mockResolvedValue({ user: { id: "u1" }, profile: { role: "parent" }, supabase: makeSupabase({}) });
    await expect(
      createMyTimeOffAction({ startsAt: "2026-10-01T00:00:00Z", endsAt: "2026-10-01T23:59:00Z", allDay: true })
    ).rejects.toThrow("컨설턴트만 접근할 수 있습니다.");
  });
});

describe("listMyTimeOffAction / cancelMyTimeOffAction", () => {
  it("목록을 매핑해서 반환한다", async () => {
    requireUserMock.mockResolvedValue({
      user: { id: "c1" },
      profile: { role: "consultant" },
      supabase: makeSupabase({
        listResult: [{ id: "t1", starts_at: "a", ends_at: "b", all_day: true, reason: null, created_at: "c" }],
      }),
    });
    const result = await listMyTimeOffAction();
    expect(result).toEqual([{ id: "t1", startsAt: "a", endsAt: "b", allDay: true, reason: null, createdAt: "c" }]);
  });

  it("취소는 본인 것만 삭제 조건을 건다(에러 없이 완료)", async () => {
    requireUserMock.mockResolvedValue({ user: { id: "c1" }, profile: { role: "consultant" }, supabase: makeSupabase({}) });
    await expect(cancelMyTimeOffAction("t1")).resolves.toBeUndefined();
  });
});
