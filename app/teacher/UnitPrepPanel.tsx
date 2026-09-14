"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  loadUnitPrep,
  saveUnitGoal,
  addUnitPrepItem,
  removeUnitPrepItem,
  loadUnitEligibleContent,
  listBookedLessonsForUnit,
  linkUnitPrepToLesson,
  loadUnitComposition,
  addUnitKeyword,
  removeUnitKeyword,
  inheritUnitDefaults,
  moveUnitMaterial,
  removeUnitMaterial,
  addUnitMaterial,
  loadUnitMaterialCatalog,
  previewUnitMaterial,
  type UnitPrep,
  type CatalogMaterial,
  type UnitComposition,
} from "./unit-prep-actions";
import type { EligibleSelectionContent } from "./session-prep-data";

// P2/P3 3단계(제품 오너 피드백 1·7) — 예약이 없어도 회차를 준비하는 화면.
// 커리큘럼에서 회차를 고르면 바로 여기로 들어오고, 목표·교재·문제를 세팅한다.
// 수업이 잡히면 같은 화면에서 그 수업에 연결한다 — 연결은 고정이 아니다.
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
  const router = useRouter();
  const [prep, setPrep] = useState<UnitPrep | null>(null);
  const [eligible, setEligible] = useState<EligibleSelectionContent>({ materialSections: [], problems: [] });
  const [lessons, setLessons] = useState<
    { sessionId: string; startsAt: string | null; alreadyLinked: boolean }[]
  >([]);
  const [goalDraft, setGoalDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [composition, setComposition] = useState<UnitComposition | null>(null);
  const [keywordToAdd, setKeywordToAdd] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<CatalogMaterial[] | null>(null);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [catalogQuery, setCatalogQuery] = useState("");
  const [preview, setPreview] = useState<{ title: string; sectionTitles: string[] } | null>(null);

  async function openCatalog() {
    setCatalogOpen(true);
    setError(null);
    try {
      setCatalog(await loadUnitMaterialCatalog(overlayUnitId));
    } catch {
      setError("교재 목록을 불러오지 못했습니다.");
    }
  }

  // 후보가 비었을 때 원인을 구분한다. 회차에 키워드가 없으면 담을 수 있는 게
  // 생길 수가 없고, 선생님이 할 일은 "기다리기"가 아니라 "키워드 지정"이다.
  const noKeyword = eligible.keywordCount === 0;
  const noKeywordNotice =
    "이 회차에 아직 키워드가 없습니다. 위의 \u2018이 회차의 키워드\u2019에서 키워드를 붙이면 담을 수 있는 교재와 문제가 나타납니다.";

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      loadUnitPrep(overlayUnitId),
      loadUnitEligibleContent(overlayUnitId),
      listBookedLessonsForUnit(overlayUnitId),
      loadUnitComposition(overlayUnitId),
    ])
      .then(([p, content, booked, comp]) => {
        if (cancelled) return;
        setPrep(p);
        setGoalDraft(p.goal);
        setEligible(content);
        setLessons(booked);
        setComposition(comp);
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
      // 키워드가 바뀌면 고를 수 있는 후보가 바뀐다 — 둘을 같이 다시 읽지 않으면
      // 화면이 서로 어긋난 상태를 보여준다.
      const [comp, content] = await Promise.all([
        loadUnitComposition(overlayUnitId),
        loadUnitEligibleContent(overlayUnitId),
      ]);
      setComposition(comp);
      setEligible(content);
      if (catalogOpen) setCatalog(await loadUnitMaterialCatalog(overlayUnitId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function withSave(run: () => Promise<void>) {
    setSaving(true);
    setError(null);
    try {
      await run();
      setPrep(await loadUnitPrep(overlayUnitId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  const pickedIds = new Set((prep?.items ?? []).map((i) => i.contentId));

  return (
    <div className="max-w-[760px] mx-auto px-5 sm:px-8 py-7">
      <button onClick={onBack} className="text-[13px] text-grey-500 font-semibold mb-4">
        ← 커리큘럼으로
      </button>

      {/* 수업 화면의 머리말과 같은 체계로 쓴다 — 커리큘럼 → 준비 → 수업 →
          복습에서 같은 말과 같은 위계를 본다. */}
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
      <h2 className="text-[19px] sm:text-[21px] font-extrabold text-ink leading-tight">{unitTitle}</h2>
      <p className="text-[13px] leading-[1.65] text-grey-500 mt-1.5 mb-6">
        예약이 없어도 미리 준비할 수 있습니다. 준비한 내용은 언제든 고칠 수 있고,
        실제 수업이 시작될 때 그 시점의 내용으로 고정됩니다.
      </p>

      {loading && <p className="text-[13px] text-grey-500">불러오는 중...</p>}
      {error && <p className="text-[12.5px] text-red mb-3">{error}</p>}

      {prep && (
        <>
          <section className="mb-6">
            <div className="text-[11px] font-bold text-grey-300 uppercase tracking-wide mb-2">
              이 회차의 목표
            </div>
            <textarea
              value={goalDraft}
              onChange={(e) => setGoalDraft(e.target.value)}
              onBlur={() => {
                if (goalDraft !== prep.goal) void withSave(() => saveUnitGoal(overlayUnitId, goalDraft));
              }}
              rows={2}
              placeholder="이 회차가 끝났을 때 학생이 무엇을 할 수 있어야 하는지 적으세요."
              className="w-full text-[14px] leading-[1.7] border-[1.5px] border-grey-200 rounded-xl px-3.5 py-2.5"
            />
          </section>

          {/* P2 2차 — 회차의 키워드와 교재 기본 구성.
              키워드가 없는 회차는 초안으로 그대로 두는 게 맞지만(확정 정책),
              "없습니다"라고만 말하고 끝내면 선생님이 갈 곳이 없다. 설정하는
              자리를 여기 둔다. */}
          <section className="mb-6">
            <div className="text-[11px] font-bold text-grey-300 uppercase tracking-wide mb-1.5">
              이 회차의 키워드
            </div>
            {composition && composition.keywords.length === 0 && (
              <p className="text-[12.5px] text-grey-500 mb-2">
                아직 키워드가 없습니다. 키워드를 정하면 담을 수 있는 교재와 문제가 나타납니다.
              </p>
            )}
            <div className="flex flex-wrap items-center gap-1.5 mb-2">
              {(composition?.keywords ?? []).map((k) => (
                <span
                  key={k.id}
                  className="inline-flex items-center gap-1 text-[12px] bg-grey-100 rounded-full pl-2.5 pr-1.5 py-0.5"
                >
                  {k.label}
                  <button
                    aria-label={`${k.label} 키워드 빼기`}
                    disabled={saving}
                    onClick={() => void withComposition(() => removeUnitKeyword(overlayUnitId, k.id))}
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
                {(composition?.subjectKeywords ?? [])
                  .filter((k) => !(composition?.keywords ?? []).some((c) => c.id === k.id))
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
                  void withComposition(() => addUnitKeyword(overlayUnitId, id));
                }}
                className="text-[12px] font-bold text-ink disabled:text-grey-300"
              >
                키워드 붙이기
              </button>
              {composition?.hasTemplateDefaults && (
                <button
                  disabled={saving}
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
                  className="text-[12px] font-bold text-ink disabled:text-grey-300 ml-auto"
                >
                  기본 구성 보충하기
                </button>
              )}
            </div>
            {notice && <p className="text-[12px] text-grey-500 mt-2">{notice}</p>}
          </section>

          {/* 교재 기본 구성 — 이 회차에서 어떤 교재를 어떤 순서로 쓸 것인가.
              담은 자료(아래)와는 층이 다르다: 여기는 회차의 구성이고,
              아래는 이번 수업에 실제로 올릴 조각이다. */}
          <section className="mb-6">
            <div className="text-[11px] font-bold text-grey-300 uppercase tracking-wide mb-1.5">
              이 회차의 교재 구성
            </div>
            {(composition?.materials ?? []).length === 0 ? (
              <p className="text-[12.5px] text-grey-500">
                {composition?.hasTemplateDefaults
                  ? "아직 교재 구성이 없습니다. 위의 기본 구성 가져오기로 관리자가 정한 구성을 불러올 수 있습니다."
                  : "아직 교재 구성이 없습니다."}
              </p>
            ) : (
              (composition?.materials ?? []).map((m, index) => (
                <div
                  key={m.curriculumDocId}
                  className="flex items-center justify-between text-[12.5px] py-1.5"
                >
                  <span className="truncate max-w-[420px]">
                    {index + 1}. {m.title}
                    {/* 키워드를 떼면 자동분만 빠진다 — 어느 쪽인지 보여야 예측할 수 있다. */}
                    <span className="text-[10.5px] text-grey-500 ml-1.5">
                      {m.source === "auto" ? "키워드 자동" : "직접 담음"}
                    </span>
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
                      disabled={saving || index === (composition?.materials.length ?? 0) - 1}
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

            <button
              onClick={() => (catalogOpen ? setCatalogOpen(false) : void openCatalog())}
              className="text-[12px] font-bold text-ink mt-2"
            >
              {catalogOpen ? "교재 목록 닫기" : "교재 목록에서 고르기"}
            </button>

            {catalogOpen && (
              <div className="mt-2 border-[1.5px] border-grey-200 rounded-xl p-3">
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
                  <p className="text-[12.5px] text-grey-500">이 과목에 공개된 교재가 없습니다.</p>
                ) : (
                  catalog
                    .filter((c) => c.title.toLowerCase().includes(catalogQuery.trim().toLowerCase()))
                    .map((c) => (
                      <div
                        key={c.curriculumDocId}
                        className="flex items-center justify-between text-[12.5px] py-1.5"
                      >
                        <span className="truncate max-w-[380px]">
                          {c.kind !== "html" && (
                            <span className="text-[10px] font-bold text-grey-500 border border-grey-200 rounded-full px-1.5 py-0.5 mr-1.5">
                              {c.kind === "pdf" ? "PDF" : "영상"}
                            </span>
                          )}
                          {c.title}
                          <span className="text-[10.5px] text-grey-500 ml-1.5">
                            {c.primaryKeywordLabel ?? "대표 키워드 없음"}
                          </span>
                        </span>
                        <span className="flex items-center gap-2 flex-shrink-0">
                          <button
                            onClick={() =>
                              void previewUnitMaterial(c.curriculumDocId).then(setPreview)
                            }
                            className="text-[11.5px] font-bold text-grey-500"
                          >
                            미리보기
                          </button>
                          <button
                            disabled={c.picked || saving}
                            onClick={() =>
                              void withComposition(() => addUnitMaterial(overlayUnitId, c.curriculumDocId))
                            }
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
            <div className="text-[11px] font-bold text-grey-300 uppercase tracking-wide mb-1.5">
              준비한 자료 {saving && <span className="text-grey-400 normal-case">· 저장 중</span>}
            </div>
            {prep.items.length === 0 ? (
              <p className="text-[12.5px] text-grey-500">
                아직 담은 자료가 없습니다. 아래 후보에서 교재나 문제를 고르세요.
              </p>
            ) : (
              prep.items.map((item) => {
                const label =
                  item.contentType === "material_section"
                    ? eligible.materialSections.find((s) => s.sectionId === item.contentId)?.title
                    : eligible.problems.find((p) => p.problemId === item.contentId)?.passage;
                return (
                  <div key={item.id} className="flex items-center justify-between text-[12.5px] py-1.5">
                    <span className="truncate max-w-[480px]">
                      {item.contentType === "material_section" ? "📖" : "✏️"} {label ?? "(더 이상 공개되지 않은 자료)"}
                    </span>
                    <button
                      onClick={() => void withSave(() => removeUnitPrepItem(item.id))}
                      className="text-[11.5px] font-bold text-grey-500"
                    >
                      빼기
                    </button>
                  </div>
                );
              })
            )}
          </section>

          <section className="mb-6">
            <div className="text-[11px] font-bold text-grey-300 uppercase tracking-wide mb-1.5">
              교재 후보
            </div>
            {eligible.materialSections.length === 0 ? (
              <p className="text-[12.5px] text-grey-500">{noKeyword ? noKeywordNotice : "이 회차의 키워드로 찾은 공개 교재가 없습니다. 교재가 공개되면 여기에 나타납니다."}</p>
            ) : (
              eligible.materialSections.map((s) => (
                <div key={s.sectionId} className="flex items-center justify-between text-[12.5px] py-1.5">
                  <span className="truncate max-w-[480px]">📖 {s.title}</span>
                  <button
                    disabled={pickedIds.has(s.sectionId)}
                    onClick={() => void withSave(() => addUnitPrepItem(overlayUnitId, "material_section", s.sectionId))}
                    className="text-[11.5px] font-bold text-ink disabled:text-grey-300"
                  >
                    {pickedIds.has(s.sectionId) ? "담김" : "담기"}
                  </button>
                </div>
              ))
            )}
          </section>

          <section className="mb-6">
            <div className="text-[11px] font-bold text-grey-300 uppercase tracking-wide mb-1.5">
              문제 후보
            </div>
            {eligible.problems.length === 0 ? (
              <p className="text-[12.5px] text-grey-500">{noKeyword ? noKeywordNotice : "이 회차의 키워드로 확정된 문제가 없습니다. 문제가 확정되면 여기에 나타납니다."}</p>
            ) : (
              eligible.problems.map((p) => (
                <div key={p.problemId} className="flex items-center justify-between text-[12.5px] py-1.5">
                  <span className="truncate max-w-[480px]">✏️ {p.passage ?? "(지문 없음)"}</span>
                  <button
                    disabled={pickedIds.has(p.problemId)}
                    onClick={() => void withSave(() => addUnitPrepItem(overlayUnitId, "problem", p.problemId))}
                    className="text-[11.5px] font-bold text-ink disabled:text-grey-300"
                  >
                    {pickedIds.has(p.problemId) ? "담김" : "담기"}
                  </button>
                </div>
              ))
            )}
          </section>

          <section>
            <div className="text-[11px] font-bold text-grey-300 uppercase tracking-wide mb-2">
              수업에 연결하기
            </div>
            <p className="text-[12px] text-grey-500 mb-2">
              연결해도 아직 고정되지 않습니다 — 수업을 시작할 때 그 시점의 준비 내용이 고정됩니다.
            </p>
            {lessons.length === 0 ? (
              <p className="text-[12.5px] text-grey-500">
                아직 이 학생의 예정된 수업이 없습니다. 수업이 잡히면 여기에서 이 회차를 연결할 수 있습니다.
              </p>
            ) : (
              lessons.map((l) => (
                <div key={l.sessionId} className="flex items-center justify-between text-[12.5px] py-1.5">
                  <span>{formatLessonDate(l.startsAt)}</span>
                  {l.alreadyLinked ? (
                    <button
                      onClick={() => router.push(`/teacher/session-prep/${l.sessionId}`)}
                      className="text-[11.5px] font-bold text-ink"
                    >
                      연결됨 · 수업 준비 →
                    </button>
                  ) : (
                    <button
                      onClick={() =>
                        void withSave(async () => {
                          const result = await linkUnitPrepToLesson(overlayUnitId, l.sessionId);
                          if (!result.ok) throw new Error(result.error);
                          setLessons(await listBookedLessonsForUnit(overlayUnitId));
                        })
                      }
                      className="text-[11.5px] font-bold text-ink"
                    >
                      이 수업에 연결
                    </button>
                  )}
                </div>
              ))
            )}
          </section>
        </>
      )}
    </div>
  );
}

function formatLessonDate(startsAt: string | null): string {
  if (!startsAt) return "일시 미정";
  const d = new Date(startsAt);
  if (Number.isNaN(d.getTime())) return "일시 미정";
  return d.toLocaleString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
