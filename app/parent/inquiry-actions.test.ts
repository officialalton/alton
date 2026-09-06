import { beforeEach, describe, expect, it, vi } from "vitest";

function chain(result: unknown) {
  const obj: Record<string, unknown> = {};
  const self = new Proxy(obj, {
    get(_target, prop) {
      if (prop === "then") return undefined;
      if (prop === "maybeSingle" || prop === "single") return () => Promise.resolve(result);
      return (..._args: unknown[]) => self;
    },
  });
  return self;
}

const membershipResult = { data: { household_id: "household1" } };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let insertMock: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let rpcMock: any;
let selectResults: Record<string, unknown>;

const supabaseMock = {
  from: vi.fn((table: string) => {
    if (table === "household_members") {
      return {
        select: () => chain(membershipResult),
        insert: insertMock,
      };
    }
    if (table === "household_messages") {
      return {
        select: () => chain(selectResults.household_messages ?? { data: [] }),
        insert: insertMock,
      };
    }
    if (table === "meeting_requests") {
      return {
        select: () => chain(selectResults.meeting_requests ?? { data: [] }),
        insert: insertMock,
      };
    }
    throw new Error(`unexpected table ${table}`);
  }),
  rpc: (...args: unknown[]) => rpcMock(...args),
};

vi.mock("@/lib/auth", () => ({
  requireUser: vi.fn(async () => ({
    user: { id: "guardian1", email: "guardian@example.com" },
    profile: { role: "parent", name: "김민지" },
    supabase: supabaseMock,
  })),
}));

import {
  sendGuardianHouseholdMessage,
  submitMeetingRequest,
  listOpenGuardianMeetingSlots,
} from "./inquiry-actions";

describe("sendGuardianHouseholdMessage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    insertMock = vi.fn().mockResolvedValue({ error: null });
    rpcMock = vi.fn();
    selectResults = {};
  });

  it("빈 내용이면 거부한다", async () => {
    await expect(sendGuardianHouseholdMessage("   ")).rejects.toThrow("내용을 입력해주세요");
  });

  it("본인 household_id로 sender_role='guardian' 메시지를 삽입한다", async () => {
    await sendGuardianHouseholdMessage("문의합니다");
    expect(insertMock).toHaveBeenCalledWith({
      household_id: "household1",
      sender_id: "guardian1",
      sender_role: "guardian",
      body: "문의합니다",
    });
  });
});

describe("submitMeetingRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    insertMock = vi.fn().mockResolvedValue({ error: null });
    rpcMock = vi.fn();
    selectResults = {};
  });

  it("슬롯 미선택 시 예외를 던지지 않고 ok:false를 반환한다", async () => {
    const result = await submitMeetingRequest({ slotStartsAtIso: "" });
    expect(result).toEqual({ ok: false, error: "면담 희망 시간을 선택해주세요." });
  });

  it("정상 신청 시 meeting_requests에 60분 슬롯으로 insert한다", async () => {
    const result = await submitMeetingRequest({
      childId: "child1",
      subject: "성적 상담",
      slotStartsAtIso: "2027-01-01T09:00:00.000Z",
    });
    expect(result).toEqual({ ok: true });
    expect(insertMock).toHaveBeenCalledWith({
      household_id: "household1",
      child_id: "child1",
      subject: "성적 상담",
      requested_by: "guardian1",
      starts_at: "2027-01-01T09:00:00.000Z",
      ends_at: "2027-01-01T10:00:00.000Z",
      source_message_id: null,
    });
  });

  it("insert 실패 시 예외를 던지지 않고 ok:false로 반환한다(Minified React error #441 재발 방지)", async () => {
    insertMock = vi.fn().mockResolvedValue({ error: { message: "DB 오류" } });
    const result = await submitMeetingRequest({ slotStartsAtIso: "2027-01-01T09:00:00.000Z" });
    expect(result).toEqual({ ok: false, error: "DB 오류" });
  });
});

describe("listOpenGuardianMeetingSlots", () => {
  it("list_open_meeting_slots RPC를 호출한다(list_open_consult_slots와 별개)", async () => {
    rpcMock = vi.fn().mockResolvedValue({ data: [{ slot_starts_at: "2027-01-01T09:00:00.000Z" }], error: null });
    const result = await listOpenGuardianMeetingSlots("2027-01-01T00:00:00.000Z", "2027-01-02T00:00:00.000Z");
    expect(rpcMock).toHaveBeenCalledWith("list_open_meeting_slots", {
      p_from: "2027-01-01T00:00:00.000Z",
      p_to: "2027-01-02T00:00:00.000Z",
    });
    expect(result).toEqual([{ startsAt: "2027-01-01T09:00:00.000Z" }]);
  });
});
