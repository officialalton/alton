"use client";

import { useState } from "react";
import type { SessionViewViewer } from "@/lib/session-view";
import type { KeywordProblem } from "@/lib/unit-composition";
import type { HomeworkItem } from "./homework-data";
import type { SessionProblem } from "./session-problem-data";
import type { IssuedHomeworkItem } from "./homework-v3-data";
import type { HomeworkDraftBatch } from "@/app/teacher/homework-direct-data";
import { loadHomeworkBatchIntoSession, withdrawHomework } from "./homework-v3-actions";
import ProblemsPanel from "./ProblemsPanel";

// 2026-09-16 제품 오너 지시 — 과제를 회차 키워드 풀에 묶지 않는다. 교사 포털("과제" 탭)에서
// 학생별로 키워드를 골라 미리 만든 배치 중 최근 것을 여기서 "불러오기"만 하면 발급된다.
// docs/2026-09-16-homework-direct-issue-plan.md 참고(2026-09-14 과제 v3 통일 문서의
// "회차 키워드별 개수 입력" UI를 대체한다 — 문제 풀이·채점 흐름은 그대로).
//   위: [교사만] 배치 불러오기 구역. 발급된 항목은 학생이 시작하기 전까지 회수.
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
  batches = [],
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
  /** 발급된 목록의 이름 표시용. */
  pool?: KeywordProblem[];
  /** 교사 포털에서 미리 만든 이 학생의 최근 과제 배치(교사에게만) — 여기서 "불러오기"로 발급한다. */
  batches?: HomeworkDraftBatch[];
  issued?: IssuedHomeworkItem[];
}) {
  const canIssue = sessionSource === "v3" && (realViewerRole === "teacher" || realViewerRole === "admin");
  const panelRole: "student" | "teacher" | "parent" | "admin" =
    viewerRole === "teacher" || viewerRole === "student" || viewerRole === "parent" || viewerRole === "admin"
      ? viewerRole
      : "student";

  return (
    <div>
      {canIssue && (
        <IssueBox sessionId={sessionId} pool={pool} issued={issued} batches={batches} />
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
  batches,
}: {
  sessionId: string;
  pool: KeywordProblem[];
  issued: IssuedHomeworkItem[];
  batches: HomeworkDraftBatch[];
}) {
  const [open, setOpen] = useState(issued.length === 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const labelById = new Map(pool.map((p) => [p.problemId, p]));

  async function loadBatch(batchId: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    const r = await loadHomeworkBatchIntoSession(batchId, sessionId);
    if (!r.ok) {
      setError(r.error);
      setBusy(false);
      return;
    }
    if ((r.count ?? 0) === 0) {
      setNotice("이미 전부 발급된 배치라 새로 발급된 것이 없습니다.");
      setBusy(false);
      return;
    }
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
            {open ? "접기" : "배치 불러오기"}
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
            <p className="text-[12px] text-grey-500 mb-2">
              교사 포털 “과제” 탭에서 미리 만든 이 학생의 과제 배치입니다. 원하는 배치를 이 수업에 불러오면 학생이
              수업 문제와 같은 방식으로 풀고, 채점 뒤 정답·해설이 열립니다.
            </p>
            {batches.length === 0 ? (
              <p className="text-[12.5px] text-grey-500">
                아직 만든 과제 배치가 없습니다. 교사 포털 “과제” 탭에서 먼저 만들어 주세요.
              </p>
            ) : (
              <ul className="divide-y divide-grey-100">
                {batches.map((b) => (
                  <li key={b.id} className="flex flex-wrap items-center gap-3 py-2 text-[12.5px]">
                    <span className="text-grey-500 flex-1 min-w-[200px]">
                      {b.problemCount}문항 · {b.requests.map((r) => `${r.label} ${r.count}`).join(", ") || "키워드 정보 없음"}
                      {b.loadedAt && <span className="text-grey-400"> · 불러온 적 있음</span>}
                    </span>
                    <span className="text-[11px] text-grey-400">{new Date(b.createdAt).toLocaleDateString("ko-KR")}</span>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void loadBatch(b.id)}
                      className="text-[12px] font-bold px-3 py-1.5 rounded-lg bg-ink text-white disabled:opacity-50"
                    >
                      이 수업에 불러오기
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
