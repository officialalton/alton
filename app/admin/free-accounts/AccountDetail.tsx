"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ACCOUNT_STATUS_LABEL, consultStageLabel } from "@/lib/free-accounts/consult-stage";
import type { AttemptHistoryRow, FreeAccountProfile, LearningUsage } from "@/lib/free-accounts/types";
import {
  changeFreeAccountStatusAction, getFreeAccountLearningUsageAction, getFreeAccountProfileAction, getStudentAttemptFactsAction, setTestAccountAction,
} from "../free-accounts-actions";
import AttemptHistoryTable from "./AttemptHistoryTable";
import ScoreStatsCard from "./ScoreStatsCard";

const BTN = "px-3 py-1.5 border-[1.5px] border-grey-200 rounded-lg text-[12.5px] font-semibold disabled:opacity-50";
const Card = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-4">
    <div className="text-[11px] font-bold text-grey-300 uppercase tracking-wide mb-2">{title}</div>
    {children}
  </div>
);
const Row = ({ k, v }: { k: string; v: React.ReactNode }) => (
  <div className="flex justify-between gap-4 text-[12.5px] py-0.5"><span className="text-grey-500">{k}</span><span className="text-ink text-right">{v}</span></div>
);
const NotTracked = () => <span className="text-grey-400 italic">Not tracked yet</span>;
const d = (iso: string | null) => (iso ? iso.slice(0, 10) : "—");

