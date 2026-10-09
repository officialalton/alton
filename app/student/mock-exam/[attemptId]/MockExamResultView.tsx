"use client";

import AttemptSwitcher from "./AttemptSwitcher";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { trackEvent } from "@/lib/analytics/track";
import { dedupeStem } from "@/lib/problem-text-guards";
import type { MockExamAttemptDetail, MockExamAttemptItem, MockExamAttemptSummary } from "@/lib/mock-exam/attempt-data";
import { AccuracyBarList } from "@/app/components/AccuracyBars";
import { computeMockExamReport, weakSkills, type BreakdownRow } from "@/lib/mock-exam/report";
import { INSUFFICIENT_RESPONSES_TEXT, SCORE_DISCLAIMER_EN, type ScoreRange } from "@/lib/mock-exam/score-estimate";
import { buildKeyInsights } from "@/lib/mock-exam/insights";
import { attemptLabel } from "@/lib/mock-exam/open-list";
import { satDomainDisplayName, satSkillDisplayName } from "@/lib/sat-keywords/taxonomy";
import { satDomainDescription, satSkillDescription } from "@/lib/sat-keywords/skill-descriptions";
import LearningText from "@/app/session/[id]/LearningText";
import RwStimulusView from "@/app/session/[id]/RwStimulusView";
import ProblemFigure from "@/app/session/[id]/ProblemFigure";
import ProblemNoteSnapshot from "@/app/components/ProblemNoteSnapshot";
import { loadMockExamAnnotationsAction, toggleMockExamSavedToPracticeAction } from "@/lib/mock-exam/attempt-actions";
import type { MockExamAnnotations } from "@/lib/mock-exam/annotation-anchor";
import AnnotationLayer from "./AnnotationLayer";
import ProblemErrorReportButton from "@/app/components/ProblemErrorReportButton";
import { loadMyProblemErrorReportsAction } from "@/lib/problem-error-reports/actions";
import type { MyReportStatus, ReporterRole } from "@/lib/problem-error-reports/labels";
import { problemText } from "@/lib/problem-figures/label-rule";

// 2026-10-02(오너 UAT B1~B7) — SAT 영어 시험이므로 학생이 보는 결과 문구는 영어가 기본이다.
// 해설만 English | 한국어 토글(explanation_en 이 없으면 한글 + 안내).
const SECTION_LABEL: Record<string, string> = { rw: "Reading and Writing", math: "Math" };
const SECTION_SHORT: Record<string, string> = { rw: "R&W", math: "Math" };
const OPTION_LETTERS = ["A", "B", "C", "D", "E"];

function pct(correct: number, total: number): string {
  if (total === 0) return "-";
  return `${Math.round((correct / total) * 100)}%`;
}

/** 기록이 없는(0초) 시간은 "0 min" 대신 null — 호출부가 표시하지 않는다(UAT B2). */
function formatMinutes(seconds: number): string | null {
  if (!seconds || seconds <= 0) return null;
  return `${Math.max(1, Math.round(seconds / 60))} min`;
}

function itemTitle(item: MockExamAttemptItem): string {
  return `${SECTION_LABEL[item.section]} · Question ${item.position}`;
}

function itemTopic(item: MockExamAttemptItem): string {
  return [satDomainDisplayName(item.satDomain), satSkillDisplayName(item.skillCode)].filter(Boolean).join(" · ");
}

/** 해설 — 영어(explanation_en) 기본, 한국어 토글. 영어가 없으면 한국어 + 안내. */
export function ExplanationPanel({ item }: { item: MockExamAttemptItem }) {
  const en = item.explanationEn?.trim() ? item.explanationEn : null;
  const ko = item.explanation?.trim() ? item.explanation : null;
  const [lang, setLang] = useState<"en" | "ko">(en ? "en" : "ko");
  if (!en && !ko) {
    return <p className="text-[12.5px] text-grey-400">No explanation is available for this question.</p>;
  }
  const showing = lang === "en" && en ? "en" : "ko";
  return (
    <div className="rounded-lg bg-grey-50 p-3 text-[12.5px] leading-relaxed" data-testid="mock-exam-explanation">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[11px] font-extrabold uppercase tracking-wide text-grey-400">Explanation</p>
        <div role="group" aria-label="Explanation language" className="inline-flex overflow-hidden rounded-md border border-grey-300 text-[11px] font-bold">
          <button
            type="button"
            aria-pressed={showing === "en"}
            disabled={!en}
            onClick={() => setLang("en")}
            className={`px-2 py-0.5 ${showing === "en" ? "bg-ink text-white" : "text-grey-600"} disabled:opacity-40`}
          >
            English
          </button>
          <button
            type="button"
            aria-pressed={showing === "ko"}
            disabled={!ko}
            onClick={() => setLang("ko")}
            className={`border-l border-grey-300 px-2 py-0.5 ${showing === "ko" ? "bg-ink text-white" : "text-grey-600"} disabled:opacity-40`}
          >
            한국어
          </button>
        </div>
      </div>
      {!en && (
        <p className="mb-1.5 text-[11px] text-grey-400" data-testid="mock-exam-explanation-en-missing">
          English explanation not available yet.
        </p>
      )}
      <div lang={showing}>
        <LearningText text={(showing === "en" ? en : ko) ?? ""} />
      </div>
    </div>
  );
}

