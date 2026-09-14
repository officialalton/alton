import { createAdminClient } from "@/lib/supabase-admin";
import { computePayoutAmounts, type MissingRatePayoutSkip, type PayoutPeriod } from "./payouts-data";

// R10 corrective(2026-09-07, 제품 오너 리뷰 요구사항 3) — 이 함수는 더 이상
// teacher_payouts에 아무것도 쓰지 않는다(no-op/읽기 전용). 라우트/Vercel cron
// 등록을 제거한 것만으로는 부족하다는 지적에 따라, 이 함수 자체를 실제로
// 안전하게 만든다: computePayoutAmounts()로 금액만 계산해 반환하고
// teacher_payouts insert/update/upsert/delete는 전혀 호출하지 않는다.
// v3 payout_batches(generate_payout_batches RPC, payout-batches-actions.ts)가
// 실제 정산 배치 생성 경로다. 레거시 teacher_payouts 테이블은 R13 전까지
// 읽기 전용으로 보존한다(docs/CURRENT.md 참고) — DB 레벨에서도
// 20261224000000 마이그레이션이 authenticated/anon의 insert/update/delete
// grant를 명시적으로 revoke했다. 이 파일이 다시 write 경로를 추가하지 않는지는
// lib/legacy-teacher-payouts-write-guard.test.ts의 정적 grep 테스트가
// 회귀 가드로 강제한다.
//
// 이 파일은 "use server"가 아니다 — Next.js Route Handler(app/api/cron/generate-payouts/route.ts)에서만
// import되는 순수 서버 모듈이다("use server" 파일에 있으면 인증 없이 직접 호출 가능해지는 문제는
// payouts-actions.ts 주석 참고, 지금은 무의미해졌지만 구조는 그대로 유지).
export async function runGeneratePayouts(
  admin: ReturnType<typeof createAdminClient>,
  period: PayoutPeriod
): Promise<{ created: number; skippedNoRate: MissingRatePayoutSkip[] }> {
  const { skipped } = await computePayoutAmounts(admin, period);
  // 의도적으로 teacher_payouts에 대한 select/insert/update/upsert/delete를
  // 전혀 하지 않는다 — v3 payout_batches로 완전히 대체됐다(created는 항상 0).
  void admin;
  return { created: 0, skippedNoRate: skipped };
}

// Vercel Cron에서 다시 예약 호출되더라도(app/api/cron/generate-payouts/route.ts는
// 이미 410 no-op을 반환하지만, 만에 하나 이 함수가 다른 경로에서 직접
// import되더라도) 항상 no-op이다.
export async function generatePayoutsAsCron(
  period: PayoutPeriod
): Promise<{ created: number; skippedNoRate: MissingRatePayoutSkip[] }> {
  const admin = createAdminClient();
  return runGeneratePayouts(admin, period);
}