export default function AccountDetail({ studentId, onBack, onChanged }: { studentId: string; onBack: () => void; onChanged: () => void }) {
  const [profile, setProfile] = useState<FreeAccountProfile | null>(null);
  const [attempts, setAttempts] = useState<AttemptHistoryRow[] | null>(null);
  const [usage, setUsage] = useState<LearningUsage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  const [confirmClose, setConfirmClose] = useState(false);

  const loadProfile = useCallback(() => getFreeAccountProfileAction(studentId).then(setProfile), [studentId]);
  useEffect(() => {
    // 프로필 먼저(1회), 점수·사용 지표는 이어서 지연 로드 — 목록에서는 이 데이터를 읽지 않는다.
    loadProfile().catch((e) => setError(e instanceof Error ? e.message : "Couldn't load this account."));
    getStudentAttemptFactsAction(studentId).then(setAttempts).catch(() => setAttempts([]));
    getFreeAccountLearningUsageAction(studentId).then(setUsage).catch(() => setUsage(null));
  }, [studentId, loadProfile]);

  async function change(status: "active" | "suspended" | "closure_pending" | "closed") {
    setBusy(true); setError(null);
    try {
      await changeFreeAccountStatusAction(studentId, status, reason);
      setReason(""); setConfirmClose(false);
      await loadProfile(); onChanged();
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't change the status."); }
    finally { setBusy(false); }
  }
  async function toggleTest() {
    if (!profile) return;
    setBusy(true); setError(null);
    try { await setTestAccountAction(studentId, !profile.isTestAccount, reason || "Manual change"); await loadProfile(); onChanged(); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn't update."); }
    finally { setBusy(false); }
  }

  if (error && !profile) return <div className="px-8 py-8"><button onClick={onBack} className="text-[13px] font-semibold mb-3">← Back</button><p className="text-[12.5px] text-red">{error}</p></div>;
  if (!profile) return <div className="px-8 py-8 text-[12.5px] text-grey-500" aria-busy="true">Loading…</div>;
  const st = profile.accountStatus;

  return (
    <div className="max-w-[760px] px-8 py-8" data-testid="free-account-detail">
      <button onClick={onBack} className="text-[13px] text-grey-600 font-semibold mb-4 border-[1.5px] border-grey-200 rounded-lg px-3 py-1.5 hover:bg-grey-100">← Back</button>
      <h1 className="text-[20px] font-extrabold text-ink mb-1">{profile.name || "No name"}{profile.isTestAccount && <span className="ml-2 text-[11px] font-semibold text-grey-500 border border-grey-200 rounded px-1.5 py-0.5 align-middle">Test account</span>}</h1>
      <p className="text-[13px] text-grey-500 mb-5">{profile.email}</p>
      {error && <p className="text-[12.5px] text-red mb-3">{error}</p>}

      <Card title="Account">
        <Row k="Account status" v={ACCOUNT_STATUS_LABEL[st] ?? st} />
        <Row k="Member type" v={profile.memberType === "free" ? "Free" : "Tutoring"} />
        <Row k="Grade" v={profile.grade ?? "—"} />
        <Row k="Joined" v={d(profile.joinedAt)} />
        <Row k="Last active" v={d(profile.lastActiveAt)} />
        <Row k="Last sign-in" v={d(profile.lastSignInAt)} />
        <Row k="Feature access" v={profile.featureKeys.length ? profile.featureKeys.join(", ") : "—"} />
        <Row k="Guardians" v={profile.guardians.length ? profile.guardians.map((g) => g.name || g.email).join(", ") : "None linked"} />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (required)" aria-label="Reason"
            className="flex-1 min-w-[200px] px-3 py-1.5 border-[1.5px] border-grey-200 rounded-lg text-[13px]" />
          {st === "active" && <button disabled={busy || !reason.trim()} onClick={() => change("suspended")} className={BTN}>Suspend account</button>}
          {st === "suspended" && <button disabled={busy || !reason.trim()} onClick={() => change("active")} className={BTN}>Reactivate account</button>}
          {(st === "active" || st === "suspended") && <button disabled={busy || !reason.trim()} onClick={() => setConfirmClose(true)} className={BTN + " text-red"}>Close account</button>}
          {st === "closure_pending" && <button disabled={busy || !reason.trim()} onClick={() => setConfirmClose(true)} className={BTN + " text-red"}>Finalize closure</button>}
          <button disabled={busy} onClick={toggleTest} className={BTN}>{profile.isTestAccount ? "Unmark test account" : "Mark as test account"}</button>
        </div>
        {confirmClose && (
          <div role="alertdialog" className="mt-3 border-[1.5px] border-red rounded-lg px-3 py-2 text-[12.5px]">
            {st === "closure_pending" ? "Finalize closing this account?" : "Move this account to closure pending?"} Reason: “{reason}”
            <div className="mt-2 flex gap-2">
              <button disabled={busy} onClick={() => change(st === "closure_pending" ? "closed" : "closure_pending")} className={BTN + " text-red"}>Confirm</button>
              <button onClick={() => setConfirmClose(false)} className={BTN}>Cancel</button>
            </div>
          </div>
        )}
        <div className="text-[11px] font-bold text-grey-300 uppercase tracking-wide mt-4 mb-1">Status history</div>
        {profile.statusHistory.length === 0 ? <p className="text-[12.5px] text-grey-500">No changes recorded.</p> : (
          <ul className="text-[12px] text-ink space-y-0.5">
            {profile.statusHistory.map((h, i) => (
              <li key={i}>{d(h.at)} · {ACCOUNT_STATUS_LABEL[h.previous ?? ""] ?? h.previous ?? "—"} → {ACCOUNT_STATUS_LABEL[h.new] ?? h.new}{h.changedBy ? ` · ${h.changedBy}` : ""}{h.reason ? ` · ${h.reason}` : ""}</li>
            ))}
          </ul>
        )}
      </Card>

      {attempts === null ? <Card title="Score stats"><p className="text-[12.5px] text-grey-500" aria-busy="true">Loading…</p></Card> : <ScoreStatsCard facts={attempts} />}
      {attempts && <AttemptHistoryTable rows={attempts} />}

      <Card title="Learning usage">
        {!usage ? <p className="text-[12.5px] text-grey-500">Loading…</p> : (
          <>
            <Row k="Mistake notebook — saved questions" v={usage.mistakeNotebook.savedCount} />
            <Row k="Mistake notebook — reviewed" v={<NotTracked />} />
            <Row k="Vocabulary — words saved" v={`${usage.vocabulary.wordsSaved} (last ${d(usage.vocabulary.lastWordAt)})`} />
            <Row k="Vocabulary — quizzes completed" v={`${usage.vocabulary.quizzesCompleted}${usage.vocabulary.avgQuizPct !== null ? ` · avg ${usage.vocabulary.avgQuizPct}%` : ""}`} />
            <Row k="Vocabulary — flashcard study" v={<NotTracked />} />
            <Row k="Materials — documents opened" v={`${usage.materials.docsOpened} (last ${d(usage.materials.lastReadAt)})`} />
            <Row k="Materials — views / time spent" v={<NotTracked />} />
          </>
        )}
      </Card>

      <Card title="Consultation">
        <Row k="Stage" v={consultStageLabel(profile.consultStage)} />
        {profile.consultFlags.includes("invite_needs_review") && <p className="text-[12px] text-red">Guardian invite needs manual review.</p>}
        <Row k="Guardian invite" v={profile.invite ? `${profile.invite.status} (${d(profile.invite.sentAt)})` : "—"} />
        <Row k="Interest registered" v={profile.interest ? `${profile.interest.status} (${d(profile.interest.createdAt)})` : "—"} />
        <Row k="Converted to tutoring" v={d(profile.convertedAt)} />
        {profile.consultations.map((c) => (
          <Row key={c.id} k={`Consultation ${d(c.createdAt)}`} v={`${c.status}${c.consultantName ? ` · ${c.consultantName}` : ""}`} />
        ))}
        <div className="mt-2 flex gap-3 text-[12.5px]">
          <Link href="/admin?tab=consult" className="text-navy underline font-semibold">Open consultations</Link>
          {profile.memberType === "tutoring" && <Link href="/admin?tab=users" className="text-navy underline font-semibold">Open in Users</Link>}
        </div>
      </Card>
    </div>
  );
}
