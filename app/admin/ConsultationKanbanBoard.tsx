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
  sendRegularContractOneClickAction,
  confirmTrialIntentAction,
  planTrialSubjectAndAssignTeacherAction,
} from "./trial-onboarding-actions";
import {
  createNewContractVersionForResend,
  findDuplicateConsultationCandidates,
  type DuplicateConsultationCandidate,
} from "./consultation-actions";
import LessonReviewAdminEditor from "./LessonReviewAdminEditor";
import TrialOnboardingStudentsForm from "./TrialOnboardingStudentsForm";
import TrialOnboardingLinkProgress from "./TrialOnboardingLinkProgress";
import type { AdminSubject } from "./subject-data";
import type { MatchingTeacherCandidate } from "./matching-data";

const btnPrimary = "text-[12px] font-bold text-white bg-ink rounded-lg px-3 py-1.5 disabled:opacity-50";
const btnSecondary = "text-[12px] font-bold text-ink border-[1.5px] border-grey-200 rounded-lg px-3 py-1.5 disabled:opacity-50";
const errText = "text-[12px] text-red mb-2";

/**
 * 2026-09-06 — 상담 카드/상세에 상담 시각이 전혀 노출되지 않던 문제 수정.
 * consultations.starts_at(신청 시 희망 시각)/scheduled_at(수락 후 확정 시각)은
 * 이미 조회돼 있었지만 화면에 렌더링되지 않고 있었다. 타임존은 명시하지 않아
 * ConsultForm과 동일하게 브라우저 로컬 시간대로 자동 표시된다.
 */
