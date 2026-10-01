// 실행: npx tsx scripts/uat-20260918-problembank-seed.ts
// 2026-09-18 문제은행 실제 학생/교사 세션 UAT용 실행-ID 태그 데이터 시딩.
// 비프로덕션(worpsqwqgnspddnrtnvq)에만 쓴다. 이 스크립트가 만드는 것:
//   - 실제 로그인 가능한 테스트 학생 1명 + 교사 1명(+ 계약 성립에 필요한 보호자/가구)
//   - SAT Math, SAT R&W 각 과목에 수강·배정·커리큘럼 오버레이·회차 준비(수업 준비)를 구성하고
//     이번 세션에서 공개 처리한 4개 문제(Math MC/SPR, R&W 근거/정량 모델)를 각 회차에 연결
//   - 두 회차를 "시작됨" 상태로 만들어 학생/교사가 실제 세션뷰에서 풀이·채점할 수 있게 한다.
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const envPath = path.resolve(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const SUPABASE_URL = "https://worpsqwqgnspddnrtnvq.supabase.co";
const SERVICE_ROLE_KEY = process.env.UAT_SERVICE_ROLE_KEY!;
if (!SERVICE_ROLE_KEY) throw new Error("UAT_SERVICE_ROLE_KEY 환경변수가 필요합니다.");

const RUN_ID = process.argv[2] ?? `pb0918-${Date.now().toString(36)}`;
const PASSWORD = "Uat-pb0918-Passw0rd!";

const MATH_SUBJECT_ID = "444c77cb-509f-4e77-ba2e-31c0274e8a53";
const RW_SUBJECT_ID = "16440d6d-0e55-4bfd-88fa-ae3ccf1e83af";

// 이번 세션에서 공개 처리한 4개 문제
const MATH_MC_ID = "019f899e-6b69-4567-872a-5f9724c7e606"; // linear_equations_two_var, 정답 index 3
const MATH_SPR_ID = "1e82859d-9547-4f01-9916-2d3290b73c38"; // linear_equations_one_var, 정답 "5"
const RW_EVIDENCE_ID = "9de2c8b6-6697-4fee-8aa9-a18d5c46c087"; // central_ideas_details, 정답 index 2
const RW_QUANT_ID = "e2f41d4a-cb00-4d7c-a12b-3c3426972591"; // command_of_evidence_quant, 정답 index 0

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function createAuthUser(email: string) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (error) throw new Error(`createUser(${email}) 실패: ${error.message}`);
  return data.user!.id;
}

async function insertOne<T = { id: string }>(table: string, row: Record<string, unknown>): Promise<T> {
  const { data, error } = await admin.from(table).insert(row).select().single();
  if (error) throw new Error(`${table} insert 실패: ${error.message}`);
  return data as T;
}

async function baseUnitId(subjectId: string): Promise<string> {
  const { data, error } = await admin
    .from("subject_template_units")
    .select("id")
    .eq("subject_id", subjectId)
    .order("position", { ascending: true })
    .limit(1)
    .single();
  if (error) throw new Error(`subject_template_units 조회 실패(${subjectId}): ${error.message}`);
  return data.id as string;
}

