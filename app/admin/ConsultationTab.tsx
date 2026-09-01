"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  createConsultation,
  scheduleConsultation,
  rescheduleConsultation,
  completeConsultation,
  cancelConsultation,
  markConsultationNoShow,
  findDuplicateConsultationCandidates,
  createClassificationTag,
  listClassificationTags,
  tagConsultation,
  untagConsultation,
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
} from "./consultation-actions";
import type {
  ConsultationListItem,
  TrialSessionListItem,
  ProposalListItem,
  ConsentGapItem,
  AiNotesConsentEventItem,
  DriveArtifactIssue,
  StaleEnvelopeContract,
} from "./consultation-data";

type SubTab = "consult" | "trial" | "proposal" | "consent" | "ai_notes" | "errors";

const SUB_NAV: { id: SubTab; label: string }[] = [
  { id: "consult", label: "상담 관리" },
  { id: "trial", label: "체험 관리" },
  { id: "proposal", label: "제안서 관리" },
  { id: "consent", label: "보호자 동의 대기" },
  { id: "ai_notes", label: "AI 회의록 선택" },
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
  aiNotesEvents,
  driveIssues,
  staleEnvelopes,
}: {
  consultations: ConsultationListItem[];
  trials: TrialSessionListItem[];
  proposals: ProposalListItem[];
  consentGaps: ConsentGapItem[];
  aiNotesEvents: AiNotesConsentEventItem[];
  driveIssues: DriveArtifactIssue[];
  staleEnvelopes: StaleEnvelopeContract[];
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

      {sub === "consult" && <ConsultSection consultations={consultations} />}
      {sub === "trial" && <TrialSection trials={trials} consultations={consultations} />}
      {sub === "proposal" && <ProposalSection proposals={proposals} trials={trials} />}
      {sub === "consent" && <ConsentGapSection gaps={consentGaps} />}
      {sub === "ai_notes" && <AiNotesSection events={aiNotesEvents} />}
      {sub === "errors" && (
        <ErrorDashboardSection
          driveIssues={driveIssues}
          staleEnvelopes={staleEnvelopes}
          consentGaps={consentGaps}
          duplicateCandidates={consultations.filter((c) => c.duplicateOfConsultationId)}
        />
      )}
    </div>
  );
}

const STATUS_LABEL: Record<string, string> = {
  requested: "신청됨",
  scheduled: "예약됨",
  completed: "완료",
  trial_planned: "체험 예정",
  trial_completed: "체험 완료",
  proposed: "제안됨",
  contracted: "계약됨",
  cancelled: "취소",
  no_show: "노쇼",
};

