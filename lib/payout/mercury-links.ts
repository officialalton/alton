// Mercury 대시보드 링크 검증: https://*.mercury.com 만 허용한다(DB 체크 제약과 같은 규칙).
export function safeMercuryDashboardUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const u = new URL(value);
    if (u.protocol !== "https:" || u.username || u.password) return null;
    if (u.hostname !== "mercury.com" && !u.hostname.endsWith(".mercury.com")) return null;
    return u.toString();
  } catch {
    return null;
  }
}
