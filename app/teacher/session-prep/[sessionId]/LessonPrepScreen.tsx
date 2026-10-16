"use client";

import { useRouter } from "next/navigation";
import UnitPrepPanel from "@/app/teacher/UnitPrepPanel";
import type { SessionPrepContext } from "./prep-context-data";
import { useViewerTimezone } from "@/app/components/ViewerTimezoneProvider";
import { fmtDate, fmtTime } from "@/lib/format-datetime";

// P2/P3 — 예정 수업에서 들어오는 준비 화면.
//
// **준비 화면은 회차 준비 하나뿐이다.** 예전에는 여기서 별도 "세션 준비"가
// 열려서, 회차 목록에는 "연결됨"인데 수업 쪽에서는 회차를 다시 고르라고 하는
// 어긋남이 있었다. 이제 이 화면은 그 수업에 연결된 회차의 준비를 그대로 연다 —
// 커리큘럼에서 열든 수업에서 열든 같은 상태를 본다.
export default function LessonPrepScreen({ context }: { context: SessionPrepContext }) {
  const tz = useViewerTimezone();
  const router = useRouter();
  const when = formatLessonTime(context.startsAt, context.endsAt, tz);

  if (!context.linkedUnitId) {
    return (
      <div className="max-w-[760px] mx-auto px-5 sm:px-8 py-7">
        <button
          onClick={() => router.push("/teacher?tab=lessons")}
          className="text-[13px] text-grey-500 font-semibold mb-4"
        >
          ← Back to lessons
        </button>
        <h2 className="text-[19px] font-extrabold text-ink mb-1">
          {context.studentName ? context.studentName : "This lesson"}
          {when ? ` · ${when}` : ""}
        </h2>
        <p className="text-[13px] leading-[1.7] text-grey-500 mt-2">
          No session is linked to this lesson yet. Pick and prepare the session to cover in the curriculum,
          then link it to this lesson from that screen.
        </p>
        <button
          onClick={() => router.push("/teacher?tab=curriculum")}
          className="mt-4 text-[12.5px] font-bold px-4 py-2 rounded-lg border-[1.5px] border-grey-200 text-ink"
        >
          Go to curriculum
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="border-b-[1.5px] border-grey-200 px-5 sm:px-8 py-4">
        <div className="max-w-[760px] mx-auto">
          <div className="text-[12.5px] text-grey-500 font-semibold">
            {context.studentName ? `${context.studentName} · ` : ""}
            {context.subjectName}
            {when ? ` · ${when}` : ""}
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {/* 2026-09-14 — 시작 전에는 여기서 다른 화면으로 건너뛰지 않는다(확정 6번).
                이미 시작한 수업이면 그 기록으로 간다. */}
            {context.frozen && (
              <button
                onClick={() => router.push(`/session/${context.sessionId}`)}
                className="text-[12.5px] font-bold px-4 py-2 rounded-lg border-[1.5px] border-grey-200 text-ink"
              >
                Lesson record →
              </button>
            )}
            {context.frozen && (
              <span className="text-[11.5px] text-grey-500">
                This lesson has already started — the prep was frozen at the start time.
              </span>
            )}
          </div>
        </div>
      </div>

      <UnitPrepPanel
        overlayUnitId={context.linkedUnitId}
        unitTitle={context.linkedUnitTitle ?? "Session for this lesson"}
        studentName={context.studentName}
        subjectName={context.subjectName}
        onBack={() => router.push("/teacher?tab=lessons")}
      />
    </div>
  );
}

// 수업 일시는 사람이 읽는 형태로만 보여준다.
export function formatLessonTime(startsAt: string | null, endsAt: string | null, tz: string): string {
  if (!startsAt) return "";
  const start = new Date(startsAt);
  if (Number.isNaN(start.getTime())) return "";
  const date = fmtDate(start, {
    month: "long",
    day: "numeric",
    weekday: "short",
  }, tz);
  const startTime = fmtTime(start, { hour: "2-digit", minute: "2-digit" }, tz);
  if (!endsAt) return `${date} ${startTime}`;
  const end = new Date(endsAt);
  if (Number.isNaN(end.getTime())) return `${date} ${startTime}`;
  const endTime = fmtTime(end, { hour: "2-digit", minute: "2-digit" }, tz);
  return `${date} ${startTime}–${endTime}`;
}
