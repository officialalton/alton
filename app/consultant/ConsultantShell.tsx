"use client";

import { useEffect, useState } from "react";
import { logout } from "@/app/login/actions";
import { getRoadmapForStudent } from "@/lib/roadmap/actions";
import type { RoadmapData } from "@/lib/roadmap/types";
import RoadmapView from "@/app/components/RoadmapView";
import PlannerOverviewView from "@/app/student/PlannerOverviewView";
import BoardColumnsView from "@/app/components/BoardColumnsView";
import type { ConsultantStudent } from "./consultant-data";
import {
  loadStudentBoardCardsAction,
  createStudentManualTaskAction,
  updateStudentManualTaskStatusAction,
  deleteStudentManualTaskAction,
} from "./board-actions";
import type { BoardCard } from "@/lib/board/types";
import type { IntakeConsultation } from "./intake-data";
import { markConsultationContactedAction, loadMyPendingOnboardingStudentsAction, type PendingOnboardingStudent } from "./intake-actions";
import type { ConsultantAvailabilityRule } from "./availability-actions";
import {
  listMyAvailabilityRulesAction,
  addMyAvailabilityRuleAction,
  deactivateMyAvailabilityRuleAction,
  loadMyAcceptingNewWorkAction,
  setMyAcceptingNewWorkAction,
} from "./availability-actions";
import type { HouseholdInquirySummary, HouseholdMessage } from "@/app/parent/inquiry-actions";
import {
  listConsultantInquiriesAction,
  listConsultantInquiryMessagesAction,
  sendConsultantInquiryMessageAction,
  markConsultantMessengerReadAction,
  getConsultantMessengerUnreadCountAction,
} from "./messenger-actions";
import {
  listMyAssignedMeetingRequestsAction,
  scheduleMyMeetingRequestAction,
  cancelMyMeetingRequestAction,
  type AssignedMeetingRequest,
} from "./meeting-actions";

type NavId = "students" | "assignments" | "meetings" | "schedule";

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

  const contactRequiredCount = assignedConsultations.filter((c) => assignmentColumnOf(c) === "contact_needed").length;

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
            setNav("meetings");
            setSelectedId(null);
          }}
          aria-current={nav === "meetings" ? "page" : undefined}
          className={
            "w-full text-left px-2.5 py-2.5 rounded-lg text-[13px] font-semibold " +
            (nav === "meetings" ? "bg-red text-white" : "text-grey-500 hover:bg-grey-100 hover:text-ink")
          }
        >
          일정 요청
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
        ) : nav === "meetings" ? (
          <MeetingRequestsPanel />
        ) : nav === "schedule" ? (
          <AvailabilityPanel />
        ) : selectedId === null ? (
          <StudentList students={students} onSelect={setSelectedId} />
        ) : (
          <StudentPanel
            studentId={selectedId}
            studentName={students.find((s) => s.id === selectedId)?.name ?? "학생"}
            onBack={() => setSelectedId(null)}
          />
        )}
      </main>
    </div>
  );
}

type AssignmentColumn = "contact_needed" | "in_progress" | "scheduled";

function assignmentColumnOf(c: IntakeConsultation): AssignmentColumn {
  if (c.startsAt) return "scheduled";
  if (c.contactedAt) return "in_progress";
  return "contact_needed";
}

const ASSIGNMENT_COLUMNS: { id: AssignmentColumn; label: string }[] = [
  { id: "contact_needed", label: "연락 필요" },
  { id: "in_progress", label: "일정 조율 중" },
  { id: "scheduled", label: "일정 확정" },
];

