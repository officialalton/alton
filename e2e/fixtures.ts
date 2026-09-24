import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";

// 공용 E2E fixture 헬퍼 — 2026-09-24.
//
// 배경: r5-subject-enrollment-flow / r5-subject-enrollment-teacher-assignment /
// m3-teacher-assignment-termination-flow / r6-lesson-booking-flow /
// problem-bank-flow / figure-template-1 / rw-structured-blocks 7개 스펙이
// 각자 조금씩 다른 코드로 공용 시드 학생(지훈/이서아)·공용 household(김민지)
// 위에 직접 contracts/subject_enrollments/teacher_assignments를 만들고
// 지웠다 — fullyParallel 아래에서 같은 계정을 동시에 여러 스펙이 건드리면
// (a) 실제 DB 유니크 제약은 없지만 "child당 active 계약 1개"라는 애플리케이션
// 가정이 깨지고 (b) admin/parent UI가 그 학생 이름으로 여러 스펙의 행을 동시에
// 렌더링해 `.first()`/`exact` 로케이터가 흔들릴 수 있었다.
//
// 이 파일은 스펙마다 실행 ID로 태깅된 전용 학부모+자녀+household를 즉석에서
//만들고(고정 seed.sql UUID 아님 — 재실행마다 새 UUID), 스펙이 끝나면 자신이
// 만든 행만 전부 삭제한다. entitlement_ledger/purchases/payment_attempts처럼
// 설계상 삭제 불가(재무 감사 이력)인 테이블은 삭제하지 않고 그대로 둔다 —
// 어차피 매 실행마다 새 household/child로 격리되니 다음 실행과 충돌하지 않는다.

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";

export function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], {
    encoding: "utf-8",
  }).trim();
}

export function psqlExpectError(sql: string): string {
  try {
    execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-t", "-A", "-c", sql], {
      encoding: "utf-8",
      stdio: ["ignore", "ignore", "pipe"],
    });
    throw new Error("expected psql to fail but it succeeded");
  } catch (e) {
    const err = e as { stderr?: Buffer; message: string };
    return err.stderr ? err.stderr.toString() : err.message;
  }
}

export function asUser(userId: string, sql: string): string {
  return psql(
    `set role authenticated; do $$ begin perform set_config('request.jwt.claim.sub', '${userId}', false); end $$; ${sql} reset role;`
  );
}

