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
import { loadVocabWords } from "./vocab-data";
import { loadHomeworkItems } from "./homework-data";
import { loadNormalizedSession } from "./session-source-data";
import { loadHomeworkProblems, loadPlannedProblems, loadSessionProblems } from "./session-problem-data";
import { loadIssuedHomework } from "./homework-v3-data";
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

// R8 1/N — cutover connection: 이 화면은 원래 legacy_sessions만 조회했다.
// `loadNormalizedSession`이 legacy_sessions(R6 이전 레거시 세션뷰 테스트 데이터)와
// v3 sessions/reservations(R6~R7 실제 예약)를 둘 다 판별해 같은 모양으로 정규화한다
// — 자세한 배경은 docs/2026-09-07-r8-session-cutover-oneP-pager.md 참고.

export default async function SessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;
  const { user, profile, supabase } = await requireUser();

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
  const material =
    (session.source === "v3" ? await loadPinnedMaterialData(supabase, session.id) : null) ??
    (showPlannedInstead ? await loadPlannedMaterialData(supabase, session.id) : null) ??
    (await loadMaterialData(supabase, session.curriculumDocId, session.id, session.studentId));

  // 고정 자료가 없을 때 "없었다"고 단정하지 않는다. 문제만 고정된 수업과 고정
  // 기록 자체가 없는 수업은 다르고, 앞엣것은 오류가 아니다.
  const materialNotice =
    session.source === "v3"
      ? frozenMaterialNotice(initialState, await loadSessionFreezeState(supabase, session.id))
      : null;

  const vocabWords = await loadVocabWords(supabase, session.studentId);
  const homeworkItems = await loadHomeworkItems(supabase, session.id);

  // R9(레슨 준비 Task 4) — v3 세션에서만 과제 구성 UI가 필요한 키워드 후보를
  // 미리 불러온다(legacy 세션엔 session_content_manifest가 없으므로 항상 빈
  // 배열).
  const lessonContext =
    session.source === "v3"
      ? await loadSessionLessonContext(supabase, session.id)
      : { unitTitle: null, goal: null, supplementTitles: [], primaryUnitId: null };

  // 4절 — 준비를 수업 화면 안에서 한다. 별도 준비 화면과 같은 구성 패널을 쓰므로
  // 준비 데이터를 두 곳에서 관리하지 않는다. 학생·학부모에게는 실어 보내지 않는다(7절).
  const canPrepare = session.viewerRole === "teacher" || session.viewerRole === "admin";
  const prepComposition =
    canPrepare && lessonContext.primaryUnitId
      ? await loadComposition(supabase, "student", lessonContext.primaryUnitId)
      : null;
  const prep = prepComposition
    ? {
        composition: prepComposition,
        pickable: await loadPickableMaterials(
          supabase,
          prepComposition.subjectId,
          prepComposition.materials.map((m) => m.curriculumDocId)
        ),
        problems: await loadKeywordProblems(
          supabase,
          prepComposition.keywords.map((k) => k.id)
        ),
      }
    : null;

  // P3 4단계 — 수업 시작 시 고정된 문제들. 정답·해설은 볼 자격이 있을 때만
  // 채워진다(학생은 자기 풀이 제출 뒤, 보호자는 자녀에게 열리는 시점과 동일).
  const pinnedProblems =
    session.source === "v3"
      ? await loadSessionProblems(supabase, session.id, {
          canSeeAnswers: profile?.role === "teacher" || profile?.role === "admin",
          studentId: session.studentId,
        })
      : [];
  // 시작 전 수업에 고정된 문제가 없으면 **예정** 문제를 보여준다 — 교재와 같은 규칙
  // (shouldFallBackToPlannedMaterial). 시작·완료된 수업에는 끼워 넣지 않는다.
  const sessionProblems =
    pinnedProblems.length === 0 && showPlannedInstead
      ? await loadPlannedProblems(supabase, session.id)
      : pinnedProblems;

  // P3 7단계 — 교재 위 두 레이어를 각각 따로 재구성한다. 화면에서 각자
  // 켜고 끌 수 있어야 하므로 섞어서 내려보내지 않는다.
  const teacherMaterialStrokes =
    session.source === "v3" && material?.docId
      ? await loadTeacherMaterialStrokes(session.id, material.docId)
      : [];
  const studentMaterialStrokes =
    session.source === "v3" && material?.docId
      ? await loadStudentMaterialStrokes(session.id, material.docId)
      : [];

  // 정책 변경 전에 본인이 남긴 비공개 필기(보존 기록). 쓴 본인에게만 내려온다.
  const legacyPrivateMaterialStrokes =
    profile?.role === "student" && material?.docId
      ? await loadMyLegacyPrivateMaterialStrokes(session.id, material.docId)
      : [];

  // 2026-09-14 과제 v3 통일 — 과제 문제는 수업 문제와 같은 로더·패널. 발급 풀은 회차 준비 문제(교사에게만).
  const viewerForProblems = {
    canSeeAnswers: profile?.role === "teacher" || profile?.role === "admin",
    studentId: session.studentId,
  };
  const [homeworkProblems, homeworkIssued] =
    session.source === "v3"
      ? await Promise.all([
          loadHomeworkProblems(supabase, session.id, viewerForProblems),
          canPrepare ? loadIssuedHomework(supabase, session.id) : Promise.resolve([]),
        ])
      : [[], []];

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
      vocabWords={vocabWords}
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
      homeworkProblems={homeworkProblems}
      homeworkPool={prep?.problems ?? []}
      homeworkIssued={homeworkIssued}
    />
  );
}
