import { describe, it, expect, vi, beforeEach } from "vitest";

const { requireUserMock } = vi.hoisted(() => ({ requireUserMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireUser: requireUserMock }));

import { getMyHouseholdConsultantsAction, listOpenSlotsForConsultantAction, submitMeetingRequest } from "./inquiry-actions";

// Phase A 마무리(2026-09-23) — 보호자가 담당 컨설턴트에게 직접 상담을
// 신청하는 경로 검증. 자녀마다 다른 컨설턴트를 반환해야 하고, 다른 자녀의
// 담당자를 지정해서 신청하면 거부돼야 한다(RLS 이중 방어의 앱 레이어 쪽).

type Row = Record<string, unknown>;

function makeSupabase(opts: {
  householdMembers?: Row[];
  assignments?: Row[];
  singleAssignment?: Row | null;
  insertError?: { message: string } | null;
}) {
  const insertMock = vi.fn(() => Promise.resolve({ error: opts.insertError ?? null }));
  return {
    from: (table: string) => {
      if (table === "household_members") {
        // requireGuardianHouseholdId: select().eq().eq().limit().maybeSingle()
        // getMyHouseholdConsultantsAction: select().eq().eq() (자녀 목록, 그대로 await)
        const householdChain = {
          eq: () => householdChain,
          limit: () => householdChain,
          maybeSingle: () => Promise.resolve({ data: { household_id: "household1" } }),
          then: (resolve: (v: { data: Row[]; error: null }) => void) =>
            resolve({ data: opts.householdMembers ?? [], error: null }),
        };
        return { select: () => householdChain };
      }
      if (table === "consultant_assignments") {
        return {
          select: () => ({
            in: () => Promise.resolve({ data: opts.assignments ?? [], error: null }),
            eq: () => ({ maybeSingle: () => Promise.resolve({ data: opts.singleAssignment ?? null, error: null }) }),
          }),
        };
      }
      if (table === "meeting_requests") {
        return { insert: insertMock };
      }
      throw new Error(`unexpected table ${table}`);
    },
    rpc: vi.fn(() => Promise.resolve({ data: [{ slot_starts_at: "2027-01-01T09:00:00.000Z" }], error: null })),
    _insertMock: insertMock,
  };
}

beforeEach(() => {
  requireUserMock.mockReset();
});

describe("getMyHouseholdConsultantsAction", () => {
  it("자녀마다 담당 컨설턴트를 매핑해서 반환한다", async () => {
    const supabase = makeSupabase({
      householdMembers: [
        { profile_id: "child1", child: { id: "child1", name: "첫째" } },
        { profile_id: "child2", child: { id: "child2", name: "둘째" } },
      ],
      assignments: [
        { student_id: "child1", consultant_id: "c1", consultant: { name: "지만" } },
        { student_id: "child2", consultant_id: "c2", consultant: { name: "다른컨설턴트" } },
      ],
    });
    requireUserMock.mockResolvedValue({ user: { id: "guardian1" }, profile: { role: "parent" }, supabase });

    const result = await getMyHouseholdConsultantsAction();

    expect(result).toEqual([
      { childId: "child1", childName: "첫째", consultantId: "c1", consultantName: "지만" },
      { childId: "child2", childName: "둘째", consultantId: "c2", consultantName: "다른컨설턴트" },
    ]);
  });

  it("자녀가 없으면 빈 배열", async () => {
    const supabase = makeSupabase({ householdMembers: [] });
    requireUserMock.mockResolvedValue({ user: { id: "guardian1" }, profile: { role: "parent" }, supabase });
    expect(await getMyHouseholdConsultantsAction()).toEqual([]);
  });

  it("보호자가 아니면 거부한다", async () => {
    requireUserMock.mockResolvedValue({ user: { id: "u1" }, profile: { role: "student" }, supabase: makeSupabase({}) });
    await expect(getMyHouseholdConsultantsAction()).rejects.toThrow("보호자만 접근할 수 있습니다.");
  });
});

describe("submitMeetingRequest — 담당 컨설턴트 지정 경로", () => {
  it("지정한 컨설턴트가 그 자녀의 실제 담당자가 아니면 거부한다", async () => {
    const supabase = makeSupabase({ singleAssignment: { consultant_id: "real-consultant" } });
    requireUserMock.mockResolvedValue({ user: { id: "guardian1" }, profile: { role: "parent" }, supabase });

    const result = await submitMeetingRequest({
      reason: "상담 요청",
      slotStartsAtIso: "2027-01-01T09:00:00.000Z",
      childId: "child1",
      consultantId: "wrong-consultant",
    });

    expect(result).toEqual({ ok: false, error: "선택한 자녀의 담당 컨설턴트가 아닙니다." });
    expect(supabase._insertMock).not.toHaveBeenCalled();
  });

  it("실제 담당 컨설턴트를 지정하면 정상 접수된다", async () => {
    const supabase = makeSupabase({ singleAssignment: { consultant_id: "real-consultant" } });
    requireUserMock.mockResolvedValue({ user: { id: "guardian1" }, profile: { role: "parent" }, supabase });

    const result = await submitMeetingRequest({
      reason: "상담 요청",
      slotStartsAtIso: "2027-01-01T09:00:00.000Z",
      childId: "child1",
      consultantId: "real-consultant",
    });

    expect(result).toEqual({ ok: true });
    expect(supabase._insertMock).toHaveBeenCalledWith(
      expect.objectContaining({ child_id: "child1", consultant_id: "real-consultant" })
    );
  });
});

describe("listOpenSlotsForConsultantAction", () => {
  it("컨설턴트 전용 RPC를 호출해 슬롯을 매핑한다", async () => {
    const supabase = makeSupabase({});
    requireUserMock.mockResolvedValue({ user: { id: "guardian1" }, supabase });

    const result = await listOpenSlotsForConsultantAction("c1", "2027-01-01T00:00:00Z", "2027-01-02T00:00:00Z");

    expect(supabase.rpc).toHaveBeenCalledWith("list_open_consultant_meeting_slots", {
      p_consultant_id: "c1",
      p_from: "2027-01-01T00:00:00Z",
      p_to: "2027-01-02T00:00:00Z",
    });
    expect(result).toEqual([{ startsAt: "2027-01-01T09:00:00.000Z" }]);
  });
});
