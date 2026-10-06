"use server";

// 관리자 `정산` > `수취 계좌`.
//
// 정책(2026-10-06 오너 확정 — 종전 "관리자도 마스킹만, 조회 전용" 정책을 대체한다):
//  * 목록에는 마스킹된 값(끝 4자리)만 담는다. 전체 번호·SWIFT/라우팅은 목록 payload에 절대 넣지 않는다.
//  * 교사는 최초 1회만 등록한다. 이후 수정은 **마스터 관리자 또는 정산권한 보유자**가 교사를 대신해 입력한다
//    (회의에서 받은 정보). 변경마다 이력(처리자·바뀐 필드·끝 4자리)과 교사 인앱 알림이 남는다.
//  * 전체 번호는 명시적 '전체 번호 보기'(reveal) 액션으로만 내려가며, 호출마다 감사 행(처리자·교사·시각·사유 — 번호 제외)이
//    DB 함수 안에서 남는다. 응답 값은 화면에서 일시적으로만 보여 준다(서버는 로그·이력에 번호를 남기지 않는다).
//  * 암호화·권한·감사의 최종 방어선은 DB 함수(save_/reveal_teacher_payout_account)다.

import { requireAdminOrCapability, requirePayoutAccountStaff } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-admin";
import { maskAccountNumber } from "@/app/teacher/settlement-data";
import { selectInChunks, orderComparator } from "@/lib/select-in-chunks";
import { PAYOUT_ACCOUNT_ERROR_KO, validatePayoutAccountInput, type PayoutAccountInputRaw } from "@/lib/payout/account-validation";

const PAYOUT_CAPABILITY = "정산권한";

export type TeacherPayoutAccountChange = {
  id: string;
  action: string;
  changedFields: string[];
  previousLast4: string | null;
  newLast4: string | null;
  enteredByAdmin: boolean;
  createdAt: string;
};


export type TeacherPayoutAccountListItem = {
  teacherId: string;
  teacherName: string;
  /** false면 교사가 아직 등록하지 않은 상태(교사 포털에 등록 단계가 보인다). */
  registered: boolean;
  accountHolderName: string;
  bankName: string;
  accountNumberMasked: string;
  swiftOrRoutingMasked: string | null;
  currency: string;
  country: string | null;
  enteredByAdmin: boolean;
  updatedAt: string | null;
  changes: TeacherPayoutAccountChange[];
};

export async function listTeacherPayoutAccountsAction(): Promise<TeacherPayoutAccountListItem[]> {
  await requireAdminOrCapability(PAYOUT_CAPABILITY);
  const admin = createAdminClient();

  // account_number(전체)는 select 하지 않는다 — 서버 메모리에도 올리지 않는다.
  const { data: accounts, error } = await admin
    .from("teacher_payout_accounts")
    .select("teacher_id, account_holder_name, bank_name, account_number_last4, swift_or_routing_last4, currency, country, entered_by_admin, updated_at")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);

  // 아직 등록하지 않은 교사도 '미등록'으로 보여 준다.
  const { data: allTeachers, error: teachersError } = await admin.from("profiles").select("id, name").eq("role", "teacher");
  if (teachersError) throw new Error(teachersError.message);
  const registeredIds = new Set((accounts ?? []).map((a) => a.teacher_id as string));
  const missing = (allTeachers ?? []).filter((t) => !registeredIds.has(t.id as string));
  if (!accounts?.length && missing.length === 0) return [];

  const teacherIds = (accounts ?? []).map((a) => a.teacher_id as string);
  const [{ data: profiles, error: profilesError }, { data: events, error: eventsError }] = await Promise.all([
    selectInChunks(teacherIds, (chunk) => admin.from("profiles").select("id, name").in("id", chunk)),
    selectInChunks(teacherIds, (chunk) => admin
      .from("teacher_payout_account_events")
      .select("id, teacher_id, action, changed_fields, previous_last4, new_last4, entered_by_admin, created_at")
      .in("teacher_id", chunk)
      .order("created_at", { ascending: false }), { sort: orderComparator(["created_at", false]) }),
  ]);
  if (profilesError) throw new Error(profilesError.message);
  if (eventsError) throw new Error(eventsError.message);

  const nameById = new Map((profiles ?? []).map((p) => [p.id as string, (p.name as string) ?? ""]));
  for (const t of allTeachers ?? []) if (!nameById.has(t.id as string)) nameById.set(t.id as string, (t.name as string) ?? "");
  const changesByTeacher = new Map<string, TeacherPayoutAccountChange[]>();
  for (const e of events ?? []) {
    const list = changesByTeacher.get(e.teacher_id as string) ?? [];
    list.push({
      id: e.id as string,
      action: e.action as string,
      changedFields: (e.changed_fields as string[]) ?? [],
      previousLast4: (e.previous_last4 as string | null) ?? null,
      newLast4: (e.new_last4 as string | null) ?? null,
      enteredByAdmin: e.entered_by_admin === true,
      createdAt: e.created_at as string,
    });
    changesByTeacher.set(e.teacher_id as string, list);
  }

  const registeredItems: TeacherPayoutAccountListItem[] = (accounts ?? []).map((a) => ({
    teacherId: a.teacher_id as string,
    teacherName: nameById.get(a.teacher_id as string) ?? "",
    registered: true,
    accountHolderName: a.account_holder_name as string,
    bankName: a.bank_name as string,
    accountNumberMasked: maskAccountNumber(a.account_number_last4 as string),
    swiftOrRoutingMasked: a.swift_or_routing_last4 ? maskAccountNumber(a.swift_or_routing_last4 as string) : null,
    currency: a.currency as string,
    country: (a.country as string | null) ?? null,
    enteredByAdmin: a.entered_by_admin === true,
    updatedAt: a.updated_at as string,
    changes: changesByTeacher.get(a.teacher_id as string) ?? [],
  }));
  const missingItems: TeacherPayoutAccountListItem[] = missing.map((t) => ({
    teacherId: t.id as string,
    teacherName: (t.name as string) ?? "",
    registered: false,
    accountHolderName: "",
    bankName: "",
    accountNumberMasked: "",
    swiftOrRoutingMasked: null,
    currency: "",
    country: null,
    enteredByAdmin: false,
    updatedAt: null,
    changes: [],
  }));
  return [...missingItems, ...registeredItems];
}

