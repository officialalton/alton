import { describe, expect, it } from "vitest";
import { ATTEMPT_STATUSES, canTransition, isPayoutCompleted } from "./attempt-state";

describe("지급 시도 상태 기계", () => {
  it("sent는 지급 완료가 아니고 receipt_confirmed만 완료다", () => {
    expect(isPayoutCompleted("sent")).toBe(false);
    expect(isPayoutCompleted("processing")).toBe(false);
    expect(isPayoutCompleted("receipt_confirmed")).toBe(true);
  });
  it("종료 상태에서는 어디로도 갈 수 없다", () => {
    for (const s of ["failed", "returned", "cancelled"] as const) {
      for (const t of ATTEMPT_STATUSES) expect(canTransition(s, t)).toBe(false);
    }
  });
  it("수취 확인 뒤에도 반환은 기록할 수 있다", () => {
    expect(canTransition("receipt_confirmed", "returned")).toBe(true);
    expect(canTransition("receipt_confirmed", "failed")).toBe(false);
  });
  it("승인 단계를 건너뛰어 sent로 갈 수 없다", () => {
    expect(canTransition("queued", "sent")).toBe(false);
    expect(canTransition("queued", "receipt_confirmed")).toBe(false);
  });
});
