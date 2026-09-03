"use client";

import { useEffect, useState } from "react";
import type { TeacherAssignedSubject } from "./assignments-data";
import {
  requestOwnTerminationAsTeacher,
  listMyTerminationRequests,
  listMyTeachingHistoryForSubject,
} from "./teacher-assignment-termination-actions";
import type { TeachingHistoryItem } from "@/app/admin/teacher-assignment-termination-actions";
import TrialReviewPanel from "./TrialReviewPanel";

// 새로 배정된 선생님이 해당 과목의 "과거" 수업 이력을 읽기전용으로 확인하는 위젯.
// list_subject_teaching_history_for_current_teacher()가 호출자가 실제 현재 활성
// 배정 보유자인지 DB에서 다시 검증하므로, 화면에는 날짜·상태·수업유형만 노출되고
// Smart Notes 원본·내부 메모·시급/정산 정보·다른 과목 기록은 애초에 응답에 없다.
function TeachingHistoryDisclosure({ a }: { a: TeacherAssignedSubject }) {
  const [items, setItems] = useState<TeachingHistoryItem[] | null>(null);
  return (
    <details
      className="mt-1.5"
      onToggle={(e) => {
        if ((e.target as HTMLDetailsElement).open && items === null) {
          listMyTeachingHistoryForSubject(a.subjectEnrollmentId)
            .then(setItems)
            .catch(() => setItems([]));
        }
      }}
    >
      <summary className="text-[11px] font-semibold text-grey-500 cursor-pointer">
        과거 수업 이력 보기
      </summary>
      {items === null ? (
        <div className="text-[11px] text-grey-400 mt-1">불러오는 중...</div>
      ) : items.length === 0 ? (
        <div className="text-[11px] text-grey-400 mt-1">이전 수업 이력이 없습니다.</div>
      ) : (
        <ul className="mt-1 space-y-0.5">
          {items.map((h) => (
            <li key={h.sessionId} className="text-[11px] text-grey-500">
              {formatDate(h.startsAt)} · {h.lessonTypeName ?? "-"} · {h.finalStatus}
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}

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

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-[11px] font-semibold text-grey-500 underline mt-1.5"
      >
        배정 종료 요청
      </button>
    );
  }

  return (
    <div className="mt-1.5">
      <textarea
        className="w-full border border-grey-300 rounded px-2 py-1 text-[12px]"
        placeholder="종료 요청 사유"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      <div className="flex gap-2 mt-1">
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
        <button onClick={() => setOpen(false)} className="text-[11px] text-grey-500">
          취소
        </button>
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
}: {
  current: TeacherAssignedSubject[];
  past: TeacherAssignedSubject[];
}) {
  return (
    <div className="max-w-[640px] px-8 py-8">
      <h1 className="text-[20px] font-extrabold text-ink mb-1.5">
        내 배정 학생
      </h1>
      <p className="text-[13px] text-grey-500 mb-5">
        현재 배정되어 있는 학생·과목과 담당 기간입니다.
      </p>

      {current.length === 0 ? (
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
                <div className="text-[13.5px] font-bold text-ink">
                  {a.studentName} · {a.subjectName}
                </div>
                <div className="text-[12px] text-grey-500 mt-0.5">
                  {formatDate(a.effectiveFrom)}부터
                </div>
              </div>
              <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-grey-100 text-grey-500">
                {a.status === "active" ? "배정중" : "예정"}
              </span>
            </div>
            {a.status === "active" && <TerminationRequestControl a={a} />}
            <TeachingHistoryDisclosure a={a} />
          </div>
        ))
      )}

      {past.length > 0 && (
        <details className="mt-4">
          <summary className="text-[12.5px] font-semibold text-grey-500 cursor-pointer">
            이전 배정 이력 ({past.length})
          </summary>
          <div className="mt-2 space-y-1.5">
            {past.map((a) => (
              <div
                key={a.assignmentId}
                className="text-[12px] text-grey-500 border-l-2 border-grey-200 pl-2.5"
              >
                {a.studentName} · {a.subjectName} — {formatDate(a.effectiveFrom)} ~{" "}
                {formatDate(a.effectiveUntil)}
              </div>
            ))}
          </div>
        </details>
      )}

      <TrialReviewPanel />
    </div>
  );
}
