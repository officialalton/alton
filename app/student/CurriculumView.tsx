"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addMemo } from "./memo-actions";
import type { CurriculumData, CurriculumUnitStatus } from "./curriculum-data";
import type { Memo } from "./memo-data";

const STATUS_LABEL: Record<CurriculumUnitStatus, string> = {
  done: "완료",
  in_progress: "진행중",
  upcoming: "예정",
};

const AUTHOR_LABEL: Record<Memo["authorRole"], string> = {
  teacher: "선생님",
  student: "학생",
  admin: "관리자",
};

export default function CurriculumView({
  data,
  initialMemos,
  onBack,
  onReview,
}: {
  data: CurriculumData;
  initialMemos: Memo[];
  onBack: () => void;
  onReview: (sessionId: string) => void;
}) {
  const router = useRouter();

  return (
    <div className="max-w-[640px] px-8 py-8">
      <button
        onClick={onBack}
        className="text-[13px] text-grey-500 font-semibold mb-4"
      >
        ← 뒤로
      </button>

      <div className="flex items-center justify-between mb-1.5">
        <h1 className="text-[20px] font-extrabold text-ink">
          {data.subjectName}
        </h1>
        <span className="text-[12px] font-bold px-3 py-1 rounded-full bg-grey-100 text-ink">
          {data.currentSession} / {data.totalSessions}회차
        </span>
      </div>
      <p className="text-[13px] text-grey-500 mb-5">{data.teacherName}</p>

      {data.units.length === 0 ? (
        <div className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center mb-6">
          아직 배정된 커리큘럼이 없습니다.
        </div>
      ) : (
        <div className="mb-6">
          {data.units.map((u) => (
            <div
              key={u.position}
              className="border-[1.5px] border-grey-200 rounded-xl px-5 py-3.5 mb-2.5"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[13px] font-bold text-ink">
                  {u.position}회차 · {u.unitTitle}
                </span>
                <StatusBadge status={u.status} />
              </div>
              {u.note && (
                <p className="text-[12.5px] text-grey-500 mb-1.5">{u.note}</p>
              )}
              {u.status === "done" && u.sessionId && (
                <div className="flex items-center gap-3 mt-1.5">
                  <button
                    onClick={() => router.push(`/session/${u.sessionId}`)}
                    className="text-[12px] font-semibold text-blue"
                  >
                    수업 기록
                  </button>
                  <button
                    onClick={() => onReview(u.sessionId!)}
                    className="text-[12px] font-semibold text-blue"
                  >
                    리뷰 보기
                  </button>
                </div>
              )}
              {u.status === "in_progress" && u.sessionId && (
                <button
                  onClick={() => router.push(`/session/${u.sessionId}`)}
                  className="text-[12px] font-semibold text-blue mt-1.5"
                >
                  수업 준비 →
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <MemoCard enrollmentId={data.enrollmentId} initialMemos={initialMemos} />
    </div>
  );
}

function StatusBadge({ status }: { status: CurriculumUnitStatus }) {
  const toneClass =
    status === "done"
      ? "bg-green-bg text-green"
      : status === "in_progress"
      ? "bg-yellow-bg text-ink"
      : "bg-grey-100 text-grey-500";
  return (
    <span className={"text-[11px] font-bold px-2.5 py-0.5 rounded-full " + toneClass}>
      {STATUS_LABEL[status]}
    </span>
  );
}

function MemoCard({
  enrollmentId,
  initialMemos,
}: {
  enrollmentId: string;
  initialMemos: Memo[];
}) {
  const [memos, setMemos] = useState(initialMemos);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleAdd() {
    if (!text.trim() || submitting) return;
    setSubmitting(true);
    try {
      const memo = await addMemo(enrollmentId, text.trim());
      setMemos((prev) => [...prev, memo]);
      setText("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4.5">
      <h2 className="text-[14px] font-bold text-ink mb-3">메모·피드백</h2>
      {memos.length === 0 ? (
        <p className="text-[12.5px] text-grey-500 mb-3">
          아직 메모가 없습니다.
        </p>
      ) : (
        memos.map((m) => (
          <div key={m.id} className="mb-2.5">
            <div className="text-[11px] font-bold text-grey-300">
              {AUTHOR_LABEL[m.authorRole]}
            </div>
            <p className="text-[13px] text-ink">{m.text}</p>
          </div>
        ))
      )}
      <div className="flex gap-2 mt-3">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="메모를 남겨보세요"
          className="flex-1 px-3 py-2 border-[1.5px] border-grey-200 rounded-lg text-[13px]"
        />
        <button
          disabled={!text.trim() || submitting}
          onClick={handleAdd}
          className="text-[12px] font-bold px-4 py-2 rounded-lg bg-ink text-white disabled:opacity-50"
        >
          추가
        </button>
      </div>
    </div>
  );
}
