import { describe, expect, it } from "vitest";

describe("createCreditCheckoutSession (레거시, R4 전환 이후 차단)", () => {
  it("신규 결제 세션 생성을 시도하면 항상 에러를 던진다", async () => {
    const { createCreditCheckoutSession } = await import("./credits-actions");
    await expect(createCreditCheckoutSession("p1", "s1")).rejects.toThrow(
      "레거시 결제 경로는 R4 전환 이후 비활성화되었습니다"
    );
  });
});