async function buildSubjectSession(params: {
  label: string;
  subjectId: string;
  studentId: string;
  teacherId: string;
  contractId: string;
  offsetDays: number;
  problemIds: string[];
}) {
  const { label, subjectId, studentId, teacherId, contractId, offsetDays, problemIds } = params;

  const enrollment = await insertOne<{ id: string }>("subject_enrollments", {
    child_id: studentId,
    subject_id: subjectId,
    contract_id: contractId,
    status: "planned",
  });

  await admin.from("teacher_assignments").insert({
    subject_enrollment_id: enrollment.id,
    teacher_id: teacherId,
    status: "active",
    effective_from: new Date(Date.now() - 86400000).toISOString(),
  });

  const overlay = await insertOne<{ id: string }>("student_curriculum_overlays", {
    subject_enrollment_id: enrollment.id,
  });

  const unitId = await baseUnitId(subjectId);
  const overlayUnit = await insertOne<{ id: string }>("curriculum_overlay_units", {
    overlay_id: overlay.id,
    source_unit_id: unitId,
    position: 1,
    unit_title: `UAT ${RUN_ID} ${label} 회차`,
  });

  const { data: prep, error: prepErr } = await admin
    .from("curriculum_unit_preps")
    .upsert({ overlay_unit_id: overlayUnit.id, created_by: teacherId }, { onConflict: "overlay_unit_id" })
    .select("id")
    .single();
  if (prepErr) throw new Error(`curriculum_unit_preps upsert 실패: ${prepErr.message}`);

  await admin.from("curriculum_unit_prep_items").delete().eq("prep_id", prep.id);
  await admin.from("curriculum_unit_prep_items").insert(
    problemIds.map((problemId, idx) => ({
      prep_id: prep.id,
      content_type: "problem",
      content_id: problemId,
      position: idx + 1,
    }))
  );

  // 회차 키워드 범위 안에 문제를 포함시키려면 problem_keywords + curriculum_overlay_unit_keywords가
  // 같은 키워드로 연결돼 있어야 한다(공개된 문제라도 키워드 태그가 없으면 자동 링크에서 거부됨).
  const keyword = await insertOne<{ id: string }>("subject_keywords", {
    subject_id: subjectId,
    label: `UAT ${RUN_ID} ${label} 키워드 ${Date.now()}`,
  });
  await admin.from("curriculum_overlay_unit_keywords").insert({
    overlay_unit_id: overlayUnit.id,
    keyword_id: keyword.id,
  });
  await admin.from("problem_keywords").insert(
    problemIds.map((problemId) => ({
      problem_id: problemId,
      keyword_id: keyword.id,
      created_by: teacherId,
    }))
  );

  const startsAt = new Date(Date.now() + offsetDays * 86400000);
  const endsAt = new Date(startsAt.getTime() + 3600000);
  const reservation = await insertOne<{ id: string }>("reservations", {
    kind: "lesson",
    subject_enrollment_id: enrollment.id,
    owner_profile_id: teacherId,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    status: "confirmed",
  });

  const { data: lessonType, error: ltErr } = await admin
    .from("lesson_types")
    .select("id")
    .eq("code", "regular")
    .single();
  if (ltErr) throw new Error(`lesson_types 조회 실패: ${ltErr.message}`);

  const session = await insertOne<{ id: string }>("sessions", {
    reservation_id: reservation.id,
    subject_enrollment_id: enrollment.id,
    teacher_id: teacherId,
    lesson_type_id: lessonType.id,
    scheduled_duration_minutes: 60,
  });

  const { error: linkErr } = await admin.rpc("link_unit_prep_to_session", {
    p_overlay_unit_id: overlayUnit.id,
    p_session_id: session.id,
    p_actor_id: teacherId,
  });
  if (linkErr) throw new Error(`link_unit_prep_to_session 실패(${label}): ${linkErr.message}`);

  const { error: startErr } = await admin.rpc("mark_lesson_session_started", {
    p_session_id: session.id,
    p_actor_id: teacherId,
  });
  if (startErr) throw new Error(`mark_lesson_session_started 실패(${label}): ${startErr.message}`);

  return { enrollmentId: enrollment.id, sessionId: session.id };
}

async function main() {
  console.log(`RUN_ID=${RUN_ID}`);

  const guardianEmail = `uat-${RUN_ID}-guardian@example.com`;
  const studentEmail = `uat-${RUN_ID}-student@example.com`;
  const teacherEmail = `uat-${RUN_ID}-teacher@example.com`;

  const guardianId = await createAuthUser(guardianEmail);
  const studentId = await createAuthUser(studentEmail);
  const existingTeacherId = process.env.UAT_EXISTING_TEACHER_ID;
  const teacherId = existingTeacherId || (await createAuthUser(teacherEmail));

  await admin.from("profiles").insert([
    { id: guardianId, role: "parent", name: `UAT ${RUN_ID} 보호자` },
    { id: studentId, role: "student", name: `UAT ${RUN_ID} 학생` },
    ...(existingTeacherId ? [] : [{ id: teacherId, role: "teacher", name: `UAT ${RUN_ID} 선생님` }]),
  ]);
  await admin.from("parents").insert({ id: guardianId });
  await admin.from("students").insert({ id: studentId });
  if (!existingTeacherId) {
    await admin.from("teachers").insert({ id: teacherId, status: "active" });
    await admin.from("teacher_rate_history").insert({
      teacher_id: teacherId,
      amount_minor: 3000000,
      effective_from: new Date(Date.now() - 172800000).toISOString(),
      created_by: teacherId,
    });
  }

  const household = await insertOne<{ id: string }>("households", { primary_guardian_id: guardianId });
  await admin.from("household_members").insert([
    { household_id: household.id, profile_id: guardianId, role: "guardian", is_primary: true },
    { household_id: household.id, profile_id: studentId, role: "child", is_primary: false },
  ]);

  const contract = await insertOne<{ id: string }>("contracts", {
    household_id: household.id,
    child_id: studentId,
    status: "draft",
  });

  const math = await buildSubjectSession({
    label: "Math",
    subjectId: MATH_SUBJECT_ID,
    studentId,
    teacherId,
    contractId: contract.id,
    offsetDays: 401,
    problemIds: [MATH_MC_ID, MATH_SPR_ID],
  });

  const rw = await buildSubjectSession({
    label: "RW",
    subjectId: RW_SUBJECT_ID,
    studentId,
    teacherId,
    contractId: contract.id,
    offsetDays: 402,
    problemIds: [RW_EVIDENCE_ID, RW_QUANT_ID],
  });

  console.log(
    JSON.stringify(
      {
        runId: RUN_ID,
        password: PASSWORD,
        guardianEmail,
        studentEmail,
        studentId,
        teacherEmail,
        teacherId,
        householdId: household.id,
        contractId: contract.id,
        mathSessionId: math.sessionId,
        rwSessionId: rw.sessionId,
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
