"use server";

import { requireStudentFeature } from "@/lib/feature-access";
import type { NotebookFolder } from "@/lib/notebook/model";

// 2026-10-08 My Notebook — 개인 폴더·문제 배정. RLS 가 student_id = auth.uid() 만 허용한다(본인 세션 클라이언트).
// 폴더를 지워도 문제는 지워지지 않는다: 배정 행만 cascade 로 사라져 문제는 Unfiled 로 돌아간다.

type ActionResult<T = undefined> = { ok: true; value: T } | { ok: false; error: string };
export type NotebookState = { folders: NotebookFolder[]; assignments: Record<string, string> };

const MAX_NAME = 40;

function cleanName(name: string): { ok: true; value: string } | { ok: false; error: string } {
  const v = name.trim().replace(/\s+/g, " ");
  if (!v) return { ok: false, error: "Enter a folder name." };
  if (v.length > MAX_NAME) return { ok: false, error: `Folder names can be up to ${MAX_NAME} characters.` };
  return { ok: true, value: v };
}

function folderError(error: { code?: string; message?: string }, fallback: string): string {
  if (error.code === "23505") return "A folder with that name already exists.";
  if (error.message?.includes("up to 30 folders")) return "You can have up to 30 folders.";
  return fallback;
}

export async function loadNotebookStateAction(): Promise<NotebookState> {
  const { user, supabase } = await requireStudentFeature("problem_log");
  await supabase.rpc("ensure_default_notebook_folder", { p_student_id: user.id });
  const [{ data: folders }, { data: rows }] = await Promise.all([
    supabase.from("student_notebook_folders").select("id, name, is_default").eq("student_id", user.id).order("is_default", { ascending: false }).order("position").order("created_at"),
    supabase.from("student_notebook_assignments").select("problem_key, folder_id").eq("student_id", user.id).limit(5000),
  ]);
  return {
    folders: (folders ?? []).map((f) => ({ id: f.id as string, name: f.name as string, isDefault: f.is_default as boolean })),
    assignments: Object.fromEntries((rows ?? []).map((r) => [r.problem_key as string, r.folder_id as string])),
  };
}

export async function createNotebookFolderAction(name: string): Promise<ActionResult<NotebookFolder>> {
  const { user, supabase } = await requireStudentFeature("problem_log");
  const n = cleanName(name);
  if (!n.ok) return n;
  const { data, error } = await supabase.from("student_notebook_folders").insert({ student_id: user.id, name: n.value, position: Date.now() % 1_000_000_000 }).select("id, name, is_default").single();
  if (error) return { ok: false, error: folderError(error, "Couldn't create the folder.") };
  return { ok: true, value: { id: data.id as string, name: data.name as string, isDefault: false } };
}

export async function renameNotebookFolderAction(folderId: string, name: string): Promise<ActionResult<{ name: string }>> {
  const { user, supabase } = await requireStudentFeature("problem_log");
  const n = cleanName(name);
  if (!n.ok) return n;
  const { data, error } = await supabase.from("student_notebook_folders").update({ name: n.value }).eq("id", folderId).eq("student_id", user.id).select("id").maybeSingle();
  if (error) return { ok: false, error: folderError(error, "Couldn't rename the folder.") };
  if (!data) return { ok: false, error: "This folder can't be renamed." };
  return { ok: true, value: { name: n.value } };
}

export async function deleteNotebookFolderAction(folderId: string): Promise<ActionResult> {
  const { user, supabase } = await requireStudentFeature("problem_log");
  const { data, error } = await supabase.from("student_notebook_folders").delete().eq("id", folderId).eq("student_id", user.id).select("id").maybeSingle();
  if (error) return { ok: false, error: "Couldn't delete the folder." };
  if (!data) return { ok: false, error: "This folder can't be deleted." };
  return { ok: true, value: undefined };
}

/** 문제를 폴더로 옮기거나(folderId) 폴더에서 뺀다(null → Unfiled). */
export async function moveNotebookProblemAction(problemKey: string, folderId: string | null): Promise<ActionResult> {
  const { user, supabase } = await requireStudentFeature("problem_log");
  if (!problemKey || problemKey.length > 200) return { ok: false, error: "Couldn't move this problem." };
  if (folderId === null) {
    const { error } = await supabase.from("student_notebook_assignments").delete().eq("student_id", user.id).eq("problem_key", problemKey);
    return error ? { ok: false, error: "Couldn't move this problem." } : { ok: true, value: undefined };
  }
  const { error } = await supabase.from("student_notebook_assignments").upsert({ student_id: user.id, problem_key: problemKey, folder_id: folderId }, { onConflict: "student_id,problem_key" });
  return error ? { ok: false, error: "Couldn't move this problem." } : { ok: true, value: undefined };
}
