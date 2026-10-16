"use client";

import { useEffect, useState } from "react";
import { getReportStatsAction, type ReportFilter, type ReportStats, type StatItem } from "./problem-error-report-actions";
import { REPORT_TYPE_LABEL, SOURCE_LABEL } from "@/lib/problem-error-reports/labels";
import { fmtDate } from "@/lib/format-datetime";

const PERIODS: { key: string; days: number | null; label: string }[] = [
  { key: "all", days: null, label: "전체" },
  { key: "30", days: 30, label: "최근 30일" },
  { key: "7", days: 7, label: "최근 7일" },
];
const DIFF_LABEL: Record<string, string> = { easy: "쉬움", medium: "보통", hard: "어려움", unknown: "미지정" };
const FORMAT_LABEL: Record<string, string> = { mc: "객관식", spr: "숫자입력" };
const VERDICT_STAT_LABEL: Record<string, string> = { confirmed: "오류 확정", not_error: "오류 아님", pending: "검토 중" };
const VIA_LABEL: Record<string, string> = { manual: "직접 작성", ai_generated: "AI 생성", compiler: "계산형 생성" };

const pct = (r: number | null) => (r === null ? "–" : `${(r * 100).toFixed(1)}%`);

function batchLabel(k: string): string {
  const [via, month] = k.split("|");
  return `${VIA_LABEL[via] ?? via} · ${month}`;
}

