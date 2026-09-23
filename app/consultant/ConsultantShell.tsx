"use client";

import { useEffect, useState } from "react";
import { logout } from "@/app/login/actions";
import { getRoadmapForStudent } from "@/lib/roadmap/actions";
import type { RoadmapData } from "@/lib/roadmap/types";
import RoadmapView from "@/app/components/RoadmapView";
import CollegeExploreSection from "@/app/components/CollegeExploreSection";
import DocumentsPanel from "./DocumentsPanel";
import PlannerOverviewView from "@/app/student/PlannerOverviewView";
import BoardColumnsView from "@/app/components/BoardColumnsView";
import type { ConsultantStudent, EndedConsultantStudent } from "./consultant-data";
import {
  loadStudentBoardCardsAction,
  createStudentManualTaskAction,
  updateStudentManualTaskStatusAction,
  deleteStudentManualTaskAction,
} from "./board-actions";
import type { BoardCard } from "@/lib/board/types";
import type { IntakeConsultation } from "./intake-data";
import { loadMyPendingOnboardingStudentsAction, type PendingOnboardingStudent } from "./intake-actions";
import ConsultationKanbanBoard from "@/app/admin/ConsultationKanbanBoard";
import type { AdminSubject } from "@/app/admin/subject-data";
import type { MatchingTeacherCandidate } from "@/app/admin/matching-data";
import { loadSubjectsAndTeacherCandidatesAction } from "./teacher-assignment-request-actions";
import TeacherAssignmentRequestForm from "./TeacherAssignmentRequestForm";
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
  startConsultantInquiryAction,
} from "./messenger-actions";
import {
  listMyAssignedMeetingRequestsAction,
  scheduleMyMeetingRequestAction,
  cancelMyMeetingRequestAction,
  type AssignedMeetingRequest,
} from "./meeting-actions";
import {
  listMyTimeOffAction,
  createMyTimeOffAction,
  cancelMyTimeOffAction,
  type ConsultantTimeOff,
  type TimeOffConflict,
} from "./time-off-actions";

type NavId = "students" | "assignments" | "schedule" | "documents" | "college-explore";

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

// 컨설턴트 포지션(2026-09-22, 가볍게 시작) — 담당 학생 목록 + 로드맵(쓰기),
// 신규 배정 요청(스펙 §Screen Scope "New assignments"), 본인 가능시간(Schedule,
// Phase 2) 세 화면. 스케줄링 링크 이메일 발송·자동배정은 아직 Phase 2 후속.
export default function ConsultantShell({
  consultantName,
  students,
  endedStudents,
  assignedConsultations,
}: {
  consultantName: string;
  students: ConsultantStudent[];
  endedStudents: EndedConsultantStudent[];
  assignedConsultations: IntakeConsultation[];
}) {
  const [nav, setNav] = useState<NavId>("assignments");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedEndedId, setSelectedEndedId] = useState<string | null>(null);
  const [studentsSubTab, setStudentsSubTab] = useState<"active" | "ended">("active");

  const contactRequiredCount = assignedConsultations.filter((c) => c.status === "requested").length;

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
          <span>New Assignments</span>
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
            setSelectedEndedId(null);
          }}
          aria-current={nav === "students" ? "page" : undefined}
          className={
            "w-full text-left px-2.5 py-2.5 rounded-lg text-[13px] font-semibold " +
            (nav === "students" ? "bg-red text-white" : "text-grey-500 hover:bg-grey-100 hover:text-ink")
          }
        >
          Students
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
          Schedule
        </button>
        <button
          onClick={() => {
            setNav("documents");
            setSelectedId(null);
          }}
          aria-current={nav === "documents" ? "page" : undefined}
          className={
            "w-full text-left px-2.5 py-2.5 rounded-lg text-[13px] font-semibold " +
            (nav === "documents" ? "bg-red text-white" : "text-grey-500 hover:bg-grey-100 hover:text-ink")
          }
        >
          Documents
        </button>
        <button
          onClick={() => {
            setNav("college-explore");
            setSelectedId(null);
          }}
          aria-current={nav === "college-explore" ? "page" : undefined}
          className={
            "w-full text-left px-2.5 py-2.5 rounded-lg text-[13px] font-semibold " +
            (nav === "college-explore" ? "bg-red text-white" : "text-grey-500 hover:bg-grey-100 hover:text-ink")
          }
        >
          College Explore
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
          <MyKanbanSection />
        ) : nav === "schedule" ? (
          <SchedulePanel assignedConsultations={assignedConsultations} />
        ) : nav === "documents" ? (
          <DocumentsPanel />
        ) : nav === "college-explore" ? (
          <div className="px-8 py-8">
            <h1 className="text-[20px] font-extrabold text-ink mb-5">College Explore</h1>
            <CollegeExploreSection canProposeSourceUrl />
          </div>
        ) : selectedId !== null ? (
          <StudentPanel
            studentId={selectedId}
            studentName={students.find((s) => s.id === selectedId)?.name ?? "학생"}
            onBack={() => setSelectedId(null)}
          />
        ) : selectedEndedId !== null ? (
          <EndedStudentPanel
            student={endedStudents.find((s) => s.id === selectedEndedId)!}
            onBack={() => setSelectedEndedId(null)}
          />
        ) : (
          <div className="max-w-[640px] px-8 py-8">
            <h1 className="text-[20px] font-extrabold text-ink mb-5">Students</h1>
            <div className="flex gap-1 mb-5 border-b border-grey-200">
              {(
                [
                  { id: "active", label: "Active" },
                  { id: "ended", label: "Ended" },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  onClick={() => setStudentsSubTab(t.id)}
                  className={
                    "px-3 py-2 text-[13px] font-bold border-b-2 -mb-px " +
                    (studentsSubTab === t.id ? "border-ink text-ink" : "border-transparent text-grey-500")
                  }
                >
                  {t.label}
                </button>
              ))}
            </div>
            {studentsSubTab === "active" ? (
              <StudentList students={students} onSelect={setSelectedId} />
            ) : (
              <EndedStudentList students={endedStudents} onSelect={setSelectedEndedId} />
            )}
          </div>
        )}
      </main>
    </div>
  );
}

