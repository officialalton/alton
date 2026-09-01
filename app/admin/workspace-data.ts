import type { SupabaseClient } from "@supabase/supabase-js";

export type WorkspaceProvisioningItem = {
  id: string;
  workspaceEmail: string;
  personalContactEmail: string;
  status: string;
  linkedTeacherId: string | null;
  linkedTeacherName: string | null;
  createdAt: string;
  workspaceCreatedAt: string | null;
  firstLoginAt: string | null;
  linkedAt: string | null;
};

export async function loadWorkspaceProvisionings(
  supabase: SupabaseClient
): Promise<WorkspaceProvisioningItem[]> {
  const { data } = await supabase
    .from("teacher_workspace_provisioning")
    .select(
      "id, workspace_email, personal_contact_email, status, linked_teacher_id, created_at, workspace_created_at, first_login_at, linked_at, teacher:teachers(profile:profiles(name))"
    )
    .order("created_at", { ascending: false });

  return (data ?? []).map((row) => ({
    id: row.id,
    workspaceEmail: row.workspace_email,
    personalContactEmail: row.personal_contact_email,
    status: row.status,
    linkedTeacherId: row.linked_teacher_id,
    linkedTeacherName: extractName(row.teacher),
    createdAt: row.created_at,
    workspaceCreatedAt: row.workspace_created_at,
    firstLoginAt: row.first_login_at,
    linkedAt: row.linked_at,
  }));
}

function extractName(rel: unknown): string | null {
  const teacherRow = Array.isArray(rel) ? rel[0] : rel;
  const profileRow = (teacherRow as { profile?: unknown } | null)?.profile;
  const profile = Array.isArray(profileRow) ? profileRow[0] : profileRow;
  return (profile as { name?: string } | null)?.name ?? null;
}
