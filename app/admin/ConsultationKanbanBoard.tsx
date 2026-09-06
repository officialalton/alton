"use client";

// M4 UAT #3.1/#5 — "상담 현황" 칸반 보드. 5단계(상담 신청 – 상담 일정 확정 –
// 체험 신청 – 체험 일정 확정 – 계약서 전달)로 압축한 보드뷰 + 카드 상세 패널에서
// 선생님 배정을 제외한 모든 후속 액션(체험 온보딩 안내, 체험수업권 재처리,
// 체험 리뷰 확정 검수, 정규 계약 발송)을 처리하고, "상담 종료" 액션으로
// 지난 상담 탭으로 이동시킨다.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  listKanbanBoardAction,
  getConsultationCardDetailAction,
  getClosureDraftAction,
  closeConsultationAction,
  type KanbanCard,
  type ConsultationCardDetail,
} from "./consultation-kanban-actions";
import {
  KANBAN_STAGE_ORDER,
  KANBAN_STAGE_LABEL,
  CLOSURE_TYPE_LABEL,
  type ConsultationClosureType,
} from "./consultation-kanban-constants";
import {
  acceptConsultationRequest,
  rejectConsultationRequest,
  recordConsultationOutcome,
  retryTrialEntitlementGrant,
} from "./consultation-scheduling-actions";
import {
  sendTrialOnboardingNoticeAction,
  sendRegularContractOneClickAction,
  confirmTrialIntentAction,
  planTrialSubjectAndAssignTeacherAction,
} from "./trial-onboarding-actions";
import { createNewContractVersionForResend } from "./consultation-actions";
import LessonReviewAdminEditor from "./LessonReviewAdminEditor";
import type { AdminSubject } from "./subject-data";
import type { MatchingTeacherCandidate } from "./matching-data";

const btnPrimary = "text-[12px] font-bold text-white bg-ink rounded-lg px-3 py-1.5 disabled:opacity-50";
const btnSecondary = "text-[12px] font-bold text-ink border-[1.5px] border-grey-200 rounded-lg px-3 py-1.5 disabled:opacity-50";
const errText = "text-[12px] text-red mb-2";

