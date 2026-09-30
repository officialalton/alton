"use client";

import { useCallback, useEffect, useState } from "react";
import {
  applyProblemErrorVerdictAction,
  getReportedProblemDetailAction,
  listReportedProblemsAction,
  type ApplyVerdictResult,
  type ReportedProblemDetail,
  type ReportedProblemGroup,
  type ReportFilter,
} from "./problem-error-report-actions";
import { REPORT_TYPE_LABEL, SOURCE_LABEL, VERDICT_EFFECT, VERDICT_LABEL, type ReportType, type Verdict } from "@/lib/problem-error-reports/labels";
import LearningText from "@/app/session/[id]/LearningText";
import { fmtDateTime } from "@/lib/format-datetime";

const PAGE = 50;
const ERROR_VERDICTS: Verdict[] = ["key_wrong_confirmed", "flawed_confirmed", "explanation_confirmed"];
const BRANCH_EFFECT = {
  error: "문항 보관 · 이미 나간 응시·과제 전원 정답 처리(해설 오류는 채점 변경 없음) · 여분 문항 자동 교체 시도",
  normal: "문항 복귀(오류 확정으로 보관됐다면) · 대체 문항 필요 기록 닫기 · 이전 조정 원복 · 검토 필요 표시 해제",
} as const;
const DAYS_LABEL: Record<string, string> = { "30": "최근 30일", "7": "최근 7일" };
const DIFF_LABEL: Record<string, string> = { easy: "쉬움", medium: "보통", hard: "어려움", unknown: "미지정" };
const MODULE_LABEL: Record<string, string> = { rw_m1: "R&W M1", rw_m2: "R&W M2", math_m1: "Math M1", math_m2: "Math M2" };
const OPEN_REASON: Record<string, string> = { no_spare: "여분 문항 없음", set_started: "응시 시작된 세트(변경 불가)" };

