"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getDifficultyReviewDetailAction,
  listDifficultyReviewAction,
  reviewDifficultyAction,
  type DifficultyLevel,
  type DifficultyReviewDetail,
  type DifficultyReviewList,
  type DifficultyReviewRow,
  type DifficultyReviewState,
  type JudgeRecord,
} from "../difficulty-review-actions";
import { SAT_DOMAINS, domainShort, skillLabel, skillsForDomain } from "@/lib/problem-taxonomy";
import { fmtDate } from "@/lib/format-datetime";

// 관리자 모의고사 › 난이도 점검(2026-10-01). hard 는 AI 판정(잠정)이라 관리자가 점검·확인·변경한다.
// 변경은 앞으로의 조립·풀 집계에만 반영되고 이미 조립된 세트·응시는 바뀌지 않는다(칸 규칙에 어긋나면 '세트 교체 필요' 표시만).

const PAGE_SIZE = 20;
const STATE_LABEL: Record<DifficultyReviewState, string> = { provisional: "잠정", confirmed: "확인됨", changed: "변경됨" };
const STATE_CLASS: Record<DifficultyReviewState, string> = {
  provisional: "bg-amber-100 text-amber-800",
  confirmed: "bg-green-100 text-green-800",
  changed: "bg-grey-200 text-ink",
};
const DIFF_LABEL: Record<string, string> = { easy: "쉬움", medium: "보통", hard: "어려움" };
const VIA_LABEL: Record<string, string> = { manual: "직접 작성", ai_generated: "AI 생성", compiler: "계산형 생성" };
const MODULE_LABEL: Record<string, string> = { rw_m1: "R&W M1", rw_m2: "R&W M2", math_m1: "Math M1", math_m2: "Math M2" };
const FORMAT_LABEL: Record<string, string> = { mc: "객관식", spr: "숫자입력" };

type StatusFilter = "all" | DifficultyReviewState;

function judgeLine(j: JudgeRecord | null, title: string) {
  if (!j) return null;
  return (
    <div className="rounded-lg border border-grey-200 p-3" data-testid={`judge-${title}`}>
      <p className="text-[12px] font-bold text-ink">
        {title}
        {j.model && <span className="ml-1.5 font-normal text-grey-500">{j.model}{j.effort ? ` · effort ${j.effort}` : ""}</span>}
      </p>
      <p className="mt-1 text-[12px] text-grey-600">
        hard 적합 {j.fit === undefined ? "–" : j.fit ? "통과" : "불통과"} · 정답·해설 {j.correctOk === undefined ? "–" : j.correctOk ? "통과" : "불통과"} · 레시피 준수{" "}
        {j.complianceOk === undefined ? "–" : j.complianceOk ? "통과" : "불통과"}
      </p>
      {j.which && j.which.length > 0 && <p className="mt-1 text-[11.5px] text-grey-500">추가 요구 사고: {j.which.join(", ")}</p>}
      {j.note && <p className="mt-1 whitespace-pre-wrap text-[12px] text-ink">{j.note}</p>}
    </div>
  );
}

