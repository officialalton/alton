import { getDriveApiAccessToken } from "@/lib/google-workspace-auth";
import { getR3PreviewDriveAccessToken } from "@/lib/drive-preview-verify-auth";

export const DRIVE_API = "https://www.googleapis.com/drive/v3";

/**
 * Drive API 호출 래퍼. `lib/drive-artifacts.ts`의 로컬 함수와 같은 동작을
 * 공유하기 위해 꺼냈다(복붙 금지 — P4-3 설계 §3.5).
 */
export async function driveFetch(url: string, token: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(url, {
    ...init,
    headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Drive API 요청 실패 (status ${res.status}): ${text.slice(0, 300)}`);
  }
  return res;
}

/**
 * Drive 접근 토큰. Preview는 Production WIF 체인을 절대 쓰지 않고 별도
 * 최소권한 서비스 계정을 쓴다(R3 임시 조치) — 기존 분기를 그대로 따른다.
 */
export async function getDriveTokenForCurrentEnv(): Promise<string> {
  return process.env.VERCEL_ENV === "preview"
    ? getR3PreviewDriveAccessToken()
    : getDriveApiAccessToken();
}
