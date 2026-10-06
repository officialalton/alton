"use server";

import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase-admin";

// 2026-09-14 문제 템플릿 ④ — 문제 그림 파일의 서명 URL. 그 그림을 참조하는 문제 버전을 **읽을 수 있는 사람**
// (RLS: 학생은 자기 수업·과제에 고정된 버전, 교사·관리자)에게만 발급한다.

const EXPIRES_IN_SECONDS = 600;

export type ProblemImageUrlResult = { ok: true; url: string; expiresInSeconds: number } | { ok: false; error: string };

export async function getProblemImageUrlAction(bucket: string, path: string): Promise<ProblemImageUrlResult> {
  const { supabase } = await requireUser();
  if (bucket !== "problem-assets" || !path || path.includes("..")) return { ok: false, error: "Invalid image path." };
  // problem_versions 는 정답이 들어 있어 학생이 직접 읽지 못한다 — 열람 가능 여부는 함수로 확인한다.
  const { data: visible } = await supabase.rpc("problem_figure_visible", { p_path: path });
  if (visible !== true) return { ok: false, error: "You can't view this image." };
  const admin = createAdminClient();
  const { data: signed, error } = await admin.storage.from(bucket).createSignedUrl(path, EXPIRES_IN_SECONDS);
  if (error || !signed?.signedUrl) return { ok: false, error: "Couldn't create the image URL." };
  return { ok: true, url: signed.signedUrl, expiresInSeconds: EXPIRES_IN_SECONDS };
}
