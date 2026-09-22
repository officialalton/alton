"use client";

import { useEffect, useRef, useState } from "react";
import type { HomeworkKeywordOption } from "@/app/teacher/homework-direct-data";
import { loadStudentHomeworkCreatePanelAction } from "@/app/teacher/homework-direct-client-data";
import { issueHomeworkBatchAction } from "@/lib/homework-batch-actions";

/** 2026-09-16 — 과제 발급 폼(교사 포털 "과제 생성"과 세션 화면 과제 탭이 공용으로 쓴다).
 * 과제는 수업(세션)과 무관하다 — 세션 화면에서 쓰더라도 이 학생의 과제 배치는 세션과
 * 별개로 저장되고, 학생 포털·교사 포털 "과제 내역"에서 똑같이 보인다. 수업 준비 단계에서도
 * 미리 낼 수 있다(제품 오너 지시, 2026-09-16). */
export default function HomeworkIssueForm({
  studentId, onIssued, initialKeywords,
}: {
  studentId: string;
  onIssued?: () => void;
  /** 2026-09-22(UAT "과제 탭 로딩이 길다") — 처음 보이는 학생의 키워드는 세션
   * 페이지가 SSR로 미리 받아 두면 탭을 열 때 왕복이 없다. 다른 학생을 고르면
   * (studentId가 이 값의 기준 학생과 달라지면) 평소처럼 새로 불러온다. */
  initialKeywords?: { studentId: string; keywords: HomeworkKeywordOption[] };
}) {
  const seeded = initialKeywords?.studentId === studentId;
  const [keywords, setKeywords] = useState<HomeworkKeywordOption[]>(seeded ? initialKeywords!.keywords : []);
  const [loading, setLoading] = useState(!seeded);
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const loadedForRef = useRef<string | null>(seeded ? studentId : null);

  useEffect(() => {
    if (loadedForRef.current === studentId) return;
    loadedForRef.current = studentId;
    setLoading(true);
    setCounts({});
    setNotice(null);
    loadStudentHomeworkCreatePanelAction(studentId).then((panel) => setKeywords(panel.keywords)).finally(() => setLoading(false));
  }, [studentId]);

  const requests = keywords
    .map((k) => ({ keywordId: k.id, count: Math.max(0, parseInt(counts[k.id] ?? "", 10) || 0) }))
    .filter((r) => r.count > 0);
  const totalRequested = requests.reduce((n, r) => n + r.count, 0);

  async function issue() {
    setBusy(true);
    setError(null);
    setNotice(null);
    const r = await issueHomeworkBatchAction(studentId, requests);
    setBusy(false);
    if (!r.ok) { setError(r.error); return; }
    setCounts({});
    setNotice(`과제 ${r.value.problemCount}문항을 발급했습니다. 학생 포털에서 바로 보입니다.`);
    onIssued?.();
  }

  if (loading) return <p className="text-[13px] text-grey-500">불러오는 중…</p>;

  return (
    <div className="border-[1.5px] border-grey-200 rounded-xl px-4 py-3.5">
      <p className="text-[12.5px] font-bold text-grey-500 mb-2">키워드별 개수</p>
      {keywords.length === 0 ? (
        <p className="text-[12.5px] text-grey-500">이 학생이 수강 중인 과목에 키워드가 없습니다.</p>
      ) : (
        <ul className="divide-y divide-grey-100 mb-3">
          {keywords.map((k) => (
            <li key={k.id} className="flex items-center gap-3 py-2 text-[12.5px]">
              <span className="font-bold text-ink flex-1">{k.label}</span>
              <input
                type="number" min={0} inputMode="numeric"
                value={counts[k.id] ?? ""}
                onChange={(e) => setCounts((c) => ({ ...c, [k.id]: e.target.value }))}
                placeholder="0"
                className="w-[64px] text-[13px] border-[1.5px] border-grey-200 rounded-lg px-2 py-1"
              />
              <span className="text-grey-500">개</span>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="text-[12.5px] text-red mb-2">{error}</p>}
      {notice && <p className="text-[12.5px] text-green mb-2">{notice}</p>}
      <button
        disabled={busy || totalRequested === 0}
        onClick={() => void issue()}
        className="text-[12.5px] font-bold px-3.5 py-2 rounded-lg bg-ink text-white disabled:opacity-40"
      >
        {busy ? "발급 중…" : `과제 발급 (${totalRequested})`}
      </button>
    </div>
  );
}
