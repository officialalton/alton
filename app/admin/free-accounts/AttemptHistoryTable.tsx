"use client";

import { useState } from "react";
import { estimateAttempt } from "@/lib/mock-exam/score-aggregate";
import type { AttemptHistoryRow } from "@/lib/free-accounts/types";
import MockExamResultView from "@/app/student/mock-exam/[attemptId]/MockExamResultView";
import type { MockExamAttemptDetail } from "@/lib/mock-exam/attempt-data";
import { getAttemptDetailForAdminAction } from "../free-accounts-actions";
import { fmtRange } from "./ScoreStatsCard";

const STATUS: Record<string, string> = { assigned: "In progress", in_progress: "In progress", submitted: "In progress", graded: "Graded" };

/** 응시 이력 — 행 클릭 시 한 건씩 기존 결과 화면(읽기 전용)을 연다. 목록 단계에서는 문항 데이터를 읽지 않는다. */
export default function AttemptHistoryTable({ rows }: { rows: AttemptHistoryRow[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<MockExamAttemptDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function open(id: string) {
    if (openId === id) { setOpenId(null); setDetail(null); return; }
    setOpenId(id); setDetail(null); setError(null);
    try {
      const d = await getAttemptDetailForAdminAction(id);
      if (!d) setError("Couldn't load this attempt.");
      setDetail(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load this attempt.");
    }
  }

  return (
    <div className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-4" data-testid="attempt-history">
      <div className="text-[11px] font-bold text-grey-300 uppercase tracking-wide mb-2">Attempt history</div>
      {rows.length === 0 ? (
        <p className="text-[12.5px] text-grey-500">No attempts yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="text-left text-grey-500">
                <th className="py-1 pr-3">Test</th><th className="pr-3">Started</th><th className="pr-3">Status</th>
                <th className="pr-3">R&amp;W</th><th className="pr-3">Math</th><th className="pr-3">Total</th><th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const e = estimateAttempt(r);
                const graded = r.status === "graded";
                return (
                  <tr key={r.attemptId} className="border-t border-grey-100 align-top">
                    <td className="py-1.5 pr-3 text-ink font-semibold">
                      {r.examName} {r.attemptSeq > 1 && <span className="text-[11px] text-grey-500">Retake</span>}
                      {r.scoreAdjusted && <span className="text-[11px] text-grey-500"> · adjusted</span>}
                    </td>
                    <td className="pr-3 text-grey-500">{r.startedAt ? r.startedAt.slice(0, 10) : "—"}</td>
                    <td className="pr-3">{STATUS[r.status] ?? r.status}</td>
                    {graded && e.total ? (
                      <><td className="pr-3">{fmtRange(e.rw)}</td><td className="pr-3">{fmtRange(e.math)}</td><td className="pr-3">{fmtRange(e.total)}</td></>
                    ) : (
                      <td colSpan={3} className="pr-3 text-grey-500">
                        {graded
                          ? e.reason === "no_estimate_fixed"
                            ? `Score estimate not available (fixed-format test) · ${(r.sections.rw.correct ?? 0) + (r.sections.math.correct ?? 0)}/${r.sections.rw.total + r.sections.math.total} correct`
                            : e.reason === "insufficient_responses"
                              ? "Not enough responses to estimate a score range."
                              : "Score estimate not available"
                          : "—"}
                      </td>
                    )}
                    <td>{(graded || r.status !== "assigned") && (
                      <button onClick={() => open(r.attemptId)} className="text-[12px] font-semibold text-navy underline">
                        {openId === r.attemptId ? "Hide" : "View result"}
                      </button>
                    )}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {openId && (
        <div className="mt-4 border-t border-grey-200 pt-4">
          {error && <p className="text-[12.5px] text-red">{error}</p>}
          {!detail && !error && <p className="text-[12.5px] text-grey-500" aria-busy="true">Loading…</p>}
          {detail && <MockExamResultView attempt={detail} readOnly reportRole={null} />}
        </div>
      )}
    </div>
  );
}
