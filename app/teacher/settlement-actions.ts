"use server";

// P4-2 — 교사 본인 정산 화면의 서버 액션: 정산 조회 / 수취 계좌 등록·수정 /
// 제출 서류 업로드·목록.
//
// 착수 정리: docs/2026-09-12-p4-2-teacher-settlement-plan.md
// DB: supabase/migrations/20261284000000_p4_2_teacher_payout_account_and_documents.sql
//
// 확정 정책:
//  * 계좌번호 전체는 **절대 클라이언트로 내려보내지 않는다** — 교사 본인 화면에도
//    마스킹된 값만 가고, 수정은 전체 재입력이다. 관리자 목록도 같은 원본·같은
//    마스킹을 쓴다(app/admin/teacher-payout-accounts-actions.ts).
//  * 제출 서류는 업로드·보관 창구일 뿐이다 — 제출 여부·검토 상태를 정산·매칭·
//    수업의 조건으로 쓰지 않는다. 이 파일의 정산 조회 경로는 서류를 읽지 않는다.
//  * 실제 송금·paid 전이는 범위 밖이다. 계좌 값을 읽는 송금 경로는 아직 없다.

import { randomUUID } from "node:crypto";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase-admin";
import { loadTeacherSettlement, maskAccountNumber, type TeacherSettlement } from "./settlement-data";

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
  if (profile?.role !== "teacher") throw new Error("선생님 계정만 사용할 수 있습니다.");
  return { userId: user.id };
}

export async function loadMySettlementAction(): Promise<TeacherSettlement> {
  const { user, supabase } = await requireUser();
  // payout_items/payout_batches RLS가 teacher_id = auth.uid()를 이미 허용하므로
  // 사용자 스코프 클라이언트로 본인 행만 읽는다(admin 클라이언트 불필요).
  return loadTeacherSettlement(supabase, user.id);
}

export async function getMyPayoutAccountAction(): Promise<MaskedPayoutAccount | null> {
  const { userId } = await requireTeacherUser();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("teacher_payout_accounts")
    .select("account_holder_name, bank_name, account_number_last4, currency, country, swift_or_routing, updated_at")
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
    swiftOrRouting: (data.swift_or_routing as string | null) ?? null,
    updatedAt: data.updated_at as string,
  };
}

export type SavePayoutAccountResult =
  | { status: "saved"; account: MaskedPayoutAccount }
  | { status: "invalid"; message: string };

export async function saveMyPayoutAccountAction(
  input: PayoutAccountInput
): Promise<SavePayoutAccountResult> {
  const { userId } = await requireTeacherUser();

  const accountHolderName = input.accountHolderName.trim();
  const bankName = input.bankName.trim();
  const accountNumber = input.accountNumber.trim();
  const currency = (input.currency || "KRW").trim().toUpperCase();
  if (!accountHolderName) return { status: "invalid", message: "예금주를 입력해주세요." };
  if (!bankName) return { status: "invalid", message: "은행명을 입력해주세요." };
  if (accountNumber.replace(/\D/g, "").length < 4) {
    return { status: "invalid", message: "계좌번호를 정확히 입력해주세요(숫자 4자리 이상)." };
  }
  if (!/^[A-Z]{3}$/.test(currency)) {
    return { status: "invalid", message: "통화 코드는 3자리 영문이어야 합니다(예: KRW)." };
  }

  const admin = createAdminClient();
  const { data: existing, error: existingError } = await admin
    .from("teacher_payout_accounts")
    .select("id, account_holder_name, bank_name, account_number_last4, currency, country, swift_or_routing")
    .eq("teacher_id", userId)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);

  const next = {
    teacher_id: userId,
    account_holder_name: accountHolderName,
    bank_name: bankName,
    account_number: accountNumber,
    account_number_last4: last4Of(accountNumber),
    currency,
    country: input.country?.trim() || null,
    swift_or_routing: input.swiftOrRouting?.trim() || null,
    updated_at: new Date().toISOString(),
    updated_by: userId,
  };

  const changedFields: string[] = [];
  if (existing) {
    if (existing.account_holder_name !== next.account_holder_name) changedFields.push("account_holder_name");
    if (existing.bank_name !== next.bank_name) changedFields.push("bank_name");
    if (existing.account_number_last4 !== next.account_number_last4) changedFields.push("account_number");
    if (existing.currency !== next.currency) changedFields.push("currency");
    if ((existing.country ?? null) !== next.country) changedFields.push("country");
    if ((existing.swift_or_routing ?? null) !== next.swift_or_routing) changedFields.push("swift_or_routing");
  }

  const { error: upsertError } = await admin
    .from("teacher_payout_accounts")
    .upsert(next, { onConflict: "teacher_id" });
  if (upsertError) throw new Error(upsertError.message);

  // 변경 이력은 전체 계좌번호를 복제하지 않는다 — 바뀐 필드 이름과 끝 4자리만.
  // 계좌번호 자체가 바뀌지 않은 재저장(다른 필드만 수정)도 이력을 남긴다.
  await admin.from("teacher_payout_account_events").insert({
    teacher_id: userId,
    action: existing ? "updated" : "created",
    actor_id: userId,
    changed_fields: existing ? changedFields : ["account_holder_name", "bank_name", "account_number", "currency"],
    previous_last4: (existing?.account_number_last4 as string | undefined) ?? null,
    new_last4: next.account_number_last4,
  });

  return {
    status: "saved",
    account: {
      accountHolderName: next.account_holder_name,
      bankName: next.bank_name,
      accountNumberMasked: maskAccountNumber(next.account_number_last4),
      currency: next.currency,
      country: next.country,
      swiftOrRouting: next.swift_or_routing,
      updatedAt: next.updated_at,
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
    return { status: "invalid", message: "업로드할 파일을 선택해주세요." };
  }
  if (file.size > MAX_DOCUMENT_BYTES) {
    return { status: "invalid", message: "파일 크기는 10MB 이하여야 합니다." };
  }
  if (file.type && !ALLOWED_DOCUMENT_TYPES.has(file.type)) {
    return { status: "invalid", message: "PDF 또는 이미지(PNG/JPG/HEIC) 파일만 업로드할 수 있습니다." };
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
  if (!data || data.teacher_id !== userId) throw new Error("본인이 업로드한 서류만 내려받을 수 있습니다.");

  const { data: signed, error: signError } = await admin.storage
    .from("teacher-documents")
    .createSignedUrl(data.storage_path as string, 60);
  if (signError || !signed?.signedUrl) throw new Error(signError?.message ?? "다운로드 링크를 만들지 못했습니다.");
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
    throw new Error("본인이 업로드한 서류만 삭제할 수 있습니다.");
  }

  const { error: removeError } = await admin.storage
    .from("teacher-documents")
    .remove([data.storage_path as string]);
  if (removeError) throw new Error(removeError.message);

  const { error: deleteError } = await admin.from("teacher_documents").delete().eq("id", documentId);
  if (deleteError) throw new Error(deleteError.message);
}
