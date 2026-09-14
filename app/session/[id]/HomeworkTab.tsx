"use client";

import { useState } from "react";
import type { SessionViewViewer } from "@/lib/session-view";
import { addHomeworkItem, saveHomeworkAnswer } from "./homework-actions";
import type { HomeworkItem } from "./homework-data";
import { composeHomeworkFromSession } from "@/app/teacher/homework-composition-actions";
import type {
  HomeworkKeywordOption,
  SessionHomeworkStatusItem,
} from "@/app/teacher/homework-composition-data";

export default function HomeworkTab({
  sessionId,
  initialItems,
  viewerRole,
  sessionSource = "legacy",
  realViewerRole,
  keywordOptions = [],
  homeworkStatusItems = [],
}: {
  sessionId: string;
  initialItems: HomeworkItem[];
  viewerRole: SessionViewViewer;
  // R9(레슨 준비 Task 4) — legacy homework_items 쓰기는 v3 세션에서 FK 문제로
  // 여전히 막혀 있다(SessionShell의 writesEnabled 가드, 이 파일 밖 기존 정책).
  // composeHomeworkFromSession()은 그와 무관한 새 테이블(session_homework_items)
  // 을 쓰므로 v3 세션에서만, 그리고 (데모션되지 않은) 실제 역할이 선생님/관리자일
  // 때만 노출한다.
  sessionSource?: "legacy" | "v3";
  realViewerRole?: SessionViewViewer;
  keywordOptions?: HomeworkKeywordOption[];
  // Gap 2 (2026-09-08) — 이 세션에서 발급된 v3 과제의 학생 제출 현황(읽기전용).
  // canComposeFromSession과 동일한 조건(v3 세션 + 실제 역할 teacher/admin)에서만
  // 보여준다 — 쓰기 UI는 절대 추가하지 않는다.
  homeworkStatusItems?: SessionHomeworkStatusItem[];
}) {
  const [items, setItems] = useState(initialItems);
  const isTeacher = viewerRole === "teacher";
  const isStudent = viewerRole === "student";
  const canComposeFromSession =
    sessionSource === "v3" && (realViewerRole === "teacher" || realViewerRole === "admin");

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

      {canComposeFromSession && (
        <ComposeFromSessionForm sessionId={sessionId} keywordOptions={keywordOptions} />
      )}

      {canComposeFromSession && (
        <HomeworkStatusList items={homeworkStatusItems} />
      )}
    </div>
  );
}

// Gap 2 (2026-09-08) — 발급된 과제(session_homework_items)의 학생 제출 현황을
// 읽기 전용으로 보여준다. 상태 표시(작성 전/임시 저장/제출완료)와, 제출됐다면
// 실제 답안 내용을 보여준다 — MC는 선택한 보기(텍스트 포함), 서술형은 작성한
// 텍스트 그대로. 여기엔 어떤 입력/저장 컨트롤도 없다(제품 오너 지시 — 교사/
// 관리자는 학생 답안을 고칠 수 없다).
const STATUS_LABEL: Record<SessionHomeworkStatusItem["status"], string> = {
  not_started: "작성 전",
  draft: "임시 저장됨",
  submitted: "제출완료",
};

function isStatusOptions(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((o) => typeof o === "string");
}

function HomeworkStatusList({ items }: { items: SessionHomeworkStatusItem[] }) {
  if (items.length === 0) return null;

  return (
    <div className="mt-6 pt-5 border-t border-grey-200">
      <h3 className="text-[14px] font-bold text-ink mb-3">
        이 세션에서 발급한 과제 — 제출 현황
      </h3>
      {items.map((item) => (
        <HomeworkStatusRow key={item.id} item={item} />
      ))}
    </div>
  );
}

function HomeworkStatusRow({ item }: { item: SessionHomeworkStatusItem }) {
  const options = isStatusOptions(item.options) ? item.options : null;
  const response = item.response as { type?: string; selected?: number; text?: string } | null;

  return (
    <div className="border-[1.5px] border-grey-200 rounded-xl px-4 py-3.5 mb-2.5">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[12.5px] font-semibold text-ink">
          과제 #{item.position}
        </span>
        <span className="text-[11px] font-bold px-2.5 py-1 rounded-md bg-grey-100 text-grey-500">
          {STATUS_LABEL[item.status]}
        </span>
      </div>
      {item.passage && (
        <p className="text-[12.5px] text-grey-500 leading-[1.6] mb-2 whitespace-pre-wrap">
          {item.passage}
        </p>
      )}
      {item.status === "not_started" ? (
        <p className="text-[12.5px] text-grey-300">아직 답안이 없습니다.</p>
      ) : item.format === "mc" && options && response?.type === "mc" ? (
        <div className="text-[12.5px] text-ink">
          선택한 답: {String.fromCharCode(65 + (response.selected ?? -1))}
          {typeof response.selected === "number" && options[response.selected]
            ? ` — ${options[response.selected]}`
            : ""}
        </div>
      ) : response?.type === "text" ? (
        <p className="text-[12.5px] text-ink whitespace-pre-wrap">{response.text}</p>
      ) : (
        <p className="text-[12.5px] text-grey-300">답안 형식을 표시할 수 없습니다.</p>
      )}
    </div>
  );
}

