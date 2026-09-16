"use client";

import { useEffect, useState } from "react";
import type { HomeworkKeywordOption } from "./homework-direct-data";
import { loadStudentHomeworkCreatePanelAction, loadStudentHomeworkBatchesAction } from "./homework-direct-client-data";
import { issueHomeworkBatchAction } from "@/lib/homework-batch-actions";
import type { HomeworkBatch } from "@/lib/homework-batch-data";
import HomeworkBatchPanel from "@/app/components/HomeworkBatchPanel";

export type HomeworkStudentOption = { id: string; name: string };

/** 2026-09-16(제품 오너 2차 정정) — 과제는 수업(세션)과 무관하다. 교사 포털 "과제" 탭은 학생·키워드를
 * 골라 즉시 발급("과제 생성")하고, "과제 내역"에서 배치를 눌러 그대로 채점한다. 발급마다 새 배치가
 * 생기고 이름은 발급 날짜로 자동으로 붙는다(예: "9월 16일 과제"). */
export default function HomeworkAssignTab({
  students, initialStudentId,
}: {
  students: HomeworkStudentOption[];
  initialStudentId?: string;
}) {
  const [subtab, setSubtab] = useState<"create" | "history">("create");
  const [studentId, setStudentId] = useState(initialStudentId ?? students[0]?.id ?? "");
  const [keywords, setKeywords] = useState<HomeworkKeywordOption[]>([]);
  const [batches, setBatches] = useState<HomeworkBatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!studentId) return;
    setLoading(true);
    setCounts({});
    setNotice(null);
    if (subtab === "create") {
      loadStudentHomeworkCreatePanelAction(studentId).then((panel) => setKeywords(panel.keywords)).finally(() => setLoading(false));
    } else {
      loadStudentHomeworkBatchesAction(studentId).then(setBatches).finally(() => setLoading(false));
    }
  }, [studentId, subtab]);

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
  }

  return (
    <div className="max-w-[720px] px-8 py-8">
      <h1 className="text-[20px] font-extrabold text-ink mb-1.5">과제</h1>
      <div className="flex gap-1 border-b border-grey-200 mb-5">
        {([["create", "과제 생성"], ["history", "과제 내역"]] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setSubtab(id)}
            className={"text-[13px] font-bold px-3.5 py-2 -mb-px border-b-2 " + (subtab === id ? "border-ink text-ink" : "border-transparent text-grey-500")}
          >
            {label}
          </button>
        ))}
      </div>

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

      {!studentId ? null : loading ? (
        <p className="text-[13px] text-grey-500">불러오는 중…</p>
      ) : subtab === "history" ? (
        <HomeworkBatchPanel batches={batches} viewerRole="teacher" />
      ) : (
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
      )}
    </div>
  );
}
