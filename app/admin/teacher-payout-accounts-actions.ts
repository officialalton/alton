"use server";

// P4-2 — 관리자 `정산` > `수취 계좌` 목록.
//
// 확정 정책:
//  * 교사 본인이 등록·수정하는 것과 **같은 원본**(teacher_payout_accounts)을 읽는다 —
//    관리자용 별도 사본을 만들지 않는다.
//  * 관리자도 전체 계좌번호를 받지 못한다 — 교사 화면과 **같은 마스킹**을 쓴다
//    (app/teacher/settlement-actions.ts의 maskAccountNumber).
//  * 관리자는 조회 전용이다. 값 수정은 교사 본인만 한다(이 파일에 쓰기 액션 없음).

import { requireAdminOrCapability } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-admin";
import { maskAccountNumber } from "@/app/teacher/settlement-data";

const PAYOUT_CAPABILITY = "정산권한";

export type TeacherPayoutAccountChange = {
  id: string;
  action: string;
  changedFields: string[];
  previousLast4: string | null;
  newLast4: string | null;
  createdAt: string;
};

export type TeacherPayoutAccountListItem = {
  teacherId: string;
  teacherName: string;
  accountHolderName: string;
  bankName: string;
  accountNumberMasked: string;
  currency: string;
  country: string | null;
  updatedAt: string;
  changes: TeacherPayoutAccountChange[];
};

export async function listTeacherPayoutAccountsAction(): Promise<TeacherPayoutAccountListItem[]> {
  await requireAdminOrCapability(PAYOUT_CAPABILITY);
  const admin = createAdminClient();

  // account_number(전체)는 select 하지 않는다 — 서버 메모리에도 올리지 않는다.
  const { data: accounts, error } = await admin
    .from("teacher_payout_accounts")
    .select("teacher_id, account_holder_name, bank_name, account_number_last4, currency, country, updated_at")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  if (!accounts?.length) return [];

  const teacherIds = accounts.map((a) => a.teacher_id as string);
  const [{ data: profiles, error: profilesError }, { data: events, error: eventsError }] = await Promise.all([
    admin.from("profiles").select("id, name").in("id", teacherIds),
    admin
      .from("teacher_payout_account_events")
      .select("id, teacher_id, action, changed_fields, previous_last4, new_last4, created_at")
      .in("teacher_id", teacherIds)
      .order("created_at", { ascending: false }),
  ]);
  if (profilesError) throw new Error(profilesError.message);
  if (eventsError) throw new Error(eventsError.message);

  const nameById = new Map((profiles ?? []).map((p) => [p.id as string, (p.name as string) ?? ""]));
  const changesByTeacher = new Map<string, TeacherPayoutAccountChange[]>();
  for (const e of events ?? []) {
    const list = changesByTeacher.get(e.teacher_id as string) ?? [];
    list.push({
      id: e.id as string,
      action: e.action as string,
      changedFields: (e.changed_fields as string[]) ?? [],
      previousLast4: (e.previous_last4 as string | null) ?? null,
      newLast4: (e.new_last4 as string | null) ?? null,
      createdAt: e.created_at as string,
    });
    changesByTeacher.set(e.teacher_id as string, list);
  }

  return accounts.map((a) => ({
    teacherId: a.teacher_id as string,
    teacherName: nameById.get(a.teacher_id as string) ?? "",
    accountHolderName: a.account_holder_name as string,
    bankName: a.bank_name as string,
    accountNumberMasked: maskAccountNumber(a.account_number_last4 as string),
    currency: a.currency as string,
    country: (a.country as string | null) ?? null,
    updatedAt: a.updated_at as string,
    changes: changesByTeacher.get(a.teacher_id as string) ?? [],
  }));
}
