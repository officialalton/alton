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

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 데이터 로드 시작 시 상태 초기화(관용적 패턴)
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
        if (!cancelled) setError(e instanceof Error ? e.message : "Couldn't load lesson prep.");
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
      setError(e instanceof Error ? e.message : "Couldn't save.");
    } finally {
      setSaving(false);
    }
  }

  // 2026-09-21(UAT 지적) — 키워드를 바꾼 뒤 교재는 "전체 담기"를 눌러야 했고 문제는 "20개
  // 업데이트"를 또 눌러야 했다(수업 준비 화면(CompositionPanel)은 이미 키워드 토글 한 번으로
  // 교재·문제가 같이 반영되도록 고쳤는데 이 화면은 그때 범위에 없었다). 키워드 추가/제거
  // 즉시 Add all materials + 문제 재구성까지 한 번에 실행해 별도 클릭이 필요 없게 한다.
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
      setError(e instanceof Error ? e.message : "Couldn't save.");
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
        setNotice(`Only ${result.availableCount} published problems are available, so ${result.composedCount} were composed (${20 - result.availableCount} short of 20).`);
      } else {
        setNotice(`Composed ${result.composedCount} problems.`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't compose problems.");
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
        ← Back to curriculum
      </button>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-1">
        <span className="text-[11.5px] font-bold text-grey-500">{studentName}</span>
        <span className="text-[11.5px] text-grey-300">·</span>
        <span className="text-[11.5px] font-semibold text-grey-500">
          {subjectName} › {unitTitle}
        </span>
        <span className="text-[10.5px] font-bold text-grey-500 bg-grey-100 rounded-full px-2 py-0.5 ml-auto">
          Lesson prep
        </span>
      </div>
      <h2 className="text-[19px] sm:text-[21px] font-extrabold text-ink leading-tight mb-6">{unitTitle}</h2>

      {loading && <p className="text-[13px] text-grey-500">Loading…</p>}
      {error && <p className="text-[12.5px] text-red mb-3">{error}</p>}
      {notice && <p className="text-[12px] text-grey-500 mb-3">{notice}</p>}

      {composition && (
        <>
          <section className="mb-6">
            <div className="text-[11px] font-bold text-grey-300 uppercase tracking-wide mb-1.5">Keywords</div>
            {composition.keywords.length === 0 && (
              <p className="text-[12.5px] text-grey-500 mb-2">
                No keywords yet. Pick a keyword and the materials and problems below update right away.
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
                    aria-label={`Remove keyword ${k.label}`}
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
                aria-label="Add keyword"
                value={keywordToAdd}
                onChange={(e) => setKeywordToAdd(e.target.value)}
                className="text-[12.5px] border-[1.5px] border-grey-200 rounded-lg px-2 py-1.5 max-w-[280px]"
              >
                <option value="">Choose a keyword…</option>
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
                Set lesson topic with this keyword
              </button>
              {composition.hasTemplateDefaults && (
                <button
                  disabled={saving}
                  title="Imports the default keyword and material composition preset by the admin or teacher for this subject (keywords already attached are kept; only missing ones are added)."
                  onClick={() =>
                    void withComposition(async () => {
                      const result = await inheritUnitDefaults(overlayUnitId);
                      if (!result.ok) return result;
                      setNotice(
                        result.keywordsAdded + result.materialsAdded === 0
                          ? "All defaults have already been imported."
                          : `Imported ${result.keywordsAdded} keywords and ${result.materialsAdded} materials from the defaults.`
                      );
                      return { ok: true } as const;
                    })
                  }
                  className="text-[12px] font-bold text-ink border-[1.5px] border-grey-200 rounded-lg px-3 py-1.5 disabled:text-grey-300 ml-auto active:scale-95 transition-transform"
                >
                  Import defaults (admin-preset keywords & materials)
                </button>
              )}
            </div>
          </section>

          <section className="mb-6">
            <div className="flex items-center justify-between mb-1.5">
              <div className="text-[11px] font-bold text-grey-300 uppercase tracking-wide">
                Materials {composition.materials.length > 0 && `(${composition.materials.length})`}
              </div>
              {hasKeywords && catalog && catalog.some((c) => !c.picked) && (
                <button
                  disabled={saving}
                  onClick={() =>
                    void withComposition(async () => {
                      const result = await addAllUnitMaterials(overlayUnitId);
                      if (!result.ok) return result;
                      setNotice(`Added ${result.addedCount} materials.`);
                      return { ok: true } as const;
                    })
                  }
                  className="text-[12px] font-bold text-ink disabled:text-grey-300"
                >
                  Add all materials
                </button>
              )}
            </div>

            {composition.materials.length === 0 ? (
              <p className="text-[12.5px] text-grey-500 mb-2">
                {composition.hasTemplateDefaults
                  ? "No materials added yet. Use Import defaults above to load the admin-preset composition."
                  : "No materials added yet."}
              </p>
            ) : (
              composition.materials.map((m, index) => (
                <div key={m.curriculumDocId} className="flex items-center justify-between text-[12.5px] py-1.5">
                  <span className="truncate max-w-[420px]">
                    {index + 1}. {m.title}
                  </span>
                  <span className="flex items-center gap-2 flex-shrink-0">
                    <button
                      aria-label={`Move ${m.title} up`}
                      disabled={saving || index === 0}
                      onClick={() => void withComposition(() => moveUnitMaterial(overlayUnitId, m.curriculumDocId, "up"))}
                      className="text-[11.5px] font-bold text-grey-500 disabled:text-grey-200"
                    >
                      ↑
                    </button>
                    <button
                      aria-label={`Move ${m.title} down`}
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
                      Remove
                    </button>
                  </span>
                </div>
              ))
            )}

            {!hasKeywords ? (
              <p className="text-[12.5px] text-grey-500 mt-2">Pick a keyword first to see materials you can add.</p>
            ) : (
              <div className="mt-2 border-[1.5px] border-grey-200 rounded-xl p-3">
                <div className="text-[11px] font-bold text-grey-300 uppercase tracking-wide mb-2">
                  Materials for selected keywords
                </div>
                <input
                  aria-label="Search materials"
                  value={catalogQuery}
                  onChange={(e) => setCatalogQuery(e.target.value)}
                  placeholder="Search by material title"
                  className="w-full text-[12.5px] border-[1.5px] border-grey-200 rounded-lg px-2.5 py-1.5 mb-2"
                />
                {catalog === null ? (
                  <p className="text-[12.5px] text-grey-500">Loading…</p>
                ) : catalog.length === 0 ? (
                  <p className="text-[12.5px] text-grey-500">No published materials for these keywords.</p>
                ) : (
                  catalog
                    .filter((c) => c.title.toLowerCase().includes(catalogQuery.trim().toLowerCase()))
                    .map((c) => (
                      <div key={c.curriculumDocId} className="flex items-center justify-between text-[12.5px] py-1.5">
                        <span className="truncate max-w-[380px]">
                          {c.kind !== "html" && (
                            <span className="text-[10px] font-bold text-grey-500 border border-grey-200 rounded-full px-1.5 py-0.5 mr-1.5">
                              {c.kind === "pdf" ? "PDF" : "Video"}
                            </span>
                          )}
                          {c.title}
                        </span>
                        <span className="flex items-center gap-2 flex-shrink-0">
                          <button
                            onClick={() => void previewUnitMaterial(c.curriculumDocId).then(setPreview)}
                            className="text-[11.5px] font-bold text-grey-500"
                          >
                            Preview
                          </button>
                          <button
                            disabled={c.picked || saving}
                            onClick={() => void withComposition(() => addUnitMaterial(overlayUnitId, c.curriculumDocId))}
                            className="text-[11.5px] font-bold text-ink disabled:text-grey-300"
                          >
                            {c.picked ? "Added" : "Add"}
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
                    Close
                  </button>
                </div>
                {preview.sectionTitles.length === 0 ? (
                  <p className="text-[12px] text-grey-500">This material has no content yet.</p>
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
              <div className="text-[11px] font-bold text-grey-300 uppercase tracking-wide">Problems: {problemCount}</div>
              <button
                disabled={!hasKeywords || composingProblems}
                onClick={() => void handleComposeProblems()}
                className="text-[12px] font-bold text-ink disabled:text-grey-300"
              >
                {composingProblems ? "Composing…" : "Update 20 problems"}
              </button>
            </div>
            {!hasKeywords && (
              <p className="text-[12.5px] text-grey-500">Pick a keyword first to compose problems.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
