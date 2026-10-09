"use server";

import { requireAdmin } from "@/lib/admin-auth";
import { loadKeywordDictionary, type KeywordDictionary } from "./subject-data";

// 2026-10-08 — 과목 키워드 폴더 관리(관리자 전용). 설계: docs/2026-10-08-keyword-folders-design.md
// 모든 액션은 변경 뒤 그 과목의 최신 키워드 사전(폴더+키워드)을 돌려준다.
// 권한의 최종 방어선은 RLS("관리자만 쓰기")다. 회차·교재·문제가 참조하는 keyword id는 어떤 액션도 바꾸지 않는다.

export type KeywordDictionaryResult = { ok: true; value: KeywordDictionary } | { ok: false; error: string };
type Client = Awaited<ReturnType<typeof requireAdmin>>["supabase"];

const fail = (error: string): KeywordDictionaryResult => ({ ok: false, error });
const FOLDER_NAME_MAX = 60;

function mapError(e: { code?: string; message: string }, dupMessage: string): string {
  return e.code === "23505" ? dupMessage : e.message;
}

async function done(supabase: Client, subjectId: string): Promise<KeywordDictionaryResult> {
  try {
    return { ok: true, value: await loadKeywordDictionary(supabase, subjectId) };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "목록을 불러오지 못했습니다.");
  }
}

async function subjectOfFolder(supabase: Client, folderId: string): Promise<string | null> {
  const { data } = await supabase.from("subject_keyword_folders").select("subject_id").eq("id", folderId).maybeSingle();
  return (data?.subject_id as string | undefined) ?? null;
}
async function subjectOfKeyword(supabase: Client, keywordId: string): Promise<string | null> {
  const { data } = await supabase.from("subject_keywords").select("subject_id").eq("id", keywordId).maybeSingle();
  return (data?.subject_id as string | undefined) ?? null;
}

function cleanName(raw: string): string | null {
  const name = raw.trim().replace(/\s+/g, " ");
  return name && name.length <= FOLDER_NAME_MAX ? name : null;
}

