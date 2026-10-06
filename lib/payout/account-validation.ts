// 수취 계좌 입력 검증(교사 최초 등록·관리자 대리 입력 공용). 결제 수단은 은행 송금뿐이다.
//  * KRW(한국): 은행명 + 계좌번호(숫자 8~16자리). SWIFT 선택.
//  * USD(미국): ABA 라우팅 번호 9자리 + 계좌번호(숫자 4~17자리). 라우팅은 swiftOrRouting 필드에 둔다.
// 오류 문구는 교사 화면(영어)과 관리자 화면(한국어)에서 같이 쓸 수 있도록 code로도 돌려준다.

export const PAYOUT_ACCOUNT_CURRENCIES = ["KRW", "USD"] as const;
export type PayoutAccountCurrency = (typeof PAYOUT_ACCOUNT_CURRENCIES)[number];

export type PayoutAccountInputRaw = {
  accountHolderName: string;
  bankName: string;
  accountNumber: string;
  currency: string;
  country?: string;
  swiftOrRouting?: string;
};

export type ValidatedPayoutAccount = {
  accountHolderName: string;
  bankName: string;
  accountNumber: string;
  currency: PayoutAccountCurrency;
  country: string;
  swiftOrRouting: string | null;
};

export type PayoutAccountValidation =
  | { ok: true; value: ValidatedPayoutAccount }
  | { ok: false; code: string; message: string };

/** ABA 라우팅 번호 체크섬: 3·7·1 가중치(3(d1+d4+d7)+7(d2+d5+d8)+(d3+d6+d9)) mod 10 == 0. */
export function isValidAbaRoutingNumber(routing: string): boolean {
  if (!/^\d{9}$/.test(routing)) return false;
  const d = routing.split("").map(Number);
  const sum = 3 * (d[0] + d[3] + d[6]) + 7 * (d[1] + d[4] + d[7]) + (d[2] + d[5] + d[8]);
  return sum % 10 === 0;
}

export function validatePayoutAccountInput(input: PayoutAccountInputRaw): PayoutAccountValidation {
  const accountHolderName = input.accountHolderName.trim();
  const bankName = input.bankName.trim();
  const accountNumber = input.accountNumber.trim();
  const currency = (input.currency || "").trim().toUpperCase();
  const country = (input.country ?? "").trim();
  const swiftOrRouting = (input.swiftOrRouting ?? "").trim();
  const digits = accountNumber.replace(/[\s-]/g, "");

  if (!accountHolderName) return { ok: false, code: "holder", message: "Please enter the account holder name." };
  if (!bankName) return { ok: false, code: "bank", message: "Please enter the bank name." };
  if (!(PAYOUT_ACCOUNT_CURRENCIES as readonly string[]).includes(currency)) {
    return { ok: false, code: "currency", message: "Please choose KRW or USD." };
  }
  if (!country) return { ok: false, code: "country", message: "Please enter the country of the bank account." };
  if (!/^\d+$/.test(digits)) return { ok: false, code: "account_digits", message: "The account number must contain digits only (spaces and hyphens are ignored)." };

  if (currency === "KRW") {
    if (digits.length < 8 || digits.length > 16) {
      return { ok: false, code: "account_length", message: "A Korean account number must be 8–16 digits." };
    }
  } else {
    const routing = swiftOrRouting.replace(/[\s-]/g, "");
    if (!/^\d{9}$/.test(routing)) return { ok: false, code: "routing", message: "A U.S. account needs a 9-digit ABA routing number." };
    if (!isValidAbaRoutingNumber(routing)) return { ok: false, code: "routing_checksum", message: "That ABA routing number does not look valid. Please check it and try again." };
    if (digits.length < 4 || digits.length > 17) {
      return { ok: false, code: "account_length", message: "A U.S. account number must be 4–17 digits." };
    }
    return { ok: true, value: { accountHolderName, bankName, accountNumber: digits, currency: "USD", country, swiftOrRouting: routing } };
  }
  return {
    ok: true,
    value: { accountHolderName, bankName, accountNumber: digits, currency: "KRW", country, swiftOrRouting: swiftOrRouting || null },
  };
}

/** 관리자 화면(한국어)용 오류 문구. */
export const PAYOUT_ACCOUNT_ERROR_KO: Record<string, string> = {
  holder: "예금주를 입력해주세요.",
  bank: "은행명을 입력해주세요.",
  currency: "통화는 KRW 또는 USD만 가능합니다.",
  country: "계좌가 있는 국가를 입력해주세요.",
  account_digits: "계좌번호는 숫자만 입력해주세요(공백·하이픈은 무시됩니다).",
  account_length: "계좌번호 자릿수가 맞지 않습니다(KRW 8~16자리, USD 4~17자리).",
  routing: "USD 계좌는 9자리 ABA 라우팅 번호가 필요합니다.",
  routing_checksum: "ABA 라우팅 번호가 유효하지 않습니다(체크섬 불일치). 번호를 다시 확인해주세요.",
};
