"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import PlannerOverviewView from "@/app/student/PlannerOverviewView";
import { StatsPanel } from "@/app/student/StatsTab";
import BoardColumnsView from "@/app/components/BoardColumnsView";
import type { BoardCard } from "@/lib/board/types";
import type { StudentViewAccess } from "@/lib/staff-student-view";
import {
  loadStaffViewBoardCardsAction,
  loadStaffViewStatsAction,
  recordStaffStudentViewAction,
  createStudentViewTaskAction,
  updateStudentViewTaskStatusAction,
  deleteStudentViewTaskAction,
} from "./staff-student-view-actions";

export type ViewId = "overview" | "board" | "stats";
const TAB_LABEL: Record<ViewId, string> = { overview: "오버뷰", board: "보드", stats: "통계" };

export type ExtraStudentViewTab = { id: string; label: string; render: () => ReactNode };

// 역할 공통 학생 열람 화면(오버뷰/보드/통계). 탭·쓰기 동작은 서버가 돌려준 access(역할별 정책)를
// 따른다 — 읽기 전용 역할은 추가·이동·삭제 UI가 나타나지 않고, 서버 액션도 같은 검사를 다시 한다.
// extraTabs: 호출부 고유 탭(예: 컨설턴트 로드맵·메신저)을 같은 탭 줄에 붙인다.
export default function StaffStudentViews({
  studentId,
  extraTabs = [],
  initialTab = "overview",
}: {
  studentId: string;
  extraTabs?: ExtraStudentViewTab[];
  /** 처음 열 화면(기본 오버뷰). 서버가 허용하지 않는 탭이면 탭 줄에 없으므로 오버뷰로 본다. */
  initialTab?: ViewId;
}) {
  const [tab, setTab] = useState<string>(initialTab);
  const [cards, setCards] = useState<BoardCard[] | null>(null);
  const [access, setAccess] = useState<StudentViewAccess | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const r = await loadStaffViewBoardCardsAction(studentId);
      if (r.ok) {
        setCards(r.cards);
        setAccess(r.access);
        setError(null);
      } else {
        setError(r.error);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "불러오지 못했습니다.");
    }
  }, [studentId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 학생이 바뀌면 상태 초기화 후 재조회(관용적 패턴)
    setCards(null);
    setAccess(null);
    setError(null);
    setTab(initialTab);
    void reload();
  }, [reload, initialTab]);

  // 열람 감사 — 직원 역할만(access.audit), 화면 종류가 바뀔 때마다. 기록 실패는 열람을 막지 않는다.
  useEffect(() => {
    if (!access?.audit) return;
    if (tab !== "overview" && tab !== "board" && tab !== "stats") return;
    recordStaffStudentViewAction(studentId, tab).catch(() => {});
  }, [studentId, tab, access?.audit]);

  const tabs: { id: string; label: string }[] = [
    ...(access?.tabs ?? []).map((id) => ({ id, label: TAB_LABEL[id] })),
    ...extraTabs.map(({ id, label }) => ({ id, label })),
  ];
  const extra = extraTabs.find((t) => t.id === tab);

  return (
    <div>
      {access && (
        <div role="tablist" className="flex gap-1 mb-4 border-b border-grey-200">
          {tabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={
                "px-3 py-2 text-[13px] font-bold border-b-2 -mb-px " +
                (tab === t.id ? "border-ink text-ink" : "border-transparent text-grey-500")
              }
            >
              {t.label}
            </button>
          ))}
        </div>
      )}
      {error ? (
        <p role="alert" className="py-8 text-[13px] text-red">{error}</p>
      ) : cards === null || !access ? (
        <p className="py-8 text-[13px] text-grey-500">불러오는 중...</p>
      ) : extra ? (
        extra.render()
      ) : tab === "stats" ? (
        <StaffStudentStats studentId={studentId} />
      ) : tab === "board" ? (
        <BoardPanel studentId={studentId} cards={cards} access={access} onReload={reload} />
      ) : (
        <PlannerOverviewView cards={cards} />
      )}
    </div>
  );
}

function StaffStudentStats({ studentId }: { studentId: string }) {
  const load = useCallback(() => loadStaffViewStatsAction(studentId), [studentId]);
  return <StatsPanel key={studentId} load={load} />;
}

function BoardPanel({
  studentId,
  cards,
  access,
  onReload,
}: {
  studentId: string;
  cards: BoardCard[];
  access: StudentViewAccess;
  onReload: () => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const can = (a: "create" | "move" | "delete") => access.actions.includes(a);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await onReload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "처리하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {error && <div role="alert" className="mb-4 text-[13px] font-semibold text-red bg-red/5 rounded-lg px-4 py-3">{error}</div>}
      {can("create") && (
        <form
          className="flex gap-2 mb-5"
          onSubmit={(e) => {
            e.preventDefault();
            const t = title.trim();
            if (!t) return;
            void run(async () => {
              await createStudentViewTaskAction(studentId, t);
              setTitle("");
            });
          }}
        >
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="+ 할 일 추가"
            className="flex-1 border-[1.5px] border-grey-200 rounded-lg px-3 py-1.5 text-[13px]"
          />
          <button type="submit" disabled={busy || !title.trim()} className="text-[13px] font-bold bg-ink text-white rounded-lg px-4 py-1.5 disabled:opacity-50">
            추가
          </button>
        </form>
      )}
      {cards.length === 0 && access.actions.length === 0 ? (
        <p className="py-8 text-[13px] text-grey-500">표시할 항목이 없습니다.</p>
      ) : (
        <BoardColumnsView
          cards={cards}
          disableLinks
          onMove={can("move") ? (id, status) => run(() => updateStudentViewTaskStatusAction(id, status)) : undefined}
          onDelete={can("delete") ? (id) => run(() => deleteStudentViewTaskAction(id)) : undefined}
        />
      )}
    </div>
  );
}
