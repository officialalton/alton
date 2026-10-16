"use server";

// P4-2 — 교사 본인 정산 화면의 서버 액션: 정산 조회 / 수취 계좌 등록·수정 /
// 제출 서류 업로드·목록.
//
// 착수 정리: docs/2026-09-12-p4-2-teacher-settlement-plan.md
// DB: supabase/migrations/20261284000000_p4_2_teacher_payout_account_and_documents.sql
//
// 확정 정책:
//  * 계좌번호 전체는 **교사 화면·관리자 목록에 내려보내지 않는다**(항상 마스킹). 교사는 **최초 1회만** 등록하고(서버·DB가
//    이후 수정을 차단), 이후 수정은 정산권한·마스터 관리자가 대신 입력한다. 전체 번호는 정산권한·마스터가 감사되는
//    '전체 번호 보기'로만 본다(app/admin/teacher-payout-accounts-actions.ts). 번호는 암호화 저장된다(20262100000112).
//  * 제출 서류는 업로드·보관 창구일 뿐이다 — 제출 여부·검토 상태를 정산·매칭·
//    수업의 조건으로 쓰지 않는다. 이 파일의 정산 조회 경로는 서류를 읽지 않는다.
//  * 실제 송금·paid 전이는 범위 밖이다. 계좌 값을 읽는 송금 경로는 아직 없다.

import { randomUUID } from "node:crypto";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase-admin";
import { validatePayoutAccountInput } from "@/lib/payout/account-validation";
import { loadTeacherSettlement, maskAccountNumber, type TeacherSettlement } from "./settlement-data";

const ACCOUNT_LOCKED_MESSAGE = "To change your account details, contact ALTON staff.";
const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
const ALLOWED_DOCUMENT_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/heic",
]);

export type MaskedPayoutAccount = {
  accountHolderName: string;
  bankName: string;
  /** 항상 마스킹된 표시값(예: "****1234"). 전체 계좌번호는 응답에 포함되지 않는다. */
  accountNumberMasked: string;
  currency: string;
  country: string | null;
  /** SWIFT/라우팅은 끝 4자리만(마스킹). 전체 값은 교사 화면에도 내려가지 않는다. */
  swiftOrRouting: string | null;
  updatedAt: string;
};

export type PayoutAccountInput = {
  accountHolderName: string;
  bankName: string;
  accountNumber: string;
  currency: string;
  country?: string;
  swiftOrRouting?: string;
};

/** 지급 일정 변경·지연 알림(인앱 기록). 이메일이 아니다. */
export type PayoutNotice = {
  id: string;
  kind: string;
  message: string;
  createdAt: string;
  read: boolean;
};

export type TeacherDocumentItem = {
  id: string;
  fileName: string;
  contentType: string | null;
  sizeBytes: number | null;
  note: string | null;
  uploadedAt: string;
};

function last4Of(accountNumber: string): string {
  const digits = accountNumber.replace(/\D/g, "");
  const source = digits.length > 0 ? digits : accountNumber;
  return source.slice(-4);
}

async function requireTeacherUser(): Promise<{ userId: string }> {
  const { user, supabase } = await requireUser();
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (profile?.role !== "teacher") throw new Error("Only teacher accounts can use this.");
  return { userId: user.id };
}

export async function loadMySettlementAction(): Promise<TeacherSettlement> {
  const { user, supabase } = await requireUser();
  // payout_items/payout_batches RLS가 teacher_id = auth.uid()를 이미 허용하므로
  // 사용자 스코프 클라이언트로 본인 행만 읽는다(admin 클라이언트 불필요).
  return loadTeacherSettlement(supabase, user.id);
}

/** 2026-09-22(UAT "정산 로딩이 엄청 길다") — SettlementTab이 정산·계좌·서류를
 * 서버 액션 3개(HTTP 왕복 3번, 각각 별도로 인증·역할 확인)로 따로 불러오고
 * 있었다. 화면 하나가 쓸 데이터는 한 번의 서버 액션에서 같이 내려준다
 * (InquiryAndMeetingTab이 loadInquiryAndMeetingDashboardAction 하나로 합친 것과
 * 같은 패턴). */
