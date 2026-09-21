"use client";

import { useEffect, useState, useTransition } from "react";
import {
  assembleMockExamSet,
  archiveMockExamSetAction,
  getMockExamSetContentAction,
  listMockExamSets,
  publishMockExamSet,
  assignMockExamAsAdminAction,
  listAllActiveStudentsForMockExamAction,
  listAllMockExamAttemptsAction,
  type MockExamSetSummary,
  type MockExamStudentOption,
  type MockExamAttemptHistoryRow,
} from "../mock-exam-actions";
import type { DifficultyTier } from "@/lib/mock-exam/assemble";
import type { MockExamSetContentItem } from "@/lib/mock-exam/set-content";
import MockExamSetContentViewer from "@/app/components/MockExamSetContentViewer";

const TIER_LABEL: Record<DifficultyTier, string> = { foundation: "기본", standard: "표준", advanced: "상위" };
const STATUS_LABEL: Record<string, string> = { draft: "초안", published: "공개", archived: "보관" };

// 2026-09-21(UAT 지적) — 관리자 모의고사 관리 화면을 생성/검토/공개/보관/배정/내역 6개
// 서브탭으로 재구성한다. 기존엔 한 화면에 조립·목록·메타데이터만 있는 "검토" 테이블뿐이라
// 실제 문항 내용을 볼 수 없었고, 보관·전체 배정·전체 응시 내역을 볼 방법도 없었다.
const SUB_TABS = ["생성", "검토", "배정", "내역", "공개", "보관"] as const;
type SubTab = (typeof SUB_TABS)[number];

export default function MockExamSetsPanel({ initialSets }: { initialSets: MockExamSetSummary[] }) {
  const [subTab, setSubTab] = useState<SubTab>("생성");

  return (
    <div className="mt-8 space-y-6">
      <div className="flex gap-1 border-b border-grey-200">
        {SUB_TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setSubTab(t)}
            aria-current={subTab === t ? "page" : undefined}
            className={
              "px-3 pb-2.5 -mb-px border-b-2 text-[13px] font-bold " +
              (subTab === t ? "text-ink border-ink" : "text-grey-500 border-transparent")
            }
          >
            {t}
          </button>
        ))}
      </div>

      {subTab === "생성" && <CreateTab initialSets={initialSets} />}
      {subTab === "검토" && <ReviewTab />}
      {subTab === "공개" && <PublishTab />}
      {subTab === "보관" && <ArchiveTab />}
      {subTab === "배정" && <AssignTab />}
      {subTab === "내역" && <HistoryTab />}
    </div>
  );
}

