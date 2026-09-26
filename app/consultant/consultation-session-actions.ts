"use server";

// Phase C(2026-09-23, 사용자 지시) — 상담 세션 화면. 컨설턴트는 확정된
// 일정(consultation 또는 meeting_request)에서 "상담 시작"으로 들어가
// 허용된 자료를 열람하고 메모·다음 행동을 남긴다. 새 상태 컬럼을 두지
// 않고 시작·종료 시각으로 시작 전/진행 중/종료 후를 계산한다.

import { requireConsultant } from "@/lib/admin-auth";
import { recordDocumentAccess } from "@/lib/document-access-audit";

export type ConsultationMaterialForSession = {
  id: string;
  title: string;
  category: string | null;
  description: string | null;
  hasDriveFile: boolean;
  externalUrl: string | null;
};

export type ConsultationSessionNote = {
  note: string | null;
  nextAction: string | null;
  updatedAt: string | null;
};

export async function listMyConsultationMaterialsAction(): Promise<ConsultationMaterialForSession[]> {
  const { supabase } = await requireConsultant();
  const { data, error } = await supabase
    .from("consultation_materials")
    .select("id, title, category, description, drive_file_id, external_url")
    .is("archived_at", null)
    .order("category", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: r.id,
    title: r.title,
    category: r.category,
    description: r.description,
    hasDriveFile: Boolean(r.drive_file_id),
    externalUrl: r.external_url,
  }));
}

/** 외부 링크 자료를 열람 시도했다는 사실을 기록한다(파일 자체는 Drive
 * 공유 설정에 맡긴다 — 이 경로로는 원본 다운로드를 제공하지 않는다). */
export async function recordExternalMaterialOpenAction(materialId: string): Promise<void> {
  const { user } = await requireConsultant();
  await recordDocumentAccess({
    actorId: user.id,
    targetKind: "consultation_material",
    targetId: materialId,
    action: "download_url_issued",
  });
}

export async function getMySessionNoteAction(sourceKind: "consultation" | "meeting_request", sourceId: string): Promise<ConsultationSessionNote> {
  const { user, supabase } = await requireConsultant();
  const { data, error } = await supabase
    .from("consultation_session_notes")
    .select("note, next_action, updated_at")
    .eq("consultant_id", user.id)
    .eq("source_kind", sourceKind)
    .eq("source_id", sourceId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return { note: data?.note ?? null, nextAction: data?.next_action ?? null, updatedAt: data?.updated_at ?? null };
}

export async function saveMySessionNoteAction(params: {
  sourceKind: "consultation" | "meeting_request";
  sourceId: string;
  note: string;
  nextAction: string;
}): Promise<void> {
  const { user, supabase } = await requireConsultant();
  const { error } = await supabase.from("consultation_session_notes").upsert(
    {
      consultant_id: user.id,
      source_kind: params.sourceKind,
      source_id: params.sourceId,
      note: params.note.trim() || null,
      next_action: params.nextAction.trim() || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "source_kind,source_id" }
  );
  if (error) throw new Error(error.message);
}

// admin 클라이언트로 만든다 — drive_file_id 존재 여부만 필요하고, RLS(공개
// 자료만 조회)는 목록 액션에서 이미 확인됐다는 전제로 다운로드 라우트에서
// 재확인한다(app/api/consultant/consultation-materials/[id]/route.ts).
export async function getConsultationMaterialDriveFileId(materialId: string): Promise<string | null> {
  const { supabase } = await requireConsultant();
  const { data, error } = await supabase
    .from("consultation_materials")
    .select("drive_file_id")
    .eq("id", materialId)
    .is("archived_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.drive_file_id ?? null;
}