// R15-A(2/3, 2026-09-23) — "신규 배정"을 컨설턴트 전용 3칼럼(연락 필요/일정
// 조율 중/일정 확정)에서, 관리자와 같은 데이터·5단계 판정을 쓰는 공유
// ConsultationKanbanBoard(viewerRole="consultant")로 교체한다. "연락 필요"
// 칼럼은 없앤다(사용자 지시) — 배정 알림 발송 여부와 실제 상담 진행은
// 별개이므로, 카드 안 상태(수락 전/후, 온보딩 진행 등)로만 구분한다. 과목·
// 선생님 카탈로그만 이 화면 전용으로 지연 로드한다(관리자 페이지처럼
// SSR로 내려주지 않음 — 컨설턴트 진입 빈도가 낮아 지연 로드가 더 가볍다).
function MyKanbanSection() {
  const [catalog, setCatalog] = useState<{
    subjects: AdminSubject[];
    teacherCandidatesBySubject: Record<string, MatchingTeacherCandidate[]>;
  } | null>(null);

  useEffect(() => {
    loadSubjectsAndTeacherCandidatesAction()
      .then(setCatalog)
      .catch(() => setCatalog({ subjects: [], teacherCandidatesBySubject: {} }));
  }, []);

  return (
    <div className="px-8 py-8">
      <h1 className="text-[20px] font-extrabold text-ink mb-5">신규 배정</h1>
      {!catalog ? (
        <p className="text-[13px] text-grey-500">불러오는 중...</p>
      ) : (
        <ConsultationKanbanBoard
          subjects={catalog.subjects}
          teacherCandidatesBySubject={catalog.teacherCandidatesBySubject}
          viewerRole="consultant"
        />
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
  const [catalog, setCatalog] = useState<{
    subjects: AdminSubject[];
    teacherCandidatesBySubject: Record<string, MatchingTeacherCandidate[]>;
  } | null>(null);
  const [requestingFor, setRequestingFor] = useState<string | null>(null);

  useEffect(() => {
    loadMyPendingOnboardingStudentsAction()
      .then(setStudents)
      .catch(() => setStudents([]));
    loadSubjectsAndTeacherCandidatesAction()
      .then(setCatalog)
      .catch(() => setCatalog({ subjects: [], teacherCandidatesBySubject: {} }));
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
            {/* R15-A(3/3) — 계정이 아직 없어도 선생님에게 사전 문의는 보낼 수
                있다(수락해도 실제 배정은 계정 생성 후에만 확정된다). */}
            {requestingFor === s.linkStudentId ? (
              catalog && (
                <TeacherAssignmentRequestForm
                  linkStudentId={s.linkStudentId}
                  studentName={s.studentName}
                  defaultGrade={s.studentGrade ?? undefined}
                  subjects={catalog.subjects}
                  teacherCandidatesBySubject={catalog.teacherCandidatesBySubject}
                  onSent={() => setRequestingFor(null)}
                />
              )
            ) : (
              <button
                className="mt-2 text-[11.5px] font-bold text-ink underline"
                onClick={() => setRequestingFor(s.linkStudentId)}
              >
                선생님에게 사전 문의
              </button>
            )}
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

// Phase B(3, 2026-09-23) — 기존 "일정 요청"(meetings)과 "가능시간"(schedule)을
// Schedule 메인 탭 하나로 합치고, 서브탭을 Upcoming/Availability/Time Off로
// 나눈다(사용자 지시). Time Off는 신규 — 월간 캘린더 대신(1차 범위는 목록+폼)
// 종일/부분 시간 등록을 지원하고, 등록 전 기존 확정 일정과 겹치면 서버가
// 막고 어떤 일정과 겹치는지 알려준다.
type ScheduleSubTab = "upcoming" | "availability" | "time-off";

function SchedulePanel({ assignedConsultations }: { assignedConsultations: IntakeConsultation[] }) {
  const [subTab, setSubTab] = useState<ScheduleSubTab>("upcoming");
  return (
    <div className="max-w-[640px] px-8 py-8">
      <h1 className="text-[20px] font-extrabold text-ink mb-5">Schedule</h1>
      <div className="flex gap-1 mb-5 border-b border-grey-200">
        {(
          [
            { id: "upcoming", label: "Upcoming" },
            { id: "availability", label: "Availability" },
            { id: "time-off", label: "Time Off" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id)}
            className={
              "px-3 py-2 text-[13px] font-bold border-b-2 -mb-px " +
              (subTab === t.id ? "border-ink text-ink" : "border-transparent text-grey-500")
            }
          >
            {t.label}
          </button>
        ))}
      </div>
      {subTab === "upcoming" ? (
        <UpcomingSchedulePanel assignedConsultations={assignedConsultations} />
      ) : subTab === "availability" ? (
        <AvailabilityPanel />
      ) : (
        <TimeOffPanel />
      )}
    </div>
  );
}

// 2026-09-22(사용자 지시 — "관리자/컨설턴트가 최종 확인 후 확정") — 학생이
// 개인 단위로 신청한 일정(meeting_requests.consultant_id=본인)을 확인하고
// 확정(요청 시간 그대로 또는 조정)하거나 거절한다.
// Phase B(3, 2026-09-23) — Schedule > Upcoming. 학생 개인 일정 요청(신청 확인·
// 확정·변경·거절)과 이미 확정된 상담 일정(consultations.status='scheduled')을
// 한 화면에서 보여준다(사용자 지시: "예정 일정에는 신청 확인·확정·변경·거절과
// 확정된 상담 일정을 보여줍니다").
function UpcomingSchedulePanel({ assignedConsultations }: { assignedConsultations: IntakeConsultation[] }) {
  const confirmedConsultations = assignedConsultations
    .filter((c) => c.status === "scheduled" && c.startsAt)
    .sort((a, b) => (a.startsAt ?? "").localeCompare(b.startsAt ?? ""));

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
    <div>
      {confirmedConsultations.length > 0 && (
        <div className="mb-6">
          <div className="text-[11px] font-bold text-grey-500 uppercase tracking-wide mb-2">확정된 상담 일정</div>
          <div className="space-y-2">
            {confirmedConsultations.map((c) => (
              <div key={c.id} className="border-[1.5px] border-grey-200 rounded-xl px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-bold text-ink">{c.contactName}</span>
                  <span className="text-[11px] text-grey-500">상담</span>
                </div>
                {c.startsAt && (
                  <div className="text-[12px] text-grey-500 mt-1">{formatMeetingDateTime(c.startsAt)}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="text-[11px] font-bold text-grey-500 uppercase tracking-wide mb-2">학생 일정 요청</div>
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
    <div>
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

// Phase B(3, 2026-09-23) — Schedule > Time Off. 종일/부분 시간 등록·취소.
// 등록 시도 시 서버(createMyTimeOffAction)가 기존 확정 일정과의 충돌을
// 검사해, 충돌이 있으면 저장하지 않고 어떤 일정과 겹치는지 알려준다.
function TimeOffPanel() {
  const [items, setItems] = useState<ConsultantTimeOff[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<TimeOffConflict[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [allDay, setAllDay] = useState(true);
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("18:00");
  const [reason, setReason] = useState("");

  function reload() {
    listMyTimeOffAction()
      .then(setItems)
      .catch((e) => setError(e instanceof Error ? e.message : "불러오지 못했습니다."));
  }
  useEffect(() => {
    reload();
  }, []);

  async function handleAdd() {
    if (!date) {
      setError("날짜를 선택해주세요.");
      return;
    }
    const startsAt = allDay ? `${date}T00:00:00` : `${date}T${startTime}:00`;
    const endsAt = allDay ? `${date}T23:59:59` : `${date}T${endTime}:00`;
    setBusy(true);
    setError(null);
    setConflicts(null);
    try {
      const result = await createMyTimeOffAction({
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
        allDay,
        reason: reason.trim() || undefined,
      });
      if ("conflicts" in result) {
        setConflicts(result.conflicts);
        return;
      }
      setDate("");
      setReason("");
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "등록하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel(id: string) {
    setBusy(true);
    try {
      await cancelMyTimeOffAction(id);
      reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {error && <div className="mb-4 text-[13px] font-semibold text-red bg-red/5 rounded-lg px-4 py-3">{error}</div>}
      {conflicts && conflicts.length > 0 && (
        <div className="mb-4 text-[13px] text-red bg-red/5 rounded-lg px-4 py-3">
          <div className="font-bold mb-1">이미 확정된 일정과 겹쳐 등록할 수 없습니다.</div>
          <ul className="list-disc list-inside">
            {conflicts.map((c, i) => (
              <li key={i}>
                {c.label}
                {c.startsAt ? ` · ${formatMeetingDateTime(c.startsAt)}` : ""}
              </li>
            ))}
          </ul>
          <div className="mt-1 text-grey-600">
            Upcoming 탭에서 해당 일정을 먼저 변경·거절한 뒤 다시 등록해주세요.
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-end gap-2 mb-2">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border-[1.5px] border-grey-200 rounded-lg px-2.5 py-1.5 text-[13px]" />
        <label className="flex items-center gap-1.5 text-[12.5px] text-ink">
          <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
          종일
        </label>
        {!allDay && (
          <>
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="border-[1.5px] border-grey-200 rounded-lg px-2.5 py-1.5 text-[13px]" />
            <span className="text-[13px] text-grey-500">~</span>
            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="border-[1.5px] border-grey-200 rounded-lg px-2.5 py-1.5 text-[13px]" />
          </>
        )}
      </div>
      <div className="flex items-center gap-2 mb-6">
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="사유(선택)"
          className="flex-1 border-[1.5px] border-grey-200 rounded-lg px-2.5 py-1.5 text-[13px]"
        />
        <button type="button" disabled={busy} onClick={handleAdd} className="text-[13px] font-bold bg-ink text-white rounded-lg px-4 py-1.5 disabled:opacity-50">
          등록
        </button>
      </div>

      {items === null ? (
        <p className="text-[13px] text-grey-500">불러오는 중…</p>
      ) : items.length === 0 ? (
        <div className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center">등록된 휴무가 없습니다.</div>
      ) : (
        items.map((t) => (
          <div key={t.id} className="flex items-center justify-between border-[1.5px] border-grey-200 rounded-xl px-4 py-3 mb-2">
            <div>
              <span className="text-[13px] font-semibold text-ink">
                {t.allDay
                  ? new Date(t.startsAt).toLocaleDateString("ko-KR")
                  : `${formatMeetingDateTime(t.startsAt)} ~ ${new Date(t.endsAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}`}
              </span>
              {t.reason && <div className="text-[11.5px] text-grey-500 mt-0.5">{t.reason}</div>}
            </div>
            <button disabled={busy} onClick={() => handleCancel(t.id)} className="text-[12px] font-bold text-red disabled:opacity-50">
              취소
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

  if (students.length === 0) {
    return (
      <div className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center">
        아직 배정된 학생이 없습니다.
      </div>
    );
  }
  return (
    <div>
      {students.map((s) => (
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
      ))}
    </div>
  );
}

// Phase B(1, 2026-09-23) — Ended 목록·상세는 기록 조회 전용이다(사용자 지시:
// "종료된 배정은 기록 조회 중심으로 보여주고 현재·이전 담당자의 접근 권한을
// 구분"). 목록에는 종료 시점·사유만 보여주고, 클릭하면 읽기 전용 상세로
// 이동한다 — Board/메신저 등 쓰기 액션은 여전히 서버에서
// is_assigned_consultant_of()로 막히지만(RLS), 화면에서도 애초에 그 버튼
// 자체를 보여주지 않는다.
function EndedStudentList({
  students,
  onSelect,
}: {
  students: EndedConsultantStudent[];
  onSelect: (id: string) => void;
}) {
  if (students.length === 0) {
    return (
      <div className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center">
        배정이 종료된 학생이 없습니다.
      </div>
    );
  }
  return (
    <div>
      {students.map((s) => (
        <button
          key={s.id}
          onClick={() => onSelect(s.id)}
          className="w-full text-left border-[1.5px] border-grey-200 rounded-xl px-5 py-3.5 mb-2.5"
        >
          <div className="flex items-center justify-between">
            <span className="text-[13.5px] font-bold text-ink">{s.name ?? "이름 없음"}</span>
            <span className="text-[11px] text-grey-500">{new Date(s.endedAt).toLocaleDateString("ko-KR")} 종료</span>
          </div>
          {s.reason && <div className="text-[12px] text-grey-500 mt-1">{s.reason}</div>}
        </button>
      ))}
    </div>
  );
}

function EndedStudentPanel({ student, onBack }: { student: EndedConsultantStudent; onBack: () => void }) {
  return (
    <div className="max-w-[640px] px-8 py-8">
      <button
        onClick={onBack}
        className="text-[13px] text-grey-600 font-semibold border-[1.5px] border-grey-200 rounded-lg px-3 py-1.5 hover:bg-grey-100 active:scale-95 transition-transform"
      >
        ← Students
      </button>
      <h1 className="text-[18px] font-extrabold text-ink mt-2 mb-1">{student.name ?? "이름 없음"}</h1>
      <div className="text-[12px] text-grey-500 mb-4">
        {new Date(student.endedAt).toLocaleString("ko-KR")}에 담당이 종료됨
      </div>
      <div className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 bg-grey-100">
        <div className="text-[11px] font-bold text-grey-500 uppercase tracking-wide mb-2">종료 사유</div>
        <div className="text-[13px] text-ink">{student.reason ?? "기록된 사유 없음"}</div>
      </div>
      <div className="text-[12px] text-grey-500 mt-4">
        배정이 종료된 학생은 기록 조회만 가능합니다. 로드맵·보드·메신저 등 실시간 정보는 현재 담당
        컨설턴트만 접근할 수 있습니다.
      </div>
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
  return <RoadmapView data={state.data} canProposeSourceUrl />;
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
  const [composing, setComposing] = useState(false);
  const [newSubject, setNewSubject] = useState("");
  const [newBody, setNewBody] = useState("");
  const [starting, setStarting] = useState(false);

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

      {/* R15-A(Messenger 1/N) — 컨설턴트가 먼저 대화를 시작할 수 있다. */}
      {!composing ? (
        <button
          type="button"
          onClick={() => setComposing(true)}
          className="text-[12px] font-bold text-white bg-ink rounded-lg px-3.5 py-1.5 mb-3"
        >
          + 새 대화 시작
        </button>
      ) : (
        <div className="border-[1.5px] border-grey-200 rounded-xl p-3 mb-3 space-y-1.5">
          <input
            value={newSubject}
            onChange={(e) => setNewSubject(e.target.value)}
            placeholder="주제(선택)"
            className="w-full border border-grey-200 rounded px-2 py-1 text-[12.5px]"
          />
          <textarea
            value={newBody}
            onChange={(e) => setNewBody(e.target.value)}
            placeholder="메시지 내용"
            className="w-full border border-grey-200 rounded px-2 py-1.5 text-[12.5px] min-h-[54px]"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={starting || !newBody.trim()}
              onClick={async () => {
                setStarting(true);
                setError(null);
                try {
                  const { inquiryId } = await startConsultantInquiryAction(studentId, newBody, newSubject);
                  setNewBody("");
                  setNewSubject("");
                  setComposing(false);
                  loadInquiries();
                  setOpenId(inquiryId);
                } catch (e) {
                  setError(e instanceof Error ? e.message : "대화를 시작하지 못했습니다.");
                } finally {
                  setStarting(false);
                }
              }}
              className="text-[12px] font-bold text-white bg-ink rounded-lg px-3.5 py-1.5 disabled:opacity-50"
            >
              {starting ? "보내는 중..." : "보내기"}
            </button>
            <button type="button" className="text-[12px] font-semibold text-grey-500" onClick={() => setComposing(false)}>
              취소
            </button>
          </div>
        </div>
      )}

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
                  {i.subject && <p className="text-[12.5px] font-bold text-ink truncate">{i.subject}</p>}
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
