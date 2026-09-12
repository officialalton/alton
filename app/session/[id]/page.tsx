import { notFound } from "next/navigation";
import {
  requireUser,
  getRoleHomePath,
  computeSessionViewState,
} from "@/lib/auth";
import SessionShell from "./SessionShell";
import { loadMaterialData } from "./material-data";
import { loadVocabWords } from "./vocab-data";
import { loadHomeworkItems } from "./homework-data";
import { loadDocLinks, parseWhiteboardStrokes } from "./scratchpad-data";
import { loadProblemLog } from "./problemlog-data";
import { loadNormalizedSession } from "./session-source-data";
import { loadSessionProblems } from "./session-problem-data";
import {
  replayAnnotationEvents,
  loadMyPrivateMaterialStrokes,
} from "./annotation-events-actions";
import { reconstructVisibleStrokes } from "./annotation-events-types";
import {
  loadSessionKeywordOptions,
  loadSessionHomeworkStatus,
} from "@/app/teacher/homework-composition-data";

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

  const initialState = computeSessionViewState(
    session.status,
    session.scheduledAt,
    session.durationMinutes
  );

  const material = await loadMaterialData(
    supabase,
    session.curriculumDocId,
    session.id,
    session.studentId
  );

  const vocabWords = await loadVocabWords(supabase, session.studentId);
  const homeworkItems = await loadHomeworkItems(supabase, session.id);
  const docLinks = await loadDocLinks(supabase, session.id);
  const whiteboardStrokes = parseWhiteboardStrokes(session.whiteboardStrokesRaw);
  const problemLog = await loadProblemLog(supabase, session.studentId);

  // R9 — v3 세션은 legacy_sessions.whiteboard_strokes가 아예 없으므로(위
  // session-source-data.ts 주석 참고) session_annotation_events를 replay해서
  // 현재 보여야 할 stroke만 미리 재구성해 SSR로 내려준다. 레거시 세션은 이벤트
  // 테이블을 아예 조회하지 않는다 — 정책상 레거시는 읽기 호환만 유지.
  const initialAnnotationStrokes =
    session.source === "v3"
      ? reconstructVisibleStrokes(await replayAnnotationEvents(session.id))
      : [];

  // R9(레슨 준비 Task 4) — v3 세션에서만 과제 구성 UI가 필요한 키워드 후보를
  // 미리 불러온다(legacy 세션엔 session_content_manifest가 없으므로 항상 빈
  // 배열).
  // P3 4단계 — 수업 시작 시 고정된 문제들. 정답·해설은 볼 자격이 있을 때만
  // 채워진다(학생은 자기 풀이 제출 뒤, 보호자는 자녀에게 열리는 시점과 동일).
  const sessionProblems =
    session.source === "v3"
      ? await loadSessionProblems(supabase, session.id, {
          canSeeAnswers: profile?.role === "teacher" || profile?.role === "admin",
          studentId: session.studentId,
        })
      : [];

  // P3 3단계 — 학생 본인의 개인 교재 필기. 다른 역할에서는 조회 정책이 빈
  // 결과를 주므로 화면에도 존재하지 않는다.
  const privateMaterialStrokes =
    profile?.role === "student" && material?.docId
      ? await loadMyPrivateMaterialStrokes(session.id, material.docId)
      : [];

  const homeworkKeywordOptions =
    session.source === "v3" ? await loadSessionKeywordOptions(supabase, session.id) : [];

  // Gap 2 (2026-09-08, 제품 오너 리뷰) — v3 세션에서 선생님/관리자에게만 발급된
  // 과제의 학생 제출 현황(읽기전용)을 미리 불러온다. 인가는 이 로더가 그대로
  // 넘겨받는 `supabase`(요청 사용자로 스코프된 클라이언트, service-role 아님)의
  // RLS에 위임한다 — 담당 아닌 선생님이면 session_homework_items 자체가 RLS로
  // 안 보여 빈 배열이 돌아온다.
  const homeworkStatusItems =
    session.source === "v3" && (session.viewerRole === "teacher" || session.viewerRole === "admin")
      ? await loadSessionHomeworkStatus(supabase, session.id)
      : [];

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
      status={session.status}
      scheduledAt={session.scheduledAt}
      durationMinutes={session.durationMinutes}
      backHref={getRoleHomePath(profile?.role)}
      material={material}
      vocabWords={vocabWords}
      homeworkItems={homeworkItems}
      docLinks={docLinks}
      whiteboardStrokes={whiteboardStrokes}
      problemLog={problemLog}
      writesEnabled={session.source === "legacy"}
      sessionSource={session.source}
      initialAnnotationStrokes={initialAnnotationStrokes}
      privateMaterialStrokes={privateMaterialStrokes}
      sessionProblems={sessionProblems}
      currentUserId={user.id}
      homeworkKeywordOptions={homeworkKeywordOptions}
      homeworkStatusItems={homeworkStatusItems}
    />
  );
}
