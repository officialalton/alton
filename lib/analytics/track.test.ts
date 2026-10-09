import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const vercelTrackMock = vi.fn();
vi.mock("@vercel/analytics", () => ({ track: vercelTrackMock }));

const ORIGINAL_ENV = process.env.NEXT_PUBLIC_VERCEL_ENV;

async function importFresh() {
  vi.resetModules();
  return await import("./track");
}

describe("trackEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    if (ORIGINAL_ENV === undefined) delete process.env.NEXT_PUBLIC_VERCEL_ENV;
    else process.env.NEXT_PUBLIC_VERCEL_ENV = ORIGINAL_ENV;
    window.history.pushState({}, "", "/");
  });

  it("production이 아니면 아무것도 보내지 않는다(local/test)", async () => {
    delete process.env.NEXT_PUBLIC_VERCEL_ENV;
    const { trackEvent } = await importFresh();
    trackEvent("landing_cta_clicked", { cta_name: "consult_signup" });
    expect(vercelTrackMock).not.toHaveBeenCalled();
  });

  it("preview 환경이면 아무것도 보내지 않는다", async () => {
    process.env.NEXT_PUBLIC_VERCEL_ENV = "preview";
    const { trackEvent } = await importFresh();
    trackEvent("landing_cta_clicked", { cta_name: "consult_signup" });
    expect(vercelTrackMock).not.toHaveBeenCalled();
  });

  it("production이면 이벤트를 보낸다", async () => {
    process.env.NEXT_PUBLIC_VERCEL_ENV = "production";
    const { trackEvent } = await importFresh();
    trackEvent("landing_cta_clicked", { cta_name: "consult_signup", section: "header" });
    expect(vercelTrackMock).toHaveBeenCalledTimes(1);
    expect(vercelTrackMock).toHaveBeenCalledWith(
      "landing_cta_clicked",
      expect.objectContaining({ cta_name: "consult_signup", section: "header", surface: "landing" })
    );
  });

  it("page_path에 쿼리스트링·fragment를 포함하지 않는다", async () => {
    process.env.NEXT_PUBLIC_VERCEL_ENV = "production";
    window.history.pushState({}, "", "/some/page?secret=1&token=abc#section-2");
    const { trackEvent } = await importFresh();
    trackEvent("landing_cta_clicked", { cta_name: "consult_signup" });
    const payload = vercelTrackMock.mock.calls[0][1];
    expect(payload.page_path).toBe("/some/page");
    expect(payload.page_path).not.toContain("?");
    expect(payload.page_path).not.toContain("#");
    expect(payload.page_path).not.toContain("secret");
    expect(payload.page_path).not.toContain("token");
  });

  it("이벤트에 허용되지 않은 속성은 payload에서 빠진다(화이트리스트)", async () => {
    process.env.NEXT_PUBLIC_VERCEL_ENV = "production";
    const { trackEvent } = await importFresh();
    trackEvent(
      "landing_cta_clicked",
      // @ts-expect-error 허용되지 않은 속성을 일부러 섞어 넣는다(런타임 방어 확인).
      { cta_name: "consult_signup", user_email: "user@example.com", household_id: "h1" }
    );
    const payload = vercelTrackMock.mock.calls[0][1];
    expect(payload).not.toHaveProperty("user_email");
    expect(payload).not.toHaveProperty("household_id");
    expect(Object.keys(payload).sort()).toEqual(["cta_name", "locale", "page_path", "surface"]);
  });

  it("금지된 개인정보 필드(이름·이메일·전화·ID 등)는 어떤 이벤트에도 허용 목록에 없다", async () => {
    const { ALLOWED_EVENT_PROPS } = await import("./events");
    const forbidden = [
      "user_id",
      "profile_id",
      "household_id",
      "student_id",
      "name",
      "email",
      "phone",
      "date_of_birth",
      "school",
      "concerns",
      "message",
      "essay",
      "grade",
      "gpa",
      "sat_score",
      "target_colleges",
      "notes",
    ];
    for (const props of Object.values(ALLOWED_EVENT_PROPS)) {
      for (const forbiddenKey of forbidden) {
        expect(props as readonly string[]).not.toContain(forbiddenKey);
      }
    }
  });

  it("onceKey가 같으면 두 번째 호출은 무시한다(중복 집계 방지)", async () => {
    process.env.NEXT_PUBLIC_VERCEL_ENV = "production";
    const { trackEvent } = await importFresh();
    trackEvent("consultation_started", { entry_point: "landing_form" }, { onceKey: "nonce-1" });
    trackEvent("consultation_started", { entry_point: "landing_form" }, { onceKey: "nonce-1" });
    expect(vercelTrackMock).toHaveBeenCalledTimes(1);
  });

  it("onceKey가 다르면(다른 폼 인스턴스) 각각 발생한다", async () => {
    process.env.NEXT_PUBLIC_VERCEL_ENV = "production";
    const { trackEvent } = await importFresh();
    trackEvent("consultation_started", { entry_point: "landing_form" }, { onceKey: "nonce-1" });
    trackEvent("consultation_started", { entry_point: "landing_form" }, { onceKey: "nonce-2" });
    expect(vercelTrackMock).toHaveBeenCalledTimes(2);
  });

  it("onceKey 없이 짧은 시간 안에 같은 이벤트를 연타하면 한 번만 보낸다", async () => {
    process.env.NEXT_PUBLIC_VERCEL_ENV = "production";
    const { trackEvent } = await importFresh();
    trackEvent("landing_cta_clicked", { cta_name: "consult_signup" });
    trackEvent("landing_cta_clicked", { cta_name: "consult_signup" });
    trackEvent("landing_cta_clicked", { cta_name: "consult_signup" });
    expect(vercelTrackMock).toHaveBeenCalledTimes(1);
  });

  it("분석 전송이 예외를 던져도 호출부로 전파하지 않는다", async () => {
    process.env.NEXT_PUBLIC_VERCEL_ENV = "production";
    vercelTrackMock.mockImplementation(() => {
      throw new Error("network error");
    });
    const { trackEvent } = await importFresh();
    expect(() => trackEvent("landing_cta_clicked", { cta_name: "consult_signup" })).not.toThrow();
  });
});
