import { requireUser } from "@/lib/auth";
import { loadSessionPrepContext } from "./prep-context-data";
import LessonPrepScreen from "./LessonPrepScreen";

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

  return <LessonPrepScreen context={context} />;
}