/** 막대 목록(CSS) — 신고 수 막대 + 신고 문항·신고율 텍스트. 색만으로 구분하지 않도록 숫자를 항상 함께 쓴다. */
function BarList({ title, note, items, label, testId }: { title: string; note?: string; items: StatItem[] | undefined; label: (k: string) => string; testId: string }) {
  const rows = items ?? [];
  const max = Math.max(1, ...rows.map((r) => r.reports));
  return (
    <section className="rounded-lg border border-grey-200 bg-white p-4" data-testid={testId}>
      <h3 className="text-[13px] font-bold text-ink">{title}</h3>
      {note && <p className="mb-2 text-[11px] text-grey-400">{note}</p>}
      {rows.length === 0 ? (
        <p className="mt-2 text-[12px] text-grey-400">데이터 없음</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-2">
          {rows.slice(0, 12).map((r) => (
            <li key={r.key} className="text-[12px]">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate font-semibold text-ink">{label(r.key)}</span>
                <span className="shrink-0 tabular-nums text-grey-600">
                  <b className="text-ink">{r.reports}</b>건
                  {r.active !== null && <span className="text-grey-400"> · 문항 {r.reportedProblems}/{r.active} · 신고율 {pct(r.rate)}</span>}
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-grey-100" role="presentation">
                <div className="h-full rounded-full bg-red" style={{ width: `${Math.max(2, (r.reports / max) * 100)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Skeleton() {
  return (
    <div data-testid="stats-skeleton" aria-busy="true" aria-label="통계를 불러오는 중" className="animate-pulse">
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-[72px] rounded-lg bg-grey-100" />)}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-[150px] rounded-lg bg-grey-100" />)}
      </div>
    </div>
  );
}

export default function ErrorReportStatsPanel({ onOpenCell }: { onOpenCell: (f: ReportFilter) => void }) {
  const [period, setPeriod] = useState(PERIODS[0]);
  const [stats, setStats] = useState<ReportStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getReportStatsAction(period.days)
      .then((r) => {
        if (!cancelled) {
          setStats(r);
          setError(null);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "통계를 불러오지 못했습니다.");
      });
    return () => {
      cancelled = true;
    };
  }, [period, reloadKey]);

  const t = stats?.totals;
  const weekMax = Math.max(1, ...(stats?.weekly ?? []).map((w) => w.reports));
  const resolved = t ? t.confirmed + t.notError : 0;

  return (
    <div data-testid="error-report-stats">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div role="tablist" aria-label="기간" className="flex gap-1">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              type="button"
              role="tab"
              aria-selected={period.key === p.key}
              onClick={() => {
                setStats(null);
                setError(null);
                setPeriod(p);
              }}
              className={`rounded-full border px-3 py-1 text-[12px] font-bold ${period.key === p.key ? "border-ink bg-ink text-white" : "border-grey-300 text-grey-600"}`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-grey-400">신고율 = 신고된 문항 수 ÷ 해당 칸의 활성(공개·미보관) 문항 수</p>
      </div>

      {error ? (
        <div role="alert" className="rounded-lg border border-red/30 bg-red-bg p-4 text-[13px] text-red">
          <p>{error}</p>
          <button type="button" onClick={() => { setError(null); setStats(null); setReloadKey((k) => k + 1); }} className="mt-2 rounded border border-red px-3 py-1 text-[12px] font-bold">
            다시 시도
          </button>
        </div>
      ) : stats === null ? (
        <Skeleton />
      ) : stats.totals.reports === 0 ? (
        <p data-testid="stats-empty" className="rounded-lg border border-dashed border-grey-300 p-8 text-center text-[13px] text-grey-500">
          {period.days ? `${period.label} 동안 접수된 신고가 없습니다.` : "아직 접수된 신고가 없습니다."}
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="stats-cards">
            {[
              { l: "신고 수", v: String(t!.reports), s: `검토 중 ${t!.openReports}건` },
              { l: "신고된 문항", v: String(t!.reportedProblems), s: `활성 문항 ${t!.activeProblems}개 중` },
              { l: "전체 신고율", v: pct(t!.activeProblems > 0 ? t!.reportedProblems / t!.activeProblems : null), s: "문항 기준" },
              { l: "오류 확정 비율", v: resolved > 0 ? pct(t!.confirmed / resolved) : "–", s: `확정 ${t!.confirmed} · 오류 아님 ${t!.notError}` },
            ].map((c) => (
              <div key={c.l} className="rounded-lg border border-grey-200 bg-white p-3">
                <p className="text-[11px] font-bold text-grey-500">{c.l}</p>
                <p className="text-[22px] font-extrabold tabular-nums text-ink">{c.v}</p>
                <p className="text-[11px] text-grey-400">{c.s}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <BarList testId="stat-type" title="신고 유형" items={stats.axes.reportType} label={(k) => REPORT_TYPE_LABEL[k as keyof typeof REPORT_TYPE_LABEL] ?? k} />
            <BarList testId="stat-verdict" title="판정 결과" items={stats.axes.verdict} label={(k) => VERDICT_STAT_LABEL[k] ?? k} />
            <BarList testId="stat-difficulty" title="난이도" items={stats.axes.difficulty} label={(k) => DIFF_LABEL[k] ?? k} />
            <BarList testId="stat-format" title="문제 유형 · 형식" items={stats.axes.format} label={(k) => FORMAT_LABEL[k] ?? k} />
            <BarList testId="stat-domain" title="문제 유형 · 영역" items={stats.axes.domain} label={(k) => (k === "unknown" ? "영역 없음" : k)} />
            <BarList testId="stat-skill" title="문제 유형 · skill" items={stats.axes.skill} label={(k) => (k === "unknown" ? "skill 없음" : k)} />
            <BarList testId="stat-source" title="출처" items={stats.axes.source} label={(k) => SOURCE_LABEL[k] ?? k} />
            <BarList
              testId="stat-batch"
              title="생성 경로 · 생성 월"
              note="문항에 생성 배치 ID가 저장되지 않아 생성 경로×생성 월로 대신 집계합니다."
              items={stats.axes.batch}
              label={batchLabel}
            />
          </div>

          <section className="rounded-lg border border-grey-200 bg-white p-4" data-testid="stat-weekly">
            <h3 className="mb-2 text-[13px] font-bold text-ink">주별 추이 (최근 12주)</h3>
            <div className="flex h-[110px] items-end gap-1.5" role="img" aria-label={`주별 신고 수: ${stats.weekly.map((w) => `${w.weekStart} ${w.reports}건`).join(", ")}`}>
              {stats.weekly.map((w) => (
                <div key={w.weekStart} className="flex flex-1 flex-col items-center justify-end gap-1" title={`${w.weekStart} 주 · ${w.reports}건`}>
                  <span className="text-[10px] tabular-nums text-grey-500">{w.reports || ""}</span>
                  <div className="w-full rounded-t bg-red" style={{ height: `${w.reports === 0 ? 2 : Math.max(4, (w.reports / weekMax) * 80)}px`, opacity: w.reports === 0 ? 0.25 : 1 }} />
                </div>
              ))}
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-grey-400">
              <span>{fmtDate(stats.weekly[0].weekStart)}</span>
              <span>{fmtDate(stats.weekly[stats.weekly.length - 1].weekStart)}</span>
            </div>
          </section>

          <section className="rounded-lg border border-grey-200 bg-white p-4" data-testid="stat-top-cells">
            <h3 className="mb-2 text-[13px] font-bold text-ink">상위 문제 칸 (skill × 난이도)</h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-left text-[12px]">
                <thead>
                  <tr className="border-b border-grey-200 text-[11px] text-grey-500">
                    <th scope="col" className="py-1.5 pr-2 font-bold">skill</th>
                    <th scope="col" className="py-1.5 pr-2 font-bold">난이도</th>
                    <th scope="col" className="py-1.5 pr-2 text-right font-bold">신고 수</th>
                    <th scope="col" className="py-1.5 pr-2 text-right font-bold">신고 문항</th>
                    <th scope="col" className="py-1.5 pr-2 text-right font-bold">활성 문항</th>
                    <th scope="col" className="py-1.5 text-right font-bold">신고율</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.topCells.map((c) => (
                    <tr key={`${c.skill}|${c.difficulty}`} className="border-b border-grey-100 last:border-0">
                      <td className="py-1.5 pr-2">
                        <button
                          type="button"
                          data-testid="stat-cell-row"
                          onClick={() => onOpenCell({ skill: c.skill, difficulty: c.difficulty, days: period.days })}
                          className="rounded font-semibold text-ink underline decoration-grey-300 underline-offset-2 hover:decoration-ink focus-visible:outline focus-visible:outline-2"
                          aria-label={`${c.skill === "unknown" ? "skill 없음" : c.skill} ${DIFF_LABEL[c.difficulty] ?? c.difficulty} 신고 내역 보기`}
                        >
                          {c.skill === "unknown" ? "skill 없음" : c.skill}
                        </button>
                      </td>
                      <td className="py-1.5 pr-2">{DIFF_LABEL[c.difficulty] ?? c.difficulty}</td>
                      <td className="py-1.5 pr-2 text-right tabular-nums font-bold">{c.reports}</td>
                      <td className="py-1.5 pr-2 text-right tabular-nums">{c.reportedProblems}</td>
                      <td className="py-1.5 pr-2 text-right tabular-nums">{c.active ?? "–"}</td>
                      <td className="py-1.5 text-right tabular-nums">{pct(c.rate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
