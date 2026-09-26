"use client";

import { useEffect, useState } from "react";
import UnderlineSubTabs from "@/app/components/UnderlineSubTabs";
import { listConsultantsAction, type ConsultantWithStudents } from "./consultant-assignment-actions";
import { listTeachersForUsersTabAction } from "./users-actions";
import type { TeacherListItem } from "./users-data";
import {
  listAllStaffInquiriesAction,
  startStaffInquiryAction,
  listStaffMessagesAction,
  sendAdminStaffMessageAction,
  closeStaffInquiryAction,
  type StaffInquiryListItem,
  type StaffMessage,
} from "./staff-messenger-actions";
import {
  listAllTeacherStaffInquiriesAction,
  startTeacherStaffInquiryAction,
  listTeacherStaffMessagesAction,
  sendAdminTeacherStaffMessageAction,
  closeTeacherStaffInquiryAction,
  type TeacherStaffInquiryListItem,
  type TeacherStaffMessage,
} from "./teacher-staff-messenger-actions";

// 관리자 포털 정리 항목 2(2026-09-23) — "관리자 Messenger는 먼저 Teachers /
// Consultants로 구분하고, 향후 학생·보호자 채널을 추가할 수 있게 구성합니다."
// 지금까지 컨설턴트 내부 문의(StaffMessagesAdminSection)는 Consultants 탭
// 안에 끼어 있었다 — 여기서 Messenger라는 별도 메인 탭으로 뽑아 Teachers
// 서브탭을 나란히 추가한다. 학생·보호자 채널은 이번 범위에 넣지 않는다
// (household_inquiries 쪽 UI는 기존 Inquiries 탭에 남아 있고, 항목 3에서
// 정리한다) — 서브탭 배열에 추가만 하면 되도록 구조를 열어둔다.
const SUBTABS = [
  { id: "teachers", label: "Teachers" },
  { id: "consultants", label: "Consultants" },
] as const;
type SubtabId = (typeof SUBTABS)[number]["id"];

export default function MessengerTab() {
  const [subtab, setSubtab] = useState<SubtabId>("consultants");

  return (
    <div className="max-w-[720px]">
      <div className="border-b border-grey-200 mb-5">
        <UnderlineSubTabs items={SUBTABS} activeId={subtab} onSelect={setSubtab} className="border-b-0" />
      </div>
      {subtab === "teachers" && <TeacherMessengerPanel />}
      {subtab === "consultants" && <ConsultantMessengerPanel />}
    </div>
  );
}

