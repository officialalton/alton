import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { loadSessionPrepContext } from "./prep-context-data";
import LessonPrepScreen from "./LessonPrepScreen";

// 2026-09-13 지시 3번 — '수업 준비'는 화면 하나다.
//
// 예약된 수업에서 들어와도 같은 화면을 쓴다. 이 경로는 그 수업에 연결된 회차를
// 찾아 통합 화면(/lesson-prep/student/[unitId])으로 보낸다 — 준비 내용이 두 곳에
// 나뉘어 서로 다른 상태를 보여주던 것을 없앤다.
//
// 연결된 회차가 없을 때만 여기서 안내 화면을 그린다. 보낼 곳이 없기 때문이다.
export default async function TeacherSessionPrepPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { supabase } = await requireUser();
  const { sessionId } = await params;

  const context = await loadSessionPrepContext(supabase, sessionId);
  if (!context) {
    return (
      <div className="min-h-screen flex items-center justify-center px-5">
        <p className="text-[14px] text-grey-500">
          이 수업의 준비 화면을 열 권한이 없거나, 수업을 찾을 수 없습니다.
        </p>
      </div>
    );
  }

  // 2026-09-14 제품 오너: 선생님 포털의 '수업 준비'는 어디서 들어와도 **수업 화면의 수업 준비 탭**이다.
  // 준비 화면이 따로 있으면 두 곳이 다른 상태를 보여준다.
  if (context.linkedUnitId) {
    redirect(`/session/${sessionId}?tab=prep`);
  }

  return <LessonPrepScreen context={context} />;
}