/** 이 프로세스(스펙 파일) 안에서 공유되는 실행 ID — 계정 이메일/이름 태깅용. */
export function newRunId(tag: string): string {
  return `${tag}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

export type FixtureChild = {
  id: string;
  email: string;
  name: string;
};

export type FixtureFamily = {
  runId: string;
  householdId: string;
  parentId: string;
  parentEmail: string;
  parentName: string;
  children: FixtureChild[];
};

/**
 * 전용 부모 + 자녀 N명 + household를 즉석에서 만든다. auth.users/auth.identities까지
 * 채워 실제 로그인이 필요한 브라우저 E2E에서도 쓸 수 있다(psql만 쓰는 DB-레벨 스펙은
 * 로그인이 필요 없으면 굳이 auth 행 없이 profiles만 있어도 되지만, 일관성을 위해
 * 항상 로그인 가능한 계정으로 만든다).
 */
export function createFamily(
  tag: string,
  opts: { childNames: string[]; parentName?: string }
): FixtureFamily {
  const runId = newRunId(tag);
  const parentId = randomUUID();
  const parentEmail = `e2e-${tag}-parent-${runId}@example.com`;
  const parentName = opts.parentName ?? `E2E ${tag} 보호자`;

  const childIds = opts.childNames.map(() => randomUUID());
  const childEmails = opts.childNames.map(
    (_, i) => `e2e-${tag}-child${i + 1}-${runId}@example.com`
  );

  const allIds = [parentId, ...childIds];
  const allEmails = [parentEmail, ...childEmails];

  for (let i = 0; i < allIds.length; i++) {
    // seed.sql과 동일하게 confirmation_token 등 토큰 컬럼을 빈 문자열로 명시한다 —
    // NULL로 두면 GoTrue가 로그인 시 내부적으로 실패한다(빈 문자열 스캔 실패).
    psql(`
      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change_token_new, email_change,
        email_change_token_current, phone_change, phone_change_token, reauthentication_token
      ) values (
        '00000000-0000-0000-0000-000000000000', '${allIds[i]}', 'authenticated', 'authenticated',
        '${allEmails[i]}', crypt('alton-dev-1234', gen_salt('bf')), now(),
        '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '', '', '', '', ''
      );
    `);
    psql(`
      insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
      select gen_random_uuid(), u.id, u.id::text, jsonb_build_object('sub', u.id::text, 'email', u.email), 'email', now(), now(), now()
      from auth.users u where u.id = '${allIds[i]}';
    `);
  }

  psql(`
    insert into profiles (id, role, name, phone) values ('${parentId}', 'parent', '${parentName}', null);
  `);
  const children: FixtureChild[] = opts.childNames.map((name, i) => ({
    id: childIds[i],
    email: childEmails[i],
    name,
  }));
  for (const c of children) {
    // seed.sql §13 관례와 동일하게 미성년(만 16세)으로 만든다 — 보호자 동의/
    // 프로필 완성 게이트를 건드리는 다른 로직과 어긋나지 않게 하기 위함.
    psql(`
      insert into profiles (id, role, name, phone, date_of_birth) values ('${c.id}', 'student', '${c.name}', null, (now() - interval '16 years')::date);
    `);
    psql(`
      insert into students (id, school_name, grade, sat_score, gpa, gpa_scale, target_colleges, intended_majors, profile_completed_at)
      values ('${c.id}', '서울국제학교', '10학년', 1350, 3.7, '4.0', array['Stanford University'], array['Computer Science'], now());
    `);
  }
  psql(`insert into parents (id) values ('${parentId}');`);

  const householdId = psql(
    `insert into households (primary_guardian_id) values ('${parentId}') returning id;`
  );
  psql(
    `insert into household_members (household_id, profile_id, role) values ('${householdId}', '${parentId}', 'guardian');`
  );
  for (const c of children) {
    psql(
      `insert into household_members (household_id, profile_id, role) values ('${householdId}', '${c.id}', 'child');`
    );
  }

  return { runId, householdId, parentId, parentEmail, parentName, children };
}

/** createFamily가 만든 모든 행을 삭제한다 — 재무 감사 이력 테이블은 건드리지 않는다. */
export function cleanupFamily(family: FixtureFamily) {
  const childIds = family.children.map((c) => c.id);
  const allProfileIds = [family.parentId, ...childIds];
  const idList = allProfileIds.map((id) => `'${id}'`).join(",");

  // entitlement_ledger는 설계상 INSERT-only(트리거로 UPDATE/DELETE 자체가
  // 거부됨) — 그 행이 있으면 reservations/entitlement_grants/purchases/
  // contracts/household까지 FK 때문에 물리 삭제할 수 없다(r4-purchase-flow.spec.ts
  // 와 동일한 제약). 이 household는 이번 실행 전용이라 남겨도 다음 실행과
  // 충돌하지 않으므로, ledger가 하나라도 있으면 "완전 삭제" 대신 지울 수 있는
  // 것만 지우고 contract만 void하는 경로로 남긴다.
  const hasLedgerRows = Number(
    psql(`select count(*) from entitlement_ledger where grant_id in (select id from entitlement_grants where child_id in (${idList}));`)
  ) > 0;

  psql(`delete from booking_notification_outbox where reservation_id in (select id from reservations where subject_enrollment_id in (select id from subject_enrollments where child_id in (${idList})));`);
  if (!hasLedgerRows) {
    psql(`delete from reservation_cancellations where reservation_id in (select id from reservations where subject_enrollment_id in (select id from subject_enrollments where child_id in (${idList})));`);
    psql(`delete from sessions where subject_enrollment_id in (select id from subject_enrollments where child_id in (${idList}));`);
    psql(`delete from reservations where subject_enrollment_id in (select id from subject_enrollments where child_id in (${idList}));`);
  }
  psql(`delete from curriculum_unit_prep_items where prep_id in (select id from curriculum_unit_preps where overlay_unit_id in (select id from curriculum_overlay_units where overlay_id in (select id from student_curriculum_overlays where subject_enrollment_id in (select id from subject_enrollments where child_id in (${idList})))));`);
  psql(`delete from curriculum_unit_preps where overlay_unit_id in (select id from curriculum_overlay_units where overlay_id in (select id from student_curriculum_overlays where subject_enrollment_id in (select id from subject_enrollments where child_id in (${idList}))));`);
  psql(`delete from curriculum_overlay_unit_keywords where overlay_unit_id in (select id from curriculum_overlay_units where overlay_id in (select id from student_curriculum_overlays where subject_enrollment_id in (select id from subject_enrollments where child_id in (${idList}))));`);
  psql(`delete from curriculum_overlay_units where overlay_id in (select id from student_curriculum_overlays where subject_enrollment_id in (select id from subject_enrollments where child_id in (${idList})));`);
  psql(`delete from student_curriculum_overlays where subject_enrollment_id in (select id from subject_enrollments where child_id in (${idList}));`);
  psql(`delete from document_permission_retries where subject_enrollment_id in (select id from subject_enrollments where child_id in (${idList}));`);
  psql(`delete from subject_thread_messages where thread_id in (select id from subject_threads where subject_enrollment_id in (select id from subject_enrollments where child_id in (${idList})));`);
  psql(`delete from subject_threads where subject_enrollment_id in (select id from subject_enrollments where child_id in (${idList}));`);
  psql(`delete from notifications where recipient_id in (${idList});`);

  if (hasLedgerRows) {
    psql(`update teacher_assignments set status = 'ended', effective_until = now() where subject_enrollment_id in (select id from subject_enrollments where child_id in (${idList})) and status = 'active';`);
    psql(`update subject_enrollments set status = 'terminated' where child_id in (${idList}) and status <> 'terminated';`);
    psql(`update contracts set status = 'void', voided_at = now(), void_reason = 'e2e cleanup' where household_id = '${family.householdId}' and status <> 'void';`);
    return;
  }

  psql(`delete from teacher_assignments where subject_enrollment_id in (select id from subject_enrollments where child_id in (${idList}));`);
  psql(`delete from subject_enrollments where child_id in (${idList});`);
  psql(`delete from entitlement_grants where child_id in (${idList});`);
  psql(`delete from purchases where household_id = '${family.householdId}';`);
  psql(`delete from contracts where household_id = '${family.householdId}';`);

  psql(`delete from household_members where household_id = '${family.householdId}';`);
  psql(`delete from households where id = '${family.householdId}';`);
  psql(`delete from students where id in (${idList});`);
  psql(`delete from parents where id = '${family.parentId}';`);
  psql(`delete from profiles where id in (${idList});`);
  psql(`delete from auth.identities where user_id in (${idList});`);
  psql(`delete from auth.users where id in (${idList});`);
}

export type FixtureTeacher = {
  id: string;
  email: string;
  name: string;
};

/**
 * 이 실행 전용 임시 선생님 — teacher_curriculum_templates(teacher_id, subject_id)에
 * unique 제약이 있어, r5-subject-enrollment-flow/r5-subject-enrollment-teacher-
 * assignment 두 스펙이 공용 선생님(이도현)에게 동시에 같은 (SAT Math) 조합을
 * 임시로 부여하면 병렬 실행 시 충돌한다 — 그 대신 스펙마다 전용 선생님을 만들어
 * 공용 계정을 건드리지 않는다. 유효 시급 이력까지 채워야
 * teacher_assignments_enforce_rate 트리거를 통과한다.
 */
export function createFixtureTeacher(tag: string): FixtureTeacher {
  const runId = newRunId(tag);
  const id = randomUUID();
  const email = `e2e-${tag}-teacher-${runId}@example.com`;
  const name = `E2E ${tag} 선생님`;

  psql(`
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      email_change_token_current, phone_change, phone_change_token, reauthentication_token
    ) values (
      '00000000-0000-0000-0000-000000000000', '${id}', 'authenticated', 'authenticated',
      '${email}', crypt('alton-dev-1234', gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '', '', '', '', ''
    );
  `);
  psql(`
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    select gen_random_uuid(), u.id, u.id::text, jsonb_build_object('sub', u.id::text, 'email', u.email), 'email', now(), now(), now()
    from auth.users u where u.id = '${id}';
  `);
  psql(`insert into profiles (id, role, name, phone) values ('${id}', 'teacher', '${name}', null);`);
  // teachers.status='active' 전환은 (1) enforce_teacher_active_requires_rate
  // 트리거가 유효한 현재 시급 이력을 먼저 요구하고 (2) protect_account_status
  // 트리거가 UPDATE 자체를 막고 transition_account_status()만 허용한다 —
  // INSERT 시점에 이미 active로 만들면 (1)만 걸리므로, rate 이력부터 넣고
  // 단일 INSERT로 active를 만든다(별도 UPDATE 없음).
  psql(`
    insert into teacher_rate_history (teacher_id, amount_minor, currency, effective_from)
    values ('${id}', 3000000, 'KRW', now() - interval '30 days');
  `);
  psql(`insert into teachers (id, status, hourly_rate_krw) values ('${id}', 'active', 30000);`);

  return { id, email, name };
}

/**
 * createFixtureTeacher()가 만든 선생님의 운영 커리큘럼·가용시간·배정을 지운다.
 * teacher_rate_history는 entitlement_ledger와 같은 이유로 절대 삭제할 수 없다
 * (protect_teacher_rate_history 트리거) — 그 FK 때문에 teachers/profiles/
 * auth.users까지 물리 삭제가 불가능하므로 그대로 남긴다. 실행마다 새
 * randomUUID+타임스탬프 이메일이라 다음 실행과 충돌하지 않는다(r4-purchase-
 * flow.spec.ts의 entitlement_ledger 관례와 동일).
 */
export function cleanupFixtureTeacher(teacher: FixtureTeacher) {
  psql(`delete from teacher_curriculum_template_units where template_id in (select id from teacher_curriculum_templates where teacher_id = '${teacher.id}');`);
  psql(`delete from teacher_curriculum_templates where teacher_id = '${teacher.id}';`);
  psql(`delete from teacher_availability_rules where teacher_id = '${teacher.id}';`);
  psql(`delete from teacher_assignments where teacher_id = '${teacher.id}';`);
}

/** subjectId에 대한 운영 커리큘럼(단원 1개 이상)을 부여한다 — 매칭 후보로 뜨는 최소 조건. */
export function grantOperatingCurriculum(teacherId: string, subjectId: string): string {
  const templateId = psql(
    `insert into teacher_curriculum_templates (teacher_id, subject_id) values ('${teacherId}', '${subjectId}') returning id;`
  );
  psql(
    `insert into teacher_curriculum_template_units (template_id, position, unit_title) values ('${templateId}', 1, 'E2E 확인 단원');`
  );
  return templateId;
}

export function createActiveContract(householdId: string, childId: string): string {
  return psql(
    `insert into contracts (household_id, child_id, status) values ('${householdId}', '${childId}', 'active') returning id;`
  );
}

/** contracts.status='active' + 결제완료 entitlement_grant까지 — 과목수강 활성화 선행조건. */
export function grantActiveEntitlement(
  householdId: string,
  childId: string,
  contractId: string
): { purchaseId: string; grantId: string } {
  const productId = psql(`select id from entitlement_products limit 1;`);
  const versionId = psql(
    `select id from entitlement_product_versions where entitlement_product_id = '${productId}' limit 1;`
  );
  const purchaseId = psql(
    `insert into purchases (household_id, child_id, contract_id, entitlement_product_id, product_version_id, quantity, unit_price_minor, package_price_minor, total_minor, validity_months, status)
     values ('${householdId}', '${childId}', '${contractId}', '${productId}', '${versionId}', 1, 1000, 1000, 1000, 6, 'succeeded') returning id;`
  );
  const grantId = psql(
    `insert into entitlement_grants (child_id, entitlement_product_id, purchase_id_ref, original_quantity, expires_at) values ('${childId}', '${productId}', '${purchaseId}', 1, now() + interval '6 months') returning id;`
  );
  return { purchaseId, grantId };
}

/**
 * problem-bank-flow / figure-template-1 / rw-structured-blocks 3개 스펙이 각자
 * 복붙해 쓰던 "문제 하나로 이미 시작된 수업 세션"을 만드는 로직 — draft
 * 계약/planned 수강이라 유니크 제약과는 무관하지만, 전용 fixture 학생/household를
 * 받아 더 이상 공용 지훈/aabbccdd household를 쓰지 않도록 파라미터화했다.
 */
export function startedSessionWith(params: {
  problemId: string;
  subjectId: string;
  teacherId: string;
  studentId: string;
  householdId: string;
}): string {
  const { problemId, subjectId, teacherId, studentId, householdId } = params;
  const baseUnit = psql(`select id from subject_template_units where subject_id = '${subjectId}' order by position limit 1;`);
  const contractId = psql(`insert into contracts (household_id, child_id, status) values ('${householdId}', '${studentId}', 'draft') returning id;`);
  const enrollmentId = psql(`insert into subject_enrollments (child_id, subject_id, contract_id, status) values ('${studentId}', '${subjectId}', '${contractId}', 'planned') returning id;`);
  psql(`insert into teacher_assignments (subject_enrollment_id, teacher_id, status, effective_from) values ('${enrollmentId}', '${teacherId}', 'active', now() - interval '1 day');`);
  const overlayId = asUser(teacherId, `insert into student_curriculum_overlays (subject_enrollment_id) values ('${enrollmentId}') returning id;`);
  const overlayUnitId = asUser(teacherId, `insert into curriculum_overlay_units (overlay_id, source_unit_id, position, unit_title) values ('${overlayId}', '${baseUnit}', 1, 'E2E 문제은행 회차') returning id;`);
  const keywordId = psql(`insert into subject_keywords (subject_id, label) values ('${subjectId}', 'E2E BANK ${Date.now()}${Math.floor(Math.random() * 1000)}') returning id;`);
  asUser(teacherId, `insert into curriculum_overlay_unit_keywords (overlay_unit_id, keyword_id) values ('${overlayUnitId}', '${keywordId}');`);
  psql(`insert into problem_keywords (problem_id, keyword_id) values ('${problemId}', '${keywordId}') on conflict do nothing;`);
  const prepId = asUser(teacherId, `insert into curriculum_unit_preps (overlay_unit_id, created_by) values ('${overlayUnitId}', '${teacherId}') on conflict (overlay_unit_id) do update set created_by = excluded.created_by returning id;`);
  asUser(teacherId, `insert into curriculum_unit_prep_items (prep_id, content_type, content_id, position) values ('${prepId}', 'problem', '${problemId}', 1);`);
  const offset = 10000 + Math.floor(Math.random() * 400);
  const reservationId = psql(`insert into reservations (kind, subject_enrollment_id, owner_profile_id, starts_at, ends_at, status) values ('lesson', '${enrollmentId}', '${teacherId}', now() + interval '${offset} days', now() + interval '${offset} days 1 hour', 'confirmed') returning id;`);
  const sessionId = psql(`insert into sessions (reservation_id, subject_enrollment_id, teacher_id, lesson_type_id, scheduled_duration_minutes) values ('${reservationId}', '${enrollmentId}', '${teacherId}', (select id from lesson_types where code = 'regular'), 60) returning id;`);
  psql(`select link_unit_prep_to_session('${overlayUnitId}', '${sessionId}', '${teacherId}');`);
  psql(`select mark_lesson_session_started('${sessionId}', '${teacherId}');`);
  return sessionId;
}
