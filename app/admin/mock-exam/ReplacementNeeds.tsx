"use client";

import { useEffect, useState } from "react";
import {
  getReplacementNeedSummaryAction,
  retryReplacementAction,
  type ReplacementNeedSummary,
} from "../problem-error-report-actions";
import { domainShort, skillLabel } from "@/lib/problem-taxonomy";
import { fmtDate } from "@/lib/format-datetime";

// 문제 오류 확정으로 보관된 문항의 '대체 문항 필요' 큐와 자동 교체 이력 표시(차단 로직 없음 — 알림·재시도만).
// 이 파일은 lazy 로 불러와 기존 모의고사 화면의 첫 렌더에 영향을 주지 않는다.

const MODULE_LABEL: Record<string, string> = { rw_m1: "R&W M1", rw_m2: "R&W M2", math_m1: "Math M1", math_m2: "Math M2" };
const REASON_LABEL: Record<string, string> = { no_spare: "여분 문항 없음", set_started: "응시 시작된 세트" };
const DIFF_LABEL: Record<string, string> = { easy: "쉬움", medium: "보통", hard: "어려움" };
const USAGE_LABEL: Record<string, string> = { mock_exam: "모의고사용", both: "기존(겸용)", general: "일반용" };
const short = (id: string) => id.slice(0, 8);

let cache: { at: number; p: Promise<ReplacementNeedSummary> } | null = null;
function loadSummary(force = false): Promise<ReplacementNeedSummary> {
  if (!force && cache && Date.now() - cache.at < 15000) return cache.p;
  const p = getReplacementNeedSummaryAction();
  cache = { at: Date.now(), p };
  p.catch(() => {
    if (cache?.p === p) cache = null;
  });
  return p;
}

