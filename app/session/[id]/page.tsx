import { notFound } from "next/navigation";
import {
  requireUser,
  getRoleHomePath,
  computeSessionViewState,
} from "@/lib/auth";
import SessionShell from "./SessionShell";
import {
  loadMaterialData,
  loadPinnedMaterialData,
  loadPlannedMaterialData,
  shouldFallBackToPlannedMaterial,
  loadSessionFreezeState,
  frozenMaterialNotice,
} from "./material-data";
import { loadSessionVocabData } from "./vocab-data";
import { loadHomeworkItems } from "./homework-data";
import { loadNormalizedSession } from "./session-source-data";
import { loadPlannedProblems, loadSessionProblems } from "./session-problem-data";
import { loadStudentHomeworkBatches, loadTeacherHomeworkBatchesForStudent } from "@/lib/homework-batch-data";
import { loadSmartNotesViewUrl } from "@/lib/smart-notes-data";
import { loadSessionLessonContext } from "./session-context-data";
import {
  loadComposition,
  loadKeywordProblems,
  loadPickableMaterials,
} from "@/lib/unit-composition";
import {
  loadMyLegacyPrivateMaterialStrokes,
  loadTeacherMaterialStrokes,
  loadStudentMaterialStrokes,
} from "./annotation-events-actions";
import { loadStudentMockExamAttempts } from "@/lib/mock-exam/attempt-data";

// R8 1/N — cutover connection: 이 화면은 원래 legacy_sessions만 조회했다.
// `loadNormalizedSession`이 legacy_sessions(R6 이전 레거시 세션뷰 테스트 데이터)와
// v3 sessions/reservations(R6~R7 실제 예약)를 둘 다 판별해 같은 모양으로 정규화한다
// — 자세한 배경은 docs/2026-09-07-r8-session-cutover-oneP-pager.md 참고.
//
// 2026-09-21(UAT "수업 준비 로딩이 엄청 느림") — 예전엔 아래 로더 20개가 전부 `await` 로 한 줄씩
// 직렬 실행돼 첫 진입이 그 합만큼 느렸다. 서로 의존하지 않는 로더는 Promise.all 로 묶고, 의존
// 관계가 있는 것(교재 → 필기 레이어, 단원 → 준비 구성, 고정 문제 → 예정 문제 폴백)만 두 번째
// 단계로 미룬다. 반환 데이터·SessionShell 인터페이스는 그대로다.

