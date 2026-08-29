"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import { createCurriculumDoc } from "./curriculum-doc-actions";
import CurriculumDocEditor from "./CurriculumDocEditor";
import type { DocEditorData } from "./curriculum-doc-data";
import type { AdminSubject } from "./subject-data";

const STATUS_LABEL: Record<string, string> = {
  draft: "초안",
  pending_approval: "승인 대기",
  published: "배포됨",
  rejected: "반려됨",
};

export default function CurriculumDocsTab({
  docs,
  setDocs,
  subjects,
}: {
  docs: DocEditorData[];
  setDocs: Dispatch<SetStateAction<DocEditorData[]>>;
  subjects: AdminSubject[];
}) {
  const [openDocId, setOpenDocId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const open = docs.find((d) => d.id === openDocId);

  function handleDocChanged(updated: DocEditorData) {
    setDocs((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
  }

  function handleBackFromEditor(updated: DocEditorData) {
    handleDocChanged(updated);
    setOpenDocId(null);
  }

  function handleDocDeleted(docId: string) {
    setDocs((prev) => prev.filter((d) => d.id !== docId));
    setOpenDocId(null);
  }

  function handleCreated(doc: DocEditorData) {
    setDocs((prev) => [...prev, doc].sort((a, b) => a.title.localeCompare(b.title)));
    setCreating(false);
    setOpenDocId(doc.id);
  }

  if (open) {
    return (
      <CurriculumDocEditor
        doc={open}
        onBack={handleBackFromEditor}
        onDeleted={handleDocDeleted}
        onDocChange={handleDocChanged}
      />
    );
  }

  if (creating) {
    return (
      <NewDocForm
        subjects={subjects}
        onCreated={handleCreated}
        onCancel={() => setCreating(false)}
      />
    );
  }

  return (
    <div className="max-w-[640px] px-8 py-8">
      <h1 className="text-[20px] font-extrabold text-ink mb-1.5">교재 문서</h1>
      <p className="text-[13px] text-grey-500 mb-5">
        목차(섹션)와 본문을 작성하고, 배포하면 학생·선생님이 열람할 수 있습니다.
      </p>

      {docs.length === 0 ? (
        <div className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center mb-3">
          아직 만든 교재가 없습니다.
        </div>
      ) : (
        docs.map((d) => (
          <div
            key={d.id}
            className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-2.5 flex items-center justify-between"
          >
            <div>
              <div className="text-[13.5px] font-bold text-ink">{d.title}</div>
              <div className="text-[12px] text-grey-500 mt-0.5">
                {d.subjectName}
                {d.unitTitle ? ` · ${d.unitTitle}` : ""} · 섹션 {d.sections.length}개 ·{" "}
                {STATUS_LABEL[d.status] ?? d.status}
              </div>
            </div>
            <button
              onClick={() => setOpenDocId(d.id)}
              className="text-[12px] font-bold px-3.5 py-2 rounded-lg border-[1.5px] border-grey-200 text-ink shrink-0"
            >
              편집
            </button>
          </div>
        ))
      )}

      <button
        onClick={() => setCreating(true)}
        className="text-[12.5px] font-bold px-4 py-2.5 rounded-lg border-[1.5px] border-grey-200 text-ink w-full mt-2"
      >
        + 새 교재 만들기
      </button>
    </div>
  );
}

function NewDocForm({
  subjects,
  onCreated,
  onCancel,
}: {
  subjects: AdminSubject[];
  onCreated: (doc: DocEditorData) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [unitId, setUnitId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const selectedSubject = subjects.find((s) => s.subjectId === subjectId);

  async function handleCreate() {
    if (!title.trim() || !subjectId || creating) return;
    setCreating(true);
    try {
      const { id } = await createCurriculumDoc({ title: title.trim(), subjectId, unitId });
      onCreated({
        id,
        title: title.trim(),
        subjectId,
        subjectName: selectedSubject?.subjectName ?? "",
        unitId,
        unitTitle: selectedSubject?.units.find((u) => u.id === unitId)?.unitTitle ?? null,
        status: "draft",
        sections: [],
      });
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="max-w-[640px] px-8 py-8">
      <h1 className="text-[20px] font-extrabold text-ink mb-5">새 교재 만들기</h1>

      <div className="mb-4">
        <label className="text-[12.5px] font-bold text-ink mb-1.5 block">제목</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="예: 이차방정식 개념 정리"
          className="w-full px-3 py-2 border-[1.5px] border-grey-200 rounded-lg text-[13px]"
        />
      </div>

      <div className="mb-4">
        <label className="text-[12.5px] font-bold text-ink mb-1.5 block">과목</label>
        <div className="flex flex-wrap gap-2">
          {subjects.map((s) => (
            <button
              key={s.subjectId}
              onClick={() => {
                setSubjectId(s.subjectId);
                setUnitId(null);
              }}
              className={
                "text-[12.5px] font-semibold px-3 py-1.5 rounded-full border-[1.5px] " +
                (subjectId === s.subjectId
                  ? "bg-ink text-white border-ink"
                  : "border-grey-200 text-ink")
              }
            >
              {s.subjectName}
            </button>
          ))}
        </div>
      </div>

      {selectedSubject && (
        <div className="mb-4">
          <label className="text-[12.5px] font-bold text-ink mb-1.5 block">
            단원 (선택)
          </label>
          {selectedSubject.units.length === 0 ? (
            <p className="text-[12.5px] text-grey-500">
              이 과목엔 아직 회차가 없습니다. 과목 템플릿 탭에서 먼저 회차를 추가해주세요.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {selectedSubject.units.map((u) => (
                <button
                  key={u.id}
                  onClick={() => setUnitId(unitId === u.id ? null : u.id)}
                  className={
                    "text-[12px] font-semibold px-3 py-1.5 rounded-full border-[1.5px] " +
                    (unitId === u.id
                      ? "bg-ink text-white border-ink"
                      : "border-grey-200 text-ink")
                  }
                >
                  {u.position}회차 · {u.unitTitle}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex gap-3 mt-6">
        <button
          disabled={!title.trim() || !subjectId || creating}
          onClick={handleCreate}
          className="text-[13px] font-bold px-4 py-2.5 rounded-lg bg-ink text-white disabled:opacity-50"
        >
          {creating ? "만드는 중..." : "만들기"}
        </button>
        <button onClick={onCancel} className="text-[13px] font-semibold text-grey-500">
          취소
        </button>
      </div>
    </div>
  );
}
