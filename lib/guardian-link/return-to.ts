import { cookies } from "next/headers";

// 2026-10-05 무료 회원 S4 — 보호자가 /guardian-link/[token]에서 로그인/비밀번호 설정으로 빠졌다가
// 돌아올 목적지. 경로 접두사를 고정해 열린 리다이렉트를 막는다(쿠키 값은 신뢰하지 않고 검증한다).
export const RETURN_TO_COOKIE = "alton_return_to";
const ALLOWED_PREFIX = "/guardian-link/";
const MAX_AGE_SECONDS = 60 * 60; // 1h

export function isAllowedReturnPath(value: unknown): value is string {
  return typeof value === "string" && value.startsWith(ALLOWED_PREFIX) && /^\/guardian-link\/[A-Za-z0-9_-]{16,128}$/.test(value);
}

export async function setReturnTo(path: string): Promise<void> {
  if (!isAllowedReturnPath(path)) return;
  const store = await cookies();
  store.set(RETURN_TO_COOKIE, path, { httpOnly: true, sameSite: "lax", path: "/", maxAge: MAX_AGE_SECONDS, secure: process.env.NODE_ENV === "production" });
}

/** 읽은 뒤 즉시 지운다(1회성). 허용 경로가 아니면 null. */
export async function consumeReturnTo(): Promise<string | null> {
  const store = await cookies();
  const value = store.get(RETURN_TO_COOKIE)?.value ?? null;
  if (value !== null) {
    try {
      store.delete(RETURN_TO_COOKIE);
    } catch {
      // 읽기 전용 컨텍스트(서버 컴포넌트)에서는 삭제가 막힐 수 있다 — 1시간 maxAge로 자연 만료.
    }
  }
  return isAllowedReturnPath(value) ? value : null;
}
