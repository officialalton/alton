"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { logLearningEventAction } from "./activity-tracking";
import LearningText from "@/app/session/[id]/LearningText";
import ProblemFigure from "@/app/session/[id]/ProblemFigure";
import UnderlineSubTabs from "@/app/components/UnderlineSubTabs";
import { stripInlineOptions } from "@/lib/problem-text";
import type { ProblemHistoryEntry } from "./problem-history-data";
import { SKILL_BY_CODE, SKILL_CODES, domainLabel, domainShort, skillLabel } from "@/lib/problem-taxonomy";
import { useViewerTimezone } from "@/app/components/ViewerTimezoneProvider";
import { fmtDateEn as fmtDate } from "@/lib/format-datetime-en";
import { problemText } from "@/lib/problem-figures/label-rule";
import {
  EMPTY_FILTERS, applyNotebookFilters, categoryOptions, folderCounts, hasCategoryFilter, inView, isMistake, sectionOfEntry, setDomain, setSection,
  type FolderSelection, type NotebookFilters, type NotebookFolder, type NotebookSection, type NotebookView,
} from "@/lib/notebook/model";
import {
  createNotebookFolderAction, deleteNotebookFolderAction, loadNotebookStateAction, moveNotebookProblemAction, renameNotebookFolderAction,
} from "./notebook-actions";

// 2026-09-14 — 학생 포털 문제 기록(v3). 2026-10-08 — "My Notebook"으로 개편: All / My Notebook / Mistake Notebook 서브탭,
// 개인 폴더, Section → Main category → Sub-category 필터. 설계: docs/2026-10-08-my-notebook-design.md

const FORMAT_LABEL: Record<ProblemHistoryEntry["format"], string> = { mc: "Multiple choice", spr: "Numeric entry", essay: "Written response", math: "Worked solution" };
const GRADE_LABEL = { correct: "Correct", partial: "Partially correct", incorrect: "Incorrect" } as const;
const OPTION_LABELS = ["A", "B", "C", "D", "E", "F"];
const VIEW_ITEMS = [
  { id: "all", label: "All" },
  { id: "saved", label: "My Notebook" },
  { id: "mistakes", label: "Mistake Notebook" },
] as const;
const EMPTY_TEXT: Record<NotebookView, string> = {
  all: "Nothing here yet. Save questions from your practice tests and assignments, and missed questions will appear automatically.",
  saved: "You haven't saved any questions yet. Use “Save question” while you practice or review a test.",
  mistakes: "No missed questions yet. Questions you get wrong will show up here after they are graded.",
};

type NotebookState = { folders: NotebookFolder[]; assignments: Record<string, string> };

