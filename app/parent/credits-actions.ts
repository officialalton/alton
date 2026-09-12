"use server";

/**
 * 레거시 크레딧 결제 경로 (credit_purchases 기반) — R4(수업권/결제 원장) 전환 이후
 * 신규 결제 세션 생성을 차단한다. 기존 레거시 데이터 조회/웹훅 처리는 그대로 유지되며,
 * 실제 제거는 오픈 전 정리 단계로 이관되었다.
 */
export async function createCreditCheckoutSession(
  _packageId: string,
  _studentId: string
): Promise<string> {
  throw new Error(
    "레거시 결제 경로는 R4 전환 이후 비활성화되었습니다 — 수업권 구매 탭을 이용해주세요."
  );
}
