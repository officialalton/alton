"use client";

import { useState } from "react";
import type { AdditionalAttendee } from "@/lib/attendees/attendees";

type Result = { ok: true; data: AdditionalAttendee[] } | { ok: false; error: string };

type Copy = {
  toggleOpen: string;
  toggleClose: string;
  empty: string;
  namePlaceholder: string;
  relationshipPlaceholder: string;
  add: string;
  noticeDone: string;
  noticeMissing: string;
  consentDone: string;
  consentMissing: string;
  recordNotice: string;
  recordConsent: string;
  captureBlocked: string;
  adminOnlyNote: string;
};

export const ADMIN_ATTENDEE_COPY: Copy = {
  toggleOpen: "참석자 관리",
  toggleClose: "참석자 접기",
  empty: "추가 참석자가 없습니다.",
  namePlaceholder: "참석자 이름",
  relationshipPlaceholder: "관계(선택)",
  add: "참석자 추가",
  noticeDone: "안내 완료",
  noticeMissing: "안내 미기록",
  consentDone: "동의 기록됨",
  consentMissing: "동의 미기록",
  recordNotice: "안내 기록",
  recordConsent: "동의 기록",
  captureBlocked: "안내·동의가 모두 기록되기 전에는 녹화·전사·AI 노트가 시작되지 않습니다.",
  adminOnlyNote: "안내·동의 기록은 관리자만 합니다.",
};

export const TEACHER_ATTENDEE_COPY: Copy = {
  toggleOpen: "Additional attendees",
  toggleClose: "Hide attendees",
  empty: "No additional attendees.",
  namePlaceholder: "Attendee name",
  relationshipPlaceholder: "Relationship (optional)",
  add: "Add attendee",
  noticeDone: "Notice given",
  noticeMissing: "Notice not recorded",
  consentDone: "Consent recorded",
  consentMissing: "Consent not recorded",
  recordNotice: "",
  recordConsent: "",
  captureBlocked: "Recording, transcription, and AI notes will not start until notice and consent are recorded for every attendee.",
  adminOnlyNote: "Notice and consent are recorded by ALTON staff.",
};

/**
 * Minimal attendee list for one lesson or consultation. Loads only when opened (one query), so schedule lists are unchanged.
 * `onRecord` is passed only on the admin side — attendees and teachers can never record notice or consent.
 */
export default function AdditionalAttendeesPanel({
  copy,
  load,
  onAdd,
  onRecord,
}: {
  copy: Copy;
  load: () => Promise<Result>;
  onAdd: (input: { displayName: string; relationship?: string }) => Promise<Result>;
  onRecord?: (attendeeId: string, status: { notice?: boolean; consent?: boolean }) => Promise<Result>;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AdditionalAttendee[] | null>(null);
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<Result>) {
    setBusy(true);
    setError(null);
    try {
      const r = await fn();
      if (r.ok) setItems(r.data);
      else setError(r.error);
    } catch {
      setError("Failed.");
    } finally {
      setBusy(false);
    }
  }

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && items === null) void run(load);
  }

  const incomplete = (items ?? []).some((a) => !a.noticeGivenAt || !a.consentRecordedAt);

  return (
    <div className="mt-2" data-testid="attendees-panel">
      <button type="button" onClick={toggle} className="text-[12px] font-bold text-ink underline">
        {open ? copy.toggleClose : copy.toggleOpen}
      </button>
      {open && (
        <div className="mt-2 border-[1.5px] border-grey-200 rounded-lg px-3 py-2">
          {items === null && !error && <p className="text-[12px] text-grey-500">…</p>}
          {items && items.length === 0 && <p className="text-[12px] text-grey-500">{copy.empty}</p>}
          {items?.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-2 py-1 text-[12px]" data-testid="attendee-row">
              <span className="text-ink font-semibold">
                {a.displayName}
                {a.relationship ? <span className="text-grey-500 font-normal"> · {a.relationship}</span> : null}
              </span>
              <span className="flex items-center gap-1.5">
                <span className={a.noticeGivenAt ? "text-green" : "text-red"}>{a.noticeGivenAt ? copy.noticeDone : copy.noticeMissing}</span>
                <span className={a.consentRecordedAt ? "text-green" : "text-red"}>{a.consentRecordedAt ? copy.consentDone : copy.consentMissing}</span>
                {onRecord && !a.noticeGivenAt && (
                  <button disabled={busy} onClick={() => run(() => onRecord(a.id, { notice: true }))} className="font-bold underline disabled:opacity-50">
                    {copy.recordNotice}
                  </button>
                )}
                {onRecord && a.noticeGivenAt && !a.consentRecordedAt && (
                  <button disabled={busy} onClick={() => run(() => onRecord(a.id, { consent: true }))} className="font-bold underline disabled:opacity-50">
                    {copy.recordConsent}
                  </button>
                )}
              </span>
            </div>
          ))}
          {incomplete && <p className="text-[11.5px] text-grey-500 mt-1">{copy.captureBlocked}</p>}
          {!onRecord && items && items.length > 0 && <p className="text-[11.5px] text-grey-500 mt-1">{copy.adminOnlyNote}</p>}
          <div className="flex gap-2 mt-2">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={copy.namePlaceholder} className="flex-1 px-2 py-1 border-[1.5px] border-grey-200 rounded text-[12px]" />
            <input value={relationship} onChange={(e) => setRelationship(e.target.value)} placeholder={copy.relationshipPlaceholder} className="w-32 px-2 py-1 border-[1.5px] border-grey-200 rounded text-[12px]" />
            <button
              disabled={busy || !name.trim()}
              onClick={async () => {
                await run(() => onAdd({ displayName: name, relationship }));
                setName("");
                setRelationship("");
              }}
              className="text-[12px] font-bold px-2.5 py-1 rounded bg-ink text-white disabled:opacity-50"
            >
              {copy.add}
            </button>
          </div>
          {error && <p className="text-[12px] text-red mt-1">{error}</p>}
          {onRecord && <p className="text-[11.5px] text-grey-500 mt-1">{copy.adminOnlyNote}</p>}
        </div>
      )}
    </div>
  );
}
