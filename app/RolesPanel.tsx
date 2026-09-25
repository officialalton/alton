"use client";

import { useState } from "react";
import { Icon, type IconName } from "./landing-icons";

// 랜딩 페이지 리디자인(2026-09-25) — "ONE LEARNING RECORD, FOUR VIEWS" 섹션.
// 학생/학부모/선생님/대학 진학 4개 탭을 눌러 같은 학습 기록이 역할마다 어떻게
// 보이는지 보여준다(목업의 role state 그대로).

type Role = "student" | "parent" | "tutor" | "college";

const ROLE_TABS: { id: Role; label: string }[] = [
  { id: "student", label: "Students" },
  { id: "parent", label: "Parents" },
  { id: "tutor", label: "Tutors" },
  { id: "college", label: "College guidance" },
];

const ROLE_META: Record<Role, { title: string; kr: string; panel: string; panelMeta: string; points: { icon: IconName; t: string; d: string }[] }> = {
  student: {
    title: "For students",
    kr: "수업, 과제, 피드백, 목표",
    panel: "Jiwoo's week",
    panelMeta: "Student view",
    points: [
      { icon: "lesson", t: "Lessons that fit you", d: "1:1 sessions at your pace, with materials in one place." },
      { icon: "homework", t: "Homework with a purpose", d: "Every assignment ties back to this week's goal." },
      { icon: "feedback", t: "Feedback after every lesson", d: "Specific notes from your tutor — what worked, what's next." },
      { icon: "goal", t: "Goals you can see moving", d: "Small, weekly goals that add up to real progress." },
    ],
  },
  parent: {
    title: "For parents",
    kr: "학습 진행, 일정, 선생님 피드백",
    panel: "Weekly learning report · Oct 13–19",
    panelMeta: "Parent view",
    points: [
      { icon: "report", t: "A weekly report you can read", d: "Lessons attended, goals met, what to practise — in English or Korean." },
      { icon: "cal", t: "One family schedule", d: "Every lesson and meeting in a single calendar." },
      { icon: "feedback", t: "Tutor notes, not guesswork", d: "Hear from the tutor directly after key lessons." },
      { icon: "match", t: "Meet when it matters", d: "Request a parent meeting with the tutor in one tap." },
    ],
  },
  tutor: {
    title: "For tutors",
    kr: "수업 준비, 학생별 계획, 피드백",
    panel: "Ms. Choi · Today",
    panelMeta: "Tutor view · 9 students",
    points: [
      { icon: "folder", t: "Lesson prep in one place", d: "Notes, materials and last week's feedback before you start." },
      { icon: "goal", t: "A plan for each student", d: "Current goal, next lesson and pace, per student." },
      { icon: "feedback", t: "Feedback in two minutes", d: "Write it once; it reaches the student and the family." },
      { icon: "cal", t: "Your teaching calendar", d: "Lessons, reschedules and availability together." },
    ],
  },
  college: {
    title: "College guidance",
    kr: "대학 탐색, 에세이, 지원 전략",
    panel: "College guidance · Jiwoo",
    panelMeta: "Add-on for grades 10–12",
    points: [
      { icon: "explore", t: "Explore colleges", d: "Structured, sourced profiles — admission outlook, rules, cost." },
      { icon: "essay", t: "Essays with your writing tutor", d: "Drafts and feedback continue from regular lessons." },
      { icon: "goal", t: "Application strategy", d: "A balanced list and deadlines, set with a college advisor." },
      { icon: "growth", t: "Built on your record", d: "Your learning history shapes the plan, not a template." },
    ],
  },
};

