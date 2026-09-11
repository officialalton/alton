import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { sendEmail, escapeHtml } from "@/lib/email";

// M4 (6/N) — 신규 보호자 계정 실제 생성 + finalize + /set-password 리다이렉트를
// 공통 헬퍼로 뺐다. "prospect 이메일 그대로 유지"와 "다른 이메일로 변경 후 확인
// 완료" 두 경로(app/api/trial-onboarding/confirm-email/route.ts,
// app/api/trial-onboarding/confirm-email-change/route.ts) 둘 다 이 함수로
// 수렴한다 — 계정 생성 로직이 두 곳에 따로 존재하며 갈라지는 것을 막기 위함.
//
// 2026-09-11(실제 버그 수정 — 공유 non-prod 실측 재현, matchbox512+alton-uat-p8@gmail.com,
// 제품 오너 재검토 반영) — 경쟁·부분 실패 보호는 "새 보호자 Auth 계정을
// 만드는 경로"에만 건다(기존 보호자에게 자녀를 추가하는 경로는 새 Auth
// 계정을 만들지 않으므로 이 경쟁 자체가 없다 — 여기에까지 claim을 걸면
// 이미 redeemed된 링크로 형제자매를 나중에 추가하는 정상 흐름이 막힌다).
// claim_trial_onboarding_link_finalize()가 매번 새 claim_id(세대 값)를
// 발급하고, 이후의 모든 쓰기(record_pending_guardian_account,
// release_trial_onboarding_link_finalize_claim, finalize_trial_onboarding_students의
// 신규 보호자 경로)가 그 claim_id를 함께 제시해야만 반영된다 — 리스가
// 만료돼 다른 요청이 새 claim_id로 넘겨받은 뒤 이전 요청이 뒤늦게 도착해도
// 새 리스를 건드리지 못한다.
export async function createGuardianAndStudentThenRedirect(params: {
  url: URL;
  linkId: string;
  guardianEmail: string;
  guardianName: string;
  // 2026-09-06(복수 자녀 온보딩) — studentEmail/studentName 단일 필드는 더 이상
  // 받지 않는다. 링크에 딸린 학생 1~N명은 trial_onboarding_link_students에서
  // 직접 조회한다(관리자가 발송 시점에 이미 입력해둔 값, 재입력 불필요).
}): Promise<NextResponse> {
  const admin = createAdminClient();

  // 2026-09-06 추가(재상담 — 제품 오너 확정) — 이 온보딩 이메일로 이미 보호자
  // Auth 계정이 있으면(예: 예전에 다른 자녀로 체험/정규 전환을 마친 사람이 다시
  // 상담을 신청한 경우) 새 계정 생성을 시도하지 않는다. 새 Auth 계정을 만드는
  // 경로가 아니므로 claim/lease도 필요 없다 — 형제자매를 나중에 추가하는
  // 정상적인 재진입도 이 분기로 그대로 처리된다(링크가 이미 redeemed여도 OK).
  const existingGuardianId = await admin.rpc("find_auth_user_id_by_email", { p_email: params.guardianEmail });
  if (existingGuardianId.error) {
    console.error("기존 보호자 계정 확인 실패:", params.guardianEmail, existingGuardianId.error);
    return redirectWithError(params.url, "계정 확인에 실패했습니다. 관리자에게 문의해주세요.");
  }
  if (existingGuardianId.data) {
    const hasProfile = await admin
      .from("profiles")
      .select("id")
      .eq("id", existingGuardianId.data as string)
      .eq("role", "parent")
      .maybeSingle();
    if (hasProfile.data) {
      return finalizeWithGuardian(admin, params, {
        guardianAuthUserId: existingGuardianId.data as string,
        isNewGuardian: false,
        claimId: null,
      });
    }
    // Auth 계정은 있는데 profiles가 없다 — 이 이메일로 만들어진 진짜 "무관한
    // 기존 계정"일 수도 있고, 이전 시도가 createUser() 성공 직후(record_pending
    // 호출 전) 죽어서 남은 이 온보딩 자신의 고아 계정일 수도 있다. 이메일이
    // 같다는 사실만으로는 구분할 수 없으므로, createUser() 시점에 남겨둔
    // raw_user_meta_data.trial_onboarding_link_id로 실제 소유를 증명한다.
    const { data: orphanUser, error: orphanError } = await admin.auth.admin.getUserById(existingGuardianId.data as string);
    if (orphanError || orphanUser?.user?.user_metadata?.trial_onboarding_link_id !== params.linkId) {
      return redirectWithError(params.url, "이미 사용 중인 이메일입니다. 관리자에게 문의해주세요.");
    }
    // 이 온보딩이 직전 시도에서 만든 고아 계정임이 증명됐다 — claim을 잡고
    // (동시 재시도 직렬화) 이 계정을 재사용해 이어서 완료한다.
    return withClaim(admin, params, existingGuardianId.data as string);
  }

  return withClaim(admin, params, null);
}

