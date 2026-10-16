"use client";

// 일반(수강) 학생 상세의 모의고사 점수 카드 — Free Accounts 상세와 같은 공유 집계 모듈·같은 카드를 쓴다.
import { useEffect, useState } from "react";
import type { AttemptHistoryRow } from "@/lib/free-accounts/types";
import { getStudentAttemptFactsAction } from "./free-accounts-actions";
import ScoreStatsCard from "./free-accounts/ScoreStatsCard";

export default function StudentMockScoresCard({ studentId }: { studentId: string }) {
  const [facts, setFacts] = useState<AttemptHistoryRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    getStudentAttemptFactsAction(studentId)
      .then((r) => live && setFacts(r))
      .catch((e) => live && setError(e instanceof Error ? e.message : "Couldn't load mock exam scores."));
    return () => { live = false; };
  }, [studentId]);
  if (error) return <p className="text-[12.5px] text-red mb-4">{error}</p>;
  if (!facts) return <p className="text-[12.5px] text-grey-500 mb-4" aria-busy="true">Loading…</p>;
  return <ScoreStatsCard facts={facts} />;
}
