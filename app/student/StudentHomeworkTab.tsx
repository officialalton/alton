"use client";

import { useState } from "react";
import { saveHomeworkAnswer } from "@/app/session/[id]/homework-actions";
import type { StudentHomeworkItem } from "./homework-data";

export default function StudentHomeworkTab({
  initialTodo,
  initialDone,
}: {
  initialTodo: StudentHomeworkItem[];
  initialDone: StudentHomeworkItem[];
}) {
  const [todo, setTodo] = useState(initialTodo);
  const [done, setDone] = useState(initialDone);
  const [subtab, setSubtab] = useState<"todo" | "done">("todo");

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
            ? "작성이 필요한 과제가 없습니다."
            : "아직 작성 완료한 과제가 없습니다."}
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