function fmt(iso: string): string {
  // 시간대는 lib/format-datetime 의 표시 기본값을 따른다(암묵적 로컬 시간대 금지).
  return fmtDateTime(iso, { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function resultText(r: ApplyVerdictResult): string {
  if (r.alreadyApplied) return "이미 같은 판정이 적용돼 있습니다. 남은 신고만 닫았습니다.";
  const parts: string[] = [VERDICT_LABEL[r.decision]];
  if (r.archived) parts.push("문항 보관");
  if (r.restored) parts.push("문항 복귀");
  if ((r.replacementNeedsCancelled ?? 0) > 0) parts.push(`대체 문항 필요 기록 ${r.replacementNeedsCancelled}건 닫음`);
  if (r.decision === "not_error" && (r.replacedSetsKept ?? 0) > 0) parts.push(`이미 교체된 세트 ${r.replacedSetsKept}개는 그대로입니다`);
  if ((r.mockAdjustedAnswers ?? 0) > 0) parts.push(`모의고사 ${r.mockAdjustedAnswers}문항 조정 채점`);
  if ((r.sessionWorksAdjusted ?? 0) > 0) parts.push(`과제 ${r.sessionWorksAdjusted}건 조정`);
  if ((r.homeworkItemsAdjusted ?? 0) > 0) parts.push(`과제 묶음 ${r.homeworkItemsAdjusted}문항 조정`);
  if ((r.autoReplaced ?? 0) > 0) parts.push(`여분 문항으로 ${r.autoReplaced}칸 자동 교체`);
  if ((r.replacementNeedsOpen ?? 0) > 0) parts.push(`대체 문항 필요 ${r.replacementNeedsOpen}건 남음`);
  return parts.join(" · ");
}

/** 오류 신고 > 신고 내역 — 신고된 문항 목록(열린 신고 우선) · 상세 · 판정. 모든 쓰기는 관리자 RPC 하나(problem_error_apply_verdict).
 *  filter: 통계 화면에서 넘어온 조건(skill·난이도·영역·기간). 칩으로 보이고 해제할 수 있다. */
export default function ReportedProblemsPanel({ filter, onClearFilter }: { filter?: ReportFilter; onClearFilter?: () => void } = {}) {
  const fSkill = filter?.skill ?? null;
  const fDiff = filter?.difficulty ?? null;
  const fDomain = filter?.domain ?? null;
  const fDays = filter?.days ?? null;
  const [status, setStatus] = useState<"open" | "all">("open");
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<{ total: number; rows: ReportedProblemGroup[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<{ problemId: string; versionId: string } | null>(null);

  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => {
    let cancelled = false;
    listReportedProblemsAction({ status, offset, limit: PAGE, skill: fSkill, difficulty: fDiff, domain: fDomain, days: fDays })
      .then((r) => {
        if (!cancelled) {
          setData(r);
          setError(null);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "신고 목록을 불러오지 못했습니다.");
      });
    return () => {
      cancelled = true;
    };
  }, [status, offset, reloadKey, fSkill, fDiff, fDomain, fDays]);

  if (selected) {
    return (
      <ReportDetail
        key={`${selected.problemId}:${selected.versionId}`}
        problemId={selected.problemId}
        versionId={selected.versionId}
        onBack={() => {
          setSelected(null);
          setData(null);
          setReloadKey((k) => k + 1);
        }}
      />
    );
  }

  return (
    <div data-testid="reported-problems-panel">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div role="tablist" aria-label="신고 상태" className="flex gap-1">
          {(["open", "all"] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={status === k}
              onClick={() => {
                setStatus(k);
                setOffset(0);
                setData(null);
              }}
              className={`rounded-full border px-3 py-1 text-[12px] font-bold ${status === k ? "border-ink bg-ink text-white" : "border-grey-300 text-grey-600"}`}
            >
              {k === "open" ? "검토 필요" : "전체"}
            </button>
          ))}
        </div>
        {data && <span className="text-[12px] text-grey-500">문항 {data.total}개</span>}
      </div>

      {(fSkill || fDiff || fDomain || fDays) && (
        <p data-testid="report-filter-chip" className="mb-3 flex flex-wrap items-center gap-1.5 text-[12px]">
          <span className="font-bold text-grey-500">필터</span>
          {[fDomain, fSkill, fDiff ? DIFF_LABEL[fDiff] ?? fDiff : null, fDays ? DAYS_LABEL[String(fDays)] ?? `최근 ${fDays}일` : null].filter(Boolean).map((t) => (
            <span key={t} className="rounded-full border border-grey-200 bg-grey-50 px-2 py-0.5 font-semibold text-grey-700">{t}</span>
          ))}
          {onClearFilter && (
            <button type="button" onClick={() => { setData(null); setOffset(0); onClearFilter(); }} className="font-bold text-grey-500 underline">
              해제
            </button>
          )}
        </p>
      )}

      {error ? (
        <p role="alert" className="text-[13px] text-red">
          {error}
        </p>
      ) : data === null ? (
        <p className="text-[13px] text-grey-500">불러오는 중…</p>
      ) : data.rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-grey-300 p-6 text-center text-[13px] text-grey-500">
          {status === "open" ? "검토할 신고가 없습니다." : "신고된 문항이 없습니다."}
        </p>
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {data.rows.map((g) => (
              <li key={`${g.problemId}:${g.versionId}`}>
                <button
                  type="button"
                  onClick={() => setSelected({ problemId: g.problemId, versionId: g.versionId })}
                  className="w-full rounded-lg border border-grey-200 bg-white p-3 text-left hover:bg-grey-50"
                  data-testid="reported-problem-row"
                >
                  <div className="mb-1 flex flex-wrap items-center gap-1.5 text-[11px] font-bold">
                    <span className="rounded-full bg-red-bg px-2 py-0.5 text-red">신고 {g.reportCount}건{g.openCount > 0 && g.openCount !== g.reportCount ? ` (열림 ${g.openCount})` : ""}</span>
                    {(Object.keys(g.typeCounts) as ReportType[]).filter((t) => g.typeCounts[t] > 0).map((t) => (
                      <span key={t} className="rounded-full border border-grey-200 px-2 py-0.5 text-grey-600">
                        {REPORT_TYPE_LABEL[t]} {g.typeCounts[t]}
                      </span>
                    ))}
                    {g.sourceCounts.mock_exam > 0 && <span className="rounded-full border border-grey-200 px-2 py-0.5 text-grey-600">모의고사 {g.sourceCounts.mock_exam}</span>}
                    {g.sourceCounts.session_assignment > 0 && <span className="rounded-full border border-grey-200 px-2 py-0.5 text-grey-600">수업·과제 {g.sourceCounts.session_assignment}</span>}
                    {(g.sourceCounts.homework_batch ?? 0) > 0 && <span className="rounded-full border border-grey-200 px-2 py-0.5 text-grey-600">과제 묶음 {g.sourceCounts.homework_batch}</span>}
                    {g.archived && <span className="rounded-full bg-grey-100 px-2 py-0.5 text-grey-500">보관됨</span>}
                    {g.latestDecision && <span className="rounded-full bg-grey-100 px-2 py-0.5 text-grey-600">{VERDICT_LABEL[g.latestDecision]}</span>}
                  </div>
                  <p className="line-clamp-2 text-[13px] text-ink">{g.snippet || "(본문 없음)"}</p>
                  <p className="mt-1 text-[11px] text-grey-400">
                    {g.satDomain ?? "영역 없음"}
                    {g.skillCode ? ` · ${g.skillCode}` : ""} · 최근 신고 {fmt(g.lastAt)}
                  </p>
                </button>
              </li>
            ))}
          </ul>
          {data.total > PAGE && (
            <div className="mt-3 flex items-center justify-between text-[12px]">
              <button type="button" disabled={offset === 0} onClick={() => { setData(null); setOffset(Math.max(0, offset - PAGE)); }} className="rounded border border-grey-300 px-3 py-1 font-bold disabled:opacity-40">
                이전
              </button>
              <span className="text-grey-500">
                {offset + 1}–{Math.min(offset + PAGE, data.total)} / {data.total}
              </span>
              <button type="button" disabled={offset + PAGE >= data.total} onClick={() => { setData(null); setOffset(offset + PAGE); }} className="rounded border border-grey-300 px-3 py-1 font-bold disabled:opacity-40">
                다음
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ReportDetail({ problemId, versionId, onBack }: { problemId: string; versionId: string; onBack: () => void }) {
  const [d, setD] = useState<ReportedProblemDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [branch, setBranch] = useState<"error" | "normal" | null>(null);
  const [errType, setErrType] = useState<Verdict | null>(null);
  const decision: Verdict | null = branch === "normal" ? "not_error" : branch === "error" ? errType : null;
  const [note, setNote] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const load = useCallback(() => {
    getReportedProblemDetailAction(problemId, versionId)
      .then(setD)
      .catch((e) => setError(e instanceof Error ? e.message : "상세를 불러오지 못했습니다."));
  }, [problemId, versionId]);
  useEffect(load, [load]);

  async function apply() {
    if (!decision) return;
    setBusy(true);
    setError(null);
    const r = await applyProblemErrorVerdictAction({ problemId, versionId, decision, note: note.trim() || null });
    setBusy(false);
    setConfirming(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setResult(resultText(r.value));
    setBranch(null);
    setErrType(null);
    setNote("");
    load();
  }

  if (error && !d) return <p role="alert" className="text-[13px] text-red">{error}</p>;
  if (!d) return <p className="text-[13px] text-grey-500">불러오는 중…</p>;
  const v = d.version;
  const openReports = d.reports.filter((r) => !r.resolved).length;

  return (
    <div data-testid="reported-problem-detail" className="flex flex-col gap-4">
      <button type="button" onClick={onBack} className="self-start rounded-lg border-[1.5px] border-grey-200 px-3 py-1.5 text-[13px] font-semibold text-grey-600 hover:bg-grey-100">
        ← 신고 목록
      </button>

      <section className="rounded-lg border border-grey-200 bg-white p-4">
        <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[11px] font-bold text-grey-500">
          <span>{d.problem.satDomain ?? "영역 없음"}{d.problem.skillCode ? ` · ${d.problem.skillCode}` : ""}</span>
          <span>· {d.problem.format}</span>
          <span>· v{v.versionNo}</span>
          {v.difficulty && <span>· {v.difficulty}</span>}
          {d.problem.archived && <span className="rounded-full bg-grey-100 px-2 py-0.5">보관됨</span>}
        </div>
        {v.passage && <LearningText text={v.passage} className="mb-2 text-[13px]" />}
        {v.question && <LearningText text={v.question} className="mb-2 text-[13.5px] font-semibold" />}
        {v.options && v.options.length > 0 && (
          <ol className="mb-2 flex flex-col gap-1 text-[13px]">
            {v.options.map((o, i) => (
              <li key={i} className={`rounded border px-2 py-1 ${v.correctIndex === i ? "border-green bg-green/10" : "border-grey-200"}`}>
                {String.fromCharCode(65 + i)}. <LearningText text={o} />
                {v.correctIndex === i && <span className="ml-2 text-[11px] font-bold text-green">현재 정답</span>}
              </li>
            ))}
          </ol>
        )}
        {v.answers && v.answers.length > 0 && <p className="text-[13px]"><span className="font-bold text-grey-500">현재 정답: </span>{v.answers.join(" 또는 ")}</p>}
        {v.explanation && (
          <div className="mt-2 rounded-lg bg-grey-50 p-3 text-[12.5px]">
            <p className="mb-1 text-[11px] font-extrabold text-grey-400">해설</p>
            <LearningText text={v.explanation} />
          </div>
        )}
      </section>

      <section className="rounded-lg border border-grey-200 bg-white p-4">
        <h3 className="mb-2 text-[13px] font-bold">신고 {d.reportTotal}건 {openReports > 0 ? `(열림 ${openReports})` : "(모두 처리됨)"}</h3>
        <ul className="flex flex-col gap-1.5">
          {d.reports.map((r) => (
            <li key={r.id} className="rounded-lg border border-grey-100 px-3 py-2 text-[12.5px]">
              <span className="font-bold">{REPORT_TYPE_LABEL[r.reportType]}</span>
              <span className="text-grey-500"> · {SOURCE_LABEL[r.source] ?? r.source}{r.sessionSource === "homework" ? "(과제)" : ""} · {r.reporterRole === "teacher" ? "선생님" : "학생"} {r.reporterName ?? ""} · {fmt(r.createdAt)}</span>
              {r.resolved && <span className="ml-1 text-[11px] font-bold text-grey-400">처리됨</span>}
              {r.memo && <p className="mt-0.5 whitespace-pre-wrap text-grey-700">{r.memo}</p>}
            </li>
          ))}
        </ul>
        {d.reportTotal > d.reports.length && <p className="mt-1 text-[11.5px] text-grey-400">최근 {d.reports.length}건만 표시합니다.</p>}
      </section>

      <section className="rounded-lg border border-grey-200 bg-white p-4" data-testid="reported-affected">
        <h3 className="mb-2 text-[13px] font-bold">영향받은 응시·과제</h3>
        <dl className="grid grid-cols-2 gap-2 text-[12.5px] sm:grid-cols-3">
          <div><dt className="text-grey-500">채점 완료 모의고사 응시</dt><dd className="font-bold">{d.affected.mockAttemptsGraded}</dd></div>
          <div><dt className="text-grey-500">진행·배정 중 응시</dt><dd className="font-bold">{d.affected.mockAttemptsOpen}</dd></div>
          <div><dt className="text-grey-500">제출된 과제·수업 풀이</dt><dd className="font-bold">{d.affected.sessionWorks}</dd></div>
          <div><dt className="text-grey-500">조정 채점된 모의고사 문항</dt><dd className="font-bold">{d.affected.mockAdjusted}</dd></div>
          <div><dt className="text-grey-500">조정된 과제 풀이</dt><dd className="font-bold">{d.affected.sessionAdjusted}</dd></div>
          <div><dt className="text-grey-500">선생님 확인 필요(조정 대상)</dt><dd className="font-bold">{d.affected.sessionPending}</dd></div>
          {d.affected.homework && (
            <>
              <div><dt className="text-grey-500">제출된 과제 묶음 문항</dt><dd className="font-bold" data-testid="affected-homework-items">{d.affected.homework.items}</dd></div>
              <div><dt className="text-grey-500">조정된 과제 묶음 문항</dt><dd className="font-bold">{d.affected.homework.adjusted}</dd></div>
              <div><dt className="text-grey-500">과제 묶음 조정 대상(선생님 확인 필요)</dt><dd className="font-bold">{d.affected.homework.pending}</dd></div>
            </>
          )}
        </dl>
      </section>

      <section className="rounded-lg border border-grey-200 bg-white p-4">
        <h3 className="mb-2 text-[13px] font-bold">판정</h3>
        {result && <p role="status" data-testid="verdict-result" className="mb-2 rounded-lg bg-green/10 px-3 py-2 text-[12.5px] font-semibold text-green">{result}</p>}
        {error && <p role="alert" className="mb-2 text-[12.5px] font-semibold text-red">{error}</p>}
        <fieldset disabled={busy}>
          <legend className="mb-1 text-[11.5px] font-bold text-grey-500">1단계 · 이 문항은</legend>
          <div className="flex flex-col gap-1.5 sm:flex-row">
            {([
              { k: "error", label: "오류 → 보관" },
              { k: "normal", label: "정상 → 복귀" },
            ] as const).map((o) => (
              <label key={o.k} className={`flex flex-1 cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 ${branch === o.k ? "border-ink bg-grey-50" : "border-grey-200"}`}>
                <input type="radio" name="verdict-branch" value={o.k} checked={branch === o.k} onChange={() => { setBranch(o.k); setConfirming(false); }} className="mt-0.5" />
                <span>
                  <span className="block text-[13px] font-bold">{o.label}</span>
                  <span className="block text-[11.5px] text-grey-500">{BRANCH_EFFECT[o.k === "error" ? "error" : "normal"]}</span>
                </span>
              </label>
            ))}
          </div>
          {branch === "error" && (
            <div className="mt-3" data-testid="verdict-step2">
              <p className="mb-1 text-[11.5px] font-bold text-grey-500">2단계 · 오류 유형</p>
              <div className="flex flex-col gap-1.5">
                {ERROR_VERDICTS.map((k) => (
                  <label key={k} className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 ${errType === k ? "border-ink bg-grey-50" : "border-grey-200"}`}>
                    <input type="radio" name="verdict" value={k} checked={errType === k} onChange={() => { setErrType(k); setConfirming(false); }} className="mt-0.5" />
                    <span>
                      <span className="block text-[13px] font-bold">{VERDICT_LABEL[k]}</span>
                      <span className="block text-[11.5px] text-grey-500">{VERDICT_EFFECT[k]}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </fieldset>
        <label htmlFor="verdict-note" className="mt-2 block text-[12px] font-bold text-grey-500">메모(선택, 내부 기록)</label>
        <textarea id="verdict-note" value={note} onChange={(e) => setNote(e.target.value.slice(0, 2000))} rows={2} disabled={busy} className="mt-1 w-full rounded-lg border border-grey-200 p-2 text-[13px]" />
        <div className="mt-2 flex items-center justify-end gap-2">
          {confirming ? (
            <>
              <span className="text-[12px] font-semibold text-grey-600">되돌리기 어려운 처리입니다. 적용할까요?</span>
              <button type="button" onClick={() => setConfirming(false)} className="rounded-lg px-3 py-1.5 text-[12px] font-bold text-grey-500 hover:bg-grey-100">취소</button>
              <button type="button" onClick={() => void apply()} disabled={busy} className="rounded-lg bg-ink px-3 py-1.5 text-[12px] font-bold text-white disabled:opacity-40">{busy ? "적용 중…" : "적용"}</button>
            </>
          ) : (
            <button
              type="button"
              disabled={!decision || busy}
              onClick={() => (decision === "not_error" ? void apply() : setConfirming(true))}
              className="rounded-lg bg-ink px-3 py-1.5 text-[12px] font-bold text-white disabled:opacity-40"
            >
              판정 적용
            </button>
          )}
        </div>
      </section>

      {(d.replacements.length > 0 || d.replacementNeeds.length > 0) && (
        <section className="rounded-lg border border-grey-200 bg-white p-4" data-testid="reported-replacements">
          <h3 className="mb-2 text-[13px] font-bold">대체 문항</h3>
          <ul className="flex flex-col gap-1 text-[12.5px]">
            {d.replacements.map((r, i) => (
              <li key={i} className="text-green">
                문항 교체됨 → {r.examSetName ?? "세트"} {MODULE_LABEL[r.moduleKey ?? ""] ?? r.moduleKey ?? ""}{r.route ? ` (${r.route === "higher" ? "상" : "하"} 변형)` : ""} · {fmt(r.createdAt)}
              </li>
            ))}
            {d.replacementNeeds.filter((n) => n.status === "open").map((n) => (
              <li key={n.id} className="text-red">
                대체 문항 필요 · {n.inMockSet ? `${MODULE_LABEL[n.moduleKey ?? ""] ?? n.moduleKey ?? "세트"} ${n.difficulty ?? ""}` : "일반 문항"}{n.openReason ? ` — ${OPEN_REASON[n.openReason]}` : ""}
              </li>
            ))}
          </ul>
        </section>
      )}

      {d.verdicts.length > 0 && (
        <section className="rounded-lg border border-grey-200 bg-white p-4">
          <h3 className="mb-2 text-[13px] font-bold">판정 이력(수정·삭제 불가)</h3>
          <ul className="flex flex-col gap-1 text-[12.5px]">
            {d.verdicts.map((vd) => (
              <li key={vd.id}>
                <span className="font-bold">{VERDICT_LABEL[vd.decision]}</span>
                <span className="text-grey-500"> · {vd.decidedByName ?? "관리자"} · {fmt(vd.decidedAt)}</span>
                {vd.note && <p className="whitespace-pre-wrap text-grey-700">{vd.note}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
