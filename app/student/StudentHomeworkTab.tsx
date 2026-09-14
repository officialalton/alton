"use client";

import { useState } from "react";
import { saveHomeworkAnswer } from "@/app/session/[id]/homework-actions";
import type { StudentHomeworkItem } from "./homework-data";
import type { StudentHomeworkSet } from "./homework-v3-data";

export default function StudentHomeworkTab({
  initialTodo,
  initialDone,
  homeworkSets,
}: {
  initialTodo: StudentHomeworkItem[];
  initialDone: StudentHomeworkItem[];
  /** 2026-09-14 과제 v3 통일 — 회차별 과제 묶음. 풀이는 그 수업 화면의 과제 탭에서. */
  homeworkSets?: StudentHomeworkSet[];
}) {
  const [todo, setTodo] = useState(initialTodo);
  const [done, setDone] = useState(initialDone);
  const [subtab, setSubtab] = useState<"todo" | "done">("todo");
  const sets = homeworkSets ?? [];

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

      {sets.length > 0 && (
        <div className="mt-8 pt-6 border-t border-grey-200">
          <h2 className="text-[15px] font-extrabold text-ink mb-1">수업별 과제</h2>
          <p className="text-[12px] text-grey-500 mb-4">
            선생님이 낸 과제입니다. 열어서 수업 문제와 같은 방식으로 풀면 됩니다 — 채점이 끝나면 정답과 해설이 열립니다.
          </p>
          {sets.map((set) => (
            <a
              key={set.sessionId}
              href={`/session/${set.sessionId}?tab=homework`}
              className="block border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-2.5"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[13.5px] font-bold text-ink">
                  {set.subjectName || "과제"}
                  {set.startsAt ? ` · ${new Date(set.startsAt).toLocaleDateString("ko-KR", { month: "long", day: "numeric" })} 수업` : ""}
                </span>
                <span
                  className={
                    "text-[11px] font-bold px-2.5 py-0.5 rounded-full " +
                    (set.graded === set.total ? "bg-green/10 text-green" : set.answered === set.total ? "bg-grey-100 text-ink" : "bg-red-bg text-red")
                  }
                >
                  {set.graded === set.total ? "채점 완료" : set.answered === set.total ? "채점 대기" : "풀 것 있음"}
                </span>
              </div>
              <p className="text-[12.5px] text-grey-500">
                {set.total}문제 · 푼 것 {set.answered} · 채점 {set.graded} · 열기 →
              </p>
            </a>
          ))}
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