function CreateTab({ initialSets }: { initialSets: MockExamSetSummary[] }) {
  const [sets, setSets] = useState(initialSets);
  const [name, setName] = useState("");
  const [tier, setTier] = useState<DifficultyTier>("standard");
  const [rwCount, setRwCount] = useState(27);
  const [mathCount, setMathCount] = useState(22);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [shortfallNotice, setShortfallNotice] = useState<string | null>(null);

  function refresh() {
    startTransition(async () => {
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

  return (
    <div className="space-y-6">
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

      <SetListTable sets={sets} emptyLabel="아직 조립된 세트가 없습니다." />
    </div>
  );
}

function SetListTable({ sets, emptyLabel }: { sets: MockExamSetSummary[]; emptyLabel: string }) {
  return (
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
          </tr>
        </thead>
        <tbody>
          {sets.map((s) => (
            <tr key={s.id} className="border-t border-grey-100">
              <td className="py-2">
                {s.name} <span className="text-xs text-grey-400">v{s.versionNo}</span>
              </td>
              <td>{TIER_LABEL[s.difficultyTier]}</td>
              <td>
                <span className={s.status === "published" ? "text-green" : s.status === "draft" ? "text-grey-500" : "text-grey-300"}>
                  {STATUS_LABEL[s.status]}
                </span>
              </td>
              <td>{s.rwCount}</td>
              <td>{s.mathCount}</td>
            </tr>
          ))}
          {sets.length === 0 ? (
            <tr>
              <td colSpan={5} className="py-4 text-center text-sm text-grey-400">
                {emptyLabel}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </section>
  );
}

/** 검토 — 아직 공개 전(초안)인 세트만. 실제 문항 내용을 확인한 뒤 그 자리에서 바로 공개할 수 있다. */
function ReviewTab() {
  const [sets, setSets] = useState<MockExamSetSummary[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [items, setItems] = useState<MockExamSetContentItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [publishBusy, setPublishBusy] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [confirmingArchive, setConfirmingArchive] = useState(false);

  function refresh() {
    listMockExamSets().then((all) => setSets(all.filter((s) => s.status === "draft")));
  }
  useEffect(refresh, []);

  function openContent(setId: string) {
    setSelectedId(setId);
    setItems(null);
    setError(null);
    setPublishError(null);
    setConfirmingArchive(false);
    getMockExamSetContentAction(setId)
      .then(setItems)
      .catch((e) => setError(e instanceof Error ? e.message : "문항을 불러오지 못했습니다."));
  }

  async function handlePublish(setId: string) {
    setPublishBusy(true);
    setPublishError(null);
    try {
      await publishMockExamSet(setId);
      setSelectedId(null);
      setItems(null);
      refresh();
    } catch (e) {
      setPublishError(e instanceof Error ? e.message : "공개 중 오류가 발생했습니다.");
    } finally {
      setPublishBusy(false);
    }
  }

  async function handleArchive(setId: string) {
    setArchiveBusy(true);
    setPublishError(null);
    try {
      await archiveMockExamSetAction(setId);
      setSelectedId(null);
      setItems(null);
      setConfirmingArchive(false);
      refresh();
    } catch (e) {
      setPublishError(e instanceof Error ? e.message : "보관 처리 중 오류가 발생했습니다.");
    } finally {
      setArchiveBusy(false);
    }
  }

  if (sets === null) return <p className="text-sm text-grey-400">불러오는 중…</p>;

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-grey-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-ink">검토 대기 중인 초안</h2>
        <p className="mt-1 text-xs text-grey-500">공개 전 세트의 실제 지문·질문·선택지·정답·해설을 확인합니다.</p>
        <ul className="mt-3 flex flex-col gap-1">
          {sets.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => openContent(s.id)}
                className={`w-full rounded-lg px-3 py-2 text-left text-[13px] ${
                  selectedId === s.id ? "bg-ink text-white" : "bg-grey-100 text-ink hover:bg-grey-200"
                }`}
              >
                {s.name} v{s.versionNo} · {TIER_LABEL[s.difficultyTier]} · R&W {s.rwCount} · Math {s.mathCount}
              </button>
            </li>
          ))}
          {sets.length === 0 && <li className="text-sm text-grey-400">검토할 초안이 없습니다.</li>}
        </ul>
      </section>

      {selectedId && (
        <section className="rounded-xl border border-grey-200 bg-white p-5">
          {error ? (
            <p className="text-sm text-red">{error}</p>
          ) : items === null ? (
            <p className="text-sm text-grey-400">불러오는 중…</p>
          ) : (
            <>
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-ink">문항 내용</span>
                <div className="flex items-center gap-2">
                  {confirmingArchive ? (
                    <>
                      <span className="text-xs text-grey-500">보관하면 학생에게 배정할 수 없습니다.</span>
                      <button
                        type="button"
                        disabled={archiveBusy}
                        onClick={() => handleArchive(selectedId)}
                        className="rounded bg-red px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40"
                      >
                        {archiveBusy ? "처리 중..." : "확인 — 보관"}
                      </button>
                      <button type="button" onClick={() => setConfirmingArchive(false)} className="text-xs font-semibold text-grey-500">
                        취소
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmingArchive(true)}
                      className="rounded border border-grey-200 px-3 py-1.5 text-xs font-bold text-grey-600"
                    >
                      보관 처리
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={publishBusy}
                    onClick={() => handlePublish(selectedId)}
                    className="rounded bg-ink px-4 py-1.5 text-xs font-bold text-white disabled:opacity-40"
                  >
                    {publishBusy ? "공개 중..." : "이 세트 공개하기"}
                  </button>
                </div>
              </div>
              {publishError && <p className="mb-2 text-sm text-red">{publishError}</p>}
              <MockExamSetContentViewer items={items} />
            </>
          )}
        </section>
      )}
    </div>
  );
}

/** 공개 — 이미 학생에게 노출 중인 세트를 확인·필요하면 여기서 보관 처리한다. */
function PublishTab() {
  const [sets, setSets] = useState<MockExamSetSummary[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [items, setItems] = useState<MockExamSetContentItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [confirmingArchive, setConfirmingArchive] = useState(false);

  function refresh() {
    listMockExamSets().then((all) => setSets(all.filter((s) => s.status === "published")));
  }
  useEffect(refresh, []);

  function openContent(setId: string) {
    setSelectedId(setId);
    setItems(null);
    setError(null);
    setArchiveError(null);
    setConfirmingArchive(false);
    getMockExamSetContentAction(setId)
      .then(setItems)
      .catch((e) => setError(e instanceof Error ? e.message : "문항을 불러오지 못했습니다."));
  }

  async function handleArchive(setId: string) {
    setArchiveBusy(true);
    setArchiveError(null);
    try {
      await archiveMockExamSetAction(setId);
      setSelectedId(null);
      setItems(null);
      setConfirmingArchive(false);
      refresh();
    } catch (e) {
      setArchiveError(e instanceof Error ? e.message : "보관 처리 중 오류가 발생했습니다.");
    } finally {
      setArchiveBusy(false);
    }
  }

  if (sets === null) return <p className="text-sm text-grey-400">불러오는 중…</p>;

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-grey-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-ink">공개된 세트</h2>
        <p className="mt-1 text-xs text-grey-500">지금 학생에게 배정 가능한 세트의 실제 문항 내용을 확인합니다.</p>
        <ul className="mt-3 flex flex-col gap-1">
          {sets.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => openContent(s.id)}
                className={`w-full rounded-lg px-3 py-2 text-left text-[13px] ${
                  selectedId === s.id ? "bg-ink text-white" : "bg-grey-100 text-ink hover:bg-grey-200"
                }`}
              >
                {s.name} v{s.versionNo} · {TIER_LABEL[s.difficultyTier]} · R&W {s.rwCount} · Math {s.mathCount}
              </button>
            </li>
          ))}
          {sets.length === 0 && <li className="text-sm text-grey-400">공개된 세트가 없습니다.</li>}
        </ul>
      </section>

      {selectedId && (
        <section className="rounded-xl border border-grey-200 bg-white p-5">
          {error ? (
            <p className="text-sm text-red">{error}</p>
          ) : items === null ? (
            <p className="text-sm text-grey-400">불러오는 중…</p>
          ) : (
            <>
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-ink">문항 내용</span>
                {confirmingArchive ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-grey-500">보관하면 학생에게 배정할 수 없습니다.</span>
                    <button
                      type="button"
                      disabled={archiveBusy}
                      onClick={() => handleArchive(selectedId)}
                      className="rounded bg-red px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40"
                    >
                      {archiveBusy ? "처리 중..." : "확인 — 보관"}
                    </button>
                    <button type="button" onClick={() => setConfirmingArchive(false)} className="text-xs font-semibold text-grey-500">
                      취소
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmingArchive(true)}
                    className="rounded border border-grey-200 px-3 py-1.5 text-xs font-bold text-grey-600"
                  >
                    보관 처리
                  </button>
                )}
              </div>
              {archiveError && <p className="mb-2 text-sm text-red">{archiveError}</p>}
              <MockExamSetContentViewer items={items} />
            </>
          )}
        </section>
      )}
    </div>
  );
}

