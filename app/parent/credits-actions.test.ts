import { describe, expect, it } from "vitest";

describe("createCreditCheckoutSession (레거시, R4 전환 이후 차단)", () => {
  it("신규 결제 세션 생성을 시도하면 항상 에러를 던진다", async () => {
    const { createCreditCheckoutSession } = await import("./credits-actions");
    await expect(createCreditCheckoutSession("p1", "s1")).rejects.toThrow(
      "The legacy payment path was disabled after the R4 transition"
    );
  });
});
