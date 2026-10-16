import { sendGuardianLinkReminderEmail } from "./emails";

// 2026-10-05 무료 회원 S4 — 일일 크론 단계(기존 /api/cron/mark-expired-invites에 합류, 새 크론 항목 없음 — Vercel Hobby).
//   1) mark_expired_guardian_link_invites(): pending·만료 → expired(+관심 expired)
//   2) list_guardian_link_reminder_candidates(): 초대 3일 미수락 1회, 수락 2일 미예약 1회(최대 2회, 오너 결정 7-14)
//      → sendEmail → mark_guardian_link_reminder_sent. 발송 실패는 기록하지 않아 다음날 재시도된다.
type AdminRpc = { rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }> };

export type GuardianLinkCronResult = { expiredCount: number; remindersSent: number; remindersFailed: number; error?: string };

export async function runGuardianLinkDailyStep(admin: AdminRpc, origin: string): Promise<GuardianLinkCronResult> {
  const result: GuardianLinkCronResult = { expiredCount: 0, remindersSent: 0, remindersFailed: 0 };
  const expired = await admin.rpc("mark_expired_guardian_link_invites");
  if (expired.error) {
    console.error(JSON.stringify({ event: "guardian_link_expire_failed", error: expired.error.message }));
    result.error = expired.error.message;
    return result;
  }
  result.expiredCount = typeof expired.data === "number" ? expired.data : 0;

  const candidates = await admin.rpc("list_guardian_link_reminder_candidates");
  if (candidates.error) {
    console.error(JSON.stringify({ event: "guardian_link_reminder_list_failed", error: candidates.error.message }));
    result.error = candidates.error.message;
    return result;
  }
  const rows = (Array.isArray(candidates.data) ? candidates.data : []) as Array<{
    invite_id: string; kind: "unaccepted" | "unbooked"; email: string; student_first_name: string | null; scheduling_token: string | null;
  }>;
  for (const row of rows) {
    try {
      if (row.kind === "unaccepted") {
        // 원시 토큰은 저장하지 않는다 — 리마인더용 새 세대 토큰을 발급(이전 링크 superseded, 만료·쿼터는 그대로).
        const rotated = await admin.rpc("issue_guardian_link_reminder_token", { p_invite_id: row.invite_id });
        const r = (Array.isArray(rotated.data) ? rotated.data[0] : rotated.data) as { raw_token?: string } | null;
        if (rotated.error || !r?.raw_token) throw new Error(rotated.error?.message ?? "token rotation failed");
        await sendGuardianLinkReminderEmail({ to: row.email, kind: "unaccepted", studentFirstName: row.student_first_name ?? "", url: `${origin}/guardian-link/${r.raw_token}` });
      } else {
        if (!row.scheduling_token) continue;
        await sendGuardianLinkReminderEmail({ to: row.email, kind: "unbooked", studentFirstName: row.student_first_name ?? "", url: `${origin}/schedule/${row.scheduling_token}` });
        const marked = await admin.rpc("mark_guardian_link_reminder_sent", { p_invite_id: row.invite_id, p_kind: "unbooked" });
        if (marked.error) console.error(JSON.stringify({ event: "guardian_link_reminder_mark_failed", inviteId: row.invite_id, error: marked.error.message }));
      }
      result.remindersSent += 1;
    } catch (e) {
      result.remindersFailed += 1;
      console.error(JSON.stringify({ event: "guardian_link_reminder_send_failed", inviteId: row.invite_id, error: e instanceof Error ? e.message : String(e) }));
    }
  }
  console.log(JSON.stringify({ event: "guardian_link_daily_step_ran", ...result }));
  return result;
}
