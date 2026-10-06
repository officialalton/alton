import { describe, expect, it } from "vitest";
import { validatePayoutAccountInput } from "./account-validation";

const base = { accountHolderName: "Kim Teacher", bankName: "Kookmin Bank", country: "KR" };

describe("validatePayoutAccountInput", () => {
  it("KRW: 숫자 8~16자리 계좌번호 + 은행명이면 통과(하이픈·공백 무시), SWIFT는 선택", () => {
    const r = validatePayoutAccountInput({ ...base, accountNumber: "110-123-456789", currency: "krw" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toMatchObject({ accountNumber: "110123456789", currency: "KRW", swiftOrRouting: null });
  });
  it("KRW: 너무 짧거나 숫자가 아니면 거부", () => {
    expect(validatePayoutAccountInput({ ...base, accountNumber: "1234567", currency: "KRW" })).toMatchObject({ ok: false, code: "account_length" });
    expect(validatePayoutAccountInput({ ...base, accountNumber: "12AB5678", currency: "KRW" })).toMatchObject({ ok: false, code: "account_digits" });
  });
  it("USD: ABA 9자리 라우팅 필수", () => {
    const ok = validatePayoutAccountInput({ ...base, country: "US", accountNumber: "000123456789", currency: "USD", swiftOrRouting: "021000021" });
    expect(ok.ok).toBe(true);
    expect(validatePayoutAccountInput({ ...base, country: "US", accountNumber: "000123456789", currency: "USD", swiftOrRouting: "12345" })).toMatchObject({ ok: false, code: "routing" });
    expect(validatePayoutAccountInput({ ...base, country: "US", accountNumber: "000123456789", currency: "USD" })).toMatchObject({ ok: false, code: "routing" });
  });
  it("USD: 계좌번호 4~17자리", () => {
    expect(validatePayoutAccountInput({ ...base, country: "US", accountNumber: "123", currency: "USD", swiftOrRouting: "021000021" })).toMatchObject({ ok: false, code: "account_length" });
    expect(validatePayoutAccountInput({ ...base, country: "US", accountNumber: "1".repeat(18), currency: "USD", swiftOrRouting: "021000021" })).toMatchObject({ ok: false, code: "account_length" });
  });
  it("예금주·은행·국가·통화는 필수, KRW/USD만 허용", () => {
    expect(validatePayoutAccountInput({ ...base, accountHolderName: " ", accountNumber: "11012345678", currency: "KRW" })).toMatchObject({ ok: false, code: "holder" });
    expect(validatePayoutAccountInput({ ...base, bankName: "", accountNumber: "11012345678", currency: "KRW" })).toMatchObject({ ok: false, code: "bank" });
    expect(validatePayoutAccountInput({ ...base, country: "", accountNumber: "11012345678", currency: "KRW" })).toMatchObject({ ok: false, code: "country" });
    expect(validatePayoutAccountInput({ ...base, accountNumber: "11012345678", currency: "EUR" })).toMatchObject({ ok: false, code: "currency" });
  });
});
