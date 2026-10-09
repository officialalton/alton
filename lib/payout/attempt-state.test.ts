import { describe, expect, it } from "vitest";
import { ATTEMPT_STATUSES, canTransition, isPayoutCompleted } from "./attempt-state";

describe("지급 시도 상태 기계", () => {
  it("sent가 지급 완료다(수취 확인 단계 폐지). 처리 중·승인 대기는 완료가 아니다", () => {
    expect(isPayoutCompleted("sent")).toBe(true);
    expect(isPayoutCompleted("processing")).toBe(false);
    expect(isPayoutCompleted("awaiting_mercury_approval")).toBe(false);
    expect(isPayoutCompleted("returned")).toBe(false);
  });
  it("sent 뒤에는 반환·실패·검토만 가능하고 수취 확인 상태로는 새로 갈 수 없다", () => {
    expect(canTransition("sent", "returned")).toBe(true);
    expect(canTransition("sent", "receipt_confirmed")).toBe(false);
    expect(canTransition("processing", "receipt_confirmed")).toBe(false);
  });
  it("종료 상태에서는 어디로도 갈 수 없다", () => {
    for (const s of ["failed", "returned", "cancelled"] as const) {
      for (const t of ATTEMPT_STATUSES) expect(canTransition(s, t)).toBe(false);
    }
  });
  it("legacy receipt_confirmed 행도 반환은 기록할 수 있다", () => {
    expect(canTransition("receipt_confirmed", "returned")).toBe(true);
    expect(canTransition("receipt_confirmed", "failed")).toBe(false);
  });
  it("승인 단계를 건너뛰어 sent로 갈 수 없다", () => {
    expect(canTransition("queued", "sent")).toBe(false);
  });
});