export default async function SessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ id }, { tab }, { user, profile, supabase }] = await Promise.all([params, searchParams, requireUser()]);

  const session = await loadNormalizedSession(
    supabase,
    id,
    user.id,
    profile?.role
  );
  if (!session) notFound();

  // 2026-09-14: 이미 시작한(live) 수업은 예약 시각이 아직이어도 '진행 중'이다. 시작이 곧 고정이라,
  // 준비 중으로 보이면 "수업 준비에서 바꿨는데 반영이 안 된다"가 된다.
  const startedLive = session.source === "v3" && session.finalStatus === "live";
  const initialState = startedLive
    ? "live"
    : computeSessionViewState(session.status, session.scheduledAt, session.durationMinutes);

  // P2/P3 5단계 — v3 수업은 "준비해서 고정한 교재"를 먼저 보여준다. 고정된
  // 교재가 없는 수업(준비 없이 시작했거나 레거시)만 기존 경로로 내려간다.
  //
  // 2026-09-13 정정: 예정 구성으로의 폴백은 **시작 전 수업에만** 적용한다. 시작·완료된
  // 수업에 고정 자료가 없다고 해서 최신 예정 구성을 끼워 넣으면, 그 수업이 실제로
  // 쓰지 않은 내용을 그 수업의 내용처럼 보여주게 된다. 회차 구성은 그 뒤로도 계속
  // 바뀌므로 과거 수업을 열 때마다 다른 것이 보이게 된다.
  const showPlannedInstead = shouldFallBackToPlannedMaterial(session.source, initialState);
  const isV3 = session.source === "v3";
  const canPrepare = session.viewerRole === "teacher" || session.viewerRole === "admin";
  const canSeeAnswers = profile?.role === "teacher" || profile?.role === "admin";

  const loadMaterial = async () =>
    (isV3 ? await loadPinnedMaterialData(supabase, session.id) : null) ??
    (showPlannedInstead ? await loadPlannedMaterialData(supabase, session.id) : null) ??
    (await loadMaterialData(supabase, session.curriculumDocId, session.id, session.studentId));

  // 1단계 — 서로 독립인 로더를 한 번에.
  const [material, freezeState, sessionVocab, homeworkItems, lessonContext, pinnedProblems, homeworkBatches, smartNotesUrl, mockExamAttempts] =
    await Promise.all([
      loadMaterial(),
      // 고정 자료가 없을 때 "없었다"고 단정하지 않는다. 문제만 고정된 수업과 고정
      // 기록 자체가 없는 수업은 다르고, 앞엣것은 오류가 아니다.
      isV3 ? loadSessionFreezeState(supabase, session.id) : Promise.resolve(null),
      loadSessionVocabData(supabase, session.studentId),
      loadHomeworkItems(supabase, session.id),
      // R9(레슨 준비 Task 4) — v3 세션에서만 과제 구성 UI가 필요한 키워드 후보를
      // 미리 불러온다(legacy 세션엔 session_content_manifest가 없으므로 항상 빈 배열).
      isV3
        ? loadSessionLessonContext(supabase, session.id)
        : Promise.resolve({ unitTitle: null, goal: null, supplementTitles: [], primaryUnitId: null }),
      // P3 4단계 — 수업 시작 시 고정된 문제들. 정답·해설은 볼 자격이 있을 때만
      // 채워진다(학생은 자기 풀이 제출 뒤, 보호자는 자녀에게 열리는 시점과 동일).
      isV3 ? loadSessionProblems(supabase, session.id, { canSeeAnswers, studentId: session.studentId }) : Promise.resolve([]),
      // 2026-09-16(제품 오너 2차 정정) — 과제는 수업(세션)과 무관하다. 세션뷰의 과제 탭은 이 학생의
      // 과제 배치 전체(어느 교사가 냈든, 이 교사가 낸 것만 — RLS/로더가 각 역할에 맞게 가른다)를 그대로 보여준다.
      profile?.role === "teacher"
        ? loadTeacherHomeworkBatchesForStudent(supabase, user.id, session.studentId)
        : loadStudentHomeworkBatches(supabase, session.studentId),
      // 2026-09-16(제품 오너 정정) — 정규 수업(v3)에 한해 학생·보호자에게 Smart Notes 회의록
      // 열람 링크를 보여준다(첫 상담은 대상 아님, RLS가 v3 sessions에 한정해 접근을 걸러준다).
      isV3 ? loadSmartNotesViewUrl(supabase, session.id) : Promise.resolve(null),
      // 2026-09-22(UAT "모의고사 탭만 유독 로딩이 길다") — 다른 탭(교재·문제·과제·
      // 단어장)은 전부 이렇게 SSR로 미리 받아 두는데 모의고사 탭만 클라이언트가
      // 탭을 열 때 따로 요청을 보내 그 왕복만큼 더 느렸다. 같은 배치에 합류시킨다.
      loadStudentMockExamAttempts(supabase, session.studentId),
    ]);

  const materialNotice = isV3 && freezeState ? frozenMaterialNotice(initialState, freezeState) : null;

  // 2단계 — 1단계 결과에 의존하는 로더들도 서로는 독립이라 한 번에.
  const [prep, sessionProblems, teacherMaterialStrokes, studentMaterialStrokes, legacyPrivateMaterialStrokes] = await Promise.all([
    // 4절 — 준비를 수업 화면 안에서 한다. 별도 준비 화면과 같은 구성 패널을 쓰므로
    // 준비 데이터를 두 곳에서 관리하지 않는다. 학생·학부모에게는 실어 보내지 않는다(7절).
    (async () => {
      if (!canPrepare || !lessonContext.primaryUnitId) return null;
      const composition = await loadComposition(supabase, "student", lessonContext.primaryUnitId);
      if (!composition) return null;
      const [pickable, problems] = await Promise.all([
        loadPickableMaterials(supabase, composition.subjectId, composition.materials.map((m) => m.curriculumDocId)),
        loadKeywordProblems(supabase, composition.keywords.map((k) => k.id)),
      ]);
      return { composition, pickable, problems };
    })(),
    // 시작 전 수업에 고정된 문제가 없으면 **예정** 문제를 보여준다 — 교재와 같은 규칙
    // (shouldFallBackToPlannedMaterial). 시작·완료된 수업에는 끼워 넣지 않는다.
    pinnedProblems.length === 0 && showPlannedInstead ? loadPlannedProblems(supabase, session.id) : Promise.resolve(pinnedProblems),
    // P3 7단계 — 교재 위 두 레이어를 각각 따로 재구성한다. 화면에서 각자
    // 켜고 끌 수 있어야 하므로 섞어서 내려보내지 않는다.
    isV3 && material?.docId ? loadTeacherMaterialStrokes(session.id, material.docId) : Promise.resolve([]),
    isV3 && material?.docId ? loadStudentMaterialStrokes(session.id, material.docId) : Promise.resolve([]),
    // 정책 변경 전에 본인이 남긴 비공개 필기(보존 기록). 쓴 본인에게만 내려온다.
    profile?.role === "student" && material?.docId ? loadMyLegacyPrivateMaterialStrokes(session.id, material.docId) : Promise.resolve([]),
  ]);

  return (
    <SessionShell
      sessionId={session.id}
      studentId={session.studentId}
      unitTitle={session.unitTitle ?? `${session.sessionNumber}회차`}
      subjectName={session.subjectName}
      studentName={session.studentName}
      sessionNumber={session.sessionNumber}
      viewerRole={session.viewerRole}
      initialTab={tab}
      initialState={initialState}
      startedLive={startedLive}
      status={session.status}
      scheduledAt={session.scheduledAt}
      durationMinutes={session.durationMinutes}
      backHref={getRoleHomePath(profile?.role)}
      material={material}
      sessionVocab={sessionVocab}
      homeworkItems={homeworkItems}
      writesEnabled={session.source === "legacy"}
      sessionSource={session.source}
      legacyPrivateMaterialStrokes={legacyPrivateMaterialStrokes}
      teacherMaterialStrokes={teacherMaterialStrokes}
      studentMaterialStrokes={studentMaterialStrokes}
      sessionProblems={sessionProblems}
      lessonContext={lessonContext}
      prep={prep}
      materialNotice={materialNotice}
      currentUserId={user.id}
      homeworkBatches={homeworkBatches}
      smartNotesUrl={smartNotesUrl}
      initialMockExamAttempts={mockExamAttempts}
    />
  );
}