/** 문항 풀 서브탭: 대체 문항 필요 건수·부족한 칸·세트별 표시·최근 자동 교체. poolRest 는 (영역|기술) 별 풀에 남은 문항 수. */
export function ReplacementNeedsBlock({ poolRest }: { poolRest: Record<string, number> }) {
  const [s, setS] = useState<ReplacementNeedSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadSummary(true)
      .then((r) => {
        if (!cancelled) setS(r);
      })
      .catch(() => {
        if (!cancelled) setError("대체 문항 현황을 불러오지 못했습니다.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function retry() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await retryReplacementAction();
      setMsg(`자동 교체 ${r.replaced}칸 · 여분 없음 ${r.noSpare}칸 · 응시 시작된 세트 ${r.setStarted}칸`);
      setS(await loadSummary(true));
    } catch {
      setMsg("다시 시도하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  if (error) return <p className="mt-3 text-xs text-red">{error}</p>;
  if (!s) return <p className="mt-3 text-xs text-grey-500">대체 문항 현황 불러오는 중...</p>;
  const warn = s.openTotal > 0;
  return (
    <div className={`mt-4 rounded-lg border p-3 ${warn ? "border-red bg-red-bg/40" : "border-grey-200 bg-grey-50"}`} data-testid="replacement-needs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={`text-xs font-bold ${warn ? "text-red" : "text-grey-600"}`} data-testid="replacement-needs-header">
          대체 문항 필요 {s.openTotal}건{s.openTotal > 0 ? ` (세트 칸 ${s.openInMockSet})` : ""} · 자동 교체 누적 {s.autoReplacedTotal}건
        </p>
        <button
          type="button"
          onClick={() => void retry()}
          disabled={busy || s.openInMockSet === 0}
          className="rounded-lg border border-grey-300 bg-white px-3 py-1 text-[12px] font-bold text-ink disabled:opacity-40"
        >
          {busy ? "교체 중…" : "자동 교체 다시 시도"}
        </button>
      </div>
      {msg && <p role="status" className="mt-1 text-[12px] text-grey-600">{msg}</p>}

      {s.cells.length > 0 && (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[560px] text-xs">
            <thead>
              <tr className="text-left text-grey-500">
                <th className="py-1 pr-2">부족한 칸</th>
                <th className="py-1 pr-2">난이도</th>
                <th className="py-1 pr-2">용도</th>
                <th className="py-1 pr-2 text-right">필요</th>
                <th className="py-1 text-right">풀 남음</th>
              </tr>
            </thead>
            <tbody>
              {s.cells.map((c, i) => {
                const rest = poolRest[`${c.satDomain ?? ""}|${c.skillCode ?? ""}`] ?? 0;
                return (
                  <tr key={i} className="border-t border-grey-100">
                    <td className="py-1 pr-2">
                      {c.inMockSet ? `${MODULE_LABEL[c.moduleKey ?? ""] ?? "세트"} · ` : "일반 문항 · "}
                      {c.satDomain ? domainShort(c.satDomain) : "영역 없음"} · {c.skillCode ? skillLabel(c.skillCode) : "(기술 미지정)"}
                    </td>
                    <td className="py-1 pr-2">{c.difficulty ? DIFF_LABEL[c.difficulty] ?? c.difficulty : "-"}</td>
                    <td className="py-1 pr-2">{USAGE_LABEL[c.usageScope] ?? c.usageScope}</td>
                    <td className="py-1 pr-2 text-right font-bold text-red">{c.openCount}</td>
                    <td className={`py-1 text-right ${c.inMockSet && rest < c.openCount ? "font-bold text-red" : ""}`}>{c.inMockSet ? rest : "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-1 text-[11px] text-grey-500">여분 문항을 만들어 공개한 뒤 &lsquo;자동 교체 다시 시도&rsquo;를 누르면 시작 전 세트의 빈 칸을 채웁니다.</p>
        </div>
      )}

      {s.sets.length > 0 && (
        <ul className="mt-2 flex flex-col gap-0.5 text-[12px]" data-testid="replacement-sets">
          {s.sets.map((x) => (
            <li key={x.examSetId}>
              <span className="font-bold">{x.name}</span> — 문항 교체 필요 {x.openCount}칸
              <span className="text-grey-500">
                {x.noSpareCount > 0 ? ` · 여분 없음 ${x.noSpareCount}` : ""}
                {x.startedCount > 0 ? ` · ${REASON_LABEL.set_started} ${x.startedCount}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}

      {s.replacements.length > 0 && (
        <details className="mt-2 text-[12px]">
          <summary className="cursor-pointer font-bold text-grey-600">최근 자동 교체 {s.replacements.length}건</summary>
          <ul className="mt-1 flex flex-col gap-0.5" data-testid="replacement-log">
            {s.replacements.slice(0, 20).map((r) => (
              <li key={r.id}>
                문항 {short(r.oldProblemId)} → {short(r.newProblemId)} 교체됨 · {r.examSetName ?? "세트"} · {MODULE_LABEL[r.moduleKey ?? ""] ?? r.moduleKey ?? ""}
                {r.route ? `(${r.route === "higher" ? "상" : "하"} 변형)` : ""} · {fmtDate(r.createdAt)}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

/** 세트 목록 행에 붙는 '문항 교체 필요' 표시(요약은 15초 공유 캐시 — 행마다 요청하지 않는다). */
export function ReplacementBadge({ examSetId }: { examSetId: string }) {
  const [n, setN] = useState<{ open: number; noSpare: number; started: number } | null>(null);
  useEffect(() => {
    let cancelled = false;
    loadSummary()
      .then((r) => {
        const x = r.sets.find((y) => y.examSetId === examSetId);
        if (!cancelled && x) setN({ open: x.openCount, noSpare: x.noSpareCount, started: x.startedCount });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [examSetId]);
  if (!n || n.open === 0) return null;
  return (
    <span className="ml-2 rounded-full bg-red-bg px-2 py-0.5 text-[11px] font-bold text-red" title={n.noSpare > 0 ? "여분 문항이 없어 교체하지 못한 칸이 있습니다" : "응시가 시작된 세트라 바꿀 수 없습니다"} data-testid="set-replacement-badge">
      문항 교체 필요 {n.open}
    </span>
  );
}