export default function ProblemHistoryTab({ entries, isFreeMember = false }: { entries: ProblemHistoryEntry[]; isFreeMember?: boolean }) {
  const tz = useViewerTimezone();
  // 2026-10-06 S6 — 노트 탭 열람 기록(학생 본인만, 10분 디듀프는 DB).
  useEffect(() => { void logLearningEventAction("mistake_review_opened"); }, []);
  const [filters, setFilters] = useState<NotebookFilters>(EMPTY_FILTERS);
  const [openId, setOpenId] = useState<string | null>(null);
  const [nb, setNb] = useState<NotebookState | null>(null);
  const [nbError, setNbError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    loadNotebookStateAction()
      .then((v) => { if (!cancelled) setNb(v); })
      .catch(() => { if (!cancelled) setNbError("Couldn't load your folders."); });
    return () => { cancelled = true; };
  }, [reloadKey]);
  const loadNotebook = useCallback(() => { setNbError(null); setReloadKey((k) => k + 1); }, []);

  const folders = useMemo(() => nb?.folders ?? [], [nb]);
  const assignments = useMemo(() => nb?.assignments ?? {}, [nb]);
  const patch = (f: Partial<NotebookFilters>) => setFilters((cur) => ({ ...cur, ...f }));

  // 기술별 성취(2026-09-14) — 채점된 문제만 센다. 문제은행·자동 구성과 같은 분류.
  const skillSummary = useMemo(() => {
    const m = new Map<string, { graded: number; correct: number; total: number }>();
    for (const e of entries) {
      const key = e.skillCode ?? "";
      if (!key) continue;
      const cur = m.get(key) ?? { graded: 0, correct: 0, total: 0 };
      cur.total += 1;
      if (e.graded) cur.graded += 1;
      if (e.grade === "correct") cur.correct += 1;
      m.set(key, cur);
    }
    return SKILL_CODES.filter((k) => m.has(k.code)).map((k) => ({ ...k, ...m.get(k.code)! }));
  }, [entries]);

  const viewScoped = useMemo(() => entries.filter((e) => inView(e, filters.view)), [entries, filters.view]);
  const options = useMemo(() => categoryOptions(viewScoped, { section: filters.section, domain: filters.domain }), [viewScoped, filters.section, filters.domain]);
  const counts = useMemo(() => folderCounts(entries, assignments, folders), [entries, assignments, folders]);
  const filtered = useMemo(() => applyNotebookFilters(entries, filters, assignments), [entries, filters, assignments]);
  const correctCount = entries.filter((e) => e.grade === "correct").length;
  const gradedCount = entries.filter((e) => e.graded).length;
  const mistakeCount = entries.filter(isMistake).length;

  async function moveProblem(workId: string, folderId: string | null) {
    if (!nb) return;
    const prev = nb;
    setActionError(null);
    const next = { ...nb.assignments };
    if (folderId) next[workId] = folderId; else delete next[workId];
    setNb({ ...nb, assignments: next });
    const r = await moveNotebookProblemAction(workId, folderId);
    if (!r.ok) { setNb(prev); setActionError(r.error); }
  }
  async function createFolder(name: string): Promise<string | null> {
    const r = await createNotebookFolderAction(name);
    if (!r.ok) return r.error;
    setNb((cur) => (cur ? { ...cur, folders: [...cur.folders, r.value] } : cur));
    patch({ folder: r.value.id });
    return null;
  }
  async function renameFolder(id: string, name: string): Promise<string | null> {
    const r = await renameNotebookFolderAction(id, name);
    if (!r.ok) return r.error;
    setNb((cur) => (cur ? { ...cur, folders: cur.folders.map((f) => (f.id === id ? { ...f, name: r.value.name } : f)) } : cur));
    return null;
  }
  async function deleteFolder(id: string): Promise<string | null> {
    const r = await deleteNotebookFolderAction(id);
    if (!r.ok) return r.error;
    // 문제는 지워지지 않는다 — 이 폴더의 배정만 걷어내 Unfiled 로 돌린다.
    setNb((cur) => (cur ? { folders: cur.folders.filter((f) => f.id !== id), assignments: Object.fromEntries(Object.entries(cur.assignments).filter(([, fid]) => fid !== id)) } : cur));
    setFilters((cur) => (cur.folder === id ? { ...cur, folder: "all" } : cur));
    return null;
  }
  function pickSkill(code: string) {
    if (filters.skill === code) { patch({ skill: "" }); return; }
    const d = SKILL_BY_CODE.get(code)?.domain ?? "";
    const section = sectionOfEntry({ workId: "", source: "lesson", graded: false, grade: null, satDomain: d, skillCode: code }) ?? "";
    patch({ section, domain: d, skill: code });
  }

  return (
    <div className="max-w-[760px]">
      <p className="text-[13px] text-grey-500 mb-3">
        {isFreeMember
          ? "Questions you missed or saved from your practice tests. Review the explanation and try them again."
          : "Questions you saved or missed in practice tests, lessons and assignments. Answers and explanations unlock once they are graded."}
        {entries.length > 0 && (
          <>
            {" "}
            Correct <b className="text-green">{correctCount}</b> / Graded {gradedCount} / Missed {mistakeCount} / Total {entries.length}
          </>
        )}
      </p>

      <UnderlineSubTabs
        items={VIEW_ITEMS}
        activeId={filters.view}
        onSelect={(id) => setFilters((cur) => ({ ...cur, view: id, ...(id === cur.view ? {} : { section: "", domain: "", skill: "" }) }))}
        className="mb-3"
      />

      <FolderBar
        state={nb}
        error={nbError}
        onRetry={loadNotebook}
        selection={filters.folder}
        onSelect={(f) => patch({ folder: f })}
        counts={counts}
        onCreate={createFolder}
        onRename={renameFolder}
        onDelete={deleteFolder}
      />
      {actionError && <p role="alert" className="mb-2 text-[12.5px] text-red">{actionError}</p>}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[12.5px] mb-4" data-testid="notebook-filters">
        {!isFreeMember && (
          <Chips
            label="Source"
            value={filters.source}
            onChange={(v) => patch({ source: v as NotebookFilters["source"] })}
            options={[["all", "All"], ["lesson", "Lesson"], ["homework", "Assignment"], ["mock_exam", "Practice Test"]]}
          />
        )}
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2" role="group" aria-label="Category filters">
          <FilterSelect label="Section" value={filters.section} placeholder="All sections" options={options.sections} onChange={(v) => setFilters((cur) => setSection(cur, v as NotebookSection | ""))} />
          <FilterSelect label="Main category" value={filters.domain} placeholder="All categories" options={options.domains} disabled={options.domains.length === 0} onChange={(v) => setFilters((cur) => setDomain(cur, v))} />
          <FilterSelect label="Sub-category" value={filters.skill} placeholder="All sub-categories" options={options.skills} disabled={options.skills.length === 0} onChange={(v) => patch({ skill: v })} />
          {(hasCategoryFilter(filters) || filters.source !== "all") && (
            <button type="button" onClick={() => setFilters((cur) => ({ ...cur, section: "", domain: "", skill: "", source: "all" }))} className="text-[12px] font-bold text-grey-500 underline px-1">
              Clear
            </button>
          )}
        </div>
      </div>

      {skillSummary.length > 0 && (
        <section className="mb-4 border-[1.5px] border-grey-200 rounded-xl px-4 py-3" data-testid="skill-summary">
          <div className="text-[11px] font-bold text-grey-300 uppercase tracking-wide mb-2">Skill progress (graded problems)</div>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {skillSummary.map((k) => (
              <li key={k.code}>
                <button
                  type="button"
                  onClick={() => pickSkill(k.code)}
                  aria-pressed={filters.skill === k.code}
                  className={"w-full text-left text-[12.5px] rounded-lg px-3 py-1.5 border-[1.5px] " + (filters.skill === k.code ? "border-ink bg-grey-100" : "border-grey-100")}
                >
                  <span className="text-grey-500">{domainShort(k.domain)} › </span>
                  <span className="font-bold text-ink">{k.label}</span>
                  <span className="float-right">
                    <b className="text-green">{k.correct}</b> / {k.graded}
                    {k.total > k.graded && <span className="text-grey-500"> (+{k.total - k.graded} pending)</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {filtered.length === 0 ? (
        <div className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center" data-testid="notebook-empty">
          {entries.length === 0 || (filters.folder === "all" && !hasCategoryFilter(filters) && filters.source === "all")
            ? EMPTY_TEXT[filters.view]
            : filters.folder !== "all" && filters.folder !== "unfiled" && !hasCategoryFilter(filters) && filters.source === "all" && filters.view === "all"
              ? "This folder is empty. Open a problem and use “Folder” to move it here."
              : "No problems match these filters."}
        </div>
      ) : (
        <ul className="border-[1.5px] border-grey-200 rounded-xl divide-y divide-grey-100">
          {filtered.map((e) => {
            const open = openId === e.workId;
            const snippet = stripInlineOptions(e.passage, e.options).replace(/\s+/g, " ");
            const folder = folders.find((f) => f.id === assignments[e.workId]);
            return (
              <li key={e.workId} className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : e.workId)}
                  aria-expanded={open}
                  className="w-full text-left flex flex-wrap items-center gap-2"
                >
                  <span className="text-[10.5px] font-bold text-grey-500 border border-grey-200 rounded-full px-1.5 py-0.5">{FORMAT_LABEL[e.format]}</span>
                  <span className="text-[10.5px] font-bold text-grey-500 border border-grey-200 rounded-full px-1.5 py-0.5">
                    {e.source === "homework" ? "Assignment" : e.source === "mock_exam" ? "Practice Test" : "Lesson"}
                  </span>
                  <GradeBadge entry={e} />
                  {e.skillCode && (
                    <span className="text-[10.5px] font-bold text-grey-500 border border-grey-200 rounded-full px-1.5 py-0.5" title={domainLabel(e.satDomain) ?? undefined}>
                      {domainShort(e.satDomain)} › {skillLabel(e.skillCode)}
                    </span>
                  )}
                  {folder && <span className="text-[10.5px] font-bold text-navy bg-grey-100 rounded-full px-1.5 py-0.5">{folder.name}</span>}
                  <span className="text-[13px] text-ink flex-1 min-w-[200px] truncate">{snippet || "(No text)"}</span>
                  <span className="text-[11.5px] text-grey-500 shrink-0">
                    {isFreeMember
                      ? ["Practice Test", e.unitTitle, e.startsAt ? fmtDate(e.startsAt, { month: "short", day: "numeric", year: "numeric" }, tz) : null].filter(Boolean).join(" · ")
                      : [e.subjectName, e.unitTitle, e.startsAt ? fmtDate(e.startsAt, undefined, tz) : null].filter(Boolean).join(" · ")}
                  </span>
                </button>
                {open && (
                  <>
                    <label className="mt-3 flex items-center gap-2 text-[12px] text-grey-500">
                      <span className="font-bold">Folder</span>
                      <select
                        value={assignments[e.workId] ?? ""}
                        disabled={!nb}
                        onChange={(ev) => void moveProblem(e.workId, ev.target.value || null)}
                        aria-label="Move to folder"
                        className="rounded-lg border-[1.5px] border-grey-200 bg-white px-2 py-1 text-[12.5px] text-ink"
                      >
                        <option value="">Unfiled</option>
                        {folders.map((f) => (
                          <option key={f.id} value={f.id}>{f.name}</option>
                        ))}
                      </select>
                    </label>
                    <HistoryDetail entry={e} isFreeMember={isFreeMember} />
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function FilterSelect({ label, value, placeholder, options, onChange, disabled }: { label: string; value: string; placeholder: string; options: { value: string; label: string }[]; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <select
      aria-label={label}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className="max-w-[190px] rounded-lg border-[1.5px] border-grey-200 bg-white px-2 py-1 text-[12px] font-bold text-ink disabled:opacity-50"
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

type FolderBarProps = {
  state: NotebookState | null;
  error: string | null;
  onRetry: () => void;
  selection: FolderSelection;
  onSelect: (f: FolderSelection) => void;
  counts: ReturnType<typeof folderCounts>;
  onCreate: (name: string) => Promise<string | null>;
  onRename: (id: string, name: string) => Promise<string | null>;
  onDelete: (id: string) => Promise<string | null>;
};

function FolderBar({ state, error, onRetry, selection, onSelect, counts, onCreate, onRename, onDelete }: FolderBarProps) {
  const [mode, setMode] = useState<"idle" | "create" | "rename" | "delete">("idle");
  const [draft, setDraft] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const selected = state?.folders.find((f) => f.id === selection) ?? null;

  if (error) {
    return (
      <div className="mb-3 flex items-center gap-2 text-[12.5px] text-red" role="alert">
        {error}
        <button type="button" onClick={onRetry} className="font-bold underline">Retry</button>
      </div>
    );
  }
  if (!state) {
    return <div role="status" aria-label="Loading folders" data-testid="folders-skeleton" className="mb-3 flex gap-2 animate-pulse">{[56, 72, 96, 80].map((w) => <div key={w} className="h-7 rounded-lg bg-grey-100" style={{ width: w }} />)}</div>;
  }

  function reset() { setMode("idle"); setDraft(""); setErr(null); }
  async function submit() {
    setBusy(true);
    const message = mode === "create" ? await onCreate(draft) : mode === "rename" && selected ? await onRename(selected.id, draft) : null;
    setBusy(false);
    if (message) setErr(message); else reset();
  }
  async function confirmDelete() {
    if (!selected) return;
    setBusy(true);
    const message = await onDelete(selected.id);
    setBusy(false);
    if (message) setErr(message); else reset();
  }
  const chip = (active: boolean) => "text-[12px] font-bold px-2.5 py-1 rounded-lg border-[1.5px] " + (active ? "border-ink bg-ink text-white" : "border-grey-200 text-ink");

  return (
    <div className="mb-3" data-testid="folder-bar">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-bold text-grey-400 uppercase">Folder</span>
        <button type="button" aria-pressed={selection === "all"} onClick={() => onSelect("all")} className={chip(selection === "all")}>All ({counts.all})</button>
        <button type="button" aria-pressed={selection === "unfiled"} onClick={() => onSelect("unfiled")} className={chip(selection === "unfiled")}>Unfiled ({counts.unfiled})</button>
        {state.folders.map((f) => (
          <button key={f.id} type="button" aria-pressed={selection === f.id} onClick={() => onSelect(f.id)} className={chip(selection === f.id)}>
            {f.name} ({counts.byFolder[f.id] ?? 0})
          </button>
        ))}
        {mode === "idle" && (
          <button type="button" onClick={() => { setMode("create"); setDraft(""); setErr(null); }} className="text-[12px] font-bold px-2.5 py-1 rounded-lg border-[1.5px] border-dashed border-grey-300 text-grey-500">
            + New folder
          </button>
        )}
      </div>
      {mode === "idle" && selected && !selected.isDefault && (
        <div className="mt-2 flex items-center gap-3 text-[12px]">
          <button type="button" onClick={() => { setMode("rename"); setDraft(selected.name); setErr(null); }} className="font-bold text-grey-500 underline">Rename</button>
          <button type="button" onClick={() => { setMode("delete"); setErr(null); }} className="font-bold text-red underline">Delete folder</button>
        </div>
      )}
      {(mode === "create" || mode === "rename") && (
        <form className="mt-2 flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
          <input
            autoFocus
            value={draft}
            maxLength={40}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Escape") reset(); }}
            aria-label={mode === "create" ? "New folder name" : "Folder name"}
            placeholder="Folder name"
            className="rounded-lg border-[1.5px] border-grey-200 px-2.5 py-1 text-[13px]"
          />
          <button type="submit" disabled={busy || !draft.trim()} className="text-[12px] font-bold px-3 py-1 rounded-lg bg-ink text-white disabled:opacity-50">{mode === "create" ? "Create" : "Save"}</button>
          <button type="button" onClick={reset} className="text-[12px] font-semibold text-grey-500">Cancel</button>
        </form>
      )}
      {mode === "delete" && selected && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[12.5px]" role="alertdialog" aria-label="Delete folder">
          <span>Delete “{selected.name}”? Its {counts.byFolder[selected.id] ?? 0} problems stay in your notebook as Unfiled.</span>
          <button type="button" onClick={() => void confirmDelete()} disabled={busy} className="font-bold px-3 py-1 rounded-lg bg-red text-white disabled:opacity-50">Delete folder</button>
          <button type="button" onClick={reset} className="font-semibold text-grey-500">Cancel</button>
        </div>
      )}
      {err && <p role="alert" className="mt-1 text-[12.5px] text-red">{err}</p>}
    </div>
  );
}

function Chips({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-grey-500 mr-1 w-[36px]">{label}</span>
      {options.map(([v, text]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          aria-pressed={value === v}
          className={"px-3 py-1 rounded-full border-[1.5px] text-[12px] font-bold " + (value === v ? "bg-ink text-white border-ink" : "border-grey-200 text-ink")}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

function GradeBadge({ entry }: { entry: ProblemHistoryEntry }) {
  if (!entry.graded) return <span className="text-[11px] font-bold text-grey-500">Pending</span>;
  if (!entry.grade) return <span className="text-[11px] font-bold text-green">Graded</span>;
  const cls = entry.grade === "correct" ? "text-green" : entry.grade === "partial" ? "text-amber-600" : "text-red";
  return <span className={"text-[11px] font-bold " + cls}>{GRADE_LABEL[entry.grade]}</span>;
}

function HistoryDetail({ entry: e, isFreeMember }: { entry: ProblemHistoryEntry; isFreeMember: boolean }) {
  return (
    <div className="mt-3 rounded-lg bg-grey-100 px-4 py-3" data-testid="history-detail">
      <ProblemFigure spec={e.figure} text={problemText(e.passage, e.options)} className="mb-2" />
      <LearningText text={stripInlineOptions(e.passage, e.options) || "(No text)"} className="learning-body text-[13.5px] leading-[1.75] text-ink" />
      {e.format === "mc" && e.options.length > 0 && (
        <ol className="mt-2 space-y-1">
          {e.options.map((o, i) => {
            const mine = e.myChoice === i;
            const correct = e.correctIndex === i;
            return (
              <li
                key={i}
                className={
                  "flex gap-2 text-[13px] rounded px-2 py-1 " +
                  (correct ? "bg-green/10 text-green font-bold" : mine ? (e.graded ? "bg-red/10 text-red" : "bg-white text-ink font-bold") : "text-ink")
                }
              >
                <span className="font-bold shrink-0">{OPTION_LABELS[i] ?? i + 1}</span>
                <LearningText text={o} className="learning-body" />
                {mine && <span className="ml-auto text-[11px] shrink-0">My answer</span>}
                {correct && !mine && <span className="ml-auto text-[11px] shrink-0">Correct</span>}
              </li>
            );
          })}
        </ol>
      )}
      {(e.format === "spr" || e.format === "essay") && (
        <p className="mt-2 text-[13px] text-ink whitespace-pre-wrap">
          <span className="font-bold">My answer: </span>
          {e.myText?.trim() || "None"}
          {e.acceptedAnswers && e.acceptedAnswers.length > 0 && (
            <>
              {" "}
              <span className="font-bold text-green">· Answer: {e.acceptedAnswers.join(" or ")}</span>
            </>
          )}
        </p>
      )}
      {e.format === "math" && <p className="mt-2 text-[12.5px] text-grey-500">You can view your work on the whiteboard in the Problems tab of that lesson.</p>}
      {e.graded && (
        <div className="mt-2 text-[12.5px] text-ink">
          <span className="font-bold">{isFreeMember ? "Result: " : "Teacher's grade: "}</span>
          {e.grade ? GRADE_LABEL[e.grade] : "Graded"}
          {e.gradeComment && <span className="text-grey-500"> · “{e.gradeComment}”</span>}
        </div>
      )}
      {e.explanation && (
        <div className="mt-2">
          <div className="text-[10.5px] font-bold text-grey-300 uppercase tracking-wide mb-1">Explanation</div>
          <LearningText text={e.explanation} className="learning-body text-[13px] leading-[1.7] text-ink" />
        </div>
      )}
      {!e.graded && !isFreeMember && <p className="mt-2 text-[12px] text-grey-500">The answer and explanation will appear here once your teacher grades it.</p>}
    </div>
  );
}
