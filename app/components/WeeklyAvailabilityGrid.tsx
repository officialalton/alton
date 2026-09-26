"use client";

// 관리자 상담 가용시간(ConsultationSchedulingPanel)과 선생님 개인 가용시간
// (TeacherAvailabilityTab)이 공유하는 요일×시간 그리드. 반복 요일 규칙(weekday +
// start/end time)을 Google Calendar 주간 뷰와 같은 형태(요일 7열, 시간축 행, 색칠된
// 블록)로 렌더링한다. 새 달력 위젯이나 라이브러리를 쓰지 않고 순수 CSS grid로 구현.

const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

export type WeeklyAvailabilityRule = {
  id: string;
  weekday: number; // 0=일 ... 6=토
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
};

export type WeeklyAvailabilityGridProps = {
  rules: WeeklyAvailabilityRule[];
  onDeleteRule?: (ruleId: string) => void;
  /** 그리드가 보여줄 시간 범위(기본 07:00~23:00). */
  startHour?: number;
  endHour?: number;
};

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + (m || 0);
}

export default function WeeklyAvailabilityGrid({
  rules,
  onDeleteRule,
  startHour = 7,
  endHour = 23,
}: WeeklyAvailabilityGridProps) {
  const totalMinutes = (endHour - startHour) * 60;
  const hourMarks = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i);

  return (
    <div data-testid="weekly-availability-grid" className="border-[1.5px] border-grey-200 rounded-xl overflow-hidden">
      <div className="flex">
        <div className="w-12 shrink-0" />
        {DAY_LABELS.map((label, idx) => (
          <div key={idx} className="flex-1 text-center text-[12px] font-bold text-ink py-2 border-l border-grey-200">
            {label}
          </div>
        ))}
      </div>
      <div className="flex relative" style={{ height: `${(endHour - startHour) * 40}px` }}>
        <div className="w-12 shrink-0 relative">
          {hourMarks.map((h) => (
            <div
              key={h}
              className="absolute right-1 text-[10px] text-grey-500 -translate-y-1/2"
              style={{ top: `${((h - startHour) / (endHour - startHour)) * 100}%` }}
            >
              {String(h).padStart(2, "0")}:00
            </div>
          ))}
        </div>
        {DAY_LABELS.map((_, weekday) => (
          <div key={weekday} className="flex-1 relative border-l border-grey-200">
            {hourMarks.map((h) => (
              <div
                key={h}
                className="absolute left-0 right-0 border-t border-grey-100"
                style={{ top: `${((h - startHour) / (endHour - startHour)) * 100}%` }}
              />
            ))}
            {rules
              .filter((r) => r.weekday === weekday)
              .map((r) => {
                const startMin = timeToMinutes(r.startTime) - startHour * 60;
                const endMin = timeToMinutes(r.endTime) - startHour * 60;
                const top = Math.max(0, (startMin / totalMinutes) * 100);
                const bottom = Math.min(100, (endMin / totalMinutes) * 100);
                if (bottom <= 0 || top >= 100) return null;
                return (
                  <button
                    key={r.id}
                    type="button"
                    data-testid={`availability-block-${r.id}`}
                    title={onDeleteRule ? `${r.startTime}~${r.endTime} (클릭해서 삭제)` : `${r.startTime}~${r.endTime}`}
                    onClick={() => onDeleteRule?.(r.id)}
                    className="absolute left-0.5 right-0.5 rounded-md bg-blue/20 hover:bg-red/20 border border-blue text-[10px] font-semibold text-ink px-1 overflow-hidden text-left cursor-pointer"
                    style={{ top: `${top}%`, height: `${bottom - top}%` }}
                  >
                    {r.startTime}~{r.endTime}
                  </button>
                );
              })}
          </div>
        ))}
      </div>
    </div>
  );
}
