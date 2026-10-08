"use client";

import Link from "next/link";
import type { MockExamListRow, MockExamListState } from "@/lib/mock-exam/open-list";
import { attemptLabel, listStateOf as listStateOfStatus } from "@/lib/mock-exam/open-list";
import { AP_LABEL_TEXT, AP_SUBJECT_NAME } from "@/lib/ap-exam/layouts";

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
  emptyText = "No practice tests are available yet.",
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
            {r.examProgram === "ap" ? (
              <>
                <span className="rounded-full bg-grey-100 px-2 py-0.5 text-[10.5px] font-bold text-grey-600">{AP_SUBJECT_NAME[r.apSubject ?? ""] ?? "AP"}</span>
                {r.apLabel && <span className="rounded-full bg-ink px-2 py-0.5 text-[10.5px] font-bold text-white" data-testid="ap-label">{AP_LABEL_TEXT[r.apLabel]}</span>}
              </>
            ) : (
              <span className="rounded-full bg-grey-100 px-2 py-0.5 text-[10.5px] font-bold text-grey-600">{TIER_LABEL[r.difficultyTier] ?? r.difficultyTier}</span>
            )}
            {r.archived && <span className="text-[10.5px] text-grey-400">Past exam</span>}
          </div>
          {r.description && <p className="mt-1 text-[12px] text-grey-500">{r.description}</p>}
          <p className="mt-1 text-[12.5px] text-grey-500">
            {r.attempts.length > 1 && r.attempt?.attemptNo ? `${attemptLabel(r.attempt.attemptNo)} · ` : ""}
            {STATE_LABEL[r.state]}
            {r.state === "graded" && r.attempt && r.attempt.correctCount !== null && ` · ${r.attempt.correctCount}/${r.attempt.totalCount} correct`}
          </p>
          <Action row={r} readOnly={readOnly} busy={busyKey === r.key} onStart={onStart} onOpenResult={onOpenResult} resultHref={resultHref} />
          {r.attempts.length > 1 && (
            <details className="mt-2 text-[12px] text-grey-600">
              <summary className="cursor-pointer font-semibold text-grey-500">All attempts ({r.attempts.length})</summary>
              <ul className="mt-1 flex flex-col gap-1">
                {r.attempts.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center gap-2" data-testid="attempt-row">
                    <span className="font-semibold">{attemptLabel(a.attemptNo) || "Attempt"}</span>
                    <span>
                      {STATE_LABEL[listStateOfStatus(a.status)]}
                      {a.status === "graded" && a.correctCount !== null && ` · ${a.correctCount}/${a.totalCount} correct`}
                    </span>
                    {a.status === "graded" && (resultHref ? (
                      <Link href={resultHref(a.id)} className="font-bold text-ink underline">View results</Link>
                    ) : onOpenResult ? (
                      <button type="button" className="font-bold text-ink underline" onClick={() => onOpenResult(a.id)}>View results</button>
                    ) : null)}
                    {a.status === "in_progress" && !readOnly && <Link href={`/student/mock-exam/${a.id}`} className="font-bold text-ink underline">Continue</Link>}
                  </li>
                ))}
              </ul>
            </details>
          )}
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
    if (!onOpenResult) return null;
    return (
      <div className="flex flex-wrap items-center gap-x-4">
        <button type="button" className={cls} onClick={() => onOpenResult(a.id)}>View results</button>
        {/* 재응시 — 채점이 끝난 시험은 모든 학생이 다시 볼 수 있다(새 회차로 별도 기록). */}
        {row.state === "graded" && !readOnly && !row.archived && onStart && (
          <button type="button" className={cls} disabled={busy} onClick={() => onStart(row)}>
            {busy ? "Starting…" : "Retake"}
          </button>
        )}
      </div>
    );
  }
  if (readOnly) return null;
  if (row.state === "in_progress" && a) return <Link href={`/student/mock-exam/${a.id}`} className={cls}>Continue{a.attemptNo && a.attemptNo > 1 ? ` ${attemptLabel(a.attemptNo)}` : ""}</Link>;
  return (
    <button type="button" className={cls} disabled={busy} onClick={() => onStart?.(row)}>
      {busy ? "Starting…" : "Start"}
    </button>
  );
}
