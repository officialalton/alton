"use client";

import Link from "next/link";
import type { MockExamListRow, MockExamListState } from "@/lib/mock-exam/open-list";

// 공개 모의고사 목록(학생·학부모 공용). 학생은 시작·이어서·결과 보기, 학부모는 읽기 전용(시작 불가).
// 2026-10-01 — 배정 없음: 공개된 세트는 모든 활성 학생에게 보이고 학생이 직접 시작한다.

const STATE_LABEL: Record<MockExamListState, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  submitted: "Grading",
  graded: "Completed",
};

const TIER_LABEL: Record<string, string> = { foundation: "Foundation", standard: "Standard", advanced: "Advanced" };

export default function MockExamOpenList({
  rows,
  readOnly,
  busyKey,
  onStart,
  onOpenResult,
  resultHref,
  emptyText = "No mock exams are available yet.",
}: {
  rows: MockExamListRow[];
  readOnly: boolean;
  busyKey?: string | null;
  /** 학생: 미응시 '시작' */
  onStart?: (row: MockExamListRow) => void;
  /** 학생: 완료 결과를 탭 안에서 열기 */
  onOpenResult?: (attemptId: string) => void;
  /** 학부모: 완료 결과 상세 링크 */
  resultHref?: (attemptId: string) => string;
  emptyText?: string;
}) {
  if (rows.length === 0) return <p className="text-[13px] text-grey-500">{emptyText}</p>;
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((r) => (
        <li key={r.key} className="rounded-lg border border-grey-200 bg-white p-4">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[14px] font-bold">{r.name}</p>
            <span className="rounded-full bg-grey-100 px-2 py-0.5 text-[10.5px] font-bold text-grey-600">{TIER_LABEL[r.difficultyTier] ?? r.difficultyTier}</span>
            {r.archived && <span className="text-[10.5px] text-grey-400">Past exam</span>}
          </div>
          {r.description && <p className="mt-1 text-[12px] text-grey-500">{r.description}</p>}
          <p className="mt-1 text-[12.5px] text-grey-500">
            {STATE_LABEL[r.state]}
            {r.state === "graded" && r.attempt && r.attempt.correctCount !== null && ` · ${r.attempt.correctCount}/${r.attempt.totalCount} correct`}
          </p>
          <Action row={r} readOnly={readOnly} busy={busyKey === r.key} onStart={onStart} onOpenResult={onOpenResult} resultHref={resultHref} />
        </li>
      ))}
    </ul>
  );
}

function Action({
  row,
  readOnly,
  busy,
  onStart,
  onOpenResult,
  resultHref,
}: {
  row: MockExamListRow;
  readOnly: boolean;
  busy: boolean;
  onStart?: (row: MockExamListRow) => void;
  onOpenResult?: (attemptId: string) => void;
  resultHref?: (attemptId: string) => string;
}) {
  const cls = "mt-2 inline-block text-[12.5px] font-bold text-ink underline disabled:opacity-50";
  const a = row.attempt;
  if (row.state === "graded" || row.state === "submitted") {
    if (!a) return null;
    if (resultHref) return row.state === "graded" ? <Link href={resultHref(a.id)} className={cls}>View detailed results</Link> : null;
    return onOpenResult ? <button type="button" className={cls} onClick={() => onOpenResult(a.id)}>View results</button> : null;
  }
  if (readOnly) return null;
  if (row.state === "in_progress" && a) return <Link href={`/student/mock-exam/${a.id}`} className={cls}>Continue</Link>;
  return (
    <button type="button" className={cls} disabled={busy} onClick={() => onStart?.(row)}>
      {busy ? "Starting…" : "Start"}
    </button>
  );
}
