import { createAdminClient } from "@/lib/supabase-admin";
import { computePayoutAmounts, type MissingRatePayoutSkip, type PayoutPeriod } from "./payouts-data";

// 이 파일은 "use server"가 아니다 — Next.js Route Handler(app/api/cron/generate-payouts/route.ts)에서만
// import되는 순수 서버 모듈이다. "use server" 파일에 있으면 클라이언트 번들이 참조하는 모든 export가
// Server Action으로 등록되어 인증 없이 직접 호출 가능해지므로, CRON_SECRET 검증을 우회할 수 있었다.
// (자세한 내용은 payouts-actions.ts의 generatePayouts 주석 참고)
export async function runGeneratePayouts(
  admin: ReturnType<typeof createAdminClient>,
  period: PayoutPeriod
): Promise<{ created: number; skippedNoRate: MissingRatePayoutSkip[] }> {
  const { amounts, skipped } = await computePayoutAmounts(admin, period);

  let created = 0;
  for (const a of amounts) {
    const { data: existing } = await admin
      .from("teacher_payouts")
      .select("id")
      .eq("teacher_id", a.teacherId)
      .eq("period_start", period.periodStart)
      .eq("period_end", period.periodEnd);
    if (existing && existing.length > 0) continue;

    const { error } = await admin.from("teacher_payouts").insert({
      teacher_id: a.teacherId,
      amount_krw: a.amountKrw,
      period_start: period.periodStart,
      period_end: period.periodEnd,
      status: "pending",
    });
    if (error) throw new Error(error.message);
    created += 1;
  }

  return { created, skippedNoRate: skipped };
}

// Vercel Cron에서만 호출: 요청 자체가 CRON_SECRET 헤더로 이미 인증되어 있으므로
// (app/api/cron/generate-payouts/route.ts 참고) 로그인 세션이 없어도 동작해야 한다.
// requireAdmin()은 브라우저 세션 쿠키에 의존하므로 여기서는 쓸 수 없고, 대신
// service_role 권한의 admin 클라이언트로 직접 실행한다.
//
// 이 함수는 반드시 Route Handler에서만 import해야 한다 — "use server" 파일(payouts-actions.ts)에
// 두면 클라이언트 번들에 Server Action으로 등록되어, 빌드된 JS에서 액션 ID를 알아낸 누구나
// CRON_SECRET 검증 없이 임의 period로 직접 호출할 수 있게 된다.
export async function generatePayoutsAsCron(
  period: PayoutPeriod
): Promise<{ created: number; skippedNoRate: MissingRatePayoutSkip[] }> {
  const admin = createAdminClient();
  return runGeneratePayouts(admin, period);
}