/** 문제(지문·그림·선택지·내 답/정답)만 — 해설·도구 없음. */
/** 응시 중 남긴 하이라이트·메모·소거를 읽기 전용으로 불러온다(결과 화면은 절대 새로 기록하지 않는다). */
function useReadOnlyAnnotations(attemptId: string | undefined, setItemId: string): MockExamAnnotations | null {
  const [loaded, setLoaded] = useState<{ key: string; value: MockExamAnnotations } | null>(null);
  const key = `${attemptId ?? ""}:${setItemId}`;
  useEffect(() => {
    if (!attemptId) return;
    let alive = true;
    void loadMockExamAnnotationsAction(attemptId, setItemId).then((value) => {
      if (alive) setLoaded({ key, value });
    });
    return () => {
      alive = false;
    };
  }, [attemptId, setItemId, key]);
  return loaded?.key === key ? loaded.value : null;
}

function ItemProblem({ item, attemptId }: { item: MockExamAttemptItem; attemptId?: string }) {
  const annotations = useReadOnlyAnnotations(attemptId, item.setItemId);
  return (
    <>
      {item.adjusted && (
        <p className="mb-2 rounded-lg bg-green/10 px-3 py-1.5 text-[12px] font-semibold text-green" data-testid="mock-exam-item-adjusted">
          This question was scored as correct because an error was found in it.
        </p>
      )}
      <AnnotationLayer key={item.setItemId} readOnly highlights={annotations?.highlights ?? []}>
        {dedupeStem(item.passage, item.question) && <RwStimulusView question={item.question} passage={dedupeStem(item.passage, item.question)} className="mb-3 text-[13px]" />}
        {item.question && <LearningText text={item.question} className="mb-3 font-semibold text-[13.5px]" />}
      </AnnotationLayer>
      {item.figure ? <ProblemFigure spec={item.figure} text={problemText(item.passage, item.question, item.options)} className="mb-3" /> : null}

      {item.options && item.options.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          {item.options.map((opt, i) => {
            const isCorrect = item.correctIndex === i;
            const isMine = item.response === String(i);
            return (
              <div
                key={i}
                className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-[13px] ${
                  isCorrect ? "border-green bg-green/10" : isMine ? "border-red bg-red/5" : "border-grey-200"
                }`}
              >
                <span className="font-bold">{OPTION_LETTERS[i] ?? i + 1}.</span>
                <span className={annotations?.eliminated.includes(i) ? "line-through opacity-60" : undefined}>
                  <LearningText text={opt} />
                </span>
                {isCorrect && (
                  <span className="ml-auto shrink-0 text-[11px] font-bold text-green">{isMine ? "Your answer · Correct" : "Correct answer"}</span>
                )}
                {isMine && !isCorrect && <span className="ml-auto shrink-0 text-[11px] font-bold text-red">Your answer</span>}
              </div>
            );
          })}
          {!item.response && <p className="text-[12px] text-grey-400">You did not answer this question.</p>}
        </div>
      ) : (
        <div className="flex flex-col gap-1.5 text-[13px]">
          <p>
            <span className="font-bold text-grey-500">Your answer: </span>
            {item.response ?? <span className="text-grey-400">Not answered</span>}
          </p>
          <p>
            <span className="font-bold text-grey-500">Correct answer: </span>
            {item.answers?.join(" or ") ?? "-"}
          </p>
        </div>
      )}
    </>
  );
}

/** 문항 머리줄: 찍음 표시·제목·정오·영역/스킬 이름·문제 저장. */
function ItemHeader({ item, attemptId, viewerIsOwner }: { item: MockExamAttemptItem; attemptId?: string; viewerIsOwner: boolean }) {
  const [saved, setSaved] = useState(item.savedToPractice);
  async function toggleSaved() {
    if (!attemptId) return;
    const next = !saved;
    setSaved(next);
    await toggleMockExamSavedToPracticeAction(attemptId, item.setItemId, next);
    if (next) trackEvent("mistake_saved", { entry_point: "practice_results" });
  }
  const topic = itemTopic(item);
  return (
    <div className="mb-2 flex items-start justify-between gap-2">
      <div>
        <p className="text-[12px] font-bold text-grey-500">
          {item.guessed && item.response && (
            <span role="img" aria-label="Guessed" title="Marked as a guess" className="mr-1 rounded border border-grey-300 px-1 text-[10px] font-semibold text-grey-600">
              Guessed
            </span>
          )}
          {itemTitle(item)}
          {item.correct !== null && (
            <span className={`ml-2 text-[11px] font-bold ${item.correct ? "text-green" : "text-red"}`}>{item.correct ? "Correct" : "Incorrect"}</span>
          )}
        </p>
        {topic && <p className="text-[11.5px] text-grey-400">{topic}</p>}
      </div>
      {/* 2026-09-21(사용자 지시) — 학생 포털 Practice 탭에 이 문항을 저장/해제. */}
      {viewerIsOwner && attemptId && (
        <button
          type="button"
          onClick={toggleSaved}
          aria-pressed={saved}
          className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-bold ${
            saved ? "border-ink bg-ink text-white" : "border-grey-300 text-grey-500"
          }`}
          title="Save to My Notebook"
        >
          {saved ? "Saved" : "+ Save question"}
        </button>
      )}
    </div>
  );
}

type ItemToolsProps = {
  item: MockExamAttemptItem;
  attemptId?: string;
  studentId?: string;
  viewerIsOwner: boolean;
  reportRole: ReporterRole | null;
  reportStatus: MyReportStatus | null;
};

/** 해설 아래 도구 — 오류 신고 + 제출 시점 필기 스냅샷(읽기 전용, 필기 없으면 숨김). */
function ItemNote({ item, attemptId, studentId, viewerIsOwner }: Pick<ItemToolsProps, "item" | "attemptId" | "studentId" | "viewerIsOwner">) {
  if (!attemptId || !studentId) return null;
  return (
    <ProblemNoteSnapshot
      key={item.setItemId}
      context="mock_exam"
      targetId={attemptId}
      itemId={item.setItemId}
      authorId={viewerIsOwner ? undefined : studentId}
      label={viewerIsOwner ? "My scratch work (submitted)" : "Student's scratch work (submitted)"}
    />
  );
}

function ItemTools({ item, attemptId, studentId, viewerIsOwner, reportRole, reportStatus, noteFirst = false }: ItemToolsProps & { noteFirst?: boolean }) {
  return (
    <>
      {reportRole && attemptId && (
        <ProblemErrorReportButton
          className="mt-3"
          role={reportRole}
          lang="en"
          initialStatus={reportStatus}
          context={{ source: "mock_exam", attemptId, setItemId: item.setItemId, problemId: item.problemId }}
        />
      )}
      {!noteFirst && <ItemNote item={item} attemptId={attemptId} studentId={studentId} viewerIsOwner={viewerIsOwner} />}
    </>
  );
}

/** 문항 하나(지문·질문·선택지·내 답·정답·해설)를 읽기 전용으로 보여준다 — 교사의 "학생 풀이 읽기 전용
 * 열람"(TeacherMockExamAttemptViewer)에서도 그대로 재사용한다(채점 뒤 필드가 채워진 MockExamAttemptItem). */
export function ItemDetail({
  item,
  attemptId,
  studentId,
  viewerIsOwner = true,
  reportRole = null,
  reportStatus = null,
}: {
  item: MockExamAttemptItem;
  /** 문제 오류 신고 버튼을 보일 역할 — 학생(본인 결과)·선생님(담당 학생 열람)만. 학부모·관리자는 null. */
  reportRole?: ReporterRole | null;
  reportStatus?: MyReportStatus | null;
  /** 필기 열람에 필요 — 없으면(하위 호환) 필기 스냅샷을 안 보여준다. */
  attemptId?: string;
  studentId?: string;
  /** true(기본) — 이 응시의 학생 본인이 보는 중. false — 교사·학부모가 읽기 전용으로 보는 중. */
  viewerIsOwner?: boolean;
}) {
  return (
    <div className="rounded-lg border border-grey-200 bg-white p-4 lg:h-full lg:overflow-y-auto" data-testid="mock-exam-item-detail">
      <ItemHeader key={item.setItemId} item={item} attemptId={attemptId} viewerIsOwner={viewerIsOwner} />
      <ItemProblem item={item} attemptId={attemptId} />
      <div className="mt-3">
        <ExplanationPanel key={item.setItemId} item={item} />
      </div>
      <ItemTools item={item} attemptId={attemptId} studentId={studentId} viewerIsOwner={viewerIsOwner} reportRole={reportRole} reportStatus={reportStatus} />
    </div>
  );
}

/** 영역·스킬 설명 팝업 — 모달. Esc·배경·Close 로 닫힌다. 열리면 Close 에 포커스, 닫히면 원래 버튼으로 복귀. */
function InfoDialog({ title, body, onClose }: { title: string; body: string; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="mock-exam-info-title"
        className="w-full max-w-[420px] rounded-xl bg-white p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="mock-exam-info-title" className="text-[15px] font-extrabold text-ink">
          {title}
        </h2>
        <p className="mt-2 text-[13px] leading-relaxed text-grey-600">{body}</p>
        <div className="mt-4 flex justify-end">
          <button ref={closeRef} type="button" onClick={onClose} className="rounded-lg border-[1.5px] border-grey-200 px-4 py-1.5 text-[13px] font-semibold">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

type Info = { title: string; body: string };

function BreakdownList({ rows, kind, onInfo, size = "sm", highlightFirst = false }: { rows: BreakdownRow[]; kind: "domain" | "skill"; onInfo: (i: Info) => void; size?: "sm" | "lg"; highlightFirst?: boolean }) {
  return (
    <AccuracyBarList rows={rows} size={size} highlightFirst={highlightFirst}
      onInfo={(r) => onInfo({ title: r.label, body: (kind === "domain" ? satDomainDescription(r.key) : satSkillDescription(r.key)) ?? "No description is available yet." })} />
  );
}

/** 도넛 — 정답(초록)·오답/미응답(회색) 비율. 숫자는 옆에 따로 있으므로 장식(aria-hidden). */
function AccuracyDonut({ correct, total }: { correct: number; total: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const frac = total > 0 ? Math.min(1, correct / total) : 0;
  return (
    <svg width="132" height="132" viewBox="0 0 132 132" aria-hidden data-testid="mock-exam-donut" className="shrink-0">
      <circle cx="66" cy="66" r={r} fill="none" strokeWidth="16" className="stroke-grey-200" />
      <circle
        cx="66" cy="66" r={r} fill="none" strokeWidth="16" strokeLinecap="butt" className="stroke-green"
        strokeDasharray={`${frac * c} ${c}`} transform="rotate(-90 66 66)"
      />
      <text x="66" y="72" textAnchor="middle" className="fill-ink text-[22px] font-extrabold">{pct(correct, total)}</text>
    </svg>
  );
}

/** 예상 점수 범위 막대 — 트랙 위에 low~high 구간만 칠한다. */
function ScoreRangeBar({ label, range, min, max, strong = false }: { label: string; range: ScoreRange; min: number; max: number; strong?: boolean }) {
  const span = max - min;
  const left = Math.max(0, ((range.low - min) / span) * 100);
  const width = Math.max(2, ((range.high - range.low) / span) * 100);
  return (
    <div data-testid={`mock-exam-score-${label === "R&W" ? "rw" : label.toLowerCase()}`}>
      <div className="mb-1 flex items-baseline justify-between text-[12.5px]">
        <span className={`font-bold ${strong ? "text-ink" : "text-grey-600"}`}>{label}</span>
        <span className={`font-extrabold ${strong ? "text-[16px]" : "text-[14px]"}`}>{range.low}-{range.high}</span>
      </div>
      <div className="relative h-2.5 rounded-full bg-grey-100" aria-hidden>
        <div className="absolute h-full rounded-full bg-ink" style={{ left: `${left}%`, width: `${Math.min(width, 100 - left)}%` }} />
      </div>
      <div className="mt-0.5 flex justify-between text-[10px] text-grey-400" aria-hidden>
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

type TabKey = "summary" | "domain" | "review";
const TABS: { key: TabKey; label: string }[] = [
  { key: "summary", label: "Summary" },
  { key: "domain", label: "Results by Domain" },
  { key: "review", label: "Review Mistakes" },
];

/**
 * 채점 확정된 모의고사 결과 — 학생·학부모·교사 공용(사양 3절 "같은 원본에서 표시", 7절 결과 항목).
 * 2026-10-02(오너 UAT B4) — Summary / Results by Domain / Review Mistakes 서브탭.
 * 내부 채점 근거는 이 컴포넌트에 넘어오지 않는다 — attempt-data.ts 가 공개 가능한 필드만 내려준다.
 */
export default function MockExamResultView({
  attempt,
  readOnly,
  reportRole: reportRoleProp,
  attempts,
  attemptHrefBase,
  onSelectAttempt,
}: {
  attempt: MockExamAttemptDetail;
  readOnly: boolean;
  /** 재응시: 같은 시험의 모든 회차(요약). 둘 이상이면 상단에 Attempt 1 | Attempt 2 전환을 보인다. */
  attempts?: MockExamAttemptSummary[];
  /** 회차 전환을 링크로(독립 결과 페이지: 회차 id 앞에 붙는 경로 문자열 — 서버 컴포넌트에서 함수를 넘길 수 없다)·콜백으로(탭 안) 처리 — 둘 중 하나. */
  attemptHrefBase?: string;
  onSelectAttempt?: (attemptId: string) => void;
  /** 문제 오류 신고 버튼 역할. 생략하면 본인 결과(readOnly=false)는 학생, 읽기 전용(학부모 등)은 없음. */
  reportRole?: ReporterRole | null;
}) {
  const reportRole: ReporterRole | null = reportRoleProp !== undefined ? reportRoleProp : readOnly ? null : "student";
  // 내가 신고한 문항의 진행 상태 — 결과 화면당 한 번만 조회한다.
  const [myReports, setMyReports] = useState<Record<string, MyReportStatus>>({});
  useEffect(() => {
    if (!readOnly) trackEvent("practice_results_viewed", { entry_point: "results_page" }, { onceKey: `results-${attempt.id}` });
  }, [readOnly, attempt.id]);
  useEffect(() => {
    if (!reportRole || attempt.items.length === 0) return;
    let cancelled = false;
    loadMyProblemErrorReportsAction(attempt.items.map((i) => i.problemId))
      .then((r) => {
        if (!cancelled && r.ok) setMyReports(r.value);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [reportRole, attempt.items]);
  const report = computeMockExamReport(attempt.items, { sectionTimeSeconds: attempt.sectionTimeSeconds ?? null });
  // MST 응시만 예상 점수 범위(내부 추정)를 보인다. 서버가 계산해 범위만 내려준다.
  const scoreEstimate = attempt.format === "mst" ? (attempt.scoreEstimate ?? null) : null;
  const [tab, setTab] = useState<TabKey>("summary");
  const [info, setInfo] = useState<Info | null>(null);
  const closeInfo = useCallback(() => setInfo(null), []);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // R&W 가 먼저, 그다음 Math — 각 영역 안에서는 응시 순서(모듈·문항 번호)대로.
  const filtered = useMemo(() => {
    const order: Record<string, number> = { rw: 0, math: 1 };
    return attempt.items
      .map((it, idx) => ({ it, idx }))
      .sort((a, b) => (order[a.it.section] ?? 9) - (order[b.it.section] ?? 9) || a.it.position - b.it.position || a.idx - b.idx)
      .map((x) => x.it);
  }, [attempt.items]);
  const selected = filtered.find((i) => i.setItemId === selectedId) ?? filtered[0] ?? null;
  const totalTime = formatMinutes(report.totalTimeSpentSeconds);
  // 직전 회차(있으면) 대비 정답 수 — 재응시 회차 비교용. 요약 목록에서 이미 받은 값만 쓴다.
  const previous = useMemo(() => {
    if (!attempts || !attempt.attemptNo) return null;
    const prev = attempts
      .filter((a) => a.status === "graded" && a.correctCount !== null && (a.attemptNo ?? 0) < (attempt.attemptNo ?? 0))
      .sort((a, b) => (b.attemptNo ?? 0) - (a.attemptNo ?? 0))[0];
    return prev ? { attemptNo: prev.attemptNo ?? 0, correctCount: prev.correctCount ?? 0, totalCount: prev.totalCount } : null;
  }, [attempts, attempt.attemptNo]);
  const insights = useMemo(
    () => buildKeyInsights(report, attempt.items, { previous, correctCount: report.correctCount }),
    [report, attempt.items, previous],
  );
  // Performance by Domain (Preview) — 정답률이 낮은 영역 4개(같으면 R&W 먼저).
  const domainPreview = useMemo(
    () =>
      [...report.byDomain]
        .sort((a, b) => a.correct / a.total - b.correct / b.total || (a.section === b.section ? a.key.localeCompare(b.key) : a.section === "rw" ? -1 : 1))
        .slice(0, 4),
    [report.byDomain],
  );

  return (
    <div>
      <AttemptSwitcher attempt={attempt} attempts={attempts} attemptHrefBase={attemptHrefBase} onSelect={onSelectAttempt} />
      <div role="tablist" aria-label="Result sections" className="mb-4 flex gap-1 overflow-x-auto overflow-y-hidden scrollbar-hide border-b border-grey-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            id={`mock-exam-tab-${t.key}`}
            aria-selected={tab === t.key}
            aria-controls={`mock-exam-panel-${t.key}`}
            onClick={() => setTab(t.key)}
            className={`-mb-px shrink-0 whitespace-nowrap border-b-2 px-3 py-2 text-[13px] font-bold ${
              tab === t.key ? "border-ink text-ink" : "border-transparent text-grey-500 hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "summary" && (
        <div role="tabpanel" id="mock-exam-panel-summary" aria-labelledby="mock-exam-tab-summary" className="flex flex-col gap-4">
          {/* Overall Performance — 도넛 + 정답 수 + 총 소요 시간 + 면책 문구 */}
          <div className="rounded-lg border border-grey-200 bg-white p-5" data-testid="mock-exam-overall">
            <h3 className="mb-3 text-[13px] font-bold">Overall Performance</h3>
            <div className="flex flex-col items-center gap-5 sm:flex-row sm:gap-8">
              <AccuracyDonut correct={report.correctCount ?? 0} total={report.totalCount} />
              <div className="text-center sm:text-left">
                <p className="text-[12px] font-bold uppercase tracking-wide text-grey-500">Correct answers</p>
                <p className="mt-1 text-[32px] font-extrabold leading-none">
                  {report.correctCount ?? 0}/{report.totalCount}
                </p>
                <p className="mt-1 text-[13px] text-grey-500" data-testid="mock-exam-overall-meta">
                  {pct(report.correctCount ?? 0, report.totalCount)}
                  {totalTime && <> · Total time {totalTime}</>}
                </p>
              </div>
            </div>
            <p className="mt-3 text-[11.5px] text-grey-400">
              These results are a learning diagnostic and are not equivalent to an official SAT / College Board score.
            </p>
          </div>

          {attempt.scoreAdjusted && (
            <div role="note" className="rounded-lg border border-green bg-green/10 p-3 text-[12.5px] font-semibold text-green" data-testid="mock-exam-score-adjusted">
              Your score was adjusted because of a question error. Questions confirmed to have errors were scored as correct, and the score
              and estimated score range below use the adjusted scoring.
            </div>
          )}

          {!scoreEstimate && attempt.format === "mst" && attempt.scoreEstimateNote === "insufficient_responses" && (
            <div className="rounded-lg border border-grey-200 bg-white p-4" data-testid="mock-exam-score-estimate-insufficient">
              <h3 className="mb-1 text-[13px] font-bold">Estimated Score Range</h3>
              <p className="mb-1 text-[11.5px] font-semibold text-grey-500">Internal estimate — accuracy not verified</p>
              <p className="text-[13px] font-semibold text-grey-600">{INSUFFICIENT_RESPONSES_TEXT}</p>
              <p className="mt-2 text-[11.5px] text-grey-400">Your results and the right/wrong analysis below are still available. {SCORE_DISCLAIMER_EN}</p>
            </div>
          )}

          {scoreEstimate && (
            <div className="rounded-lg border border-grey-200 bg-white p-4" data-testid="mock-exam-score-estimate">
              <h3 className="mb-1 text-[13px] font-bold">Estimated Score Range</h3>
              <p className="mb-3 text-[11.5px] font-semibold text-grey-500">Internal estimate — accuracy not verified; not an official College Board score</p>
              <div className="flex flex-col gap-3">
                <ScoreRangeBar label="R&W" range={scoreEstimate.rw} min={200} max={800} />
                <ScoreRangeBar label="Math" range={scoreEstimate.math} min={200} max={800} />
                <ScoreRangeBar label="Total" range={scoreEstimate.total} min={400} max={1600} strong />
              </div>
              <p className="mt-3 text-[11.5px] text-grey-400">{SCORE_DISCLAIMER_EN}</p>
            </div>
          )}

          <div className="rounded-lg border border-grey-200 bg-white p-4">
            <h3 className="mb-2 text-[13px] font-bold">Section Breakdown</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {report.bySection.map((s) => {
                const t = formatMinutes(s.timeSpentSeconds);
                return (
                  <div key={s.section} className="rounded-lg bg-grey-50 p-3" data-testid={`mock-exam-section-${s.section}`}>
                    <p className="text-[12px] font-bold text-grey-500">{SECTION_LABEL[s.section]}</p>
                    <p className="text-[18px] font-extrabold">
                      {s.correct ?? 0}/{s.total}
                      <span className="ml-2 text-[12px] font-semibold text-grey-500">{pct(s.correct ?? 0, s.total)}</span>
                    </p>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-grey-200" aria-hidden>
                      <div className="h-full rounded-full bg-ink" style={{ width: `${s.total ? Math.round(((s.correct ?? 0) / s.total) * 100) : 0}%` }} />
                    </div>
                    {t && <p className="mt-1 text-[11.5px] text-grey-500">Time {t}</p>}
                  </div>
                );
              })}
            </div>
          </div>

          {domainPreview.length > 0 && (
            <div className="rounded-lg border border-grey-200 bg-white p-4" data-testid="mock-exam-domain-preview">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="text-[13px] font-bold">
                  Performance by Domain <span className="font-semibold text-grey-400">(Preview)</span>
                </h3>
                <button type="button" onClick={() => setTab("domain")} className="text-[12px] font-bold text-ink underline">
                  View all
                </button>
              </div>
              <ul className="flex flex-col gap-2">
                {domainPreview.map((d) => (
                  <li key={d.key} className="text-[12.5px]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-grey-700">
                        {d.label} <span className="text-grey-400">· {SECTION_SHORT[d.section]}</span>
                      </span>
                      <span className="shrink-0 font-bold">
                        {d.correct}/{d.total} ({pct(d.correct, d.total)})
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-grey-100" aria-hidden>
                      <div className="h-full rounded-full bg-ink" style={{ width: `${Math.round((d.correct / d.total) * 100)}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {insights.length > 0 && (
            <div data-testid="mock-exam-insights">
              <h3 className="mb-2 text-[13px] font-bold">Key Insights</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {insights.map((c) => (
                  <div
                    key={c.key}
                    data-testid={`mock-exam-insight-${c.key}`}
                    className={`rounded-lg border bg-white p-3 ${c.tone === "good" ? "border-green" : c.tone === "warn" ? "border-red/40" : "border-grey-200"}`}
                  >
                    <p className={`text-[11.5px] font-extrabold uppercase tracking-wide ${c.tone === "good" ? "text-green" : c.tone === "warn" ? "text-red" : "text-grey-500"}`}>{c.title}</p>
                    <p className="mt-1 text-[12.5px] text-grey-700">{c.body}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "domain" && (
        <div role="tabpanel" id="mock-exam-panel-domain" aria-labelledby="mock-exam-tab-domain" className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {(["rw", "math"] as const).map((sec) => {
            const domains = report.byDomain.filter((d) => d.section === sec);
            const skills = report.bySkill.filter((d) => d.section === sec);
            const weak = weakSkills(skills);
            return (
              <section key={sec} className="flex flex-col gap-3 rounded-lg border border-grey-200 bg-white p-4" data-testid={`mock-exam-domain-${sec}`}>
                <h3 className="text-[14px] font-extrabold">{SECTION_LABEL[sec]}</h3>
                {domains.length === 0 ? (
                  <p className="text-[12.5px] text-grey-400">No graded questions in this section.</p>
                ) : (
                  <>
                    <div>
                      <h4 className="mb-1.5 text-[12px] font-bold uppercase tracking-wide text-grey-500">Domains</h4>
                      <BreakdownList rows={domains} kind="domain" onInfo={setInfo} size="lg" />
                    </div>
                    {weak.length > 0 && (
                      <div data-testid="mock-exam-weak-skills">
                        <h4 className="mb-1.5 text-[12px] font-bold uppercase tracking-wide text-grey-500">Skills to Focus On</h4>
                        <BreakdownList rows={weak} kind="skill" onInfo={setInfo} highlightFirst />
                        <p className="mt-2 text-[12px] text-grey-600" data-testid="mock-exam-weak-next-step">
                          Weakest first. Next step: review the questions you missed in these skills{" "}
                          <button type="button" onClick={() => setTab("review")} className="font-semibold text-ink underline">Review mistakes</button>.
                        </p>
                      </div>
                    )}
                    {skills.length > 0 && (
                      <div>
                        <h4 className="mb-1.5 text-[12px] font-bold uppercase tracking-wide text-grey-500">Skills</h4>
                        <BreakdownList rows={skills} kind="skill" onInfo={setInfo} />
                      </div>
                    )}
                  </>
                )}
              </section>
            );
          })}
          <p className="text-[11.5px] text-grey-400 md:col-span-2">Select a domain or skill name to see what it covers.</p>
        </div>
      )}

      {tab === "review" && (
        <div role="tabpanel" id="mock-exam-panel-review" aria-labelledby="mock-exam-tab-review">
          {attempt.items.length === 0 ? (
            <p className="text-[12.5px] text-grey-400">There are no questions to review.</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:h-[calc(100vh-2rem)] lg:grid-cols-[230px_minmax(0,1fr)_minmax(240px,320px)] lg:items-stretch">
              {/* 왼쪽: 문항 목록 + 필터 */}
              <div className="rounded-lg border border-grey-200 bg-white p-3 lg:h-full lg:overflow-y-auto">
                {(
                  <ul className="flex max-h-[40vh] flex-col gap-1 overflow-y-auto lg:max-h-none">
                    {filtered.map((it) => {
                      const active = selected?.setItemId === it.setItemId;
                      return (
                        <li key={it.setItemId}>
                          <button
                            type="button"
                            onClick={() => setSelectedId(it.setItemId)}
                            aria-current={active ? "true" : undefined}
                            className={`flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-[12.5px] ${
                              active ? "bg-ink text-white" : "text-grey-600 hover:bg-grey-100"
                            }`}
                            data-testid={`review-item-${it.setItemId}`}
                          >
                            <span className="w-[62px] shrink-0 whitespace-nowrap font-semibold">
                              {SECTION_SHORT[it.section]} {it.position}
                            </span>
                            <span className="w-[56px] shrink-0 text-center">
                              {it.guessed && it.response ? (
                                <span role="img" aria-label="Guessed" data-testid={`review-guessed-${it.setItemId}`} className={`rounded border px-1 text-[10px] font-semibold ${active ? "border-white/60 text-white" : "border-grey-300 text-grey-600"}`}>
                                  Guessed
                                </span>
                              ) : null}
                            </span>
                            <span
                              className="ml-auto w-[20px] shrink-0 text-center text-[14px] font-extrabold"
                              data-testid={`review-mark-${it.setItemId}`}
                              role={it.correct === null ? undefined : "img"}
                              aria-label={it.correct === null ? undefined : it.correct ? "Correct" : "Incorrect"}
                            >
                              {it.correct === null ? "" : it.correct ? (
                                <span className={active ? "text-green-300" : "text-green"}>O</span>
                              ) : (
                                <span className={active ? "text-red-300" : "text-red"}>X</span>
                              )}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {!readOnly && report.missedItems.length > 0 && (
                  <p className="mt-2 text-[11px] text-grey-400">Your teacher assigns review and follow-up practice for missed questions.</p>
                )}
              </div>

              {/* 가운데: 문제 */}
              {selected ? (
                <div className="rounded-lg border border-grey-200 bg-white p-4 lg:h-full lg:overflow-y-auto" data-testid="mock-exam-item-detail">
                  <ItemHeader key={selected.setItemId} item={selected} attemptId={attempt.id} viewerIsOwner={!readOnly} />
                  <ItemProblem item={selected} attemptId={attempt.id} />
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-grey-300 p-6 text-center text-[12.5px] text-grey-400">
                  Select a question to see it here.
                </div>
              )}

              {/* 오른쪽: 해설 + 제출 시점 필기(읽기 전용) — 스크롤 없이 닿도록 sticky */}
              {selected && (
                <div className="lg:h-full lg:overflow-y-auto" data-testid="mock-exam-explanation-panel">
                  {/* 풀이 필기는 해설 위에 — 스크롤하지 않아도 보이게. 필기가 없는 문항은 아무것도 그리지 않는다. */}
                  <ItemNote item={selected} attemptId={attempt.id} studentId={attempt.studentId} viewerIsOwner={!readOnly} />
                  <div className="mt-3">
                    <ExplanationPanel key={selected.setItemId} item={selected} />
                  </div>
                  <ItemTools
                    noteFirst
                    item={selected}
                    attemptId={attempt.id}
                    studentId={attempt.studentId}
                    viewerIsOwner={!readOnly}
                    reportRole={reportRole}
                    reportStatus={myReports[selected.problemId] ?? null}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {info && <InfoDialog title={info.title} body={info.body} onClose={closeInfo} />}
    </div>
  );
}