function ConsultSection({ consultations }: { consultations: ConsultationListItem[] }) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [tags, setTags] = useState<Array<{ id: string; label: string }>>([]);
  const [newTagLabel, setNewTagLabel] = useState("");
  const [duplicates, setDuplicates] = useState<
    Record<string, Array<{ id: string; contact_name: string; contact_email: string; status: string }>>
  >({});

  const visible =
    statusFilter === "all" ? consultations : consultations.filter((c) => c.status === statusFilter);

  async function loadTags() {
    try {
      setTags(await listClassificationTags());
    } catch {
      // 태그 로딩 실패는 조용히 무시 — 상담 화면 자체는 계속 사용 가능해야 한다.
    }
  }

  async function checkDuplicates(c: ConsultationListItem) {
    try {
      const found = await findDuplicateConsultationCandidates({
        email: c.contactEmail,
        phone: c.contactPhone ?? undefined,
        excludeConsultationId: c.id,
      });
      setDuplicates((prev) => ({ ...prev, [c.id]: found }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "중복 후보 조회에 실패했습니다.");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border-[1.5px] border-grey-200 rounded-lg px-2.5 py-1.5 text-[12.5px]"
        >
          <option value="all">전체 상태</option>
          {Object.keys(STATUS_LABEL).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <button className={btnPrimary} onClick={() => setCreating((v) => !v)}>
          {creating ? "취소" : "상담 등록"}
        </button>
      </div>

      {error && <p className={errText}>{error}</p>}

      {creating && (
        <NewConsultationForm
          onDone={() => setCreating(false)}
          onError={setError}
        />
      )}

      {visible.length === 0 && <p className="text-[13px] text-grey-500">해당하는 상담이 없습니다.</p>}

      {visible.map((c) => {
        const open = openId === c.id;
        return (
          <div key={c.id} className={card} data-testid={`consultation-card-${c.id}`}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[14px] font-bold text-ink">
                  {c.contactName}{" "}
                  <span className="text-[11px] font-semibold text-grey-500">
                    ({STATUS_LABEL[c.status] ?? c.status})
                  </span>
                </div>
                <div className="text-[12px] text-grey-500">
                  {c.contactEmail} {c.contactPhone ? `· ${c.contactPhone}` : ""}
                </div>
                {c.tagLabels.length > 0 && (
                  <div className="mt-1 flex gap-1 flex-wrap">
                    {c.tagLabels.map((t) => (
                      <span
                        key={t}
                        className="text-[10.5px] font-semibold bg-grey-100 text-grey-500 rounded-full px-2 py-0.5"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
                {c.duplicateOfConsultationId && (
                  <div className="text-[11px] text-red mt-1">중복 상담으로 표시됨</div>
                )}
              </div>
              <button
                className={btnSecondary}
                onClick={() => {
                  setOpenId(open ? null : c.id);
                  if (!open) loadTags();
                }}
              >
                {open ? "닫기" : "관리"}
              </button>
            </div>

            {open && (
              <div className="mt-3 pt-3 border-t border-grey-200 space-y-3">
                <ScheduleControls
                  consultationId={c.id}
                  currentStatus={c.status}
                  scheduledAt={c.scheduledAt}
                  busy={busyId === c.id}
                  onBusy={(b) => setBusyId(b ? c.id : null)}
                  onError={setError}
                />

                <div>
                  <button
                    className={btnSecondary}
                    onClick={() => checkDuplicates(c)}
                  >
                    중복 상담 후보 조회
                  </button>
                  {duplicates[c.id] && (
                    <div className="mt-2">
                      {duplicates[c.id].length === 0 ? (
                        <p className="text-[12px] text-grey-500">중복 후보가 없습니다.</p>
                      ) : (
                        duplicates[c.id].map((d) => (
                          <div
                            key={d.id}
                            className="text-[12px] text-ink flex items-center justify-between py-1"
                          >
                            <span>
                              {d.contact_name} · {d.contact_email} ({STATUS_LABEL[d.status] ?? d.status})
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <div className="text-[12px] font-semibold text-grey-500 mb-1.5">분류 태그</div>
                  <div className="flex gap-1.5 flex-wrap mb-2">
                    {tags.map((t) => {
                      const applied = c.tagLabels.includes(t.label);
                      return (
                        <button
                          key={t.id}
                          className={
                            "text-[11px] font-semibold rounded-full px-2.5 py-1 border-[1.5px] " +
                            (applied ? "bg-ink text-white border-ink" : "text-grey-500 border-grey-200")
                          }
                          onClick={async () => {
                            try {
                              if (applied) {
                                await untagConsultation({ consultationId: c.id, tagId: t.id });
                              } else {
                                await tagConsultation({ consultationId: c.id, tagId: t.id });
                              }
                              router.refresh();
                            } catch (e) {
                              setError(e instanceof Error ? e.message : "태그 변경에 실패했습니다.");
                            }
                          }}
                        >
                          {t.label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex gap-1.5">
                    <input
                      value={newTagLabel}
                      onChange={(e) => setNewTagLabel(e.target.value)}
                      placeholder="새 태그 이름"
                      className="border-[1.5px] border-grey-200 rounded-lg px-2.5 py-1.5 text-[12px] flex-1"
                    />
                    <button
                      className={btnSecondary}
                      onClick={async () => {
                        if (!newTagLabel.trim()) return;
                        try {
                          await createClassificationTag({ label: newTagLabel.trim() });
                          setNewTagLabel("");
                          await loadTags();
                        } catch (e) {
                          setError(e instanceof Error ? e.message : "태그 생성에 실패했습니다.");
                        }
                      }}
                    >
                      새 태그 만들기
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function NewConsultationForm({
  onDone,
  onError,
}: {
  onDone: () => void;
  onError: (e: string | null) => void;
}) {
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [studentGrade, setStudentGrade] = useState("");
  const [concerns, setConcerns] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  return (
    <div className={card}>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <input
          value={contactName}
          onChange={(e) => setContactName(e.target.value)}
          placeholder="보호자/학생 이름"
          className="border-[1.5px] border-grey-200 rounded-lg px-2.5 py-1.5 text-[12.5px]"
        />
        <input
          value={contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
          placeholder="이메일"
          className="border-[1.5px] border-grey-200 rounded-lg px-2.5 py-1.5 text-[12.5px]"
        />
        <input
          value={contactPhone}
          onChange={(e) => setContactPhone(e.target.value)}
          placeholder="전화번호"
          className="border-[1.5px] border-grey-200 rounded-lg px-2.5 py-1.5 text-[12.5px]"
        />
        <input
          value={studentGrade}
          onChange={(e) => setStudentGrade(e.target.value)}
          placeholder="학년"
          className="border-[1.5px] border-grey-200 rounded-lg px-2.5 py-1.5 text-[12.5px]"
        />
      </div>
      <textarea
        value={concerns}
        onChange={(e) => setConcerns(e.target.value)}
        placeholder="상담 내용/고민"
        className="w-full border-[1.5px] border-grey-200 rounded-lg px-2.5 py-1.5 text-[12.5px] mb-2"
      />
      <button
        className={btnPrimary}
        disabled={submitting}
        onClick={async () => {
          if (!contactName || !contactEmail) {
            onError("이름과 이메일은 필수입니다.");
            return;
          }
          setSubmitting(true);
          onError(null);
          try {
            await createConsultation({
              contactName,
              contactEmail,
              contactPhone: contactPhone || undefined,
              studentGrade: studentGrade || undefined,
              concerns: concerns || undefined,
            });
            router.refresh();
            onDone();
          } catch (e) {
            onError(e instanceof Error ? e.message : "상담 등록에 실패했습니다.");
          } finally {
            setSubmitting(false);
          }
        }}
      >
        {submitting ? "등록 중…" : "등록"}
      </button>
    </div>
  );
}

function ScheduleControls({
  consultationId,
  currentStatus,
  scheduledAt,
  busy,
  onBusy,
  onError,
}: {
  consultationId: string;
  currentStatus: string;
  scheduledAt: string | null;
  busy: boolean;
  onBusy: (b: boolean) => void;
  onError: (e: string | null) => void;
}) {
  const [dt, setDt] = useState(scheduledAt ? scheduledAt.slice(0, 16) : "");
  const [reason, setReason] = useState("");

  const router = useRouter();

  async function run(fn: () => Promise<void>) {
    onBusy(true);
    onError(null);
    try {
      await fn();
      router.refresh();
    } catch (e) {
      onError(e instanceof Error ? e.message : "처리에 실패했습니다.");
    } finally {
      onBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <input
        type="datetime-local"
        value={dt}
        onChange={(e) => setDt(e.target.value)}
        className="border-[1.5px] border-grey-200 rounded-lg px-2 py-1.5 text-[12px]"
      />
      <button
        disabled={busy || !dt}
        className={btnSecondary}
        onClick={() =>
          run(async () => {
            const iso = new Date(dt).toISOString();
            if (currentStatus === "scheduled") {
              await rescheduleConsultation(consultationId, iso);
            } else {
              await scheduleConsultation(consultationId, iso);
            }
          })
        }
      >
        {currentStatus === "scheduled" ? "재예약" : "예약"}
      </button>
      {currentStatus === "scheduled" && (
        <button
          disabled={busy}
          className={btnSecondary}
          onClick={() => run(() => completeConsultation(consultationId))}
        >
          완료 처리
        </button>
      )}
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="사유(취소/노쇼)"
        className="border-[1.5px] border-grey-200 rounded-lg px-2 py-1.5 text-[12px] w-32"
      />
      <button
        disabled={busy}
        className={btnSecondary}
        onClick={() => run(() => cancelConsultation(consultationId, reason || undefined))}
      >
        취소
      </button>
      <button
        disabled={busy}
        className={btnSecondary}
        onClick={() => run(() => markConsultationNoShow(consultationId, reason || undefined))}
      >
        노쇼
      </button>
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

function ConsentGapSection({ gaps }: { gaps: ConsentGapItem[] }) {
  return (
    <div>
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
    </div>
  );
}

function AiNotesSection({ events }: { events: AiNotesConsentEventItem[] }) {
  return (
    <div>
      <p className="text-[13px] text-grey-500 mb-4">
        학생별 AI 회의록(Smart Notes) 사용 선택 이력입니다. 실제 켜기/끄기 적용 로직은 이후 단계 범위입니다.
      </p>
      {events.length === 0 ? (
        <p className="text-[13px] text-grey-500">기록된 선택이 없습니다.</p>
      ) : (
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left text-grey-500 border-b border-grey-200">
              <th className="py-2">학생</th>
              <th className="py-2">선택</th>
              <th className="py-2">정책 버전</th>
              <th className="py-2">적용 시각</th>
              <th className="py-2">철회 시각</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id} className="border-b border-grey-100">
                <td className="py-2">{e.studentName ?? e.studentId}</td>
                <td className="py-2">{e.optedIn ? "동의" : "거부"}</td>
                <td className="py-2">{e.policyVersion}</td>
                <td className="py-2">{new Date(e.effectiveAt).toLocaleString("ko-KR")}</td>
                <td className="py-2">{e.revokedAt ? new Date(e.revokedAt).toLocaleString("ko-KR") : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function ErrorDashboardSection({
  driveIssues,
  staleEnvelopes,
  consentGaps,
  duplicateCandidates,
}: {
  driveIssues: DriveArtifactIssue[];
  staleEnvelopes: StaleEnvelopeContract[];
  consentGaps: ConsentGapItem[];
  duplicateCandidates: ConsultationListItem[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [retrySummary, setRetrySummary] = useState<{ attempted: number; stillFailing: number } | null>(
    null
  );

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
