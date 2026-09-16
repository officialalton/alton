"use client";

import { useEffect, useState } from "react";
import type { HomeworkKeywordOption, HomeworkDraftBatch } from "./homework-direct-data";
import { loadStudentHomeworkPanelAction } from "./homework-direct-client-data";
import { createHomeworkDraftBatchAction } from "./homework-direct-actions";

export type HomeworkStudentOption = { id: string; name: string };

/** 2026-09-16 — 교사 포털 "과제" 탭. 회차(수업)와 무관하게 학생별로 키워드를 직접 골라
 * 과제 배치를 만든다. 실제 수업에 내는 것은 세션뷰에서 배치를 "불러오기" 할 때다. */
export default function HomeworkAssignTab({
  students, initialStudentId,
}: {
  students: HomeworkStudentOption[];
  initialStudentId?: string;
}) {
  const [studentId, setStudentId] = useState(initialStudentId ?? students[0]?.id ?? "");
  const [keywords, setKeywords] = useState<HomeworkKeywordOption[]>([]);
  const [batches, setBatches] = useState<HomeworkDraftBatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!studentId) return;
    setLoading(true);
    setCounts({});
    loadStudentHomeworkPanelAction(studentId)
      .then((panel) => { setKeywords(panel.keywords); setBatches(panel.batches); })
      .finally(() => setLoading(false));
  }, [studentId]);

  const requests = keywords
    .map((k) => ({ keywordId: k.id, count: Math.max(0, parseInt(counts[k.id] ?? "", 10) || 0), label: k.label }))
    .filter((r) => r.count > 0);
  const totalRequested = requests.reduce((n, r) => n + r.count, 0);

  async function makeBatch() {
    setBusy(true);
    setError(null);
    setNotice(null);
    const r = await createHomeworkDraftBatchAction(studentId, requests);
    setBusy(false);
    if (!r.ok) { setError(r.error); return; }
    setCounts({});
    setNotice(`과제 배치를 만들었습니다(문항 ${r.value.problemCount}개). 수업에서 "불러오기"로 실제 발급할 수 있습니다.`);
    const panel = await loadStudentHomeworkPanelAction(studentId);
    setBatches(panel.batches);
  }

  return (
    <div className="max-w-[720px] px-8 py-8">
      <h1 className="text-[20px] font-extrabold text-ink mb-1.5">과제</h1>
      <p className="text-[13px] text-grey-500 mb-5">
        회차와 무관하게 학생별로 키워드를 골라 과제 배치를 미리 만듭니다. 실제 발급은 수업 화면의 과제 탭에서 배치를 불러올 때 이뤄집니다.
      </p>

      <div className="flex flex-wrap gap-2 mb-5">
        {students.map((s) => (
          <button
            key={s.id}
            onClick={() => setStudentId(s.id)}
            className={"text-[12.5px] font-bold px-3 py-1.5 rounded-lg border-[1.5px] " + (s.id === studentId ? "border-ink bg-ink text-white" : "border-grey-200 text-ink")}
          >
            {s.name}
          </button>
        ))}
        {students.length === 0 && <p className="text-[13px] text-grey-500">담당 학생이 없습니다.</p>}
      </div>

      {loading ? (
        <p className="text-[13px] text-grey-500">불러오는 중…</p>
      ) : studentId ? (
        <>
          <div className="border-[1.5px] border-grey-200 rounded-xl px-4 py-3.5 mb-6">
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
              onClick={() => void makeBatch()}
              className="text-[12.5px] font-bold px-3.5 py-2 rounded-lg bg-ink text-white disabled:opacity-40"
            >
              {busy ? "만드는 중…" : `과제 배치 만들기 (${totalRequested})`}
            </button>
          </div>

          <p className="text-[12px] font-bold text-grey-500 mb-2">최근 만든 배치</p>
          {batches.length === 0 ? (
            <div className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center">아직 만든 과제 배치가 없습니다.</div>
          ) : (
            batches.map((b) => (
              <div key={b.id} className="border border-grey-200 rounded-xl px-4 py-3 mb-2">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-ink">
                    {b.problemCount}문항 · {b.requests.map((r) => `${r.label} ${r.count}`).join(", ")}
                  </span>
                  {b.loadedAt && <span className="text-[11px] text-grey-500">불러온 적 있음</span>}
                </div>
                <p className="text-[11px] text-grey-400 mt-1">{new Date(b.createdAt).toLocaleString("ko-KR")}</p>
              </div>
            ))
          )}
        </>
      ) : null}
    </div>
  );
}