const LESSONS = [
  { d: "TUE", n: "14", t: "AP Chemistry · Ms. Choi", m: "4:30 PM · in 12 min", bg: "#FCEBEB", live: true },
  { d: "THU", n: "16", t: "Essay writing · Sarah Lee", m: "5:00 PM", bg: "#F8F5EF", live: false },
  { d: "SAT", n: "18", t: "SAT Math · Mr. Park", m: "10:00 AM", bg: "#F8F5EF", live: false },
];
const HOMEWORK = [
  { t: "Practice set 7", s: "Done", bg: "#E3EEEA", fg: "#3F6B5E" },
  { t: "Q4–Q7 pressure shifts", s: "In progress", bg: "#FCEBEB", fg: "#8F0B20" },
  { t: "Body paragraph 2", s: "Due Thu", bg: "#FBF0DF", fg: "#9A5B12" },
  { t: "SAT set C", s: "Sat", bg: "#F1EDE6", fg: "#4F5A6B" },
];
const GOALS = [
  { s: "Chemistry · this week", t: "Balance any equilibrium", w: "100%", c: "#5E8C7E" },
  { s: "Writing · this week", t: "Lock the thesis", w: "100%", c: "#5E8C7E" },
  { s: "Math · this month", t: "90% on set C", w: "60%", c: "#C8102E" },
];
const REPORT_STATS = [
  { k: "Lessons attended", v: "3 / 3", m: "this week" },
  { k: "Goals met", v: "2", m: "of 3 set" },
  { k: "Homework", v: "4 / 5", m: "1 due Thursday" },
];
const SUBJECT_BARS = [
  { t: "Chemistry", m: "Unit 7 of 9", prev: "52%", gain: "22%" },
  { t: "Writing", m: "Draft 3", prev: "48%", gain: "18%" },
  { t: "SAT Math", m: "Set C", prev: "60%", gain: "8%" },
];
const PARENT_CAL = [
  { t: "Chemistry", d: "Tue 4:30 PM" },
  { t: "Essay writing", d: "Thu 5:00 PM" },
  { t: "SAT Math", d: "Sat 10:00 AM" },
];
const TUTOR_TODAY = [
  { time: "3:00 PM", who: "Minseo Lee", what: "Chemistry · Lesson 5", status: "Prep ready", sc: "#3F6B5E", bd: "#E6E1D8", bg: "#FFFFFF" },
  { time: "4:30 PM", who: "Jiwoo Kim", what: "Chemistry · Lesson 12", status: "Next up", sc: "#C8102E", bd: "#F0C4C9", bg: "#FFFAFA" },
  { time: "6:00 PM", who: "Daniel Park", what: "Chemistry · Lesson 8", status: "Add materials", sc: "#9A5B12", bd: "#E6E1D8", bg: "#FFFFFF" },
];
const ROSTER = [
  { i: "JK", n: "Jiwoo Kim", g: "Pressure shifts (Q4–Q7)", x: "Today", f: "Due today", bg: "#FCEBEB", fg: "#8F0B20" },
  { i: "ML", n: "Minseo Lee", g: "Stoichiometry basics", x: "Today", f: "Sent", bg: "#E3EEEA", fg: "#3F6B5E" },
  { i: "DP", n: "Daniel Park", g: "Acids & bases review", x: "Today", f: "Sent", bg: "#E3EEEA", fg: "#3F6B5E" },
  { i: "SY", n: "Seoyeon Yoon", g: "Kinetics · rate laws", x: "Wed", f: "Draft", bg: "#F1EDE6", fg: "#4F5A6B" },
];
const COLLEGES = [
  { n: "Princeton University", f: "Reach", bg: "#F1F4F9", fg: "#283C62" },
  { n: "UCLA", f: "Target", bg: "#EEF3FE", fg: "#284DB0" },
  { n: "New York University", f: "Target", bg: "#EEF3FE", fg: "#284DB0" },
  { n: "University of Michigan", f: "Likely", bg: "#E3EEEA", fg: "#3F6B5E" },
];
const ESSAYS = [
  { n: "Personal statement", s: "Draft 3", w: "78%" },
  { n: "UC insights", s: "2 of 4", w: "50%" },
  { n: "Why NYU", s: "Outline", w: "18%" },
];

