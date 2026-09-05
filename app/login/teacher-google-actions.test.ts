import { beforeEach, describe, expect, it, vi } from "vitest";

const signInWithOAuthMock = vi.fn();
vi.mock("@/utils/supabase/server", () => ({
  createClient: async () => ({ auth: { signInWithOAuth: signInWithOAuthMock } }),
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

describe("signInWithGoogleForTeacher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Google OAuth authorize URL로 리다이렉트하고 alton.education 도메인 힌트를 넘긴다", async () => {
    signInWithOAuthMock.mockResolvedValue({
      data: { url: "https://accounts.google.com/o/oauth2/authorize?client_id=..." },
      error: null,
    });

    const { signInWithGoogleForTeacher } = await import("./teacher-google-actions");
    await expect(signInWithGoogleForTeacher()).rejects.toThrow(
      "REDIRECT:https://accounts.google.com/o/oauth2/authorize?client_id=..."
    );

    expect(signInWithOAuthMock).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "google",
        options: expect.objectContaining({
          redirectTo: "https://alton-preview-test.vercel.app/auth/teacher-callback",
          queryParams: expect.objectContaining({ hd: "alton.education" }),
        }),
      })
    );
  });

  it("Supabase가 에러를 반환하면 에러를 던진다", async () => {
    signInWithOAuthMock.mockResolvedValue({ data: { url: null }, error: { message: "provider not configured" } });

    const { signInWithGoogleForTeacher } = await import("./teacher-google-actions");
    await expect(signInWithGoogleForTeacher()).rejects.toThrow("provider not configured");
  });
});
