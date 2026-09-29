// Digital SAT 4모듈 MST 응시 — 모듈 순서·라벨·시간 계산 순수 함수.
// 계획: docs/2026-09-28-sat-adaptive-mock-exam-redesign-plan.md. 적응형 경로(higher/lower)는
// 어떤 라벨·문구에도 노출하지 않는다(Phase 3에서도 내부 감사 컬럼으로만 저장).

export type MstModuleKey = "rw_m1" | "rw_m2" | "break" | "math_m1" | "math_m2";

export const MST_MODULE_ORDER: MstModuleKey[] = ["rw_m1", "rw_m2", "break", "math_m1", "math_m2"];

export const MST_MODULE_LABELS: Record<MstModuleKey, string> = {
  rw_m1: "Reading and Writing · Module 1",
  rw_m2: "Reading and Writing · Module 2",
  break: "휴식",
  math_m1: "Math · Module 1",
  math_m2: "Math · Module 2",
};

// Digital SAT 청사진(문항 수·초). 관리자 조립·시작 RPC 기본값과 같다.
export const MST_BLUEPRINT: Record<MstModuleKey, { itemCount: number; timeLimitSeconds: number; section: "rw" | "math" | null }> = {
  rw_m1: { itemCount: 27, timeLimitSeconds: 32 * 60, section: "rw" },
  rw_m2: { itemCount: 27, timeLimitSeconds: 32 * 60, section: "rw" },
  break: { itemCount: 0, timeLimitSeconds: 10 * 60, section: null },
  math_m1: { itemCount: 22, timeLimitSeconds: 35 * 60, section: "math" },
  math_m2: { itemCount: 22, timeLimitSeconds: 35 * 60, section: "math" },
};

export function mstSection(key: MstModuleKey): "rw" | "math" | null {
  return MST_BLUEPRINT[key].section;
}

// Digital SAT 정책(2026-09-28 제품 오너 확정): 계산기·참조표는 Math 두 모듈에서만.
export function mstMathToolsAllowed(key: MstModuleKey): boolean {
  return mstSection(key) === "math";
}

export function nextMstModule(key: MstModuleKey): MstModuleKey | null {
  const i = MST_MODULE_ORDER.indexOf(key);
  return i >= 0 && i < MST_MODULE_ORDER.length - 1 ? MST_MODULE_ORDER[i + 1] : null;
}

// 서버가 준 remainingSeconds에서 fetch 이후 경과한 클라이언트 시간만 뺀다 — 절대 시각은 서버만
// 신뢰하고(만료·잠금은 RPC가 now()로 판정) 클라이언트 시계는 경과량 측정에만 쓴다.
export function mstRemainingSecondsAt(serverRemainingSeconds: number, fetchedAtMs: number, nowMs: number): number {
  const elapsed = Math.max(0, nowMs - fetchedAtMs);
  return Math.max(0, Math.floor(serverRemainingSeconds - elapsed / 1000));
}

export function formatMstClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export const MST_TIME_WARNING_SECONDS = 5 * 60;
