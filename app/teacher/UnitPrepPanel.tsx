"use client";

import { useEffect, useState } from "react";
import {
  loadUnitComposition,
  addUnitKeyword,
  removeUnitKeyword,
  inheritUnitDefaults,
  moveUnitMaterial,
  removeUnitMaterial,
  addUnitMaterial,
  addAllUnitMaterials,
  loadUnitMaterialCatalog,
  previewUnitMaterial,
  composeUnitPrepProblems,
  loadProblemCount,
  type CatalogMaterial,
  type UnitComposition,
} from "./unit-prep-actions";

// P2/P3 3단계 — 회차를 준비하는 화면.
// 2026-09-18(제품 오너 지시) — 목표 입력, 예약 수업 연결, 장황한 안내문, 교재·문제
// 개별 후보 선택 UI를 전부 뺐다. 이 화면은 이제 셋만 한다: 키워드 고르기 → 교재
// 담기(개별/전체) → 문제 20개 한 번에 구성. 연결은 예약 확정 시 자동으로 되므로
// (auto_link_next_unit_to_session) 여기서 수동으로 수업에 연결하지 않는다.
export default function UnitPrepPanel({
  overlayUnitId,
  unitTitle,
  studentName,
  subjectName,
  onBack,
}: {
  overlayUnitId: string;
  unitTitle: string;
  studentName: string;
  subjectName: string;
  onBack: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [composition, setComposition] = useState<UnitComposition | null>(null);
  const [problemCount, setProblemCount] = useState(0);
  const [keywordToAdd, setKeywordToAdd] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<CatalogMaterial[] | null>(null);
  const [catalogQuery, setCatalogQuery] = useState("");
  const [preview, setPreview] = useState<{ title: string; sectionTitles: string[] } | null>(null);
  const [composingProblems, setComposingProblems] = useState(false);

  async function refreshCatalogIfNeeded() {
    if (composition && composition.keywords.length > 0) {
      setCatalog(await loadUnitMaterialCatalog(overlayUnitId));
    } else {
      setCatalog(null);
    }
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([loadUnitComposition(overlayUnitId), loadProblemCount(overlayUnitId)])
      .then(async ([comp, count]) => {
        if (cancelled) return;
        setComposition(comp);
        setProblemCount(count);
        if (comp.keywords.length > 0) setCatalog(await loadUnitMaterialCatalog(overlayUnitId));
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "수업 준비를 불러오지 못했습니다.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
     
  }, [overlayUnitId]);

  async function withComposition(run: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setSaving(true);
    setError(null);
    try {
      const result = await run();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const comp = await loadUnitComposition(overlayUnitId);
      setComposition(comp);
      setCatalog(comp.keywords.length > 0 ? await loadUnitMaterialCatalog(overlayUnitId) : null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  // 2026-09-21(UAT 지적) — 키워드를 바꾼 뒤 교재는 "전체 담기"를 눌러야 했고 문제는 "20개
  // 업데이트"를 또 눌러야 했다(수업 준비 화면(CompositionPanel)은 이미 키워드 토글 한 번으로
  // 교재·문제가 같이 반영되도록 고쳤는데 이 화면은 그때 범위에 없었다). 키워드 추가/제거
  // 즉시 교재 전체 담기 + 문제 재구성까지 한 번에 실행해 별도 클릭이 필요 없게 한다.
  async function handleKeywordChange(run: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const result = await run();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const comp = await loadUnitComposition(overlayUnitId);
      const nextCatalog = comp.keywords.length > 0 ? await loadUnitMaterialCatalog(overlayUnitId) : null;
      if (nextCatalog && nextCatalog.some((c) => !c.picked)) {
        await addAllUnitMaterials(overlayUnitId);
      }
      if (comp.keywords.length > 0) {
        const composeResult = await composeUnitPrepProblems(overlayUnitId);
        if (composeResult.ok) setProblemCount(composeResult.composedCount);
      } else {
        setProblemCount(0);
      }
      const finalComp = await loadUnitComposition(overlayUnitId);
      setComposition(finalComp);
      setCatalog(finalComp.keywords.length > 0 ? await loadUnitMaterialCatalog(overlayUnitId) : null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function handleComposeProblems() {
    setComposingProblems(true);
    setError(null);
    setNotice(null);
    try {
      const result = await composeUnitPrepProblems(overlayUnitId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setProblemCount(result.composedCount);
      if (result.availableCount < 20) {
        setNotice(`공개된 문제가 ${result.availableCount}개뿐이라 ${result.composedCount}개로 구성했습니다(20개보다 ${20 - result.availableCount}개 부족).`);
      } else {
        setNotice(`문제 ${result.composedCount}개로 구성했습니다.`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "문제 구성에 실패했습니다.");
    } finally {
      setComposingProblems(false);
    }
  }

  const hasKeywords = (composition?.keywords.length ?? 0) > 0;

  return (
    <div className="max-w-[760px] mx-auto px-5 sm:px-8 py-7">
      {/* 2026-09-21(UAT 지적) — 텍스트 링크처럼 보이는 "뒤로" 버튼이 눌리는지 알 수 없었다.
          테두리·배경으로 버튼 어포던스를 주고, active:scale로 눌림 반응을 준다. */}
      <button
        onClick={onBack}
        className="text-[13px] text-grey-600 font-semibold mb-4 border-[1.5px] border-grey-200 rounded-lg px-3 py-1.5 hover:bg-grey-100 active:scale-95 transition-transform"
      >
        ← 커리큘럼으로
      </button>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-1">
        <span className="text-[11.5px] font-bold text-grey-500">{studentName} 학생</span>
        <span className="text-[11.5px] text-grey-300">·</span>
        <span className="text-[11.5px] font-semibold text-grey-500">
          {subjectName} › {unitTitle}
        </span>
        <span className="text-[10.5px] font-bold text-grey-500 bg-grey-100 rounded-full px-2 py-0.5 ml-auto">
          수업 준비
        </span>
      </div>
      <h2 className="text-[19px] sm:text-[21px] font-extrabold text-ink leading-tight mb-6">{unitTitle}</h2>

      {loading && <p className="text-[13px] text-grey-500">불러오는 중...</p>}
      {error && <p className="text-[12.5px] text-red mb-3">{error}</p>}
      {notice && <p className="text-[12px] text-grey-500 mb-3">{notice}</p>}

      {composition && (
        <>
          <section className="mb-6">
            <div className="text-[11px] font-bold text-grey-300 uppercase tracking-wide mb-1.5">키워드</div>
            {composition.keywords.length === 0 && (
              <p className="text-[12.5px] text-grey-500 mb-2">
                아직 키워드가 없습니다. 키워드를 고르면 교재·문제 영역이 바로 갱신됩니다.
              </p>
            )}
            <div className="flex flex-wrap items-center gap-1.5 mb-2">
              {composition.keywords.map((k) => (
                <span
                  key={k.id}
                  className="inline-flex items-center gap-1 text-[12px] bg-grey-100 rounded-full pl-2.5 pr-1.5 py-0.5"
                >
                  {k.label}
                  <button
                    aria-label={`${k.label} 키워드 빼기`}
                    disabled={saving}
                    onClick={() => void handleKeywordChange(() => removeUnitKeyword(overlayUnitId, k.id))}
                    className="text-grey-500 font-bold px-1"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label="키워드 추가"
                value={keywordToAdd}
                onChange={(e) => setKeywordToAdd(e.target.value)}
                className="text-[12.5px] border-[1.5px] border-grey-200 rounded-lg px-2 py-1.5 max-w-[280px]"
              >
                <option value="">키워드 고르기…</option>
                {composition.subjectKeywords
                  .filter((k) => !composition.keywords.some((c) => c.id === k.id))
                  .map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.label}
                    </option>
                  ))}
              </select>
              <button
                disabled={!keywordToAdd || saving}
                onClick={() => {
                  const id = keywordToAdd;
                  setKeywordToAdd("");
                  void handleKeywordChange(() => addUnitKeyword(overlayUnitId, id));
                }}
                className="text-[12px] font-bold text-white bg-ink rounded-lg px-3 py-1.5 disabled:bg-grey-200 disabled:text-grey-400 active:scale-95 transition-transform"
              >
                해당 키워드로 수업 주제 세팅하기
              </button>
              {composition.hasTemplateDefaults && (
                <button
                  disabled={saving}
                  title="관리자·선생님이 이 과목에 미리 정해둔 기본 키워드·교재 구성을 그대로 가져옵니다(이미 붙인 키워드는 건드리지 않고, 빠진 것만 채웁니다)."
                  onClick={() =>
                    void withComposition(async () => {
                      const result = await inheritUnitDefaults(overlayUnitId);
                      if (!result.ok) return result;
                      setNotice(
                        result.keywordsAdded + result.materialsAdded === 0
                          ? "이미 기본 구성을 모두 가져왔습니다."
                          : `기본 구성에서 키워드 ${result.keywordsAdded}개, 교재 ${result.materialsAdded}개를 가져왔습니다.`
                      );
                      return { ok: true } as const;
                    })
                  }
                  className="text-[12px] font-bold text-ink border-[1.5px] border-grey-200 rounded-lg px-3 py-1.5 disabled:text-grey-300 ml-auto active:scale-95 transition-transform"
                >
                  기본 구성 가져오기(관리자가 미리 정한 키워드·교재)
                </button>
              )}
            </div>
          </section>

          <section className="mb-6">
            <div className="flex items-center justify-between mb-1.5">
              <div className="text-[11px] font-bold text-grey-300 uppercase tracking-wide">
                교재 {composition.materials.length > 0 && `(${composition.materials.length})`}
              </div>
              {hasKeywords && catalog && catalog.some((c) => !c.picked) && (
                <button
                  disabled={saving}
                  onClick={() =>
                    void withComposition(async () => {
                      const result = await addAllUnitMaterials(overlayUnitId);
                      if (!result.ok) return result;
                      setNotice(`교재 ${result.addedCount}개를 담았습니다.`);
                      return { ok: true } as const;
                    })
                  }
                  className="text-[12px] font-bold text-ink disabled:text-grey-300"
                >
                  교재 전체 담기
                </button>
              )}
            </div>

            {composition.materials.length === 0 ? (
              <p className="text-[12.5px] text-grey-500 mb-2">
                {composition.hasTemplateDefaults
                  ? "아직 담은 교재가 없습니다. 위의 기본 구성 가져오기로 관리자가 정한 구성을 불러올 수 있습니다."
                  : "아직 담은 교재가 없습니다."}
              </p>
            ) : (
              composition.materials.map((m, index) => (
                <div key={m.curriculumDocId} className="flex items-center justify-between text-[12.5px] py-1.5">
                  <span className="truncate max-w-[420px]">
                    {index + 1}. {m.title}
                  </span>
                  <span className="flex items-center gap-2 flex-shrink-0">
                    <button
                      aria-label={`${m.title} 위로`}
                      disabled={saving || index === 0}
                      onClick={() => void withComposition(() => moveUnitMaterial(overlayUnitId, m.curriculumDocId, "up"))}
                      className="text-[11.5px] font-bold text-grey-500 disabled:text-grey-200"
                    >
                      ↑
                    </button>
                    <button
                      aria-label={`${m.title} 아래로`}
                      disabled={saving || index === composition.materials.length - 1}
                      onClick={() => void withComposition(() => moveUnitMaterial(overlayUnitId, m.curriculumDocId, "down"))}
                      className="text-[11.5px] font-bold text-grey-500 disabled:text-grey-200"
                    >
                      ↓
                    </button>
                    <button
                      disabled={saving}
                      onClick={() => void withComposition(() => removeUnitMaterial(overlayUnitId, m.curriculumDocId))}
                      className="text-[11.5px] font-bold text-grey-500"
                    >
                      빼기
                    </button>
                  </span>
                </div>
              ))
            )}

            {!hasKeywords ? (
              <p className="text-[12.5px] text-grey-500 mt-2">키워드를 먼저 고르면 담을 수 있는 교재가 나타납니다.</p>
            ) : (
              <div className="mt-2 border-[1.5px] border-grey-200 rounded-xl p-3">
                <div className="text-[11px] font-bold text-grey-300 uppercase tracking-wide mb-2">
                  선택된 키워드의 교재
                </div>
                <input
                  aria-label="교재 검색"
                  value={catalogQuery}
                  onChange={(e) => setCatalogQuery(e.target.value)}
                  placeholder="교재 제목으로 찾기"
                  className="w-full text-[12.5px] border-[1.5px] border-grey-200 rounded-lg px-2.5 py-1.5 mb-2"
                />
                {catalog === null ? (
                  <p className="text-[12.5px] text-grey-500">불러오는 중...</p>
                ) : catalog.length === 0 ? (
                  <p className="text-[12.5px] text-grey-500">이 키워드로 공개된 교재가 없습니다.</p>
                ) : (
                  catalog
                    .filter((c) => c.title.toLowerCase().includes(catalogQuery.trim().toLowerCase()))
                    .map((c) => (
                      <div key={c.curriculumDocId} className="flex items-center justify-between text-[12.5px] py-1.5">
                        <span className="truncate max-w-[380px]">
                          {c.kind !== "html" && (
                            <span className="text-[10px] font-bold text-grey-500 border border-grey-200 rounded-full px-1.5 py-0.5 mr-1.5">
                              {c.kind === "pdf" ? "PDF" : "영상"}
                            </span>
                          )}
                          {c.title}
                        </span>
                        <span className="flex items-center gap-2 flex-shrink-0">
                          <button
                            onClick={() => void previewUnitMaterial(c.curriculumDocId).then(setPreview)}
                            className="text-[11.5px] font-bold text-grey-500"
                          >
                            미리보기
                          </button>
                          <button
                            disabled={c.picked || saving}
                            onClick={() => void withComposition(() => addUnitMaterial(overlayUnitId, c.curriculumDocId))}
                            className="text-[11.5px] font-bold text-ink disabled:text-grey-300"
                          >
                            {c.picked ? "담김" : "담기"}
                          </button>
                        </span>
                      </div>
                    ))
                )}
              </div>
            )}

            {preview && (
              <div className="mt-2 border-[1.5px] border-grey-200 rounded-xl p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[12.5px] font-bold text-ink">{preview.title}</span>
                  <button onClick={() => setPreview(null)} className="text-[11.5px] font-bold text-grey-500">
                    닫기
                  </button>
                </div>
                {preview.sectionTitles.length === 0 ? (
                  <p className="text-[12px] text-grey-500">아직 내용이 없는 교재입니다.</p>
                ) : (
                  <ol className="text-[12px] text-grey-500 list-decimal pl-4">
                    {preview.sectionTitles.map((t, i) => (
                      <li key={i}>{t}</li>
                    ))}
                  </ol>
                )}
              </div>
            )}
          </section>

          <section className="mb-6">
            <div className="flex items-center justify-between mb-1.5">
              <div className="text-[11px] font-bold text-grey-300 uppercase tracking-wide">문제 {problemCount}개</div>
              <button
                disabled={!hasKeywords || composingProblems}
                onClick={() => void handleComposeProblems()}
                className="text-[12px] font-bold text-ink disabled:text-grey-300"
              >
                {composingProblems ? "구성 중..." : "문제 20개 업데이트"}
              </button>
            </div>
            {!hasKeywords && (
              <p className="text-[12.5px] text-grey-500">키워드를 먼저 고르면 문제를 구성할 수 있습니다.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
