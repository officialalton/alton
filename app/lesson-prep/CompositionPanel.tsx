"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  addKeyword,
  removeKeyword,
  addMaterial,
  removeMaterial,
  swapMaterialOrder,
  saveGoal,
  previewRecomposition,
  applyRecomposition,
  addProblem,
  removeProblem,
  listLessonsForUnit,
  linkLesson,
  startLesson,
  type PrepLesson,
  type RecompositionSummary,
} from "./actions";
import type {
  KeywordProblem,
  PickableMaterial,
  UnitComposition,
  UnitMaterial,
} from "@/lib/unit-composition";
import LearningText from "@/app/session/[id]/LearningText";
import ProblemFigure from "@/app/session/[id]/ProblemFigure";
import { stripInlineOptions } from "@/lib/problem-text";

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
  const [keywordIds, setKeywordIds] = useState(composition.keywords.map((k) => k.id));
  const [materials, setMaterials] = useState<UnitMaterial[]>(composition.materials);
  const [error, setError] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [goalSaved, setGoalSaved] = useState(false);
  const [pending, setPending] = useState<RecompositionSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [composedProblems, setComposedProblems] = useState(composition.problems);
  // 2026-09-14 UAT: "문제를 클릭하면 문제를 볼 수 있어야 될 거 같아 간략하게라도" — 한 번에 하나만 펼친다.
  const [previewId, setPreviewId] = useState<string | null>(null);

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

      {/* 2026-09-13 확정 4번 — 업데이트 진입점은 **하나**다. 상위에서 보충되는 것과
          지금 조건에 따른 변경을 한 자리에서 확인하고 한 번에 적용한다. */}
      {(composition.hasUnappliedChanges ||
        composition.outdatedVersionCount > 0 ||
        composition.parentPendingCount > 0) && (
          <div className="border-[1.5px] border-grey-200 rounded-xl px-4 py-3.5 mb-5">
            <div className="text-[13px] font-bold text-ink mb-1">업데이트 있음</div>
            <p className="text-[12px] text-grey-500 mb-2.5">
              {composition.parentPendingCount > 0
                ? `위 계층과 어긋난 항목이 ${composition.parentPendingCount}개 있습니다. `
                : ""}
              {composition.hasUnappliedChanges
                ? "키워드·조건이나 교재가 바뀌었습니다. "
                : ""}
              {composition.outdatedVersionCount > 0
                ? `담긴 교재·문제 ${composition.outdatedVersionCount}개가 담을 때의 버전을 쓰고 있습니다. `
                : ""}
              지금 구성은 그대로 유지됩니다. 확인하고 적용해야 반영됩니다.
            </p>

            {pending === null ? (
              <button
                disabled={busy}
                onClick={() => void showChanges()}
                className="text-[12px] font-bold px-3 py-1.5 rounded-lg bg-ink text-white disabled:opacity-50"
              >
                기본 구성 업데이트
              </button>
            ) : (
              <div>
                <ul className="text-[12.5px] text-ink mb-2.5 space-y-0.5">
                  {layer !== "catalog" && (
                    <>
                      <li>
                        위 계층에서 받아올 것 — 키워드 {pending.inheritedKeywords}개 · 교재{" "}
                        {pending.inheritedMaterials}개 · 문제 {pending.inheritedProblems}개
                      </li>
                      <li>
                        위 계층에서 빠져 함께 빠질 것 — 키워드 {pending.withdrawnKeywords}개 · 교재{" "}
                        {pending.withdrawnMaterials}개 · 문제 {pending.withdrawnProblems}개
                      </li>
                      <li>
                        위 계층 순서를 따라 자리가 바뀔 항목 — {pending.reordered}개
                        {pending.orderKeptByChoice > 0 && (
                          <span className="text-grey-500">
                            {" "}
                            (직접 맞춘 순서는 그대로 둡니다)
                          </span>
                        )}
                      </li>
                      <li>
                        목표 —{" "}
                        {pending.goalUpdated > 0
                          ? "위 계층의 목표로 바뀝니다"
                          : pending.goalKeptByChoice > 0
                            ? "직접 고친 목표를 그대로 둡니다"
                            : "바뀌지 않습니다"}
                      </li>
                    </>
                  )}
                  <li>
                    조건에 따른 교재 — 들어옴 {pending.materialsAdded}개 · 빠짐{" "}
                    {pending.materialsRemoved}개
                  </li>
                  <li>
                    조건에 따른 문제 — 들어옴 {pending.problemsAdded}개 · 빠짐{" "}
                    {pending.problemsRemoved}개
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
          이 회차의 키워드로 찾은, 공개된 문제입니다. 모자라도 자동으로 만들지 않습니다. 키워드로 자동으로 들어오는 문제는
          회차당 기본 20개까지이고(직접 담은 것은 세지 않음), 나머지는 여기서 골라 담습니다. 문제를 누르면 간략히 볼 수 있습니다.
        </p>
        {pickableProblems.length === 0 ? (
          <p className="text-[12.5px] text-grey-500 bg-grey-100 rounded-lg px-4 py-4">
            {keywordIds.length === 0
              ? "키워드를 붙이면 해당하는 문제가 여기에 모입니다."
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
      <p className="text-[12px] text-grey-500 mb-2.5">
        연결해도 아직 고정되지 않습니다. <strong className="text-ink">수업 시작</strong>을 누를 때
        지금 준비안의 버전과 순서가 그대로 고정되고, 이후 내용이 바뀌어도 그 수업은 바뀌지 않습니다.
      </p>

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
