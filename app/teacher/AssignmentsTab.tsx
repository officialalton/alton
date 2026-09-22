"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { TeacherAssignedSubject } from "./assignments-data";
import { requestOwnTerminationAsTeacher, listMyTerminationRequests } from "./teacher-assignment-termination-actions";
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

  return (
    <div className="max-w-[640px]">
      <div className="flex gap-1.5 mb-5">
        {(
          [
            ["active", `배정 중 (${current.length})`],
            ["past", `배정 종료 (${past.length})`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setSubtab(id)}
            aria-pressed={subtab === id}
            className={"text-[12px] font-bold px-3 py-1.5 rounded-full " + (subtab === id ? "bg-ink text-white" : "bg-grey-100 text-grey-600")}
          >
            {label}
          </button>
        ))}
      </div>

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
                <Link
                  href={`/teacher/student/${a.studentId}/planner?tab=overview&returnTo=${encodeURIComponent("/teacher?tab=assignments")}`}
                  className="text-[12px] font-semibold px-3 py-1.5 rounded-full bg-grey-100 text-ink"
                >
                  오버뷰
                </Link>
                <Link
                  href={`/teacher/student/${a.studentId}/roadmap?returnTo=${encodeURIComponent("/teacher?tab=assignments")}`}
                  className="text-[12px] font-semibold px-3 py-1.5 rounded-full bg-grey-100 text-ink"
                >
                  로드맵
                </Link>
                <Link
                  href={`/teacher/student/${a.studentId}/planner?tab=schedule&returnTo=${encodeURIComponent("/teacher?tab=assignments")}`}
                  className="text-[12px] font-semibold px-3 py-1.5 rounded-full bg-grey-100 text-ink"
                >
                  일정
                </Link>
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
