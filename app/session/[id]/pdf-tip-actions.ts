"use server";

import { requireUser } from "@/lib/auth";
import { reconstructPageStrokes } from "./pdf-page-store";
import type { PageStrokePayload } from "./annotation-events-actions";

// PDF 교사용 팁(20261980000000) 서버 액션.
//
// 쓰기·검토·가져오기는 관리자 전용 RPC(서버가 is_admin 확인), 읽기는 RLS(관리자 + 이 버전을 쓰는
// 수업의 담당 선생님, 가져온 뒤 검토 전인 쪽은 선생님에게서 제외). 학생·보호자는 이 액션을 불러도
// 행이 오지 않는다 — 화면은 애초에 부르지 않는다.

/** 한 페이지의 팁 — 마지막 전체 지우기 이후의 획만. 읽을 수 없는 사용자는 빈 배열이다. */
export async function loadPdfTipStrokes(versionId: string, pageNumber: number): Promise<PageStrokePayload[]> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("pdf_tip_events")
    .select("payload, client_event_id, seq")
    .eq("curriculum_doc_version_id", versionId)
    .eq("page_number", pageNumber)
    .order("seq", { ascending: true });
  if (error) throw new Error(error.message);
  return reconstructPageStrokes(
    (data ?? []).map((row) => ({
      ...(row.payload as PageStrokePayload),
      ...(row.client_event_id ? { eventId: row.client_event_id as string } : {}),
    }))
  );
}

/** 관리자 저장. 같은 eventId 재시도는 서버가 무시한다. */
export async function appendPdfTipEvents(params: {
  versionId: string;
  pageNumber: number;
  segments: PageStrokePayload[];
}): Promise<{ savedEventIds: string[] }> {
  if (params.segments.length === 0) return { savedEventIds: [] };
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("append_pdf_tip_events", {
    p_version_id: params.versionId,
    p_page_number: params.pageNumber,
    p_segments: params.segments,
  });
  if (error) throw new Error(error.message);
  return {
    savedEventIds: ((data ?? []) as { client_event_id: string | null }[])
      .map((r) => r.client_event_id)
      .filter((v): v is string => Boolean(v)),
  };
}

export type PdfTipReviewState = {
  pendingPages: number[];
  tipPages: number[];
  copiedFromVersionId: string | null;
  fromPageCount: number | null;
  toPageCount: number;
};

export type PdfTipStateResult = { ok: true; state: PdfTipReviewState } | { ok: false; error: string };

export async function getPdfTipReviewStateAction(versionId: string): Promise<PdfTipStateResult> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("pdf_tip_review_state", { p_version_id: versionId });
  if (error) return { ok: false, error: "Couldn't load tip status." };
  return { ok: true, state: data as PdfTipReviewState };
}

export type PdfTipVersionOption = { id: string; versionNumber: number; pageCount: number | null; createdAt: string };

/** 같은 자료의 다른 공개 버전(가져올 원본 후보) — 최신순. */
export async function listPdfTipSourceVersionsAction(
  docId: string,
  currentVersionId: string
): Promise<{ ok: true; versions: PdfTipVersionOption[] } | { ok: false; error: string }> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("curriculum_doc_versions")
    .select("id, version_number, snapshot, created_at")
    .eq("curriculum_doc_id", docId)
    .neq("id", currentVersionId)
    .order("version_number", { ascending: false });
  if (error) return { ok: false, error: "Couldn't load previous versions." };
  return {
    ok: true,
    versions: (data ?? []).map((v) => ({
      id: v.id as string,
      versionNumber: v.version_number as number,
      pageCount: ((v.snapshot as { asset?: { pageCount?: number } } | null)?.asset?.pageCount as number | undefined) ?? null,
      createdAt: v.created_at as string,
    })),
  };
}

export type CopyTipsResult =
  | {
      ok: true;
      status: "done" | "needs_confirmation";
      copied: number[];
      skipped: number[];
      conflicts: number[];
      dropped: number[];
      pageCountChanged: boolean;
      fromPageCount: number;
      toPageCount: number;
    }
  | { ok: false; error: string };

export async function copyPdfTipsFromVersionAction(params: {
  fromVersionId: string;
  toVersionId: string;
  overwrite: boolean;
}): Promise<CopyTipsResult> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("copy_pdf_tips_from_version", {
    p_from_version_id: params.fromVersionId,
    p_to_version_id: params.toVersionId,
    p_overwrite: params.overwrite,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, ...(data as Omit<Extract<CopyTipsResult, { ok: true }>, "ok">) };
}

export async function markPdfTipPageReviewedAction(versionId: string, pageNumber: number): Promise<{ ok: boolean; error?: string }> {
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("mark_pdf_tip_page_reviewed", { p_version_id: versionId, p_page_number: pageNumber });
  return error ? { ok: false, error: "Couldn't mark as reviewed." } : { ok: true };
}

export async function markPdfTipVersionReviewedAction(versionId: string): Promise<{ ok: boolean; count?: number; error?: string }> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("mark_pdf_tip_version_reviewed", { p_version_id: versionId });
  return error ? { ok: false, error: "Couldn't mark all pages as reviewed." } : { ok: true, count: Number(data ?? 0) };
}

export async function copyPdfTipsMappedAction(params: {
  fromVersionId: string;
  toVersionId: string;
  mapping: { from: number; to: number | null }[];
  overwrite: boolean;
}): Promise<CopyTipsResult> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("copy_pdf_tips_mapped", {
    p_from_version_id: params.fromVersionId,
    p_to_version_id: params.toVersionId,
    p_mapping: params.mapping,
    p_overwrite: params.overwrite,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, ...(data as Omit<Extract<CopyTipsResult, { ok: true }>, "ok">) };
}

export type CopyTipPageResult =
  | { ok: true; status: "done" | "needs_confirmation" | "empty" }
  | { ok: false; error: string };

export async function copyPdfTipPageAction(params: {
  versionId: string;
  fromPage: number;
  toPage: number;
  move: boolean;
  overwrite: boolean;
}): Promise<CopyTipPageResult> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("copy_pdf_tip_page", {
    p_version_id: params.versionId,
    p_from_page: params.fromPage,
    p_to_page: params.toPage,
    p_move: params.move,
    p_overwrite: params.overwrite,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, status: (data as { status: "done" | "needs_confirmation" | "empty" }).status };
}