/** 보관 — 보관된 세트만 읽기 전용으로 확인한다. 보관 처리 자체는 검토·공개 탭에서 한다
 * (2026-09-21 UAT 지적: "보관은 보관된 내역만 볼 수 있게, 검토·공개 쪽에서 보관 처리"). */
function ArchiveTab() {
  const [sets, setSets] = useState<MockExamSetSummary[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [items, setItems] = useState<MockExamSetContentItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listMockExamSets({ archivedOnly: true }).then(setSets);
  }, []);

  function openContent(setId: string) {
    setSelectedId(setId);
    setItems(null);
    setError(null);
    getMockExamSetContentAction(setId)
      .then(setItems)
      .catch((e) => setError(e instanceof Error ? e.message : "문항을 불러오지 못했습니다."));
  }

  if (sets === null) return <p className="text-sm text-grey-400">불러오는 중…</p>;

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-grey-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-ink">보관된 세트</h2>
        <p className="mt-1 text-xs text-grey-500">더 이상 배정할 수 없는 세트입니다. 보관 처리는 &ldquo;검토&rdquo;·&ldquo;공개&rdquo; 탭에서 합니다.</p>
        <ul className="mt-3 flex flex-col gap-1">
          {sets.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => openContent(s.id)}
                className={`w-full rounded-lg px-3 py-2 text-left text-[13px] ${
                  selectedId === s.id ? "bg-ink text-white" : "bg-grey-100 text-ink hover:bg-grey-200"
                }`}
              >
                {s.name} v{s.versionNo} · {TIER_LABEL[s.difficultyTier]} · R&W {s.rwCount} · Math {s.mathCount}
              </button>
            </li>
          ))}
          {sets.length === 0 && <li className="text-sm text-grey-400">보관된 세트가 없습니다.</li>}
        </ul>
      </section>

      {selectedId && (
        <section className="rounded-xl border border-grey-200 bg-white p-5">
          {error ? (
            <p className="text-sm text-red">{error}</p>
          ) : items === null ? (
            <p className="text-sm text-grey-400">불러오는 중…</p>
          ) : (
            <MockExamSetContentViewer items={items} />
          )}
        </section>
      )}
    </div>
  );
}

