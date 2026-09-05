"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  createTrialSessionFromConsultation,
  completeTrialSession,
  approveTrialException,
  cancelTrialSession,
  markTrialNoShow,
  createProposal,
  sendProposal,
  respondToProposal,
  retryFailedDriveArtifacts,
  reconcileDocusignStatus,
  retryContractActivation,
} from "./consultation-actions";
import type { ContractActivationRetryItem } from "./consultation-actions";
import ConsultationSchedulingPanel from "./ConsultationSchedulingPanel";
import ConsultationKanbanBoard from "./ConsultationKanbanBoard";
import ClosedConsultationsSection from "./ClosedConsultationsSection";
import type {
  ConsultationListItem,
  TrialSessionListItem,
  ProposalListItem,
  ConsentGapItem,
  CompletedConsentItem,
  DriveArtifactIssue,
  StaleEnvelopeContract,
} from "./consultation-data";
import type { AdminSubject } from "./subject-data";
import type { MatchingTeacherCandidate } from "./matching-data";

type SubTab = "consult" | "scheduling" | "trial" | "consent" | "errors" | "past";

const SUB_NAV: { id: SubTab; label: string }[] = [
  { id: "consult", label: "상담 현황" },
  { id: "scheduling", label: "상담 운영(신청·수락·캘린더)" },
  { id: "trial", label: "체험 관리" },
  { id: "consent", label: "보호자 동의 대기" },
  { id: "past", label: "지난 상담" },
  { id: "errors", label: "오류/재처리 현황판" },
];

const btnPrimary =
  "text-[12px] font-bold text-white bg-ink rounded-lg px-3 py-1.5 disabled:opacity-50";
const btnSecondary =
  "text-[12px] font-bold text-ink border-[1.5px] border-grey-200 rounded-lg px-3 py-1.5 disabled:opacity-50";
const card = "border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-3";
const errText = "text-[12px] text-red mb-2";

export default function ConsultationTab({
  consultations,
  trials,
  proposals,
  consentGaps,
  completedConsents,
  driveIssues,
  staleEnvelopes,
  contractActivationRetries,
  subjects,
  teacherCandidatesBySubject,
}: {
  consultations: ConsultationListItem[];
  trials: TrialSessionListItem[];
  proposals: ProposalListItem[];
  consentGaps: ConsentGapItem[];
  completedConsents: CompletedConsentItem[];
  driveIssues: DriveArtifactIssue[];
  staleEnvelopes: StaleEnvelopeContract[];
  contractActivationRetries: ContractActivationRetryItem[];
  subjects: AdminSubject[];
  teacherCandidatesBySubject: Record<string, MatchingTeacherCandidate[]>;
}) {
  const [sub, setSub] = useState<SubTab>("consult");

  return (
    <div className="px-8 py-8">
      <h1 className="text-[20px] font-extrabold text-ink mb-1">상담</h1>
      <p className="text-[13px] text-grey-500 mb-5">
        상담 → 체험 → 제안서 흐름과 관련 예외 상황을 관리합니다.
      </p>

      <div className="flex gap-1 mb-6 border-b border-grey-200">
        {SUB_NAV.map((n) => (
          <button
            key={n.id}
            onClick={() => setSub(n.id)}
            className={
              "text-[12.5px] font-bold px-3 py-2 -mb-px border-b-2 " +
              (sub === n.id ? "border-ink text-ink" : "border-transparent text-grey-500")
            }
          >
            {n.label}
          </button>
        ))}
      </div>

      {sub === "consult" && (
        <ConsultationKanbanBoard subjects={subjects} teacherCandidatesBySubject={teacherCandidatesBySubject} />
      )}
      {sub === "scheduling" && <ConsultationSchedulingPanel />}
      {sub === "trial" && <TrialSection trials={trials} consultations={consultations} />}
      {sub === "consent" && <ConsentGapSection gaps={consentGaps} completed={completedConsents} />}
      {sub === "past" && <ClosedConsultationsSection />}
      {sub === "errors" && (
        <ErrorDashboardSection
          driveIssues={driveIssues}
          staleEnvelopes={staleEnvelopes}
          consentGaps={consentGaps}
          duplicateCandidates={consultations.filter((c) => c.duplicateOfConsultationId)}
          contractActivationRetries={contractActivationRetries}
        />
      )}
    </div>
  );
}


