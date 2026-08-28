"use client";

import { useState } from "react";
import type { SessionViewViewer } from "@/lib/session-view";
import { addHomeworkItem, saveHomeworkAnswer } from "./homework-actions";
import type { HomeworkItem } from "./homework-data";

export default function HomeworkTab({
  sessionId,
  initialItems,
  viewerRole,
}: {
  sessionId: string;
  initialItems: HomeworkItem[];
  viewerRole: SessionViewViewer;
}) {
  const [items, setItems] = useState(initialItems);
  const isTeacher = viewerRole === "teacher";
  const isStudent = viewerRole === "student";

  return (
    <div className="max-w-[720px] px-8 py-8">
      <h1 className="text-[20px] font-extrabold text-ink mb-1.5">과제</h1>
      <p className="text-[13px] text-grey-500 mb-5">
        {isTeacher
          ? "학생에게 배정된 과제입니다. 새 과제를 추가하거나 제출 답안을 확인할 수 있습니다."
          : "이번 회차에 배정된 과제입니다."}
      </p>

      {items.length === 0 ? (
        <div className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center mb-4">
          배정된 과제가 없습니다.
        </div>
      ) : (
        items.map((item) => (
          <HomeworkCard
            key={item.id}
            item={item}
            isStudent={isStudent}
            onAnswerSaved={(answer) =>
              setItems((prev) =>
                prev.map((i) =>
                  i.id === item.id ? { ...i, studentAnswer: answer } : i
                )
              )
            }
          />
        ))
      )}

      {isTeacher && (
        <AddHomeworkForm
          sessionId={sessionId}
          onAdded={(item) => setItems((prev) => [...prev, item])}
        />
      )}
    </div>
  );
}

function HomeworkCard({
  item,
  isStudent,
  onAnswerSaved,
}: {
  item: HomeworkItem;
  isStudent: boolean;
  onAnswerSaved: (answer: string) => void;
}) {
  const [answer, setAnswer] = useState(item.studentAnswer ?? "");
  const [saving, setSaving] = useState(false);

  async function handleBlur() {
    if (answer === (item.studentAnswer ?? "")) return;
    setSaving(true);
    try {
      await saveHomeworkAnswer(item.id, answer);
      onAnswerSaved(answer);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4.5 mb-3">
      <h3 className="text-[15px] font-bold text-ink mb-1.5">{item.title}</h3>
      {item.description && (
        <p className="text-[13px] text-grey-500 leading-[1.6] mb-2.5">
          {item.description}
        </p>
      )}

      {isStudent ? (
        <>
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            onBlur={handleBlur}
            placeholder="답안을 작성하세요"
            className="w-full min-h-[70px] mt-2 px-3 py-2.5 border-[1.5px] border-grey-200 rounded-lg text-[13px]"
          />
          {saving && (
            <p className="text-[11px] text-grey-500 mt-1">저장 중...</p>
          )}
        </>
      ) : (
        <>
          <div className="text-[11px] font-bold text-grey-300 uppercase tracking-wide mt-2">
            학생 제출 답안
          </div>
          <div className="text-[13px] text-ink whitespace-pre-wrap">
            {item.studentAnswer || "아직 제출하지 않았습니다."}
          </div>
        </>
      )}
    </div>
  );
}

function AddHomeworkForm({
  sessionId,
  onAdded,
}: {
  sessionId: string;
  onAdded: (item: HomeworkItem) => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!title.trim() || submitting) return;
    setSubmitting(true);
    try {
      const item = await addHomeworkItem(sessionId, title.trim(), description.trim());
      onAdded(item);
      setTitle("");
      setDescription("");
      setOpen(false);
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-[12px] font-bold px-4 py-2 rounded-lg border border-grey-200"
      >
        + 과제 추가
      </button>
    );
  }

  return (
    <div className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4.5">
      <label className="block text-[12px] font-bold text-ink mb-1.5">
        제목
      </label>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full mb-3 px-3 py-2 border-[1.5px] border-grey-200 rounded-lg text-[13px]"
        placeholder="과제 제목"
      />
      <label className="block text-[12px] font-bold text-ink mb-1.5">
        설명 (선택)
      </label>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className="w-full min-h-[70px] mb-3 px-3 py-2 border-[1.5px] border-grey-200 rounded-lg text-[13px]"
        placeholder="과제 설명"
      />
      <div className="flex gap-2">
        <button
          disabled={!title.trim() || submitting}
          onClick={handleSubmit}
          className="text-[12px] font-bold px-4 py-2 rounded-lg bg-green text-white disabled:opacity-50"
        >
          추가하기
        </button>
        <button
          onClick={() => setOpen(false)}
          className="text-[12px] font-semibold px-4 py-2 rounded-lg text-grey-500"
        >
          취소
        </button>
      </div>
    </div>
  );
}
