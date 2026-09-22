"use client";

// R11(문의·면담) — 관리자 "문의·면담" 화면. 상담(ConsultationTab/
// ConsultationSchedulingPanel)과는 완전히 별도 화면·별도 데이터(household_messages,
// meeting_requests, meeting_availability_rules/exceptions) — 최소 구현: 문의함
// (목록 + 답장 + 해결 처리)과 면담 운영(목록 + 상태 변경 + 가용시간 CRUD).

import { useState } from "react";
import {
  listInquiryThreadsForAdmin,
  sendAdminInquiryMessage,
  closeHouseholdInquiry,
  markHouseholdMessengerReadByAdmin,
  loadMeetingOperationsDashboardAction,
  updateMeetingRequestStatus,
  scheduleMeetingRequest,
  addMeetingAvailabilityRule,
  deactivateMeetingAvailabilityRule,
  addMeetingAvailabilityException,
  removeMeetingAvailabilityException,
  type AdminInquiryThread,
} from "./inquiry-and-meeting-actions";
import MeetingRequestReviewPanel from "./MeetingRequestReviewPanel";
import { useTabCachedData } from "./use-tab-cached-data";

// 2026-09-10(P1 재진입 성능 배치) — "문의·면담"은 상태 변화가 상대적으로
// 느린 화면으로 분류돼 TTL 30초를 쓴다. 문의함(기본 서브탭)은 admin/page.tsx가
// SSR로 내려주는 initialThreads로 최초 진입을 채우고, 면담 운영은 서브탭을
// 열 때만 조회하되(기존 지연 로딩 유지) 재진입 시에는 이 TTL 캐시로 직전
// 데이터를 즉시 보여준다.
const INQUIRY_TTL_MS = 30_000;

const WEEKDAY_LABEL = ["일", "월", "화", "수", "목", "금", "토"];
const MEETING_STATUS_LABEL: Record<string, string> = {
  requested: "신청됨",
  confirming: "확인 중",
  scheduling: "일정 조율 중",
  scheduled: "일정 확정",
  completed: "완료",
  cancelled: "취소",
};
const MEETING_STATUS_ORDER = ["requested", "confirming", "scheduling", "scheduled", "completed"] as const;
const CONTACT_PREFERENCE_LABEL: Record<string, string> = {
  phone: "전화",
  message: "메시지",
  either: "둘 다 가능",
};

type MeetingTransitionTarget = "confirming" | "scheduling" | "scheduled" | "completed";

function nextMeetingStatus(status: string): MeetingTransitionTarget | null {
  const idx = MEETING_STATUS_ORDER.indexOf(status as (typeof MEETING_STATUS_ORDER)[number]);
  if (idx === -1 || idx === MEETING_STATUS_ORDER.length - 1) return null;
  return MEETING_STATUS_ORDER[idx + 1] as MeetingTransitionTarget;
}