function formatConsultTime(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" });
}

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

  // 2026-09-10(P1-1) — 데이터 도착 전에도 5개 컬럼 골격 + 카드 모양
  // 스켈레톤을 즉시 그린다("불러오는 중..." 텍스트 한 줄만 보이던 것 수정).
  // 실제 개수·내용은 listKanbanBoardAction() 응답이 오면 그대로 대체된다.
  if (!cards) {
    return (
      <div className="grid grid-cols-5 gap-3" data-testid="consultation-kanban-board-skeleton">
        {KANBAN_STAGE_ORDER.map((stage) => (
          <div key={stage} className="min-w-0">
            <div className="text-[12.5px] font-bold text-ink mb-2 flex items-center justify-between">
              <span>{KANBAN_STAGE_LABEL[stage]}</span>
              <span className="text-[11px] font-semibold text-grey-300">-</span>
            </div>
            <div className="space-y-2">
              {[0, 1].map((i) => (
                <div
                  key={i}
                  className="border-[1.5px] border-grey-100 rounded-xl px-3 py-2.5 h-[52px] bg-grey-100 animate-pulse"
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

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
                    className={`w-full text-left border-[1.5px] rounded-xl px-3 py-2.5 hover:border-ink ${
                      c.is_family_root_with_children ? "border-grey-100 opacity-55" : "border-grey-200"
                    }`}
                  >
                    <div className="text-[13px] font-bold text-ink truncate flex items-center gap-1">
                      {c.is_family_root_with_children && (
                        <span
                          title="학생별 카드가 이미 생성된 원 상담(가족) 카드 — 더 이상 진행되지 않는 이력입니다. 정책상 삭제하지 않고 계속 보관합니다."
                          className="text-[10px] font-semibold text-grey-500 bg-grey-100 rounded px-1 py-0.5 shrink-0"
                        >
                          완료(이력)
                        </span>
                      )}
                      {c.is_child_onboarding_card && (
                        <span
                          title="다자녀 온보딩으로 생성된 학생별 카드 — 원 상담(가족)은 지난 이력에서 확인"
                          className="text-[10px] font-semibold text-grey-500 bg-grey-100 rounded px-1 py-0.5 shrink-0"
                        >
                          👨‍👩‍👧 형제자매
                        </span>
                      )}
                      {c.source === "guardian_portal" && (
                        <span
                          title="이미 가입한 보호자가 포털의 '새 자녀 상담 신청' 화면에서 직접 신청한 건"
                          className="text-[10px] font-semibold text-white bg-ink rounded px-1 py-0.5 shrink-0"
                        >
                          보호자 포털
                        </span>
                      )}
                      <span className="truncate">{c.contact_name}</span>
                    </div>
                    <div className="text-[11px] text-grey-500 truncate">{c.contact_email}</div>
                    {(c.scheduled_at ?? c.starts_at) && (
                      <div className="text-[10.5px] text-grey-500">
                        🗓 {formatConsultTime(c.scheduled_at ?? c.starts_at)}
                      </div>
                    )}
                    {c.student_grade && <div className="text-[10.5px] text-grey-400">{c.student_grade}</div>}
                    {c.requested_children && c.requested_children.length > 0 && (
                      <div className="text-[10.5px] text-grey-400 truncate">
                        자녀 {c.requested_children.length}명: {c.requested_children.map((ch) => ch.name).join(", ")}
                      </div>
                    )}
                    {c.admin_review_summary && (
                      <div className="text-[10.5px] text-grey-500 mt-1 line-clamp-2">📝 {c.admin_review_summary}</div>
                    )}
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
          onNavigateToCard={(id) => setOpenId(id)}
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
  onNavigateToCard,
}: {
  consultationId: string;
  subjects: AdminSubject[];
  teacherCandidatesBySubject: Record<string, MatchingTeacherCandidate[]>;
  onClose: () => void;
  onChanged: () => void;
  onNavigateToCard: (consultationId: string) => void;
}) {
  const [detail, setDetail] = useState<ConsultationCardDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [closing, setClosing] = useState(false);
  const [duplicateCandidates, setDuplicateCandidates] = useState<DuplicateConsultationCandidate[]>([]);

  async function load() {
    try {
      const d = await getConsultationCardDetailAction(consultationId);
      setDetail(d);
      // 2026-09-06 — 재상담 후보(같은 이메일로 과거에 상담한 이력) 조회.
      // 자동 병합하지 않고 후보 배지 + 참고용 요약만 노출한다(공개 화면에는
      // 노출하지 않음, 관리자 상세 패널 전용).
      findDuplicateConsultationCandidates({
        email: d.consultation.contact_email,
        excludeConsultationId: consultationId,
      })
        .then(setDuplicateCandidates)
        .catch(() => setDuplicateCandidates([]));
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
          {(c.scheduled_at ?? c.starts_at) && (
            <>
              <br />
              🗓 {c.scheduled_at ? "확정 시각" : "희망 시각"}: {formatConsultTime(c.scheduled_at ?? c.starts_at)}
            </>
          )}
        </div>
        {c.admin_review_summary && (
          <div className="text-[12px] text-ink bg-grey-100 rounded-lg px-3 py-2 mb-3">
            📝 <span className="font-bold">상담 리뷰:</span> {c.admin_review_summary}
          </div>
        )}
        {/* 2026-09-06 — 재상담 후보: 같은 이메일로 과거 상담 이력이 있으면 참고용으로만
            노출한다(자동 병합 없음, 공개 화면에는 노출 안 함). */}
        {duplicateCandidates.length > 0 && (
          <div className="text-[12px] text-ink bg-red/5 rounded-lg px-3 py-2 mb-3">
            <div className="font-bold text-red mb-1">🔁 재상담 후보 — 같은 이메일로 과거 상담 이력이 있습니다</div>
            {duplicateCandidates.map((d) => (
              <div key={d.id} className="text-[11.5px] text-grey-500">
                {formatConsultTime(d.scheduled_at ?? d.created_at)} · 상태: {d.status}
                {d.outcome ? ` · 결과: ${d.outcome}` : ""}
                {d.admin_review_summary ? ` · "${d.admin_review_summary}"` : ""}
              </div>
            ))}
          </div>
        )}
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

        {/* 2026-09-07(제품 오너 실사용 중 발견 → 정정) — 상담 결과 기록은 보호자
            동의 확인(consent_confirmed_at)이 선행조건이다. 지금까지 그 동의 확인
            링크는 Calendar 초대 description에만 실려 있어, 보호자가 초대를
            놓치면 관리자가 결과를 기록할 방법이 없었다. 관리자 수동 재발송
            버튼 형태는 폐기하고, 상담이 최초로 확정될 때(lib/consultation/
            calendar-sync.ts) 동의 요청 메일이 Calendar 초대와 별개 채널로
            무조건 나가도록 정책을 바꿨다 — 이 화면에는 더 이상 별도 UI가
            없다. 동의 미확인 카드는 상태 뱃지로만 안내한다. */}
        {!c.consent_confirmed_at && (c.status === "scheduled" || c.status === "completed") && (
          <div className="mb-3 text-[11.5px] font-bold text-grey-500 border border-grey-200 rounded-lg p-3">
            보호자 동의 확인 대기 중 — 상담 결과 기록 전에 필요합니다 (동의 요청 메일은 상담 확정 시 자동 발송됨)
          </div>
        )}

        {/* 2. 상담 일정 확정 단계 — 결과 기록 */}
        {(c.status === "scheduled" || (c.status === "completed" && (!c.outcome || c.outcome === "on_hold"))) && (
          <OutcomeForm consultationId={c.id} onDone={() => run(async () => {})} />
        )}

        {/* 3. 체험 신청 단계 — 체험 동의/온보딩 안내, 체험수업권 재처리.
            2026-09-06: 결과 기록 직후 이 다음 단계를 놓치기 쉽다는 지적(UAT)에 따라
            강조 박스 + 주요 버튼 스타일로 눈에 띄게 바꿨다(로직은 그대로). */}
        {/* 2026-09-06(정규 진행 권장 경로 완결) — outcome이 regular_recommended면
            체험을 거치지 않으므로 "체험 진행 확정" 단계는 건너뛰고 바로 학생
            계정 생성 온보딩 폼을 보여준다. 학생 계정 생성 자체(Auth 계정 생성,
            household 연결, 학생별 카드 생성)는 체험/정규 여부와 무관한 범용
            절차라 TrialOnboardingStudentsForm/발송 액션을 그대로 재사용한다
            (이름에 "trial"이 있어도 실질은 온보딩 범용 로직 — 리네임은 범위 밖). */}
        {(c.outcome === "trial_recommended" || c.outcome === "regular_recommended") && (
          <div className="mb-3 space-y-2 border-[1.5px] border-ink rounded-lg px-3 py-2.5 bg-grey-100/50">
            <div className="text-[11.5px] font-bold text-ink">
              다음 단계 — {c.outcome === "regular_recommended" ? "정규 등록" : "체험"} 온보딩
              {c.outcome === "trial_recommended" && !c.trial_intent_confirmed_at ? "(아직 진행 안 됨)" : ""}
            </div>
            {c.outcome === "trial_recommended" && !c.trial_intent_confirmed_at && (
              <button
                className={btnPrimary}
                disabled={busy}
                onClick={() => run(() => confirmTrialIntentAction(c.id))}
              >
                체험 진행 확정(보호자 확인)
              </button>
            )}
            {/* 2026-09-06(제품 오너 지적) — 이 가족 카드가 이미 학생별 자녀
                카드로 분기됐으면(childCards.length > 0) 빈 온보딩 발송 폼을
                다시 보여주지 않는다. 대신 이미 진행 중/완료된 자녀 카드
                안내 + 각 카드로 바로 이동하는 링크만 보여준다. */}
            {(detail.childCards ?? []).length > 0 ? (
              <div className="text-[12px] text-ink bg-white rounded-lg px-3 py-2 space-y-1">
                <div className="font-bold">자녀 {detail.childCards.length}명 온보딩 진행 중/완료됨</div>
                {detail.childCards.map((cc) => (
                  <button
                    key={cc.consultationId}
                    type="button"
                    className="block text-[11.5px] text-ink underline"
                    onClick={() => onNavigateToCard(cc.consultationId)}
                  >
                    → {cc.childName ?? "이름 미확인"} 카드로 이동
                  </button>
                ))}
              </div>
            ) : (
              (c.outcome === "regular_recommended" || c.trial_intent_confirmed_at) &&
              detail.pipeline &&
              !detail.pipeline.steps.find((s) => s.key === "account_linked")?.done && (
                <TrialOnboardingStudentsForm
                  consultationId={c.id}
                  defaultGuardianEmail={detail.guardianEmail ?? c.contact_email ?? ""}
                  defaultGuardianName={detail.guardianName ?? c.contact_name ?? ""}
                  defaultStudentGrade={c.student_grade ?? ""}
                  submitLabel={c.outcome === "regular_recommended" ? "정규 등록 온보딩 안내 발송" : "체험 온보딩 안내 발송"}
                  noticeDeliveryStatus={detail.noticeDeliveryStatus}
                  noticeSendError={detail.noticeSendError}
                  onResult={(result) => {
                    if (result.status !== "failed") run(async () => {});
                  }}
                />
              )
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
            {/* 2026-09-06 — 안내를 보낸 뒤 보호자가 아직 확인하지 않은 상태(또는
                확인해 계정을 만든 뒤)의 진행 상태를 조회할 방법이 없었다는 지적을
                고친다. 링크가 한 번이라도 발급됐으면(발송 대기·발송됨·사용완료 모두) 노출. */}
            {detail.latestOnboardingLinkId && <TrialOnboardingLinkProgress linkId={detail.latestOnboardingLinkId} />}
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
                <div className="space-y-1.5">
                  {/* 2026-09-06(정책 변경) — 보호자가 "정규 진행 희망"을 확인하면
                      이제 관리자가 버튼을 누르지 않아도 자동으로 발송된다(승인자가
                      "CEO, Do Kyung Kim"으로 고정된 이후). 이미 envelope가 있으면
                      수동 클릭 없이도 도달할 수 있는 상태라, 자동 발송이었는지
                      수동이었는지 이 화면만으로는 구분하지 않지만 "이미 발송됨"
                      임은 분명히 보여준다 — 재발송(새 버전)은 여전히 필요할 때만
                      쓰는 별도 액션이다. */}
                  <div className="text-[12px] text-grey-500">이미 발송된 계약입니다(자동 발송 포함).</div>
                  <button
                    className={btnSecondary}
                    disabled={busy}
                    onClick={() => run(async () => {
                      await createNewContractVersionForResend({ contractId: detail.contractId! });
                    })}
                  >
                    재발송(새 버전)
                  </button>
                </div>
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
            const result = await recordConsultationOutcome({ consultationId, outcome, notes: "", adminReviewSummary: summary });
            if (!result.ok) {
              setError(result.error);
            } else {
              onDone();
            }
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
  const [approverTitle, setApproverTitle] = useState("CEO, Do Kyung Kim");

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
            // (2026-09-06 버그 수정) sendRegularContractOneClickAction은 DocuSign
            // 발송 실패를 throw가 아니라 { status: "failed", error } 값으로
            // 반환한다(계약을 draft로 유지하기 위한 의도적 설계 — 위 함수 주석
            // 참고). 이 반환값을 그냥 버리면 재시도 버튼을 눌러도 관리자에게
            // 아무 피드백이 없어 "고장난 것처럼" 보인다 — 실제로는 아래에서
            // 반환값을 확인해 실패 사유를 화면에 노출한다.
            const result = await sendRegularContractOneClickAction({
              childId,
              subjectEnrollmentId,
              guardianEmail,
              guardianName,
              childName,
              approverTitle: approverTitle.trim(),
            });
            if (result.status === "failed") {
              const isPreviewGate = result.error.includes("DOCUSIGN_SANDBOX_ALLOW_REAL_CALLS");
              throw new Error(
                isPreviewGate
                  ? "Preview 환경에서는 실제 DocuSign 발송이 비활성화되어 있습니다(정상 동작). 계약은 draft 상태로 남으며, 실제 발송은 Production 환경에서만 이루어집니다."
                  : `발송 실패: ${result.error}`
              );
            }
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
