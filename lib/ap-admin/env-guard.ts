// AP 재고 관리 화면의 실행 환경 가드(순수 함수). lib/ap-generation/verify-guard.ts 의 규칙을 서버 환경변수 기준으로 옮겼다.
// 읽기(점검)는 어느 환경에서나 보이되, 쓰기(execute)는 허용 목록에 있는 비프로덕션 프로젝트 ref(또는 로컬)일 때만 허용한다.
//   AP_STOCK_ADMIN_ALLOWED_REFS  쉼표 구분 허용 목록. 값: 비프로덕션 프로젝트 ref(예: worpsqwqgnspddnrtnvq) 또는 `local`. 기본 = 빈 목록(쓰기 전부 거부).
//   AP_STOCK_ADMIN_BLOCKED_REFS  쉼표 구분 차단 목록(허용 목록보다 우선, 프로덕션 ref 를 넣어 두는 안전장치).
// VERCEL_ENV=production 배포에서는 허용 목록과 무관하게 쓰기를 거부한다(프로덕션 변경은 별도 승인·별도 절차).
// 접속 키·URL 전체는 화면·로그에 내보내지 않고 프로젝트 ref 만 보여 준다.
export type StockTarget = {
  kind: "local" | "remote" | "unknown";
  ref: string;
  canWrite: boolean;
  reason: string | null;
};

const split = (v: string | undefined) => (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const REF_RE = /^([a-z0-9]{20})\.supabase\.co$/;

export type TargetEnv = {
  NEXT_PUBLIC_SUPABASE_URL?: string;
  AP_STOCK_ADMIN_ALLOWED_REFS?: string;
  AP_STOCK_ADMIN_BLOCKED_REFS?: string;
  VERCEL_ENV?: string;
};

export function resolveStockTarget(env: TargetEnv): StockTarget {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const unknown = (reason: string): StockTarget => ({ kind: "unknown", ref: "unknown", canWrite: false, reason });
  if (!url) return unknown("NEXT_PUBLIC_SUPABASE_URL 이 설정되지 않아 접속 대상을 확인할 수 없습니다.");
  let host: string;
  try { host = new URL(url).hostname; } catch { return unknown("NEXT_PUBLIC_SUPABASE_URL 형식이 올바르지 않습니다."); }
  const allowed = split(env.AP_STOCK_ADMIN_ALLOWED_REFS), blocked = split(env.AP_STOCK_ADMIN_BLOCKED_REFS);
  const isLocal = host === "127.0.0.1" || host === "localhost" || host === "[::1]";
  let kind: "local" | "remote"; let ref: string;
  if (isLocal) { kind = "local"; ref = "local"; }
  else {
    const m = REF_RE.exec(host);
    if (!m) return unknown("Supabase 호스트 형식(<ref>.supabase.co)이 아니어서 대상을 확인할 수 없습니다. 쓰기를 거부합니다.");
    kind = "remote"; ref = m[1];
  }
  let reason: string | null = null;
  if (blocked.includes(ref)) reason = `대상(${ref})이 차단 목록(AP_STOCK_ADMIN_BLOCKED_REFS)에 있습니다.`;
  else if (env.VERCEL_ENV === "production") reason = "프로덕션 배포(VERCEL_ENV=production)에서는 이 화면의 쓰기를 허용하지 않습니다. 프로덕션 변경은 별도 승인 절차가 필요합니다.";
  else if (!allowed.includes(ref)) reason = `대상(${ref})이 허용 목록(AP_STOCK_ADMIN_ALLOWED_REFS)에 없어 쓰기를 거부합니다. 점검(읽기)만 가능합니다.`;
  return { kind, ref, canWrite: reason === null, reason };
}

/** 쓰기 전 호출: 허용되지 않으면 사유와 함께 던진다. */
export function assertCanWrite(t: StockTarget): void {
  if (!t.canWrite) throw new Error(t.reason ?? "이 대상에는 쓸 수 없습니다.");
}
