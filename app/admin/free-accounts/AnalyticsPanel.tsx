"use client";

import { useEffect, useState } from "react";
import type { FreeAccountsAnalytics } from "@/lib/free-accounts/types";
import { getFreeAccountsAnalyticsAction } from "../free-accounts-actions";

const ymd = (dt: Date) => dt.toISOString().slice(0, 10);
const daysAgo = (n: number) => { const x = new Date(); x.setDate(x.getDate() - n); return ymd(x); };
const pct = (n: number, den: number) => (den > 0 ? `${Math.round((n / den) * 100)}%` : "—");

const Metric = ({ label, value, note }: { label: string; value: string | number; note?: string }) => (
  <div className="border-[1.5px] border-grey-200 rounded-xl px-4 py-3">
    <div className="text-[11.5px] text-grey-500">{label}</div>
    <div className="text-[20px] font-extrabold text-ink">{value}</div>
    {note && <div className="text-[11px] text-grey-500">{note}</div>}
  </div>
);
const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="mb-6"><h2 className="text-[11px] font-bold text-grey-300 uppercase tracking-wide mb-2">{title}</h2><div className="grid grid-cols-2 md:grid-cols-3 gap-3">{children}</div></section>
);

export default function AnalyticsPanel() {
  const [to, setTo] = useState(() => daysAgo(0));
  const [from, setFrom] = useState(() => daysAgo(29));
  const [includeTest, setIncludeTest] = useState(false);
  const key = `${from}|${to}|${includeTest}`;
  const [res, setRes] = useState<{ key: string; data?: FreeAccountsAnalytics; error?: string } | null>(null);

  useEffect(() => {
    let live = true;
    getFreeAccountsAnalyticsAction(from, to, includeTest)
      .then((data) => live && setRes({ key, data }))
      .catch((e) => live && setRes({ key, error: e instanceof Error ? e.message : "Couldn't load analytics." }));
    return () => { live = false; };
  }, [from, to, includeTest, key]);

  const current = res?.key === key ? res : null;
  const data = current?.data ?? null;
  const error = current?.error ?? null;
  const preset = (days: number) => { setTo(daysAgo(0)); setFrom(daysAgo(days - 1)); };

  const since = data?.learning.trackingSince ? `tracking since ${data.learning.trackingSince.slice(0, 10)}` : "Not tracked yet";
  return (
    <div data-testid="free-accounts-analytics">
      <div className="flex flex-wrap items-end gap-3 mb-5 text-[12.5px]">
        {[7, 30, 90].map((n) => <button key={n} onClick={() => preset(n)} className="px-3 py-1 border-[1.5px] border-grey-200 rounded-lg font-semibold">Last {n} days</button>)}
        <label className="text-grey-500">From <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="px-2 py-1 border-[1.5px] border-grey-200 rounded-lg" /></label>
        <label className="text-grey-500">To <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="px-2 py-1 border-[1.5px] border-grey-200 rounded-lg" /></label>
        <label className="flex items-center gap-1.5 text-ink"><input type="checkbox" checked={includeTest} onChange={(e) => setIncludeTest(e.target.checked)} />Include test accounts</label>
      </div>
      {error && <p className="text-[12.5px] text-red">Couldn&apos;t load analytics. {error}</p>}
      {!data && !error && <p className="text-[12.5px] text-grey-500" aria-busy="true">Loading…</p>}
      {data && (
        <>
          <p className="text-[11.5px] text-grey-500 mb-4">
            {data.period.from} – {data.period.to} ({data.period.timezone} days). {includeTest ? "Test accounts included." : `${data.testAccountsExcluded} test accounts excluded.`}
          </p>
          <Section title="Signups">
            <Metric label="Total free accounts" value={data.signups.totalFreeAccounts} note="Open free accounts, now" />
            <Metric label="New in period" value={data.signups.newInPeriod} />
            <Metric label="Active last 7 days" value={`${data.signups.activeLast7Days}`} note={`${pct(data.signups.activeLast7Days, data.signups.totalFreeAccounts)} of total free accounts · relative to today`} />
            <Metric label="Active in period" value={data.signups.activeInPeriod} note={`${pct(data.signups.activeInPeriod, data.signups.totalFreeAccounts)} of total free accounts`} />
            <Metric label="Converted to tutoring (all time)" value={data.signups.convertedTotal} />
          </Section>
          <Section title="Learning">
            <Metric label="Tests started" value={data.learning.testsStarted} note="Started in period" />
            <Metric label="Tests completed" value={data.learning.testsCompleted} note="Graded in period" />
            <Metric label="Completion rate" value={pct(data.learning.startedCohortCompleted, data.learning.startedCohortSize)} note={`of tests started in period (${data.learning.startedCohortCompleted}/${data.learning.startedCohortSize})`} />
            <Metric label="SAT / AP tests started" value={`${data.learning.satStarted} / ${data.learning.apStarted}`} note="No AP tests available yet" />
            <Metric label="Mistake notebook saves" value={data.learning.mistakeNotebookSavedTotal} note={`${data.learning.mistakeNotebookStudentsTotal} students · all time (not period-filtered)`} />
            <Metric label="Vocabulary words added" value={data.learning.vocabWordsAdded} note={`${data.learning.vocabWordStudents} students`} />
            <Metric label="Vocabulary quizzes completed" value={data.learning.vocabQuizzesCompleted} note={`${data.learning.vocabQuizStudents} students`} />
            <Metric label="Materials opened" value={data.learning.materialsDocsOpened} note="Documents with last read in period" />
            <Metric label="Mistake notebook opens" value={data.learning.mistakeReviewOpens} note={`${data.learning.mistakeReviewStudents} students · ${since}`} />
            <Metric label="Vocabulary study tab opens" value={data.learning.vocabStudyOpens} note={since} />
            <Metric label="Material views" value={data.learning.materialOpens} note={`${data.learning.materialStudents} students · ${since}`} />
          </Section>
          <Section title="Conversion">
            <Metric label="Consultation requests" value={data.conversion.consultRequests} />
            <Metric label="Parent invites sent" value={data.conversion.invitesSent} />
            <Metric label="Invite accept rate" value={pct(data.conversion.invitesAccepted, data.conversion.invitesSent)} note={`${data.conversion.invitesAccepted}/${data.conversion.invitesSent} invites sent in period`} />
            <Metric label="Bookings" value={data.conversion.bookings} note="First scheduled, in period" />
            <Metric label="Consultations completed" value={data.conversion.completions} />
            <Metric label="Tutoring conversions" value={data.conversion.tutoringConversions} />
          </Section>
          <Section title={`Cohort conversion — of ${data.conversion.cohort.size} students who signed up in period`}>
            <Metric label="Requested consultation" value={pct(data.conversion.cohort.requested, data.conversion.cohort.size)} note={`${data.conversion.cohort.requested}/${data.conversion.cohort.size}`} />
            <Metric label="Parent linked" value={pct(data.conversion.cohort.inviteAccepted, data.conversion.cohort.size)} note={`${data.conversion.cohort.inviteAccepted}/${data.conversion.cohort.size}`} />
            <Metric label="Booked" value={pct(data.conversion.cohort.booked, data.conversion.cohort.size)} note={`${data.conversion.cohort.booked}/${data.conversion.cohort.size}`} />
            <Metric label="Consultation completed" value={pct(data.conversion.cohort.completed, data.conversion.cohort.size)} note={`${data.conversion.cohort.completed}/${data.conversion.cohort.size}`} />
            <Metric label="Converted" value={pct(data.conversion.cohort.converted, data.conversion.cohort.size)} note={`${data.conversion.cohort.converted}/${data.conversion.cohort.size}`} />
          </Section>
        </>
      )}
    </div>
  );
}
