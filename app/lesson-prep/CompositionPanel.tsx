"use client";

import { useState } from "react";
import { addKeyword, removeKeyword, addMaterial, removeMaterial, swapMaterialOrder } from "./actions";
import type { PickableMaterial, UnitComposition, UnitMaterial } from "@/lib/unit-composition";

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
}: {
  composition: UnitComposition;
  pickable: PickableMaterial[];
}) {
  const [keywordIds, setKeywordIds] = useState(composition.keywords.map((k) => k.id));
  const [materials, setMaterials] = useState<UnitMaterial[]>(composition.materials);
  const [error, setError] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);

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
    // 키워드가 바뀌면 자동 구성이 DB에서 다시 계산된다. 화면이 그 결과를 추측하면
    // 실제와 어긋나므로 서버가 그린 상태를 다시 받는다.
    window.location.reload();
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

      {error && (
        <div className="text-[12.5px] text-red bg-red/5 border-[1.5px] border-red/20 rounded-lg px-4 py-2.5 mb-4">
          {error}
        </div>
      )}

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
    </div>
  );
}