// claim을 잡고 신규(혹은 증명된 고아) 보호자 계정 생성/재사용 경로를 진행한다.
async function withClaim(
  admin: ReturnType<typeof createAdminClient>,
  params: { url: URL; linkId: string; guardianEmail: string; guardianName: string },
  provenOrphanAuthUserId: string | null
): Promise<NextResponse> {
  const { data: claimData, error: claimError } = await admin.rpc("claim_trial_onboarding_link_finalize", {
    p_link_id: params.linkId,
  });
  if (claimError) {
    console.error("온보딩 링크 claim 실패:", params.linkId, claimError);
    return redirectWithError(params.url, mapClaimError(claimError.message));
  }
  const claim = claimData?.[0];
  if (!claim) {
    return redirectWithError(params.url, "유효하지 않은 온보딩 링크입니다.");
  }
  if (claim.action === "busy") {
    return redirectWithError(params.url, "지금 다른 요청이 이 링크를 처리하고 있습니다. 잠시 후 다시 시도해주세요.");
  }
  if (claim.action === "already_redeemed") {
    if (!claim.redeemed_auth_user_id) {
      return redirectWithError(params.url, "계정 상태를 확인할 수 없습니다. 관리자에게 문의해주세요.");
    }
    const { data: userData, error: userError } = await admin.auth.admin.getUserById(claim.redeemed_auth_user_id);
    if (userError || userData?.user?.email?.toLowerCase() !== params.guardianEmail.toLowerCase()) {
      return redirectWithError(params.url, "이 링크와 연결된 계정 정보가 일치하지 않습니다. 관리자에게 문의해주세요.");
    }
    return generateGuardianRecoveryRedirect(admin, params.url, params.guardianEmail);
  }

  const claimId = claim.claim_id as string;
  try {
    let guardianAuthUserId = provenOrphanAuthUserId ?? claim.pending_guardian_auth_user_id ?? null;

    if (!guardianAuthUserId) {
      // 2026-09-06(실제 버그 수정 — matchbox512@snu.ac.kr 상담건 non-prod
      // 실측 재현) — 예전에 이 이메일로 계정이 있었다가 병합(merge-actions.ts
      // anonymizeMergedAccount())으로 삭제된 경우, auth.users의 이메일은
      // 스크럽됐지만 auth.identities에는 옛 이메일이 좀비로 남아 있을 수
      // 있다(GoTrue가 identities는 정리하지 않음) — 새 계정 생성 시도 직전에
      // 먼저 정리해 이 경로를 막지 않는다.
      await admin.rpc("cleanup_orphaned_auth_identities", { p_email: params.guardianEmail }).then((r) => {
        if (r.error) console.error("좀비 auth.identities 정리 실패(계속 진행):", params.guardianEmail, r.error);
      });
      const { data: guardianCreated, error: guardianCreateError } = await admin.auth.admin.createUser({
        email: params.guardianEmail,
        email_confirm: true,
        // trial_onboarding_link_id — 이 계정이 "이 온보딩 링크가 실제로 만든
        // 계정"임을 나중에 증명하기 위한 태그(위 getUserById 기반 고아 복구
        // 로직이 참조한다). 이메일 일치만으로 무관한 계정을 재사용하지 않기
        // 위한 근거.
        user_metadata: { name: params.guardianName, trial_onboarding_link_id: params.linkId },
      });
      if (guardianCreateError || !guardianCreated?.user) {
        // 2026-09-11 — claim으로 동시 생성 시도를 직렬화했으므로, 여기서 나는
        // 중복 이메일 에러는 "우리가 막 놓친 경쟁"이 아니라 이 이메일이 이미
        // 다른(무관한) 계정에 쓰이고 있다는 뜻이다 — 조용히 그 계정으로
        // 넘어가지 않고 충돌로 처리한다.
        console.error("보호자 Auth 계정 생성 실패:", params.guardianEmail, guardianCreateError);
        await releaseFinalizeClaim(admin, params.linkId, claimId);
        return redirectWithError(params.url, "보호자 계정 생성에 실패했습니다. 관리자에게 문의해주세요.");
      }
      guardianAuthUserId = guardianCreated.user.id;
      const recorded = await admin.rpc("record_pending_guardian_account", {
        p_link_id: params.linkId,
        p_claim_id: claimId,
        p_auth_user_id: guardianAuthUserId,
      });
      if (recorded.error || recorded.data !== true) {
        // 우리가 방금 만든 계정을 기록하기 전에 리스가 이미 다른 요청에게
        // 넘어갔다(=매우 좁은 창이지만, 우리 쪽 앱 프로세스가 createUser()
        // 성공 직후 이 호출 사이에서 멈췄던 경우) — 이 계정은 더 이상 우리
        // 소유가 아니므로 고아로 만들지 않고 즉시 정리한다.
        console.error("claim 소유권 상실 — 방금 만든 보호자 계정을 정리합니다:", guardianAuthUserId, recorded.error);
        await admin.auth.admin.deleteUser(guardianAuthUserId).catch((e) => {
          console.error("고아 보호자 Auth 계정 정리 실패:", guardianAuthUserId, e);
        });
        return redirectWithError(params.url, "처리 중 충돌이 발생했습니다. 다시 시도해주세요.");
      }
    }

    return await finalizeWithGuardian(admin, params, { guardianAuthUserId, isNewGuardian: true, claimId });
  } catch (e) {
    await releaseFinalizeClaim(admin, params.linkId, claimId);
    console.error("온보딩 finalize 중 예외:", params.linkId, e);
    return redirectWithError(params.url, "계정 생성 중 오류가 발생했습니다. 관리자에게 문의해주세요.");
  }
}

