"use client";

import { useMemo, useState } from "react";
import {
  createKeywordFolder,
  createKeywordInFolder,
  deleteKeywordFolder,
  deleteSubjectKeyword,
  moveKeywordToFolder,
  renameKeywordFolder,
  reorderKeywordFolders,
  reorderKeywordsInFolder,
  type KeywordDictionaryResult,
} from "./keyword-folder-actions";
import { renameSubjectKeyword } from "./subject-actions";
import { buildKeywordSections, moveItem, OTHER_FOLDER_NAME } from "./keyword-dictionary";
import type { KeywordDictionary } from "./subject-data";

// 2026-10-08 — "과목 키워드 사전" 폴더 관리. 키워드는 id로 회차·교재·문제에 연결되어 있으므로
// 여기서 하는 모든 작업(이름·폴더·순서)은 연결을 바꾸지 않는다. 설계: docs/2026-10-08-keyword-folders-design.md
const ICON_BTN =
  "min-w-[28px] h-[28px] px-1.5 rounded-lg border-[1.5px] border-grey-200 text-[12px] font-bold text-ink disabled:opacity-40 focus-visible:outline focus-visible:outline-2";
const FIELD = "px-3 py-1.5 border-[1.5px] border-grey-200 rounded-lg text-[12.5px] bg-white";

