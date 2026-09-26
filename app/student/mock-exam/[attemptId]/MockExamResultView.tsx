"use client";

import { useMemo, useState } from "react";
import type { MockExamAttemptDetail, MockExamAttemptItem } from "@/lib/mock-exam/attempt-data";
import { computeMockExamReport } from "@/lib/mock-exam/report";
import LearningText from "@/app/session/[id]/LearningText";
import RwStimulusView from "@/app/session/[id]/RwStimulusView";
import ProblemFigure from "@/app/session/[id]/ProblemFigure";
import ProblemNoteCanvas from "@/app/components/ProblemNoteCanvas";
import { toggleMockExamSavedToPracticeAction } from "@/lib/mock-exam/attempt-actions";

const SECTION_LABEL: Record<string, string> = { rw: "R&W", math: "Math" };
const OPTION_LETTERS = ["A", "B", "C", "D", "E"];

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
/** 문항 하나(지문·질문·선택지·내 답·정답·해설)를 읽기 전용으로 보여준다 — 학생 본인 결과
 * 화면뿐 아니라 교사의 "학생 풀이 읽기 전용 열람"(TeacherMockExamStatusTab)에서도 그대로
 * 재사용한다(둘 다 채점 뒤 필드가 채워진 MockExamAttemptItem을 받는다). */
export function ItemDetail({
  item,
  attemptId,
  studentId,
  viewerIsOwner = true,
}: {
  item: MockExamAttemptItem;
  /** 필기 저장/열람에 필요 — 없으면(하위 호환) 필기 도구를 안 보여준다. */
  attemptId?: string;
  studentId?: string;
  /** true(기본) — 이 응시의 학생 본인이 보는 중(필기 가능). false — 교사·학부모가 남의
   * 응시를 읽기 전용으로 보는 중. */
  viewerIsOwner?: boolean;
}) {
  const [saved, setSaved] = useState(item.savedToPractice);

  async function toggleSaved() {
    if (!attemptId) return;
    const next = !saved;
    setSaved(next);
    await toggleMockExamSavedToPracticeAction(attemptId, item.setItemId, next);
  }

  return (
    <div className="rounded-lg border border-grey-200 bg-white p-4" data-testid="mock-exam-item-detail">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[12px] font-bold text-grey-500">
          {SECTION_LABEL[item.section]} {item.position}번 · {item.satDomain}
          {item.skillCode ? ` · ${item.skillCode}` : ""}
        </p>
        {/* 2026-09-21(사용자 지시) — 학생 포털 Practice 탭에 이 문항을 저장/해제. */}
        {viewerIsOwner && attemptId && (
          <button
            type="button"
            onClick={toggleSaved}
            aria-pressed={saved}
            className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-bold ${
              saved ? "border-ink bg-ink text-white" : "border-grey-300 text-grey-500"
            }`}
            title="Practice 탭(문제 기록)에 저장"
          >
            {saved ? "저장됨" : "+ 문제 저장"}
          </button>
        )}
      </div>
      {item.passage && <RwStimulusView passage={item.passage} className="mb-3 text-[13px]" />}
      {item.question && <LearningText text={item.question} className="mb-3 font-semibold text-[13.5px]" />}
      {item.figure ? <ProblemFigure spec={item.figure} className="mb-3" /> : null}

      {item.options && item.options.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          {item.options.map((opt, i) => {
            const isCorrect = item.correctIndex === i;
            const isMine = item.response === String(i);
            return (
              <div
                key={i}
                className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-[13px] ${
                  isCorrect ? "border-green bg-green/10" : isMine ? "border-red bg-red/5" : "border-grey-200"
                }`}
              >
                <span className="font-bold">{OPTION_LETTERS[i] ?? i + 1}.</span>
                <LearningText text={opt} />
                {isCorrect && <span className="ml-auto shrink-0 text-[11px] font-bold text-green">정답</span>}
                {isMine && !isCorrect && <span className="ml-auto shrink-0 text-[11px] font-bold text-red">내가 고른 답</span>}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col gap-1.5 text-[13px]">
          <p>
            <span className="font-bold text-grey-500">내가 쓴 답: </span>
            {item.response ?? <span className="text-grey-400">답하지 않음</span>}
          </p>
          <p>
            <span className="font-bold text-grey-500">정답: </span>
            {item.answers?.join(" 또는 ") ?? "-"}
          </p>
        </div>
      )}

      {item.explanation && (
        <div className="mt-3 rounded-lg bg-grey-50 p-3 text-[12.5px] leading-relaxed">
          <p className="mb-1 text-[11px] font-extrabold uppercase tracking-wide text-grey-400">해설</p>
          <LearningText text={item.explanation} />
        </div>
      )}

      {attemptId && studentId && (
        <ProblemNoteCanvas
          context="mock_exam"
          targetId={attemptId}
          itemId={item.setItemId}
          authorId={viewerIsOwner ? undefined : studentId}
          readOnly={!viewerIsOwner}
        />
      )}
    </div>
  );
}

