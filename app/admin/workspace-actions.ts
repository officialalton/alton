"use server";

import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-admin";
import {
  createWorkspaceUser,
  suspendWorkspaceUser,
  reactivateWorkspaceUser,
} from "@/lib/google-workspace";
import { sendWorkspaceProvisioningEmail } from "@/lib/invite-email";

const TEST_OU_PATH = "/Alton Integration Sandbox/Teachers";

// R2 Task 7 — 관리자가 선생님 Google Workspace 계정 프로비저닝을 시작한다.
// DB의 begin_teacher_workspace_provisioning()이 idempotency_key를 고정하고
// (재시도 시 재사용), 이 함수는 그 레코드를 기준으로 Directory API를
// 호출한다. 실패 시 재시도 가능/불가능을 분류해 기록하고, 성공 시 안내
// 메일을 보낸 뒤 first_login_pending으로 전이한다.
export async function startTeacherWorkspaceProvisioning(params: {
  workspaceEmail: string;
  personalContactEmail: string;
  workspaceRecoveryEmail: string;
  personalPhone: string | null;
  givenName: string;
  familyName: string;
}): Promise<void> {
  const { supabase } = await requireAdmin();

  const { data: provisioning, error: beginError } = await supabase.rpc(
    "begin_teacher_workspace_provisioning",
    {
      p_workspace_email: params.workspaceEmail,
      p_personal_contact_email: params.personalContactEmail,
      p_workspace_recovery_email: params.workspaceRecoveryEmail,
      p_personal_phone: params.personalPhone,
    }
  );
  if (beginError) throw new Error(beginError.message);

  // 재시도인데 이미 Directory API 생성까지는 성공했던 경우(예: 생성 성공
  // 직후 기록 단계에서 프로세스가 죽은 경우) 중복 생성을 피하기 위해
  // 이미 google_user_id가 있으면 생성 호출 자체를 건너뛰고 이어서
  // 초대 메일 발송부터 재개한다.
  if (provisioning.workspace_google_user_id) {
    await resumeAfterCreation(supabase, provisioning);
    return;
  }

  let created: Awaited<ReturnType<typeof createWorkspaceUser>>;
  try {
    created = await createWorkspaceUser({
      workspaceEmail: params.workspaceEmail,
      givenName: params.givenName,
      familyName: params.familyName,
      orgUnitPath: TEST_OU_PATH,
    });
  } catch (e) {
    // 네트워크/전파 지연 등은 재시도 가능한 실패로 분류한다 — 영구 실패로
    // 취급하지 않는다.
    const { error } = await supabase.rpc("record_workspace_creation_failed", {
      p_provisioning_id: provisioning.id,
      p_reason: e instanceof Error ? e.message : "알 수 없는 오류",
      p_retryable: true,
    });
    if (error) throw new Error(error.message);
    throw e;
  }

  if (created.conflict) {
    // unmanaged/충돌 계정은 자동 병합하지 않는다.
    const { error } = await supabase.rpc("record_workspace_creation_failed", {
      p_provisioning_id: provisioning.id,
      p_reason: "Directory API 409 conflict — 이미 존재하는 이메일",
      p_retryable: false,
    });
    if (error) throw new Error(error.message);
    return;
  }

  const { error: recordError } = await supabase.rpc("record_workspace_created", {
    p_provisioning_id: provisioning.id,
    p_google_user_id: created.googleUserId,
  });
  if (recordError) throw new Error(recordError.message);

  await sendWorkspaceProvisioningEmail({
    to: params.personalContactEmail,
    workspaceEmail: params.workspaceEmail,
  });

  const { error: sentError } = await supabase.rpc("mark_workspace_invite_sent", {
    p_provisioning_id: provisioning.id,
  });
  if (sentError) throw new Error(sentError.message);
}

type ProvisioningRow = {
  id: string;
  status: string;
  workspace_email: string;
  personal_contact_email: string;
  workspace_google_user_id: string;
};

