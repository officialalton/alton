"use client";

import { useEffect, useState } from "react";
import type { TeacherAssignedSubject } from "./assignments-data";
import { requestOwnTerminationAsTeacher, listMyTerminationRequests } from "./teacher-assignment-termination-actions";
import UnderlineSubTabs from "@/app/components/UnderlineSubTabs";
import { loadTeacherStudentRoadmapAction } from "./student-roadmap-actions";
import RoadmapView from "@/app/components/RoadmapView";
import type { RoadmapData } from "@/lib/roadmap/types";
// M4 UAT #5 — 체험 수업 리뷰 작성 UI는 배정 탭에서 제거됐다. 진입 위치는
// "정규수업" 탭(TeacherLessonScheduleTab)의 "예정된 수업" 목록으로 이동했다 —
// 진행한 수업 내역이 실제로 보이는 화면에서 바로 리뷰를 작성하고, 확정하면
// 그 세션이 "지난 수업"으로 넘어가는 흐름이 사용자 피드백이었다.

const STATUS_LABEL: Record<string, string> = {
  requested: "요청됨 — 관리자 확인 대기",
  processing: "관리자 처리 중",
  completed: "처리 완료",
  failed: "처리 실패 — 관리자 재처리 대기",
  cancelled: "취소됨",
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
        배정 종료 요청: {STATUS_LABEL[existing.status] ?? existing.status}
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
          배정 종료 요청
        </button>
      </div>
    );
  }

  return (
    <div className="mt-1.5 flex justify-end">
      <div className="w-full max-w-[280px]">
        <textarea
          className="w-full border border-grey-300 rounded px-2 py-1 text-[12px]"
          placeholder="종료 요청 사유"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <div className="flex gap-2 mt-1 justify-end">
          <button onClick={() => setOpen(false)} className="text-[11px] text-grey-500">
            취소
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
            요청 제출 (관리자만 확정 가능)
          </button>
        </div>
      </div>
    </div>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

const PLANNER_TABS = [
  { id: "board", label: "보드" },
  { id: "schedule", label: "일정" },
  { id: "overview", label: "오버뷰" },
] as const;
type PlannerTabId = (typeof PLANNER_TABS)[number]["id"];

// 2026-09-22(사용자 지시) — "오버뷰/로드맵/일정" 버튼이 별도 페이지로 나가버려
// 좌측 네비게이션이 사라졌다. My Students 탭 안에서 그대로 전환되게 바꾼다
// (내용은 그대로 — 데이터 모델·서버 액션이 붙으면 이 자리를 채운다).
function StudentPlannerPanel({
  studentName,
  initialTab,
  onBack,
}: {
  studentId: string;
  studentName: string;
  initialTab: PlannerTabId;
  onBack: () => void;
}) {
  const [tab, setTab] = useState<PlannerTabId>(initialTab);

  return (
    <div className="max-w-[640px]">
      <button
        onClick={onBack}
        className="text-[13px] text-grey-600 font-semibold border-[1.5px] border-grey-200 rounded-lg px-3 py-1.5 hover:bg-grey-100 active:scale-95 transition-transform"
      >
        ← 뒤로
      </button>
      <h1 className="text-[18px] font-extrabold text-ink mt-2">{studentName} 학습 플래너</h1>

      <UnderlineSubTabs
        className="mt-4"
        items={PLANNER_TABS}
        activeId={tab}
        onSelect={setTab}
      />

      <div className="py-10 text-center text-[13px] text-grey-500">
        {tab === "board" && "할 일 보드는 준비 중입니다 — 곧 제공됩니다."}
        {tab === "schedule" && "일정 탭은 준비 중입니다 — 곧 제공됩니다."}
        {tab === "overview" && "오버뷰 탭은 준비 중입니다 — 곧 제공됩니다."}
      </div>
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
          setState({ status: "error", message: e instanceof Error ? e.message : "불러오지 못했습니다." });
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
        ← 뒤로
      </button>
      <h1 className="text-[18px] font-extrabold text-ink mt-2">{studentName} 학생 프로필 · 로드맵</h1>
      <p className="text-[12.5px] text-grey-500 mt-1">읽기 전용입니다. 수정은 학생·보호자·관리자만 가능합니다.</p>

      {state.status === "loading" && (
        <div className="py-8 text-[13px] text-grey-500">불러오는 중...</div>
      )}
      {state.status === "error" && <div className="py-8 text-[13px] text-red">{state.message}</div>}
      {state.status === "ready" && <RoadmapView data={state.data} readOnly />}
    </div>
  );
}

type View =
  | { type: "list" }
  | { type: "roadmap"; studentId: string; studentName: string }
  | { type: "planner"; studentId: string; studentName: string; tab: PlannerTabId };

export default function AssignmentsTab({
  current,
  past,
  onOpenOperatingCurriculum,
}: {
  current: TeacherAssignedSubject[];
  past: TeacherAssignedSubject[];
  onOpenOperatingCurriculum?: (
    subjectEnrollmentId: string,
    subjectId: string,
    studentName: string,
    subjectName: string
  ) => void;
}) {
  // 2026-09-22(사용자 지시) — "현재/이전 배정 이력(펼침)" 대신 배정 중/배정 종료
  // 서브탭 두 개로 나눈다.
  const [subtab, setSubtab] = useState<"active" | "past">("active");
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
        initialTab={view.tab}
        onBack={() => setView({ type: "list" })}
      />
    );
  }

  return (
    <div className="max-w-[640px]">
      {/* 2026-09-22(사용자 지시) — pill 대신 다른 화면(예: "예정 수업/지난 수업")과
          같은 1단 서브탭 표준(밑줄)으로 통일한다. */}
      <UnderlineSubTabs
        className="mb-5"
        items={[
          { id: "active", label: `배정 중 (${current.length})` },
          { id: "past", label: `배정 종료 (${past.length})` },
        ]}
        activeId={subtab}
        onSelect={setSubtab}
      />

      {subtab === "active" ? (
        current.length === 0 ? (
          <div className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center">
            현재 배정된 학생이 없습니다.
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
                    {formatDate(a.effectiveFrom)}부터
                  </div>
                </div>
                <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-grey-100 text-grey-500">
                  {a.status === "active" ? "배정중" : "예정"}
                </span>
              </div>
              {/* 2026-09-22(사용자 지시) — 학생 프로필 보기/과거 수업 이력 보기 펼침을
                  없애고, 학생 보드(오버뷰/일정 — 개발 중)·로드맵·커리큘럼 진입
                  버튼으로 통일한다. */}
              <div className="flex flex-wrap gap-2 mt-2">
                <button
                  onClick={() => setView({ type: "planner", studentId: a.studentId, studentName: a.studentName, tab: "overview" })}
                  className="text-[12px] font-semibold px-3 py-1.5 rounded-full bg-grey-100 text-ink"
                >
                  오버뷰
                </button>
                <button
                  onClick={() => setView({ type: "roadmap", studentId: a.studentId, studentName: a.studentName })}
                  className="text-[12px] font-semibold px-3 py-1.5 rounded-full bg-grey-100 text-ink"
                >
                  로드맵
                </button>
                <button
                  onClick={() => setView({ type: "planner", studentId: a.studentId, studentName: a.studentName, tab: "schedule" })}
                  className="text-[12px] font-semibold px-3 py-1.5 rounded-full bg-grey-100 text-ink"
                >
                  일정
                </button>
                {onOpenOperatingCurriculum && (
                  <button
                    onClick={() =>
                      onOpenOperatingCurriculum(a.subjectEnrollmentId, a.subjectId, a.studentName, a.subjectName)
                    }
                    className="text-[12px] font-semibold px-3 py-1.5 rounded-full bg-grey-100 text-ink"
                  >
                    커리큘럼
                  </button>
                )}
              </div>
              {a.status === "active" && <TerminationRequestControl a={a} />}
            </div>
          ))
        )
      ) : past.length === 0 ? (
        <div className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center">
          배정 종료 이력이 없습니다.
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
                {formatDate(a.effectiveFrom)} ~ {formatDate(a.effectiveUntil)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
