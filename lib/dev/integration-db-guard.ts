// DB 통합 테스트 실행 전 대상 검사(순수 함수). 통합 테스트(*.integration.test.ts)는 SUPABASE_TEST_DB_URL/API_URL 이 없으면
// 공유 로컬 스택(54422/54421)으로 폴백해 실제로 쓰기를 한다(2026-10-08 사고). 지정이 없거나 공유 스택을 가리키면 테스트 시작 전에 중단한다.
// 공유 스택에서 의도적으로 돌릴 때(조정 세션 전용)만 ALLOW_SHARED_TEST_DB=1 + SHARED_TEST_DB_NOTE="coordinator-approved: <사유>"로 통과.
const SHARED_PORTS = new Set([54320, 54321, 54322, 54323, 54324, 54325, 54327, 54329, ...Array.from({ length: 10 }, (_, i) => 54420 + i)]);

// 조정 세션 전용 우회. 사유는 "coordinator-approved: <8자 이상 사유>" 형식이어야 한다(에이전트·자동화 편의용 아님).
const NOTE_RX = /^coordinator-approved:\s*\S.{7,}$/i;
export type GuardResult = { ok: true } | { ok: false; reasons: string[] };

function portOf(url: string): number | null {
  const m = url.match(/:(\d{2,5})(?:[/?#]|$)/);
  return m ? Number(m[1]) : null;
}
export function isSharedStackUrl(url: string): boolean {
  const p = portOf(url);
  return p !== null && SHARED_PORTS.has(p);
}

export function checkIntegrationTarget(env: Record<string, string | undefined>): GuardResult {
  if (env.ALLOW_SHARED_TEST_DB === "1" && NOTE_RX.test((env.SHARED_TEST_DB_NOTE ?? "").trim())) return { ok: true };
  const reasons: string[] = [];
  for (const k of ["SUPABASE_TEST_DB_URL", "SUPABASE_TEST_API_URL"] as const) {
    const v = env[k]?.trim();
    if (!v) reasons.push(`${k} 미지정 — 테스트가 공유 로컬 스택(54422/54421)으로 폴백해 쓰기를 한다.`);
    else if (isSharedStackUrl(v)) reasons.push(`${k}=${v} 은 공유 스택(544xx 계열)을 가리킨다.`);
  }
  return reasons.length ? { ok: false, reasons } : { ok: true };
}

export function integrationGuardMessage(reasons: string[]): string {
  return `통합 테스트 중단(시작 전): ${reasons.join(" ")} 격리 스택(scripts/dev/isolated-stack.sh start ALTON_<이름>)을 띄우고 SUPABASE_TEST_DB_URL·SUPABASE_TEST_API_URL 을 그 포트로 지정하라. 조정 세션이 공유 스택에서 의도적으로 돌릴 때만 ALLOW_SHARED_TEST_DB=1 SHARED_TEST_DB_NOTE="coordinator-approved: <사유 8자 이상>" (조정 세션 전용 — 에이전트/자동화 편의용 우회가 아니다).`;
}
