"use server";

import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase-admin";

// 파일 자료(PDF·영상)의 고정 사본을 여는 서명 URL.
//
// 사본은 비공개 버킷에 있고 클라이언트가 직접 읽지 않는다. 여기서 **요청 사용자 권한으로**
// 그 버전 행을 읽을 수 있는지 확인한다(curriculum_doc_versions RLS: 교재를 볼 수 있으면
// 그 버전도) — 읽히면 서버(service_role)가 짧은 서명 URL 을 만든다. 수업 중 매 페이지마다
// 부르지 않도록 URL 은 10분 동안 유효하다.

export type AssetUrlResult =
  | { ok: true; url: string; mimeType: string; expiresInSeconds: number }
  | { ok: false; error: string };

const EXPIRES_IN_SECONDS = 600;

export async function getAssetVersionUrlAction(versionId: string): Promise<AssetUrlResult> {
  const { supabase } = await requireUser();

  const { data: version } = await supabase
    .from("curriculum_doc_versions")
    .select("id, snapshot")
    .eq("id", versionId)
    .maybeSingle();
  if (!version) return { ok: false, error: "이 자료를 볼 수 없습니다." };

  const snapshot = version.snapshot as {
    kind?: string;
    asset?: { bucket?: string; path?: string; mimeType?: string };
  } | null;
  const asset = snapshot?.asset;
  if (!snapshot?.kind || snapshot.kind === "html" || !asset?.bucket || !asset?.path) {
    return { ok: false, error: "이 버전에는 고정 사본이 기록되지 않았습니다." };
  }

  const admin = createAdminClient();
  const { data: signed, error } = await admin.storage
    .from(asset.bucket)
    .createSignedUrl(asset.path, EXPIRES_IN_SECONDS);
  if (error || !signed?.signedUrl) {
    console.error(JSON.stringify({ event: "curriculum_asset_sign_failed", versionId, message: error?.message }));
    return { ok: false, error: "자료 주소를 만들지 못했습니다. 다시 시도해주세요." };
  }
  return {
    ok: true,
    url: signed.signedUrl,
    mimeType: asset.mimeType ?? (snapshot.kind === "pdf" ? "application/pdf" : "video/mp4"),
    expiresInSeconds: EXPIRES_IN_SECONDS,
  };
}
