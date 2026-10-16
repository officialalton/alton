"use server";

// Phase C(2026-09-23, 사용자 지시) — 관리자가 상담용 기초자료를 등록·분류·
// 공개한다. 컨설턴트 개인 업로드·고객 발송은 이번 범위 밖(admin 전용 CRUD).

import { requireAdmin } from "@/lib/admin-auth";

export type ConsultationMaterial = {
  id: string;
  title: string;
  category: string | null;
  driveFileId: string | null;
  externalUrl: string | null;
  description: string | null;
  createdAt: string;
  archivedAt: string | null;
};

function mapRow(r: Record<string, unknown>): ConsultationMaterial {
  return {
    id: r.id as string,
    title: r.title as string,
    category: r.category as string | null,
    driveFileId: r.drive_file_id as string | null,
    externalUrl: r.external_url as string | null,
    description: r.description as string | null,
    createdAt: r.created_at as string,
    archivedAt: r.archived_at as string | null,
  };
}

export async function listConsultationMaterialsAction(): Promise<ConsultationMaterial[]> {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.from("consultation_materials").select("*").order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapRow);
}

export async function createConsultationMaterialAction(params: {
  title: string;
  category?: string;
  driveFileId?: string;
  externalUrl?: string;
  description?: string;
}): Promise<ConsultationMaterial> {
  const { supabase, adminUserId } = await requireAdmin();
  if (!params.title.trim()) throw new Error("제목을 입력해주세요.");
  if (!params.driveFileId?.trim() && !params.externalUrl?.trim()) {
    throw new Error("Drive 파일 ID 또는 외부 링크 중 하나는 있어야 합니다.");
  }
  const { data, error } = await supabase
    .from("consultation_materials")
    .insert({
      title: params.title.trim(),
      category: params.category?.trim() || null,
      drive_file_id: params.driveFileId?.trim() || null,
      external_url: params.externalUrl?.trim() || null,
      description: params.description?.trim() || null,
      created_by: adminUserId,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapRow(data);
}

export async function archiveConsultationMaterialAction(id: string): Promise<void> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("consultation_materials").update({ archived_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
}