async function resumeAfterCreation(
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"],
  provisioning: ProvisioningRow
): Promise<void> {
  if (provisioning.status === "creating") {
    const { error } = await supabase.rpc("record_workspace_created", {
      p_provisioning_id: provisioning.id,
      p_google_user_id: provisioning.workspace_google_user_id,
    });
    if (error) throw new Error(error.message);
  }
  if (provisioning.status !== "first_login_pending") {
    await sendWorkspaceProvisioningEmail({
      to: provisioning.personal_contact_email,
      workspaceEmail: provisioning.workspace_email,
    });
    const { error } = await supabase.rpc("mark_workspace_invite_sent", {
      p_provisioning_id: provisioning.id,
    });
    if (error) throw new Error(error.message);
  }
}

// 선생님 활동 중단 — 계정 삭제가 아니라 Workspace suspend + ALTON inactive.
export async function suspendTeacher(teacherId: string, reason: string): Promise<void> {
  const { supabase } = await requireAdmin();
  if (!reason.trim()) throw new Error("중단 사유를 입력해주세요.");

  const { data: teacher, error: fetchError } = await supabase
    .from("teachers")
    .select("workspace_google_user_id")
    .eq("id", teacherId)
    .single();
  if (fetchError) throw new Error(fetchError.message);

  if (teacher.workspace_google_user_id) {
    await suspendWorkspaceUser(teacher.workspace_google_user_id);
  }

  const { error: provError } = await supabase.rpc("suspend_teacher_workspace", {
    p_teacher_id: teacherId,
    p_reason: reason,
  });
  if (provError) throw new Error(provError.message);

  const { error: statusError } = await supabase.rpc("transition_account_status", {
    p_profile_id: teacherId,
    p_new_status: "inactive",
    p_reason: reason,
  });
  if (statusError) throw new Error(statusError.message);
}

// 선생님 복귀 — 기존 Workspace/teacher/profile UUID 재사용, 새 시급 이력
// 생성. 과거 시급·배정·정산 이력은 변경하지 않는다.
export async function reactivateTeacher(params: {
  teacherId: string;
  reason: string;
  newRateAmountMinor: number;
  newRateCurrency: string;
}): Promise<void> {
  const { supabase } = await requireAdmin();
  if (!params.reason.trim()) throw new Error("복귀 사유를 입력해주세요.");

  const { data: teacher, error: fetchError } = await supabase
    .from("teachers")
    .select("workspace_google_user_id")
    .eq("id", params.teacherId)
    .single();
  if (fetchError) throw new Error(fetchError.message);

  if (teacher.workspace_google_user_id) {
    await reactivateWorkspaceUser(teacher.workspace_google_user_id);
  }

  const { error: provError } = await supabase.rpc("reactivate_teacher_workspace", {
    p_teacher_id: params.teacherId,
    p_reason: params.reason,
  });
  if (provError) throw new Error(provError.message);

  // set_teacher_rate()는 service_role 전용이라 관리자 세션 client가 아니라
  // 별도 admin client(app/admin/users-actions.ts와 동일 패턴)로 호출한다.
  const admin = createAdminClient();
  const { error: rateError } = await admin.rpc("set_teacher_rate", {
    p_teacher_id: params.teacherId,
    p_amount_minor: params.newRateAmountMinor,
    p_currency: params.newRateCurrency,
  });
  if (rateError) throw new Error(rateError.message);

  const { error: statusError } = await supabase.rpc("transition_account_status", {
    p_profile_id: params.teacherId,
    p_new_status: "active",
    p_reason: params.reason,
  });
  if (statusError) throw new Error(statusError.message);
}

export async function getTeacherActivationChecklist(teacherId: string) {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.rpc("get_teacher_activation_checklist", {
    p_teacher_id: teacherId,
  });
  if (error) throw new Error(error.message);
  return data as { condition: string; satisfied: boolean; evidence_at: string | null }[];
}