export default function RolesPanel() {
  const [role, setRole] = useState<Role>("student");
  const meta = ROLE_META[role];

  return (
    <section id="roles" className="bg-[#F8F5EF] px-10 py-24 md:px-20">
      <div className="grid grid-cols-1 lg:grid-cols-[440px_minmax(0,1fr)] gap-16 items-start max-w-[1440px] mx-auto">
        <div className="flex flex-col gap-6">
          <span className="font-mono text-[12px] font-medium tracking-[0.08em] text-[#C8102E]">
            ONE LEARNING RECORD, FOUR VIEWS
          </span>
          <h2 className="m-0 font-[family-name:var(--font-bricolage)] font-semibold text-[46px] leading-[1.08] tracking-[-0.02em] text-[#142240]">
            Built for the student. Clear for everyone around them.
          </h2>
          <div role="tablist" aria-label="Choose a view" className="grid grid-cols-2 gap-1.5 p-1.5 bg-[#EBE6DD] rounded-2xl">
            {ROLE_TABS.map((t) => {
              const selected = t.id === role;
              return (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setRole(t.id)}
                  className={
                    "h-12 px-3.5 rounded-xl flex items-center justify-center gap-2 text-[15px] transition-colors " +
                    (selected ? "bg-white shadow-sm font-semibold text-[#142240]" : "bg-transparent font-medium text-[#4F5A6B]")
                  }
                >
                  <span className={"w-[7px] h-[7px] rounded-full " + (selected ? "bg-[#C8102E]" : "bg-transparent")} />
                  {t.label}
                </button>
              );
            })}
          </div>
          <div className="flex flex-col gap-1.5">
            <strong className="text-[20px] text-[#142240]">{meta.title}</strong>
            <span className="text-[15px] font-medium text-[#3F6B5E]" style={{ wordBreak: "keep-all" }}>
              {meta.kr}
            </span>
          </div>
          <div className="flex flex-col gap-3.5">
            {meta.points.map((p) => (
              <div key={p.t} className="flex gap-3.5 items-start">
                <span className="w-9 h-9 rounded-xl bg-white border border-[#E6E1D8] flex items-center justify-center shrink-0">
                  <Icon name={p.icon} />
                </span>
                <div className="flex flex-col gap-0.5 pt-px">
                  <strong className="text-[15px] text-[#1B2536]">{p.t}</strong>
                  <span className="text-[14px] leading-[1.5] text-[#4F5A6B]">{p.d}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="h-[696px] bg-white border border-[#E6E1D8] rounded-3xl shadow-[0_24px_48px_-16px_rgba(20,34,64,0.16)] overflow-hidden flex flex-col">
          <div className="h-[60px] shrink-0 px-6 flex items-center justify-between border-b border-[#F1EDE6]">
            <strong className="text-[15px] text-[#142240]">{meta.panel}</strong>
            <span className="text-[12px] text-[#5F6778]">{meta.panelMeta}</span>
          </div>

          {role === "student" && (
            <div className="flex-grow p-5 grid grid-cols-2 gap-4 content-start">
              <div className="border border-[#E6E1D8] rounded-2xl p-4 flex flex-col gap-2.5">
                <strong className="text-[14px] text-[#142240]">Lessons this week</strong>
                {LESSONS.map((c) => (
                  <div key={c.t} className="flex gap-3 items-center py-2.5 px-3 rounded-2xl" style={{ background: c.bg }}>
                    <div className="flex flex-col items-center w-9 shrink-0">
                      <span className="text-[10px] text-[#5F6778]">{c.d}</span>
                      <strong className="text-[16px] text-[#142240]">{c.n}</strong>
                    </div>
                    <div className="flex flex-col gap-px flex-grow">
                      <span className="text-[13px] font-semibold text-[#1B2536]">{c.t}</span>
                      <span className="text-[12px] text-[#5F6778]">{c.m}</span>
                    </div>
                    {c.live && <span className="w-2 h-2 rounded-full bg-[#C8102E]" />}
                  </div>
                ))}
              </div>
              <div className="border border-[#E6E1D8] rounded-2xl p-4 flex flex-col gap-2.5">
                <strong className="text-[14px] text-[#142240]">Homework</strong>
                {HOMEWORK.map((a) => (
                  <div key={a.t} className="flex justify-between items-center gap-2 py-1.5 border-b border-[#F2EEE8] last:border-0">
                    <span className="text-[13px] text-[#1B2536]">{a.t}</span>
                    <span
                      className="py-0.5 px-2.5 rounded-full text-[11px] font-semibold whitespace-nowrap"
                      style={{ background: a.bg, color: a.fg }}
                    >
                      {a.s}
                    </span>
                  </div>
                ))}
              </div>
              <div className="col-span-2 border border-[#E6E1D8] rounded-2xl p-4 flex gap-3.5">
                <span className="w-9 h-9 rounded-full bg-[#DCE6FC] text-[#284DB0] text-[12px] font-semibold flex items-center justify-center shrink-0">
                  SL
                </span>
                <div className="flex flex-col gap-1">
                  <span className="text-[12px] text-[#5F6778]">
                    <strong className="text-[#142240]">Sarah Lee</strong> · on your essay, draft 3
                  </span>
                  <span className="text-[14px] leading-[1.5] text-[#1B2536]">
                    Your thesis finally sounds like you. Keep paragraph 1; rewrite paragraph 2 around the lab, not the award.
                  </span>
                </div>
              </div>
              <div className="col-span-2 grid grid-cols-3 gap-3">
                {GOALS.map((g) => (
                  <div key={g.t} className="py-3.5 px-4 rounded-2xl bg-[#F8F5EF] flex flex-col gap-2">
                    <span className="text-[12px] text-[#4F5A6B]">{g.s}</span>
                    <strong className="text-[14px] leading-[1.35] text-[#142240]">{g.t}</strong>
                    <div className="h-[5px] rounded-full bg-[#EBE6DD]">
                      <div className="h-[5px] rounded-full" style={{ width: g.w, background: g.c }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {role === "parent" && (
            <div className="flex-grow p-5 flex flex-col gap-4">
              <div className="grid grid-cols-3 gap-3">
                {REPORT_STATS.map((r) => (
                  <div key={r.k} className="p-4 rounded-2xl bg-[#F8F5EF] flex flex-col gap-1">
                    <span className="text-[12px] text-[#4F5A6B]">{r.k}</span>
                    <span className="font-[family-name:var(--font-bricolage)] text-[30px] font-bold text-[#142240]">{r.v}</span>
                    <span className="text-[12px] text-[#5F6778]">{r.m}</span>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-[1.2fr_1fr] gap-4">
                <div className="border border-[#E6E1D8] rounded-2xl p-4 flex flex-col gap-3.5">
                  <strong className="text-[14px] text-[#142240]">This month by subject</strong>
                  {SUBJECT_BARS.map((b) => (
                    <div key={b.t} className="flex flex-col gap-1.5">
                      <div className="flex justify-between text-[13px]">
                        <span className="text-[#1B2536] font-medium">{b.t}</span>
                        <span className="text-[#4F5A6B]">{b.m}</span>
                      </div>
                      <div className="h-2 rounded-full bg-[#F1EDE6] relative">
                        <div className="absolute left-0 h-2 rounded-full bg-[#C8DDD5]" style={{ width: b.prev }} />
                        <div
                          className="absolute h-2 rounded-r-full bg-[#5E8C7E]"
                          style={{ left: b.prev, width: b.gain }}
                        />
                      </div>
                    </div>
                  ))}
                  <span className="text-[12px] text-[#4F5A6B]">Light = start of month · dark = gained since</span>
                </div>
                <div className="flex flex-col gap-3">
                  <div className="border border-[#E6E1D8] rounded-2xl p-4 flex flex-col gap-2">
                    <strong className="text-[14px] text-[#142240]">Schedule</strong>
                    {PARENT_CAL.map((c) => (
                      <div key={c.t} className="flex justify-between text-[13px]">
                        <span className="text-[#1B2536]">{c.t}</span>
                        <span className="text-[#5F6778]">{c.d}</span>
                      </div>
                    ))}
                  </div>
                  <button className="h-11 rounded-xl bg-[#142240] text-white font-semibold text-[14px]">
                    Request a parent meeting
                  </button>
                </div>
              </div>
              <div className="border border-[#E6E1D8] rounded-2xl p-4 flex gap-3.5">
                <span className="w-9 h-9 rounded-full bg-[#DCE6FC] text-[#284DB0] text-[12px] font-semibold flex items-center justify-center shrink-0">
                  MC
                </span>
                <div className="flex flex-col gap-1">
                  <span className="text-[12px] text-[#5F6778]">
                    <strong className="text-[#142240]">Ms. Choi</strong> · note for parents · Oct 14
                  </span>
                  <span className="text-[14px] leading-[1.5] text-[#1B2536]">
                    Jiwoo is confident with equilibrium basics now. At home, ask her to explain one problem out loud — it helps it stick.
                  </span>
                </div>
              </div>
            </div>
          )}

          {role === "tutor" && (
            <div className="flex-grow p-5 flex flex-col gap-4">
              <div className="grid grid-cols-3 gap-3">
                {TUTOR_TODAY.map((l) => (
                  <div key={l.who} className="py-3.5 px-4 rounded-2xl flex flex-col gap-1.5" style={{ border: `1px solid ${l.bd}`, background: l.bg }}>
                    <span className="font-mono text-[11px] text-[#5F6778]">{l.time}</span>
                    <strong className="text-[14px] text-[#142240]">{l.who}</strong>
                    <span className="text-[12px] text-[#4F5A6B]">{l.what}</span>
                    <span className="text-[12px] font-semibold" style={{ color: l.sc }}>
                      {l.status}
                    </span>
                  </div>
                ))}
              </div>
              <div className="border border-[#E6E1D8] rounded-2xl overflow-hidden">
                <div className="grid grid-cols-[1.2fr_1.5fr_0.9fr_0.8fr] gap-3 py-3 px-4.5 bg-[#F8F5EF] text-[12px] font-semibold text-[#4F5A6B]">
                  <span>Student</span>
                  <span>Current goal</span>
                  <span>Next lesson</span>
                  <span>Feedback</span>
                </div>
                {ROSTER.map((r) => (
                  <div
                    key={r.n}
                    className="grid grid-cols-[1.2fr_1.5fr_0.9fr_0.8fr] gap-3 py-3 px-4.5 border-t border-[#F1EDE6] items-center text-[13px]"
                  >
                    <span className="flex items-center gap-2.5">
                      <span className="w-7 h-7 rounded-full bg-[#E3EEEA] text-[#3F6B5E] text-[11px] font-semibold flex items-center justify-center">
                        {r.i}
                      </span>
                      <span className="font-semibold text-[#1B2536]">{r.n}</span>
                    </span>
                    <span className="text-[#1B2536]">{r.g}</span>
                    <span className="text-[#4F5A6B]">{r.x}</span>
                    <span
                      className="py-0.5 px-2.5 rounded-full text-[11px] font-semibold w-fit"
                      style={{ background: r.bg, color: r.fg }}
                    >
                      {r.f}
                    </span>
                  </div>
                ))}
              </div>
              <div className="border border-[#E6E1D8] rounded-2xl py-4 px-4.5 flex flex-col gap-2.5">
                <label htmlFor="fb" className="text-[13px] font-semibold text-[#142240]">
                  Feedback for Jiwoo · Lesson 12
                </label>
                <textarea
                  id="fb"
                  readOnly
                  className="h-14 resize-none py-2.5 px-3 border border-[#DDD7CC] rounded-xl text-[13px] text-[#1B2536] box-border"
                  defaultValue="Great work on Q1–Q3. Set next goal: pressure shifts (Q4–Q7)."
                />
              </div>
            </div>
          )}

          {role === "college" && (
            <div className="flex-grow p-5 flex flex-col gap-4">
              <div className="py-4 px-4.5 rounded-2xl bg-[#F8F5EF] flex gap-3 items-center">
                <Icon name="growth" stroke="#3F6B5E" size={20} />
                <span className="text-[14px] leading-[1.5] text-[#1B2536]">
                  Built from Jiwoo&apos;s lesson history: 2 years of coursework, writing samples and tutor notes.
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="border border-[#E6E1D8] rounded-2xl p-4 flex flex-col gap-1">
                  <div className="flex justify-between pb-1.5">
                    <strong className="text-[14px] text-[#142240]">College list</strong>
                    <span className="text-[12px] text-[#4F5A6B]">4 schools</span>
                  </div>
                  {COLLEGES.map((c) => (
                    <div key={c.n} className="flex justify-between items-center py-2 border-t border-[#F2EEE8] text-[13px]">
                      <span className="font-semibold text-[#1B2536]">{c.n}</span>
                      <span className="py-0.5 px-2.5 rounded-full text-[11px] font-semibold" style={{ background: c.bg, color: c.fg }}>
                        {c.f}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="border border-[#E6E1D8] rounded-2xl p-4 flex flex-col gap-3">
                  <strong className="text-[14px] text-[#142240]">Essays</strong>
                  {ESSAYS.map((e) => (
                    <div key={e.n} className="flex flex-col gap-1.5">
                      <div className="flex justify-between text-[13px]">
                        <span className="text-[#1B2536]">{e.n}</span>
                        <span className="text-[#5F6778] text-[12px]">{e.s}</span>
                      </div>
                      <div className="h-[5px] rounded-full bg-[#F1EDE6]">
                        <div className="h-[5px] rounded-full bg-[#5E8C7E]" style={{ width: e.w }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl p-4.5 bg-[#142240] flex justify-between items-center">
                <div className="flex flex-col gap-1">
                  <span className="font-mono text-[11px] tracking-[0.08em] text-[#97A9C8]">NEXT STRATEGY SESSION</span>
                  <strong className="text-[15px] text-white">Early round plan · Tue, Oct 21</strong>
                </div>
                <a href="#college" className="h-10 px-3.5 rounded-xl bg-white text-[#142240] text-[13px] font-semibold no-underline flex items-center">
                  Explore colleges
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
