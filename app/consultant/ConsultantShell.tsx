"use client";

import { useEffect, useState } from "react";
import { logout } from "@/app/login/actions";
import { getRoadmapForStudent } from "@/lib/roadmap/actions";
import type { RoadmapData } from "@/lib/roadmap/types";
import RoadmapView from "@/app/components/RoadmapView";
import type { ConsultantStudent } from "./consultant-data";
import type { IntakeConsultation } from "./intake-data";
import { markConsultationContactedAction } from "./intake-actions";
import type { ConsultantAvailabilityRule } from "./availability-actions";
import { listMyAvailabilityRulesAction, addMyAvailabilityRuleAction, deactivateMyAvailabilityRuleAction } from "./availability-actions";

type NavId = "students" | "assignments" | "schedule";

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

// 컨설턴트 포지션(2026-09-22, 가볍게 시작) — 담당 학생 목록 + 로드맵(쓰기),
// 신규 배정 요청(스펙 §Screen Scope "New assignments"), 본인 가능시간(Schedule,
// Phase 2) 세 화면. 스케줄링 링크 이메일 발송·자동배정은 아직 Phase 2 후속.
export default function ConsultantShell({
  consultantName,
  students,
  assignedConsultations,
}: {
  consultantName: string;
  students: ConsultantStudent[];
  assignedConsultations: IntakeConsultation[];
}) {
  const [nav, setNav] = useState<NavId>("assignments");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const contactRequiredCount = assignedConsultations.filter((c) => !c.contactedAt).length;

  return (
    <div className="min-h-screen bg-white flex">
      <aside className="w-56 shrink-0 border-r border-grey-200 flex flex-col py-5 px-3 gap-0.5">
        <div className="flex items-center gap-2 px-2.5 mb-5">
          <div className="w-8 h-8 rounded-full bg-red text-white font-extrabold text-[14px] flex items-center justify-center shrink-0">
            A
          </div>
          <span className="text-[13.5px] font-extrabold text-ink">ALTON</span>
        </div>
        <button
          onClick={() => {
            setNav("assignments");
            setSelectedId(null);
          }}
          aria-current={nav === "assignments" ? "page" : undefined}
          className={
            "w-full text-left px-2.5 py-2.5 rounded-lg text-[13px] font-semibold flex items-center justify-between " +
            (nav === "assignments" ? "bg-red text-white" : "text-grey-500 hover:bg-grey-100 hover:text-ink")
          }
        >
          <span>신규 배정</span>
          {contactRequiredCount > 0 && (
            <span
              className={
                "text-[11px] font-bold px-1.5 py-0.5 rounded-full " +
                (nav === "assignments" ? "bg-white/25" : "bg-red text-white")
              }
            >
              {contactRequiredCount}
            </span>
          )}
        </button>
        <button
          onClick={() => {
            setNav("students");
            setSelectedId(null);
          }}
          aria-current={nav === "students" ? "page" : undefined}
          className={
            "w-full text-left px-2.5 py-2.5 rounded-lg text-[13px] font-semibold " +
            (nav === "students" ? "bg-red text-white" : "text-grey-500 hover:bg-grey-100 hover:text-ink")
          }
        >
          담당 학생
        </button>
        <button
          onClick={() => {
            setNav("schedule");
            setSelectedId(null);
          }}
          aria-current={nav === "schedule" ? "page" : undefined}
          className={
            "w-full text-left px-2.5 py-2.5 rounded-lg text-[13px] font-semibold " +
            (nav === "schedule" ? "bg-red text-white" : "text-grey-500 hover:bg-grey-100 hover:text-ink")
          }
        >
          가능시간
        </button>
        <div className="flex-1" />
        <div className="px-2.5 text-[12px] text-grey-500 mb-2">{consultantName} 컨설턴트님</div>
        <form action={logout}>
          <button type="submit" className="w-full text-left px-2.5 py-2 rounded-lg text-[12.5px] font-semibold text-grey-500 hover:bg-grey-100">
            로그아웃
          </button>
        </form>
      </aside>

      <main className="flex-1">
        {nav === "assignments" ? (
          <AssignedConsultationsList initialConsultations={assignedConsultations} />
        ) : nav === "schedule" ? (
          <AvailabilityPanel />
        ) : selectedId === null ? (
          <StudentList students={students} onSelect={setSelectedId} />
        ) : (
          <StudentRoadmapPanel
            studentId={selectedId}
            studentName={students.find((s) => s.id === selectedId)?.name ?? "학생"}
            onBack={() => setSelectedId(null)}
          />
        )}
      </main>
    </div>
  );
}

