"use client";

import { useEffect, useState } from "react";
import type { HomeworkKeywordOption, TeacherSessionOption } from "./homework-direct-data";
import { loadStudentHomeworkCreatePanelAction } from "./homework-direct-client-data";
import { issueHomeworkBatchAction } from "./homework-direct-actions";
import TeacherHomeworkHistoryPanel from "./TeacherHomeworkHistoryPanel";

export type HomeworkStudentOption = { id: string; name: string };

/** 2026-09-16(개정) — 교사 포털 "과제" 탭. 학생·수업(세션)·키워드를 한 번에 골라 즉시 발급한다
 * (별도 "불러오기" 단계 없음 — 발급 즉시 학생 포털·세션뷰의 기존 과제 UI에 그대로 뜬다).
 * "과제 내역"에서는 이미 낸 과제를 회차별로(학생 포털과 같은 화면) 바로 채점할 수 있다. */
export default function HomeworkAssignTab({
  students, initialStudentId,
}: {
  students: HomeworkStudentOption[];
  initialStudentId?: string;
}) {
  const [subtab, setSubtab] = useState<"create" | "history">("create");
  const [studentId, setStudentId] = useState(initialStudentId ?? students[0]?.id ?? "");
  const [keywords, setKeywords] = useState<HomeworkKeywordOption[]>([]);
  const [sessions, setSessions] = useState<TeacherSessionOption[]>([]);
  const [sessionId, setSessionId] = useState("");
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
    loadStudentHomeworkCreatePanelAction(studentId)
      .then((panel) => { setKeywords(panel.keywords); setSessions(panel.sessions); setSessionId(panel.sessions[0]?.sessionId ?? ""); })
      .finally(() => setLoading(false));
  }, [studentId]);

  const requests = keywords
    .map((k) => ({ keywordId: k.id, count: Math.max(0, parseInt(counts[k.id] ?? "", 10) || 0) }))
    .filter((r) => r.count > 0);
  const totalRequested = requests.reduce((n, r) => n + r.count, 0);

  async function issue() {
    setBusy(true);
    setError(null);
    setNotice(null);
    const r = await issueHomeworkBatchAction(studentId, sessionId, requests);
    setBusy(false);
    if (!r.ok) { setError(r.error); return; }
    setCounts({});
    setNotice(`과제 ${r.value.issuedCount}문항을 발급했습니다. 학생 포털·수업 화면의 과제 탭에서 바로 보입니다.`);
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

      {!studentId ? null : subtab === "history" ? (
        <TeacherHomeworkHistoryPanel key={studentId} studentId={studentId} />
      ) : loading ? (
        <p className="text-[13px] text-grey-500">불러오는 중…</p>
      ) : (
        <div className="border-[1.5px] border-grey-200 rounded-xl px-4 py-3.5">
          <p className="text-[12.5px] font-bold text-grey-500 mb-2">발급할 수업</p>
          {sessions.length === 0 ? (
            <p className="text-[12.5px] text-grey-500 mb-3">이 학생과 담당 중인 예정 수업이 없습니다.</p>
          ) : (
            <select value={sessionId} onChange={(e) => setSessionId(e.target.value)} className="border-[1.5px] border-grey-200 rounded-lg px-2.5 py-1.5 text-[13px] mb-3 w-full">
              {sessions.map((s) => <option key={s.sessionId} value={s.sessionId}>{s.label}</option>)}
            </select>
          )}

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
            disabled={busy || totalRequested === 0 || !sessionId}
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
