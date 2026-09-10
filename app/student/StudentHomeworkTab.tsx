"use client";

import { useState } from "react";
import { saveHomeworkAnswer } from "@/app/session/[id]/homework-actions";
import type { StudentHomeworkItem } from "./homework-data";
import type { StudentHomeworkV3Item } from "./homework-v3-data";
import { saveHomeworkV3Draft, submitHomeworkV3 } from "./homework-v3-actions";

export default function StudentHomeworkTab({
  initialTodo,
  initialDone,
  initialV3Items,
}: {
  initialTodo: StudentHomeworkItem[];
  initialDone: StudentHomeworkItem[];
  initialV3Items?: StudentHomeworkV3Item[];
}) {
  const [todo, setTodo] = useState(initialTodo);
  const [done, setDone] = useState(initialDone);
  const [subtab, setSubtab] = useState<"todo" | "done">("todo");
  const v3Items = initialV3Items ?? [];

  function handleSaved(item: StudentHomeworkItem, answer: string) {
    const updated = { ...item, studentAnswer: answer };
    if (answer.trim()) {
      setTodo((prev) => prev.filter((i) => i.id !== item.id));
      setDone((prev) => [updated, ...prev.filter((i) => i.id !== item.id)]);
    } else {
      setDone((prev) => prev.filter((i) => i.id !== item.id));
      setTodo((prev) => [updated, ...prev.filter((i) => i.id !== item.id)]);
    }
  }

  const list = subtab === "todo" ? todo : done;
  const grouped = groupBySubjectSession(list);

  return (
    <div className="max-w-[640px] px-8 py-8">
      <h1 className="text-[20px] font-extrabold text-ink mb-1.5">과제</h1>
      <p className="text-[13px] text-grey-500 mb-5">
        여기서 바로 답안을 작성할 수 있습니다. 세션에 들어가지 않아도 미리
        풀어볼 수 있어요.
      </p>

      <div className="flex gap-4 mb-5 border-b border-grey-200">
        {(["todo", "done"] as const).map((id) => (
          <button
            key={id}
            onClick={() => setSubtab(id)}
            className={
              "text-[13.5px] font-semibold pb-2.5 -mb-px border-b-2 " +
              (subtab === id
                ? "text-ink border-ink"
                : "text-grey-500 border-transparent")
            }
          >
            {id === "todo" ? "작성 필요" : "작성 완료"}
          </button>
        ))}
      </div>

      {grouped.length === 0 ? (
        <div className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center">
          {subtab === "todo"
            ? "지금은 할 과제가 없어요. 새 과제가 오면 여기 보여드릴게요."
            : "아직 작성 완료한 과제가 없어요."}
        </div>
      ) : (
        grouped.map(([key, group]) => (
          <div key={key} className="mb-5">
            <div className="text-[13px] font-bold text-ink mb-2">
              {group.subjectName} · {group.sessionNumber}회차
            </div>
            {group.items.map((item) => (
              <HomeworkAccordionItem
                key={item.id}
                item={item}
                onSaved={(answer) => handleSaved(item, answer)}
              />
            ))}
          </div>
        ))
      )}

      {v3Items.length > 0 && (
        <div className="mt-8 pt-6 border-t border-grey-200">
          <h2 className="text-[15px] font-extrabold text-ink mb-1">
            새로 배정된 과제
          </h2>
          <p className="text-[12px] text-grey-500 mb-4">
            선생님이 이 수업에서 새로 발급한 과제입니다.
          </p>
          {v3Items.map((item) => (
            <HomeworkV3AccordionItem key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

// Gap 1 (2026-09-08) — v3 과제 답안의 JSON 저장 모양을 여기서 확정한다.
// problems.format이 'mc'면 선택한 보기의 인덱스(problem.options 배열 기준,
// 0-based)를 { type: "mc", selected: number } 로, 그 외(essay/math 등 자유
// 서술형)는 학생이 쓴 텍스트를 { type: "text", text: string } 로 저장한다.
// saveHomeworkV3Draft/submitHomeworkV3는 response: unknown을 그대로
// upsert하므로(인가는 RLS/트리거에 위임 — homework-v3-actions.ts 주석 참고)
// 이 모양은 순수 앱 레벨 계약이다. 교사측 읽기 전용 뷰(Gap 2,
// app/teacher/homework-composition-data.ts의 loadSessionHomeworkStatus)도
// 이 모양을 그대로 해석해야 한다 — 바꿀 경우 두 곳을 함께 고칠 것.
type HomeworkV3Response =
  | { type: "mc"; selected: number }
  | { type: "text"; text: string };

function isMcResponse(v: unknown): v is { type: "mc"; selected: number } {
  return (
    !!v &&
    typeof v === "object" &&
    (v as { type?: unknown }).type === "mc" &&
    typeof (v as { selected?: unknown }).selected === "number"
  );
}

function isTextResponse(v: unknown): v is { type: "text"; text: string } {
  return (
    !!v &&
    typeof v === "object" &&
    (v as { type?: unknown }).type === "text" &&
    typeof (v as { text?: unknown }).text === "string"
  );
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((o) => typeof o === "string");
}

function HomeworkV3AccordionItem({ item }: { item: StudentHomeworkV3Item }) {
  const [open, setOpen] = useState(false);
  const format = item.problem?.format ?? null;
  const isMc = format === "mc";

  const initialSelected = isMcResponse(item.attempt?.response)
    ? item.attempt.response.selected
    : null;
  const initialText = isTextResponse(item.attempt?.response)
    ? item.attempt.response.text
    : "";

  const [selected, setSelected] = useState<number | null>(initialSelected);
  const [text, setText] = useState(initialText);
  const [submitted, setSubmitted] = useState(item.attempt?.submitted ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const label =
    `과제 #${item.position}` + (submitted ? " · 제출완료" : "");

  function currentResponse(): HomeworkV3Response | null {
    if (isMc) {
      return selected === null ? null : { type: "mc", selected };
    }
    return { type: "text", text };
  }

  async function handleSaveDraft() {
    const response = currentResponse();
    if (response === null) return;
    setSaving(true);
    setError(null);
    try {
      await saveHomeworkV3Draft(item.id, response);
    } catch (err) {
      // 요구사항 3 — DB 레벨 거부(RLS/트리거)가 그대로 여기까지 올라온다.
      // 조용히 무시하지 않고 화면에 보여준다(제출됐다고 잘못 표시하지 않음).
      setError(err instanceof Error ? err.message : "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit() {
    const response = currentResponse();
    if (response === null) return;
    setSaving(true);
    setError(null);
    try {
      await submitHomeworkV3(item.id, response);
      setSubmitted(true);
    } catch (err) {
      // 요구사항 3 — 이미 제출된 항목에 대한 재제출 시도 등 DB 거부를 그대로
      // 노출한다. submitted를 true로 바꾸지 않으므로 저장/제출 버튼도 그대로
      // 남는다(성공한 것처럼 보이지 않는다).
      setError(err instanceof Error ? err.message : "제출에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  const options = isStringArray(item.problem?.options) ? item.problem!.options : null;

  return (
    <div className="border-[1.5px] border-grey-200 rounded-xl mb-2.5 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-[13px] font-semibold text-ink">{label}</span>
        <span className="text-[12px] text-grey-300">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="px-4 pb-4">
          {!item.contentVisible ? (
            <p className="text-[13px] text-grey-500 leading-[1.6]">
              현재 이 문제는 볼 수 없습니다(선생님이 확정을 취소했을 수
              있습니다). 배정 자체는 유지됩니다.
            </p>
          ) : (
            <>
              {item.problem?.passage && (
                <>
                  <div className="text-[11px] font-bold text-grey-300 uppercase tracking-wide mb-1">
                    문제
                  </div>
                  <p className="text-[13px] text-ink leading-[1.6] mb-3 whitespace-pre-wrap">
                    {item.problem.passage}
                  </p>
                </>
              )}

              {isMc && options ? (
                <div className="flex flex-col gap-2 mb-1.5">
                  {options.map((opt, i) => {
                    const isSelected = selected === i;
                    return (
                      <button
                        key={i}
                        type="button"
                        disabled={submitted}
                        onClick={() => setSelected(i)}
                        className={
                          "flex items-center gap-2.5 px-3.5 py-2.5 rounded-[10px] border-[1.5px] text-[13.5px] text-left " +
                          (isSelected
                            ? "border-ink bg-grey-100"
                            : "border-grey-200") +
                          (submitted ? " cursor-default opacity-90" : " cursor-pointer")
                        }
                      >
                        <span className="w-[22px] h-[22px] rounded-full border-[1.5px] border-grey-300 flex items-center justify-center text-[11px] font-extrabold flex-shrink-0">
                          {String.fromCharCode(65 + i)}
                        </span>
                        {opt}
                      </button>
                    );
                  })}
                </div>
              ) : isMc ? (
                // format이 mc인데 options가 없거나 모양이 이상한 경우 — 크래시
                // 대신 일반 텍스트 입력으로 안전하게 대체한다.
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  disabled={submitted}
                  placeholder="답안을 작성하세요"
                  className="w-full min-h-[70px] px-3 py-2.5 border-[1.5px] border-grey-200 rounded-lg text-[13px] disabled:opacity-60"
                />
              ) : (
                // essay/math 및 그 외 알려지지 않은 format에 대한 범용 폴백 —
                // 서술형 입력. 세 번째 format이 생기더라도 크래시하거나 조용히
                // 아무 것도 렌더링하지 않는 대신 이 텍스트 입력으로 처리한다.
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  disabled={submitted}
                  placeholder="답안을 작성하세요"
                  className="w-full min-h-[70px] px-3 py-2.5 border-[1.5px] border-grey-200 rounded-lg text-[13px] disabled:opacity-60"
                />
              )}

              {!submitted && (
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={handleSaveDraft}
                    disabled={saving || (isMc && selected === null)}
                    className="text-[12px] font-semibold px-3 py-1.5 rounded-lg border border-grey-200"
                  >
                    임시 저장
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={saving || (isMc && selected === null)}
                    className="text-[12px] font-semibold px-3 py-1.5 rounded-lg bg-ink text-white"
                  >
                    제출하기
                  </button>
                </div>
              )}
              {saving && (
                <p className="text-[11px] text-grey-500 mt-1">저장 중...</p>
              )}
              {error && (
                <p className="text-[11px] text-red-600 mt-1">{error}</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function groupBySubjectSession(items: StudentHomeworkItem[]) {
  const map = new Map<
    string,
    { subjectName: string; sessionNumber: number; items: StudentHomeworkItem[] }
  >();
  for (const item of items) {
    const key = `${item.subjectName}_${item.sessionNumber}`;
    const group = map.get(key) ?? {
      subjectName: item.subjectName,
      sessionNumber: item.sessionNumber,
      items: [],
    };
    group.items.push(item);
    map.set(key, group);
  }
  return Array.from(map.entries());
}

function HomeworkAccordionItem({
  item,
  onSaved,
}: {
  item: StudentHomeworkItem;
  onSaved: (answer: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [answer, setAnswer] = useState(item.studentAnswer ?? "");
  const [saving, setSaving] = useState(false);

  const submitted = !!(item.studentAnswer && item.studentAnswer.trim());
  const label =
    item.title + (submitted ? " · 제출완료" : "") + (item.graded ? " · 채점완료" : "");

  async function handleBlur() {
    if (answer === (item.studentAnswer ?? "")) return;
    setSaving(true);
    try {
      await saveHomeworkAnswer(item.id, answer);
      onSaved(answer);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="border-[1.5px] border-grey-200 rounded-xl mb-2.5 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-[13px] font-semibold text-ink">{label}</span>
        <span className="text-[12px] text-grey-300">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="px-4 pb-4">
          {item.description && (
            <>
              <div className="text-[11px] font-bold text-grey-300 uppercase tracking-wide mb-1">
                문제
              </div>
              <p className="text-[13px] text-ink leading-[1.6] mb-3 whitespace-pre-wrap">
                {item.description}
              </p>
            </>
          )}
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            onBlur={handleBlur}
            placeholder="답안을 작성하세요"
            className="w-full min-h-[70px] px-3 py-2.5 border-[1.5px] border-grey-200 rounded-lg text-[13px]"
          />
          {saving && (
            <p className="text-[11px] text-grey-500 mt-1">저장 중...</p>
          )}
          {item.graded && item.score && (
            <p className="text-[12px] font-semibold text-ink mt-2">
              점수: {item.score}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
