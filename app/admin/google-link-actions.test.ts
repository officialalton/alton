import { beforeEach, describe, expect, it, vi } from "vitest";

const linkIdentityMock = vi.fn();
const signInWithOAuthMock = vi.fn();
const requireAdminMock = vi.fn();

vi.mock("@/utils/supabase/server", () => ({
  createClient: async () => ({
    auth: { linkIdentity: linkIdentityMock, signInWithOAuth: signInWithOAuthMock },
  }),
}));

vi.mock("@/lib/admin-auth", () => ({
  requireAdmin: requireAdminMock,
}));

const redirectMock = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});
vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("next/headers", () => ({
  headers: async () =>
    new Map([
      ["x-forwarded-proto", "https"],
      ["x-forwarded-host", "alton-preview-test.vercel.app"],
    ]),
}));

describe("linkAdminGoogleAccount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("이미 인증된 관리자만 통과시키고 linkIdentity로 리다이렉트한다", async () => {
    requireAdminMock.mockResolvedValue({ supabase: {}, adminUserId: "admin-1" });
    linkIdentityMock.mockResolvedValue({
      data: { url: "https://accounts.google.com/o/oauth2/authorize?link" },
      error: null,
    });

    const { linkAdminGoogleAccount } = await import("./google-link-actions");
    await expect(linkAdminGoogleAccount()).rejects.toThrow(
      "REDIRECT:https://accounts.google.com/o/oauth2/authorize?link"
    );

    expect(requireAdminMock).toHaveBeenCalled();
    expect(linkIdentityMock).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "google" })
    );
  });

  it("관리자가 아니면 requireAdmin이 던지는 에러를 그대로 전파한다", async () => {
    requireAdminMock.mockRejectedValue(new Error("관리자만 사용할 수 있습니다."));

    const { linkAdminGoogleAccount } = await import("./google-link-actions");
    await expect(linkAdminGoogleAccount()).rejects.toThrow("관리자만 사용할 수 있습니다.");
    expect(linkIdentityMock).not.toHaveBeenCalled();
  });
});

describe("signInWithGoogleForAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Google OAuth authorize URL로 리다이렉트한다(미인증 방문자 허용)", async () => {
    signInWithOAuthMock.mockResolvedValue({
      data: { url: "https://accounts.google.com/o/oauth2/authorize?login" },
      error: null,
    });

    const { signInWithGoogleForAdmin } = await import("./google-link-actions");
    await expect(signInWithGoogleForAdmin()).rejects.toThrow(
      "REDIRECT:https://accounts.google.com/o/oauth2/authorize?login"
    );
  });

  it("Supabase가 에러를 반환하면 에러를 던진다", async () => {
    signInWithOAuthMock.mockResolvedValue({ data: { url: null }, error: { message: "provider not configured" } });

    const { signInWithGoogleForAdmin } = await import("./google-link-actions");
    await expect(signInWithGoogleForAdmin()).rejects.toThrow("provider not configured");
  });
});
