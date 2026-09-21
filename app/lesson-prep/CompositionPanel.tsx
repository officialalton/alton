"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  addKeyword,
  removeKeyword,
  addMaterial,
  removeMaterial,
  swapMaterialOrder,
  previewRecomposition,
  applyRecomposition,
  addProblem,
  removeProblem,
  listLessonsForUnit,
  linkLesson,
  startLesson,
  type PrepLesson,
} from "./actions";
import type {
  KeywordProblem,
  PickableMaterial,
  PrepLayer,
  UnitComposition,
  UnitMaterial,
} from "@/lib/unit-composition";
import LearningText from "@/app/session/[id]/LearningText";
import ProblemFigure from "@/app/session/[id]/ProblemFigure";
import { stripInlineOptions } from "@/lib/problem-text";
import { SKILL_CODES, domainShort, skillLabel } from "@/lib/problem-taxonomy";
import { materialStatusLines } from "@/lib/problem-material-need";

const OPTION_LABELS = ["A", "B", "C", "D", "E", "F"];

// 세 계층이 같이 쓰는 수업 준비 구성 패널.
//
// 2026-09-13 지시 4절: "세 계층은 같은 UI를 재사용한다. 상단에 관리자 기준본 /
// 내 기본 구성 / ○○ 학생과 과목·회차를 표시해 수정 대상을 분명히 한다."
//
// 관리자·선생님 기본 계층은 교재·문제를 미리보고 기본 구성을 편집한다. 실제
// 예약·수업 시작·학생 답안·수업 기록은 학생별 문맥에서만 다루므로, 그 부분은
// 이 패널이 아니라 학생 계층 화면이 덧붙인다.
export default function CompositionPanel({
  composition,
  pickable,
  problems,
  scopeNotice = null,
}: {
  composition: UnitComposition;
  pickable: PickableMaterial[];
  /** 이 회차 키워드로 들어올 문제. 학생 층이 아니면 미리보기 전용이다. */
  problems: KeywordProblem[];
  /**
   * 이 화면에서 고치는 것이 무엇에 적용되는지. 이미 시작한 수업 안에서 열렸을 때처럼
   * **보이는 것과 적용 범위가 다른** 자리에서 반드시 채운다 — 시작된 수업의 고정
   * 콘텐츠를 여기서 고치는 것처럼 보이면 안 된다.
   */
  scopeNotice?: string | null;
}) {
  const router = useRouter();
  const [keywordIds, setKeywordIds] = useState(composition.keywords.map((k) => k.id));
  const [materials, setMaterials] = useState<UnitMaterial[]>(composition.materials);
  const [error, setError] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [busy, setBusy] = useState(false);
  const [composedProblems, setComposedProblems] = useState(composition.problems);
  // window.location.reload() 대신 router.refresh() 로 서버 데이터만 다시 받는다(전체 새로고침 제거).
  // composition prop 이 새 참조로 들어오면(서버가 다시 내려준 것) 위 파생 상태를 그 값으로 맞춘다 —
  // 그렇지 않으면 router.refresh() 뒤에도 마운트 시점 값이 그대로 남는다(컴포넌트가 재마운트되지 않으므로).
  useEffect(() => {
    // 낙관적 업데이트(토글 직후)와 서버 재조회 결과를 같은 state 로 합친다 — React 공식 가이드가
    // 인정하는 "prop 변경에 맞춰 state 를 조정" 패턴이다(단순 파생이면 렌더 중 계산하겠지만, 이 값은
    // 그 사이 낙관적으로도 바뀐다).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setKeywordIds(composition.keywords.map((k) => k.id));
    setMaterials(composition.materials);
    setComposedProblems(composition.problems);
  }, [composition]);
  // 2026-09-14 UAT: "문제를 클릭하면 문제를 볼 수 있어야 될 거 같아 간략하게라도" — 한 번에 하나만 펼친다.
  const [previewId, setPreviewId] = useState<string | null>(null);
  // 분류로 좁혀 담기(2026-09-14) — 기술 코드 기준.
  const [skillFilter, setSkillFilter] = useState("");

  // 후보에서 이미 담긴 것은 뺀다 — 같은 문제가 양쪽에 보이면 무엇을 눌러야 할지
  // 알 수 없다.
  const composedIds = new Set(composedProblems.map((p) => p.problemId));
  const pickableAll = problems.filter((p) => !composedIds.has(p.problemId));
  const pickableProblems = skillFilter ? pickableAll.filter((p) => p.skillCode === skillFilter) : pickableAll;
  const skillsInPool = SKILL_CODES.filter((k) => pickableAll.some((p) => p.skillCode === k.code));
  // 기술 코드별 자료 현황 안내(2026-09-14) — 자동으로 문제를 넣고 빼는 기준이 아니다. 보여주기만 한다.
  const materialLines = materialStatusLines(pickableAll.map((p) => ({ skillCode: p.skillCode ?? null, examSystem: p.examSystem ?? null, text: p.preview?.passage ?? p.label, figure: p.preview?.figure ?? null })));

  async function takeProblem(problemId: string) {
    setBusy(true);
    setError(null);
    const result = await addProblem(layer, unitId, problemId);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    const picked = problems.find((p) => p.problemId === problemId);
    setComposedProblems((prev) => [
      ...prev,
      {
        problemId,
        label: picked?.label ?? "",
        position: prev.length + 1,
        difficulty: picked?.difficulty ?? null,
        source: "manual" as const,
        // 서버가 담는 순간의 공개 버전을 찍는다. 화면은 그 사실만 표시한다.
        problemVersionId: "pending",
      },
    ]);
  }

  async function dropProblem(problemId: string) {
    setBusy(true);
    setError(null);
    const result = await removeProblem(layer, unitId, problemId);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setComposedProblems((prev) => prev.filter((p) => p.problemId !== problemId));
  }

  const { layer, unitId } = composition;
  const pickedIds = new Set(materials.map((m) => m.curriculumDocId));
  const titleById = new Map(pickable.map((p) => [p.curriculumDocId, p.title]));

  // 2026-09-21(제품 오너 지시) — 단원·키워드만 검색해서 추가/제거하면 나머지(교재·문제
  // 구성)는 그냥 자동으로 반영돼야 한다. 예전엔 키워드를 바꾼 뒤 "구성에 반영되지 않은
  // 변경 있음" 배너를 보고 사람이 "기본 구성 업데이트" → 변경분 확인 → 적용을 따로 눌러야
  // 했다 — 그 중간 확인 단계를 없애고 키워드 토글 즉시 다시 구성해 반영한다.
  async function toggleKeyword(keywordId: string, attached: boolean) {
    setBusy(true);
    setError(null);
    const result = attached
      ? await removeKeyword(layer, unitId, keywordId)
      : await addKeyword(layer, unitId, keywordId);
    if (!result.ok) {
      setBusy(false);
      setError(result.error);
      return;
    }
    setKeywordIds((prev) =>
      attached ? prev.filter((k) => k !== keywordId) : [...prev, keywordId]
    );
    if (composition.composed) {
      const preview = await previewRecomposition(layer, unitId);
      if (preview.ok) await applyRecomposition(layer, unitId, preview.value.fingerprint);
    }
    setBusy(false);
    router.refresh();
  }

  async function handleRemoveMaterial(docId: string) {
    const result = await removeMaterial(layer, unitId, docId);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    setMaterials((prev) => prev.filter((m) => m.curriculumDocId !== docId));
  }

  async function handleAddMaterial(docId: string) {
    const result = await addMaterial(layer, unitId, docId);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    setMaterials((prev) => [
      ...prev,
      {
        curriculumDocId: docId,
        title: titleById.get(docId) ?? "(제목 없음)",
        position: (prev[prev.length - 1]?.position ?? 0) + 1,
        source: "manual",
      },
    ]);
  }

  async function handleMove(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= materials.length) return;
    const a = materials[index];
    const b = materials[target];
    const result = await swapMaterialOrder(layer, unitId, a.curriculumDocId, b.curriculumDocId);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    const next = [...materials];
    next[index] = { ...b, position: a.position };
    next[target] = { ...a, position: b.position };
    next.sort((x, y) => x.position - y.position);
    setMaterials(next);
  }

  return (
    <div className="max-w-[720px] px-8 py-8">
      {/* 무엇을 고치는 중인지 먼저 말한다 — 세 계층이 같은 화면이라 여기가 흐리면
          선생님이 학생 것을 고치는지 자기 기본을 고치는지 알 수 없다. */}
      <div className="text-[12px] font-bold text-grey-500 mb-1">{composition.scopeLabel}</div>
      <h1 className="text-[21px] font-extrabold text-ink leading-tight">
        {composition.unitTitle}
      </h1>
      <p className="text-[12.5px] text-grey-500 mt-1 mb-5">{composition.subjectName}</p>

      {scopeNotice && (
        <div className="text-[12.5px] text-ink bg-grey-100 border-[1.5px] border-grey-200 rounded-lg px-4 py-3 mb-4">
          {scopeNotice}
        </div>
      )}

      {error && (
        <div className="text-[12.5px] text-red bg-red/5 border-[1.5px] border-red/20 rounded-lg px-4 py-2.5 mb-4">
          {error}
        </div>
      )}

      {/* 2026-09-21(제품 오너 지시) — 위 계층 변경·버전 갱신도 확인 배너 없이 자동으로
          맞춘다. 반영 중에만 조용히 표시한다("확인하고 적용" 단계 제거). */}
      {(composition.hasUnappliedChanges ||
        composition.outdatedVersionCount > 0 ||
        composition.parentPendingCount > 0) && (
          <AutoSync layer={layer} unitId={unitId} onDone={() => router.refresh()} />
        )}

      <section className="mb-7">
        <h2 className="text-[13px] font-bold text-ink mb-1">키워드</h2>
        {composition.subjectKeywords.length === 0 ? (
          <p className="text-[12.5px] text-grey-500 bg-grey-100 rounded-lg px-4 py-3">
            이 과목에 등록된 키워드가 없습니다.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {composition.subjectKeywords.map((k) => {
              const attached = keywordIds.includes(k.id);
              return (
                <button
                  key={k.id}
                  onClick={() => toggleKeyword(k.id, attached)}
                  aria-pressed={attached}
                  className={
                    "text-[12px] font-semibold px-3 py-1.5 rounded-full border-[1.5px] " +
                    (attached
                      ? "bg-ink text-white border-ink"
                      : "bg-white text-grey-500 border-grey-200")
                  }
                >
                  {k.label}
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-[13px] font-bold text-ink">교재</h2>
          <button
            onClick={() => setShowPicker((v) => !v)}
            className="text-[12px] font-bold px-3 py-1.5 rounded-lg border-[1.5px] border-grey-200 text-ink"
          >
            {showPicker ? "닫기" : "직접 담기"}
          </button>
        </div>

        {materials.length === 0 ? (
          <p className="text-[12.5px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center">
            아직 담긴 교재가 없습니다. 키워드를 붙이거나 직접 담아 주세요.
          </p>
        ) : (
          materials.map((m, idx) => (
            <div
              key={m.curriculumDocId}
              className="border-[1.5px] border-grey-200 rounded-xl px-4 py-3 mb-2 flex items-center gap-3"
            >
              <span className="text-[12px] font-bold text-grey-300 w-5 shrink-0">{idx + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-ink truncate">{m.title}</div>
                <span
                  className={
                    "text-[10.5px] font-bold px-1.5 py-0.5 rounded mt-1 inline-block " +
                    (m.source === "auto"
                      ? "bg-grey-100 text-grey-500"
                      : "bg-ink/5 text-ink")
                  }
                >
                  {m.source === "auto" ? "키워드에서 자동" : "직접 담음"}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  disabled={idx === 0}
                  onClick={() => handleMove(idx, -1)}
                  className="text-[12px] font-semibold text-grey-500 disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  disabled={idx === materials.length - 1}
                  onClick={() => handleMove(idx, 1)}
                  className="text-[12px] font-semibold text-grey-500 disabled:opacity-30"
                >
                  ↓
                </button>
                <button
                  onClick={() => handleRemoveMaterial(m.curriculumDocId)}
                  className="text-[12px] font-semibold text-red"
                >
                  빼기
                </button>
              </div>
            </div>
          ))
        )}

        {showPicker && (
          <div className="border-[1.5px] border-grey-200 rounded-xl px-4 py-3 mt-3">
            {pickable.length === 0 ? (
              <p className="text-[12.5px] text-grey-500">담을 수 있는 교재가 없습니다.</p>
            ) : (
              pickable.map((p) => (
                <div key={p.curriculumDocId} className="flex items-center gap-3 py-1.5">
                  <div className="flex-1 min-w-0">
                    <div className="text-[12.5px] text-ink truncate">
                      {p.kind !== "html" && (
                        <span className="text-[10px] font-bold text-grey-500 border border-grey-200 rounded-full px-1.5 py-0.5 mr-1.5 align-middle">
                          {p.kind === "pdf" ? "PDF" : "영상"}
                        </span>
                      )}
                      {p.title}
                    </div>
                    {p.primaryKeywordLabel && (
                      <div className="text-[11px] text-grey-500">{p.primaryKeywordLabel}</div>
                    )}
                  </div>
                  {pickedIds.has(p.curriculumDocId) ? (
                    <span className="text-[11.5px] text-grey-300 font-semibold shrink-0">담김</span>
                  ) : (
                    <button
                      onClick={() => handleAddMaterial(p.curriculumDocId)}
                      className="text-[11.5px] font-bold px-2.5 py-1 rounded-lg border-[1.5px] border-grey-200 text-ink shrink-0"
                    >
                      담기
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </section>

      {/* 2026-09-13 지시 3번 — 문제를 담는 일이 별도 화면에만 있으면 안 된다.
          세 계층 모두 여기서 담고 뺀다. 담기는 자리만 다르다(학생 층은 준비안). */}
      <section className="mt-7">
        <h2 className="text-[13px] font-bold text-ink mb-1">
          문제
          <span className="text-grey-300 font-semibold ml-1.5">{composedProblems.length}</span>
        </h2>

        {composedProblems.length === 0 ? (
          <p className="text-[12.5px] text-grey-500 bg-grey-100 rounded-lg px-4 py-4">
            아직 담긴 문제가 없습니다. 아래 후보에서 고르세요.
          </p>
        ) : (
          <ul className="border-[1.5px] border-grey-200 rounded-xl divide-y divide-grey-100">
            {composedProblems.map((p) => (
              <li key={p.problemId} className="px-4 py-2.5 flex items-center gap-3">
                <span className="text-[12.5px] text-ink flex-1 min-w-0 truncate">{p.label}</span>
                {p.source === "auto" && (
                  <span className="text-[10.5px] font-bold px-1.5 py-0.5 rounded bg-grey-100 text-grey-500 shrink-0">
                    키워드에서 자동
                  </span>
                )}
                {!p.problemVersionId && (
                  <span className="text-[10.5px] font-bold px-1.5 py-0.5 rounded bg-grey-100 text-grey-500 shrink-0">
                    버전 미기록
                  </span>
                )}
                {p.difficulty && (
                  <span className="text-[10.5px] font-bold px-1.5 py-0.5 rounded bg-grey-100 text-grey-500 shrink-0">
                    {p.difficulty}
                  </span>
                )}
                <button
                  disabled={busy}
                  onClick={() => void dropProblem(p.problemId)}
                  className="text-[11.5px] font-bold text-red shrink-0 disabled:opacity-50"
                >
                  빼기
                </button>
              </li>
            ))}
          </ul>
        )}

        <h3 className="text-[12.5px] font-bold text-ink mt-5 mb-1">더 담기</h3>
        {materialLines.length > 0 && (
          <ul className="text-[12px] text-grey-500 mb-2 list-disc pl-5" data-testid="material-status">
            {materialLines.map((l) => <li key={l}>{l}</li>)}
          </ul>
        )}
        {skillsInPool.length > 0 && (
          <label className="flex flex-wrap items-center gap-2 text-[12px] text-ink mb-2">
            <span className="text-grey-500">세부 기술</span>
            <select
              aria-label="세부 기술로 좁히기"
              value={skillFilter}
              onChange={(e) => setSkillFilter(e.target.value)}
              className="text-[12px] border-[1.5px] border-grey-200 rounded-lg px-2 py-1 max-w-[320px]"
            >
              <option value="">모두 ({pickableAll.length})</option>
              {skillsInPool.map((k) => (
                <option key={k.code} value={k.code}>
                  {k.label} ({pickableAll.filter((p) => p.skillCode === k.code).length})
                </option>
              ))}
            </select>
          </label>
        )}
        {pickableProblems.length === 0 ? (
          <p className="text-[12.5px] text-grey-500 bg-grey-100 rounded-lg px-4 py-4">
            {keywordIds.length === 0
              ? "키워드를 붙이면 해당하는 문제가 여기에 모입니다."
              : skillFilter
                ? "이 기술의 문제는 더 없습니다."
                : "더 담을 문제가 없습니다."}
          </p>
        ) : (
          <ul className="border-[1.5px] border-grey-200 rounded-xl divide-y divide-grey-100">
            {pickableProblems.map((p) => {
              const open = previewId === p.problemId;
              return (
                <li key={p.problemId} className="px-4 py-2.5">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setPreviewId(open ? null : p.problemId)}
                      aria-expanded={open}
                      title={open ? "미리보기 닫기" : "문제 미리보기"}
                      className="text-[12.5px] text-ink flex-1 min-w-0 truncate text-left hover:underline"
                    >
                      {p.label}
                    </button>
                    {p.skillCode && (
                      <span className="text-[10.5px] font-bold px-1.5 py-0.5 rounded bg-grey-100 text-grey-500 shrink-0" title={skillLabel(p.skillCode) ?? undefined}>
                        {domainShort(p.satDomain)} › {skillLabel(p.skillCode)}
                      </span>
                    )}
                    {p.difficulty && (
                      <span className="text-[10.5px] font-bold px-1.5 py-0.5 rounded bg-grey-100 text-grey-500 shrink-0">
                        {p.difficulty}
                      </span>
                    )}
                    <button
                      disabled={busy}
                      onClick={() => void takeProblem(p.problemId)}
                      className="text-[11.5px] font-bold text-ink shrink-0 disabled:opacity-50"
                    >
                      담기
                    </button>
                  </div>
                  {open && <ProblemPreview problem={p} />}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* 2026-09-13 확정 1번 — 연결은 아무것도 고정하지 않는다. **시작만** 고정한다.
          그래서 이 둘이 같은 화면에 있고, 다른 화면으로 건너뛰게 하지 않는다. */}
      {layer === "student" && <LessonSection unitId={unitId} />}
    </div>
  );
}

/** 담기 전 간략 미리보기 — 학생이 볼 지문·그림·선택지만. 정답·해설은 문제은행에서 본다. */
/** 2026-09-21(제품 오너 지시) — 위 계층·버전 변경으로 생긴 차이를 확인 배너 없이 조용히
 * 맞춘다. 마운트 시 한 번만 미리보기+적용을 실행하고 부모에 새로고침을 요청한다. */
function AutoSync({ layer, unitId, onDone }: { layer: PrepLayer; unitId: string; onDone: () => void }) {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const preview = await previewRecomposition(layer, unitId);
      if (!cancelled && preview.ok) await applyRecomposition(layer, unitId, preview.value.fingerprint);
      if (!cancelled) onDone();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layer, unitId]);
  return null;
}

function ProblemPreview({ problem }: { problem: KeywordProblem }) {
  const pv = problem.preview;
  if (!pv) {
    return (
      <p className="mt-2 text-[12px] text-grey-500" data-testid="problem-preview">
        공개된 버전을 읽을 수 없어 미리보기를 보여줄 수 없습니다.
      </p>
    );
  }
  return (
    <div className="mt-2 rounded-lg bg-grey-100 px-4 py-3" data-testid="problem-preview">
      <ProblemFigure spec={pv.figure} className="mb-2" />
      <LearningText
        text={stripInlineOptions(pv.passage, pv.options) || "(본문 없음)"}
        className="learning-body text-[13px] leading-[1.7] text-ink"
      />
      {pv.options.length > 0 && (
        <ol className="mt-2 space-y-1">
          {pv.options.map((o, i) => (
            <li key={i} className="flex gap-2 text-[12.5px] text-ink">
              <span className="font-bold text-grey-500 shrink-0">{OPTION_LABELS[i] ?? i + 1}</span>
              <LearningText text={o} className="learning-body" />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function LessonSection({ unitId }: { unitId: string }) {
  const router = useRouter();
  const [lessons, setLessons] = useState<PrepLesson[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listLessonsForUnit("student", unitId)
      .then((rows) => {
        if (!cancelled) setLessons(rows);
      })
      .catch(() => {
        if (!cancelled) setLessons([]);
      });
    return () => {
      cancelled = true;
    };
  }, [unitId]);

  async function run(job: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setBusy(true);
    setError(null);
    const result = await job();
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    return true;
  }

  return (
    <section className="mt-7">
      <h2 className="text-[13px] font-bold text-ink mb-1">예정된 수업</h2>

      {error && <p className="text-[12.5px] text-red mb-2">{error}</p>}

      {lessons === null ? (
        <p className="text-[12.5px] text-grey-500">불러오는 중...</p>
      ) : lessons.length === 0 ? (
        <p className="text-[12.5px] text-grey-500 bg-grey-100 rounded-lg px-4 py-4">
          아직 이 학생의 예정된 수업이 없습니다. 수업이 잡히면 여기에 나타납니다.
        </p>
      ) : (
        <ul className="border-[1.5px] border-grey-200 rounded-xl divide-y divide-grey-100">
          {lessons.map((l) => (
            <li key={l.sessionId} className="px-4 py-2.5 flex items-center gap-3">
              <span className="text-[12.5px] text-ink flex-1">{formatLessonDate(l.startsAt)}</span>
              {l.linked ? (
                <button
                  disabled={busy}
                  onClick={async () => {
                    if (await run(() => startLesson(l.sessionId))) {
                      router.push(`/session/${l.sessionId}`);
                    }
                  }}
                  className="text-[12px] font-bold px-3 py-1.5 rounded-lg bg-ink text-white disabled:opacity-50"
                >
                  수업 시작
                </button>
              ) : (
                <button
                  disabled={busy}
                  onClick={async () => {
                    if (await run(() => linkLesson(unitId, l.sessionId))) {
                      setLessons(await listLessonsForUnit("student", unitId));
                    }
                  }}
                  className="text-[12px] font-bold px-3 py-1.5 rounded-lg border-[1.5px] border-grey-200 text-ink disabled:opacity-50"
                >
                  이 수업에 연결
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function formatLessonDate(startsAt: string | null): string {
  if (!startsAt) return "시간 미정";
  const d = new Date(startsAt);
  return d.toLocaleString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}