export async function loadSettlementPageDataAction(): Promise<{
  settlement: TeacherSettlement;
  account: MaskedPayoutAccount | null;
  documents: TeacherDocumentItem[];
  notices: PayoutNotice[];
}> {
  const { user, supabase } = await requireUser();
  const { data: profile, error: profileError } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profileError) throw new Error(profileError.message);
  if (profile?.role !== "teacher") throw new Error("Only teacher accounts can use this.");

  const admin = createAdminClient();
  const [settlement, { data: accountRow, error: accountError }, { data: docRows, error: docsError }, { data: noticeRows }] = await Promise.all([
    loadTeacherSettlement(supabase, user.id),
    admin
      .from("teacher_payout_accounts")
      .select("account_holder_name, bank_name, account_number_last4, currency, country, swift_or_routing_last4, updated_at")
      .eq("teacher_id", user.id)
      .maybeSingle(),
    admin
      .from("teacher_documents")
      .select("id, file_name, content_type, size_bytes, note, uploaded_at")
      .eq("teacher_id", user.id)
      .order("uploaded_at", { ascending: false }),
    // 본인 알림 최근 3건(teacher_id 스코프). 실패해도 정산 화면은 열려야 하므로 오류는 무시한다.
    admin
      .from("payout_teacher_notices")
      .select("id, kind, message, created_at, read_at")
      .eq("teacher_id", user.id)
      .order("created_at", { ascending: false })
      .limit(3),
  ]);
  if (accountError) throw new Error(accountError.message);
  if (docsError) throw new Error(docsError.message);

  const account: MaskedPayoutAccount | null = accountRow
    ? {
        accountHolderName: accountRow.account_holder_name as string,
        bankName: accountRow.bank_name as string,
        accountNumberMasked: maskAccountNumber(accountRow.account_number_last4 as string),
        currency: accountRow.currency as string,
        country: (accountRow.country as string | null) ?? null,
        swiftOrRouting: accountRow.swift_or_routing_last4 ? maskAccountNumber(accountRow.swift_or_routing_last4 as string) : null,
        updatedAt: accountRow.updated_at as string,
      }
    : null;
  const documents: TeacherDocumentItem[] = (docRows ?? []).map((d) => ({
    id: d.id as string,
    fileName: d.file_name as string,
    contentType: (d.content_type as string | null) ?? null,
    sizeBytes: d.size_bytes === null ? null : Number(d.size_bytes),
    note: (d.note as string | null) ?? null,
    uploadedAt: d.uploaded_at as string,
  }));

  const notices: PayoutNotice[] = (noticeRows ?? []).map((n) => ({
    id: n.id as string,
    kind: n.kind as string,
    message: n.message as string,
    createdAt: n.created_at as string,
    read: n.read_at != null,
  }));

  return { settlement, account, documents, notices };
}

/** 본인 알림만 읽음 처리한다(teacher_id 스코프 — 다른 교사의 id를 넣어도 0행). 이미 읽은 알림은 그대로 둔다. */
export async function markPayoutNoticeReadAction(noticeId: string): Promise<{ ok: boolean }> {
  const { userId } = await requireTeacherUser();
  if (!/^[0-9a-f-]{36}$/i.test(noticeId)) return { ok: false };
  const admin = createAdminClient();
  const { error } = await admin
    .from("payout_teacher_notices")
    .update({ read_at: new Date().toISOString() })
    .eq("id", noticeId)
    .eq("teacher_id", userId)
    .is("read_at", null);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function getMyPayoutAccountAction(): Promise<MaskedPayoutAccount | null> {
  const { userId } = await requireTeacherUser();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("teacher_payout_accounts")
    .select("account_holder_name, bank_name, account_number_last4, currency, country, swift_or_routing_last4, updated_at")
    .eq("teacher_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    accountHolderName: data.account_holder_name as string,
    bankName: data.bank_name as string,
    accountNumberMasked: maskAccountNumber(data.account_number_last4 as string),
    currency: data.currency as string,
    country: (data.country as string | null) ?? null,
    swiftOrRouting: data.swift_or_routing_last4 ? maskAccountNumber(data.swift_or_routing_last4 as string) : null,
    updatedAt: data.updated_at as string,
  };
}

export type SavePayoutAccountResult =
  | { status: "saved"; account: MaskedPayoutAccount }
  | { status: "invalid"; message: string };

/**
 * 교사의 **최초 1회** 수취 계좌 등록. 이미 등록돼 있으면 서버에서 거절한다(화면에서 숨기는 것만으로 막지 않는다).
 * 이후 수정은 정산권한 보유자·마스터 관리자만 한다(app/admin/teacher-payout-accounts-actions.ts).
 * 저장은 DB 함수(save_teacher_payout_account)가 암호화·이력을 한 트랜잭션으로 처리하며, 같은 잠금 규칙을 DB에서도 강제한다.
 */
export async function saveMyPayoutAccountAction(
  input: PayoutAccountInput
): Promise<SavePayoutAccountResult> {
  const { userId } = await requireTeacherUser();

  const validated = validatePayoutAccountInput(input);
  if (!validated.ok) return { status: "invalid", message: validated.message };
  const v = validated.value;

  const admin = createAdminClient();

  const { data: existing, error: existingError } = await admin
    .from("teacher_payout_accounts")
    .select("id")
    .eq("teacher_id", userId)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);
  if (existing) {
    return { status: "invalid", message: ACCOUNT_LOCKED_MESSAGE };
  }

  const { error } = await admin.rpc("save_teacher_payout_account", {
    p_teacher_id: userId,
    p_actor_id: userId,
    p_by_admin: false,
    p_holder: v.accountHolderName,
    p_bank: v.bankName,
    p_number: v.accountNumber,
    p_currency: v.currency,
    p_country: v.country,
    p_swift: v.swiftOrRouting,
  });
  if (error) {
    if (/LOCKED/.test(error.message)) return { status: "invalid", message: ACCOUNT_LOCKED_MESSAGE };
    throw new Error(error.message);
  }

  return {
    status: "saved",
    account: {
      accountHolderName: v.accountHolderName,
      bankName: v.bankName,
      accountNumberMasked: maskAccountNumber(last4Of(v.accountNumber)),
      currency: v.currency,
      country: v.country,
      swiftOrRouting: v.swiftOrRouting ? maskAccountNumber(last4Of(v.swiftOrRouting)) : null,
      updatedAt: new Date().toISOString(),
    },
  };
}