function AssignTab() {
  const [students, setStudents] = useState<MockExamStudentOption[]>([]);
  const [sets, setSets] = useState<MockExamSetSummary[]>([]);
  const [studentId, setStudentId] = useState("");
  const [examSetId, setExamSetId] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    listAllActiveStudentsForMockExamAction().then(setStudents);
    listMockExamSets().then((all) => setSets(all.filter((s) => s.status === "published")));
  }, []);

  async function assign() {
    if (!studentId || !examSetId) return;
    setBusy(true);
    setMessage(null);
    const result = await assignMockExamAsAdminAction({ studentId, examSetId, dueAt: dueAt || null });
    setBusy(false);
    setMessage(result.ok ? "배정했습니다." : result.error);
  }

  return (
    <section className="rounded-xl border border-grey-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-ink">모의고사 배정(교사 담당 여부 무관, 전체 학생)</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        <select className="rounded border border-grey-200 px-2 py-1.5 text-sm" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
          <option value="">학생 선택...</option>
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name ?? s.id}
            </option>
          ))}
        </select>
        <select className="rounded border border-grey-200 px-2 py-1.5 text-sm" value={examSetId} onChange={(e) => setExamSetId(e.target.value)}>
          <option value="">공개 세트 선택...</option>
          {sets.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({TIER_LABEL[s.difficultyTier]})
            </option>
          ))}
        </select>
        <input type="date" className="rounded border border-grey-200 px-2 py-1.5 text-sm" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
        <button
          type="button"
          disabled={busy || !studentId || !examSetId}
          onClick={assign}
          className="rounded bg-ink px-4 py-1.5 text-sm font-bold text-white disabled:opacity-40"
        >
          배정
        </button>
      </div>
      {message && <p className="mt-2 text-sm text-grey-600">{message}</p>}
      {sets.length === 0 && <p className="mt-2 text-xs text-grey-400">공개된 세트가 없습니다 — 먼저 &ldquo;공개&rdquo; 탭에서 세트를 공개하세요.</p>}
    </section>
  );
}

function HistoryTab() {
  const [rows, setRows] = useState<MockExamAttemptHistoryRow[] | null>(null);

  useEffect(() => {
    listAllMockExamAttemptsAction().then(setRows);
  }, []);

  if (rows === null) return <p className="text-sm text-grey-400">불러오는 중…</p>;

  return (
    <section className="rounded-xl border border-grey-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-ink">배정·응시 내역(전체)</h2>
      <table className="mt-3 w-full text-left text-sm">
        <thead>
          <tr className="text-xs text-grey-500">
            <th className="py-1">학생</th>
            <th>세트</th>
            <th>상태</th>
            <th>마감</th>
            <th>제출</th>
            <th>정답</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.attemptId} className="border-t border-grey-100">
              <td className="py-2">{r.studentName ?? r.studentId}</td>
              <td>{r.examSetName}</td>
              <td>{STATUS_LABEL[r.status] ?? r.status}</td>
              <td>{r.dueAt ? new Date(r.dueAt).toLocaleDateString("ko-KR") : "-"}</td>
              <td>{r.submittedAt ? new Date(r.submittedAt).toLocaleDateString("ko-KR") : "-"}</td>
              <td>{r.correctCount !== null ? `${r.correctCount}/${r.totalCount}` : "-"}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={6} className="py-4 text-center text-sm text-grey-400">
                배정된 모의고사가 없습니다.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