/** 이 관리자가 계좌 입력·수정·전체 번호 보기를 할 수 있는지(마스터 또는 정산권한). 버튼 표시용 — 실제 방어는 각 액션·DB가 한다. */
export async function getPayoutAccountStaffPermissionAction(): Promise<{ canManage: boolean }> {
  try {
    await requirePayoutAccountStaff();
    return { canManage: true };
  } catch {
    return { canManage: false };
  }
}

export type SaveAccountByAdminResult = { status: "saved"; changedFields: string[] } | { status: "invalid"; message: string };

/** 교사를 대신해 수취 계좌를 입력·수정한다(회의에서 받은 정보). 이력(끝 4자리만)과 교사 알림은 DB 함수가 남긴다. */
export async function saveTeacherPayoutAccountByAdminAction(
  teacherId: string,
  input: PayoutAccountInputRaw
): Promise<SaveAccountByAdminResult> {
  const { actorUserId } = await requirePayoutAccountStaff();
  const validated = validatePayoutAccountInput(input);
  if (!validated.ok) return { status: "invalid", message: PAYOUT_ACCOUNT_ERROR_KO[validated.code] ?? validated.message };
  const v = validated.value;

  const admin = createAdminClient();
  const { data: teacher, error: teacherError } = await admin.from("profiles").select("role").eq("id", teacherId).maybeSingle();
  if (teacherError) throw new Error(teacherError.message);
  if (teacher?.role !== "teacher") return { status: "invalid", message: "교사 계정이 아닙니다." };

  // 송금이 진행 중인 동안에는 수취 계좌를 바꾸지 않는다(돈이 나가는 중에 계좌가 바뀌면 설명할 수 없다).
  const { data: inFlight, error: inFlightError } = await admin
    .from("payout_batches")
    .select("id")
    .eq("teacher_id", teacherId)
    .in("status", ["dispatch_requested", "provider_pending", "processing"])
    .limit(1);
  if (inFlightError) throw new Error(inFlightError.message);
  if (inFlight && inFlight.length > 0) {
    return { status: "invalid", message: "송금이 진행 중인 정산 건이 있어 지금은 계좌를 바꿀 수 없습니다. 지급 완료 후 다시 시도하세요." };
  }

  const { data, error } = await admin.rpc("save_teacher_payout_account", {
    p_teacher_id: teacherId,
    p_actor_id: actorUserId,
    p_by_admin: true,
    p_holder: v.accountHolderName,
    p_bank: v.bankName,
    p_number: v.accountNumber,
    p_currency: v.currency,
    p_country: v.country,
    p_swift: v.swiftOrRouting,
  });
  if (error) throw new Error(error.message);
  const changed = ((data as { changed_fields?: string[] } | null)?.changed_fields ?? []) as string[];
  return { status: "saved", changedFields: changed };
}

export type RevealedPayoutAccount = {
  accountHolderName: string;
  bankName: string;
  accountNumber: string;
  swiftOrRouting: string | null;
  currency: string;
  country: string | null;
};

/**
 * 전체 번호 보기(reveal). 목록 payload에는 포함되지 않으며, 호출마다 DB가 감사 행을 남긴 뒤 복호화한다.
 * 반환값은 호출한 화면이 일시적으로만(약 30초) 보여 준다. 서버는 이 값을 로그·이력·알림에 남기지 않는다.
 */
export async function revealTeacherPayoutAccountAction(teacherId: string, reason: string): Promise<RevealedPayoutAccount> {
  const { actorUserId } = await requirePayoutAccountStaff();
  const trimmedReason = reason?.trim() ?? "";
  if (trimmedReason.length < 5) throw new Error("전체 번호를 보는 사유를 5자 이상 입력해주세요.");
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("reveal_teacher_payout_account", {
    p_teacher_id: teacherId,
    p_actor_id: actorUserId,
    p_reason: trimmedReason,
  });
  if (error) throw new Error(error.message);
  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null;
  if (!row) throw new Error("등록된 수취 계좌가 없습니다.");
  return {
    accountHolderName: row.account_holder_name as string,
    bankName: row.bank_name as string,
    accountNumber: row.account_number as string,
    swiftOrRouting: (row.swift_or_routing as string | null) ?? null,
    currency: row.currency as string,
    country: (row.country as string | null) ?? null,
  };
}
