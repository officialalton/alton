import { describe, expect, it } from "vitest";
import { ctaLabelFor, isInviteExpired, mapGuardianLinkError, resendRemainingMs, validateGuardianEmail, RESEND_COOLDOWN_MS } from "./tutoring-state";

describe("validateGuardianEmail", () => {
  it("공백·빈값·형식 오류를 영어 문구로 돌려주고, 유효하면 trim한 값을 준다", () => {
    expect(validateGuardianEmail("")).toEqual({ ok: false, error: "Enter your parent's email address." });
    expect(validateGuardianEmail("   ")).toEqual({ ok: false, error: "Enter your parent's email address." });
    expect(validateGuardianEmail("nope")).toMatchObject({ ok: false });
    expect(validateGuardianEmail("a@b")).toMatchObject({ ok: false });
    expect(validateGuardianEmail("  parent@example.com ")).toEqual({ ok: true, value: "parent@example.com" });
  });
});

describe("resendRemainingMs / isInviteExpired", () => {
  it("쿨다운 10분을 기준으로 남은 시간을 계산한다", () => {
    const now = Date.parse("2026-10-05T10:00:00Z");
    expect(resendRemainingMs("2026-10-05T09:55:00Z", now)).toBe(5 * 60 * 1000);
    expect(resendRemainingMs("2026-10-05T09:00:00Z", now)).toBe(0);
    expect(resendRemainingMs("garbage", now)).toBe(0);
    expect(RESEND_COOLDOWN_MS).toBe(600_000);
  });
  it("만료는 시각으로 판정한다", () => {
    const now = Date.parse("2026-10-05T10:00:00Z");
    expect(isInviteExpired("2026-10-05T09:59:59Z", now)).toBe(true);
    expect(isInviteExpired("2026-10-05T10:00:01Z", now)).toBe(false);
  });
});

describe("ctaLabelFor — 상태 머신 문구(영어)", () => {
  it("상태별로 제목·버튼이 달라진다", () => {
    expect(ctaLabelFor({ kind: "none", invites: [] }).button).toBe("I'm interested");
    expect(ctaLabelFor({ kind: "interest", status: "registered", invites: [] }).button).toBe("Invite my parent");
    expect(ctaLabelFor({ kind: "interest", status: "invite_sent", invites: [] }).title).toBe("Invitation sent");
    expect(ctaLabelFor({ kind: "interest", status: "parent_linked", invites: [] }).title).toBe("Parent connected");
    expect(ctaLabelFor({ kind: "interest", status: "consultation_requested", invites: [] }).title).toBe("Consultation requested");
    expect(ctaLabelFor({ kind: "interest", status: "booked", invites: [] }).title).toBe("Consultation booked");
    expect(ctaLabelFor({ kind: "tutoring_member", invites: [] }).button).toBe("Open consultant tab");
  });
  it("한글 문구가 섞이지 않는다(오너 결정: 신규 학생 대면 UI는 영어)", () => {
    const states = [
      { kind: "none" as const, invites: [] },
      ...(["registered", "invite_sent", "parent_linked", "consultation_requested", "booked"] as const).map((status) => ({ kind: "interest" as const, status, invites: [] })),
    ];
    for (const s of states) {
      const t = ctaLabelFor(s);
      expect(`${t.title}${t.body}${t.button}`).not.toMatch(/[ㄱ-힝]/);
    }
  });
});

describe("mapGuardianLinkError", () => {
  it("RPC 코드를 영어 안내로 바꾸고 모르는 메시지는 일반 문구로 가린다", () => {
    expect(mapGuardianLinkError("own_email")).toMatch(/not your own/);
    expect(mapGuardianLinkError("P0001: resend_cooldown")).toMatch(/10 minutes/);
    expect(mapGuardianLinkError("too_many_open_invites")).toMatch(/up to 3/);
    expect(mapGuardianLinkError("permission denied for table x")).toBe("Something went wrong. Please try again.");
  });
});
