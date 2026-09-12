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
  type UnitPrep,
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

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      loadUnitPrep(overlayUnitId),
      loadUnitEligibleContent(overlayUnitId),
      listBookedLessonsForUnit(overlayUnitId),
    ])
      .then(([p, content, booked]) => {
        if (cancelled) return;
        setPrep(p);
        setGoalDraft(p.goal);
        setEligible(content);
        setLessons(booked);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "회차 준비를 불러오지 못했습니다.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [overlayUnitId]);

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
          회차 준비
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
              <p className="text-[12.5px] text-grey-500">이 회차의 키워드로 찾은 공개 교재가 없습니다.</p>
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
              <p className="text-[12.5px] text-grey-500">이 회차의 키워드로 공개된 문제가 없습니다.</p>
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
                      연결됨 · 수업 열기 →
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
