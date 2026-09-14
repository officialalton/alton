"use client";

import { useState } from "react";
import type { SessionViewViewer } from "@/lib/session-view";
import type { KeywordProblem } from "@/lib/unit-composition";
import type { HomeworkItem } from "./homework-data";
import type { SessionProblem } from "./session-problem-data";
import type { HomeworkKeywordPool, IssuedHomeworkItem } from "./homework-v3-data";
import { issueHomeworkByKeywords, withdrawHomework } from "./homework-v3-actions";
import ProblemsPanel from "./ProblemsPanel";

// 2026-09-14 과제 v3 통일(docs/2026-09-14-homework-v3-unification.md)
//
//   위: [교사만] 발급 구역 — 회차 키워드별로 "문제 은행에서 담을 수 있는 수"를 보고 몇 개 낼지 적으면
//       무작위로 뽑아 발급한다(2026-09-14 UAT: 개별 클릭 방식 폐기). 발급된 항목은 학생이 시작하기 전까지 회수.
//   아래: 과제 문제 패널 — 수업 '문제' 탭과 **완전히 같은** 화면·풀이·채점(ProblemsPanel source="homework").
//   레거시 homework_items 는 기록이 있을 때만 읽기 전용으로 보여준다. 신규 쓰기는 없다.

const FORMAT_LABEL: Record<string, string> = { mc: "객관식", spr: "숫자 입력", essay: "서술형", math: "풀이형" };

