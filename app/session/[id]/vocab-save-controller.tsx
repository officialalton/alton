"use client";

import { useEffect, useState } from "react";
import { createSessionVocabFolder, loadSessionVocabFolders, type SessionVocabFolder } from "./vocab-actions";

const NEW_FOLDER = "__new__";

// 2026-09-22(사용자 지시) — 단어 저장 on/off·폴더 선택 상태를 VocabClickLayer 밖으로 뽑아냈다.
// PDF 자료 화면에서는 이 컨트롤이 "필기 시작" 버튼 옆(PdfPageAnnotationLayer의 툴바 안)에
// 있어야 하는데, 그 툴바는 VocabClickLayer가 감싸는 자식(AssetMaterialViewer) 안 깊숙이
// 있어 VocabClickLayer 자신은 그 자리에 아무것도 그릴 수 없다 — 상태만 여기서 관리하고,
// 그리는 자리는 호출하는 쪽(MaterialTab)이 정한다.
export type VocabSaveController = {
  saveMode: boolean;
  setSaveMode: (fn: (prev: boolean) => boolean) => void;
  folders: SessionVocabFolder[] | null;
  folderId: string | null;
  addingFolder: boolean;
  newFolderName: string;
  setNewFolderName: (v: string) => void;
  onFolderSelect: (value: string) => void;
  confirmNewFolder: () => Promise<void>;
};

export function useVocabSaveController(studentId: string): VocabSaveController {
  const [saveMode, setSaveMode] = useState(false);
  const [folders, setFolders] = useState<SessionVocabFolder[] | null>(null);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [addingFolder, setAddingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  useEffect(() => {
    if (!saveMode || folders) return;
    loadSessionVocabFolders(studentId).then((f) => {
      setFolders(f);
      setFolderId(f.find((x) => x.isDefault)?.id ?? f[0]?.id ?? null);
    });
  }, [saveMode, folders, studentId]);

  function onFolderSelect(value: string) {
    if (value === NEW_FOLDER) {
      setAddingFolder(true);
      return;
    }
    setFolderId(value || null);
  }

  async function confirmNewFolder() {
    const name = newFolderName.trim();
    if (!name) return;
    const folder = await createSessionVocabFolder(studentId, name);
    setFolders((prev) => [...(prev ?? []), folder]);
    setFolderId(folder.id);
    setAddingFolder(false);
    setNewFolderName("");
  }

  return { saveMode, setSaveMode, folders, folderId, addingFolder, newFolderName, setNewFolderName, onFolderSelect, confirmNewFolder };
}

/** 어디서든 배치할 수 있는 단어 저장 on/off + 폴더 선택 컨트롤 한 벌. */
export function VocabSaveToggleBar({ controller }: { controller: VocabSaveController }) {
  const { saveMode, setSaveMode, folders, folderId, addingFolder, newFolderName, setNewFolderName, onFolderSelect, confirmNewFolder } = controller;
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[11.5px]" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setSaveMode((v) => !v)}
        aria-pressed={saveMode}
        className={`rounded px-2 py-1 font-bold ${saveMode ? "bg-ink text-white" : "text-ink"}`}
      >
        {saveMode ? "📖 단어 저장 끄기" : "📖 단어 저장 켜기"}
      </button>
      {saveMode &&
        folders &&
        (addingFolder ? (
          <span className="flex items-center gap-1">
            <input
              autoFocus
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && confirmNewFolder()}
              placeholder="새 폴더 이름"
              className="rounded border border-grey-300 px-2 py-1 text-[11.5px]"
            />
            <button type="button" onClick={confirmNewFolder} className="font-bold text-ink underline">
              만들기
            </button>
          </span>
        ) : (
          <select
            value={folderId ?? ""}
            onChange={(e) => onFolderSelect(e.target.value)}
            className="rounded border border-grey-300 px-1.5 py-1 text-[11.5px]"
          >
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
            <option value={NEW_FOLDER}>+ 새 폴더</option>
          </select>
        ))}
    </div>
  );
}
