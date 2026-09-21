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
const SUB_TABS = ["생성", "검토", "공개", "보관", "배정", "내역"] as const;
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

function ReviewTab() {
  const [sets, setSets] = useState<MockExamSetSummary[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [items, setItems] = useState<MockExamSetContentItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listMockExamSets().then(setSets);
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
        <h2 className="text-sm font-semibold text-ink">세트 문항 검토</h2>
        <p className="mt-1 text-xs text-grey-500">실제 지문·질문·선택지·정답·해설을 확인합니다.</p>
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
                {s.name} v{s.versionNo} · {STATUS_LABEL[s.status]} · R&W {s.rwCount} · Math {s.mathCount}
              </button>
            </li>
          ))}
          {sets.length === 0 && <li className="text-sm text-grey-400">검토할 세트가 없습니다.</li>}
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

function PublishTab() {
  const [sets, setSets] = useState<MockExamSetSummary[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    listMockExamSets().then((all) => setSets(all.filter((s) => s.status === "draft")));
  }
  useEffect(refresh, []);

  async function handlePublish(setId: string) {
    setBusyId(setId);
    setError(null);
    try {
      await publishMockExamSet(setId);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "공개 중 오류가 발생했습니다.");
    } finally {
      setBusyId(null);
    }
  }

  if (sets === null) return <p className="text-sm text-grey-400">불러오는 중…</p>;

  return (
    <section className="rounded-xl border border-grey-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-ink">공개 대기 중인 초안</h2>
      {error && <p className="mt-2 text-sm text-red">{error}</p>}
      <table className="mt-3 w-full text-left text-sm">
        <thead>
          <tr className="text-xs text-grey-500">
            <th className="py-1">이름</th>
            <th>등급</th>
            <th>R&W</th>
            <th>Math</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {sets.map((s) => (
            <tr key={s.id} className="border-t border-grey-100">
              <td className="py-2">
                {s.name} <span className="text-xs text-grey-400">v{s.versionNo}</span>
              </td>
              <td>{TIER_LABEL[s.difficultyTier]}</td>
              <td>{s.rwCount}</td>
              <td>{s.mathCount}</td>
              <td className="text-right">
                <button
                  type="button"
                  disabled={busyId === s.id}
                  onClick={() => handlePublish(s.id)}
                  className="rounded bg-ink px-3 py-1 text-xs font-bold text-white disabled:opacity-40"
                >
                  {busyId === s.id ? "공개 중..." : "공개"}
                </button>
              </td>
            </tr>
          ))}
          {sets.length === 0 && (
            <tr>
              <td colSpan={5} className="py-4 text-center text-sm text-grey-400">
                공개 대기 중인 초안이 없습니다.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}

function ArchiveTab() {
  const [active, setActive] = useState<MockExamSetSummary[] | null>(null);
  const [archived, setArchived] = useState<MockExamSetSummary[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  function refresh() {
    listMockExamSets().then(setActive);
    listMockExamSets({ archivedOnly: true }).then(setArchived);
  }
  useEffect(refresh, []);

  async function handleArchive(setId: string) {
    setBusyId(setId);
    setError(null);
    try {
      await archiveMockExamSetAction(setId);
      setConfirmingId(null);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "보관 처리 중 오류가 발생했습니다.");
    } finally {
      setBusyId(null);
    }
  }

  if (active === null || archived === null) return <p className="text-sm text-grey-400">불러오는 중…</p>;

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-grey-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-ink">보관 처리</h2>
        <p className="mt-1 text-xs text-grey-500">
          더 이상 쓰지 않을 세트를 보관합니다. 이미 배정·응시된 학생의 기록은 그대로 남습니다.
        </p>
        {error && <p className="mt-2 text-sm text-red">{error}</p>}
        <ul className="mt-3 flex flex-col gap-1.5">
          {active.map((s) => (
            <li key={s.id} className="flex items-center justify-between rounded-lg bg-grey-50 px-3 py-2 text-[13px]">
              <span>
                {s.name} v{s.versionNo} · {STATUS_LABEL[s.status]}
              </span>
              {confirmingId === s.id ? (
                <span className="flex gap-2">
                  <button
                    type="button"
                    disabled={busyId === s.id}
                    onClick={() => handleArchive(s.id)}
                    className="rounded bg-red px-2.5 py-1 text-xs font-bold text-white disabled:opacity-40"
                  >
                    {busyId === s.id ? "처리 중..." : "확인 — 보관"}
                  </button>
                  <button type="button" onClick={() => setConfirmingId(null)} className="text-xs font-semibold text-grey-500">
                    취소
                  </button>
                </span>
              ) : (
                <button type="button" onClick={() => setConfirmingId(s.id)} className="text-xs font-bold text-red underline">
                  보관 처리
                </button>
              )}
            </li>
          ))}
          {active.length === 0 && <li className="text-sm text-grey-400">보관할 세트가 없습니다.</li>}
        </ul>
      </section>

      <section className="rounded-xl border border-grey-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-ink">보관된 세트</h2>
        <ul className="mt-3 flex flex-col gap-1.5">
          {archived.map((s) => (
            <li key={s.id} className="text-[13px] text-grey-500">
              {s.name} v{s.versionNo} · R&W {s.rwCount} · Math {s.mathCount}
            </li>
          ))}
          {archived.length === 0 && <li className="text-sm text-grey-400">보관된 세트가 없습니다.</li>}
        </ul>
      </section>
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
      {sets.length === 0 && <p className="mt-2 text-xs text-grey-400">공개된 세트가 없습니다 — 먼저 "공개" 탭에서 세트를 공개하세요.</p>}
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
