import type { SupabaseClient } from "@supabase/supabase-js";

export type MessengerUnreadCounts = { teachers: number; consultants: number; family: number };

/**
 * 사이드바 Messenger 배지용 집계 — 선생님·컨설턴트·가족 세 채널의 안읽음 문의 수를
 * SQL 함수 1회(admin_messenger_unread_counts, service_role 전용)로 가져온다.
 * 정의: 열린 문의 중 상대측(선생님/컨설턴트/보호자) 메시지가 관리자 읽음 시각보다 새로운 문의.
 */
export async function getAdminMessengerUnreadCounts(admin: SupabaseClient): Promise<MessengerUnreadCounts> {
  const { data, error } = await admin.rpc("admin_messenger_unread_counts");
  if (error) throw new Error(error.message);
  const row = (Array.isArray(data) ? data[0] : data) as Partial<MessengerUnreadCounts> | null;
  return { teachers: row?.teachers ?? 0, consultants: row?.consultants ?? 0, family: row?.family ?? 0 };
}

export function totalMessengerUnread(c: MessengerUnreadCounts): number {
  return c.teachers + c.consultants + c.family;
}
