"use server";

import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-admin";
import { recordDocumentAccess } from "@/lib/document-access-audit";

// P4-3 3단계 — `문서 > 교사 서류` 보관함.
//
// **읽기 전용이다.** 업로드·삭제·대체 창구는 교사 포털 `정산` 탭 하나뿐이고
// (P4-2), 이 파일은 그 원본을 조회만 한다. 관리자용 사본 테이블·캐시·미러
// 버킷을 만들지 않는다.
//
// **게이트(2026-09-12 확정)**: **관리자 전용이다.** 서버에서 관리자 자격을
// 명시적으로 확인한다 — 비관리자는 정산 capability를 가졌더라도 거부된다.
// capability를 OR로 함께 받는 게이트는 쓰지 않는다. "지금은 그 capability를 가진
// 사람이 없으니 사실상 관리자 전용"은 정책 보장이 아니라 우연이고, 누군가에게
// 부여되는 순간 납세 서류가 조용히 열린다.
//
// 교사 본인의 업로드·조회·다운로드 경로(app/teacher/settlement-actions.ts)는
// 이 게이트와 무관하게 그대로다 — 여기는 관리자 조회 경로 하나뿐이다.
//
// 교사·학생·보호자는 이 경로로 들어올 수 없다. 관리자 조회는 service_role로
// 하므로 RLS가 막아주지 않는다 — 이 게이트가 실질적인 통제 지점이고, 거부되면
// 파일 조회나 서명 URL 발급까지 가지 않도록 **모든 진입점 맨 앞에** 건다.
//
// 향후 마스터/중간 관리자 체계가 들어오면 이 게이트를 업무별로 다시 좁힌다
// (docs/2026-09-12-p4-3-drive-provisioning-request.md §7 후속 계획). `정산권한`
// 이라는 이름은 그때 쓸 자리로 남겨 둘 뿐, 지금 게이트에는 쓰이지 않는다.
//
// **제출 여부는 어떤 업무의 조건도 아니다.** 승인·검토·보완 상태를 만들지 않고
// (원본 테이블에 그런 컬럼 자체가 없다), 화면에도 "미제출"·"승인됨" 같은 배지를
// 두지 않는다.
export type TeacherDocumentSummary = {
  teacherId: string;
  teacherName: string;
  documentCount: number;
  lastUploadedAt: string | null;
};

export type TeacherDocumentItem = {
  id: string;
  fileName: string;
  contentType: string | null;
  sizeBytes: number | null;
  note: string | null;
  uploadedAt: string;
};

/** 교사별 제출 현황 요약. 제출 건수와 최근 제출 시각만 — 판정하지 않는다. */
export async function listTeacherDocumentSummariesAction(): Promise<TeacherDocumentSummary[]> {
  await requireAdmin();
  const admin = createAdminClient();

  const { data: docs, error } = await admin
    .from("teacher_documents")
    .select("teacher_id, uploaded_at")
    .order("uploaded_at", { ascending: false });
  if (error) throw new Error(error.message);
  if (!docs?.length) return [];

  const byTeacher = new Map<string, { count: number; last: string }>();
  for (const d of docs) {
    const key = d.teacher_id as string;
    const existing = byTeacher.get(key);
    if (!existing) byTeacher.set(key, { count: 1, last: d.uploaded_at as string });
    else existing.count += 1;
  }

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, name")
    .in("id", Array.from(byTeacher.keys()));
  const nameById = new Map((profiles ?? []).map((p) => [p.id as string, p.name as string]));

  return Array.from(byTeacher.entries())
    .map(([teacherId, v]) => ({
      teacherId,
      teacherName: nameById.get(teacherId) ?? "",
      documentCount: v.count,
      lastUploadedAt: v.last,
    }))
    .sort((a, b) => (b.lastUploadedAt ?? "").localeCompare(a.lastUploadedAt ?? ""));
}

/** 한 교사의 제출 파일 목록(메타데이터만). */
export async function listTeacherDocumentsAction(teacherId: string): Promise<TeacherDocumentItem[]> {
  await requireAdmin();
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("teacher_documents")
    .select("id, file_name, content_type, size_bytes, note, uploaded_at")
    .eq("teacher_id", teacherId)
    .order("uploaded_at", { ascending: false });
  if (error) throw new Error(error.message);

  return (data ?? []).map((d) => ({
    id: d.id as string,
    fileName: d.file_name as string,
    contentType: (d.content_type as string | null) ?? null,
    sizeBytes: (d.size_bytes as number | null) ?? null,
    note: (d.note as string | null) ?? null,
    uploadedAt: d.uploaded_at as string,
  }));
}

/**
 * 다운로드 링크(서명 URL)를 발급한다.
 *
 * 계약과 달리 서버가 바이트를 흘려보내지 않으므로 **발급까지만 보장된다** —
 * 실제로 내려받았는지는 알 수 없고, 그래서 감사에도 발급으로만 남긴다.
 *
 * 파일명이나 사용자가 고른 종류로 민감 여부를 가르지 않는다. 자유 업로드이므로
 * 모든 파일을 같은 기준(관리자 전용)으로 다룬다.
 */
export async function getTeacherDocumentDownloadUrlAction(
  documentId: string
): Promise<{ ok: true; url: string } | { ok: false; reason: "not_found" | "link_failed" }> {
  const { adminUserId: actorUserId } = await requireAdmin();
  const admin = createAdminClient();

  const { data: doc } = await admin
    .from("teacher_documents")
    .select("id, teacher_id, storage_path, file_name")
    .eq("id", documentId)
    .maybeSingle();
  if (!doc) return { ok: false, reason: "not_found" };

  const auditBase = {
    actorId: actorUserId,
    targetKind: "teacher_document" as const,
    targetId: documentId,
    subjectId: doc.teacher_id as string,
    // 파일명은 식별에 필요하지만 본문 내용은 절대 담지 않는다.
    detail: { fileName: doc.file_name },
  };

  const { data: signed, error: signError } = await admin.storage
    .from("teacher-documents")
    .createSignedUrl(doc.storage_path as string, 60);

  if (signError || !signed?.signedUrl) {
    // 상세 원인은 서버 로그에만. 화면에는 사유 코드만 돌려준다.
    console.error(
      JSON.stringify({
        event: "teacher_document_link_failed",
        documentId,
        message: signError?.message ?? "signed url missing",
      })
    );
    await recordDocumentAccess({ ...auditBase, action: "download_failed" });
    return { ok: false, reason: "link_failed" };
  }

  // 발급까지만 보장한다 — "내려받았다"로 적지 않는다.
  await recordDocumentAccess({ ...auditBase, action: "download_url_issued" });
  return { ok: true, url: signed.signedUrl };
}