// R9(레슨 준비 Task 4) — composeHomeworkFromSession()을 호출하는 UI. 이 탭이
// 지금까지 쓰던 legacy homework_items 목록(items)에는 반영되지 않는다(별개
// 테이블, session_homework_items) — 발급된 문제 id 목록만 확인용으로 보여준다.
function ComposeFromSessionForm({
  sessionId,
  keywordOptions,
}: {
  sessionId: string;
  keywordOptions: HomeworkKeywordOption[];
}) {
  const [selectedKeywordIds, setSelectedKeywordIds] = useState<string[]>([]);
  const [count, setCount] = useState(5);
  const [includeUsedInLesson, setIncludeUsedInLesson] = useState(false);
  const [includeAlreadyAttempted, setIncludeAlreadyAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ issuedProblemIds: string[]; requestedCount: number; issuedCount: number } | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  function toggleKeyword(id: string) {
    setSelectedKeywordIds((prev) =>
      prev.includes(id) ? prev.filter((k) => k !== id) : [...prev, id]
    );
  }

  async function handleCompose() {
    if (selectedKeywordIds.length === 0 || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const composed = await composeHomeworkFromSession(sessionId, selectedKeywordIds, count, {
        includeUsedInLesson,
        includeAlreadyAttempted,
      });
      setResult(composed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "과제 구성에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4.5 mt-4">
      <h3 className="text-[14px] font-bold text-ink mb-2">이 세션에서 과제 구성</h3>
      {keywordOptions.length === 0 ? (
        <p className="text-[12.5px] text-grey-500">
          이 세션에 연결된 단원 키워드가 없습니다(콘텐츠가 아직 pin되지 않았거나 키워드가 없습니다).
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {keywordOptions.map((k) => (
              <button
                key={k.id}
                type="button"
                onClick={() => toggleKeyword(k.id)}
                className={`text-[12px] px-3 py-1.5 rounded-full border-[1.5px] ${
                  selectedKeywordIds.includes(k.id)
                    ? "border-green bg-green/10 text-green font-bold"
                    : "border-grey-200 text-grey-500"
                }`}
              >
                {k.label}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-2 text-[12.5px] text-ink mb-1.5">
            <input
              type="checkbox"
              checked={includeUsedInLesson}
              onChange={(e) => setIncludeUsedInLesson(e.target.checked)}
            />
            수업 중 이미 사용한 문제도 포함
          </label>
          <label className="flex items-center gap-2 text-[12.5px] text-ink mb-3">
            <input
              type="checkbox"
              checked={includeAlreadyAttempted}
              onChange={(e) => setIncludeAlreadyAttempted(e.target.checked)}
            />
            학생이 이미 풀어본 문제도 포함
          </label>

          <div className="flex items-center gap-2 mb-3">
            <label className="text-[12.5px] text-ink">문항 수</label>
            <input
              type="number"
              min={1}
              max={50}
              value={count}
              onChange={(e) => setCount(Math.max(1, Number(e.target.value) || 1))}
              className="w-16 px-2 py-1 border-[1.5px] border-grey-200 rounded-lg text-[13px]"
            />
          </div>

          <button
            type="button"
            disabled={selectedKeywordIds.length === 0 || submitting}
            onClick={handleCompose}
            className="text-[12px] font-bold px-4 py-2 rounded-lg bg-green text-white disabled:opacity-50"
          >
            {submitting ? "구성 중..." : "과제 구성하기"}
          </button>

          {error && <p className="text-[12px] text-red-600 mt-2">{error}</p>}
          {result && (
            <p className="text-[12px] text-grey-500 mt-2">
              {result.issuedCount < result.requestedCount
                ? `요청 ${result.requestedCount}개 중 ${result.issuedCount}개만 발급되었습니다(후보 부족).`
                : `${result.issuedCount}개 문제가 발급되었습니다.`}
            </p>
          )}
        </>
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