function TrialSection({
  trials,
  consultations,
}: {
  trials: TrialSessionListItem[];
  consultations: ConsultationListItem[];
}) {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const trialSectionRouter = useRouter();
  void trialSectionRouter;

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button className={btnPrimary} onClick={() => setCreating((v) => !v)}>
          {creating ? "취소" : "체험 생성"}
        </button>
      </div>
      {error && <p className={errText}>{error}</p>}
      {creating && (
        <NewTrialForm
          consultations={consultations}
          onDone={() => setCreating(false)}
          onError={setError}
        />
      )}

      {trials.length === 0 && <p className="text-[13px] text-grey-500">등록된 체험이 없습니다.</p>}

      {trials.map((t) => {
        const open = openId === t.id;
        return (
          <div key={t.id} className={card} data-testid={`trial-card-${t.id}`}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[14px] font-bold text-ink">
                  {t.childName ?? t.childId} · {t.subjectName ?? t.subjectId}{" "}
                  <span className="text-[11px] font-semibold text-grey-500">({t.status})</span>
                </div>
                <div className="text-[12px] text-grey-500">
                  선생님: {t.teacherName ?? t.teacherId} · {new Date(t.scheduledAt).toLocaleString("ko-KR")}
                </div>
                {t.exceptionApprovedBy && (
                  <div className="text-[11px] text-grey-500">예외 승인됨: {t.exceptionReason}</div>
                )}
              </div>
              <button className={btnSecondary} onClick={() => setOpenId(open ? null : t.id)}>
                {open ? "닫기" : "관리"}
              </button>
            </div>

            {open && (
              <TrialDetail
                trial={t}
                busy={busyId === t.id}
                onBusy={(b) => setBusyId(b ? t.id : null)}
                onError={setError}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function NewTrialForm({
  consultations,
  onDone,
  onError,
}: {
  consultations: ConsultationListItem[];
  onDone: () => void;
  onError: (e: string | null) => void;
}) {
  const [consultationId, setConsultationId] = useState("");
  const [childId, setChildId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [goal, setGoal] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [needsException, setNeedsException] = useState(false);
  const [exceptionReason, setExceptionReason] = useState("");

  async function submit() {
    if (!consultationId || !childId || !subjectId || !teacherId || !scheduledAt) {
      onError("상담/학생/과목/선생님/일시는 필수입니다.");
      return;
    }
    setSubmitting(true);
    onError(null);
    try {
      await createTrialSessionFromConsultation({
        consultationId,
        childId,
        subjectId,
        teacherId,
        scheduledAt: new Date(scheduledAt).toISOString(),
        goal: goal || undefined,
        exceptionApprovedBy: needsException ? "self" : undefined,
        exceptionReason: needsException ? exceptionReason : undefined,
      });
      onDone();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "체험 생성에 실패했습니다.";
      if (msg.includes("이미 진행 중이거나 완료된 체험")) {
        setNeedsException(true);
      }
      onError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={card}>
      <div className="text-[12px] font-bold text-ink mb-2">체험 계획(사전)</div>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <select
          value={consultationId}
          onChange={(e) => setConsultationId(e.target.value)}
          className="border-[1.5px] border-grey-200 rounded-lg px-2.5 py-1.5 text-[12.5px]"
        >
          <option value="">상담 선택</option>
          {consultations.map((c) => (
            <option key={c.id} value={c.id}>
              {c.contactName} ({c.contactEmail})
            </option>
          ))}
        </select>
        <input
          value={childId}
          onChange={(e) => setChildId(e.target.value)}
          placeholder="학생(child) ID"
          className="border-[1.5px] border-grey-200 rounded-lg px-2.5 py-1.5 text-[12.5px]"
        />
        <input
          value={subjectId}
          onChange={(e) => setSubjectId(e.target.value)}
          placeholder="과목 ID"
          className="border-[1.5px] border-grey-200 rounded-lg px-2.5 py-1.5 text-[12.5px]"
        />
        <input
          value={teacherId}
          onChange={(e) => setTeacherId(e.target.value)}
          placeholder="선생님 ID"
          className="border-[1.5px] border-grey-200 rounded-lg px-2.5 py-1.5 text-[12.5px]"
        />
        <input
          type="datetime-local"
          value={scheduledAt}
          onChange={(e) => setScheduledAt(e.target.value)}
          className="border-[1.5px] border-grey-200 rounded-lg px-2.5 py-1.5 text-[12.5px]"
        />
      </div>
      <textarea
        value={goal}
        onChange={(e) => setGoal(e.target.value)}
        placeholder="체험 목표(goal) — 체험 전 사전 계획"
        className="w-full border-[1.5px] border-grey-200 rounded-lg px-2.5 py-1.5 text-[12.5px] mb-2"
      />

      {needsException && (
        <div className="mb-2 p-2.5 bg-grey-100 rounded-lg">
          <p className="text-[11.5px] text-ink mb-1.5">
            이 학생은 이미 활성 체험이 있습니다. 관리자 예외 승인 사유를 입력하면 추가 체험을 생성할 수 있습니다.
          </p>
          <input
            value={exceptionReason}
            onChange={(e) => setExceptionReason(e.target.value)}
            placeholder="예외 승인 사유"
            className="w-full border-[1.5px] border-grey-200 rounded-lg px-2.5 py-1.5 text-[12px]"
          />
        </div>
      )}

      <button className={btnPrimary} disabled={submitting} onClick={submit}>
        {submitting ? "생성 중…" : "체험 생성"}
      </button>
    </div>
  );
}

function TrialDetail({
  trial,
  busy,
  onBusy,
  onError,
}: {
  trial: TrialSessionListItem;
  busy: boolean;
  onBusy: (b: boolean) => void;
  onError: (e: string | null) => void;
}) {
  const [resultNotes, setResultNotes] = useState(trial.resultNotes ?? "");
  const [recommendation, setRecommendation] = useState(trial.recommendation ?? "");
  const [exceptionReason, setExceptionReason] = useState("");
  const [reason, setReason] = useState("");

  async function run(fn: () => Promise<void>) {
    onBusy(true);
    onError(null);
    try {
      await fn();
    } catch (e) {
      onError(e instanceof Error ? e.message : "처리에 실패했습니다.");
    } finally {
      onBusy(false);
    }
  }

  return (
    <div className="mt-3 pt-3 border-t border-grey-200 space-y-3">
      <div>
        <div className="text-[12px] font-bold text-ink mb-1">체험 계획(사전)</div>
        <p className="text-[12px] text-grey-500">{trial.goal || "목표 미입력"}</p>
      </div>

      <div>
        <div className="text-[12px] font-bold text-ink mb-1">체험 결과(사후) — 체험 완료 후 입력</div>
        <textarea
          value={resultNotes}
          onChange={(e) => setResultNotes(e.target.value)}
          placeholder="결과 노트"
          className="w-full border-[1.5px] border-grey-200 rounded-lg px-2.5 py-1.5 text-[12px] mb-1.5"
        />
        <textarea
          value={recommendation}
          onChange={(e) => setRecommendation(e.target.value)}
          placeholder="추천 사항"
          className="w-full border-[1.5px] border-grey-200 rounded-lg px-2.5 py-1.5 text-[12px] mb-1.5"
        />
        <button
          disabled={busy}
          className={btnSecondary}
          onClick={() =>
            run(() =>
              completeTrialSession({
                trialSessionId: trial.id,
                resultNotes: resultNotes || undefined,
                recommendation: recommendation || undefined,
              })
            )
          }
        >
          체험 완료 처리
        </button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="사유(취소/노쇼)"
          className="border-[1.5px] border-grey-200 rounded-lg px-2 py-1.5 text-[12px] w-32"
        />
        <button
          disabled={busy}
          className={btnSecondary}
          onClick={() =>
            run(() =>
              cancelTrialSession({ trialSessionId: trial.id, cancelledBy: "student", reason })
            )
          }
        >
          학생 취소
        </button>
        <button
          disabled={busy}
          className={btnSecondary}
          onClick={() =>
            run(() =>
              cancelTrialSession({ trialSessionId: trial.id, cancelledBy: "teacher", reason })
            )
          }
        >
          선생님 취소
        </button>
        <button
          disabled={busy}
          className={btnSecondary}
          onClick={() =>
            run(() => markTrialNoShow({ trialSessionId: trial.id, party: "student", reason }))
          }
        >
          학생 노쇼
        </button>
        <button
          disabled={busy}
          className={btnSecondary}
          onClick={() =>
            run(() => markTrialNoShow({ trialSessionId: trial.id, party: "teacher", reason }))
          }
        >
          선생님 노쇼
        </button>
      </div>

      {!trial.exceptionApprovedBy && (
        <div className="flex items-center gap-2">
          <input
            value={exceptionReason}
            onChange={(e) => setExceptionReason(e.target.value)}
            placeholder="예외 승인 사유"
            className="border-[1.5px] border-grey-200 rounded-lg px-2 py-1.5 text-[12px] flex-1"
          />
          <button
            disabled={busy || !exceptionReason}
            className={btnSecondary}
            onClick={() =>
              run(() => approveTrialException({ trialSessionId: trial.id, reason: exceptionReason }))
            }
          >
            예외 승인
          </button>
        </div>
      )}
    </div>
  );
}

function ProposalSection({
  proposals,
  trials,
}: {
  proposals: ProposalListItem[];
  trials: TrialSessionListItem[];
}) {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const completedTrials = trials.filter((t) => t.status === "completed");

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button className={btnPrimary} onClick={() => setCreating((v) => !v)}>
          {creating ? "취소" : "제안서 생성"}
        </button>
      </div>
      {error && <p className={errText}>{error}</p>}
      {creating && (
        <NewProposalForm
          completedTrials={completedTrials}
          onDone={() => setCreating(false)}
          onError={setError}
        />
      )}

      {proposals.length === 0 && <p className="text-[13px] text-grey-500">등록된 제안서가 없습니다.</p>}

      {proposals.map((p) => (
        <div key={p.id} className={card} data-testid={`proposal-card-${p.id}`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[14px] font-bold text-ink">
                v{p.versionNumber}{" "}
                <span className="text-[11px] font-semibold text-grey-500">({p.status})</span>
                {p.supersedesProposalId && (
                  <span className="text-[11px] text-grey-500"> · v{p.versionNumber - 1}의 재작성</span>
                )}
              </div>
              <div className="text-[12px] text-grey-500">
                과목 {p.recommendedSubjects.length}개 · 회차 {p.recommendedSessionCount ?? "-"}
              </div>
            </div>
            <div className="flex gap-1.5">
              {p.status === "draft" && (
                <button
                  disabled={busyId === p.id}
                  className={btnSecondary}
                  onClick={async () => {
                    setBusyId(p.id);
                    setError(null);
                    try {
                      await sendProposal(p.id);
                    } catch (e) {
                      setError(e instanceof Error ? e.message : "발송 실패");
                    } finally {
                      setBusyId(null);
                    }
                  }}
                >
                  발송
                </button>
              )}
              {p.status === "sent" && (
                <>
                  <button
                    disabled={busyId === p.id}
                    className={btnSecondary}
                    onClick={async () => {
                      setBusyId(p.id);
                      setError(null);
                      try {
                        await respondToProposal(p.id, "accepted");
                      } catch (e) {
                        setError(e instanceof Error ? e.message : "처리 실패");
                      } finally {
                        setBusyId(null);
                      }
                    }}
                  >
                    수락 처리
                  </button>
                  <button
                    disabled={busyId === p.id}
                    className={btnSecondary}
                    onClick={async () => {
                      setBusyId(p.id);
                      setError(null);
                      try {
                        await respondToProposal(p.id, "rejected");
                      } catch (e) {
                        setError(e instanceof Error ? e.message : "처리 실패");
                      } finally {
                        setBusyId(null);
                      }
                    }}
                  >
                    거절 처리
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function NewProposalForm({
  completedTrials,
  onDone,
  onError,
}: {
  completedTrials: TrialSessionListItem[];
  onDone: () => void;
  onError: (e: string | null) => void;
}) {
  const [trialSessionId, setTrialSessionId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [sessionCount, setSessionCount] = useState("");
  const [priceMinor, setPriceMinor] = useState("");
  const [submitting, setSubmitting] = useState(false);

  return (
    <div className={card}>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <select
          value={trialSessionId}
          onChange={(e) => setTrialSessionId(e.target.value)}
          className="border-[1.5px] border-grey-200 rounded-lg px-2.5 py-1.5 text-[12.5px]"
        >
          <option value="">완료된 체험 선택</option>
          {completedTrials.map((t) => (
            <option key={t.id} value={t.id}>
              {t.childName ?? t.childId} · {t.subjectName ?? t.subjectId}
            </option>
          ))}
        </select>
        <input
          value={teacherId}
          onChange={(e) => setTeacherId(e.target.value)}
          placeholder="추천 선생님 ID"
          className="border-[1.5px] border-grey-200 rounded-lg px-2.5 py-1.5 text-[12.5px]"
        />
        <input
          value={subjectId}
          onChange={(e) => setSubjectId(e.target.value)}
          placeholder="추천 과목 ID"
          className="border-[1.5px] border-grey-200 rounded-lg px-2.5 py-1.5 text-[12.5px]"
        />
        <input
          value={sessionCount}
          onChange={(e) => setSessionCount(e.target.value)}
          placeholder="추천 회차 수"
          type="number"
          className="border-[1.5px] border-grey-200 rounded-lg px-2.5 py-1.5 text-[12.5px]"
        />
        <input
          value={priceMinor}
          onChange={(e) => setPriceMinor(e.target.value)}
          placeholder="가격(원 단위, 최소단위)"
          type="number"
          className="border-[1.5px] border-grey-200 rounded-lg px-2.5 py-1.5 text-[12.5px]"
        />
      </div>
      <button
        className={btnPrimary}
        disabled={submitting}
        onClick={async () => {
          const trial = completedTrials.find((t) => t.id === trialSessionId);
          if (!trial || !subjectId) {
            onError("체험과 과목은 필수입니다.");
            return;
          }
          setSubmitting(true);
          onError(null);
          try {
            await createProposal({
              consultationId: trial.consultationId,
              trialSessionId: trial.id,
              subjects: [
                {
                  subjectId,
                  recommendedSessionCount: sessionCount ? Number(sessionCount) : undefined,
                  priceMinor: priceMinor ? Number(priceMinor) : undefined,
                },
              ],
              recommendedTeacherId: teacherId || undefined,
              recommendedSessionCount: sessionCount ? Number(sessionCount) : undefined,
            });
            onDone();
          } catch (e) {
            onError(e instanceof Error ? e.message : "제안서 생성에 실패했습니다.");
          } finally {
            setSubmitting(false);
          }
        }}
      >
        {submitting ? "생성 중…" : "제안서 생성"}
      </button>
    </div>
  );
}

function ConsentGapSection({ gaps, completed }: { gaps: ConsentGapItem[]; completed: CompletedConsentItem[] }) {
  const [view, setView] = useState<"pending" | "done">("pending");

  return (
    <div>
      <div className="flex gap-1 mb-4 border-b border-grey-200">
        <button
          onClick={() => setView("pending")}
          className={
            "text-[12.5px] font-bold px-3 py-2 -mb-px border-b-2 " +
            (view === "pending" ? "border-ink text-ink" : "border-transparent text-grey-500")
          }
        >
          대기 ({gaps.length})
        </button>
        <button
          onClick={() => setView("done")}
          className={
            "text-[12.5px] font-bold px-3 py-2 -mb-px border-b-2 " +
            (view === "done" ? "border-ink text-ink" : "border-transparent text-grey-500")
          }
        >
          완료 ({completed.length})
        </button>
      </div>

      {view === "pending" ? (
        <>
          <p className="text-[13px] text-grey-500 mb-4">
            생년월일 미입력 또는 필수 보호자 동의가 없어 이용이 막혀 있는 학생 목록입니다.
          </p>
          {gaps.length === 0 ? (
            <p className="text-[13px] text-grey-500">막혀 있는 학생이 없습니다.</p>
          ) : (
            gaps.map((g) => (
              <div key={g.childId} className={card}>
                <div className="text-[14px] font-bold text-ink">{g.childName ?? g.childId}</div>
                <div className="text-[12px] text-grey-500">
                  {!g.hasDob && "생년월일 미입력"}
                  {!g.hasDob && !g.hasActiveConsent && " · "}
                  {!g.hasActiveConsent && "유효한 보호자 동의 없음"}
                </div>
              </div>
            ))
          )}
        </>
      ) : completed.length === 0 ? (
        <p className="text-[13px] text-grey-500">완료된 동의가 없습니다.</p>
      ) : (
        completed.map((c) => (
          <div key={c.childId} className={card}>
            <div className="text-[14px] font-bold text-ink">{c.childName ?? c.childId}</div>
            <div className="text-[12px] text-grey-500">동의 완료</div>
          </div>
        ))
      )}
    </div>
  );
}

function ErrorDashboardSection({
  driveIssues,
  staleEnvelopes,
  consentGaps,
  duplicateCandidates,
  contractActivationRetries,
}: {
  driveIssues: DriveArtifactIssue[];
  staleEnvelopes: StaleEnvelopeContract[];
  consentGaps: ConsentGapItem[];
  duplicateCandidates: ConsultationListItem[];
  contractActivationRetries: ContractActivationRetryItem[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [retrySummary, setRetrySummary] = useState<{ attempted: number; stillFailing: number } | null>(
    null
  );
  const [activationRetries, setActivationRetries] = useState(contractActivationRetries);

  return (
    <div>
      {error && <p className={errText}>{error}</p>}

      <div className="mb-6">
        <h2 className="text-[14px] font-bold text-ink mb-2">Drive 저장 실패 (재시도 가능)</h2>
        {driveIssues.length === 0 ? (
          <p className="text-[13px] text-grey-500">실패한 Drive 저장이 없습니다.</p>
        ) : (
          <>
            {driveIssues.map((d) => (
              <div key={d.id} className={card + " flex items-center justify-between"}>
                <span className="text-[12.5px] text-ink">
                  계약 {d.contractId} · {d.artifactType} · {d.syncStatus}
                </span>
              </div>
            ))}
            <button
              disabled={busy === "drive"}
              className={btnSecondary}
              onClick={async () => {
                setBusy("drive");
                setError(null);
                try {
                  setRetrySummary(await retryFailedDriveArtifacts());
                } catch (e) {
                  setError(e instanceof Error ? e.message : "재시도에 실패했습니다.");
                } finally {
                  setBusy(null);
                }
              }}
            >
              전체 재시도
            </button>
            {retrySummary && (
              <p className="text-[12px] text-grey-500 mt-1.5">
                재시도 {retrySummary.attempted}건 중 {retrySummary.stillFailing}건 여전히 실패
              </p>
            )}
          </>
        )}
      </div>

      <div className="mb-6">
        <h2 className="text-[14px] font-bold text-ink mb-2">DocuSign 상태 대조 필요 (재시도 가능)</h2>
        {staleEnvelopes.length === 0 ? (
          <p className="text-[13px] text-grey-500">상태 대조가 필요한 계약이 없습니다.</p>
        ) : (
          staleEnvelopes.map((s) => (
            <div key={s.contractVersionId} className={card + " flex items-center justify-between"}>
              <span className="text-[12.5px] text-ink">
                계약 {s.contractId} · envelope {s.docusignEnvelopeStatus ?? "미확인"}
              </span>
              <button
                disabled={busy === s.contractVersionId}
                className={btnSecondary}
                onClick={async () => {
                  setBusy(s.contractVersionId);
                  setError(null);
                  try {
                    await reconcileDocusignStatus(s.contractVersionId);
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "상태 대조에 실패했습니다.");
                  } finally {
                    setBusy(null);
                  }
                }}
              >
                상태 새로고침
              </button>
            </div>
          ))
        )}
      </div>

      <div className="mb-6">
        <h2 className="text-[14px] font-bold text-ink mb-2">계약 활성화 재처리 대기 (재시도 가능)</h2>
        {activationRetries.length === 0 ? (
          <p className="text-[13px] text-grey-500">활성화 재처리 대기 중인 계약이 없습니다.</p>
        ) : (
          activationRetries.map((r) => (
            <div key={r.id} className={card + " flex items-center justify-between"}>
              <span className="text-[12.5px] text-ink">
                {r.childName ?? r.childId ?? "학생 미확인"} · 계약 {r.contractId} ·{" "}
                {new Date(r.createdAt).toLocaleString("ko-KR")}
                <span className="text-[11px] text-grey-500 ml-2">{r.failureReason}</span>
              </span>
              <button
                disabled={busy === r.id}
                className={btnSecondary}
                onClick={async () => {
                  setBusy(r.id);
                  setError(null);
                  try {
                    const result = await retryContractActivation(r.id);
                    if (result.status === "activated" || result.status === "already_active") {
                      setActivationRetries((prev) => prev.filter((x) => x.id !== r.id));
                    } else if (result.status === "still_failing") {
                      setActivationRetries((prev) =>
                        prev.map((x) =>
                          x.id === r.id ? { ...x, failureReason: result.failureReason ?? x.failureReason } : x
                        )
                      );
                    }
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "활성화 재시도에 실패했습니다.");
                  } finally {
                    setBusy(null);
                  }
                }}
              >
                활성화 재시도
              </button>
            </div>
          ))
        )}
      </div>

      <div className="mb-6">
        <h2 className="text-[14px] font-bold text-ink mb-2">보호자 동의 차단 (재시도 불가 — 가족 조치 필요)</h2>
        {consentGaps.length === 0 ? (
          <p className="text-[13px] text-grey-500">동의로 막힌 학생이 없습니다.</p>
        ) : (
          consentGaps.map((g) => (
            <div key={g.childId} className={card}>
              <span className="text-[12.5px] text-ink">{g.childName ?? g.childId}</span>
              <span className="text-[11px] text-grey-500 ml-2">
                {!g.hasDob ? "생년월일 미입력" : "동의 없음"} — 관리자가 재시도할 수 없으며 가족의 조치가 필요합니다.
              </span>
            </div>
          ))
        )}
      </div>

      <div>
        <h2 className="text-[14px] font-bold text-ink mb-2">중복 상담 후보 (관리자 확인 필요)</h2>
        {duplicateCandidates.length === 0 ? (
          <p className="text-[13px] text-grey-500">확인이 필요한 중복 상담이 없습니다.</p>
        ) : (
          duplicateCandidates.map((c) => (
            <div key={c.id} className={card}>
              <span className="text-[12.5px] text-ink">{c.contactName} ({c.contactEmail})</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