export default function KeywordDictionaryManager({
  subjectId,
  initial,
  onChange,
}: {
  subjectId: string;
  initial: KeywordDictionary;
  onChange?: (dictionary: KeywordDictionary) => void;
}) {
  const [dict, setDict] = useState<KeywordDictionary>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [newKeyword, setNewKeyword] = useState("");
  const [newKeywordFolder, setNewKeywordFolder] = useState<string>("");
  const [addingFolder, setAddingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [folderNameDraft, setFolderNameDraft] = useState("");
  const [confirmDeleteFolderId, setConfirmDeleteFolderId] = useState<string | null>(null);
  const [selectedKeywordId, setSelectedKeywordId] = useState<string | null>(null);
  const [labelDraft, setLabelDraft] = useState("");
  const [confirmDeleteKeyword, setConfirmDeleteKeyword] = useState(false);

  const sections = useMemo(() => buildKeywordSections(dict.folders, dict.keywords, query), [dict, query]);
  const allSections = useMemo(() => buildKeywordSections(dict.folders, dict.keywords), [dict]);
  const selected = dict.keywords.find((k) => k.id === selectedKeywordId) ?? null;

  function apply(next: KeywordDictionary) {
    setDict(next);
    onChange?.(next);
  }

  async function run(action: () => Promise<KeywordDictionaryResult>, after?: () => void): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      const result = await action();
      if (!result.ok) {
        setError(result.error);
        return false;
      }
      apply(result.value);
      after?.();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장하지 못했습니다. 다시 시도해주세요.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  const folderCount = dict.folders.length;
  const keywordCount = dict.keywords.length;

  function toggleSection(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleAddKeyword() {
    const label = newKeyword.trim();
    if (!label) return;
    await run(() => createKeywordInFolder(subjectId, label, newKeywordFolder || null), () => setNewKeyword(""));
  }

  async function handleAddFolder() {
    const name = newFolderName.trim();
    if (!name) return;
    await run(() => createKeywordFolder(subjectId, name), () => {
      setNewFolderName("");
      setAddingFolder(false);
    });
  }

  async function handleRenameFolder(folderId: string) {
    const name = folderNameDraft.trim();
    const current = dict.folders.find((f) => f.id === folderId);
    if (!name || name === current?.name) {
      setRenamingFolderId(null);
      return;
    }
    await run(() => renameKeywordFolder(folderId, name), () => setRenamingFolderId(null));
  }

  async function handleRenameKeyword() {
    if (!selected) return;
    const label = labelDraft.trim();
    if (!label || label === selected.label) return;
    setBusy(true);
    setError(null);
    try {
      const result = await renameSubjectKeyword(selected.id, label);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      apply({ ...dict, keywords: dict.keywords.map((k) => (k.id === selected.id ? { ...k, label: result.value.label } : k)) });
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장하지 못했습니다. 다시 시도해주세요.");
    } finally {
      setBusy(false);
    }
  }

  function selectKeyword(id: string, label: string) {
    setSelectedKeywordId((cur) => (cur === id ? null : id));
    setLabelDraft(label);
    setConfirmDeleteKeyword(false);
    setError(null);
  }

  const folderOptions = (
    <>
      <option value="">{OTHER_FOLDER_NAME}</option>
      {dict.folders.map((f) => (
        <option key={f.id} value={f.id}>
          {f.name}
        </option>
      ))}
    </>
  );

  return (
    <section className="mb-6" aria-labelledby="keyword-dict-title" data-testid="keyword-dictionary">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h2 id="keyword-dict-title" className="text-[11px] font-bold text-grey-400 uppercase tracking-wide">
          과목 키워드 사전 <span className="normal-case text-grey-500 font-semibold">· 키워드 {keywordCount}개 · 폴더 {folderCount}개</span>
        </h2>
        <button type="button" onClick={() => setAddingFolder((v) => !v)} className={ICON_BTN} aria-expanded={addingFolder} disabled={busy}>
          폴더 추가
        </button>
      </div>

      {addingFolder && (
        <div className="flex gap-2 mb-3">
          <input
            autoFocus
            aria-label="새 폴더 이름"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleAddFolder();
              if (e.key === "Escape") setAddingFolder(false);
            }}
            placeholder="새 폴더 이름"
            className={FIELD + " flex-1 min-w-0"}
          />
          <button type="button" onClick={handleAddFolder} disabled={busy || !newFolderName.trim()} className="text-[12px] font-bold px-3.5 py-1.5 rounded-lg bg-ink text-white disabled:opacity-50">
            만들기
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-3">
        <input
          type="search"
          aria-label="키워드 검색"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="키워드 검색"
          className={FIELD + " flex-1 min-w-[140px]"}
        />
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        <input
          aria-label="새 키워드 이름"
          value={newKeyword}
          onChange={(e) => setNewKeyword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void handleAddKeyword();
          }}
          placeholder="새 키워드 (예: 이차방정식)"
          className={FIELD + " flex-1 min-w-[160px]"}
        />
        <select aria-label="새 키워드를 넣을 폴더" value={newKeywordFolder} onChange={(e) => setNewKeywordFolder(e.target.value)} className={FIELD}>
          {folderOptions}
        </select>
        <button type="button" onClick={handleAddKeyword} disabled={busy || !newKeyword.trim()} className="text-[12px] font-bold px-3.5 py-1.5 rounded-lg bg-ink text-white disabled:opacity-50">
          {busy ? "저장 중…" : "추가"}
        </button>
      </div>

      {error && (
        <p role="alert" className="text-[12px] text-red mb-2">
          {error}
        </p>
      )}

      {keywordCount === 0 && folderCount === 0 && (
        <p className="text-[12px] text-grey-500 border-[1.5px] border-dashed border-grey-200 rounded-xl px-4 py-5 text-center">
          아직 키워드가 없습니다. 위에서 키워드를 추가하거나 폴더를 먼저 만들어보세요.
        </p>
      )}
      {query.trim() && sections.length === 0 && keywordCount > 0 && <p className="text-[12px] text-grey-500 mb-2">“{query.trim()}”와 일치하는 키워드가 없습니다.</p>}

      <div className="flex flex-col gap-2" aria-busy={busy}>
        {sections.map((section) => {
          const key = section.folderId ?? "__other";
          const isOpen = !!query.trim() || !collapsed.has(key);
          const folderIndex = section.folderId ? dict.folders.findIndex((f) => f.id === section.folderId) : -1;
          const sortedFolderIds = allSections.filter((s) => s.folderId).map((s) => s.folderId as string);
          const sectionIdx = section.folderId ? sortedFolderIds.indexOf(section.folderId) : -1;
          const renaming = section.folderId !== null && renamingFolderId === section.folderId;
          return (
            <div key={key} className="border-[1.5px] border-grey-200 rounded-xl" data-testid={`keyword-folder-${key}`}>
              <div className="flex flex-wrap items-center gap-2 px-3 py-2">
                {renaming ? (
                  <input
                    autoFocus
                    aria-label={`${section.name} 폴더 이름 고치기`}
                    value={folderNameDraft}
                    onChange={(e) => setFolderNameDraft(e.target.value)}
                    onBlur={() => void handleRenameFolder(section.folderId as string)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void handleRenameFolder(section.folderId as string);
                      if (e.key === "Escape") setRenamingFolderId(null);
                    }}
                    className={FIELD + " flex-1 min-w-[120px] !py-1"}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => toggleSection(key)}
                    aria-expanded={isOpen}
                    className="flex-1 min-w-[120px] text-left text-[12.5px] font-bold text-ink focus-visible:outline focus-visible:outline-2 rounded"
                  >
                    <span aria-hidden="true" className="inline-block w-4 text-grey-400">
                      {isOpen ? "▾" : "▸"}
                    </span>
                    {section.name}
                    <span className="ml-1.5 font-semibold text-grey-500">
                      ({query.trim() ? `${section.keywords.length}/${section.total}` : section.total})
                    </span>
                  </button>
                )}
                {section.folderId && !renaming && (
                  <div className="flex items-center gap-1">
                    <button type="button" className={ICON_BTN} aria-label={`${section.name} 폴더를 위로`} disabled={busy || sectionIdx <= 0}
                      onClick={() => void run(() => reorderKeywordFolders(subjectId, moveItem(sortedFolderIds, sectionIdx, -1)))}>↑</button>
                    <button type="button" className={ICON_BTN} aria-label={`${section.name} 폴더를 아래로`} disabled={busy || sectionIdx < 0 || sectionIdx >= sortedFolderIds.length - 1}
                      onClick={() => void run(() => reorderKeywordFolders(subjectId, moveItem(sortedFolderIds, sectionIdx, 1)))}>↓</button>
                    <button type="button" className={ICON_BTN} aria-label={`${section.name} 폴더 이름 바꾸기`} disabled={busy}
                      onClick={() => { setRenamingFolderId(section.folderId); setFolderNameDraft(section.name); setError(null); }}>이름</button>
                    <button type="button" className={ICON_BTN + " text-red"} aria-label={`${section.name} 폴더 삭제`} disabled={busy || folderIndex < 0}
                      onClick={() => setConfirmDeleteFolderId(section.folderId)}>삭제</button>
                  </div>
                )}
              </div>

              {confirmDeleteFolderId === section.folderId && section.folderId && (
                <div role="alertdialog" aria-label="폴더 삭제 확인" className="mx-3 mb-2 text-[12px] bg-red/5 border-[1.5px] border-red/30 rounded-lg px-3 py-2">
                  <p className="text-ink mb-2">
                    “{section.name}” 폴더를 삭제할까요? 안의 키워드 {section.total}개는 삭제되지 않고 “{OTHER_FOLDER_NAME}”로 이동하며, 회차 연결은 그대로입니다.
                  </p>
                  <div className="flex gap-2">
                    <button type="button" disabled={busy} className="text-[11.5px] font-bold px-3 py-1.5 rounded-lg bg-red text-white disabled:opacity-50"
                      onClick={() => void run(() => deleteKeywordFolder(section.folderId as string), () => setConfirmDeleteFolderId(null))}>
                      폴더 삭제
                    </button>
                    <button type="button" className="text-[11.5px] font-semibold text-grey-500" onClick={() => setConfirmDeleteFolderId(null)}>
                      취소
                    </button>
                  </div>
                </div>
              )}

              {isOpen && (
                <div className="px-3 pb-3">
                  {section.keywords.length === 0 ? (
                    <p className="text-[12px] text-grey-500">이 폴더는 비어 있습니다. 키워드를 추가하거나 다른 폴더에서 옮겨오세요.</p>
                  ) : (
                    <ul className="flex flex-wrap gap-1.5" aria-label={`${section.name} 키워드`}>
                      {section.keywords.map((k) => (
                        <li key={k.id}>
                          <button
                            type="button"
                            onClick={() => selectKeyword(k.id, k.label)}
                            aria-pressed={selectedKeywordId === k.id}
                            className={
                              "text-[11.5px] font-semibold px-2.5 py-1 rounded-full focus-visible:outline focus-visible:outline-2 " +
                              (selectedKeywordId === k.id ? "bg-ink text-white" : "bg-grey-100 text-ink")
                            }
                          >
                            {k.label}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}

                  {selected && section.keywords.some((k) => k.id === selected.id) && (
                    <div className="mt-2.5 border-[1.5px] border-grey-200 rounded-lg px-3 py-2.5 bg-grey-50" data-testid="keyword-editor">
                      <div className="flex flex-wrap gap-2 mb-2">
                        <input
                          aria-label="키워드 이름"
                          value={labelDraft}
                          onChange={(e) => setLabelDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") void handleRenameKeyword();
                            if (e.key === "Escape") setSelectedKeywordId(null);
                          }}
                          className={FIELD + " flex-1 min-w-[140px] !py-1"}
                        />
                        <button type="button" disabled={busy || !labelDraft.trim() || labelDraft.trim() === selected.label} onClick={handleRenameKeyword}
                          className="text-[11.5px] font-bold px-3 py-1.5 rounded-lg bg-ink text-white disabled:opacity-50">이름 저장</button>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="text-[11.5px] text-grey-500 flex items-center gap-1.5">
                          폴더
                          <select aria-label="키워드 폴더 이동" value={selected.folderId ?? ""} disabled={busy}
                            onChange={(e) => void run(() => moveKeywordToFolder(selected.id, e.target.value || null))}
                            className={FIELD + " !py-1"}>
                            {folderOptions}
                          </select>
                        </label>
                        {(() => {
                          const ids = (allSections.find((s) => s.folderId === (selected.folderId ?? null))?.keywords ?? []).map((k) => k.id);
                          const i = ids.indexOf(selected.id);
                          return (
                            <>
                              <button type="button" className={ICON_BTN} aria-label="키워드를 앞으로" disabled={busy || i <= 0 || !!query.trim()}
                                onClick={() => void run(() => reorderKeywordsInFolder(subjectId, moveItem(ids, i, -1)))}>←</button>
                              <button type="button" className={ICON_BTN} aria-label="키워드를 뒤로" disabled={busy || i < 0 || i >= ids.length - 1 || !!query.trim()}
                                onClick={() => void run(() => reorderKeywordsInFolder(subjectId, moveItem(ids, i, 1)))}>→</button>
                            </>
                          );
                        })()}
                        {!confirmDeleteKeyword ? (
                          <button type="button" className={ICON_BTN + " text-red ml-auto"} disabled={busy} onClick={() => setConfirmDeleteKeyword(true)}>키워드 삭제</button>
                        ) : (
                          <span className="ml-auto flex items-center gap-2 text-[11.5px]">
                            <span className="text-ink">정말 삭제할까요?</span>
                            <button type="button" disabled={busy} className="font-bold px-2.5 py-1 rounded-lg bg-red text-white disabled:opacity-50"
                              onClick={() => void run(() => deleteSubjectKeyword(selected.id), () => { setSelectedKeywordId(null); setConfirmDeleteKeyword(false); })}>
                              삭제
                            </button>
                            <button type="button" className="font-semibold text-grey-500" onClick={() => setConfirmDeleteKeyword(false)}>취소</button>
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
