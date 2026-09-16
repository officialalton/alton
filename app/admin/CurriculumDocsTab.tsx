"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import {
  getCurriculumDocDetailAction,
  setDocArchived,
  updateDocTitle,
} from "./curriculum-doc-actions";
import CurriculumDocEditor from "./CurriculumDocEditor";
import type { DocEditorData, CurriculumDocListItem } from "./curriculum-doc-data";
import { publishAssetDocAction } from "./curriculum-asset-actions";
import type { AdminSubject } from "./subject-data";

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
  // P2 2차 — 대표 키워드 미지정 교재를 찾아 지정할 수 있어야 한다. 임의 백필을
  // 하지 않았으므로 기존 교재는 전부 미지정이고, 관리자가 하나씩 정한다.
  const [onlyMissingPrimary, setOnlyMissingPrimary] = useState(false);
  // 보관됨과 현재는 섞지 않는다. 기본 진입은 현재이고 검색도 그 안에서 돈다.
  const [showArchived, setShowArchived] = useState(false);
  const [query, setQuery] = useState("");
  // 2026-09-14 — 라이브러리 탭을 여기로 합쳤다. 키워드별(기본) / 단원별 / 목록.
  const [viewMode, setViewMode] = useState<"keyword" | "unit" | "list">("keyword");
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [assetNotice, setAssetNotice] = useState<string | null>(null);
  const [publishingAssetId, setPublishingAssetId] = useState<string | null>(null);

  // 파일 자료(PDF·영상)의 공개 — 원본을 지금 내려받아 고정 사본을 만든다. 편집 화면은
  // 본문 섹션용이라 파일 자료에는 열지 않는다.
  async function publishAsset(doc: CurriculumDocListItem) {
    setAssetNotice(null);
    setPublishingAssetId(doc.id);
    try {
      const result = await publishAssetDocAction(doc.id);
      if (!result.ok) {
        setAssetNotice(`공개하지 않았습니다 — ${result.error}`);
        return;
      }
      setDocs((prev) => prev.map((d) => (d.id === doc.id ? { ...d, status: "published" } : d)));
      setAssetNotice(
        `공개했습니다 — 고정 사본 ${Math.round(result.bytes / 1024)}KB` +
          (result.pageCount ? ` · ${result.pageCount}쪽` : "")
      );
    } finally {
      setPublishingAssetId(null);
    }
  }

  // 2026-09-14 UAT — 원 파일명(source_drive_name)은 그대로 두고, 화면에 보일 이름(title)만 따로 적는다.
  // 다시 동기화해도 title 은 덮어쓰지 않는다. 관리자 화면에는 둘 다 보인다.
  async function saveDisplayTitle(docId: string, current: string, next: string) {
    const title = next.trim();
    if (!title || title === current) return;
    await updateDocTitle(docId, title);
    setDocs((prev) => prev.map((d) => (d.id === docId ? { ...d, title } : d)));
  }
  async function toggleArchived(docId: string, archived: boolean) {
    setArchiveError(null);
    const result = await setDocArchived(docId, archived);
    if (!result.ok) {
      setArchiveError(result.error);
      return;
    }
    setDocs((prev) =>
      prev.map((d) =>
        d.id === docId ? { ...d, archivedAt: archived ? new Date().toISOString() : null } : d
      )
    );
  }
  const [detailError, setDetailError] = useState<string | null>(null);
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
              hasPrimaryKeyword: Boolean(updated.primaryKeywordId),
              archivedAt: d.archivedAt,
              archivedReason: d.archivedReason,
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

  const filteredDocs = docs
    .filter((d) => (showArchived ? Boolean(d.archivedAt) : !d.archivedAt))
    .filter((d) => query.trim() === "" || d.title.toLowerCase().includes(query.trim().toLowerCase()))
    .filter((d) => !onlyMissingPrimary || !d.hasPrimaryKeyword);

  // 키워드별: 과목 › 대표 키워드. 단원별: 과목 › 단원(그 단원에 붙은 키워드를 대표 키워드로 가진 교재) — 교재 하나가
  // 여러 단원에 들어갈 수 있으니 여러 묶음에 나온다. 대표 키워드 없는 교재는 "(키워드 미지정)".
  type Group = { key: string; label: string; docs: CurriculumDocListItem[] };
  const groups: Group[] = (() => {
    const map = new Map<string, Group>();
    const add = (key: string, label: string, d: CurriculumDocListItem) => {
      const g = map.get(key) ?? { key, label, docs: [] };
      g.docs.push(d);
      map.set(key, g);
    };
    if (viewMode === "keyword") {
      for (const d of filteredDocs) {
        const kw = d.primaryKeywordLabel ?? "(키워드 미지정)";
        add(`${d.subjectName}::${kw}`, `${d.subjectName} › ${kw}`, d);
      }
    } else {
      for (const d of filteredDocs) {
        const subject = subjects.find((sub) => sub.subjectId === d.subjectId);
        const units = d.primaryKeywordId
          ? (subject?.units ?? []).filter((u) => (u.keywordIds ?? []).includes(d.primaryKeywordId as string))
          : [];
        if (units.length === 0) {
          add(`${d.subjectName}::__none`, `${d.subjectName} › (단원에 아직 안 들어감)`, d);
          continue;
        }
        for (const u of units) add(`${d.subjectName}::${u.id}`, `${d.subjectName} › ${u.position}. ${u.unitTitle}`, d);
      }
    }
    return Array.from(map.values()).sort((a, b) => {
      const an = a.label.includes("(키워드 미지정)") || a.label.includes("(단원에 아직");
      const bn = b.label.includes("(키워드 미지정)") || b.label.includes("(단원에 아직");
      if (an !== bn) return an ? 1 : -1;
      return a.label.localeCompare(b.label);
    });
  })();

  const renderRow = (d: CurriculumDocListItem) => (
            <div
              key={d.id}
              className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-2.5 flex items-center justify-between"
            >
              <div>
                <div className="text-[13.5px] font-bold text-ink">
                  {d.kind !== "html" && (
                    <span className="text-[10.5px] font-bold text-grey-500 border border-grey-200 rounded-full px-1.5 py-0.5 mr-1.5 align-middle">
                      {d.kind === "pdf" ? "PDF" : "영상"}
                    </span>
                  )}
                  {d.title}
                </div>
                <div className="text-[12px] text-grey-500 mt-0.5">
                  {d.subjectName}
                  {d.primaryKeywordLabel ? ` · ${d.primaryKeywordLabel}` : ""}
                  {d.unitTitle ? ` · ${d.unitTitle}` : ""}
                  {d.kind === "html" ? ` · 섹션 ${d.sectionCount}개` : d.hasDriveSource ? " · Drive 원본" : " · 로컬 표본"} ·{" "}
                  {STATUS_LABEL[d.status] ?? d.status}
                  {!d.hasPrimaryKeyword && " · 대표 키워드 없음"}
                  {d.archivedAt && " · 보관됨"}
                </div>
                {d.kind !== "html" && (
                  <div className="mt-1.5 text-[12px] text-grey-500">
                    {d.sourceDriveName && (
                      <div className="truncate max-w-[520px]" title={d.sourceDriveName}>
                        원 파일명: <span className="text-ink">{d.sourceDriveName}</span>
                      </div>
                    )}
                    <label className="flex items-center gap-1.5 mt-1">
                      <span className="whitespace-nowrap">노출용 이름:</span>
                      <input
                        aria-label={`${d.sourceDriveName ?? d.title} 노출용 이름`}
                        defaultValue={d.title}
                        onBlur={(e) => void saveDisplayTitle(d.id, d.title, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                        }}
                        className="text-[12.5px] text-ink border-[1.5px] border-grey-200 rounded-lg px-2 py-1 w-[320px] max-w-full"
                      />
                    </label>
                  </div>
                )}
              </div>
              <span className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => void toggleArchived(d.id, !d.archivedAt)}
                  className="text-[12px] font-bold text-grey-500 whitespace-nowrap"
                >
                  {d.archivedAt ? "보관 풀기" : "보관"}
                </button>
                {d.kind === "html" ? (
                  <button
                    onClick={() => openDoc(d.id)}
                    className="text-[12px] font-bold px-3.5 py-2 rounded-lg border-[1.5px] border-grey-200 text-ink whitespace-nowrap"
                  >
                    편집
                  </button>
                ) : (
                  <button
                    disabled={publishingAssetId === d.id || !d.hasDriveSource}
                    title={!d.hasDriveSource ? "로컬 표본은 등록 때 이미 공개됐습니다" : undefined}
                    onClick={() => void publishAsset(d)}
                    className="text-[12px] font-bold px-3.5 py-2 rounded-lg border-[1.5px] border-grey-200 text-ink whitespace-nowrap disabled:opacity-50"
                  >
                    {publishingAssetId === d.id ? "사본 확보 중…" : d.status === "published" ? "다시 공개(새 버전)" : "공개 (고정 사본)"}
                  </button>
                )}
              </span>
            </div>
  );

  return (
    <div className="max-w-[640px] px-8 py-8">
      <h1 className="text-[20px] font-extrabold text-ink mb-1.5">교재</h1>
      <p className="text-[13px] text-grey-500 mb-5">
        Drive 자료 동기화로 들어온 PDF·영상과 예전 본문 교재입니다. 교재는 대표 키워드 하나에 속하고, 그 키워드가 붙은
        여러 단원에 들어갑니다 — 키워드별 또는 단원별로 접어 봅니다.
      </p>
      {detailError && <p className="text-[12.5px] text-red mb-3">{detailError}</p>}
      {archiveError && <p className="text-[12.5px] text-red mb-3">{archiveError}</p>}
      {assetNotice && <p className="text-[12.5px] text-ink bg-grey-100 rounded-lg px-3 py-2 mb-3">{assetNotice}</p>}

      <div className="flex gap-1 mb-3 border-b-[1.5px] border-grey-200">
        {[
          { archived: false, label: "현재" },
          { archived: true, label: "보관됨" },
        ].map((t) => (
          <button
            key={t.label}
            onClick={() => setShowArchived(t.archived)}
            className={
              "text-[13px] font-bold px-3.5 py-2 -mb-[1.5px] border-b-[2px] " +
              (showArchived === t.archived ? "border-ink text-ink" : "border-transparent text-grey-500")
            }
          >
            {t.label}
            <span className="text-grey-300 font-semibold ml-1">
              {docs.filter((d) => (t.archived ? Boolean(d.archivedAt) : !d.archivedAt)).length}
            </span>
          </button>
        ))}
      </div>

      <input
        aria-label="교재 검색"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={showArchived ? "보관된 교재에서 찾기" : "교재 제목으로 찾기"}
        className="w-full text-[12.5px] border-[1.5px] border-grey-200 rounded-lg px-2.5 py-1.5 mb-3"
      />

      <div className="flex gap-1.5 mb-3" role="group" aria-label="보기 방식">
        {(
          [
            { id: "keyword", label: "키워드별 보기" },
            { id: "unit", label: "단원별 보기" },
            { id: "list", label: "목록" },
          ] as const
        ).map((m) => (
          <button
            key={m.id}
            type="button"
            aria-pressed={viewMode === m.id}
            onClick={() => setViewMode(m.id)}
            className={
              "text-[12px] font-bold px-3 py-1.5 rounded-full border-[1.5px] " +
              (viewMode === m.id ? "bg-ink text-white border-ink" : "border-grey-200 text-ink")
            }
          >
            {m.label}
          </button>
        ))}
      </div>

      {showArchived && (
        <p className="text-[12px] text-grey-500 mb-3">
          보관된 교재는 신규 선택과 자동 구성 후보에 나오지 않습니다. 이미 담긴 회차와 과거 수업 기록은
          그대로 남아 있습니다.
        </p>
      )}

      <label className="flex items-center gap-2 text-[12.5px] text-grey-500 mb-3">
        <input
          type="checkbox"
          checked={onlyMissingPrimary}
          onChange={(e) => setOnlyMissingPrimary(e.target.checked)}
        />
        대표 키워드가 없는 교재만 보기
        <span className="text-grey-300">({docs.filter((d) => !d.hasPrimaryKeyword).length}건)</span>
      </label>

      {docs.length === 0 ? (
        <div className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center mb-3">
          아직 교재가 없습니다. Drive 자료 탭에서 과목 자료 동기화를 실행하세요.
        </div>
      ) : (
        <>
          {viewMode === "list" ? (
            <>
              {filteredDocs.slice(0, visibleCount).map(renderRow)}
              {visibleCount < filteredDocs.length && (
                <button
                  onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}
                  className="text-[12.5px] font-semibold text-ink underline w-full text-center mb-2.5"
                >
                  더 보기({filteredDocs.length - visibleCount}개 남음)
                </button>
              )}
            </>
          ) : (
            groups.map((g) => (
              <details key={g.key} open={groups.length <= 3} className="mb-2" data-testid="doc-group">
                <summary className="cursor-pointer text-[13.5px] font-bold text-ink px-2 py-2 rounded-lg hover:bg-grey-100">
                  📁 {g.label} <span className="text-[12px] text-grey-500 font-semibold">{g.docs.length}개</span>
                </summary>
                <div className="pl-2 pt-1">{g.docs.map(renderRow)}</div>
              </details>
            ))
          )}
        </>
      )}

      {/* 2026-09-14 제품 오너: 새 교재(HTML) 만들기는 막는다 — 교재는 Drive 자료 동기화로만 들어온다. */}
    </div>
  );
}