export async function listMyDocumentsAction(): Promise<TeacherDocumentItem[]> {
  const { userId } = await requireTeacherUser();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("teacher_documents")
    .select("id, file_name, content_type, size_bytes, note, uploaded_at")
    .eq("teacher_id", userId)
    .order("uploaded_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((d) => ({
    id: d.id as string,
    fileName: d.file_name as string,
    contentType: (d.content_type as string | null) ?? null,
    sizeBytes: d.size_bytes === null ? null : Number(d.size_bytes),
    note: (d.note as string | null) ?? null,
    uploadedAt: d.uploaded_at as string,
  }));
}

export type UploadDocumentResult =
  | { status: "uploaded"; document: TeacherDocumentItem }
  | { status: "invalid"; message: string };

export async function uploadMyDocumentAction(formData: FormData): Promise<UploadDocumentResult> {
  const { userId } = await requireTeacherUser();
  const file = formData.get("file");
  const note = (formData.get("note") as string | null)?.trim() || null;
  if (!(file instanceof File) || file.size === 0) {
    return { status: "invalid", message: "Please choose a file to upload." };
  }
  if (file.size > MAX_DOCUMENT_BYTES) {
    return { status: "invalid", message: "The file must be 10MB or smaller." };
  }
  if (file.type && !ALLOWED_DOCUMENT_TYPES.has(file.type)) {
    return { status: "invalid", message: "Only PDF or image files (PNG/JPG/HEIC) can be uploaded." };
  }

  const admin = createAdminClient();
  // 경로 첫 세그먼트가 교사 id — Storage 정책이 이 규칙으로 본인 파일만 읽게 한다.
  const storagePath = `${userId}/${randomUUID()}-${file.name}`;
  const { error: uploadError } = await admin.storage
    .from("teacher-documents")
    .upload(storagePath, file, { contentType: file.type || undefined, upsert: false });
  if (uploadError) throw new Error(uploadError.message);

  const { data, error } = await admin
    .from("teacher_documents")
    .insert({
      teacher_id: userId,
      file_name: file.name,
      storage_path: storagePath,
      content_type: file.type || null,
      size_bytes: file.size,
      note,
      uploaded_by: userId,
    })
    .select("id, file_name, content_type, size_bytes, note, uploaded_at")
    .single();
  if (error) {
    // 메타 행을 못 만들면 파일만 떠도는 상태를 남기지 않는다.
    await admin.storage.from("teacher-documents").remove([storagePath]);
    throw new Error(error.message);
  }

  return {
    status: "uploaded",
    document: {
      id: data.id as string,
      fileName: data.file_name as string,
      contentType: (data.content_type as string | null) ?? null,
      sizeBytes: data.size_bytes === null ? null : Number(data.size_bytes),
      note: (data.note as string | null) ?? null,
      uploadedAt: data.uploaded_at as string,
    },
  };
}

export async function getMyDocumentDownloadUrlAction(documentId: string): Promise<string> {
  const { userId } = await requireTeacherUser();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("teacher_documents")
    .select("storage_path, teacher_id")
    .eq("id", documentId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.teacher_id !== userId) throw new Error("You can only download documents you uploaded.");

  const { data: signed, error: signError } = await admin.storage
    .from("teacher-documents")
    .createSignedUrl(data.storage_path as string, 60);
  if (signError || !signed?.signedUrl) throw new Error(signError?.message ?? "Couldn't create a download link.");
  return signed.signedUrl;
}

// P4-2(UAT 후속) — 잘못 올린 서류를 교사가 직접 지울 수 있어야 한다.
// 파일 본문과 메타 행을 함께 지운다(둘 중 하나만 남는 상태를 만들지 않는다).
export async function deleteMyDocumentAction(documentId: string): Promise<void> {
  const { userId } = await requireTeacherUser();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("teacher_documents")
    .select("id, teacher_id, storage_path")
    .eq("id", documentId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.teacher_id !== userId) {
    throw new Error("You can only delete documents you uploaded.");
  }

  const { error: removeError } = await admin.storage
    .from("teacher-documents")
    .remove([data.storage_path as string]);
  if (removeError) throw new Error(removeError.message);

  const { error: deleteError } = await admin.from("teacher_documents").delete().eq("id", documentId);
  if (deleteError) throw new Error(deleteError.message);
}
