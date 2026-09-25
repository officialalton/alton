// 랜딩 페이지 리디자인(2026-09-25) — "Growth made visible" 섹션의 막대+선 차트.
// 목업(Landing.dc.html)의 하드코딩 데이터·좌표 계산식을 그대로 옮겼다.
const LESSONS_PER_WEEK = [2, 2, 3, 2, 3, 3, 2, 3, 3, 3];
const SCORES = [52, 55, 61, 60, 66, 71, 70, 76, 80, 84];
const MILESTONES = [
  { i: 2, label: "First full score on a quiz" },
  { i: 5, label: "Equilibrium unit mastered" },
  { i: 9, label: "Ready for the mock exam" },
];

const x = (i: number) => 66 + i * 66;
const yS = (v: number) => 360 - (v - 40) * 4.8;
const CHART_BOTTOM = 360;
const BAR_UNIT = 24;

export default function GrowthChart() {
  const linePoints = SCORES.map((v, i) => `${x(i)},${yS(v)}`).join(" ");

  return (
    <div className="bg-white border border-[#E6E1D8] rounded-3xl p-8 overflow-x-auto">
      <div className="flex items-center justify-between mb-6">
        <strong className="text-[14px] text-[#142240]">Jiwoo · AP Chemistry, Weeks 1–10</strong>
        <div className="flex items-center gap-4 text-[12px] text-[#4F5A6B]">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#DCE6FC]" /> Lessons
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-[3px] rounded-full bg-[#C8102E]" /> Practice score
          </span>
        </div>
      </div>
      <svg viewBox="0 0 720 400" className="w-full min-w-[640px]" role="img" aria-label="주별 수업 횟수와 연습 점수 추이">
        {[0, 20, 40, 60, 80, 100].map((v) => (
          <line
            key={v}
            x1={40}
            x2={700}
            y1={yS(v + 40) < 0 ? 0 : 360 - v * 3.2}
            y2={360 - v * 3.2}
            stroke="#F1EDE6"
            strokeWidth={1}
          />
        ))}

        {LESSONS_PER_WEEK.map((n, i) => (
          <rect
            key={i}
            x={x(i) - 16}
            y={CHART_BOTTOM - n * BAR_UNIT}
            width={32}
            height={n * BAR_UNIT}
            rx={6}
            fill="#DCE6FC"
          />
        ))}

        <polyline points={linePoints} fill="none" stroke="#C8102E" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        {SCORES.map((v, i) => (
          <circle key={i} cx={x(i)} cy={yS(v)} r={4} fill="#C8102E" />
        ))}

        {MILESTONES.map((m) => (
          <g key={m.i}>
            <line x1={x(m.i)} x2={x(m.i)} y1={yS(SCORES[m.i]) - 10} y2={30} stroke="#E6E1D8" strokeDasharray="3 3" />
            <foreignObject x={Math.min(x(m.i) - 70, 580)} y={4} width="150" height="34">
              <div className="text-[11px] leading-[1.3] text-[#4F5A6B] bg-[#F8F5EF] border border-[#E6E1D8] rounded-lg px-2 py-1 text-center">
                {m.label}
              </div>
            </foreignObject>
          </g>
        ))}

        {LESSONS_PER_WEEK.map((_, i) => (
          <text key={i} x={x(i)} y={382} textAnchor="middle" fontSize="11" fill="#9A9284">
            W{i + 1}
          </text>
        ))}
      </svg>
    </div>
  );
}