export async function createKeywordFolder(subjectId: string, name: string): Promise<KeywordDictionaryResult> {
  const { supabase } = await requireAdmin();
  const clean = cleanName(name);
  if (!clean) return fail(`폴더 이름을 입력해주세요(최대 ${FOLDER_NAME_MAX}자).`);
  const { data: last } = await supabase
    .from("subject_keyword_folders")
    .select("position")
    .eq("subject_id", subjectId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await supabase
    .from("subject_keyword_folders")
    .insert({ subject_id: subjectId, name: clean, position: ((last?.position as number | undefined) ?? -1) + 1 });
  if (error) return fail(mapError(error, "이미 있는 폴더 이름입니다."));
  return done(supabase, subjectId);
}

export async function renameKeywordFolder(folderId: string, name: string): Promise<KeywordDictionaryResult> {
  const { supabase } = await requireAdmin();
  const clean = cleanName(name);
  if (!clean) return fail(`폴더 이름을 입력해주세요(최대 ${FOLDER_NAME_MAX}자).`);
  const subjectId = await subjectOfFolder(supabase, folderId);
  if (!subjectId) return fail("폴더를 찾을 수 없습니다.");
  const { error } = await supabase.from("subject_keyword_folders").update({ name: clean }).eq("id", folderId);
  if (error) return fail(mapError(error, "이미 있는 폴더 이름입니다."));
  return done(supabase, subjectId);
}

/** 폴더만 삭제한다. 키워드는 FK(on delete set null)로 "기타"가 되고 회차 연결은 그대로다. */
export async function deleteKeywordFolder(folderId: string): Promise<KeywordDictionaryResult> {
  const { supabase } = await requireAdmin();
  const subjectId = await subjectOfFolder(supabase, folderId);
  if (!subjectId) return fail("폴더를 찾을 수 없습니다.");
  const { error } = await supabase.from("subject_keyword_folders").delete().eq("id", folderId);
  if (error) return fail(error.message);
  return done(supabase, subjectId);
}

export async function reorderKeywordFolders(subjectId: string, orderedFolderIds: string[]): Promise<KeywordDictionaryResult> {
  const { supabase } = await requireAdmin();
  for (let i = 0; i < orderedFolderIds.length; i++) {
    const { error } = await supabase
      .from("subject_keyword_folders")
      .update({ position: i })
      .eq("id", orderedFolderIds[i])
      .eq("subject_id", subjectId);
    if (error) return fail(error.message);
  }
  return done(supabase, subjectId);
}

/** 키워드를 폴더로 옮긴다(folderId=null은 "기타"). 대상 폴더의 맨 끝에 놓는다. */
export async function moveKeywordToFolder(keywordId: string, folderId: string | null): Promise<KeywordDictionaryResult> {
  const { supabase } = await requireAdmin();
  const subjectId = await subjectOfKeyword(supabase, keywordId);
  if (!subjectId) return fail("키워드를 찾을 수 없습니다.");
  let q = supabase.from("subject_keywords").select("sort_order").eq("subject_id", subjectId);
  q = folderId ? q.eq("folder_id", folderId) : q.is("folder_id", null);
  const { data: last } = await q.order("sort_order", { ascending: false }).limit(1).maybeSingle();
  const { error } = await supabase
    .from("subject_keywords")
    .update({ folder_id: folderId, sort_order: ((last?.sort_order as number | undefined) ?? 0) + 1 })
    .eq("id", keywordId);
  if (error) return fail(error.message.includes("keyword_folder_subject_mismatch") ? "다른 과목의 폴더로는 옮길 수 없습니다." : error.message);
  return done(supabase, subjectId);
}

/** 한 폴더(또는 "기타") 안의 키워드 순서를 저장한다. */
export async function reorderKeywordsInFolder(subjectId: string, orderedKeywordIds: string[]): Promise<KeywordDictionaryResult> {
  const { supabase } = await requireAdmin();
  for (let i = 0; i < orderedKeywordIds.length; i++) {
    const { error } = await supabase
      .from("subject_keywords")
      .update({ sort_order: i + 1 })
      .eq("id", orderedKeywordIds[i])
      .eq("subject_id", subjectId);
    if (error) return fail(error.message);
  }
  return done(supabase, subjectId);
}

/** 키워드를 만들면서 폴더를 고른다(folderId=null은 "기타"). */
export async function createKeywordInFolder(subjectId: string, label: string, folderId: string | null): Promise<KeywordDictionaryResult> {
  const { supabase } = await requireAdmin();
  const clean = label.trim();
  if (!clean) return fail("키워드 이름을 입력해주세요.");
  const { error } = await supabase.from("subject_keywords").insert({ subject_id: subjectId, label: clean, folder_id: folderId });
  if (error) return fail(mapError(error, "이미 존재하는 키워드입니다."));
  return done(supabase, subjectId);
}

// 회차·교재·문제 등에서 참조 중인 키워드는 삭제하지 않는다(FK cascade로 연결이 조용히 사라지는 것을 막는다).
const REFERENCE_TABLES = [
  "subject_template_unit_keywords",
  "teacher_curriculum_template_unit_keywords",
  "curriculum_overlay_unit_keywords",
  "session_prepared_selection_unit_keywords",
  "curriculum_doc_section_keywords",
  "problem_keywords",
] as const;

export async function deleteSubjectKeyword(keywordId: string): Promise<KeywordDictionaryResult> {
  const { supabase } = await requireAdmin();
  const subjectId = await subjectOfKeyword(supabase, keywordId);
  if (!subjectId) return fail("키워드를 찾을 수 없습니다.");
  for (const table of REFERENCE_TABLES) {
    const { count, error } = await supabase.from(table).select("keyword_id", { count: "exact", head: true }).eq("keyword_id", keywordId);
    if (error) return fail(error.message);
    if ((count ?? 0) > 0) return fail("회차·교재·문제에서 사용 중인 키워드는 삭제할 수 없습니다. 폴더를 옮기거나 이름을 바꿔주세요.");
  }
  const { count: docs } = await supabase.from("curriculum_docs").select("id", { count: "exact", head: true }).eq("primary_keyword_id", keywordId);
  if ((docs ?? 0) > 0) return fail("교재의 대표 키워드로 사용 중인 키워드는 삭제할 수 없습니다.");
  const { error } = await supabase.from("subject_keywords").delete().eq("id", keywordId);
  if (error) return fail(error.message.includes("ap_official_keyword_protected") ? "공식 CED 키워드는 삭제할 수 없습니다. 이름만 바꿀 수 있습니다." : error.message);
  return done(supabase, subjectId);
}
