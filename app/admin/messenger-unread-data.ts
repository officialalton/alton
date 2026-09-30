import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * 사이드바 Messenger 배지용 가벼운 집계(Messenger 탭이 아닌 화면에서만 사용).
 * 정의는 listInquiryThreadsForAdmin의 unreadForAdmin과 동일: 열린 문의 중
 * 보호자 메시지가 관리자 last_read_at(household 단위)보다 새로운 문의 수.
 * 쿼리 2건(읽음 행 + 열린 문의의 보호자 메시지 3컬럼)만 쓴다.
 * 관리자 쪽 Teachers/Consultants 채널은 읽음 추적이 없어(안읽음 UI도 없음) 제외.
 */
export async function countAdminFamilyUnread(admin: SupabaseClient): Promise<number> {
  const [{ data: reads }, { data: msgs }] = await Promise.all([
    admin.from("household_message_reads").select("household_id, last_read_at").eq("viewer_role", "admin"),
    admin
      .from("household_messages")
      .select("inquiry_id, household_id, created_at, inquiry:household_inquiries!inner(status)")
      .eq("sender_role", "guardian")
      .eq("inquiry.status", "open"),
  ]);
  const lastRead = new Map<string, string>((reads ?? []).map((r) => [r.household_id as string, r.last_read_at as string]));
  return countUnreadInquiries(
    (msgs ?? []).map((m) => ({ inquiryId: m.inquiry_id as string, householdId: m.household_id as string, createdAt: m.created_at as string })),
    lastRead
  );
}

export function countUnreadInquiries(
  guardianMessages: { inquiryId: string; householdId: string; createdAt: string }[],
  lastReadByHousehold: Map<string, string>
): number {
  const unread = new Set<string>();
  for (const m of guardianMessages) {
    const lr = lastReadByHousehold.get(m.householdId);
    if (!lr || m.createdAt > lr) unread.add(m.inquiryId);
  }
  return unread.size;
}
