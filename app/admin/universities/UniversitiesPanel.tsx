"use client";

import { useState, useTransition } from "react";
import {
  addUniversityUpdate,
  getUniversityDetail,
  listUniversities,
  upsertAdmissionCycle,
  type AdmissionCycle,
  type UniversityDetail,
  type UniversitySummary,
  type UniversityUpdateEntry,
} from "@/lib/universities/actions";

const CURRENT_CYCLE_YEAR = 2027;

export default function UniversitiesPanel({ initialUniversities }: { initialUniversities: UniversitySummary[] }) {
  const [universities, setUniversities] = useState(initialUniversities);
  const [search, setSearch] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<UniversityDetail | null>(null);
  const [cycles, setCycles] = useState<AdmissionCycle[]>([]);
  const [updates, setUpdates] = useState<UniversityUpdateEntry[]>([]);

  function runSearch(nextSearch: string) {
    setSearch(nextSearch);
    startTransition(async () => {
      setError(null);
      try {
        setUniversities(await listUniversities({ search: nextSearch }));
      } catch (e) {
        setError(e instanceof Error ? e.message : "검색 중 오류가 발생했습니다.");
      }
    });
  }

  function openDetail(id: string) {
    setSelectedId(id);
    startTransition(async () => {
      setError(null);
      try {
        const d = await getUniversityDetail(id);
        setDetail(d.university);
        setCycles(d.cycles);
        setUpdates(d.updates);
      } catch (e) {
        setError(e instanceof Error ? e.message : "상세 조회 중 오류가 발생했습니다.");
      }
    });
  }

  function refreshDetail() {
    if (!selectedId) return;
    openDetail(selectedId);
  }

  return (
    <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-[1fr_1.2fr]">
      <div>
        <input
          type="text"
          value={search}
          onChange={(e) => runSearch(e.target.value)}
          placeholder="학교명으로 검색"
          className="w-full rounded border border-grey-300 px-3 py-2 text-sm"
        />
        {error && <p className="mt-2 text-sm text-red">{error}</p>}
        <p className="mt-2 text-xs text-grey-500">{universities.length}개교</p>
        <ul className="mt-2 max-h-[70vh] divide-y divide-grey-200 overflow-y-auto rounded border border-grey-200 bg-white">
          {universities.map((u) => (
            <li key={u.id}>
              <button
                type="button"
                onClick={() => openDetail(u.id)}
                className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-grey-50 ${
                  selectedId === u.id ? "bg-grey-100" : ""
                }`}
              >
                <span>
                  <span className="mr-2 text-grey-400">#{u.rankFinal ?? "-"}</span>
                  {u.name}
                </span>
                <span className="text-xs text-grey-400">{u.latestCycleYear ?? "미입력"}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div>
        {!detail && <p className="text-sm text-grey-500">왼쪽 목록에서 대학을 선택하세요.</p>}
        {detail && (
          <UniversityDetailPanel
            detail={detail}
            cycles={cycles}
            updates={updates}
            isPending={isPending}
            startTransition={startTransition}
            onSaved={refreshDetail}
            setError={setError}
          />
        )}
      </div>
    </div>
  );
}

function UniversityDetailPanel({
  detail,
  cycles,
  updates,
  isPending,
  startTransition,
  onSaved,
  setError,
}: {
  detail: UniversityDetail;
  cycles: AdmissionCycle[];
  updates: UniversityUpdateEntry[];
  isPending: boolean;
  startTransition: (fn: () => Promise<void> | void) => void;
  onSaved: () => void;
  setError: (msg: string | null) => void;
}) {
  const existing = cycles.find((c) => c.cycleYear === CURRENT_CYCLE_YEAR);
  const [testPolicy, setTestPolicy] = useState(existing?.testPolicy ?? "optional");
  const [gpaAverage, setGpaAverage] = useState(existing?.gpaAverage?.toString() ?? "");
  const [rdDeadline, setRdDeadline] = useState(existing?.rdDeadline ?? "");
  const [essayCount, setEssayCount] = useState(existing?.essayCount?.toString() ?? "");
  const [acceptanceRate, setAcceptanceRate] = useState(existing?.acceptanceRate?.toString() ?? "");

  const [updateTitle, setUpdateTitle] = useState("");
  const [updateDate, setUpdateDate] = useState("");
  const [updateSummary, setUpdateSummary] = useState("");
  const [updateUrl, setUpdateUrl] = useState("");

  function saveCycle() {
    setError(null);
    startTransition(async () => {
      try {
        await upsertAdmissionCycle({
          universityId: detail.id,
          cycleYear: CURRENT_CYCLE_YEAR,
          testPolicy,
          gpaAverage: gpaAverage ? Number(gpaAverage) : null,
          rdDeadline: rdDeadline || null,
          essayCount: essayCount ? Number(essayCount) : null,
          acceptanceRate: acceptanceRate ? Number(acceptanceRate) : null,
        });
        onSaved();
      } catch (e) {
        setError(e instanceof Error ? e.message : "저장 중 오류가 발생했습니다.");
      }
    });
  }

  function saveUpdate() {
    setError(null);
    startTransition(async () => {
      try {
        await addUniversityUpdate({
          universityId: detail.id,
          title: updateTitle,
          updateDate,
          summary: updateSummary || null,
          sourceUrl: updateUrl || null,
        });
        setUpdateTitle("");
        setUpdateDate("");
        setUpdateSummary("");
        setUpdateUrl("");
        onSaved();
      } catch (e) {
        setError(e instanceof Error ? e.message : "저장 중 오류가 발생했습니다.");
      }
    });
  }

  return (
    <div className="rounded border border-grey-200 bg-white p-4">
      <h2 className="text-lg font-semibold text-ink">{detail.name}</h2>
      <p className="text-xs text-grey-500">
        #{detail.rankFinal ?? "-"} · {detail.city ?? "-"}, {detail.state ?? "-"} · {detail.publicPrivate ?? "-"}
      </p>
      <div className="mt-2 flex flex-wrap gap-2 text-xs">
        {detail.admissionsHomepageUrl && (
          <a href={detail.admissionsHomepageUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline">
            입학처
          </a>
        )}
        {detail.commonDataSetUrl && (
          <a href={detail.commonDataSetUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline">
            CDS
          </a>
        )}
      </div>

      <h3 className="mt-4 text-sm font-semibold text-ink">{CURRENT_CYCLE_YEAR} 입시 사이클</h3>
      <div className="mt-2 grid grid-cols-2 gap-3">
        <label className="text-xs text-grey-600">
          시험 정책
          <select
            value={testPolicy ?? "optional"}
            onChange={(e) => setTestPolicy(e.target.value)}
            className="mt-1 w-full rounded border border-grey-300 px-2 py-1 text-sm"
          >
            <option value="required">필수</option>
            <option value="optional">선택</option>
            <option value="not_considered">미반영</option>
          </select>
        </label>
        <label className="text-xs text-grey-600">
          GPA 평균
          <input
            type="number"
            step="0.01"
            value={gpaAverage}
            onChange={(e) => setGpaAverage(e.target.value)}
            className="mt-1 w-full rounded border border-grey-300 px-2 py-1 text-sm"
          />
        </label>
        <label className="text-xs text-grey-600">
          RD 마감일
          <input
            type="date"
            value={rdDeadline ?? ""}
            onChange={(e) => setRdDeadline(e.target.value)}
            className="mt-1 w-full rounded border border-grey-300 px-2 py-1 text-sm"
          />
        </label>
        <label className="text-xs text-grey-600">
          필수 에세이 개수
          <input
            type="number"
            value={essayCount}
            onChange={(e) => setEssayCount(e.target.value)}
            className="mt-1 w-full rounded border border-grey-300 px-2 py-1 text-sm"
          />
        </label>
        <label className="text-xs text-grey-600">
          합격률(%) — 과거 실적 참고용
          <input
            type="number"
            step="0.01"
            value={acceptanceRate}
            onChange={(e) => setAcceptanceRate(e.target.value)}
            className="mt-1 w-full rounded border border-grey-300 px-2 py-1 text-sm"
          />
        </label>
      </div>
      <button
        type="button"
        disabled={isPending}
        onClick={saveCycle}
        className="mt-3 rounded bg-ink px-3 py-1.5 text-sm text-white disabled:opacity-50"
      >
        사이클 저장
      </button>

      <h3 className="mt-6 text-sm font-semibold text-ink">업데이트 타임라인</h3>
      <ul className="mt-2 space-y-1 text-xs text-grey-600">
        {updates.length === 0 && <li className="text-grey-400">등록된 업데이트가 없습니다.</li>}
        {updates.map((u) => (
          <li key={u.id} className="rounded border border-grey-100 p-2">
            <span className="font-medium text-ink">{u.title}</span> — {u.updateDate}
            {u.summary && <p className="mt-1">{u.summary}</p>}
          </li>
        ))}
      </ul>
      <div className="mt-2 space-y-2">
        <input
          type="text"
          placeholder="제목"
          value={updateTitle}
          onChange={(e) => setUpdateTitle(e.target.value)}
          className="w-full rounded border border-grey-300 px-2 py-1 text-sm"
        />
        <input
          type="date"
          value={updateDate}
          onChange={(e) => setUpdateDate(e.target.value)}
          className="w-full rounded border border-grey-300 px-2 py-1 text-sm"
        />
        <textarea
          placeholder="요약"
          value={updateSummary}
          onChange={(e) => setUpdateSummary(e.target.value)}
          className="w-full rounded border border-grey-300 px-2 py-1 text-sm"
        />
        <input
          type="text"
          placeholder="출처 URL"
          value={updateUrl}
          onChange={(e) => setUpdateUrl(e.target.value)}
          className="w-full rounded border border-grey-300 px-2 py-1 text-sm"
        />
        <button
          type="button"
          disabled={isPending}
          onClick={saveUpdate}
          className="rounded bg-ink px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          업데이트 추가
        </button>
      </div>
    </div>
  );
}
