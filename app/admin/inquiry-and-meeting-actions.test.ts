import { beforeEach, describe, expect, it, vi } from "vitest";

// update(...).eq(...).eq(...) 처럼 체이닝 깊이가 호출마다 다르므로, 어느 시점에
// await하든(즉 어느 깊이에서 then을 부르든) 같은 최종 결과를 반환하는 Proxy 체인을
// 쓴다 — app/parent/inquiry-actions.test.ts와 동일한 헬퍼.
function chain(result: unknown) {
  const obj: Record<string, unknown> = {};
  const self = new Proxy(obj, {
    get(_target, prop) {
      if (prop === "then") return (resolve: (v: unknown) => void) => resolve(result);
      return (..._args: unknown[]) => self;
    },
  });
  return self;
}

let insertMock: ReturnType<typeof vi.fn>;
let updateResult: unknown;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let rpcMock: any;

const supabaseMock = {
  from: vi.fn((_table: string) => ({
    insert: insertMock,
    update: () => chain(updateResult),
  })),
  rpc: (...args: unknown[]) => rpcMock(...args),
};

vi.mock("@/lib/admin-auth", () => ({
  requireAdmin: vi.fn(async () => ({ adminUserId: "admin1", supabase: supabaseMock })),
}));
vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: vi.fn(),
}));

import {
  sendAdminInquiryMessage,
  closeHouseholdInquiry,
  updateMeetingRequestStatus,
  addMeetingAvailabilityRule,
} from "./inquiry-and-meeting-actions";

describe("sendAdminInquiryMessage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    insertMock = vi.fn().mockResolvedValue({ error: null });
    updateResult = { error: null };
  });

  it("빈 내용이면 거부한다", async () => {
    await expect(sendAdminInquiryMessage("inquiry1", "household1", "  ")).rejects.toThrow("내용을 입력해주세요");
  });

  it("sender_role='admin'으로 지정한 문의에 삽입한다", async () => {
    await sendAdminInquiryMessage("inquiry1", "household1", "답변입니다");
    expect(insertMock).toHaveBeenCalledWith({
      household_id: "household1",
      inquiry_id: "inquiry1",
      sender_id: "admin1",
      sender_role: "admin",
      body: "답변입니다",
    });
  });
});

describe("closeHouseholdInquiry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("에러 없이 close_household_inquiry RPC를 호출한다", async () => {
    rpcMock = vi.fn().mockResolvedValue({ error: null });
    await expect(closeHouseholdInquiry("inquiry1")).resolves.toBeUndefined();
    expect(rpcMock).toHaveBeenCalledWith("close_household_inquiry", { p_inquiry_id: "inquiry1" });
  });

  it("RPC 실패 시 에러를 던진다", async () => {
    rpcMock = vi.fn().mockResolvedValue({ error: { message: "DB 오류" } });
    await expect(closeHouseholdInquiry("inquiry1")).rejects.toThrow("DB 오류");
  });
});

describe("updateMeetingRequestStatus", () => {
  it("면담 요청 상태를 변경한다", async () => {
    updateResult = { error: null };
    await expect(updateMeetingRequestStatus("meeting1", "confirming")).resolves.toBeUndefined();
  });

  // 2026-09-17 — "scheduled"는 이 함수로 만들 수 없다(유효한 시간 없이 조용히
  // scheduled로 넘어가는 회귀 방지). scheduleMeetingRequest()의 가드는
  // schedule-meeting-request.test.ts에서 별도로 검증한다.
});

describe("addMeetingAvailabilityRule", () => {
  beforeEach(() => vi.clearAllMocks());

  it("겹치는 시간대(23P01) 에러를 이해 가능한 문구로 바꾼다", async () => {
    insertMock = vi.fn().mockResolvedValue({ error: { code: "23P01", message: "exclusion violation" } });
    await expect(addMeetingAvailabilityRule({ weekday: 1, startTime: "09:00", endTime: "10:00" })).rejects.toThrow(
      "같은 요일에 겹치는 시간대가 이미 등록되어 있습니다."
    );
  });
});