export default function MockExamResultView({ attempt, readOnly }: { attempt: MockExamAttemptDetail; readOnly: boolean }) {
  const report = computeMockExamReport(attempt.items);
  const itemsById = useMemo(() => new Map(attempt.items.map((i) => [i.setItemId, i])), [attempt.items]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = selectedId ? (itemsById.get(selectedId) ?? null) : null;

  return (
    <div className={attempt.items.length > 0 ? "md:grid md:grid-cols-[minmax(0,1fr)_420px] md:items-start md:gap-4" : ""}>
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

      {/* 2026-09-21(UAT 지적) — "봤던 모의고사도 다시 볼 수 있게" — 오답만이 아니라 전체
          문항을 다시 열어볼 수 있어야 한다. 정오 표시는 색상과 별개로 텍스트로도 구분한다. */}
      {attempt.items.length > 0 && (
        <div className="rounded-lg border border-grey-200 bg-white p-4">
          <h3 className="mb-2 text-[13px] font-bold">전체 문항 다시 보기</h3>
          <ul className="flex flex-col gap-1.5">
            {attempt.items.map((it) => (
              <li key={it.setItemId}>
                <button
                  type="button"
                  onClick={() => setSelectedId(it.setItemId)}
                  className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-[12.5px] ${
                    selectedId === it.setItemId ? "bg-ink text-white" : "text-grey-600 hover:bg-grey-100"
                  }`}
                  data-testid={`review-item-${it.setItemId}`}
                >
                  <span>
                    {SECTION_LABEL[it.section]} {it.position}번 · {it.satDomain}
                    {it.skillCode ? ` · ${it.skillCode}` : ""}
                  </span>
                  {it.correct !== null && (
                    <span className={`shrink-0 text-[11px] font-bold ${selectedId === it.setItemId ? "" : it.correct ? "text-green" : "text-red"}`}>
                      {it.correct ? "정답" : "오답"}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
          {!readOnly && report.missedItems.length > 0 && (
            <p className="mt-2 text-[11.5px] text-grey-400">오답 복습·보충 과제는 담당 선생님이 발급합니다(사양 7절 — 자동 발급하지 않음).</p>
          )}
        </div>
      )}
    </div>
    {attempt.items.length > 0 && (
      <div className="mt-4 md:sticky md:top-4 md:mt-0">
        {selected ? (
          <ItemDetail item={selected} attemptId={attempt.id} studentId={attempt.studentId} viewerIsOwner={!readOnly} />
        ) : (
          <div className="rounded-lg border border-dashed border-grey-300 p-6 text-center text-[12.5px] text-grey-400">
            왼쪽에서 문항을 누르면 여기에 문제·내 답·정답·해설이 표시됩니다.
          </div>
        )}
      </div>
    )}
    </div>
  );
}
