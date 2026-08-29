"use server";

import { createAdminClient } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/admin-auth";
import { sendEmail } from "@/lib/email";
import {
  computePayoutAmounts,
  type MissingRatePayoutSkip,
  type PayoutPeriod,
} from "./payouts-data";

// auth.users에만 이메일이 있고 profiles에는 없다 (supabase/migrations/20260827120000_initial_schema.sql).
// app/teacher/review/[sessionId]/review-actions.ts에서 이미 쓰는 것과 같은 패턴으로
// service_role 클라이언트의 auth.admin.getUserById로 조회한다.
async function loadEmailById(admin: ReturnType<typeof createAdminClient>, userId: string): Promise<string | null> {
  const { data } = await admin.auth.admin.getUserById(userId);
  return data.user?.email ?? null;
}

export async function generatePayouts(
  period: PayoutPeriod
): Promise<{ created: number; skippedNoRate: MissingRatePayoutSkip[] }> {
  await requireAdmin();
  const admin = createAdminClient();

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

export async function markPayoutPaid(id: string): Promise<void> {
  const { adminUserId } = await requireAdmin();
  const admin = createAdminClient();

  const { data: payout } = await admin
    .from("teacher_payouts")
    .select("teacher_id, amount_krw")
    .eq("id", id)
    .single();
  if (!payout) throw new Error("정산 내역을 찾을 수 없습니다.");

  const { error } = await admin
    .from("teacher_payouts")
    .update({ status: "paid", paid_at: new Date().toISOString(), approved_by: adminUserId })
    .eq("id", id);
  if (error) throw new Error(error.message);

  const email = await loadEmailById(admin, payout.teacher_id);
  if (email) {
    await sendEmail({
      to: email,
      subject: "[Alton Education] 정산이 완료됐습니다",
      html: `<p>이번 정산(${payout.amount_krw.toLocaleString()}원) 지급이 완료됐습니다. 감사합니다.</p>`,
    });
  }
}

export async function markPayoutsPaidBulk(ids: string[]): Promise<void> {
  for (const id of ids) {
    await markPayoutPaid(id);
  }
}

export async function revertPayoutToPending(id: string): Promise<void> {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin
    .from("teacher_payouts")
    .update({ status: "pending", paid_at: null, approved_by: null })
    .eq("id", id);
  if (error) throw new Error(error.message);
}
