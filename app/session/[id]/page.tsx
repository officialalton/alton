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
import { loadUnitOptions } from "./aigen-data";
import { loadDocLinks, parseWhiteboardStrokes } from "./scratchpad-data";
import { loadProblemLog } from "./problemlog-data";
import { loadNormalizedSession } from "./session-source-data";

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
  const unitOptions = await loadUnitOptions(supabase, session.subjectId);
  const docLinks = await loadDocLinks(supabase, session.id);
  const whiteboardStrokes = parseWhiteboardStrokes(session.whiteboardStrokesRaw);
  const problemLog = await loadProblemLog(supabase, session.studentId);

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
      subjectId={session.subjectId}
      unitOptions={unitOptions}
      docLinks={docLinks}
      whiteboardStrokes={whiteboardStrokes}
      problemLog={problemLog}
      writesEnabled={session.source === "legacy"}
    />
  );
}
