"use client";

import { useEffect, useState } from "react";
import type { TeacherAssignedSubject } from "./assignments-data";
import { requestOwnTerminationAsTeacher, listMyTerminationRequests } from "./teacher-assignment-termination-actions";
import UnderlineSubTabs from "@/app/components/UnderlineSubTabs";
import { loadTeacherStudentRoadmapAction } from "./student-roadmap-actions";
import RoadmapView from "@/app/components/RoadmapView";
import type { RoadmapData } from "@/lib/roadmap/types";
import TeacherPlannerBoard from "./TeacherPlannerBoard";
import { useViewerTimezone } from "@/app/components/ViewerTimezoneProvider";
import { fmtDate } from "@/lib/format-datetime";
// M4 UAT #5 — 체험 수업 리뷰 작성 UI는 배정 탭에서 제거됐다. 진입 위치는
// "정규수업" 탭(TeacherLessonScheduleTab)의 "예정된 수업" 목록으로 이동했다 —
// 진행한 수업 내역이 실제로 보이는 화면에서 바로 리뷰를 작성하고, 확정하면
// 그 세션이 "지난 수업"으로 넘어가는 흐름이 사용자 피드백이었다.

const STATUS_LABEL: Record<string, string> = {
  requested: "Requested — awaiting admin review",
  processing: "Being processed by admin",
  completed: "Completed",
  failed: "Failed — awaiting admin retry",
  cancelled: "Cancelled",
};

function TerminationRequestControl({ a }: { a: TeacherAssignedSubject }) {
  const [myRequests, setMyRequests] = useState<
    Array<{ id: string; status: string; subjectEnrollmentId: string }> | null
  >(null);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    listMyTerminationRequests()
      .then(setMyRequests)
      .catch(() => setMyRequests([]));
  }, []);

  const existing = myRequests?.find(
    (r) => r.subjectEnrollmentId === a.subjectEnrollmentId && r.status !== "cancelled"
  );

  if (existing) {
    return (
      <div className="text-[11px] text-grey-500 mt-1.5">
        End-of-assignment request: {STATUS_LABEL[existing.status] ?? existing.status}
        {/* 선생님은 자신의 요청을 확정 처리할 수 없다 — 상태 조회만 가능 */}
      </div>
    );
  }

  // 2026-09-06(A안 UI 정리) — 실수 클릭을 막고 부차적 액션임을 드러내기 위해
  // 카드 우측 하단에 작게 배치한다(이전에는 카드 상단부에 눈에 띄게 있었음).
  if (!open) {
    return (
      <div className="flex justify-end mt-1.5">
        <button
          onClick={() => setOpen(true)}
          className="text-[10.5px] font-medium text-grey-400 underline"
        >
          Request to end assignment
        </button>
      </div>
    );
  }

  return (
    <div className="mt-1.5 flex justify-end">
      <div className="w-full max-w-[280px]">
        <textarea
          className="w-full border border-grey-300 rounded px-2 py-1 text-[12px]"
          placeholder="Reason for ending the assignment"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <div className="flex gap-2 mt-1 justify-end">
          <button onClick={() => setOpen(false)} className="text-[11px] text-grey-500">
            Cancel
          </button>
          <button
            disabled={submitting || reason.trim().length === 0}
            onClick={async () => {
              setSubmitting(true);
              await requestOwnTerminationAsTeacher({
                subjectEnrollmentId: a.subjectEnrollmentId,
                teacherAssignmentId: a.assignmentId,
                reason,
              });
              setMyRequests(await listMyTerminationRequests());
              setOpen(false);
              setSubmitting(false);
            }}
            className="text-[11px] font-bold px-2.5 py-1 rounded bg-ink text-white disabled:opacity-50"
          >
            Submit request (admin confirms)
          </button>
        </div>
      </div>
    </div>
  );
}