function ConsultantMessengerPanel() {
  const [consultants, setConsultants] = useState<ConsultantWithStudents[] | null>(null);
  const [inquiries, setInquiries] = useState<StaffInquiryListItem[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<StaffMessage[] | null>(null);
  const [newConsultantId, setNewConsultantId] = useState("");
  const [newSubject, setNewSubject] = useState("");
  const [newBody, setNewBody] = useState("");
  const [replyBody, setReplyBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function reload() {
    listAllStaffInquiriesAction()
      .then(setInquiries)
      .catch((e) => setError(e instanceof Error ? e.message : "불러오지 못했습니다."));
  }
  useEffect(() => {
    listConsultantsAction().then(setConsultants);
    reload();
  }, []);

  function openInquiry(id: string) {
    setSelectedId(id);
    setMessages(null);
    listStaffMessagesAction(id)
      .then(setMessages)
      .catch((e) => setError(e instanceof Error ? e.message : "불러오지 못했습니다."));
  }

  async function handleStart() {
    if (!newConsultantId || !newBody.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const { inquiryId } = await startStaffInquiryAction(newConsultantId, newBody, newSubject || undefined);
      setNewBody("");
      setNewSubject("");
      reload();
      openInquiry(inquiryId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "시작하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function handleReply() {
    if (!selectedId || !replyBody.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await sendAdminStaffMessageAction(selectedId, replyBody);
      setReplyBody("");
      openInquiry(selectedId);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "전송하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function handleClose() {
    if (!selectedId) return;
    setBusy(true);
    try {
      await closeStaffInquiryAction(selectedId);
      openInquiry(selectedId);
      reload();
    } finally {
      setBusy(false);
    }
  }

  const selected = inquiries?.find((i) => i.id === selectedId) ?? null;

  return (
    <div>
      {error && <div className="mb-3 text-[13px] font-semibold text-red bg-red/5 rounded-lg px-4 py-3">{error}</div>}

      {!selectedId && (
        <div className="border-[1.5px] border-grey-200 rounded-xl p-4 mb-5">
          <div className="flex flex-wrap gap-2 mb-2">
            <select
              value={newConsultantId}
              onChange={(e) => setNewConsultantId(e.target.value)}
              className="border-[1.5px] border-grey-200 rounded-lg px-2.5 py-1.5 text-[13px]"
            >
              <option value="">컨설턴트 선택</option>
              {(consultants ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name ?? c.id}
                </option>
              ))}
            </select>
            <input
              value={newSubject}
              onChange={(e) => setNewSubject(e.target.value)}
              placeholder="주제(선택)"
              className="flex-1 min-w-[140px] border-[1.5px] border-grey-200 rounded-lg px-3 py-1.5 text-[13px]"
            />
          </div>
          <textarea
            value={newBody}
            onChange={(e) => setNewBody(e.target.value)}
            placeholder="업무 지침·안내 내용을 입력해주세요"
            className="w-full border-[1.5px] border-grey-200 rounded-lg px-3 py-2 text-[13px] min-h-[80px]"
          />
          <button
            onClick={handleStart}
            disabled={busy || !newConsultantId || !newBody.trim()}
            className="mt-2 text-[13px] font-bold bg-ink text-white rounded-lg px-4 py-1.5 disabled:opacity-50"
          >
            보내기
          </button>
        </div>
      )}

      {selectedId ? (
        <div>
          <button onClick={() => setSelectedId(null)} className="text-[12.5px] font-semibold text-grey-500 mb-3">
            ← 목록으로
          </button>
          <h3 className="text-[14px] font-bold text-ink mb-1">{selected?.subject ?? "제목 없음"}</h3>
          <div className="text-[12px] text-grey-500 mb-3">{selected?.consultantName}</div>
          {messages === null ? (
            <p className="text-[13px] text-grey-500">불러오는 중…</p>
          ) : (
            <div className="space-y-2 mb-4">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={"rounded-xl px-3 py-2 text-[13px] max-w-[80%] " + (m.senderRole === "admin" ? "bg-ink text-white ml-auto" : "bg-grey-100 text-ink")}
                >
                  <div className="text-[10.5px] font-bold opacity-70 mb-0.5">{m.senderRole === "admin" ? "관리자" : "컨설턴트"}</div>
                  {m.body}
                </div>
              ))}
            </div>
          )}
          {selected?.status === "open" ? (
            <div className="flex gap-2">
              <input
                value={replyBody}
                onChange={(e) => setReplyBody(e.target.value)}
                placeholder="답장하기"
                className="flex-1 border-[1.5px] border-grey-200 rounded-lg px-3 py-1.5 text-[13px]"
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleReply();
                }}
              />
              <button onClick={handleReply} disabled={busy || !replyBody.trim()} className="text-[13px] font-bold bg-ink text-white rounded-lg px-4 py-1.5 disabled:opacity-50">
                전송
              </button>
              <button onClick={handleClose} disabled={busy} className="text-[13px] font-bold text-red disabled:opacity-50">
                종료
              </button>
            </div>
          ) : (
            <p className="text-[12px] text-grey-500">종료된 대화입니다.</p>
          )}
        </div>
      ) : inquiries === null ? (
        <p className="text-[13px] text-grey-500">불러오는 중…</p>
      ) : inquiries.length === 0 ? (
        <div className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center">아직 대화가 없습니다.</div>
      ) : (
        inquiries.map((i) => (
          <button
            key={i.id}
            onClick={() => openInquiry(i.id)}
            className="w-full text-left border-[1.5px] border-grey-200 rounded-xl px-4 py-3 mb-2 flex items-center justify-between"
          >
            <div>
              <div className="text-[13px] font-bold text-ink">
                {i.consultantName} · {i.subject ?? "제목 없음"}
              </div>
              <div className="text-[11.5px] text-grey-500">{i.status === "open" ? "진행 중" : "종료됨"}</div>
            </div>
            <span className="text-[11px] text-grey-500">{new Date(i.lastMessageAt).toLocaleString("ko-KR")}</span>
          </button>
        ))
      )}
    </div>
  );
}

