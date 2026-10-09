"use client";

// 영역·스킬·토픽별 정답률 막대(SAT 결과의 "Results by Domain" 과 AP 결과의 토픽 목록이 같은 컴포넌트를 쓴다).
// 색 눈금: 빨강 < 40%, 노랑(amber) 40~70%, 초록 > 70%, 응시 0 이면 회색. 색만으로 구분하지 않는다 — n/m (p%) 글자와 상태 글자("Needs work/Fair/Strong")를 같이 보인다.
// 근거 문항 수(n)가 적으면(< 3) 막대를 흐리게 하고 "few questions" 를 붙인다. 새 쿼리 없음(이미 계산된 행만 그린다).
export type BarRow = { key: string; label: string; correct: number; total: number };
export const LOW_SAMPLE_N = 3;
export type Tone = "none" | "red" | "amber" | "green";
export const accuracyPct = (correct: number, total: number) => (total > 0 ? Math.round((100 * correct) / total) : 0);
export function accuracyTone(correct: number, total: number): Tone {
  if (total <= 0) return "none";
  const p = (100 * correct) / total;
  return p < 40 ? "red" : p <= 70 ? "amber" : "green";
}
const FILL: Record<Tone, string> = { none: "bg-grey-300", red: "bg-red", amber: "bg-yellow", green: "bg-green" };
const WORD: Record<Tone, string> = { none: "No data", red: "Needs work", amber: "Fair", green: "Strong" };
const WORD_CLS: Record<Tone, string> = { none: "text-grey-400", red: "text-red", amber: "text-grey-600", green: "text-green" };

export function AccuracyBar({ correct, total, size = "sm" }: { correct: number; total: number; size?: "sm" | "lg" }) {
  const tone = accuracyTone(correct, total); const p = accuracyPct(correct, total);
  return (
    <div role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={p} aria-label={`Accuracy ${p}% (${correct} of ${total})`} data-tone={tone}
      className={`w-full overflow-hidden rounded-full bg-grey-100 ${size === "lg" ? "h-3" : "h-2"}`}>
      <div className={`h-full rounded-full ${FILL[tone]}`} style={{ width: `${total > 0 ? Math.max(p, 2) : 0}%` }} />
    </div>
  );
}

/** 막대 목록. onInfo 가 있으면 이름이 설명 팝오버 버튼(기존 동작 유지). highlightFirst 는 가장 약한 첫 행을 강조(집중할 스킬). */
export function AccuracyBarList({ rows, size = "sm", onInfo, highlightFirst = false, testId }: {
  rows: BarRow[]; size?: "sm" | "lg"; onInfo?: (row: BarRow) => void; highlightFirst?: boolean; testId?: string;
}) {
  return (
    <ul className={`flex flex-col ${size === "lg" ? "gap-3" : "gap-2.5"}`} data-testid={testId}>
      {rows.map((r, i) => {
        const tone = accuracyTone(r.correct, r.total); const low = r.total > 0 && r.total < LOW_SAMPLE_N;
        return (
          <li key={r.key} className={`flex flex-col gap-1 ${highlightFirst && i === 0 ? "rounded-lg border-[1.5px] border-red/50 bg-red/5 px-3 py-2" : ""} ${low ? "opacity-70" : ""}`} data-tone={tone} data-low-sample={low ? "true" : undefined}>
            <div className={`flex items-baseline justify-between gap-2 ${size === "lg" ? "text-[14px]" : "text-[13px]"}`}>
              {onInfo ? (
                <button type="button" onClick={() => onInfo(r)} className="text-left text-grey-700 underline decoration-dotted underline-offset-2 hover:text-ink" aria-haspopup="dialog">{r.label}</button>
              ) : <span className="text-grey-700">{r.label}</span>}
              <span className="shrink-0 font-bold">{r.correct}/{r.total} ({accuracyPct(r.correct, r.total)}%)</span>
            </div>
            <AccuracyBar correct={r.correct} total={r.total} size={size} />
            <div className="flex items-center gap-2 text-[11px]">
              <span className={`font-semibold ${WORD_CLS[tone]}`}>{WORD[tone]}</span>
              {low && <span className="text-grey-400" data-testid="few-questions">few questions (n={r.total})</span>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