function DetailView({ d }: { d: DifficultyReviewDetail }) {
  const { judge } = d;
  const hasBasis = judge.hardJudge || judge.advisory || judge.recipeCheck;
  return (
    <div className="space-y-4 text-[12.5px]" data-testid="difficulty-detail">
      <div className="rounded-lg bg-grey-100 p-3">
        {d.passage && <p className="whitespace-pre-wrap text-ink">{d.passage}</p>}
        {d.question && <p className="mt-2 whitespace-pre-wrap font-semibold text-ink">{d.question}</p>}
        {d.hasFigure && <p className="mt-1 text-[11.5px] text-grey-500">(그림 포함 문항 — 그림은 문제은행에서 확인)</p>}
        {d.options && (
          <ol className="mt-2 space-y-0.5">
            {d.options.map((o, i) => (
              <li key={i} className={i === d.correctIndex ? "font-semibold text-green-800" : "text-ink"}>
                {String.fromCharCode(65 + i)}. {o}
                {i === d.correctIndex && " (정답)"}
              </li>
            ))}
          </ol>
        )}
        {d.answers && d.answers.length > 0 && <p className="mt-2 text-ink">정답: {d.answers.join(", ")}</p>}
        {d.explanation && <p className="mt-2 whitespace-pre-wrap text-grey-600">해설: {d.explanation}</p>}
      </div>

      <section data-testid="difficulty-basis">
        <h4 className="text-[12.5px] font-bold text-ink">AI 판정 근거</h4>
        {!hasBasis ? (
          <p className="mt-1 text-grey-500" data-testid="basis-empty">근거 기록 없음</p>
        ) : (
          <div className="mt-1.5 space-y-2">
            {judgeLine(judge.hardJudge, "hard 검수")}
            {!judge.hardJudge && judge.recipeCheck?.hardFit && (
              <div className="rounded-lg border border-grey-200 p-3" data-testid="judge-recipe-hardfit">
                <p className="text-[12px] font-bold text-ink">hard 적합 기록(레시피 검수)</p>
                <p className="mt-1 text-[12px] text-grey-600">hard 적합 {judge.recipeCheck.hardFit.ok ? "통과" : "불통과"}</p>
                {judge.recipeCheck.hardFit.which && judge.recipeCheck.hardFit.which.length > 0 && <p className="mt-1 text-[11.5px] text-grey-500">추가 요구 사고: {judge.recipeCheck.hardFit.which.join(", ")}</p>}
                {judge.recipeCheck.hardFit.note && <p className="mt-1 whitespace-pre-wrap text-[12px] text-ink">{judge.recipeCheck.hardFit.note}</p>}
              </div>
            )}
            {judge.recipeCheck?.compliance && (
              <p className="text-[12px] text-grey-600" data-testid="recipe-compliance">
                레시피 준수 {judge.recipeCheck.compliance.met ?? "–"}/{judge.recipeCheck.compliance.of}(최소 {judge.recipeCheck.compliance.minMet}) · {judge.recipeCheck.compliance.ok ? "통과" : "미달"}
                {judge.recipeId && <span className="text-grey-400"> · {judge.recipeId}</span>}
              </p>
            )}
            {judge.advisory && (
              <div>
                <p className="mb-1 text-[11.5px] text-grey-500">다른 모델 의견(참고용 — 확정 근거가 아님)</p>
                {judgeLine(judge.advisory, "참고 의견")}
              </div>
            )}
          </div>
        )}
        {judge.generatedBy && <p className="mt-1 text-[11.5px] text-grey-400">생성 모델 {judge.generatedBy}</p>}
      </section>

      <section data-testid="difficulty-stats">
        <h4 className="text-[12.5px] font-bold text-ink">실제 학생 응답</h4>
        {d.stats.responses === 0 ? (
          <p className="mt-1 text-grey-500">아직 응답이 없습니다(출시 후 정답률로 재보정).</p>
        ) : (
          <p className="mt-1 text-ink">
            응답 {d.stats.responses}건 · 정답률 {d.stats.correctPct === null ? "–" : `${d.stats.correctPct}%`}
          </p>
        )}
      </section>

      {d.sets.length > 0 && (
        <section data-testid="difficulty-sets">
          <h4 className="text-[12.5px] font-bold text-ink">조립된 세트</h4>
          <ul className="mt-1 space-y-1">
            {d.sets.map((s) => (
              <li key={`${s.setId}${s.moduleKey}`} className={s.violates ? "text-red" : "text-grey-600"}>
                {s.name} ({s.status === "published" ? "공개" : "초안"}) · {s.moduleKey ? MODULE_LABEL[s.moduleKey] ?? s.moduleKey : "고정형"}
                {s.route ? ` ${s.route === "higher" ? "higher" : "lower"}` : ""} · 배정 당시 {DIFF_LABEL[s.snapshotDifficulty] ?? s.snapshotDifficulty} → 현재 {DIFF_LABEL[s.liveDifficulty] ?? s.liveDifficulty}
                {s.violates && <b> · 세트 교체 필요</b>}
                {s.startedAttempts > 0 && <span> · 응시 {s.startedAttempts}건(진행 중 포함, 영향 없음)</span>}
              </li>
            ))}
          </ul>
          <p className="mt-1 text-[11.5px] text-grey-500">이미 조립된 세트와 응시는 자동으로 바뀌지 않습니다. 교체가 필요하면 세트 검토에서 문항을 바꾸세요.</p>
        </section>
      )}

      <section data-testid="difficulty-history">
        <h4 className="text-[12.5px] font-bold text-ink">변경 이력</h4>
        {d.history.length === 0 ? (
          <p className="mt-1 text-grey-500">기록 없음</p>
        ) : (
          <ul className="mt-1 space-y-1">
            {d.history.map((h) => (
              <li key={h.id} className="text-grey-600">
                {fmtDate(h.at)} · {h.by ?? "관리자"} · {h.action === "confirm" ? `${DIFF_LABEL[h.to]} 확인` : `${DIFF_LABEL[h.from]} → ${DIFF_LABEL[h.to]}`}
                {h.reason && <span className="text-ink"> — {h.reason}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default function DifficultyReviewPanel() {
  const [status, setStatus] = useState<StatusFilter>("provisional");
  const [domain, setDomain] = useState("");
  const [skill, setSkill] = useState("");
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [data, setData] = useState<DifficultyReviewList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ id: string; d?: DifficultyReviewDetail; error?: string } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setQ(qInput.trim());
      setPage(0);
    }, 300);
    return () => clearTimeout(t);
  }, [qInput]);

  const key = JSON.stringify([status, domain, skill, q, page, reloadTick]);
  const loading = loadedKey !== key;
  const reload = useCallback(() => setReloadTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    listDifficultyReviewAction({ status, satDomain: domain || undefined, skillCode: skill || undefined, q: q || undefined, page, pageSize: PAGE_SIZE }).then((r) => {
      if (cancelled) return; // 더 최신 요청이 있다
      if (r.ok) {
        setData(r.data);
        setError(null);
      } else {
        setError(r.error);
      }
      setLoadedKey(key);
    });
    return () => {
      cancelled = true;
    };
  }, [key, status, domain, skill, q, page]);

  const loadDetail = useCallback(async (id: string) => {
    setDetail({ id });
    const r = await getDifficultyReviewDetailAction(id);
    setDetail(r.ok ? { id, d: r.data } : { id, error: r.error });
  }, []);

  function toggleOpen(id: string) {
    if (openId === id) {
      setOpenId(null);
      return;
    }
    setOpenId(id);
    void loadDetail(id);
  }

  async function apply(ids: string[], to: DifficultyLevel, rows: DifficultyReviewRow[]) {
    const needsReason = rows.some((r) => r.difficulty !== to);
    if (needsReason && !reason.trim()) {
      setNotice({ kind: "err", text: "난이도를 바꿀 때는 사유 메모를 적어 주세요." });
      return;
    }
    setBusy(true);
    setNotice(null);
    const r = await reviewDifficultyAction({ problemIds: ids, to, reason: reason.trim() || undefined });
    setBusy(false);
    if (!r.ok) {
      setNotice({ kind: "err", text: r.error });
      return;
    }
    const parts = [`확인 ${r.confirmed}건`, `변경 ${r.changed}건`];
    if (r.skipped) parts.push(`이미 처리됨 ${r.skipped}건`);
    let text = parts.join(" · ");
    if (r.needsSetReplacement.length > 0) text += ` · 세트 교체 필요 ${r.needsSetReplacement.length}건(조립된 세트는 바뀌지 않았습니다)`;
    setNotice({ kind: "ok", text });
    setSelected(new Set());
    setReason("");
    if (openId) void loadDetail(openId);
    reload();
  }

  const rows = data?.rows ?? [];
  const selectedRows = rows.filter((r) => selected.has(r.problemId));
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const skills = domain ? skillsForDomain(domain) : [];

  function renderActions(target: DifficultyReviewRow[], ids: string[]) {
    const allConfirmedHard = target.every((r) => r.difficulty === "hard" && r.state === "confirmed");
    const allMedium = target.every((r) => r.difficulty === "medium");
    const allEasy = target.every((r) => r.difficulty === "easy");
    const base = "rounded px-3 py-1.5 text-xs font-bold disabled:opacity-40";
    return (
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy || allConfirmedHard} onClick={() => apply(ids, "hard", target)} className={`${base} bg-ink text-white`}>
          {target.every((r) => r.difficulty === "hard") ? "난이도 확인(hard 유지)" : "hard로 변경"}
        </button>
        <button type="button" disabled={busy || allMedium} onClick={() => apply(ids, "medium", target)} className={`${base} border border-grey-300 bg-white text-ink`}>
          medium으로 변경
        </button>
        <button type="button" disabled={busy || allEasy} onClick={() => apply(ids, "easy", target)} className={`${base} border border-grey-300 bg-white text-ink`}>
          easy로 변경
        </button>
      </div>
    );
  }

  const cards: { key: DifficultyReviewState; n: number | undefined }[] = [
    { key: "provisional", n: data?.summary.provisional },
    { key: "confirmed", n: data?.summary.confirmed },
    { key: "changed", n: data?.summary.changed },
  ];

  return (
    <section className="rounded-xl border border-grey-200 bg-white p-5" data-testid="difficulty-review">
      <h2 className="text-sm font-semibold text-ink">hard 난이도 점검</h2>
      <p className="mt-1 text-xs text-grey-500">
        AI 생성 hard 는 공식 난이도와 교정되지 않은 잠정 판정입니다. 점검해 확인하거나 바꾸세요. 바뀐 난이도는 이후 조립·풀 집계에 반영되고, 이미 조립된 세트와 진행 중 응시는 바뀌지 않습니다.
        출시 후에는 실제 정답률로 다시 보정합니다.
      </p>

      <div className="mt-3 grid grid-cols-3 gap-2" data-testid="difficulty-summary">
        {cards.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => {
              setStatus(c.key);
              setPage(0);
            }}
            aria-pressed={status === c.key}
            className={"rounded-lg border px-3 py-2 text-left " + (status === c.key ? "border-ink bg-grey-100" : "border-grey-200 bg-white")}
          >
            <span className="block text-[11.5px] text-grey-500">{STATE_LABEL[c.key]}</span>
            <span className="block text-lg font-bold tabular-nums text-ink" data-testid={`summary-${c.key}`}>{c.n ?? "–"}</span>
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-2">
        <label className="text-[11.5px] text-grey-500">
          상태
          <select
            className="mt-0.5 block rounded border border-grey-200 px-2 py-1.5 text-sm text-ink"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as StatusFilter);
              setPage(0);
            }}
          >
            <option value="all">전체</option>
            <option value="provisional">잠정</option>
            <option value="confirmed">확인됨</option>
            <option value="changed">변경됨</option>
          </select>
        </label>
        <label className="text-[11.5px] text-grey-500">
          영역
          <select
            className="mt-0.5 block rounded border border-grey-200 px-2 py-1.5 text-sm text-ink"
            value={domain}
            onChange={(e) => {
              setDomain(e.target.value);
              setSkill("");
              setPage(0);
            }}
          >
            <option value="">전체</option>
            {SAT_DOMAINS.map((d) => (
              <option key={d.code} value={d.code}>{d.short}</option>
            ))}
          </select>
        </label>
        <label className="text-[11.5px] text-grey-500">
          세부 기술
          <select
            className="mt-0.5 block rounded border border-grey-200 px-2 py-1.5 text-sm text-ink disabled:opacity-50"
            value={skill}
            disabled={!domain}
            onChange={(e) => {
              setSkill(e.target.value);
              setPage(0);
            }}
          >
            <option value="">{domain ? "전체" : "영역을 먼저 고르세요"}</option>
            {skills.map((s) => (
              <option key={s.code} value={s.code}>{s.label}</option>
            ))}
          </select>
        </label>
        <label className="min-w-[160px] flex-1 text-[11.5px] text-grey-500">
          검색
          <input
            type="search"
            className="mt-0.5 block w-full rounded border border-grey-200 px-2 py-1.5 text-sm text-ink"
            placeholder="본문 일부 또는 문항 ID 앞자리"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
          />
        </label>
      </div>

      {notice && (
        <p role={notice.kind === "err" ? "alert" : "status"} className={"mt-3 text-[12.5px] " + (notice.kind === "err" ? "text-red" : "text-green-800")} data-testid="difficulty-notice">
          {notice.text}
        </p>
      )}

      {selectedRows.length > 0 && (
        <div className="mt-3 space-y-2 rounded-lg border border-grey-300 bg-grey-100 p-3" data-testid="difficulty-bulk">
          <p className="text-[12.5px] font-semibold text-ink">{selectedRows.length}개 선택됨</p>
          <input
            className="w-full rounded border border-grey-200 bg-white px-2 py-1.5 text-sm text-ink"
            placeholder="사유 메모(난이도를 바꿀 때 필수)"
            aria-label="일괄 사유 메모"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          {renderActions(selectedRows, selectedRows.map((r) => r.problemId))}
        </div>
      )}

      {error && (
        <div className="mt-4 text-sm text-red" role="alert" data-testid="difficulty-error">
          {error}{" "}
          <button type="button" className="font-semibold underline" onClick={reload}>
            다시 시도
          </button>
        </div>
      )}

      {loading && !data && (
        <div className="mt-4 space-y-2" data-testid="difficulty-loading" aria-busy="true" aria-label="불러오는 중">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-grey-100" />
          ))}
        </div>
      )}

      {data && rows.length === 0 && !error && (
        <p className="mt-4 text-sm text-grey-400" data-testid="difficulty-empty">
          {status === "provisional" && !domain && !skill && !q ? "점검할 잠정 hard 문항이 없습니다." : "조건에 맞는 문항이 없습니다."}
        </p>
      )}

      {rows.length > 0 && (
        <div className={"mt-4 " + (loading ? "opacity-60" : "")} data-testid="difficulty-list">
          <label className="mb-1 flex items-center gap-2 text-[12px] text-grey-500">
            <input
              type="checkbox"
              aria-label="이 페이지 전체 선택"
              checked={rows.every((r) => selected.has(r.problemId))}
              onChange={(e) => setSelected(e.target.checked ? new Set(rows.map((r) => r.problemId)) : new Set())}
            />
            이 페이지 전체 선택
          </label>
          <ul className="divide-y divide-grey-100 rounded-lg border border-grey-200">
            {rows.map((r) => {
              const open = openId === r.problemId;
              return (
                <li key={r.problemId} data-testid="difficulty-row" className="p-3">
                  <div className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      className="mt-1"
                      aria-label={`선택: ${r.snippet.slice(0, 30)}`}
                      checked={selected.has(r.problemId)}
                      onChange={(e) =>
                        setSelected((prev) => {
                          const n = new Set(prev);
                          if (e.target.checked) n.add(r.problemId);
                          else n.delete(r.problemId);
                          return n;
                        })
                      }
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5 text-[11.5px]">
                        <span className={`rounded px-1.5 py-0.5 font-bold ${STATE_CLASS[r.state]}`}>{STATE_LABEL[r.state]}</span>
                        <span className="font-semibold text-ink">{DIFF_LABEL[r.difficulty]}</span>
                        <span className="text-grey-500">
                          {domainShort(r.satDomain) ?? "영역 미지정"} · {r.skillCode ? skillLabel(r.skillCode) : "기술 미지정"} · {FORMAT_LABEL[r.format] ?? r.format} · {VIA_LABEL[r.createdVia] ?? r.createdVia}
                        </span>
                        {r.setsNeedReplacement > 0 && <span className="rounded bg-red px-1.5 py-0.5 font-bold text-white">세트 교체 필요 {r.setsNeedReplacement}</span>}
                      </div>
                      <p className="mt-1 truncate text-[12.5px] text-ink">{r.snippet || "(본문 없음)"}</p>
                      <p className="mt-0.5 text-[11.5px] text-grey-500">
                        {r.responses > 0 ? `응답 ${r.responses}건 · 정답률 ${r.correctPct === null ? "–" : `${r.correctPct}%`}` : "응답 없음"}
                        {r.publishedAt && ` · 공개 ${fmtDate(r.publishedAt)}`}
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-expanded={open}
                      onClick={() => toggleOpen(r.problemId)}
                      className="shrink-0 rounded border border-grey-300 px-2.5 py-1 text-xs font-semibold text-ink"
                    >
                      {open ? "닫기" : "상세"}
                    </button>
                  </div>
                  {open && (
                    <div className="mt-3 space-y-3 border-t border-grey-100 pt-3">
                      {!detail || detail.id !== r.problemId ? null : detail.error ? (
                        <p className="text-sm text-red" role="alert">{detail.error}</p>
                      ) : !detail.d ? (
                        <p className="text-sm text-grey-500">불러오는 중...</p>
                      ) : (
                        <DetailView d={detail.d} />
                      )}
                      <div className="space-y-2 rounded-lg bg-grey-100 p-3">
                        <input
                          className="w-full rounded border border-grey-200 bg-white px-2 py-1.5 text-sm text-ink"
                          placeholder="사유 메모(난이도를 바꿀 때 필수)"
                          aria-label="사유 메모"
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                        />
                        {renderActions([r], [r.problemId])}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {data && data.total > PAGE_SIZE && (
        <div className="mt-3 flex items-center justify-between text-[12px] text-grey-500" data-testid="difficulty-pager">
          <span>
            총 {data.total}건 · {page + 1}/{totalPages} 쪽
          </span>
          <span className="flex gap-2">
            <button type="button" disabled={page === 0 || loading} onClick={() => setPage((p) => Math.max(0, p - 1))} className="rounded border border-grey-300 px-2.5 py-1 font-semibold text-ink disabled:opacity-40">
              이전
            </button>
            <button type="button" disabled={page + 1 >= totalPages || loading} onClick={() => setPage((p) => p + 1)} className="rounded border border-grey-300 px-2.5 py-1 font-semibold text-ink disabled:opacity-40">
              다음
            </button>
          </span>
        </div>
      )}
    </section>
  );
}
