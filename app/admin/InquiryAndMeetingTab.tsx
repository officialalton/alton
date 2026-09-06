"use client";

// R11(문의·면담) — 관리자 "문의·면담" 화면. 상담(ConsultationTab/
// ConsultationSchedulingPanel)과는 완전히 별도 화면·별도 데이터(household_messages,
// meeting_requests, meeting_availability_rules/exceptions) — 최소 구현: 문의함
// (목록 + 답장 + 해결 처리)과 면담 운영(목록 + 상태 변경 + 가용시간 CRUD).

import { useEffect, useState } from "react";
import {
  listInquiryThreadsForAdmin,
  sendAdminHouseholdMessage,
  resolveHouseholdInquiryThread,
  listMeetingRequestsForAdmin,
  updateMeetingRequestStatus,
  listMeetingAvailabilityRules,
  addMeetingAvailabilityRule,
  deactivateMeetingAvailabilityRule,
  listMeetingAvailabilityExceptions,
  addMeetingAvailabilityException,
  removeMeetingAvailabilityException,
  type AdminInquiryThread,
  type AdminMeetingRequest,
  type MeetingAvailabilityRule,
  type MeetingAvailabilityException,
} from "./inquiry-and-meeting-actions";

const WEEKDAY_LABEL = ["일", "월", "화", "수", "목", "금", "토"];
const MEETING_STATUS_LABEL: Record<string, string> = {
  requested: "일정 조율 대기",
  scheduled: "면담 확정",
  completed: "완료",
  cancelled: "취소",
};

function formatDateTime(iso: string | null): string {
  if (!iso) return "-";
  return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

type SubTab = "inbox" | "meetings";

function InquiryInbox() {
  const [threads, setThreads] = useState<AdminInquiryThread[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openHouseholdId, setOpenHouseholdId] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);

  function load() {
    listInquiryThreadsForAdmin().then(setThreads).catch((e) => setError(e instanceof Error ? e.message : "불러오기에 실패했습니다."));
  }
  useEffect(() => { load(); }, []);

  return (
    <div>
      {error && <p className="text-[12px] text-red mb-3">{error}</p>}
      {threads === null && <p className="text-[13px] text-grey-500">불러오는 중...</p>}
      {threads && threads.length === 0 && <p className="text-[13px] text-grey-500">문의 내역이 없습니다.</p>}
      {threads?.map((t) => (
        <div key={t.householdId} className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[13.5px] font-bold text-ink">
              {t.householdLabel} {t.hasOpen && <span className="text-red">● 미해결</span>}
            </span>
            <button
              className="text-[12px] font-bold text-ink border-[1.5px] border-grey-200 rounded-lg px-3 py-1.5"
              onClick={() => setOpenHouseholdId(openHouseholdId === t.householdId ? null : t.householdId)}
            >
              {openHouseholdId === t.householdId ? "닫기" : "열기"}
            </button>
          </div>
          {openHouseholdId === t.householdId && (
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
                      await sendAdminHouseholdMessage(t.householdId, reply);
                      setReply("");
                      load();
                    } catch (e) {
                      setError(e instanceof Error ? e.message : "전송에 실패했습니다.");
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  답장
                </button>
              </div>
              {t.hasOpen && (
                <button
                  disabled={busy}
                  className="text-[12px] font-bold text-ink underline"
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await resolveHouseholdInquiryThread(t.householdId);
                      load();
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  해결됨으로 표시
                </button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function MeetingOperations() {
  const [meetings, setMeetings] = useState<AdminMeetingRequest[] | null>(null);
  const [rules, setRules] = useState<MeetingAvailabilityRule[]>([]);
  const [exceptions, setExceptions] = useState<MeetingAvailabilityException[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [ruleFormOpen, setRuleFormOpen] = useState(false);
  const [ruleWeekday, setRuleWeekday] = useState(1);
  const [ruleStart, setRuleStart] = useState("09:00");
  const [ruleEnd, setRuleEnd] = useState("18:00");
  const [exceptionFormOpen, setExceptionFormOpen] = useState(false);
  const [exceptionDate, setExceptionDate] = useState("");

  function load() {
    Promise.all([listMeetingRequestsForAdmin(), listMeetingAvailabilityRules(), listMeetingAvailabilityExceptions()])
      .then(([m, r, e]) => { setMeetings(m); setRules(r); setExceptions(e); })
      .catch((e) => setError(e instanceof Error ? e.message : "불러오기에 실패했습니다."));
  }
  useEffect(() => { load(); }, []);

  async function withBusy(id: string, fn: () => Promise<void>) {
    setBusyId(id);
    try {
      await fn();
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "처리에 실패했습니다.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      {error && <p className="text-[12px] text-red mb-3">{error}</p>}

      <section className="mb-8">
        <h3 className="text-[13.5px] font-extrabold text-ink mb-2">면담 요청 목록</h3>
        {meetings === null && <p className="text-[13px] text-grey-500">불러오는 중...</p>}
        {meetings && meetings.length === 0 && <p className="text-[13px] text-grey-500">면담 요청이 없습니다.</p>}
        {meetings?.map((m) => (
          <div key={m.id} className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-3">
            <p className="text-[13.5px] font-bold text-ink">
              {m.householdLabel}{m.childName ? ` · ${m.childName}` : ""} — {MEETING_STATUS_LABEL[m.status] ?? m.status}
            </p>
            <p className="text-[12.5px] text-grey-500 mt-1">
              {m.subject && `주제: ${m.subject} · `}희망 시간: {formatDateTime(m.startsAt)}
            </p>
            <div className="flex gap-2 mt-3">
              {m.status === "requested" && (
                <button
                  disabled={busyId === m.id}
                  className="text-[12px] font-bold text-white bg-ink rounded-lg px-3 py-1.5 disabled:opacity-50"
                  onClick={() => withBusy(m.id, () => updateMeetingRequestStatus(m.id, "scheduled"))}
                >
                  확정 처리
                </button>
              )}
              {(m.status === "requested" || m.status === "scheduled") && (
                <>
                  <button
                    disabled={busyId === m.id}
                    className="text-[12px] font-bold text-ink border-[1.5px] border-grey-200 rounded-lg px-3 py-1.5 disabled:opacity-50"
                    onClick={() => withBusy(m.id, () => updateMeetingRequestStatus(m.id, "completed"))}
                  >
                    완료 처리
                  </button>
                  <button
                    disabled={busyId === m.id}
                    className="text-[12px] font-bold text-red border-[1.5px] border-grey-200 rounded-lg px-3 py-1.5 disabled:opacity-50"
                    onClick={() => withBusy(m.id, () => updateMeetingRequestStatus(m.id, "cancelled"))}
                  >
                    취소
                  </button>
                </>
              )}
            </div>
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

export default function InquiryAndMeetingTab() {
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
            {s === "inbox" ? "문의함" : "면담 운영"}
          </button>
        ))}
      </div>
      {sub === "inbox" ? <InquiryInbox /> : <MeetingOperations />}
    </div>
  );
}
