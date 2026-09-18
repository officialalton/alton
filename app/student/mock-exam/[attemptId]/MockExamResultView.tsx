import type { MockExamAttemptDetail } from "@/lib/mock-exam/attempt-data";
import { computeMockExamReport } from "@/lib/mock-exam/report";

const SECTION_LABEL: Record<string, string> = { rw: "R&W", math: "Math" };

function pct(correct: number, total: number): string {
  if (total === 0) return "-";
  return `${Math.round((correct / total) * 100)}%`;
}

function formatMinutes(seconds: number): string {
  return `${Math.round(seconds / 60)}분`;
}

/**
 * 채점 확정된 모의고사 결과 — 학생·학부모 공용(사양 3절 "같은 원본에서 표시", 7절 결과 항목).
 * 2026-09-18 제품 오너 지시: 학부모용 상세 리포트가 "매우 중요"한 1급 요구사항으로 격상돼,
 * 학생 화면도 같은 상세 리포트를 쓰도록 공용 컴포넌트로 만들었다(사양 3절 "같은 원본" 원칙과도 맞다).
 * 내부 채점 근거(문법 규칙 id 등 내부 필드)는 애초에 이 컴포넌트에 넘어오지 않는다 — attempt-data.ts 가
 * problem_versions 의 공개 가능한 필드(문항 내용·정답·해설)만 골라 내려준다.
 */
export default function MockExamResultView({ attempt, readOnly }: { attempt: MockExamAttemptDetail; readOnly: boolean }) {
  const report = computeMockExamReport(attempt.items);
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-grey-200 bg-white p-5 text-center">
        <p className="text-[12px] font-bold uppercase tracking-wide text-grey-500">전체 정답률</p>
        <p className="mt-1 text-[32px] font-extrabold">
          {report.correctCount ?? 0}/{report.totalCount}
        </p>
        <p className="text-[13px] text-grey-500">{pct(report.correctCount ?? 0, report.totalCount)} · 총 소요 시간 {formatMinutes(report.totalTimeSpentSeconds)}</p>
        <p className="mt-2 text-[11.5px] text-grey-400">
          실제 SAT·College Board 점수와 동등하지 않은 학습 진단 결과입니다(사양 7절).
        </p>
      </div>

      <div className="rounded-lg border border-grey-200 bg-white p-4">
        <h3 className="mb-2 text-[13px] font-bold">섹션별 결과</h3>
        <div className="grid grid-cols-2 gap-3">
          {report.bySection.map((s) => (
            <div key={s.section} className="rounded-lg bg-grey-50 p-3">
              <p className="text-[12px] font-bold text-grey-500">{SECTION_LABEL[s.section]}</p>
              <p className="text-[18px] font-extrabold">
                {s.correct ?? 0}/{s.total}
              </p>
              <p className="text-[11.5px] text-grey-500">소요 {formatMinutes(s.timeSpentSeconds)}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-grey-200 bg-white p-4">
        <h3 className="mb-2 text-[13px] font-bold">영역별 결과</h3>
        <ul className="flex flex-col gap-1.5">
          {report.byDomain.map((d) => (
            <li key={d.key} className="flex items-center justify-between text-[13px]">
              <span className="text-grey-600">{d.label}</span>
              <span className="font-bold">
                {d.correct}/{d.total} ({pct(d.correct, d.total)})
              </span>
            </li>
          ))}
        </ul>
      </div>

      {report.bySkill.length > 0 && (
        <div className="rounded-lg border border-grey-200 bg-white p-4">
          <h3 className="mb-2 text-[13px] font-bold">세부기술별 결과</h3>
          <ul className="flex flex-col gap-1.5">
            {report.bySkill.map((s) => (
              <li key={s.key} className="flex items-center justify-between text-[13px]">
                <span className="text-grey-600">{s.label}</span>
                <span className="font-bold">
                  {s.correct}/{s.total} ({pct(s.correct, s.total)})
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {report.missedItems.length > 0 && (
        <div className="rounded-lg border border-grey-200 bg-white p-4">
          <h3 className="mb-2 text-[13px] font-bold">오답 문항</h3>
          <ul className="flex flex-col gap-1.5">
            {report.missedItems.map((m) => (
              <li key={m.setItemId} className="text-[12.5px] text-grey-600">
                {SECTION_LABEL[m.section]} {m.position}번 · {m.satDomain}
                {m.skillCode ? ` · ${m.skillCode}` : ""}
              </li>
            ))}
          </ul>
          {!readOnly && <p className="mt-2 text-[11.5px] text-grey-400">오답 복습·보충 과제는 담당 선생님이 발급합니다(사양 7절 — 자동 발급하지 않음).</p>}
        </div>
      )}
    </div>
  );
}