function mapClaimError(message: string): string {
  if (message.includes("revoked_link")) return "취소된 온보딩 링크입니다. 관리자에게 문의해주세요.";
  if (message.includes("expired_link")) return "만료된 온보딩 링크입니다. 관리자에게 재발급을 요청해주세요.";
  if (message.includes("invalid_link_status")) return "이미 처리됐거나 유효하지 않은 온보딩 링크입니다.";
  return "유효하지 않은 온보딩 링크입니다.";
}

async function releaseFinalizeClaim(
  admin: ReturnType<typeof createAdminClient>,
  linkId: string,
  claimId: string
): Promise<void> {
  await admin.rpc("release_trial_onboarding_link_finalize_claim", { p_link_id: linkId, p_claim_id: claimId }).then((r) => {
    if (r.error) console.error("온보딩 링크 claim 해제 실패(다음 재시도는 리스 만료까지 대기):", linkId, r.error);
  });
}

async function generateGuardianRecoveryRedirect(
  admin: ReturnType<typeof createAdminClient>,
  url: URL,
  guardianEmail: string
): Promise<NextResponse> {
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "recovery",
    email: guardianEmail,
  });
  if (linkError || !linkData?.properties?.hashed_token) {
    return redirectWithError(url, "로그인 링크 생성에 실패했습니다. 관리자에게 문의해주세요.");
  }
  return NextResponse.redirect(
    new URL(
      `/set-password?role=parent&token_hash=${encodeURIComponent(linkData.properties.hashed_token)}&type=recovery`,
      url
    )
  );
}

