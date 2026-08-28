import type { StatsData } from "./stats-data";

export default function StatsTab({ data }: { data: StatsData }) {
  return (
    <div className="max-w-[640px] px-8 py-8">
      <h1 className="text-[20px] font-extrabold text-ink mb-5">통계</h1>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <StatCard
          value={data.attendanceRate !== null ? `${data.attendanceRate}%` : "—"}
          label="수업 참여율"
        />
        <StatCard
          value={data.satisfactionAvg !== null ? `${data.satisfactionAvg} / 5` : "—"}
          label="선생님 피드백 만족도"
        />
      </div>

      <div className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4.5">
        <h2 className="text-[14px] font-bold text-ink mb-3">과목별 참여율</h2>
        {data.bySubject.length === 0 ? (
          <p className="text-[12.5px] text-grey-500">
            아직 집계할 수업 기록이 없습니다.
          </p>
        ) : (
          data.bySubject.map((s) => (
            <div key={s.subjectName} className="flex items-center gap-3 mb-2.5 last:mb-0">
              <div className="w-[110px] shrink-0 text-[12.5px] text-ink">
                {s.subjectName}
              </div>
              <div className="flex-1 h-2 rounded-full bg-grey-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-ink"
                  style={{ width: `${s.pct}%` }}
                />
              </div>
              <div className="w-9 shrink-0 text-[12px] font-semibold text-grey-500 text-right">
                {s.pct}%
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="border-[1.5px] border-grey-200 rounded-xl px-4 py-4 text-center">
      <div className="text-[22px] font-extrabold text-ink">{value}</div>
      <div className="text-[11.5px] font-bold text-grey-500 mt-1">{label}</div>
    </div>
  );
}
