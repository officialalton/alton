"use client";

import { useState } from "react";
import {
  addKeyword,
  removeKeyword,
  addMaterial,
  removeMaterial,
  swapMaterialOrder,
  saveGoal,
  previewRecomposition,
  applyRecomposition,
  inheritDefaults,
  addProblem,
  removeProblem,
  type RecompositionSummary,
} from "./actions";
import type {
  KeywordProblem,
  PickableMaterial,
  UnitComposition,
  UnitMaterial,
} from "@/lib/unit-composition";

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
  backHref = null,
  backLabel = null,
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
  /** 예약된 수업에서 들어왔을 때 그 수업으로 돌아가는 길. */
  backHref?: string | null;
  backLabel?: string | null;
}) {
  const [keywordIds, setKeywordIds] = useState(composition.keywords.map((k) => k.id));
  const [materials, setMaterials] = useState<UnitMaterial[]>(composition.materials);
  const [error, setError] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [goalSaved, setGoalSaved] = useState(false);
  const [pending, setPending] = useState<RecompositionSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [composedProblems, setComposedProblems] = useState(composition.problems);

  // 후보에서 이미 담긴 것은 뺀다 — 같은 문제가 양쪽에 보이면 무엇을 눌러야 할지
  // 알 수 없다.
  const composedIds = new Set(composedProblems.map((p) => p.problemId));
  const pickableProblems = problems.filter((p) => !composedIds.has(p.problemId));

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

  async function toggleKeyword(keywordId: string, attached: boolean) {
    const result = attached
      ? await removeKeyword(layer, unitId, keywordId)
      : await addKeyword(layer, unitId, keywordId);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    setKeywordIds((prev) =>
      attached ? prev.filter((k) => k !== keywordId) : [...prev, keywordId]
    );
    // 2026-09-13 확정(A안): 키워드를 바꿔도 구성을 자동으로 다시 계산하지 않는다.
    // 최초 구성일 때만 서버가 한 번에 채우므로 그때는 다시 받아 그린다. 이미
    // 구성된 회차라면 '구성에 반영되지 않은 변경 있음'만 뜨고 구성은 그대로다.
    window.location.reload();
  }

  async function showChanges() {
    setBusy(true);
    setError(null);
    const result = await previewRecomposition(layer, unitId);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setPending(result.value);
  }

  async function pullFromParent() {
    setBusy(true);
    setError(null);
    setNotice(null);
    const result = await inheritDefaults(layer, unitId);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    const { keywordsAdded, materialsAdded, problemsAdded } = result.value;
    if (keywordsAdded + materialsAdded + problemsAdded === 0) {
      setNotice("가져올 것이 없습니다 — 이미 다 물려받았거나 위 구성이 비어 있습니다.");
      return;
    }
    window.location.reload();
  }

  async function applyChanges() {
    setBusy(true);
    setError(null);
    // 미리 본 시점의 지문을 들고 간다. 그 사이에 바뀌었으면 서버가 거절하고,
    // 화면은 변경분을 다시 보여준다 — 적힌 것과 다른 결과가 조용히 들어가지 않는다.
    const result = await applyRecomposition(layer, unitId, pending?.fingerprint ?? null);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      if ("stale" in result && result.stale) {
        setPending(null);
        await showChanges();
      }
      return;
    }
    window.location.reload();
  }

  async function handleGoalBlur(value: string) {
    if (value === (composition.goal ?? "")) return;
    const result = await saveGoal(layer, unitId, value);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    setGoalSaved(true);
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
      {backHref && backLabel && (
        <a
          href={backHref}
          className="inline-block text-[12.5px] font-bold px-3 py-1.5 rounded-lg border-[1.5px] border-grey-200 text-ink mb-4"
        >
          {backLabel} →
        </a>
      )}
      <div className="text-[12px] font-bold text-grey-500 mb-1">{composition.scopeLabel}</div>
      <h1 className="text-[21px] font-extrabold text-ink leading-tight">
        {composition.unitTitle}
      </h1>
      <p className="text-[12.5px] text-grey-500 mt-1 mb-5">
        {composition.subjectName}
        {layer !== "student" && " · 여기서 정한 구성이 학생 커리큘럼의 기본값이 됩니다"}
      </p>

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
      {notice && <p className="text-[12.5px] text-grey-500 mb-4">{notice}</p>}

      {/* 회차를 새로 만들면 상속이 자동으로 끝난다. 그 전에 만들어진 회차는 비어 있을
          수 있으므로 여기서 부른다 — 소급해서 자동으로 채우면 선생님이 일부러 비워 둔
          것과 구분할 수 없다. */}
      {composition.hasInheritableDefaults && (
        <div className="border-[1.5px] border-grey-200 rounded-xl px-4 py-3.5 mb-5">
          <div className="text-[13px] font-bold text-ink mb-1">위 구성 물려받기</div>
          <p className="text-[12px] text-grey-500 mb-2.5">
            {layer === "teacher"
              ? "관리자 기준본의 키워드·교재·문제를 담을 때의 버전·순서 그대로 가져옵니다."
              : "선생님 기본 구성(없으면 관리자 기준본)의 키워드·교재·문제를 담을 때의 버전·순서 그대로 가져옵니다."}{" "}
            이미 담긴 것과 뺀 것은 건드리지 않습니다.
          </p>
          <button
            disabled={busy}
            onClick={() => void pullFromParent()}
            className="text-[12px] font-bold px-3 py-1.5 rounded-lg border-[1.5px] border-grey-200 text-ink disabled:opacity-50"
          >
            물려받기
          </button>
        </div>
      )}

      {/* 구성은 사람이 다시 구성을 누르기 전까지 그대로다. 달라진 것이 있으면
          여기서 알리고, 무엇이 달라지는지 확인한 뒤 적용하게 한다. */}
      {composition.composed &&
        (composition.hasUnappliedChanges || composition.outdatedVersionCount > 0) && (
          <div className="border-[1.5px] border-grey-200 rounded-xl px-4 py-3.5 mb-5">
            <div className="text-[13px] font-bold text-ink mb-1">
              구성에 반영되지 않은 변경 있음
            </div>
            <p className="text-[12px] text-grey-500 mb-2.5">
              {composition.hasUnappliedChanges
                ? "키워드·조건이나 교재가 바뀌었습니다. "
                : ""}
              {composition.outdatedVersionCount > 0
                ? `담긴 교재·문제 ${composition.outdatedVersionCount}개가 담을 때의 버전을 쓰고 있습니다. `
                : ""}
              지금 구성은 그대로 유지됩니다. 다시 구성해야 반영됩니다.
            </p>

            {pending === null ? (
              <button
                disabled={busy}
                onClick={() => void showChanges()}
                className="text-[12px] font-bold px-3 py-1.5 rounded-lg bg-ink text-white disabled:opacity-50"
              >
                다시 구성
              </button>
            ) : (
              <div>
                <ul className="text-[12.5px] text-ink mb-2.5 space-y-0.5">
                  <li>
                    교재 — 들어옴 {pending.materialsAdded}개 · 빠짐 {pending.materialsRemoved}개
                  </li>
                  <li>
                    문제 — 들어옴 {pending.problemsAdded}개 · 빠짐 {pending.problemsRemoved}개
                  </li>
                  <li>버전이 올라갈 항목 — {pending.versionsUpdated}개</li>
                  <li className="text-grey-500">
                    조건에 맞는 문제는 모두 {pending.problemsAvailable}개입니다. 모자라도
                    자동으로 채우지 않습니다.
                  </li>
                </ul>
                <p className="text-[11.5px] text-grey-500 mb-2.5">
                  직접 담은 것·뺀 것·맞춰 둔 순서는 그대로 남습니다. 이미 시작한 수업은
                  당시 버전을 그대로 씁니다.
                </p>
                <div className="flex gap-2">
                  <button
                    disabled={busy}
                    onClick={() => void applyChanges()}
                    className="text-[12px] font-bold px-3 py-1.5 rounded-lg bg-ink text-white disabled:opacity-50"
                  >
                    적용
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => setPending(null)}
                    className="text-[12px] font-bold px-3 py-1.5 rounded-lg border-[1.5px] border-grey-200 text-ink disabled:opacity-50"
                  >
                    취소
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

      <section className="mb-7">
        <h2 className="text-[13px] font-bold text-ink mb-1">
          이 회차의 목표
          {goalSaved && <span className="text-[11.5px] font-semibold text-grey-300 ml-2">저장됨</span>}
        </h2>
        <p className="text-[12px] text-grey-500 mb-2">
          {layer === "student"
            ? "이 학생의 이번 회차에서 달성할 것입니다. 수업·복습 화면의 머리말로 쓰입니다."
            : "여기서 적은 목표는 아래 계층으로 내려갑니다. 아래에서 고친 목표는 덮어쓰지 않습니다."}
        </p>
        <textarea
          defaultValue={composition.goal ?? ""}
          onBlur={(e) => handleGoalBlur(e.target.value)}
          rows={2}
          placeholder={
            composition.goal === null
              ? "아직 정해지지 않았습니다"
              : "비워 두면 목표 없이 진행합니다"
          }
          className="w-full px-3 py-2 border-[1.5px] border-grey-200 rounded-lg text-[13px] leading-[1.6]"
        />
      </section>

      <section className="mb-7">
        <h2 className="text-[13px] font-bold text-ink mb-1">회차 키워드</h2>
        <p className="text-[12px] text-grey-500 mb-2.5">
          키워드를 붙이면 그 키워드의 기본 교재가 아래 구성에 자동으로 들어옵니다.
        </p>
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
          <h2 className="text-[13px] font-bold text-ink">교재 구성</h2>
          <button
            onClick={() => setShowPicker((v) => !v)}
            className="text-[12px] font-bold px-3 py-1.5 rounded-lg border-[1.5px] border-grey-200 text-ink"
          >
            {showPicker ? "닫기" : "교재 담기"}
          </button>
        </div>
        <p className="text-[12px] text-grey-500 mb-2.5">
          자동으로 들어온 교재는 키워드를 떼면 함께 빠집니다. 직접 담은 교재는 그대로 남습니다.
        </p>

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
            <p className="text-[12px] text-grey-500 mb-2">
              공개된 교재만 보입니다. 보관된 교재는 새로 담는 목록에서 빠집니다.
            </p>
            {pickable.length === 0 ? (
              <p className="text-[12.5px] text-grey-500">담을 수 있는 교재가 없습니다.</p>
            ) : (
              pickable.map((p) => (
                <div key={p.curriculumDocId} className="flex items-center gap-3 py-1.5">
                  <div className="flex-1 min-w-0">
                    <div className="text-[12.5px] text-ink truncate">{p.title}</div>
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
          이 회차의 문제
          <span className="text-grey-300 font-semibold ml-1.5">{composedProblems.length}</span>
        </h2>
        <p className="text-[12px] text-grey-500 mb-2.5">
          {layer === "student"
            ? "이 학생이 이번 회차에서 풀 문제입니다. 수업을 시작하면 여기 담긴 그대로, 담을 때의 버전으로 고정됩니다."
            : "여기서 담은 문제가 아래 계층의 기본값이 됩니다."}
        </p>

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

        <h3 className="text-[12.5px] font-bold text-ink mt-5 mb-1">담을 수 있는 문제</h3>
        <p className="text-[12px] text-grey-500 mb-2">
          이 회차의 키워드로 찾은, 공개된 문제입니다. 모자라도 자동으로 만들지 않습니다.
        </p>
        {pickableProblems.length === 0 ? (
          <p className="text-[12.5px] text-grey-500 bg-grey-100 rounded-lg px-4 py-4">
            {keywordIds.length === 0
              ? "키워드를 붙이면 해당하는 문제가 여기에 모입니다."
              : "더 담을 문제가 없습니다."}
          </p>
        ) : (
          <ul className="border-[1.5px] border-grey-200 rounded-xl divide-y divide-grey-100">
            {pickableProblems.map((p) => (
              <li key={p.problemId} className="px-4 py-2.5 flex items-center gap-3">
                <span className="text-[12.5px] text-ink flex-1 min-w-0 truncate">{p.label}</span>
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
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
