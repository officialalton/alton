"use client";

import { useState, useTransition } from "react";
import {
  assembleMockExamSet,
  getMockExamSetItems,
  publishMockExamSet,
  type MockExamSetItemDetail,
  type MockExamSetSummary,
} from "../mock-exam-actions";
import type { DifficultyTier } from "@/lib/mock-exam/assemble";

const TIER_LABEL: Record<DifficultyTier, string> = { foundation: "기본", standard: "표준", advanced: "상위" };

export default function MockExamSetsPanel({ initialSets }: { initialSets: MockExamSetSummary[] }) {
  const [sets, setSets] = useState(initialSets);
  const [name, setName] = useState("");
  const [tier, setTier] = useState<DifficultyTier>("standard");
  const [rwCount, setRwCount] = useState(27);
  const [mathCount, setMathCount] = useState(22);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [shortfallNotice, setShortfallNotice] = useState<string | null>(null);
  const [reviewingSetId, setReviewingSetId] = useState<string | null>(null);
  const [reviewItems, setReviewItems] = useState<MockExamSetItemDetail[]>([]);

  function refresh() {
    startTransition(async () => {
      const { listMockExamSets } = await import("../mock-exam-actions");
      setSets(await listMockExamSets());
    });
  }

  function handleAssemble() {
    setError(null);
    setShortfallNotice(null);
    startTransition(async () => {
      try {
        const result = await assembleMockExamSet({ name, difficultyTier: tier, rwCount, mathCount });
        if (result.shortfalls.length > 0) {
          setShortfallNotice(
            `일부 영역·난이도 셀에서 목표 문항 수를 채우지 못했습니다: ${result.shortfalls
              .map((s) => `${s.section}/${s.satDomain}/${s.difficulty} (필요 ${s.needed}, 확보 ${s.found})`)
              .join(", ")}`,
          );
        }
        setName("");
        refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "조립 중 오류가 발생했습니다.");
      }
    });
  }

  function handleReview(setId: string) {
    startTransition(async () => {
      setReviewingSetId(setId);
      setReviewItems(await getMockExamSetItems(setId));
    });
  }

  function handlePublish(setId: string) {
    setError(null);
    startTransition(async () => {
      try {
        await publishMockExamSet(setId);
        refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "공개 중 오류가 발생했습니다.");
      }
    });
  }

  return (
    <div className="mt-8 space-y-8">
      <section className="rounded-xl border border-grey-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-ink">새 세트 조립</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <label className="col-span-2 flex flex-col gap-1 text-xs text-grey-500 sm:col-span-1">
            이름
            <input
              className="rounded border border-grey-200 px-2 py-1.5 text-sm text-ink"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 표준 세트 A"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-grey-500">
            난이도 등급
            <select
              className="rounded border border-grey-200 px-2 py-1.5 text-sm text-ink"
              value={tier}
              onChange={(e) => setTier(e.target.value as DifficultyTier)}
            >
              {(Object.keys(TIER_LABEL) as DifficultyTier[]).map((t) => (
                <option key={t} value={t}>
                  {TIER_LABEL[t]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-grey-500">
            R&W 문항 수
            <input
              type="number"
              min={1}
              className="rounded border border-grey-200 px-2 py-1.5 text-sm text-ink"
              value={rwCount}
              onChange={(e) => setRwCount(Number(e.target.value))}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-grey-500">
            Math 문항 수
            <input
              type="number"
              min={1}
              className="rounded border border-grey-200 px-2 py-1.5 text-sm text-ink"
              value={mathCount}
              onChange={(e) => setMathCount(Number(e.target.value))}
            />
          </label>
        </div>
        <button
          type="button"
          disabled={isPending || !name.trim()}
          onClick={handleAssemble}
          className="mt-4 rounded bg-ink px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          조립하기
        </button>
        {error ? <p className="mt-2 text-sm text-red">{error}</p> : null}
        {shortfallNotice ? <p className="mt-2 text-sm text-orange-600">{shortfallNotice}</p> : null}
      </section>

      <section className="rounded-xl border border-grey-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-ink">세트 목록</h2>
        <table className="mt-3 w-full text-left text-sm">
          <thead>
            <tr className="text-xs text-grey-500">
              <th className="py-1">이름</th>
              <th>등급</th>
              <th>상태</th>
              <th>R&W</th>
              <th>Math</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sets.map((s) => (
              <tr key={s.id} className="border-t border-grey-100">
                <td className="py-2">{s.name} <span className="text-xs text-grey-400">v{s.versionNo}</span></td>
                <td>{TIER_LABEL[s.difficultyTier]}</td>
                <td>
                  <span
                    className={
                      s.status === "published" ? "text-green" : s.status === "draft" ? "text-grey-500" : "text-grey-300"
                    }
                  >
                    {s.status === "published" ? "공개" : s.status === "draft" ? "초안" : "보관"}
                  </span>
                </td>
                <td>{s.rwCount}</td>
                <td>{s.mathCount}</td>
                <td className="space-x-2 text-right">
                  <button type="button" className="text-xs text-ink underline" onClick={() => handleReview(s.id)}>
                    검토
                  </button>
                  {s.status === "draft" ? (
                    <button
                      type="button"
                      disabled={isPending}
                      className="text-xs text-ink underline"
                      onClick={() => handlePublish(s.id)}
                    >
                      공개
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
            {sets.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-4 text-center text-sm text-grey-400">
                  아직 조립된 세트가 없습니다.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      {reviewingSetId ? (
        <section className="rounded-xl border border-grey-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-ink">세트 문항 검토</h2>
          <table className="mt-3 w-full text-left text-xs">
            <thead>
              <tr className="text-grey-500">
                <th className="py-1">섹션</th>
                <th>순서</th>
                <th>영역</th>
                <th>세부기술</th>
                <th>난이도</th>
              </tr>
            </thead>
            <tbody>
              {reviewItems.map((item) => (
                <tr key={item.id} className="border-t border-grey-100">
                  <td className="py-1">{item.section === "rw" ? "R&W" : "Math"}</td>
                  <td>{item.position}</td>
                  <td>{item.satDomain}</td>
                  <td>{item.skillCode ?? "—"}</td>
                  <td>{item.difficulty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
    </div>
  );
}
