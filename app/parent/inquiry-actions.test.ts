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
let insertInquiryMock: any;
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
    if (table === "household_inquiries") {
      return {
        select: () => chain(selectResults.household_inquiries ?? { data: [] }),
        insert: insertInquiryMock,
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
  startGuardianInquiry,
  sendGuardianInquiryMessage,
  submitMeetingRequest,
  listOpenGuardianMeetingSlots,
} from "./inquiry-actions";

describe("startGuardianInquiry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    insertMock = vi.fn().mockResolvedValue({ error: null });
    insertInquiryMock = vi.fn(() => ({
      select: () => ({ single: () => Promise.resolve({ data: { id: "inquiry1" }, error: null }) }),
    }));
    rpcMock = vi.fn();
    selectResults = {};
  });

  it("빈 내용이면 거부한다", async () => {
    await expect(startGuardianInquiry("   ")).rejects.toThrow("내용을 입력해주세요");
  });

  it("본인 household_id로 문의를 만들고 첫 메시지를 삽입한다", async () => {
    const result = await startGuardianInquiry("문의합니다");
    expect(result).toEqual({ inquiryId: "inquiry1" });
    expect(insertInquiryMock).toHaveBeenCalledWith({
      household_id: "household1",
      opened_by: "guardian1",
      opened_by_role: "guardian",
      subject: null,
    });
    expect(insertMock).toHaveBeenCalledWith({
      household_id: "household1",
      inquiry_id: "inquiry1",
      sender_id: "guardian1",
      sender_role: "guardian",
      body: "문의합니다",
    });
  });
});

describe("sendGuardianInquiryMessage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    insertMock = vi.fn().mockResolvedValue({ error: null });
    rpcMock = vi.fn();
    selectResults = {};
  });

  it("빈 내용이면 거부한다", async () => {
    await expect(sendGuardianInquiryMessage("inquiry1", "   ")).rejects.toThrow("내용을 입력해주세요");
  });

  it("지정한 문의에 sender_role='guardian' 메시지를 삽입한다", async () => {
    await sendGuardianInquiryMessage("inquiry1", "재문의합니다");
    expect(insertMock).toHaveBeenCalledWith({
      household_id: "household1",
      inquiry_id: "inquiry1",
      sender_id: "guardian1",
      sender_role: "guardian",
      body: "재문의합니다",
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

  const SLOT_ISO = "2027-01-01T09:00:00.000Z";

  it("사유 미입력 시 예외를 던지지 않고 ok:false를 반환한다", async () => {
    const result = await submitMeetingRequest({ reason: "", slotStartsAtIso: SLOT_ISO });
    expect(result).toEqual({ ok: false, error: "상담 사유를 입력해주세요." });
  });

  it("슬롯 미선택 시 예외를 던지지 않고 ok:false를 반환한다", async () => {
    const result = await submitMeetingRequest({ reason: "다음 학기 진도 상담을 요청합니다.", slotStartsAtIso: "" });
    expect(result).toEqual({ ok: false, error: "상담 희망 시간을 선택해주세요." });
  });

  it("정상 신청 시 meeting_requests에 content·starts_at/ends_at만 채우고 나머지 컬럼은 null로 insert한다(R12.1)", async () => {
    const result = await submitMeetingRequest({ reason: "다음 학기 진도 상담을 요청합니다.", slotStartsAtIso: SLOT_ISO });
    expect(result).toEqual({ ok: true });
    expect(insertMock).toHaveBeenCalledWith({
      household_id: "household1",
      child_id: null,
      subject: null,
      content: "다음 학기 진도 상담을 요청합니다.",
      contact_preference: null,
      preferred_contact_time: null,
      requested_by: "guardian1",
      starts_at: SLOT_ISO,
      ends_at: "2027-01-01T10:00:00.000Z",
      source_message_id: null,
    });
  });

  it("insert 실패 시 예외를 던지지 않고 ok:false로 반환한다(Minified React error #441 재발 방지)", async () => {
    insertMock = vi.fn().mockResolvedValue({ error: { message: "DB 오류" } });
    const result = await submitMeetingRequest({ reason: "상담 요청", slotStartsAtIso: SLOT_ISO });
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
