import type { ReactNode } from "react";

// 통계 탭용 가벼운 SVG·CSS 차트 — 외부 라이브러리 없이 기존 테마 토큰(ink·grey·red·green)만 쓴다.
// 색에만 의존하지 않도록 값은 항상 글자로도 함께 표시한다(차트는 보조, role="img" + aria-label 요약).

export function Section({ title, hint, children, wide = false }: { title: string; hint?: string; children: ReactNode; wide?: boolean }) {
  const id = `stats-sec-${title.replace(/\s+/g, "-")}`;
  return (
    <section aria-labelledby={id} className={"border-[1.5px] border-grey-200 rounded-xl px-5 py-4.5 bg-white " + (wide ? "md:col-span-2" : "")}>
      <h2 id={id} className="text-[14px] font-bold text-ink">{title}</h2>
      {hint && <p className="text-[11.5px] text-grey-500 mt-0.5">{hint}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="text-[12.5px] text-grey-500">{children}</p>;
}

export function Metric({ value, label, sub }: { value: string; label: string; sub?: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[20px] font-extrabold text-ink leading-tight">{value}</div>
      <div className="text-[11.5px] font-bold text-grey-500 mt-0.5">{label}</div>
      {sub && <div className="text-[11px] text-grey-500">{sub}</div>}
    </div>
  );
}

/** 가로 막대 한 줄. */
export function BarRow({ label, pct, right, dashed = false }: { label: string; pct: number; right: string; dashed?: boolean }) {
  const w = Math.max(0, Math.min(100, pct));
  return (
    <div className="flex items-center gap-3 mb-2.5 last:mb-0">
      <div className="w-[130px] shrink-0 text-[12.5px] text-ink truncate" title={label}>{label}</div>
      <div
        className="flex-1 h-2 rounded-full bg-grey-100 overflow-hidden"
        role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={w}
      >
        <div className={"h-full rounded-full " + (dashed ? "bg-grey-500" : "bg-ink")} style={{ width: `${w}%` }} />
      </div>
      <div className="w-[92px] shrink-0 text-[12px] font-semibold text-grey-500 text-right">{right}</div>
    </div>
  );
}

type SparkPoint = { x: string; y: number | null };

/** 작은 추이선(0~100 %). null 구간은 끊긴 선. 마지막·처음 값 글자를 같이 보여준다. */
export function Sparkline({ points, label, max = 100, unit = "%" }: { points: SparkPoint[]; label: string; max?: number; unit?: string }) {
  const W = 240, H = 56, P = 4;
  const n = points.length;
  const xs = (i: number) => (n <= 1 ? W / 2 : P + (i * (W - 2 * P)) / (n - 1));
  const ys = (v: number) => H - P - (Math.min(v, max) / max) * (H - 2 * P);
  let d = "";
  let pen = false;
  points.forEach((p, i) => {
    if (p.y === null) { pen = false; return; }
    d += `${pen ? "L" : "M"}${xs(i).toFixed(1)},${ys(p.y).toFixed(1)} `;
    pen = true;
  });
  const valued = points.filter((p) => p.y !== null) as { x: string; y: number }[];
  const first = valued[0], last = valued[valued.length - 1];
  const summary = valued.length
    ? `${label}: ${first.x} ${first.y}${unit} to ${last.x} ${last.y}${unit}`
    : `${label}: no data`;
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[56px] text-ink" role="img" aria-label={summary} preserveAspectRatio="none">
        <line x1={P} x2={W - P} y1={H - P} y2={H - P} stroke="currentColor" strokeOpacity="0.15" />
        {d && <path d={d} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />}
        {points.map((p, i) => p.y !== null && <circle key={i} cx={xs(i)} cy={ys(p.y)} r="2.5" fill="currentColor" />)}
      </svg>
      <div className="flex justify-between text-[11px] text-grey-500 mt-0.5">
        <span>{first ? `${first.x} · ${first.y}${unit}` : "—"}</span>
        <span>{last && last !== first ? `${last.x} · ${last.y}${unit}` : ""}</span>
      </div>
    </div>
  );
}

/** 주별 활동량 막대(과제·수업 문제·단어 누적). 세 종류는 명암 + 범례 글자로 구분한다. */
export function StackedWeekBars({ weeks }: { weeks: { label: string; parts: { key: string; value: number }[] }[] }) {
  const max = Math.max(1, ...weeks.map((w) => w.parts.reduce((a, p) => a + p.value, 0)));
  const shade: Record<string, string> = { homework: "bg-ink", lesson: "bg-grey-500", vocab: "bg-grey-300" };
  return (
    <div className="flex items-end gap-1.5 h-[72px]" role="img"
      aria-label={"Weekly learning activity: " + weeks.map((w) => `${w.label} ${w.parts.reduce((a, p) => a + p.value, 0)}`).join(", ")}>
      {weeks.map((w) => {
        const total = w.parts.reduce((a, p) => a + p.value, 0);
        return (
          <div key={w.label} className="flex-1 flex flex-col justify-end h-full" title={`${w.label} · ${total}`}>
            <div className="flex flex-col-reverse rounded-sm overflow-hidden" style={{ height: `${(total / max) * 100}%`, minHeight: total ? 3 : 0 }}>
              {w.parts.map((p) => p.value > 0 && <div key={p.key} className={shade[p.key] ?? "bg-ink"} style={{ flexGrow: p.value }} />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** 모의고사 예상 점수 범위 추이 — 응시마다 (low~high) 막대. min/max 는 호출부가 데이터에 맞춰 정한다. */
export function RangeTrend({ items, min, max, label }: { items: { x: string; low: number; high: number }[]; min: number; max: number; label: string }) {
  const W = 260, H = 84, P = 6;
  const n = items.length;
  const xs = (i: number) => (n <= 1 ? W / 2 : P + 10 + (i * (W - 2 * P - 20)) / (n - 1));
  const ys = (v: number) => H - P - ((v - min) / (max - min)) * (H - 2 * P);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[84px] text-ink" role="img"
      aria-label={`${label}: ` + items.map((i) => `${i.x} ${i.low}–${i.high} pts`).join(", ")}>
      <line x1={P} x2={W - P} y1={H - P} y2={H - P} stroke="currentColor" strokeOpacity="0.15" />
      {items.map((it, i) => (
        <g key={i}>
          <line x1={xs(i)} x2={xs(i)} y1={ys(it.high)} y2={ys(it.low)} stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeOpacity="0.85" />
        </g>
      ))}
    </svg>
  );
}

export function StatsSkeleton() {
  return (
    <div role="status" aria-label="Loading stats" className="grid gap-4 md:grid-cols-2 animate-pulse">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4.5 h-[150px]">
          <div className="h-3 w-24 bg-grey-100 rounded mb-4" />
          <div className="h-2 w-full bg-grey-100 rounded mb-2.5" />
          <div className="h-2 w-4/5 bg-grey-100 rounded mb-2.5" />
          <div className="h-2 w-3/5 bg-grey-100 rounded" />
        </div>
      ))}
    </div>
  );
}
