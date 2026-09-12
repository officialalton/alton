"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import { createCurriculumDoc, getCurriculumDocDetailAction } from "./curriculum-doc-actions";
import CurriculumDocEditor from "./CurriculumDocEditor";
import type { DocEditorData, CurriculumDocListItem } from "./curriculum-doc-data";
import { selectableSubjects, type AdminSubject } from "./subject-data";

const STATUS_LABEL: Record<string, string> = {
  draft: "초안",
  pending_approval: "승인 대기",
  published: "배포됨",
  rejected: "반려됨",
};

// 2026-09-10(P1 성능 배치) — 목록 첫 진입은 이미 경량(loadCurriculumDocList,
// 본문·문제 미포함)이라 빠르다. 목록 자체가 계속 누적돼도 화면이 무거워지지
// 않도록, 표시 개수만 클라이언트에서 페이지네이션한다(데이터 자체는 이미
// 가벼워서 서버 쪽 limit 없이도 안전 — 과목/단원 드릴다운(MaterialsLibraryTab)이
// 전체 목록을 필요로 하므로 서버 쿼리 자체는 제한하지 않는다).
const PAGE_SIZE = 20;

export default function CurriculumDocsTab({
  docs,
  setDocs,
  subjects,
}: {
  docs: CurriculumDocListItem[];
  setDocs: Dispatch<SetStateAction<CurriculumDocListItem[]>>;
  subjects: AdminSubject[];
}) {
  const [openDocId, setOpenDocId] = useState<string | null>(null);
  // 2026-09-10(P1 성능 배치) — 문서를 실제로 열 때만 섹션·문제·키워드 전체를
  // 조회한다. 한 번 연 문서는 이 캐시에 남아 다시 열 때 재조회하지 않는다
  // (같은 세션 안에서만 — 페이지를 새로고침하면 사라짐, 장기 캐시 아님).
  const [detailCache, setDetailCache] = useState<Record<string, DocEditorData>>({});
  const [loadingDetailId, setLoadingDetailId] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const open = openDocId ? (detailCache[openDocId] ?? null) : null;

  async function openDoc(docId: string) {
    setOpenDocId(docId);
    if (detailCache[docId]) return;
    setLoadingDetailId(docId);
    setDetailError(null);
    try {
      const detail = await getCurriculumDocDetailAction(docId);
      if (!detail) {
        setDetailError("문서를 찾을 수 없습니다.");
        setOpenDocId(null);
        return;
      }
      setDetailCache((prev) => ({ ...prev, [docId]: detail }));
    } catch (e) {
      setDetailError(e instanceof Error ? e.message : "문서를 불러오지 못했습니다.");
      setOpenDocId(null);
    } finally {
      setLoadingDetailId(null);
    }
  }

  function updateListItemFromDetail(updated: DocEditorData) {
    setDocs((prev) =>
      prev.map((d) =>
        d.id === updated.id
          ? {
              ...d,
              title: updated.title,
              status: updated.status,
              subjectId: updated.subjectId,
              subjectName: updated.subjectName,
              unitId: updated.unitId,
              unitTitle: updated.unitTitle,
              sectionCount: updated.sections.length,
            }
          : d
      )
    );
  }

  function handleDocChanged(updated: DocEditorData) {
    setDetailCache((prev) => ({ ...prev, [updated.id]: updated }));
    updateListItemFromDetail(updated);
  }

  function handleBackFromEditor(updated: DocEditorData) {
    handleDocChanged(updated);
    setOpenDocId(null);
  }

  function handleDocDeleted(docId: string) {
    setDocs((prev) => prev.filter((d) => d.id !== docId));
    setDetailCache((prev) => {
      const next = { ...prev };
      delete next[docId];
      return next;
    });
    setOpenDocId(null);
  }

  function handleCreated(doc: DocEditorData) {
    setDocs((prev) =>
      [
        ...prev,
        {
          id: doc.id,
          title: doc.title,
          subjectId: doc.subjectId,
          subjectName: doc.subjectName,
          unitId: doc.unitId,
          unitTitle: doc.unitTitle,
          status: doc.status,
          sectionCount: doc.sections.length,
        },
      ].sort((a, b) => a.title.localeCompare(b.title))
    );
    setDetailCache((prev) => ({ ...prev, [doc.id]: doc }));
    setCreating(false);
    setOpenDocId(doc.id);
  }

  if (openDocId && loadingDetailId === openDocId) {
    return (
      <div className="max-w-[640px] px-8 py-8" data-testid="curriculum-doc-detail-skeleton">
        <div className="h-5 w-48 bg-grey-200 rounded animate-pulse mb-4" />
        <div className="space-y-2.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 border-[1.5px] border-grey-100 rounded-xl bg-grey-100 animate-pulse" />
          ))}
        </div>
      </div>
    );
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

  const visibleDocs = docs.slice(0, visibleCount);

  return (
    <div className="max-w-[640px] px-8 py-8">
      <h1 className="text-[20px] font-extrabold text-ink mb-1.5">교재 문서</h1>
      <p className="text-[13px] text-grey-500 mb-5">
        목차(섹션)와 본문을 작성하고, 배포하면 학생·선생님이 열람할 수 있습니다.
      </p>
      {detailError && <p className="text-[12.5px] text-red mb-3">{detailError}</p>}

      {docs.length === 0 ? (
        <div className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center mb-3">
          아직 만든 교재가 없습니다.
        </div>
      ) : (
        <>
          {visibleDocs.map((d) => (
            <div
              key={d.id}
              className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-2.5 flex items-center justify-between"
            >
              <div>
                <div className="text-[13.5px] font-bold text-ink">{d.title}</div>
                <div className="text-[12px] text-grey-500 mt-0.5">
                  {d.subjectName}
                  {d.unitTitle ? ` · ${d.unitTitle}` : ""} · 섹션 {d.sectionCount}개 ·{" "}
                  {STATUS_LABEL[d.status] ?? d.status}
                </div>
              </div>
              <button
                onClick={() => openDoc(d.id)}
                className="text-[12px] font-bold px-3.5 py-2 rounded-lg border-[1.5px] border-grey-200 text-ink shrink-0"
              >
                편집
              </button>
            </div>
          ))}
          {visibleCount < docs.length && (
            <button
              onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}
              className="text-[12.5px] font-semibold text-ink underline w-full text-center mb-2.5"
            >
              더 보기({docs.length - visibleCount}개 남음)
            </button>
          )}
        </>
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
          {/* 2026-09-09(UAT 지적, 제품 오너 승인): 보관된 과목은 새 교재의
              연결 후보에서 제외한다. */}
          {selectableSubjects(subjects).map((s) => (
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
