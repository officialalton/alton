// 수취 계좌 표시용 마스킹 — 교사·컨설턴트 공용. 전체 번호는 어떤 목록·응답에도 넣지 않는다.
export function maskLast4(last4: string): string {
  return `****${last4}`;
}

export function last4Of(accountNumber: string): string {
  const digits = accountNumber.replace(/\D/g, "");
  const source = digits.length > 0 ? digits : accountNumber;
  return source.slice(-4);
}