// datetime-local(<input type="datetime-local">) 문자열("YYYY-MM-DDTHH:mm")을
// KST 기준 ISO로 만든다. 서버 액션(scheduleMeetingRequest)이 그대로 Date로
// 파싱하므로, 타임존 미표기 문자열이 브라우저 로컬이 아니라 KST로 해석되게
// 여기서 오프셋을 명시한다.
function kstLocalToIso(value: string): string {
  return `${value}:00+09:00`;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "-";
  return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

type SubTab = "inbox" | "meetings";

function InquiryThreadSkeleton() {
  return (
    <div data-testid="inquiry-inbox-skeleton">
      {[0, 1, 2].map((i) => (
        <div key={i} className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-3 animate-pulse">
          <div className="flex items-center justify-between">
            <div className="h-3.5 w-32 bg-grey-200 rounded" />
            <div className="h-6 w-12 bg-grey-100 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}

function InquiryInbox({ initialThreads }: { initialThreads?: AdminInquiryThread[] }) {
  const {
    data: threads,
    error: fetchError,
    refresh,
    refreshing,
  } = useTabCachedData<AdminInquiryThread[]>({
    cacheKey: "inquiry-inbox",
    ttlMs: INQUIRY_TTL_MS,
    seedData: initialThreads,
    fetcher: listInquiryThreadsForAdmin,
  });
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [openInquiryId, setOpenInquiryId] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"open" | "closed">("open");
  const error = mutationError ?? fetchError;

  if (threads === null) return <InquiryThreadSkeleton />;

  // 2026-09-22(사용자 지시) — household 전체 스레드가 아니라 문의(inquiry) 단위 카드.
  // 관리자가 종료하면 그 문의는 "지난 문의"로 넘어가 읽기 전용 내역이 된다.
  const visible = threads.filter((t) => t.status === statusFilter);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex gap-1.5">
          {(["open", "closed"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              aria-pressed={statusFilter === s}
              className={"text-[12px] font-bold px-3 py-1.5 rounded-full " + (statusFilter === s ? "bg-ink text-white" : "bg-grey-100 text-grey-600")}
            >
              {s === "open" ? "진행 중 문의" : "지난 문의"}
            </button>
          ))}
        </div>
        <button
          onClick={refresh}
          disabled={refreshing}
          className="text-[12px] font-bold text-ink underline disabled:opacity-50"
        >
          {refreshing ? "새로고침 중..." : "새로고침"}
        </button>
      </div>
      {error && <p className="text-[12px] text-red mb-3">{error}</p>}
      {visible.length === 0 && (
        <p className="text-[13px] text-grey-500">{statusFilter === "open" ? "진행 중인 문의가 없습니다." : "지난 문의가 없습니다."}</p>
      )}
      {visible.map((t) => (
        <div key={t.inquiryId} className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[13.5px] font-bold text-ink">
              {t.householdLabel}
              {t.unreadForAdmin && <span className="ml-1.5 text-[11px] font-bold text-white bg-red rounded-full px-1.5 py-0.5">안읽음</span>}
            </span>
            <button
              className="text-[12px] font-bold text-ink border-[1.5px] border-grey-200 rounded-lg px-3 py-1.5"
              onClick={() => {
                const opening = openInquiryId !== t.inquiryId;
                setOpenInquiryId(opening ? t.inquiryId : null);
                if (opening) {
                  markHouseholdMessengerReadByAdmin(t.householdId)
                    .then(refresh)
                    .catch(() => {});
                }
              }}
            >
              {openInquiryId === t.inquiryId ? "닫기" : "열기"}
            </button>
          </div>
          {openInquiryId === t.inquiryId && (
            <div>
              <div className="space-y-2 mb-3 max-h-[300px] overflow-y-auto">
                {t.messages.map((m) => (
                  <div
                    key={m.id}
                    className={"rounded-lg px-3 py-2 text-[12.5px] max-w-[85%] " + (m.senderRole === "admin" ? "bg-ink text-white ml-auto" : "bg-grey-100 text-ink")}
                  >
                    <div>{m.body}</div>
                    <div className={"text-[10.5px] mt-1 " + (m.senderRole === "admin" ? "text-white/70" : "text-grey-500")}>
                      {m.senderRole === "admin" ? "관리자" : "보호자"} · {formatDateTime(m.createdAt)}
                    </div>
                  </div>
                ))}
              </div>
              {t.status === "open" ? (
                <>
                  <div className="flex gap-2 mb-2">
                    <textarea
                      aria-label="답장 내용"
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      placeholder="답장 내용을 입력해주세요"
                      className="flex-1 px-3 py-2 border-[1.5px] border-grey-200 rounded-lg text-[13px] min-h-[54px]"
                    />
                    <button
                      disabled={busy || !reply.trim()}
                      className="px-4 py-2 rounded-lg bg-ink text-white text-[13px] font-bold disabled:opacity-50 self-end"
                      onClick={async () => {
                        setBusy(true);
                        try {
                          await sendAdminInquiryMessage(t.inquiryId, t.householdId, reply);
                          setReply("");
                          refresh();
                        } catch (e) {
                          setMutationError(e instanceof Error ? e.message : "전송에 실패했습니다.");
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      답장
                    </button>
                  </div>
                  <button
                    disabled={busy}
                    className="text-[12px] font-bold text-ink underline"
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await closeHouseholdInquiry(t.inquiryId);
                        refresh();
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    문의 종료
                  </button>
                </>
              ) : (
                <p className="text-[12px] font-bold text-grey-500">종료된 문의입니다(읽기 전용).</p>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// R12.1: meeting_request_messages 스레드 UI(AdminMeetingRequestThread)는
// 제거했다 — 상담 신청 관련 대화는 이제 위 InquiryInbox(household_messages/
// 메신저)로만 처리한다.

function MeetingOperationsSkeleton() {
  return (
    <div data-testid="meeting-operations-skeleton">
      <h3 className="text-[13.5px] font-extrabold text-ink mb-2">면담 요청 목록</h3>
      {[0, 1].map((i) => (
        <div key={i} className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-3 animate-pulse">
          <div className="h-3.5 w-40 bg-grey-200 rounded mb-2" />
          <div className="h-3 w-56 bg-grey-100 rounded" />
        </div>
      ))}
    </div>
  );
}

function MeetingOperations() {
  // 2026-09-10(P1 재진입 성능 배치) — "면담 운영" 서브탭은 SSR 시딩 없이
  // (기본 서브탭이 아니므로) 처음 열 때만 조회하되, 이후 재진입은 TTL
  // 캐시(30초)로 직전 데이터를 즉시 보여주고 백그라운드로 갱신한다.
  const {
    data: dashboard,
    error: fetchError,
    refresh,
    refreshing,
  } = useTabCachedData({
    cacheKey: "inquiry-meetings",
    ttlMs: INQUIRY_TTL_MS,
    fetcher: loadMeetingOperationsDashboardAction,
  });
  const meetings = dashboard?.requests ?? null;
  const rules = dashboard?.rules ?? [];
  const exceptions = dashboard?.exceptions ?? [];
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [ruleFormOpen, setRuleFormOpen] = useState(false);
  const [ruleWeekday, setRuleWeekday] = useState(1);
  const [ruleStart, setRuleStart] = useState("09:00");
  const [ruleEnd, setRuleEnd] = useState("18:00");
  const [exceptionFormOpen, setExceptionFormOpen] = useState(false);
  const [exceptionDate, setExceptionDate] = useState("");
  // 2026-09-18 — window.prompt는 브라우저 자동화(원격 UAT 도구)에서 채울 수
  // 없고 UX도 나쁘다. 인라인 datetime-local 입력 2개로 교체한다.
  const [scheduleFormOpenId, setScheduleFormOpenId] = useState<string | null>(null);
  const [scheduleStarts, setScheduleStarts] = useState("");
  const [scheduleEnds, setScheduleEnds] = useState("");
  const error = mutationError ?? fetchError;

  async function withBusy(id: string, fn: () => Promise<void>) {
    setBusyId(id);
    try {
      await fn();
      refresh();
    } catch (e) {
      setMutationError(e instanceof Error ? e.message : "처리에 실패했습니다.");
    } finally {
      setBusyId(null);
    }
  }

  if (meetings === null) return <MeetingOperationsSkeleton />;

  return (
    <div>
      <div className="flex justify-end mb-2">
        <button
          onClick={refresh}
          disabled={refreshing}
          className="text-[12px] font-bold text-ink underline disabled:opacity-50"
        >
          {refreshing ? "새로고침 중..." : "새로고침"}
        </button>
      </div>
      {error && <p className="text-[12px] text-red mb-3">{error}</p>}

      <section className="mb-8">
        <h3 className="text-[13.5px] font-extrabold text-ink mb-2">면담 요청 목록</h3>
        {meetings.length === 0 && <p className="text-[13px] text-grey-500">면담 요청이 없습니다.</p>}
        {meetings.map((m) => (
          <div key={m.id} className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-3">
            <p className="text-[13.5px] font-bold text-ink">
              {m.householdLabel}{m.childName ? ` · ${m.childName}` : ""} — {MEETING_STATUS_LABEL[m.status] ?? m.status}
            </p>
            <p className="text-[12.5px] text-grey-500 mt-1">
              {m.subject && `주제: ${m.subject} · `}희망 시간: {formatDateTime(m.startsAt)}
            </p>
            {m.content && <p className="text-[12.5px] text-grey-700 mt-1">내용: {m.content}</p>}
            {m.contactPreference && (
              <p className="text-[12.5px] text-grey-500 mt-0.5">
                희망 연락: {CONTACT_PREFERENCE_LABEL[m.contactPreference] ?? m.contactPreference}
                {m.preferredContactTime ? ` · ${m.preferredContactTime}` : ""}
              </p>
            )}
            <div className="flex gap-2 mt-3">
              {(() => {
                const next = nextMeetingStatus(m.status);
                if (next === "scheduled") return null;
                return (
                  next && (
                    <button
                      disabled={busyId === m.id}
                      className="text-[12px] font-bold text-white bg-ink rounded-lg px-3 py-1.5 disabled:opacity-50"
                      onClick={() => withBusy(m.id, () => updateMeetingRequestStatus(m.id, next))}
                    >
                      {MEETING_STATUS_LABEL[next]}로 변경
                    </button>
                  )
                );
              })()}
              {nextMeetingStatus(m.status) === "scheduled" ? (
                // 2026-09-17/18 — "일정 확정"은 status만 바꾸는 게 아니라 유효한
                // 시간으로 실제 Calendar+Meet 이벤트를 만들어야 하므로, 여기서
                // 시간을 입력받아 scheduleMeetingRequest(가드된 서버 액션)를
                // 호출한다. 시간이 없거나 잘못되면 액션이 거부하고 상태는
                // 그대로 남는다(조용히 scheduled로 넘어가지 않음). window.prompt는
                // 자동화 도구로 채울 수 없고 UX도 나빠 인라인 폼으로 교체(2026-09-18).
                scheduleFormOpenId === m.id ? (
                  <div className="flex flex-col gap-1.5 border-[1.5px] border-grey-200 rounded-lg px-2.5 py-2">
                    <label className="text-[11px] font-semibold text-grey-500">
                      시작 시간(KST)
                      <input
                        type="datetime-local"
                        value={scheduleStarts}
                        onChange={(e) => setScheduleStarts(e.target.value)}
                        className="ml-1.5 border-[1.5px] border-grey-200 rounded px-1.5 py-0.5 text-[11.5px]"
                      />
                    </label>
                    <label className="text-[11px] font-semibold text-grey-500">
                      종료 시간(KST)
                      <input
                        type="datetime-local"
                        value={scheduleEnds}
                        onChange={(e) => setScheduleEnds(e.target.value)}
                        className="ml-1.5 border-[1.5px] border-grey-200 rounded px-1.5 py-0.5 text-[11.5px]"
                      />
                    </label>
                    <div className="flex gap-1.5">
                      <button
                        disabled={busyId === m.id || !scheduleStarts || !scheduleEnds}
                        className="text-[11.5px] font-bold text-white bg-ink rounded-lg px-2.5 py-1 disabled:opacity-50"
                        onClick={() =>
                          withBusy(m.id, async () => {
                            await scheduleMeetingRequest({
                              meetingRequestId: m.id,
                              startsAt: kstLocalToIso(scheduleStarts),
                              endsAt: kstLocalToIso(scheduleEnds),
                            });
                            setScheduleFormOpenId(null);
                          })
                        }
                      >
                        확정
                      </button>
                      <button
                        className="text-[11.5px] font-semibold text-grey-500"
                        onClick={() => setScheduleFormOpenId(null)}
                      >
                        취소
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    disabled={busyId === m.id}
                    className="text-[12px] font-bold text-white bg-ink rounded-lg px-3 py-1.5 disabled:opacity-50"
                    onClick={() => {
                      setScheduleStarts("");
                      setScheduleEnds("");
                      setScheduleFormOpenId(m.id);
                    }}
                  >
                    일정 확정(Calendar+Meet 생성)
                  </button>
                )
              ) : null}
              {m.status !== "completed" && m.status !== "cancelled" && (
                <button
                  disabled={busyId === m.id}
                  className="text-[12px] font-bold text-red border-[1.5px] border-grey-200 rounded-lg px-3 py-1.5 disabled:opacity-50"
                  onClick={() => withBusy(m.id, () => updateMeetingRequestStatus(m.id, "cancelled"))}
                >
                  취소
                </button>
              )}
            </div>
            {m.status === "completed" && <MeetingRequestReviewPanel meetingRequestId={m.id} />}
          </div>
        ))}
      </section>

      <section>
        <h3 className="text-[13.5px] font-extrabold text-ink mb-2">면담 가용시간(상담과 별도)</h3>
        <div className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-4">
          <p className="text-[12.5px] font-bold text-ink mb-2">반복 주간 가능시간</p>
          {rules.length === 0 ? (
            <p className="text-[12.5px] text-grey-500 mb-2">등록된 반복 가능시간이 없습니다.</p>
          ) : (
            rules.map((r) => (
              <p key={r.id} className="text-[12.5px] text-grey-700 mb-1">
                {WEEKDAY_LABEL[r.weekday]}요일 {r.start_time}~{r.end_time}
                {r.active && (
                  <button className="ml-2 underline text-red" onClick={() => withBusy(r.id, () => deactivateMeetingAvailabilityRule(r.id))}>
                    비활성화
                  </button>
                )}
              </p>
            ))
          )}
          {ruleFormOpen ? (
            <form
              className="mt-3 flex flex-wrap items-end gap-2 border-t border-grey-200 pt-3"
              onSubmit={async (e) => {
                e.preventDefault();
                await withBusy("__rule", () => addMeetingAvailabilityRule({ weekday: ruleWeekday, startTime: ruleStart, endTime: ruleEnd }));
                setRuleFormOpen(false);
              }}
            >
              <label className="text-[12px] text-ink">
                요일
                <select className="block mt-1 border-[1.5px] border-grey-200 rounded-lg px-2 py-1.5 text-[13px]" value={ruleWeekday} onChange={(e) => setRuleWeekday(Number(e.target.value))}>
                  {WEEKDAY_LABEL.map((label, idx) => (<option key={idx} value={idx}>{label}요일</option>))}
                </select>
              </label>
              <label className="text-[12px] text-ink">
                시작
                <input type="time" required className="block mt-1 border-[1.5px] border-grey-200 rounded-lg px-2 py-1.5 text-[13px]" value={ruleStart} onChange={(e) => setRuleStart(e.target.value)} />
              </label>
              <label className="text-[12px] text-ink">
                종료
                <input type="time" required className="block mt-1 border-[1.5px] border-grey-200 rounded-lg px-2 py-1.5 text-[13px]" value={ruleEnd} onChange={(e) => setRuleEnd(e.target.value)} />
              </label>
              <button type="submit" disabled={busyId === "__rule"} className="text-[12px] font-bold text-white bg-ink rounded-lg px-3 py-1.5 disabled:opacity-50">추가</button>
              <button type="button" className="text-[12px] text-grey-500" onClick={() => setRuleFormOpen(false)}>취소</button>
            </form>
          ) : (
            <button className="text-[12px] font-bold text-ink border-[1.5px] border-grey-200 rounded-lg px-3 py-1.5 mt-2" onClick={() => setRuleFormOpen(true)}>
              반복 가능시간 추가
            </button>
          )}
        </div>

        <div className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4">
          <p className="text-[12.5px] font-bold text-ink mb-2">날짜별 예외(휴무)</p>
          {exceptions.length === 0 ? (
            <p className="text-[12.5px] text-grey-500 mb-2">등록된 예외가 없습니다.</p>
          ) : (
            exceptions.map((ex) => (
              <p key={ex.id} className="text-[12.5px] text-grey-700 mb-1">
                {ex.exception_date} — {ex.is_closed ? "휴무" : `${ex.start_time}~${ex.end_time} 임시 오픈`}
                <button className="ml-2 underline text-red" onClick={() => withBusy(ex.id, () => removeMeetingAvailabilityException(ex.id))}>삭제</button>
              </p>
            ))
          )}
          {exceptionFormOpen ? (
            <form
              className="mt-3 flex flex-wrap items-end gap-2 border-t border-grey-200 pt-3"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!exceptionDate) return;
                await withBusy("__exception", () => addMeetingAvailabilityException({ date: exceptionDate, isClosed: true, reason: "관리자 등록 휴무" }));
                setExceptionFormOpen(false);
              }}
            >
              <label className="text-[12px] text-ink">
                휴무 날짜
                <input type="date" required className="block mt-1 border-[1.5px] border-grey-200 rounded-lg px-2 py-1.5 text-[13px]" value={exceptionDate} onChange={(e) => setExceptionDate(e.target.value)} />
              </label>
              <button type="submit" disabled={busyId === "__exception"} className="text-[12px] font-bold text-white bg-ink rounded-lg px-3 py-1.5 disabled:opacity-50">추가</button>
              <button type="button" className="text-[12px] text-grey-500" onClick={() => setExceptionFormOpen(false)}>취소</button>
            </form>
          ) : (
            <button className="text-[12px] font-bold text-ink border-[1.5px] border-grey-200 rounded-lg px-3 py-1.5 mt-2" onClick={() => { setExceptionDate(""); setExceptionFormOpen(true); }}>
              휴무일 추가
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

export default function InquiryAndMeetingTab({ initialThreads }: { initialThreads?: AdminInquiryThread[] }) {
  const [sub, setSub] = useState<SubTab>("inbox");
  return (
    <div className="p-6">
      <div className="flex gap-1 mb-5">
        {(["inbox", "meetings"] as SubTab[]).map((s) => (
          <button
            key={s}
            onClick={() => setSub(s)}
            className={"text-[12.5px] font-bold px-4 py-2 rounded-lg border-[1.5px] " + (sub === s ? "bg-ink text-white border-ink" : "border-grey-200 text-ink")}
          >
            {s === "inbox" ? "메신저" : "상담 신청"}
          </button>
        ))}
      </div>
      {sub === "inbox" ? <InquiryInbox initialThreads={initialThreads} /> : <MeetingOperations />}
    </div>
  );
}