function TeacherMessengerPanel() {
  const [teachers, setTeachers] = useState<TeacherListItem[] | null>(null);
  const [inquiries, setInquiries] = useState<TeacherStaffInquiryListItem[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<TeacherStaffMessage[] | null>(null);
  const [newTeacherId, setNewTeacherId] = useState("");
  const [newSubject, setNewSubject] = useState("");
  const [newBody, setNewBody] = useState("");
  const [replyBody, setReplyBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function reload() {
    listAllTeacherStaffInquiriesAction()
      .then(setInquiries)
      .catch((e) => setError(e instanceof Error ? e.message : "불러오지 못했습니다."));
  }
  useEffect(() => {
    listTeachersForUsersTabAction().then((r) => setTeachers(r.teachers));
    reload();
  }, []);

  function openInquiry(id: string) {
    setSelectedId(id);
    setMessages(null);
    listTeacherStaffMessagesAction(id)
      .then(setMessages)
      .catch((e) => setError(e instanceof Error ? e.message : "불러오지 못했습니다."));
  }

  async function handleStart() {
    if (!newTeacherId || !newBody.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const { inquiryId } = await startTeacherStaffInquiryAction(newTeacherId, newBody, newSubject || undefined);
      setNewBody("");
      setNewSubject("");
      reload();
      openInquiry(inquiryId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "시작하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function handleReply() {
    if (!selectedId || !replyBody.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await sendAdminTeacherStaffMessageAction(selectedId, replyBody);
      setReplyBody("");
      openInquiry(selectedId);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "전송하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function handleClose() {
    if (!selectedId) return;
    setBusy(true);
    try {
      await closeTeacherStaffInquiryAction(selectedId);
      openInquiry(selectedId);
      reload();
    } finally {
      setBusy(false);
    }
  }

  const selected = inquiries?.find((i) => i.id === selectedId) ?? null;

  return (
    <div>
      {error && <div className="mb-3 text-[13px] font-semibold text-red bg-red/5 rounded-lg px-4 py-3">{error}</div>}

      {!selectedId && (
        <div className="border-[1.5px] border-grey-200 rounded-xl p-4 mb-5">
          <div className="flex flex-wrap gap-2 mb-2">
            <select
              value={newTeacherId}
              onChange={(e) => setNewTeacherId(e.target.value)}
              className="border-[1.5px] border-grey-200 rounded-lg px-2.5 py-1.5 text-[13px]"
            >
              <option value="">선생님 선택</option>
              {(teachers ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.email})
                </option>
              ))}
            </select>
            <input
              value={newSubject}
              onChange={(e) => setNewSubject(e.target.value)}
              placeholder="주제(선택)"
              className="flex-1 min-w-[140px] border-[1.5px] border-grey-200 rounded-lg px-3 py-1.5 text-[13px]"
            />
          </div>
          <textarea
            value={newBody}
            onChange={(e) => setNewBody(e.target.value)}
            placeholder="업무 지침·안내 내용을 입력해주세요"
            className="w-full border-[1.5px] border-grey-200 rounded-lg px-3 py-2 text-[13px] min-h-[80px]"
          />
          <button
            onClick={handleStart}
            disabled={busy || !newTeacherId || !newBody.trim()}
            className="mt-2 text-[13px] font-bold bg-ink text-white rounded-lg px-4 py-1.5 disabled:opacity-50"
          >
            보내기
          </button>
        </div>
      )}

      {selectedId ? (
        <div>
          <button onClick={() => setSelectedId(null)} className="text-[12.5px] font-semibold text-grey-500 mb-3">
            ← 목록으로
          </button>
          <h3 className="text-[14px] font-bold text-ink mb-1">{selected?.subject ?? "제목 없음"}</h3>
          <div className="text-[12px] text-grey-500 mb-3">{selected?.teacherName}</div>
          {messages === null ? (
            <p className="text-[13px] text-grey-500">불러오는 중…</p>
          ) : (
            <div className="space-y-2 mb-4">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={"rounded-xl px-3 py-2 text-[13px] max-w-[80%] " + (m.senderRole === "admin" ? "bg-ink text-white ml-auto" : "bg-grey-100 text-ink")}
                >
                  <div className="text-[10.5px] font-bold opacity-70 mb-0.5">{m.senderRole === "admin" ? "관리자" : "선생님"}</div>
                  {m.body}
                </div>
              ))}
            </div>
          )}
          {selected?.status === "open" ? (
            <div className="flex gap-2">
              <input
                value={replyBody}
                onChange={(e) => setReplyBody(e.target.value)}
                placeholder="답장하기"
                className="flex-1 border-[1.5px] border-grey-200 rounded-lg px-3 py-1.5 text-[13px]"
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleReply();
                }}
              />
              <button onClick={handleReply} disabled={busy || !replyBody.trim()} className="text-[13px] font-bold bg-ink text-white rounded-lg px-4 py-1.5 disabled:opacity-50">
                전송
              </button>
              <button onClick={handleClose} disabled={busy} className="text-[13px] font-bold text-red disabled:opacity-50">
                종료
              </button>
            </div>
          ) : (
            <p className="text-[12px] text-grey-500">종료된 대화입니다.</p>
          )}
        </div>
      ) : inquiries === null ? (
        <p className="text-[13px] text-grey-500">불러오는 중…</p>
      ) : inquiries.length === 0 ? (
        <div className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center">아직 대화가 없습니다.</div>
      ) : (
        inquiries.map((i) => (
          <button
            key={i.id}
            onClick={() => openInquiry(i.id)}
            className="w-full text-left border-[1.5px] border-grey-200 rounded-xl px-4 py-3 mb-2 flex items-center justify-between"
          >
            <div>
              <div className="text-[13px] font-bold text-ink">
                {i.teacherName} · {i.subject ?? "제목 없음"}
              </div>
              <div className="text-[11.5px] text-grey-500">{i.status === "open" ? "진행 중" : "종료됨"}</div>
            </div>
            <span className="text-[11px] text-grey-500">{new Date(i.lastMessageAt).toLocaleString("ko-KR")}</span>
          </button>
        ))
      )}
    </div>
  );
}
