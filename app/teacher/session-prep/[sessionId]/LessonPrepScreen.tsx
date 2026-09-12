"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SessionPrepPanel from "@/app/teacher/SessionPrepPanel";
import { loadStudentCurriculumPanelData } from "@/app/teacher/student-curriculum-actions";
import type { OverlayUnit, LibraryKeyword } from "@/app/teacher/student-curriculum-data";
import type { SessionPrepContext } from "./prep-context-data";

// P2/P3 2단계 — 예정된 수업 하나를 문맥으로 잡고 기존 SessionPrepPanel을 실제
// sessionId와 함께 연다. 준비 UI 자체는 재구현하지 않는다(확정 정책: 기존
// 콘텐츠 스냅샷·문제은행·커리큘럼 3계층은 연결·폴리싱 대상). 이 화면이 더하는
// 것은 (1) 어떤 수업인지 사람이 읽을 수 있는 식별, (2) 실제 세션뷰로 가는 길.
export default function LessonPrepScreen({ context }: { context: SessionPrepContext }) {
  const router = useRouter();
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "ready"; units: OverlayUnit[]; keywords: LibraryKeyword[] }
  >({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    loadStudentCurriculumPanelData(context.subjectEnrollmentId, context.subjectId)
      .then((data) => {
        if (cancelled) return;
        setState({ status: "ready", units: data.initial.units, keywords: data.library.keywords });
      })
      .catch((e) => {
        if (cancelled) return;
        setState({
          status: "error",
          message: e instanceof Error ? e.message : "커리큘럼을 불러오지 못했습니다.",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [context.subjectEnrollmentId, context.subjectId]);

  const when = formatLessonTime(context.startsAt, context.endsAt);

  return (
    <div className="min-h-screen">
      <div className="border-b-[1.5px] border-grey-200 px-6 py-4">
        <div className="text-[15px] font-extrabold text-ink">수업 준비</div>
        <div className="text-[12.5px] text-grey-500 font-semibold mt-0.5">
          {context.studentName ? `${context.studentName} 학생 · ` : ""}
          {context.subjectName}
          {when ? ` · ${when}` : ""}
        </div>
        <button
          onClick={() => router.push(`/session/${context.sessionId}`)}
          className="mt-3 text-[12.5px] font-bold px-4 py-2 rounded-lg border-[1.5px] border-grey-200 text-ink"
        >
          수업 열기
        </button>
      </div>

      {state.status === "loading" && (
        <p className="px-6 py-8 text-[13px] text-grey-500">불러오는 중...</p>
      )}
      {state.status === "error" && (
        <p className="px-6 py-8 text-[13px] text-red">{state.message}</p>
      )}
      {state.status === "ready" && (
        <SessionPrepPanel
          subjectEnrollmentId={context.subjectEnrollmentId}
          overlayUnits={state.units}
          keywords={state.keywords}
          sessionId={context.sessionId}
          studentName={context.studentName}
          subjectName={context.subjectName}
          onBack={() => router.push("/teacher?tab=lessons")}
        />
      )}
    </div>
  );
}

// 수업 일시는 사람이 읽는 형태로만 보여준다. 잘못된 값이면 아무것도 쓰지 않는다
// (내부 타임스탬프 문자열을 그대로 노출하지 않기 위함).
export function formatLessonTime(startsAt: string | null, endsAt: string | null): string {
  if (!startsAt) return "";
  const start = new Date(startsAt);
  if (Number.isNaN(start.getTime())) return "";
  const date = start.toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
  });
  const startTime = start.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  if (!endsAt) return `${date} ${startTime}`;
  const end = new Date(endsAt);
  if (Number.isNaN(end.getTime())) return `${date} ${startTime}`;
  const endTime = end.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  return `${date} ${startTime}–${endTime}`;
}
