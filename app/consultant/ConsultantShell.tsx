"use client";

import { useEffect, useState } from "react";
import { logout } from "@/app/login/actions";
import { getRoadmapForStudent } from "@/lib/roadmap/actions";
import type { RoadmapData } from "@/lib/roadmap/types";
import RoadmapView from "@/app/components/RoadmapView";
import type { ConsultantStudent } from "./consultant-data";
import type { IntakeConsultation } from "./intake-data";
import { markConsultationContactedAction } from "./intake-actions";

type NavId = "students" | "assignments";

// 컨설턴트 포지션(2026-09-22, 가볍게 시작) — 담당 학생 목록 + 로드맵(쓰기),
// 신규 배정 요청(스펙 §Screen Scope "New assignments") 두 화면.
// Schedule(가용시간·확정 미팅) 전용 화면은 이메일·자동배정과 함께 Phase 2.
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
