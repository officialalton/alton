import { beforeEach, describe, expect, it, vi } from "vitest";

const sendReminderMock = vi.hoisted(() => vi.fn());
vi.mock("./emails", () => ({ sendGuardianLinkReminderEmail: sendReminderMock }));

import { runGuardianLinkDailyStep } from "./cron";

// 일일 크론 단계 — 만료 처리 → 후보 조회 → (unaccepted: 토큰 회전 후 메일 / unbooked: 메일 후 기록). 발송 실패는 기록하지 않는다.
function adminWith(responses: Record<string, (args?: Record<string, unknown>) => { data: unknown; error: { message: string } | null }>) {
  const rpc = vi.fn(async (fn: string, args?: Record<string, unknown>) => responses[fn]?.(args) ?? { data: null, error: { message: `unexpected rpc ${fn}` } });
  return { rpc };
}

beforeEach(() => {
  sendReminderMock.mockReset();
  sendReminderMock.mockResolvedValue(undefined);
});

describe("runGuardianLinkDailyStep", () => {
  it("만료 수를 돌려주고 후보별로 적절한 링크로 메일을 보낸 뒤 기록한다", async () => {
    const admin = adminWith({
      mark_expired_guardian_link_invites: () => ({ data: 2, error: null }),
      list_guardian_link_reminder_candidates: () => ({
        data: [
          { invite_id: "i1", kind: "unaccepted", email: "a@example.com", student_first_name: "Min", scheduling_token: null },
          { invite_id: "i2", kind: "unbooked", email: "b@example.com", student_first_name: "Joon", scheduling_token: "sched-tok" },
        ],
        error: null,
      }),
      issue_guardian_link_reminder_token: () => ({ data: [{ invite_id: "i1b", raw_token: "new-raw" }], error: null }),
      mark_guardian_link_reminder_sent: () => ({ data: null, error: null }),
    });
    const r = await runGuardianLinkDailyStep(admin, "https://alton.test");
    expect(r).toEqual({ expiredCount: 2, remindersSent: 2, remindersFailed: 0 });
    expect(sendReminderMock).toHaveBeenNthCalledWith(1, { to: "a@example.com", kind: "unaccepted", studentFirstName: "Min", url: "https://alton.test/guardian-link/new-raw" });
    expect(sendReminderMock).toHaveBeenNthCalledWith(2, { to: "b@example.com", kind: "unbooked", studentFirstName: "Joon", url: "https://alton.test/schedule/sched-tok" });
    expect(admin.rpc).toHaveBeenCalledWith("mark_guardian_link_reminder_sent", { p_invite_id: "i2", p_kind: "unbooked" });
    // unaccepted는 토큰 회전 RPC가 reminder_sent를 기록하므로 별도 mark 호출이 없다.
    expect(admin.rpc).not.toHaveBeenCalledWith("mark_guardian_link_reminder_sent", { p_invite_id: "i1", p_kind: "unaccepted" });
  });

  it("발송 실패는 실패 수로 세고 기록하지 않는다(다음날 재시도); 만료 RPC 실패면 중단하고 error를 돌려준다", async () => {
    sendReminderMock.mockRejectedValueOnce(new Error("smtp down"));
    const admin = adminWith({
      mark_expired_guardian_link_invites: () => ({ data: 0, error: null }),
      list_guardian_link_reminder_candidates: () => ({ data: [{ invite_id: "i2", kind: "unbooked", email: "b@example.com", student_first_name: "", scheduling_token: "t" }], error: null }),
      mark_guardian_link_reminder_sent: () => ({ data: null, error: null }),
    });
    const r = await runGuardianLinkDailyStep(admin, "https://alton.test");
    expect(r).toEqual({ expiredCount: 0, remindersSent: 0, remindersFailed: 1 });
    expect(admin.rpc).not.toHaveBeenCalledWith("mark_guardian_link_reminder_sent", expect.anything());

    const broken = adminWith({ mark_expired_guardian_link_invites: () => ({ data: null, error: { message: "boom" } }) });
    const r2 = await runGuardianLinkDailyStep(broken, "https://alton.test");
    expect(r2.error).toBe("boom");
    expect(broken.rpc).toHaveBeenCalledTimes(1);
  });
});