export default function HomeworkTab({
  sessionId,
  studentId,
  viewerUserId,
  initialItems,
  viewerRole,
  sessionSource = "legacy",
  realViewerRole,
  homeworkProblems = [],
  pool = [],
  issued = [],
  keywordPools = [],
}: {
  sessionId: string;
  studentId: string;
  viewerUserId?: string;
  /** 레거시 homework_items — 읽기 전용. */
  initialItems: HomeworkItem[];
  viewerRole: SessionViewViewer;
  sessionSource?: "legacy" | "v3";
  /** 데모션되지 않은 실제 역할 — 발급·회수는 실제 교사·관리자만. */
  realViewerRole?: SessionViewViewer;
  homeworkProblems?: SessionProblem[];
  /** 이 회차 키워드 풀의 문제(교사에게만) — 발급 목록의 이름 표시용. */
  pool?: KeywordProblem[];
  /** 회차 키워드별 담을 수 있는 수(교사에게만). */
  keywordPools?: HomeworkKeywordPool[];
  issued?: IssuedHomeworkItem[];
  /** 수업에서 다룬(고정된) 문제 — 키워드별 수 계산은 서버(keywordPools)에서 했으므로 여기서는 받지 않는다. */
  usedInLessonIds?: string[];
}) {
  const canIssue = sessionSource === "v3" && (realViewerRole === "teacher" || realViewerRole === "admin");
  const panelRole: "student" | "teacher" | "parent" | "admin" =
    viewerRole === "teacher" || viewerRole === "student" || viewerRole === "parent" || viewerRole === "admin"
      ? viewerRole
      : "student";

  return (
    <div>
      {canIssue && (
        <IssueBox sessionId={sessionId} pool={pool} issued={issued} keywordPools={keywordPools} />
      )}

      {sessionSource === "v3" ? (
        <ProblemsPanel
          sessionId={sessionId}
          studentId={studentId}
          problems={homeworkProblems}
          viewerRole={panelRole}
          viewerUserId={viewerUserId}
          source="homework"
        />
      ) : null}

      {initialItems.length > 0 && (
        <section className="max-w-[760px] mx-auto px-5 sm:px-8 py-6 border-t border-grey-200">
          <h2 className="text-[13px] font-bold text-ink mb-1">예전 과제 기록</h2>
          <p className="text-[12px] text-grey-500 mb-3">이전 방식으로 낸 과제입니다. 읽기만 합니다.</p>
          {initialItems.map((item) => (
            <div key={item.id} className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-3">
              <h3 className="text-[14px] font-bold text-ink mb-1">{item.title}</h3>
              {item.description && <p className="text-[13px] text-grey-500 leading-[1.6] mb-2">{item.description}</p>}
              <div className="text-[11px] font-bold text-grey-300 uppercase tracking-wide mt-2">학생 답안</div>
              <div className="text-[13px] text-ink whitespace-pre-wrap">{item.studentAnswer || "제출하지 않았습니다."}</div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

function IssueBox({
  sessionId,
  pool,
  issued,
  keywordPools,
}: {
  sessionId: string;
  pool: KeywordProblem[];
  issued: IssuedHomeworkItem[];
  keywordPools: HomeworkKeywordPool[];
}) {
  const [open, setOpen] = useState(issued.length === 0);
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [includeUsed, setIncludeUsed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const labelById = new Map(pool.map((p) => [p.problemId, p]));
  const capOf = (k: HomeworkKeywordPool) => (includeUsed ? k.availableWithUsed : k.available);
  const requests = keywordPools
    .map((k) => ({ keywordId: k.keywordId, count: Math.min(capOf(k), Math.max(0, parseInt(counts[k.keywordId] ?? "", 10) || 0)) }))
    .filter((r) => r.count > 0);
  const totalRequested = requests.reduce((n, r) => n + r.count, 0);
  const usedTotal = keywordPools.reduce((n, k) => n + k.usedInLesson, 0);

  async function issue() {
    if (requests.length === 0) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    const r = await issueHomeworkByKeywords(sessionId, requests, !includeUsed);
    if (!r.ok) {
      setError(r.error);
      setBusy(false);
      return;
    }
    if ((r.count ?? 0) === 0) {
      setNotice("뽑을 수 있는 문제가 없어 발급된 것이 없습니다.");
      setBusy(false);
      return;
    }
    // 발급 결과(과제 문제 패널·목록)는 서버 데이터라 한 번 다시 읽는다.
    window.location.reload();
  }

  async function withdraw(item: IssuedHomeworkItem) {
    setBusy(true);
    setError(null);
    const r = await withdrawHomework(item.itemId);
    if (!r.ok) {
      setError(r.error);
      setBusy(false);
      return;
    }
    window.location.reload();
  }

  return (
    <section className="border-b border-grey-200 px-5 sm:px-8 py-5" data-testid="homework-issue">
      <div className="max-w-[760px] mx-auto">
        <div className="flex flex-wrap items-center gap-3 mb-2">
          <h2 className="text-[14px] font-extrabold text-ink">과제 발급</h2>
          <span className="text-[12px] text-grey-500">발급 {issued.length}개</span>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="ml-auto text-[12px] font-bold px-3 py-1.5 rounded-lg border-[1.5px] border-grey-200 text-ink"
          >
            {open ? "접기" : "과제 내기"}
          </button>
        </div>
        {error && <p className="text-[12.5px] text-red mb-2">{error}</p>}
        {notice && <p className="text-[12.5px] text-grey-500 mb-2">{notice}</p>}

        {issued.length > 0 && (
          <ul className="mb-3">
            {issued.map((i) => {
              const p = labelById.get(i.problemId);
              return (
                <li key={i.itemId} className="flex items-center gap-2 text-[12.5px] py-1 border-b border-grey-100">
                  <span className="font-bold text-ink shrink-0">과제 {i.position}</span>
                  <span className="text-grey-500 truncate flex-1">
                    {p ? `${FORMAT_LABEL[p.format] ?? p.format} · ${p.label}` : "문제"}
                  </span>
                  <button
                    type="button"
                    disabled={busy || i.started}
                    title={i.started ? "학생이 이미 풀기 시작해 회수할 수 없습니다" : undefined}
                    onClick={() => void withdraw(i)}
                    className="text-[11.5px] font-bold text-red disabled:opacity-40 shrink-0"
                  >
                    {i.started ? "풀이 시작함" : "회수"}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {open && (
          <div className="border-[1.5px] border-grey-200 rounded-xl px-4 py-3">
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <p className="text-[12px] text-grey-500">
                이 회차 키워드별로 몇 개 낼지 적으면 문제 은행에서 무작위로 골라 발급합니다. 학생은 수업 문제와 같은 방식으로
                풀고, 채점 뒤 정답·해설이 열립니다.
              </p>
              {usedTotal > 0 && (
                <label className="text-[12px] text-ink flex items-center gap-1.5">
                  <input type="checkbox" checked={includeUsed} onChange={(e) => setIncludeUsed(e.target.checked)} />
                  수업에서 다룬 문제 {usedTotal}개도 포함
                </label>
              )}
            </div>
            {keywordPools.length === 0 ? (
              <p className="text-[12.5px] text-grey-500">이 회차에 키워드가 없어 낼 수 있는 문제가 없습니다.</p>
            ) : (
              <ul className="divide-y divide-grey-100">
                {keywordPools.map((k) => {
                  const cap = capOf(k);
                  return (
                    <li key={k.keywordId} className="flex flex-wrap items-center gap-3 py-2 text-[12.5px]">
                      <span className="font-bold text-ink min-w-[120px]">{k.label}</span>
                      <span className="text-grey-500 flex-1 min-w-[160px]">
                        문제 은행 {k.total}개 · 담을 수 있는 {cap}개
                        {k.issued > 0 && ` · 발급됨 ${k.issued}`}
                        {!includeUsed && k.usedInLesson > 0 && ` · 수업에서 다룸 ${k.usedInLesson} 제외`}
                      </span>
                      <label className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min={0}
                          max={cap}
                          inputMode="numeric"
                          aria-label={`${k.label} 개수`}
                          disabled={cap === 0}
                          value={counts[k.keywordId] ?? ""}
                          onChange={(e) => setCounts((c) => ({ ...c, [k.keywordId]: e.target.value }))}
                          placeholder="0"
                          className="w-[72px] text-[13px] border-[1.5px] border-grey-200 rounded-lg px-2 py-1 disabled:bg-grey-100"
                        />
                        <span className="text-grey-500">개</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
            <button
              type="button"
              disabled={busy || totalRequested === 0}
              onClick={() => void issue()}
              className="mt-2 text-[12.5px] font-bold px-4 py-2 rounded-lg bg-ink text-white disabled:opacity-50"
            >
              {busy ? "발급 중…" : `무작위로 발급 (${totalRequested})`}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