function formatDate(iso: string | null, tz: string): string {
  if (!iso) return "-";
  return fmtDate(iso, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }, tz);
}

// 2026-09-22(사용자 지시) — "오버뷰/로드맵" 버튼이 별도 페이지로 나가버려 좌측 네비게이션이
// 사라졌다. My Students 탭 안에서 그대로 전환되게 한다. 2026-09-30(UAT) — 바깥 보드/일정/오버뷰
// 탭을 없애고 역할 공통 화면(StaffStudentViews: 오버뷰·보드, 보드에서 할 일 추가만 가능) 하나만 쓴다.
function StudentPlannerPanel({
  studentId,
  studentName,
  onBack,
}: {
  studentId: string;
  studentName: string;
  onBack: () => void;
}) {
  return (
    <div className="max-w-[640px]">
      <button
        onClick={onBack}
        className="text-[13px] text-grey-600 font-semibold border-[1.5px] border-grey-200 rounded-lg px-3 py-1.5 hover:bg-grey-100 active:scale-95 transition-transform"
      >
        ← Back
      </button>
      <h1 className="text-[18px] font-extrabold text-ink mt-2">{studentName} — Study Planner</h1>
      <TeacherPlannerBoard studentId={studentId} />
    </div>
  );
}

function StudentRoadmapPanel({
  studentId,
  studentName,
  onBack,
}: {
  studentId: string;
  studentName: string;
  onBack: () => void;
}) {
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "ready"; data: RoadmapData }
  >({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    loadTeacherStudentRoadmapAction(studentId)
      .then((data) => {
        if (!cancelled) setState({ status: "ready", data });
      })
      .catch((e) => {
        if (!cancelled) {
          setState({ status: "error", message: e instanceof Error ? e.message : "Couldn't load the roadmap." });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  return (
    <div className="max-w-[720px]">
      <button
        onClick={onBack}
        className="text-[13px] text-grey-600 font-semibold border-[1.5px] border-grey-200 rounded-lg px-3 py-1.5 hover:bg-grey-100 active:scale-95 transition-transform"
      >
        ← Back
      </button>
      <h1 className="text-[18px] font-extrabold text-ink mt-2">{studentName} — Student Profile & Roadmap</h1>
      <p className="text-[12.5px] text-grey-500 mt-1">Read-only. Only the student, parent, or admin can edit it.</p>

      {state.status === "loading" && (
        <div className="py-8 text-[13px] text-grey-500">Loading…</div>
      )}
      {state.status === "error" && <div className="py-8 text-[13px] text-red">{state.message}</div>}
      {state.status === "ready" && <RoadmapView data={state.data} readOnly />}
    </div>
  );
}

type View =
  | { type: "list" }
  | { type: "roadmap"; studentId: string; studentName: string }
  | { type: "planner"; studentId: string; studentName: string };

export default function AssignmentsTab({
  current,
  past,
  onOpenOperatingCurriculum,
  subtab: subtabProp,
  onSubtabChange,
}: {
  current: TeacherAssignedSubject[];
  past: TeacherAssignedSubject[];
  onOpenOperatingCurriculum?: (
    subjectEnrollmentId: string,
    subjectId: string,
    studentName: string,
    subjectName: string
  ) => void;
  /** 2026-09-22(사용자 지시) — "예정 수업/지난 수업"과 같은 자리(PageFrame의
   * subtabs 슬롯)에서 렌더링하려고 부모(TeacherShell)가 상태를 들고 있는다.
   * 없으면(테스트 등 독립 렌더) 이 컴포넌트가 자체 상태로 대체한다. */
  subtab?: "active" | "past";
  onSubtabChange?: (subtab: "active" | "past") => void;
}) {
  const tz = useViewerTimezone();
  // 2026-09-22(사용자 지시) — "현재/이전 배정 이력(펼침)" 대신 배정 중/배정 종료
  // 서브탭 두 개로 나눈다.
  const [localSubtab, setLocalSubtab] = useState<"active" | "past">("active");
  const subtab = subtabProp ?? localSubtab;
  const setSubtab = onSubtabChange ?? setLocalSubtab;
  const [view, setView] = useState<View>({ type: "list" });

  if (view.type === "roadmap") {
    return (
      <StudentRoadmapPanel
        studentId={view.studentId}
        studentName={view.studentName}
        onBack={() => setView({ type: "list" })}
      />
    );
  }

  if (view.type === "planner") {
    return (
      <StudentPlannerPanel
        studentId={view.studentId}
        studentName={view.studentName}
        onBack={() => setView({ type: "list" })}
      />
    );
  }

  return (
    <div className="max-w-[640px]">
      {/* 2026-09-22(사용자 지시) — subtabProp이 있으면(TeacherShell 렌더) 서브탭은
          PageFrame의 subtabs 슬롯에서 그려진다("예정 수업/지난 수업"과 같은 자리) —
          여기서 또 그리면 중복이라 생략한다. 독립 렌더(테스트 등)일 때만 자체적으로 그린다. */}
      {subtabProp === undefined && (
        <UnderlineSubTabs
          className="mb-5"
          items={[
            { id: "active", label: `Active (${current.length})` },
            { id: "past", label: `Ended (${past.length})` },
          ]}
          activeId={subtab}
          onSelect={setSubtab}
        />
      )}

      {subtab === "active" ? (
        current.length === 0 ? (
          <div className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center">
            No students assigned to you yet.
          </div>
        ) : (
          current.map((a) => (
            <div
              key={a.assignmentId}
              className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-2.5"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[13.5px] font-bold text-ink">{a.subjectName}</div>
                  <div className="text-[13px] text-grey-600">{a.studentName}</div>
                  <div className="text-[12px] text-grey-500 mt-0.5">
                    Since {formatDate(a.effectiveFrom, tz)}
                  </div>
                </div>
                <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-grey-100 text-grey-500">
                  {a.status === "active" ? "Active" : "Planned"}
                </span>
              </div>
              {/* 학생 플래너(오버뷰·보드)·로드맵·커리큘럼 진입 버튼. */}
              <div className="flex flex-wrap gap-2 mt-2">
                <button
                  onClick={() => setView({ type: "planner", studentId: a.studentId, studentName: a.studentName })}
                  className="text-[12px] font-semibold px-3 py-1.5 rounded-full bg-grey-100 text-ink"
                >
                  Study Planner
                </button>
                <button
                  onClick={() => setView({ type: "roadmap", studentId: a.studentId, studentName: a.studentName })}
                  className="text-[12px] font-semibold px-3 py-1.5 rounded-full bg-grey-100 text-ink"
                >
                  Roadmap
                </button>
                {onOpenOperatingCurriculum && (
                  <button
                    onClick={() =>
                      onOpenOperatingCurriculum(a.subjectEnrollmentId, a.subjectId, a.studentName, a.subjectName)
                    }
                    className="text-[12px] font-semibold px-3 py-1.5 rounded-full bg-grey-100 text-ink"
                  >
                    Curriculum
                  </button>
                )}
              </div>
              {a.status === "active" && <TerminationRequestControl a={a} />}
            </div>
          ))
        )
      ) : past.length === 0 ? (
        <div className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center">
          No ended assignments yet.
        </div>
      ) : (
        <div className="space-y-1.5">
          {past.map((a) => (
            <div
              key={a.assignmentId}
              className="border-[1.5px] border-grey-200 rounded-xl px-5 py-3"
            >
              <div className="text-[13px] font-bold text-ink">{a.subjectName}</div>
              <div className="text-[12.5px] text-grey-600">{a.studentName}</div>
              <div className="text-[11.5px] text-grey-500 mt-0.5">
                {formatDate(a.effectiveFrom, tz)} – {formatDate(a.effectiveUntil, tz)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