function AssignedConsultationsList({ initialConsultations }: { initialConsultations: IntakeConsultation[] }) {
  const [consultations, setConsultations] = useState(initialConsultations);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleMarkContacted(id: string) {
    setBusyId(id);
    setConsultations((prev) => prev.map((c) => (c.id === id ? { ...c, contactedAt: new Date().toISOString() } : c)));
    try {
      await markConsultationContactedAction(id);
    } catch {
      setConsultations((prev) => prev.map((c) => (c.id === id ? { ...c, contactedAt: null } : c)));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="max-w-[640px] px-8 py-8">
      <h1 className="text-[20px] font-extrabold text-ink mb-5">신규 배정</h1>
      {consultations.length === 0 ? (
        <div className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center">
          아직 배정된 상담 요청이 없습니다.
        </div>
      ) : (
        consultations.map((c) => (
          <div key={c.id} className="border-[1.5px] border-grey-200 rounded-xl px-5 py-3.5 mb-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[13.5px] font-bold text-ink">{c.contactName}</span>
              {c.contactedAt ? (
                <span className="text-[11.5px] font-semibold text-green">연락 완료</span>
              ) : (
                <button
                  disabled={busyId === c.id}
                  onClick={() => handleMarkContacted(c.id)}
                  className="text-[12px] font-bold px-3 py-1 rounded-lg border-[1.5px] border-grey-200 text-ink disabled:opacity-50"
                >
                  연락 완료로 표시
                </button>
              )}
            </div>
            <div className="text-[12px] text-grey-500 mt-1">
              {c.contactEmail}
              {c.studentGrade ? ` · ${c.studentGrade}` : ""}
            </div>
            {c.concerns && <div className="text-[12.5px] text-grey-600 mt-2">{c.concerns}</div>}
          </div>
        ))
      )}
    </div>
  );
}

function AvailabilityPanel() {
  const [rules, setRules] = useState<ConsultantAvailabilityRule[] | null>(null);
  const [weekday, setWeekday] = useState(1);
  const [startTime, setStartTime] = useState("10:00");
  const [endTime, setEndTime] = useState("17:00");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function reload() {
    listMyAvailabilityRulesAction()
      .then(setRules)
      .catch((e) => setError(e instanceof Error ? e.message : "불러오지 못했습니다."));
  }
  useEffect(() => {
    reload();
  }, []);

  async function handleAdd() {
    setBusy(true);
    setError(null);
    try {
      await addMyAvailabilityRuleAction({ weekday, startTime, endTime });
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "등록하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeactivate(id: string) {
    setBusy(true);
    try {
      await deactivateMyAvailabilityRuleAction(id);
      reload();
    } finally {
      setBusy(false);
    }
  }

  const activeRules = (rules ?? []).filter((r) => r.active);

  return (
    <div className="max-w-[560px] px-8 py-8">
      <h1 className="text-[20px] font-extrabold text-ink mb-1">가능시간</h1>
      <p className="text-[12.5px] text-grey-500 mb-5">
        여기서 등록한 시간대만 배정된 고객에게 예약 가능 시간으로 보여집니다(스케줄링 링크는 다음 단계에서 연결됩니다).
      </p>
      {error && <div className="mb-4 text-[13px] font-semibold text-red bg-red/5 rounded-lg px-4 py-3">{error}</div>}

      <form
        className="flex items-end gap-2 mb-6"
        onSubmit={(e) => {
          e.preventDefault();
          void handleAdd();
        }}
      >
        <select value={weekday} onChange={(e) => setWeekday(Number(e.target.value))} className="border-[1.5px] border-grey-200 rounded-lg px-2.5 py-1.5 text-[13px]">
          {WEEKDAY_LABELS.map((label, i) => (
            <option key={i} value={i}>
              {label}요일
            </option>
          ))}
        </select>
        <input
          type="time"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          className="border-[1.5px] border-grey-200 rounded-lg px-2.5 py-1.5 text-[13px]"
        />
        <span className="text-[13px] text-grey-500">~</span>
        <input
          type="time"
          value={endTime}
          onChange={(e) => setEndTime(e.target.value)}
          className="border-[1.5px] border-grey-200 rounded-lg px-2.5 py-1.5 text-[13px]"
        />
        <button type="submit" disabled={busy} className="text-[13px] font-bold bg-ink text-white rounded-lg px-4 py-1.5 disabled:opacity-50">
          추가
        </button>
      </form>

      {rules === null ? (
        <p className="text-[13px] text-grey-500">불러오는 중…</p>
      ) : activeRules.length === 0 ? (
        <div className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center">등록된 가능시간이 없습니다.</div>
      ) : (
        activeRules.map((r) => (
          <div key={r.id} className="flex items-center justify-between border-[1.5px] border-grey-200 rounded-xl px-4 py-3 mb-2">
            <span className="text-[13px] font-semibold text-ink">
              {WEEKDAY_LABELS[r.weekday]}요일 {r.startTime.slice(0, 5)} ~ {r.endTime.slice(0, 5)}
            </span>
            <button disabled={busy} onClick={() => handleDeactivate(r.id)} className="text-[12px] font-bold text-red disabled:opacity-50">
              삭제
            </button>
          </div>
        ))
      )}
    </div>
  );
}

function StudentList({
  students,
  onSelect,
}: {
  students: ConsultantStudent[];
  onSelect: (id: string) => void;
}) {
  return (
    <div className="max-w-[640px] px-8 py-8">
      <h1 className="text-[20px] font-extrabold text-ink mb-5">담당 학생</h1>
      {students.length === 0 ? (
        <div className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center">
          아직 배정된 학생이 없습니다.
        </div>
      ) : (
        students.map((s) => (
          <button
            key={s.id}
            onClick={() => onSelect(s.id)}
            className="w-full text-left border-[1.5px] border-grey-200 rounded-xl px-5 py-3.5 mb-2.5"
          >
            <span className="text-[13.5px] font-bold text-ink">{s.name ?? "이름 없음"}</span>
          </button>
        ))
      )}
    </div>
  );
}

function StudentRoadmapPanel({
  studentId,
  studentName,
  onBack,
}: {
  studentId: string;
  studentName: string;
  onBack: () => void;
}) {
  const [state, setState] = useState<
    { status: "loading" } | { status: "error"; message: string } | { status: "ready"; data: RoadmapData }
  >({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    getRoadmapForStudent(studentId)
      .then((data) => {
        if (!cancelled) setState({ status: "ready", data });
      })
      .catch((e) => {
        if (!cancelled) setState({ status: "error", message: e instanceof Error ? e.message : "불러오지 못했습니다." });
      });
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  return (
    <div className="max-w-[720px] px-8 py-8">
      <button
        onClick={onBack}
        className="text-[13px] text-grey-600 font-semibold border-[1.5px] border-grey-200 rounded-lg px-3 py-1.5 hover:bg-grey-100 active:scale-95 transition-transform"
      >
        ← 담당 학생 목록
      </button>
      <h1 className="text-[18px] font-extrabold text-ink mt-2 mb-4">{studentName} 학생 로드맵</h1>

      {state.status === "loading" && <div className="py-8 text-[13px] text-grey-500">불러오는 중...</div>}
      {state.status === "error" && <div className="py-8 text-[13px] text-red">{state.message}</div>}
      {state.status === "ready" && <RoadmapView data={state.data} />}
    </div>
  );
}