// 컨설턴트 Round B(2026-09-22 사용자 지시) — "신규 배정"을 플랫 리스트가
// 아니라 칸반으로. 본인에게 배정된 것만 보인다(admissions_consultant_id
// 필터는 이미 loadMyAssignedConsultationsAction/RLS에서 적용됨 — 관리자
// 화면(ConsultantAssignmentsTab)은 반대로 전체를 본다, 사용자 확인됨).
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
    <div className="px-8 py-8">
      <h1 className="text-[20px] font-extrabold text-ink mb-5">신규 배정</h1>
      {consultations.length === 0 ? (
        <div className="max-w-[640px] text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center">
          아직 배정된 상담 요청이 없습니다.
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {ASSIGNMENT_COLUMNS.map((col) => {
            const items = consultations.filter((c) => assignmentColumnOf(c) === col.id);
            return (
              <div key={col.id} className="w-[280px] shrink-0">
                <div className="text-[12.5px] font-bold text-grey-500 mb-2.5">
                  {col.label} <span className="text-grey-400">{items.length}</span>
                </div>
                {items.length === 0 ? (
                  <div className="text-[12px] text-grey-400 bg-grey-100 rounded-lg px-3 py-4 text-center">없음</div>
                ) : (
                  items.map((c) => (
                    <div key={c.id} className="border-[1.5px] border-grey-200 rounded-xl px-4 py-3 mb-2.5 bg-white">
                      <div className="text-[13px] font-bold text-ink">{c.contactName}</div>
                      <div className="text-[11.5px] text-grey-500 mt-1">
                        {c.contactEmail}
                        {c.studentGrade ? ` · ${c.studentGrade}` : ""}
                      </div>
                      {c.concerns && <div className="text-[12px] text-grey-600 mt-2">{c.concerns}</div>}
                      {col.id === "contact_needed" && (
                        <button
                          disabled={busyId === c.id}
                          onClick={() => handleMarkContacted(c.id)}
                          className="mt-2.5 text-[12px] font-bold px-3 py-1 rounded-lg border-[1.5px] border-grey-200 text-ink disabled:opacity-50"
                        >
                          연락 완료로 표시
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            );
          })}
        </div>
      )}
      <PendingOnboardingStudentsSection />
    </div>
  );
}

// R15-A(2026-09-23) — 관리자 "Onboarding > 계정 생성"에서 담당으로 지정됐지만
// 아직 계정이 안 만들어진(가입 대기) 학생. 상담이 아니므로 위 칸반과는 분리해
// 보여준다 — 다음 슬라이스(신규 배정 칸반 확장)에서 계정생성→체험→정규전환
// 전체 파이프라인 카드로 통합할 예정, 지금은 목록만.
function PendingOnboardingStudentsSection() {
  const [students, setStudents] = useState<PendingOnboardingStudent[] | null>(null);

  useEffect(() => {
    loadMyPendingOnboardingStudentsAction()
      .then(setStudents)
      .catch(() => setStudents([]));
  }, []);

  if (!students || students.length === 0) return null;

  return (
    <div className="mt-8">
      <h2 className="text-[15px] font-extrabold text-ink mb-1">가입 대기</h2>
      <p className="text-[12px] text-grey-500 mb-3">
        관리자가 계정 생성 안내를 발송했고 내가 담당인 학생입니다. 상담 신청 건이 아닙니다.
      </p>
      <div className="flex flex-col gap-2 max-w-[420px]">
        {students.map((s) => (
          <div key={s.linkStudentId} className="border-[1.5px] border-grey-200 rounded-xl px-4 py-3 bg-white">
            <div className="text-[13px] font-bold text-ink">
              {s.studentName} <span className="font-normal text-grey-500">({s.studentEmail})</span>
            </div>
            <div className="text-[11.5px] text-grey-500 mt-1">
              보호자: {s.guardianName}({s.guardianEmail})
            </div>
            <div className="text-[11.5px] text-grey-500 mt-0.5">
              {s.linkStatus === "pending"
                ? s.noticeDeliveryStatus === "sent"
                  ? "안내 발송됨 — 보호자 확인 대기"
                  : "안내 발송 대기"
                : s.linkStatus === "redeemed"
                  ? "보호자 확인 완료 — 계정 생성 진행 중"
                  : s.linkStatus === "expired"
                    ? "안내 링크 만료됨"
                    : "취소됨"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const MEETING_STATUS_LABEL: Record<string, string> = {
  requested: "신청됨",
  confirming: "확인 중",
  scheduling: "일정 조율 중",
  scheduled: "일정 확정",
  completed: "완료",
  cancelled: "거절됨",
};

function formatMeetingDateTime(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" });
}

// 2026-09-22(사용자 지시 — "관리자/컨설턴트가 최종 확인 후 확정") — 학생이
// 개인 단위로 신청한 일정(meeting_requests.consultant_id=본인)을 확인하고
// 확정(요청 시간 그대로 또는 조정)하거나 거절한다.
function MeetingRequestsPanel() {
  const [meetings, setMeetings] = useState<AssignedMeetingRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");

  function reload() {
    listMyAssignedMeetingRequestsAction()
      .then(setMeetings)
      .catch((e) => setError(e instanceof Error ? e.message : "불러오지 못했습니다."));
  }

  useEffect(() => {
    reload();
  }, []);

  function startEdit(m: AssignedMeetingRequest) {
    setEditingId(m.id);
    setError(null);
    // 2026-09-22(실사용자 UAT에서 발견 — 확정 시각이 신청 시각과 7시간 어긋남) —
    // datetime-local 입력은 "지역 시간" 문자열을 그대로 받는다. toISOString()은
    // 항상 UTC라 여기 쓰면 안 된다(대신 로컬 getter로 조립).
    const toLocalInput = (iso: string | null) => {
      if (!iso) return "";
      const d = new Date(iso);
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };
    setEditStart(toLocalInput(m.startsAt));
    setEditEnd(toLocalInput(m.endsAt));
  }

  async function handleConfirm(meetingRequestId: string) {
    if (!editStart || !editEnd) {
      setError("시작·종료 시각을 모두 입력해주세요.");
      return;
    }
    setBusyId(meetingRequestId);
    setError(null);
    try {
      await scheduleMyMeetingRequestAction({
        meetingRequestId,
        startsAt: new Date(editStart).toISOString(),
        endsAt: new Date(editEnd).toISOString(),
      });
      setEditingId(null);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "확정에 실패했습니다.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleCancel(meetingRequestId: string) {
    setBusyId(meetingRequestId);
    setError(null);
    try {
      await cancelMyMeetingRequestAction(meetingRequestId);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "거절에 실패했습니다.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="max-w-[640px] px-8 py-8">
      <h1 className="text-[20px] font-extrabold text-ink mb-5">일정 요청</h1>
      {error && <p className="text-[12.5px] text-red mb-3">{error}</p>}
      {meetings === null ? (
        <p className="text-[13px] text-grey-500">불러오는 중...</p>
      ) : meetings.length === 0 ? (
        <div className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center">
          아직 신청된 일정이 없습니다.
        </div>
      ) : (
        <div className="space-y-2.5">
          {meetings.map((m) => (
            <div key={m.id} className="border-[1.5px] border-grey-200 rounded-xl px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-bold text-ink">{m.studentName ?? "학생"}</span>
                <span className="text-[11px] text-grey-500">{MEETING_STATUS_LABEL[m.status] ?? m.status}</span>
              </div>
              {m.content && <div className="text-[12px] text-grey-600 mt-1">사유: {m.content}</div>}
              {m.startsAt && (
                <div className="text-[12px] text-grey-500 mt-1">희망 시간: {formatMeetingDateTime(m.startsAt)}</div>
              )}
              {m.googleMeetLink && (
                <a href={m.googleMeetLink} target="_blank" rel="noreferrer" className="inline-block mt-1 text-[12px] font-semibold text-ink underline">
                  Google Meet 링크
                </a>
              )}
              {(m.status === "requested" || m.status === "confirming" || m.status === "scheduling") && (
                <div className="mt-2.5">
                  {editingId === m.id ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="datetime-local"
                        value={editStart}
                        onChange={(e) => setEditStart(e.target.value)}
                        className="border-[1.5px] border-grey-200 rounded-lg px-2 py-1 text-[12px]"
                      />
                      <span className="text-[12px] text-grey-400">~</span>
                      <input
                        type="datetime-local"
                        value={editEnd}
                        onChange={(e) => setEditEnd(e.target.value)}
                        className="border-[1.5px] border-grey-200 rounded-lg px-2 py-1 text-[12px]"
                      />
                      <button
                        type="button"
                        disabled={busyId === m.id}
                        onClick={() => handleConfirm(m.id)}
                        className="text-[12px] font-bold px-3 py-1 rounded-lg bg-ink text-white disabled:opacity-50"
                      >
                        확정
                      </button>
                      <button type="button" onClick={() => setEditingId(null)} className="text-[12px] font-bold text-grey-500">
                        취소
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(m)}
                        className="text-[12px] font-bold px-3 py-1 rounded-lg border-[1.5px] border-grey-200 text-ink"
                      >
                        확정/시간 조정
                      </button>
                      <button
                        type="button"
                        disabled={busyId === m.id}
                        onClick={() => handleCancel(m.id)}
                        className="text-[12px] font-bold px-3 py-1 rounded-lg text-red disabled:opacity-50"
                      >
                        거절
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
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
  const [acceptingNewWork, setAcceptingNewWork] = useState<boolean | null>(null);

  function reload() {
    listMyAvailabilityRulesAction()
      .then(setRules)
      .catch((e) => setError(e instanceof Error ? e.message : "불러오지 못했습니다."));
  }
  useEffect(() => {
    reload();
    loadMyAcceptingNewWorkAction().then(setAcceptingNewWork).catch(() => setAcceptingNewWork(true));
  }, []);

  async function handleToggleAcceptingNewWork() {
    if (acceptingNewWork === null) return;
    const next = !acceptingNewWork;
    setBusy(true);
    try {
      await setMyAcceptingNewWorkAction(next);
      setAcceptingNewWork(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "설정을 바꾸지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

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
        여기서 등록한 시간대만 배정된 고객에게 예약 가능 시간으로 보여집니다.
      </p>
      {error && <div className="mb-4 text-[13px] font-semibold text-red bg-red/5 rounded-lg px-4 py-3">{error}</div>}

      {acceptingNewWork !== null && (
        <div className="flex items-center justify-between border-[1.5px] border-grey-200 rounded-xl px-4 py-3 mb-6">
          <div>
            <div className="text-[13px] font-bold text-ink">신규 배정 받기</div>
            <div className="text-[11.5px] text-grey-500">
              {acceptingNewWork ? "자동배정 대상에 포함됩니다." : "자동배정 대상에서 제외됩니다(관리자 수동 배정은 계속 받을 수 있습니다)."}
            </div>
          </div>
          <button
            disabled={busy}
            onClick={handleToggleAcceptingNewWork}
            className={
              "text-[12px] font-bold px-4 py-1.5 rounded-lg disabled:opacity-50 " +
              (acceptingNewWork ? "bg-ink text-white" : "border-[1.5px] border-grey-200 text-ink")
            }
          >
            {acceptingNewWork ? "받는 중" : "받지 않음"}
          </button>
        </div>
      )}

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

// 2026-09-22(사용자 지시) — 담당 학생 목록에 메신저 안읽음 배지. 학생마다
// household가 달라 학생 수만큼 병렬 조회한다(N이 작다 — 컨설턴트 1인당 담당
// 학생 수가 많지 않은 전제).
function StudentList({
  students,
  onSelect,
}: {
  students: ConsultantStudent[];
  onSelect: (id: string) => void;
}) {
  const [unreadByStudent, setUnreadByStudent] = useState<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      students.map((s) =>
        getConsultantMessengerUnreadCountAction(s.id)
          .then((count) => [s.id, count] as const)
          .catch(() => [s.id, 0] as const)
      )
    ).then((entries) => {
      if (!cancelled) setUnreadByStudent(Object.fromEntries(entries));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [students.map((s) => s.id).join(",")]);

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
            className="w-full text-left border-[1.5px] border-grey-200 rounded-xl px-5 py-3.5 mb-2.5 flex items-center justify-between"
          >
            <span className="text-[13.5px] font-bold text-ink">{s.name ?? "이름 없음"}</span>
            {(unreadByStudent[s.id] ?? 0) > 0 && (
              <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-red text-white text-[10px] font-bold flex items-center justify-center">
                {unreadByStudent[s.id] > 9 ? "9+" : unreadByStudent[s.id]}
              </span>
            )}
          </button>
        ))
      )}
    </div>
  );
}

type StudentSubView = "overview" | "board" | "roadmap" | "messenger";

// 컨설턴트 Round A(2026-09-22 사용자 지시) — 담당 학생 진입 시 Overview/Board/
// Roadmap 세 화면을 오갈 수 있게 하고, Board는 학생 본인처럼 직접 수정할 수
// 있게 한다(RLS: 20261461000000, is_assigned_consultant_of()).
function StudentPanel({
  studentId,
  studentName,
  onBack,
}: {
  studentId: string;
  studentName: string;
  onBack: () => void;
}) {
  const [subView, setSubView] = useState<StudentSubView>("overview");
  // 2026-09-22(사용자 지적 — 탭 전환마다 로딩이 길다) — Overview/Board가
  // 각자 loadStudentBoardCardsAction을 따로 호출해 학생을 열 때마다 최대
  // 2번 같은 데이터를 중복 조회했다. 여기서 한 번만 불러와 두 탭이 공유한다.
  const [cards, setCards] = useState<BoardCard[] | null>(null);
  const [cardsError, setCardsError] = useState<string | null>(null);

  function reloadCards() {
    loadStudentBoardCardsAction(studentId)
      .then(setCards)
      .catch((e) => setCardsError(e instanceof Error ? e.message : "불러오지 못했습니다."));
  }
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 데이터 로드 시작 시 상태 초기화(관용적 패턴)
    setCards(null);
    reloadCards();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  return (
    <div className="max-w-[720px] px-8 py-8">
      <button
        onClick={onBack}
        className="text-[13px] text-grey-600 font-semibold border-[1.5px] border-grey-200 rounded-lg px-3 py-1.5 hover:bg-grey-100 active:scale-95 transition-transform"
      >
        ← 담당 학생 목록
      </button>
      <h1 className="text-[18px] font-extrabold text-ink mt-2 mb-4">{studentName}</h1>

      <div className="flex gap-1 mb-5 border-b border-grey-200">
        {(
          [
            { id: "overview", label: "Overview" },
            { id: "board", label: "Board" },
            { id: "roadmap", label: "Roadmap" },
            { id: "messenger", label: "메신저" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setSubView(t.id)}
            className={
              "px-3 py-2 text-[13px] font-bold border-b-2 -mb-px " +
              (subView === t.id ? "border-ink text-ink" : "border-transparent text-grey-500")
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {subView === "overview" ? (
        cards === null ? (
          <div className="py-8 text-[13px] text-grey-500">불러오는 중...</div>
        ) : (
          <PlannerOverviewView cards={cards} />
        )
      ) : subView === "board" ? (
        <StudentBoardPanel studentId={studentId} cards={cards} error={cardsError} onReload={reloadCards} />
      ) : subView === "roadmap" ? (
        <StudentRoadmapPanel studentId={studentId} />
      ) : (
        <ConsultantMessengerPanel key={studentId} studentId={studentId} />
      )}
    </div>
  );
}

function StudentBoardPanel({
  studentId,
  cards,
  error,
  onReload,
}: {
  studentId: string;
  cards: BoardCard[] | null;
  error: string | null;
  onReload: () => void;
}) {
  const [newTitle, setNewTitle] = useState("");
  const [adding, setAdding] = useState(false);

  async function handleAdd() {
    const title = newTitle.trim();
    if (!title) return;
    setAdding(true);
    try {
      await createStudentManualTaskAction(studentId, title);
      setNewTitle("");
      onReload();
    } finally {
      setAdding(false);
    }
  }

  async function handleMove(cardId: string, status: BoardCard["status"]) {
    await updateStudentManualTaskStatusAction(cardId, status);
    onReload();
  }

  async function handleDelete(cardId: string) {
    await deleteStudentManualTaskAction(cardId);
    onReload();
  }

  if (cards === null) return <div className="py-8 text-[13px] text-grey-500">불러오는 중...</div>;

  return (
    <div>
      {error && <div className="mb-4 text-[13px] font-semibold text-red bg-red/5 rounded-lg px-4 py-3">{error}</div>}
      <form
        className="flex gap-2 mb-5"
        onSubmit={(e) => {
          e.preventDefault();
          void handleAdd();
        }}
      >
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="+ 할 일 추가"
          className="flex-1 border-[1.5px] border-grey-200 rounded-lg px-3 py-1.5 text-[13px]"
        />
        <button type="submit" disabled={adding || !newTitle.trim()} className="text-[13px] font-bold bg-ink text-white rounded-lg px-4 py-1.5 disabled:opacity-50">
          추가
        </button>
      </form>
      <BoardColumnsView cards={cards} onMove={handleMove} onDelete={handleDelete} />
    </div>
  );
}

function StudentRoadmapPanel({ studentId }: { studentId: string }) {
  const [state, setState] = useState<
    { status: "loading" } | { status: "error"; message: string } | { status: "ready"; data: RoadmapData }
  >({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 데이터 로드 시작 시 상태 초기화(관용적 패턴)
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

  if (state.status === "loading") return <div className="py-8 text-[13px] text-grey-500">불러오는 중...</div>;
  if (state.status === "error") return <div className="py-8 text-[13px] text-red">{state.message}</div>;
  return <RoadmapView data={state.data} />;
}

function formatMessengerDateTime(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" });
}

// 2026-09-22 — 컨설턴트 household 메신저(읽기+답장 전용, 새 문의 열기는 없음).
// app/parent/MessengerTab.tsx와 같은 데이터·같은 문의 단위 스레드를 다루지만,
// studentId로 진입해 household를 서버 액션 안에서 알아낸다(RLS가 담당 확인).
function ConsultantMessengerPanel({ studentId }: { studentId: string }) {
  const [inquiries, setInquiries] = useState<HouseholdInquirySummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [subTab, setSubTab] = useState<"open" | "closed">("open");
  const [openId, setOpenId] = useState<string | null>(null);

  function loadInquiries() {
    listConsultantInquiriesAction(studentId)
      .then(setInquiries)
      .catch((e) => setError(e instanceof Error ? e.message : "문의 목록을 불러오지 못했습니다."));
  }

  useEffect(() => {
    loadInquiries();
    markConsultantMessengerReadAction(studentId).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openInquiry = inquiries?.find((i) => i.id === openId) ?? null;
  if (openInquiry) {
    return (
      <ConsultantInquiryDetail
        studentId={studentId}
        inquiry={openInquiry}
        onBack={() => {
          setOpenId(null);
          loadInquiries();
        }}
      />
    );
  }

  const visible = (inquiries ?? []).filter((i) => i.status === subTab);

  return (
    <div>
      {error && <p className="text-[12.5px] text-red mb-3">{error}</p>}
      <div className="flex gap-1.5 mb-3">
        {(["open", "closed"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setSubTab(t)}
            className={
              "text-[12px] font-bold px-3 py-1.5 rounded-full " +
              (subTab === t ? "bg-ink text-white" : "bg-grey-100 text-grey-600")
            }
          >
            {t === "open" ? "진행 중 문의" : "지난 문의"}
          </button>
        ))}
      </div>

      {inquiries === null && !error && <p className="text-[13px] text-grey-500">불러오는 중...</p>}
      {inquiries && visible.length === 0 && (
        <p className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center">
          {subTab === "open" ? "진행 중인 문의가 없습니다." : "지난 문의가 없습니다."}
        </p>
      )}
      {inquiries && visible.length > 0 && (
        <ul className="border-[1.5px] border-grey-200 rounded-xl divide-y divide-grey-100">
          {visible.map((i) => (
            <li key={i.id}>
              <button
                type="button"
                onClick={() => setOpenId(i.id)}
                className="w-full text-left px-4 py-3 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-[13px] text-ink truncate">{i.firstMessage}</p>
                  <p className="text-[11px] text-grey-500 mt-0.5">
                    {i.status === "closed" ? `종료됨 · ${formatMessengerDateTime(i.closedAt)}` : `최근 메시지 ${formatMessengerDateTime(i.lastMessageAt)}`}
                  </p>
                </div>
                <span className="text-[11px] font-bold text-grey-400 shrink-0">›</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ConsultantInquiryDetail({
  studentId,
  inquiry,
  onBack,
}: {
  studentId: string;
  inquiry: HouseholdInquirySummary;
  onBack: () => void;
}) {
  const [messages, setMessages] = useState<HouseholdMessage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const readOnly = inquiry.status === "closed";

  function loadMessages() {
    listConsultantInquiryMessagesAction(inquiry.id)
      .then(setMessages)
      .catch((e) => setError(e instanceof Error ? e.message : "메시지를 불러오지 못했습니다."));
  }

  useEffect(() => {
    loadMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inquiry.id]);

  async function handleSend() {
    if (!draft.trim()) return;
    setSending(true);
    setError(null);
    try {
      await sendConsultantInquiryMessageAction(studentId, inquiry.id, draft);
      setDraft("");
      loadMessages();
    } catch (e) {
      setError(e instanceof Error ? e.message : "전송에 실패했습니다.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="text-[13px] text-grey-600 font-semibold border-[1.5px] border-grey-200 rounded-lg px-3 py-1.5 hover:bg-grey-100 active:scale-95 transition-transform mb-4"
      >
        ← 문의 목록으로
      </button>
      {readOnly && (
        <p className="text-[12px] font-bold text-grey-500 bg-grey-100 rounded-lg px-3 py-2 mb-3">
          종료된 문의입니다({formatMessengerDateTime(inquiry.closedAt)}) — 읽기 전용입니다.
        </p>
      )}
      <section className="border-[1.5px] border-grey-200 rounded-xl p-4">
        {error && <p className="text-[12.5px] text-red mb-2">{error}</p>}
        {messages === null && !error && <p className="text-[13px] text-grey-500">불러오는 중...</p>}
        {messages && messages.length > 0 && (
          <div className="space-y-2 mb-3 max-h-[420px] overflow-y-auto">
            {messages.map((m) => {
              const isMine = m.senderRole === "consultant";
              const label =
                m.senderRole === "guardian"
                  ? "보호자"
                  : m.senderRole === "admin"
                    ? "관리자"
                    : m.senderRole === "student"
                      ? "학생"
                      : "나";
              return (
                <div
                  key={m.id}
                  className={"rounded-lg px-3 py-2 text-[12.5px] max-w-[85%] " + (isMine ? "bg-ink text-white ml-auto" : "bg-grey-100 text-ink")}
                >
                  <div>{m.body}</div>
                  <div className={"text-[10.5px] mt-1 " + (isMine ? "text-white/70" : "text-grey-500")}>
                    {label} · {formatMessengerDateTime(m.createdAt)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {!readOnly && (
          <div className="flex gap-2">
            <textarea
              aria-label="메시지 내용"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="메시지를 입력해주세요"
              className="flex-1 px-3 py-2 border-[1.5px] border-grey-200 rounded-lg text-[13px] min-h-[54px]"
            />
            <button
              type="button"
              disabled={sending || !draft.trim()}
              onClick={handleSend}
              className="px-4 py-2 rounded-lg bg-ink text-white text-[13px] font-bold disabled:opacity-50 self-end"
            >
              전송
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