export default function ConsultationKanbanBoard({
  subjects,
  teacherCandidatesBySubject,
}: {
  subjects: AdminSubject[];
  teacherCandidatesBySubject: Record<string, MatchingTeacherCandidate[]>;
}) {
  const router = useRouter();
  const [cards, setCards] = useState<KanbanCard[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  async function load() {
    try {
      setCards(await listKanbanBoardAction());
    } catch (e) {
      setError(e instanceof Error ? e.message : "칸반 보드 조회에 실패했습니다.");
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  function refresh() {
    load();
    router.refresh();
  }

  if (error) return <p className={errText}>{error}</p>;
  if (!cards) return <p className="text-[13px] text-grey-500">불러오는 중...</p>;

  return (
    <div>
      <div className="grid grid-cols-5 gap-3" data-testid="consultation-kanban-board">
        {KANBAN_STAGE_ORDER.map((stage) => {
          const inStage = cards.filter((c) => c.stage === stage);
          return (
            <div key={stage} className="min-w-0" data-testid={`kanban-column-${stage}`}>
              <div className="text-[12.5px] font-bold text-ink mb-2 flex items-center justify-between">
                <span>{KANBAN_STAGE_LABEL[stage]}</span>
                <span className="text-[11px] font-semibold text-grey-500">{inStage.length}</span>
              </div>
              <div className="space-y-2">
                {inStage.map((c) => (
                  <button
                    key={c.id}
                    data-testid={`kanban-card-${c.id}`}
                    onClick={() => setOpenId(c.id)}
                    className="w-full text-left border-[1.5px] border-grey-200 rounded-xl px-3 py-2.5 hover:border-ink"
                  >
                    <div className="text-[13px] font-bold text-ink truncate">{c.contact_name}</div>
                    <div className="text-[11px] text-grey-500 truncate">{c.contact_email}</div>
                    {c.student_grade && <div className="text-[10.5px] text-grey-400">{c.student_grade}</div>}
                  </button>
                ))}
                {inStage.length === 0 && <p className="text-[11px] text-grey-400">해당 상담 없음</p>}
              </div>
            </div>
          );
        })}
      </div>

      {openId && (
        <ConsultationCardDetailPanel
          consultationId={openId}
          subjects={subjects}
          teacherCandidatesBySubject={teacherCandidatesBySubject}
          onClose={() => setOpenId(null)}
          onChanged={refresh}
        />
      )}
    </div>
  );
}

function ConsultationCardDetailPanel({
  consultationId,
  subjects,
  teacherCandidatesBySubject,
  onClose,
  onChanged,
}: {
  consultationId: string;
  subjects: AdminSubject[];
  teacherCandidatesBySubject: Record<string, MatchingTeacherCandidate[]>;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [detail, setDetail] = useState<ConsultationCardDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [closing, setClosing] = useState(false);

  async function load() {
    try {
      setDetail(await getConsultationCardDetailAction(consultationId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "상담 상세 조회에 실패했습니다.");
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consultationId]);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await load();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "작업에 실패했습니다.");
    }
    setBusy(false);
  }

  if (!detail) {
    return (
      <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-40" onClick={onClose}>
        <div className="bg-white rounded-xl p-6" onClick={(e) => e.stopPropagation()}>불러오는 중...</div>
      </div>
    );
  }

  const c = detail.consultation;

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-40" onClick={onClose}>
      <div
        className="bg-white rounded-xl p-6 max-w-lg w-full max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        data-testid="consultation-card-detail"
      >
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-[15px] font-extrabold text-ink">{c.contact_name}</h2>
          <button onClick={onClose} className="text-[12px] text-grey-500">닫기</button>
        </div>
        <div className="text-[12px] text-grey-500 mb-3">
          {c.contact_email} {c.contact_phone ? `· ${c.contact_phone}` : ""} · 상태: {c.status}
          {c.outcome ? ` · 결과: ${c.outcome}` : ""}
        </div>
        {error && <p className={errText}>{error}</p>}

        {/* 1. 상담 신청 단계 — 수락/거절 */}
        {c.status === "requested" && (
          <div className="mb-3 flex gap-2">
            <button
              className={btnPrimary}
              disabled={busy}
              onClick={() => run(() => acceptConsultationRequest(c.id))}
            >
              수락(Calendar·Meet 생성)
            </button>
            <button
              className={btnSecondary}
              disabled={busy}
              onClick={() => run(() => rejectConsultationRequest(c.id, "관리자 판단"))}
            >
              거절
            </button>
          </div>
        )}

        {/* 2. 상담 일정 확정 단계 — 결과 기록 */}
        {(c.status === "scheduled" || (c.status === "completed" && (!c.outcome || c.outcome === "on_hold"))) && (
          <OutcomeForm consultationId={c.id} onDone={() => run(async () => {})} />
        )}

        {/* 3. 체험 신청 단계 — 체험 동의/온보딩 안내, 체험수업권 재처리 */}
        {c.outcome === "trial_recommended" && (
          <div className="mb-3 space-y-2">
            <div className="text-[11.5px] font-bold text-grey-500">체험 온보딩</div>
            {!c.trial_intent_confirmed_at && (
              <button
                className={btnSecondary}
                disabled={busy}
                onClick={() => run(() => confirmTrialIntentAction(c.id))}
              >
                체험 진행 확정(보호자 확인)
              </button>
            )}
            {c.trial_intent_confirmed_at && detail.pipeline && !detail.pipeline.steps.find((s) => s.key === "account_linked")?.done && (
              <TrialNoticeForm
                consultationId={c.id}
                defaultGuardianEmail={detail.guardianEmail ?? c.contact_email}
                defaultGuardianName={detail.guardianName ?? c.contact_name}
                defaultStudentGrade={c.student_grade ?? ""}
                noticeDeliveryStatus={detail.noticeDeliveryStatus}
                noticeSendError={detail.noticeSendError}
                busy={busy}
                onSend={(fn) => run(fn)}
              />
            )}
            {c.trial_entitlement_grant_status === "failed" && (
              <button
                className={btnSecondary}
                disabled={busy}
                onClick={() => run(() => retryTrialEntitlementGrant(c.id))}
              >
                체험수업권 지급 재처리
              </button>
            )}
          </div>
        )}

        {/* 4. 체험 일정 확정 단계 — 체험 리뷰 확정 검수 */}
        {detail.pipeline?.subjectEnrollmentId && (
          <LessonReviewAdminEditor subjectEnrollmentId={detail.pipeline.subjectEnrollmentId} />
        )}

        {/* 5. 계약서 전달 단계 — 정규 계약 발송 */}
        {(c.outcome === "regular_recommended" || detail.pipeline?.steps.find((s) => s.key === "regular_intent")?.done) &&
          detail.pipeline?.subjectEnrollmentId &&
          detail.contractId && (
            <div className="mb-3">
              <div className="text-[11.5px] font-bold text-grey-500 mb-1">정규 계약</div>
              {detail.contractStatus === "draft" && !detail.latestContractVersionHasEnvelope && (
                <div className="text-[12px] text-red mb-1.5">
                  발송 실패 — 관리자 조치 필요(계약은 draft 상태로 남아있습니다). 아래에서 다시 시도할 수 있습니다.
                </div>
              )}
              {!detail.latestContractVersionHasEnvelope ? (
                <ContractSendForm
                  childId={c.child_id!}
                  subjectEnrollmentId={detail.pipeline.subjectEnrollmentId}
                  guardianEmail={detail.guardianEmail ?? ""}
                  guardianName={detail.guardianName ?? ""}
                  childName={detail.childName ?? ""}
                  busy={busy}
                  onSend={(fn) => run(fn)}
                />
              ) : (
                <button
                  className={btnSecondary}
                  disabled={busy}
                  onClick={() => run(async () => {
                    await createNewContractVersionForResend({ contractId: detail.contractId! });
                  })}
                >
                  재발송(새 버전)
                </button>
              )}
            </div>
          )}

        {/* 2026-09-05 사용자 지시: "선생님 배정만 빼고" 조건 폐기 — 체험 관련
            과목 수강 계획 + 선생님 최초 배정을 전부 이 카드 안에서 처리한다
            (매칭 탭의 SubjectEnrollmentPanel은 이후 선생님 변경 등 일반
            운영에만 계속 쓰인다). 아직 과목 수강 계획 자체가 없으면(파이프라인
            subjectEnrollmentId가 null) 과목→선생님 2단계 클릭 폼을 보여준다. */}
        {c.child_id && !detail.pipeline?.subjectEnrollmentId && (
          <SubjectTeacherAssignForm
            childId={c.child_id}
            subjects={subjects}
            teacherCandidatesBySubject={teacherCandidatesBySubject}
            busy={busy}
            onAssign={(fn) => run(fn)}
          />
        )}

        <div className="border-t border-grey-200 pt-3 mt-2">
          {!closing ? (
            <button className={btnSecondary} disabled={busy} onClick={() => setClosing(true)}>
              상담 종료
            </button>
          ) : (
            <ClosureForm
              consultationId={c.id}
              busy={busy}
              onCancel={() => setClosing(false)}
              onClose={(fn) => run(fn)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function OutcomeForm({ consultationId, onDone }: { consultationId: string; onDone: () => void }) {
  const [outcome, setOutcome] = useState<"trial_recommended" | "regular_recommended" | "on_hold" | "closed">("trial_recommended");
  const [summary, setSummary] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="mb-3 border border-grey-200 rounded-lg p-3">
      <div className="text-[11.5px] font-bold text-grey-500 mb-1.5">상담 결과 기록</div>
      <select
        value={outcome}
        onChange={(e) => setOutcome(e.target.value as typeof outcome)}
        className="border-[1.5px] border-grey-200 rounded-lg px-2 py-1 text-[12px] mb-1.5"
      >
        <option value="trial_recommended">체험 진행 권장</option>
        <option value="regular_recommended">정규 진행 권장</option>
        <option value="on_hold">보류</option>
        <option value="closed">종료</option>
      </select>
      <textarea
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
        placeholder="관리자 검토 요약(필수)"
        className="w-full border-[1.5px] border-grey-200 rounded-lg px-2 py-1.5 text-[12px] mb-1.5"
      />
      {error && <p className={errText}>{error}</p>}
      <button
        className={btnPrimary}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            await recordConsultationOutcome({ consultationId, outcome, notes: "", adminReviewSummary: summary });
            onDone();
          } catch (e) {
            setError(e instanceof Error ? e.message : "기록에 실패했습니다.");
          }
          setBusy(false);
        }}
      >
        기록
      </button>
    </div>
  );
}

// 학생 이름·이메일 등 필수값이 비어 있으면 발송 버튼 자체를 비활성화한다
// (2026-09-05 보완 — 이전에는 빈 값으로도 서버 액션 호출이 가능했다). 형식
// 검증은 서버(sendTrialOnboardingNoticeAction)가 우회 대비로 다시 한번 하므로
// 여기서는 "비어 있지 않은지"와 아주 단순한 "@ 포함" 정도만 확인한다.
const SIMPLE_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function TrialNoticeForm({
  consultationId,
  defaultGuardianEmail,
  defaultGuardianName,
  defaultStudentGrade,
  noticeDeliveryStatus,
  noticeSendError,
  busy,
  onSend,
}: {
  consultationId: string;
  defaultGuardianEmail: string;
  defaultGuardianName: string;
  defaultStudentGrade: string;
  noticeDeliveryStatus?: "pending" | "sent" | "failed" | null;
  noticeSendError?: string | null;
  busy: boolean;
  onSend: (fn: () => Promise<void>) => void;
}) {
  const [guardianEmail, setGuardianEmail] = useState(defaultGuardianEmail);
  const [guardianName, setGuardianName] = useState(defaultGuardianName);
  const [studentName, setStudentName] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const [studentGrade, setStudentGrade] = useState(defaultStudentGrade);

  const isValid =
    guardianName.trim().length > 0 &&
    studentName.trim().length > 0 &&
    SIMPLE_EMAIL_RE.test(guardianEmail.trim()) &&
    SIMPLE_EMAIL_RE.test(studentEmail.trim());

  return (
    <div className="border border-grey-200 rounded-lg p-2.5 space-y-1.5">
      {noticeDeliveryStatus === "failed" && (
        <p className={errText} data-testid="trial-notice-failed">
          이전 발송 실패{noticeSendError ? `: ${noticeSendError}` : ""} — 아래에서 다시 시도할 수 있습니다.
        </p>
      )}
      <input value={guardianName} onChange={(e) => setGuardianName(e.target.value)} placeholder="보호자 이름" className="w-full border border-grey-200 rounded px-2 py-1 text-[12px]" />
      <input value={guardianEmail} onChange={(e) => setGuardianEmail(e.target.value)} placeholder="보호자 이메일" className="w-full border border-grey-200 rounded px-2 py-1 text-[12px]" />
      <input value={studentName} onChange={(e) => setStudentName(e.target.value)} placeholder="학생 이름" className="w-full border border-grey-200 rounded px-2 py-1 text-[12px]" />
      <input value={studentEmail} onChange={(e) => setStudentEmail(e.target.value)} placeholder="학생 이메일" className="w-full border border-grey-200 rounded px-2 py-1 text-[12px]" />
      <input value={studentGrade} onChange={(e) => setStudentGrade(e.target.value)} placeholder="학년" className="w-full border border-grey-200 rounded px-2 py-1 text-[12px]" />
      <button
        className={btnSecondary}
        disabled={busy || !isValid}
        onClick={() =>
          onSend(async () => {
            const result = await sendTrialOnboardingNoticeAction({
              consultationId,
              guardianEmail,
              guardianName,
              studentName,
              studentEmail,
              studentGrade,
            });
            if (result.status === "failed") {
              throw new Error(result.error);
            }
          })
        }
      >
        체험 온보딩 안내 발송
      </button>
    </div>
  );
}

function ContractSendForm({
  childId,
  subjectEnrollmentId,
  guardianEmail,
  guardianName,
  childName,
  busy,
  onSend,
}: {
  childId: string;
  subjectEnrollmentId: string;
  guardianEmail: string;
  guardianName: string;
  childName: string;
  busy: boolean;
  onSend: (fn: () => Promise<void>) => void;
}) {
  const [approverTitle, setApproverTitle] = useState("");

  return (
    <div className="border border-grey-200 rounded-lg p-2.5 space-y-1.5">
      <input
        value={approverTitle}
        onChange={(e) => setApproverTitle(e.target.value)}
        placeholder="회사 승인자 직함(필수)"
        className="w-full border border-grey-200 rounded px-2 py-1 text-[12px]"
      />
      <button
        className={btnPrimary}
        disabled={busy || !approverTitle.trim()}
        onClick={() =>
          onSend(async () => {
            await sendRegularContractOneClickAction({
              childId,
              subjectEnrollmentId,
              guardianEmail,
              guardianName,
              childName,
              approverTitle: approverTitle.trim(),
            });
          })
        }
      >
        회사 승인 및 계약 발송
      </button>
    </div>
  );
}

/** 과목 클릭 → 선생님 클릭 2단계 리스트. 개발자 전용 raw UUID 입력 폼을 대체한다
 * (2026-09-05 사용자 지시 2번). 선생님 후보는 매칭 탭과 동일한
 * teacher_curriculum_templates 기반 "과목 전담 가능·active" 목록을 그대로
 * 재사용한다(loadTeacherCandidatesBySubject) — 검색/페이지네이션은 범위 밖. */
function SubjectTeacherAssignForm({
  childId,
  subjects,
  teacherCandidatesBySubject,
  busy,
  onAssign,
}: {
  childId: string;
  subjects: AdminSubject[];
  teacherCandidatesBySubject: Record<string, MatchingTeacherCandidate[]>;
  busy: boolean;
  onAssign: (fn: () => Promise<void>) => void;
}) {
  const [subjectId, setSubjectId] = useState<string | null>(null);

  return (
    <div className="mb-3 border border-grey-200 rounded-lg p-3" data-testid="subject-teacher-assign-form">
      <div className="text-[11.5px] font-bold text-grey-500 mb-1.5">과목·선생님 배정</div>
      {!subjectId ? (
        <div className="flex flex-wrap gap-1.5">
          {subjects.map((s) => (
            <button
              key={s.subjectId}
              data-testid={`assign-subject-${s.subjectId}`}
              className={btnSecondary}
              disabled={busy}
              onClick={() => setSubjectId(s.subjectId)}
            >
              {s.subjectName}
            </button>
          ))}
          {subjects.length === 0 && <p className="text-[11.5px] text-grey-400">등록된 과목이 없습니다.</p>}
        </div>
      ) : (
        <div>
          <div className="text-[11px] text-grey-500 mb-1.5">
            {subjects.find((s) => s.subjectId === subjectId)?.subjectName ?? subjectId} — 선생님 선택
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(teacherCandidatesBySubject[subjectId] ?? []).map((t) => (
              <button
                key={t.id}
                data-testid={`assign-teacher-${t.id}`}
                className={btnSecondary}
                disabled={busy}
                onClick={() =>
                  onAssign(async () => {
                    await planTrialSubjectAndAssignTeacherAction({
                      childId,
                      subjectId,
                      teacherId: t.id,
                      effectiveFrom: new Date().toISOString(),
                    });
                  })
                }
              >
                {t.name}
              </button>
            ))}
            {(teacherCandidatesBySubject[subjectId] ?? []).length === 0 && (
              <p className="text-[11.5px] text-grey-400">이 과목을 가르칠 수 있는 선생님이 없습니다.</p>
            )}
          </div>
          <button
            className="text-[11px] text-grey-500 underline mt-1.5"
            disabled={busy}
            onClick={() => setSubjectId(null)}
          >
            다른 과목 선택
          </button>
        </div>
      )}
    </div>
  );
}

function ClosureForm({
  consultationId,
  busy,
  onCancel,
  onClose,
}: {
  consultationId: string;
  busy: boolean;
  onCancel: () => void;
  onClose: (fn: () => Promise<void>) => void;
}) {
  const [closureType, setClosureType] = useState<ConsultationClosureType>("no_trial");
  const [reviewText, setReviewText] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getClosureDraftAction(consultationId).then((d) => {
      setClosureType(d.suggestedClosureType);
      setReviewText(d.draftText);
      setLoaded(true);
    });
  }, [consultationId]);

  if (!loaded) return <p className="text-[12px] text-grey-500">불러오는 중...</p>;

  return (
    <div data-testid="consultation-closure-form" className="border border-grey-200 rounded-lg p-3 space-y-2">
      <div className="text-[11.5px] font-bold text-grey-500">상담 종료 — 리뷰 확정</div>
      <select
        value={closureType}
        onChange={(e) => setClosureType(e.target.value as ConsultationClosureType)}
        className="border-[1.5px] border-grey-200 rounded-lg px-2 py-1 text-[12px]"
      >
        {(["no_trial", "trial_no_convert", "regular_in_progress", "contract_signed"] as ConsultationClosureType[]).map((t) => (
          <option key={t} value={t}>
            {CLOSURE_TYPE_LABEL[t]}
          </option>
        ))}
      </select>
      <textarea
        value={reviewText}
        onChange={(e) => setReviewText(e.target.value)}
        placeholder="AI 미팅록 재요약본을 확인/수정하세요(필수)"
        rows={4}
        className="w-full border-[1.5px] border-grey-200 rounded-lg px-2 py-1.5 text-[12px]"
      />
      <div className="flex gap-2">
        <button
          className={btnPrimary}
          disabled={busy || reviewText.trim().length === 0}
          onClick={() =>
            onClose(async () => {
              await closeConsultationAction({ consultationId, closureType, reviewText: reviewText.trim() });
            })
          }
        >
          종료 확정
        </button>
        <button className={btnSecondary} disabled={busy} onClick={onCancel}>
          취소
        </button>
      </div>
    </div>
  );
}
