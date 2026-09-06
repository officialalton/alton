import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { sendEmail, escapeHtml } from "@/lib/email";

// M4 (6/N) — 신규 보호자 계정 실제 생성 + finalize + /set-password 리다이렉트를
// 공통 헬퍼로 뺐다. "prospect 이메일 그대로 유지"와 "다른 이메일로 변경 후 확인
// 완료" 두 경로(app/api/trial-onboarding/confirm-email/route.ts,
// app/api/trial-onboarding/confirm-email-change/route.ts) 둘 다 이 함수로
// 수렴한다 — 계정 생성 로직이 두 곳에 따로 존재하며 갈라지는 것을 막기 위함.
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
  // 상담을 신청한 경우) 새 계정 생성을 시도하지 않는다 — 실패 시 원인 불명
  // 오류만 보이고, 성공하더라도 같은 사람에게 별개의 household가 또 생겨버린다.
  // 이 라우트에 도달했다는 사실 자체가 이미 이메일 접근 확인이므로(신규 보호자
  // 경로와 동일한 신뢰 모델) 별도 재인증 없이 기존 계정에 새 자녀를 연결한다.
  const existingGuardianId = await admin.rpc("find_auth_user_id_by_email", { p_email: params.guardianEmail });
  if (existingGuardianId.error) {
    console.error("기존 보호자 계정 확인 실패:", params.guardianEmail, existingGuardianId.error);
    return redirectWithError(params.url, "계정 확인에 실패했습니다. 관리자에게 문의해주세요.");
  }

  const isNewGuardian = !existingGuardianId.data;
  let guardianAuthUserId: string;

  if (!isNewGuardian) {
    guardianAuthUserId = existingGuardianId.data as string;
  } else {
    // 2026-09-06(실제 버그 수정 — matchbox512@snu.ac.kr 상담건 non-prod
    // 실측 재현) — 예전에 이 이메일로 계정이 있었다가 병합(merge-actions.ts
    // anonymizeMergedAccount())으로 삭제된 경우, auth.users의 이메일은
    // 스크럽됐지만 auth.identities에는 옛 이메일이 좀비로 남아 있을 수
    // 있다(GoTrue가 identities는 정리하지 않음). find_auth_user_id_by_email()은
    // auth.users만 보므로 이 좀비를 못 잡고 "신규 보호자"로 판단하지만, 바로
    // 아래 createUser()는 auth.identities의 유니크 제약에 걸려 항상 실패한다
    // — 새 계정 생성 시도 직전에 먼저 정리해 이 경로를 막지 않는다.
    await admin.rpc("cleanup_orphaned_auth_identities", { p_email: params.guardianEmail }).then(
      (r) => {
        if (r.error) console.error("좀비 auth.identities 정리 실패(계속 진행):", params.guardianEmail, r.error);
      }
    );
    const { data: guardianCreated, error: guardianCreateError } = await admin.auth.admin.createUser({
      email: params.guardianEmail,
      email_confirm: true,
      user_metadata: { name: params.guardianName },
    });
    if (guardianCreateError || !guardianCreated?.user) {
      // 2026-09-06(실제 버그 수정) — 여기서 원래 에러(예: GoTrue의
      // "Unable to validate email address: invalid format", 이메일 앞뒤
      // 공백이 섞여 들어온 경우 발생)를 그대로 삼키고 있었다. 이 route.ts는
      // Server Action이 아니라 Next.js Route Handler라 #441류 마스킹과는
      // 무관하지만, 서버 콘솔에조차 실제 원인이 남지 않아 재현·진단이
      // 불가능했다 — 근본 원인(app/admin/trial-onboarding-actions.ts의
      // guardianEmail trim 누락)은 별도로 고쳤지만, 앞으로 같은 종류의
      // 실패가 다시 생기더라도 원인을 바로 알 수 있도록 로그를 남긴다.
      console.error("보호자 Auth 계정 생성 실패:", params.guardianEmail, guardianCreateError);
      return redirectWithError(params.url, "보호자 계정 생성에 실패했습니다. 관리자에게 문의해주세요.");
    }
    guardianAuthUserId = guardianCreated.user.id;
  }

  // 링크에 딸린 학생 1~N명 명단 — 아직 처리 안 된(created가 아닌) 학생만
  // Auth 계정을 만든다(재시도/재입장 시 이미 성공한 형제자매를 다시 만들지 않음).
  const { data: students, error: studentsError } = await admin.rpc("get_trial_onboarding_link_students", {
    p_link_id: params.linkId,
  });
  if (studentsError || !students?.length) {
    console.error("온보딩 학생 명단 조회 실패:", params.linkId, studentsError);
    return redirectWithError(params.url, "온보딩 학생 명단을 찾을 수 없습니다. 관리자에게 문의해주세요.");
  }

  const finalizeItems: { link_student_id: string; child_auth_user_id: string }[] = [];
  const createdStudentAuthIdsThisRequest: string[] = [];
  for (const s of students) {
    if (s.status === "created" && s.child_auth_user_id) {
      finalizeItems.push({ link_student_id: s.id, child_auth_user_id: s.child_auth_user_id });
      continue;
    }
    await admin.rpc("cleanup_orphaned_auth_identities", { p_email: s.student_email }).then(
      (r) => {
        if (r.error) console.error("좀비 auth.identities 정리 실패(계속 진행):", s.student_email, r.error);
      }
    );
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
    return redirectWithError(params.url, "학생 계정 생성에 실패했습니다. 관리자에게 문의해주세요.");
  }

  const { data: finalizeData, error: finalizeError } = await admin.rpc("finalize_trial_onboarding_students", {
    p_link_id: params.linkId,
    p_new_guardian: isNewGuardian,
    p_guardian_auth_user_id: guardianAuthUserId,
    p_guardian_name: params.guardianName,
    p_students: finalizeItems,
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

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "recovery",
    email: params.guardianEmail,
  });
  if (linkError || !linkData?.properties?.hashed_token) {
    return redirectWithError(params.url, "로그인 링크 생성에 실패했습니다. 관리자에게 문의해주세요.");
  }

  return NextResponse.redirect(
    new URL(
      `/set-password?role=parent&token_hash=${encodeURIComponent(linkData.properties.hashed_token)}&type=recovery`,
      params.url
    )
  );
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