async function finalizeWithGuardian(
  admin: ReturnType<typeof createAdminClient>,
  params: { url: URL; linkId: string; guardianEmail: string; guardianName: string },
  guardian: { guardianAuthUserId: string; isNewGuardian: boolean; claimId: string | null }
): Promise<NextResponse> {
  const { guardianAuthUserId, isNewGuardian, claimId } = guardian;

  // 링크에 딸린 학생 1~N명 명단 — 아직 처리 안 된(created가 아닌) 학생만
  // Auth 계정을 만든다(재시도/재입장 시 이미 성공한 형제자매를 다시 만들지 않음).
  const { data: students, error: studentsError } = await admin.rpc("get_trial_onboarding_link_students", {
    p_link_id: params.linkId,
  });
  if (studentsError || !students?.length) {
    console.error("온보딩 학생 명단 조회 실패:", params.linkId, studentsError);
    if (isNewGuardian && claimId) await releaseFinalizeClaim(admin, params.linkId, claimId);
    return redirectWithError(params.url, "온보딩 학생 명단을 찾을 수 없습니다. 관리자에게 문의해주세요.");
  }

  const finalizeItems: { link_student_id: string; child_auth_user_id: string }[] = [];
  const createdStudentAuthIdsThisRequest: string[] = [];
  for (const s of students) {
    if (s.status === "created" && s.child_auth_user_id) {
      finalizeItems.push({ link_student_id: s.id, child_auth_user_id: s.child_auth_user_id });
      continue;
    }
    await admin.rpc("cleanup_orphaned_auth_identities", { p_email: s.student_email }).then((r) => {
      if (r.error) console.error("좀비 auth.identities 정리 실패(계속 진행):", s.student_email, r.error);
    });
    const { data: studentCreated, error: studentCreateError } = await admin.auth.admin.createUser({
      // 학생 본인이 이 이메일을 실제로 확인했는지는 여기서 알 수 없다 — 온보딩은
      // 보호자가 대행 입력한 값이다(이 파일 상단 주석 참고). email_confirm을 여기서
      // true로 찍으면 이후 어떤 검증도 무의미해진다(2026-09-05 코드 점검 발견 — 실제
      // 이메일 확인 게이트가 항상 통과하는 죽은 코드였음). 이 계정이 처음 비밀번호를
      // 설정할 때(app/set-password/page.tsx → confirmOwnEmailAfterPasswordSet)만
      // true로 올린다 — 그게 "본인이 실제로 이 이메일을 열어봤다"는 첫 실증 이벤트다.
      email: s.student_email,
      email_confirm: false,
      user_metadata: { name: s.student_name },
    });
    if (studentCreateError || !studentCreated?.user) {
      // 이 학생 1명만 실패로 남기고(형제자매는 계속 처리, 요구사항 7) 관리자
      // 재시도 대상이 되도록 finalize 단계에서 자연히 status='failed'로 남는다
      // (finalizeItems에 넣지 않으면 finalize_trial_onboarding_students가 이
      // 학생을 건드리지 않아 status는 pending으로 남고, 관리자 화면에서
      // "재시도"로 다시 시도할 수 있다).
      console.error("학생 계정 생성 실패(재시도 가능):", s.student_email, studentCreateError);
      continue;
    }
    createdStudentAuthIdsThisRequest.push(studentCreated.user.id);
    finalizeItems.push({ link_student_id: s.id, child_auth_user_id: studentCreated.user.id });
  }

  if (isNewGuardian && finalizeItems.length === 0) {
    // 보호자 계정은 새로 만들었는데 학생이 단 1명도 생성되지 못했다 — 고아
    // 보호자 Auth 계정을 정리한다(2026-09-05 코드 점검에서 발견된 것과 동일한
    // 원칙, 복수 자녀에서도 유지).
    await admin.auth.admin.deleteUser(guardianAuthUserId).catch((e) => {
      console.error("고아 보호자 Auth 계정 정리 실패:", guardianAuthUserId, e);
    });
    if (claimId) await releaseFinalizeClaim(admin, params.linkId, claimId);
    return redirectWithError(params.url, "학생 계정 생성에 실패했습니다. 관리자에게 문의해주세요.");
  }

  const { data: finalizeData, error: finalizeError } = await admin.rpc("finalize_trial_onboarding_students", {
    p_link_id: params.linkId,
    p_new_guardian: isNewGuardian,
    p_guardian_auth_user_id: guardianAuthUserId,
    p_guardian_name: params.guardianName,
    p_students: finalizeItems,
    p_claim_id: claimId,
  });
  if (finalizeError) {
    console.error("finalize_trial_onboarding_students 실패:", params.linkId, finalizeError);
    if (isNewGuardian) {
      await admin.auth.admin.deleteUser(guardianAuthUserId).catch((e) => {
        console.error("고아 보호자 Auth 계정 정리 실패:", guardianAuthUserId, e);
      });
    }
    await Promise.all(
      createdStudentAuthIdsThisRequest.map((id) =>
        admin.auth.admin.deleteUser(id).catch((e) => {
          console.error("고아 학생 Auth 계정 정리 실패:", id, e);
        })
      )
    );
    if (isNewGuardian && claimId) await releaseFinalizeClaim(admin, params.linkId, claimId);
    return redirectWithError(params.url, "계정 연결에 실패했습니다. 관리자에게 문의해주세요.");
  }
  const finalizeRow = finalizeData?.[0];

  // 학생별 비밀번호 설정 초대는 실제로 이번에 created 처리된 학생에게만 보낸다
  // (finalize 단계에서 개별 실패한 학생은 초대 보내지 않음 — 관리자 재시도 대상).
  const { data: refreshedStudents } = await admin.rpc("get_trial_onboarding_link_students", {
    p_link_id: params.linkId,
  });
  for (const s of refreshedStudents ?? []) {
    if (s.status === "created" && s.child_auth_user_id && s.invite_status !== "sent") {
      await sendStudentSetPasswordEmail(admin, {
        url: params.url,
        linkStudentId: s.id,
        studentEmail: s.student_email,
        studentName: s.student_name,
      });
    }
  }

  if (!isNewGuardian) {
    const label = finalizeRow && finalizeRow.failed_count > 0
      ? `자녀가 추가로 연결됐습니다(${finalizeRow.failed_count}명은 실패 — 관리자 재시도 필요). 기존 계정으로 로그인해주세요.`
      : "자녀가 추가로 연결됐습니다. 기존 계정으로 로그인해주세요.";
    return NextResponse.redirect(new URL("/login?notice=" + encodeURIComponent(label), params.url));
  }

  return generateGuardianRecoveryRedirect(admin, params.url, params.guardianEmail);
}

