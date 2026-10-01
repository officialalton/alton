"use client";

import { recordManualGuardianConsent } from "./consent-actions";
import { invalidateConsentCaches } from "./consent-cache";

// P4-3 2단계 보완 — 동의 상태를 바꾸는 동작과 캐시 무효화를 한데 묶는다.
//
// 서버 액션은 클라이언트 캐시를 비울 수 없다. 그렇다고 호출하는 화면마다
// "성공하면 무효화도 부르기"를 기억하게 두면 언젠가 빠진다 — 그러면 동의를
// 등록했는데 목록에는 여전히 "대기"로 남는다.
//
// 그래서 변경 동작을 부르는 경로를 여기 하나로 모은다. 화면은 이 함수만
// 부르고, 무효화는 여기서 항상 함께 일어난다.
//
// 현재 이 동작을 부르는 관리자 화면은 아직 없다(수동 동의 등록 UI는 R12 후속
// 항목이다). 그 UI가 붙을 때 이 함수를 부르면 캐시 갱신이 자동으로 따라온다.
export async function recordManualGuardianConsentAndRefresh(params: {
  studentId: string;
  policyVersionId: string;
  consentedBy: string;
  verificationReference: string;
}): Promise<void> {
  await recordManualGuardianConsent(params);
  // 성공했을 때만 무효화한다 — 실패했는데 다시 읽게 만들 이유가 없다.
  invalidateConsentCaches();
}
