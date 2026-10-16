"use client";

import { useMemo, useState } from "react";
import type { SessionViewViewer } from "@/lib/session-view";
import type { ProblemLogEntry } from "./problemlog-data";
import {
  toggleSaveAttempt,
  retryMcAttempt,
  retryEssayAttempt,
  retryMathAttempt,
  saveTeacherPick,
  removeTeacherPick,
} from "./problemlog-actions";
import MathCanvas from "./MathCanvas";
import { useViewerTimezone } from "@/app/components/ViewerTimezoneProvider";
import { fmtIntlEn } from "@/lib/format-datetime-en";

const REASONS = ["단어", "로직", "해석", "기타"];
// 저장값(DB)은 그대로 두고 화면 라벨만 영어로 보여준다.
const REASON_LABEL: Record<string, string> = { "단어": "Vocabulary", "로직": "Logic", "해석": "Interpretation", "기타": "Other" };
const FORMAT_LABEL: Record<ProblemLogEntry["format"], string> = {
  mc: "Multiple choice",
  spr: "Numeric entry",
  essay: "Written response",
  math: "Math",
};
const UNSPECIFIED_UNIT = "No unit";
const ALL = "All";

export default function ProblemLogTab({
  initialEntries,
  viewerRole,
}: {
  initialEntries: ProblemLogEntry[];
  viewerRole: SessionViewViewer;
}) {
  const [entries, setEntries] = useState(initialEntries);
  const [subjectFilter, setSubjectFilter] = useState(ALL);
  const [unitFilter, setUnitFilter] = useState(ALL);
  const [correctFilter, setCorrectFilter] = useState<
    "all" | "correct" | "incorrect"
  >("all");
  const [formatFilter, setFormatFilter] = useState<
    "all" | ProblemLogEntry["format"]
  >("all");
  const [savedOnly, setSavedOnly] = useState(false);
  const [pickOnly, setPickOnly] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const isStudent = viewerRole === "student";
  const isTeacher = viewerRole === "teacher";

  const subjects = useMemo(
    () => Array.from(new Set(entries.map((e) => e.subjectName))).filter(Boolean),
    [entries]
  );

  const units = useMemo(() => {
    const pool =
      subjectFilter === ALL
        ? entries
        : entries.filter((e) => e.subjectName === subjectFilter);
    const set = new Set(pool.map((e) => e.unitTitle || UNSPECIFIED_UNIT));
    return Array.from(set);
  }, [entries, subjectFilter]);

  const filtered = entries.filter((e) => {
    if (subjectFilter !== ALL && e.subjectName !== subjectFilter) return false;
    if (
      unitFilter !== ALL &&
      (e.unitTitle || UNSPECIFIED_UNIT) !== unitFilter
    )
      return false;
    if (correctFilter === "correct" && e.correct !== true) return false;
    if (correctFilter === "incorrect" && e.correct !== false) return false;
    if (formatFilter !== "all" && e.format !== formatFilter) return false;
    if (savedOnly && !e.saved) return false;
    if (pickOnly && !e.teacherPick) return false;
    return true;
  });

  function updateEntry(attemptId: string, patch: Partial<ProblemLogEntry>) {
    setEntries((prev) =>
      prev.map((e) => (e.attemptId === attemptId ? { ...e, ...patch } : e))
    );
  }

  function addRetryEntry(source: ProblemLogEntry, entry: ProblemLogEntry) {
    setEntries((prev) => [entry, ...prev]);
    setExpandedId(entry.attemptId);
  }

  async function handleToggleSave(entry: ProblemLogEntry) {
    const next = !entry.saved;
    updateEntry(entry.attemptId, { saved: next });
    await toggleSaveAttempt(entry.attemptId, next);
  }

  return (
    <div className="max-w-[720px] px-8 py-8">
      <h1 className="text-[20px] font-extrabold text-ink mb-1.5">Problem History</h1>
      <p className="text-[13px] text-grey-500 mb-5">
        {isTeacher
          ? "Problems this student has worked on so far."
          : "Problems you have worked on so far."}
      </p>

      <FilterBar
        subjects={subjects}
        units={units}
        subjectFilter={subjectFilter}
        unitFilter={unitFilter}
        correctFilter={correctFilter}
        formatFilter={formatFilter}
        savedOnly={savedOnly}
        pickOnly={pickOnly}
        onSubject={(v) => {
          setSubjectFilter(v);
          setUnitFilter(ALL);
        }}
        onUnit={setUnitFilter}
        onCorrect={setCorrectFilter}
        onFormat={setFormatFilter}
        onSavedOnly={setSavedOnly}
        onPickOnly={setPickOnly}
      />

      {filtered.length === 0 ? (
        <div className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center mt-4">
          No problem history matches these filters.
        </div>
      ) : (
        <div className="mt-4">
          {filtered.map((entry) => (
            <LogCard
              key={entry.attemptId}
              entry={entry}
              expanded={expandedId === entry.attemptId}
              onToggleExpand={() =>
                setExpandedId((id) => (id === entry.attemptId ? null : entry.attemptId))
              }
              canManageSave={isStudent}
              canRetry={isStudent}
              canTag={isTeacher}
              onToggleSave={() => handleToggleSave(entry)}
              onRetried={(newEntry) => addRetryEntry(entry, newEntry)}
              onPickSaved={(pick) => updateEntry(entry.attemptId, { teacherPick: pick })}
              onPickRemoved={() => updateEntry(entry.attemptId, { teacherPick: null })}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterBar({
  subjects,
  units,
  subjectFilter,
  unitFilter,
  correctFilter,
  formatFilter,
  savedOnly,
  pickOnly,
  onSubject,
  onUnit,
  onCorrect,
  onFormat,
  onSavedOnly,
  onPickOnly,
}: {
  subjects: string[];
  units: string[];
  subjectFilter: string;
  unitFilter: string;
  correctFilter: "all" | "correct" | "incorrect";
  formatFilter: "all" | ProblemLogEntry["format"];
  savedOnly: boolean;
  pickOnly: boolean;
  onSubject: (v: string) => void;
  onUnit: (v: string) => void;
  onCorrect: (v: "all" | "correct" | "incorrect") => void;
  onFormat: (v: "all" | ProblemLogEntry["format"]) => void;
  onSavedOnly: (v: boolean) => void;
  onPickOnly: (v: boolean) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      {subjects.length > 1 && (
        <ChipRow
          label="Subject"
          options={[ALL, ...subjects]}
          value={subjectFilter}
          onChange={onSubject}
        />
      )}
      {units.length > 1 && (
        <ChipRow
          label="Unit"
          options={[ALL, ...units]}
          value={unitFilter}
          onChange={onUnit}
        />
      )}
      <ChipRow
        label="Result"
        options={[
          { id: "all", label: "All" },
          { id: "correct", label: "Correct" },
          { id: "incorrect", label: "Incorrect" },
        ]}
        value={correctFilter}
        onChange={onCorrect}
      />
      <ChipRow
        label="Format"
        options={[
          { id: "all", label: "All" },
          { id: "mc", label: "Multiple choice" },
          { id: "essay", label: "Written response" },
          { id: "math", label: "Math" },
        ]}
        value={formatFilter}
        onChange={onFormat}
      />
      <div className="flex gap-4">
        <ToggleChip
          active={savedOnly}
          label="★ Saved only"
          onClick={() => onSavedOnly(!savedOnly)}
        />
        <ToggleChip
          active={pickOnly}
          label="🏷 Teacher picks only"
          onClick={() => onPickOnly(!pickOnly)}
        />
      </div>
    </div>
  );
}

function ChipRow<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly (T | { id: T; label: string })[];
  value: T;
  onChange: (v: T) => void;
}) {
  const normalized = options.map((o) =>
    typeof o === "string" ? { id: o, label: o } : o
  );
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-[11.5px] font-bold text-grey-500 w-12 shrink-0">
        {label}
      </span>
      {normalized.map((opt) => (
        <button
          key={opt.id}
          onClick={() => onChange(opt.id)}
          className={
            "text-[12px] font-semibold px-3 py-1 rounded-full border-[1.5px] " +
            (value === opt.id
              ? "bg-ink text-white border-ink"
              : "border-grey-200 text-grey-500")
          }
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function ToggleChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "text-[12px] font-bold px-3.5 py-1.5 rounded-full border-[1.5px] " +
        (active ? "bg-ink text-white border-ink" : "border-grey-200 text-grey-500")
      }
    >
      {label}
    </button>
  );
}

function LogCard({
  entry,
  expanded,
  onToggleExpand,
  canManageSave,
  canRetry,
  canTag,
  onToggleSave,
  onRetried,
  onPickSaved,
  onPickRemoved,
}: {
  entry: ProblemLogEntry;
  expanded: boolean;
  onToggleExpand: () => void;
  canManageSave: boolean;
  canRetry: boolean;
  canTag: boolean;
  onToggleSave: () => void;
  onRetried: (entry: ProblemLogEntry) => void;
  onPickSaved: (pick: ProblemLogEntry["teacherPick"]) => void;
  onPickRemoved: () => void;
}) {
  const tz = useViewerTimezone();
  const preview = entry.passage.slice(0, 110);

  return (
    <div className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-3">
      <div className="flex items-start justify-between gap-3">
        <button
          onClick={onToggleExpand}
          className="flex-1 text-left"
        >
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <Badge>{FORMAT_LABEL[entry.format]}</Badge>
            {entry.format === "mc" && entry.correct !== null && (
              <Badge tone={entry.correct ? "green" : "red"}>
                {entry.correct ? "Correct" : "Incorrect"}
              </Badge>
            )}
            {entry.teacherPick && <Badge tone="yellow">🏷 Teacher pick</Badge>}
            <span className="text-[11.5px] text-grey-500">
              {formatKoreanDateTime(entry.attemptedAt, tz)}
            </span>
          </div>
          <p className="text-[13px] text-ink leading-[1.5]">
            {preview}
            {entry.passage.length > 110 ? "…" : ""}
          </p>
        </button>
        {canManageSave && (
          <button
            onClick={onToggleSave}
            className={
              "text-[16px] shrink-0 " + (entry.saved ? "text-yellow" : "text-grey-300")
            }
            title={entry.saved ? "Saved" : "Save"}
          >
            {entry.saved ? "★" : "☆"}
          </button>
        )}
      </div>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-grey-200">
          <DetailBody entry={entry} />
          <div className="flex items-center gap-4 mt-3">
            {canRetry && (
              <RetrySection entry={entry} onRetried={onRetried} />
            )}
          </div>
          {canTag && (
            <TeacherPickPanel
              entry={entry}
              onSaved={onPickSaved}
              onRemoved={onPickRemoved}
            />
          )}
        </div>
      )}
    </div>
  );
}

function Badge({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone?: "green" | "red" | "yellow";
}) {
  const toneClass =
    tone === "green"
      ? "bg-green-bg text-green"
      : tone === "red"
      ? "bg-red-bg text-red"
      : tone === "yellow"
      ? "bg-yellow-bg text-ink"
      : "bg-grey-100 text-grey-500";
  return (
    <span className={"text-[11px] font-bold px-2.5 py-0.5 rounded-full " + toneClass}>
      {children}
    </span>
  );
}

function DetailBody({ entry }: { entry: ProblemLogEntry }) {
  return (
    <div>
      <p className="text-[13.5px] text-ink leading-[1.6] mb-3 whitespace-pre-wrap">
        {entry.passage}
      </p>
      {entry.format === "mc" && entry.options && (
        <div className="mb-3">
          {entry.options.map((opt, i) => {
            const isCorrect = i === entry.correctIndex;
            const isResponse = i === entry.response;
            return (
              <div
                key={i}
                className={
                  "text-[13px] px-3 py-2 rounded-lg mb-1.5 " +
                  (isCorrect
                    ? "bg-green-bg text-green font-semibold"
                    : isResponse
                    ? "bg-red-bg text-red"
                    : "bg-grey-100 text-ink")
                }
              >
                {opt}
                {isResponse && !isCorrect ? " (my answer)" : ""}
                {isCorrect ? " (correct)" : ""}
              </div>
            );
          })}
        </div>
      )}
      {entry.format !== "mc" && typeof entry.response === "string" && (
        <div className="mb-3">
          <div className="text-[11px] font-bold text-grey-300 uppercase tracking-wide mb-1">
            My response
          </div>
          {entry.format === "math" ? (
            // eslint-disable-next-line @next/next/no-img-element -- 캔버스에서 뽑은 data URL이라 next/image 최적화 대상이 아님
            <img src={entry.response} alt="My work" className="border border-grey-200 rounded-lg" />
          ) : (
            <p className="text-[13px] text-ink whitespace-pre-wrap">{entry.response}</p>
          )}
        </div>
      )}
      <div className="text-[11px] font-bold text-grey-300 uppercase tracking-wide mb-1">
        Explanation
      </div>
      <p className="text-[13px] text-grey-500 leading-[1.6]">{entry.explanation}</p>
    </div>
  );
}

function RetrySection({
  entry,
  onRetried,
}: {
  entry: ProblemLogEntry;
  onRetried: (entry: ProblemLogEntry) => void;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-[12px] font-bold px-4 py-2 rounded-lg border border-grey-200"
      >
        🔁 Try again
      </button>
    );
  }

  async function submitMc(index: number) {
    setSubmitting(true);
    try {
      const res = await retryMcAttempt(entry.problemId, index);
      setSelected(index);
      setResult(res.correct ? "Correct!" : res.done ? "Incorrect. Check the answer." : "Incorrect. Try again.");
      if (res.done) {
        onRetried({
          ...entry,
          attemptId: `retry-${crypto.randomUUID()}`,
          response: index,
          correct: res.correct,
          saved: false,
          attemptedAt: new Date().toISOString(),
          teacherPick: null,
        });
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function submitEssay() {
    setSubmitting(true);
    try {
      await retryEssayAttempt(entry.problemId, text);
      onRetried({
        ...entry,
        attemptId: `retry-${crypto.randomUUID()}`,
        response: text,
        correct: null,
        saved: false,
        attemptedAt: new Date().toISOString(),
        teacherPick: null,
      });
      setResult("Submitted.");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitMath(dataUrl: string) {
    setSubmitting(true);
    try {
      await retryMathAttempt(entry.problemId, dataUrl);
      onRetried({
        ...entry,
        attemptId: `retry-${crypto.randomUUID()}`,
        response: dataUrl,
        correct: null,
        saved: false,
        attemptedAt: new Date().toISOString(),
        teacherPick: null,
      });
      setResult("Submitted.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="w-full">
      <div className="text-[12px] font-bold text-ink mb-2">Try again</div>
      {entry.format === "mc" && entry.options && (
        <div className="mb-2">
          {entry.options.map((opt, i) => (
            <button
              key={i}
              disabled={submitting || result !== null}
              onClick={() => submitMc(i)}
              className={
                "block w-full text-left text-[13px] px-3 py-2 rounded-lg mb-1.5 border-[1.5px] disabled:opacity-60 " +
                (selected === i ? "border-ink" : "border-grey-200")
              }
            >
              {opt}
            </button>
          ))}
        </div>
      )}
      {entry.format === "essay" && (
        <div className="mb-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={result !== null}
            className="w-full min-h-[70px] px-3 py-2.5 border-[1.5px] border-grey-200 rounded-lg text-[13px] mb-2"
          />
          {result === null && (
            <button
              disabled={submitting || !text.trim()}
              onClick={submitEssay}
              className="text-[12px] font-bold px-4 py-2 rounded-lg bg-green text-white disabled:opacity-50"
            >
              Submit
            </button>
          )}
        </div>
      )}
      {entry.format === "math" && result === null && (
        <MathCanvas onSubmit={submitMath} submitting={submitting} />
      )}
      {result && <p className="text-[12.5px] font-semibold text-ink">{result}</p>}
    </div>
  );
}

function TeacherPickPanel({
  entry,
  onSaved,
  onRemoved,
}: {
  entry: ProblemLogEntry;
  onSaved: (pick: ProblemLogEntry["teacherPick"]) => void;
  onRemoved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [reasons, setReasons] = useState<string[]>(entry.teacherPick?.reasons ?? []);
  const [reasonText, setReasonText] = useState(entry.teacherPick?.reasonText ?? "");
  const [saving, setSaving] = useState(false);

  function toggleReason(r: string) {
    setReasons((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));
  }

  async function handleSave() {
    if (reasons.length === 0) return;
    setSaving(true);
    try {
      await saveTeacherPick(entry.attemptId, reasons, reasons.includes("기타") ? reasonText.trim() || null : null);
      onSaved({ reasons, reasonText: reasons.includes("기타") ? reasonText.trim() || null : null, taggedAt: new Date().toISOString() });
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    setSaving(true);
    try {
      await removeTeacherPick(entry.attemptId);
      onRemoved();
      setReasons([]);
      setReasonText("");
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-[12px] font-bold px-4 py-2 rounded-lg border border-grey-200 mt-3"
      >
        🏷 Teacher pick
      </button>
    );
  }

  return (
    <div className="mt-3 border-[1.5px] border-grey-200 rounded-xl px-4 py-3.5">
      <div className="text-[12px] font-bold text-ink mb-2">
        Why did you pick this? (select all that apply)
      </div>
      <div className="flex gap-2 flex-wrap mb-2">
        {REASONS.map((r) => (
          <button
            key={r}
            onClick={() => toggleReason(r)}
            className={
              "text-[12px] font-semibold px-3 py-1 rounded-full border-[1.5px] " +
              (reasons.includes(r)
                ? "bg-ink text-white border-ink"
                : "border-grey-200 text-grey-500")
            }
          >
            {REASON_LABEL[r] ?? r}
          </button>
        ))}
      </div>
      {reasons.includes("기타") && (
        <textarea
          value={reasonText}
          onChange={(e) => setReasonText(e.target.value)}
          placeholder="Enter a reason"
          className="w-full min-h-[60px] px-3 py-2 border-[1.5px] border-grey-200 rounded-lg text-[13px] mb-2"
        />
      )}
      <div className="flex gap-2">
        <button
          disabled={reasons.length === 0 || saving}
          onClick={handleSave}
          className="text-[12px] font-bold px-4 py-2 rounded-lg bg-green text-white disabled:opacity-50"
        >
          Save tag
        </button>
        {entry.teacherPick && (
          <button
            disabled={saving}
            onClick={handleRemove}
            className="text-[12px] font-semibold px-4 py-2 rounded-lg text-red"
          >
            Remove pick
          </button>
        )}
        <button
          onClick={() => setOpen(false)}
          className="text-[12px] font-semibold px-4 py-2 rounded-lg text-grey-500"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function formatKoreanDateTime(iso: string, tz: string) {
  return fmtIntlEn(new Date(iso), {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }, tz);
}