export function redirectWithError(url: URL, message: string): NextResponse {
  return NextResponse.redirect(new URL("/login?error=" + encodeURIComponent(message), url));
}

// 2026-09-06(복수 자녀 온보딩) — 기존 보호자 계정 재사용 경로는 이제
// createGuardianAndStudentThenRedirect() 안에 isNewGuardian=false 분기로
// 통합됐다(학생이 여러 명이면 이 경로도 N명을 함께 처리해야 하므로 별도
// 함수로 분리해두면 로직이 갈라진다 — 재상담 인수인계 문서의 우려 그대로).
// finalize_trial_onboarding_existing_guardian()(단일 학생, DB 함수 자체)는
// app/consult/existing-guardian-reconsult.integration.test.ts가 여전히
// 참조하므로 마이그레이션에서 지우지 않았다.

// 보호자는 지금 이 요청을 보낸 브라우저에서 바로 /set-password로 이어지지만,
// 학생은 별도 브라우저/기기라 학생 본인 이메일로 비밀번호 설정 링크를 보내야
// 계정을 실제로 쓸 수 있다 — 계정만 만들고 아무 안내도 없던 공백을 메운다.
// 이 발송 실패는 보호자 계정 생성 성공 자체를 막지 않는다(성공/실패 상태를
// trial_onboarding_links.student_invite_status에 남겨 관리자 화면에서 확인·
// 재발송할 수 있게 한다 — 이전에는 console.error만 남기고 아무 흔적이 없었다).
async function sendStudentSetPasswordEmail(
  admin: ReturnType<typeof createAdminClient>,
  params: { url: URL; linkStudentId: string; studentEmail: string; studentName: string }
): Promise<void> {
  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email: params.studentEmail,
  });
  if (error || !data?.properties?.hashed_token) {
    const message = error?.message ?? "링크 생성에 실패했습니다.";
    console.error("학생 비밀번호 설정 링크 생성에 실패했습니다:", params.studentEmail, error);
    await admin
      .from("trial_onboarding_link_students")
      .update({ invite_status: "failed", invite_error: message })
      .eq("id", params.linkStudentId);
    return;
  }

  const setPasswordUrl = new URL(
    `/set-password?token_hash=${encodeURIComponent(data.properties.hashed_token)}&type=recovery`,
    params.url
  );

  try {
    await sendEmail({
      to: params.studentEmail,
      subject: "[Alton Education] 학생 계정 비밀번호 설정",
      html: `
        <p>안녕하세요, ${escapeHtml(params.studentName)}님.</p>
        <p>Alton Education 학생 계정이 생성되었습니다.</p>
        <p><a href="${setPasswordUrl.toString()}">여기를 눌러 비밀번호를 설정해주세요</a></p>
        <p>본인이 요청하지 않았다면 이 메일을 무시하세요.</p>
        <p>감사합니다.<br/>Alton Education</p>
      `,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("학생 비밀번호 설정 이메일 발송에 실패했습니다:", params.studentEmail, e);
    await admin
      .from("trial_onboarding_link_students")
      .update({ invite_status: "failed", invite_error: message })
      .eq("id", params.linkStudentId);
    return;
  }

  await admin
    .from("trial_onboarding_link_students")
    .update({
      invite_status: "sent",
      invite_sent_at: new Date().toISOString(),
      invite_error: null,
    })
    .eq("id", params.linkStudentId);
}

// 관리자의 "학생 초대 재발송" 액션(app/admin/student-invite-actions.ts)이
// 재사용하는 공용 헬퍼 — 계정을 다시 만들지 않고, 이미 존재하는 학생 Auth
// 계정에 대해서만 비밀번호 설정 이메일을 다시 보낸다.
export async function resendStudentSetPasswordEmail(params: {
  url: URL;
  linkStudentId: string;
  studentEmail: string;
  studentName: string;
}): Promise<void> {
  const admin = createAdminClient();
  await sendStudentSetPasswordEmail(admin, params);
}
