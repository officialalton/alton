"use client";

import { useState } from "react";
import { Icon, type IconName } from "./landing-icons";

// 랜딩 페이지 리디자인(2026-09-25) — "하나의 학습 기록, 네 가지 화면" 섹션.
// 학생/학부모/선생님/대학 진학 4개 탭을 눌러 같은 학습 기록이 역할마다 어떻게
// 보이는지 보여준다(목업의 role state 그대로).

type Role = "student" | "parent" | "tutor" | "college";

const ROLE_TABS: { id: Role; label: string }[] = [
  { id: "student", label: "학생" },
  { id: "parent", label: "학부모" },
  { id: "tutor", label: "선생님" },
  { id: "college", label: "대학 진학" },
];

const ROLE_META: Record<Role, { title: string; kr: string; panel: string; panelMeta: string; points: { icon: IconName; t: string; d: string }[] }> = {
  student: {
    title: "학생을 위한 화면",
    kr: "수업, 과제, 피드백, 목표",
    panel: "지우의 이번 주",
    panelMeta: "학생 화면",
    points: [
      { icon: "lesson", t: "나에게 맞는 수업", d: "내 속도에 맞춘 1:1 수업과 교재를 한 곳에서." },
      { icon: "homework", t: "목적이 있는 과제", d: "모든 과제는 이번 주 목표와 연결됩니다." },
      { icon: "feedback", t: "매 수업 후 피드백", d: "잘한 점과 다음에 할 것을 선생님이 구체적으로 남깁니다." },
      { icon: "goal", t: "눈에 보이는 목표", d: "매주 작은 목표가 모여 진짜 성장이 됩니다." },
    ],
  },
  parent: {
    title: "학부모를 위한 화면",
    kr: "학습 진행, 일정, 선생님 피드백",
    panel: "주간 학습 리포트 · 10/13~10/19",
    panelMeta: "학부모 화면",
    points: [
      { icon: "report", t: "읽기 쉬운 주간 리포트", d: "출석, 목표 달성, 다음 연습까지 — 한국어로 확인." },
      { icon: "cal", t: "하나로 모인 가족 일정", d: "모든 수업과 미팅을 한 캘린더에서." },
      { icon: "feedback", t: "추측이 아닌 선생님의 말", d: "중요한 수업 후에는 선생님이 직접 남긴 노트를 받습니다." },
      { icon: "match", t: "필요할 때 바로 미팅", d: "선생님과의 학부모 미팅을 한 번에 요청하세요." },
    ],
  },
  tutor: {
    title: "선생님을 위한 화면",
    kr: "수업 준비, 학생별 계획, 피드백",
    panel: "최 선생님 · 오늘",
    panelMeta: "선생님 화면 · 학생 9명",
    points: [
      { icon: "folder", t: "한 곳에서 끝내는 수업 준비", d: "수업 전에 노트, 자료, 지난주 피드백을 확인." },
      { icon: "goal", t: "학생마다 다른 계획", d: "학생별 현재 목표와 다음 수업, 진도를 한눈에." },
      { icon: "feedback", t: "2분이면 끝나는 피드백", d: "한 번 쓰면 학생과 가족 모두에게 전달됩니다." },
      { icon: "cal", t: "나의 수업 캘린더", d: "수업, 일정 변경, 가능 시간을 한 곳에서." },
    ],
  },
  college: {
    title: "대학 진학",
    kr: "대학 탐색, 에세이, 지원 전략",
    panel: "대학 진학 · 지우",
    panelMeta: "10~12학년 대상 애드온",
    points: [
      { icon: "explore", t: "대학 탐색", d: "합격 동향, 지원 규정, 비용까지 정리된 대학 프로필." },
      { icon: "essay", t: "담당 선생님과 함께 쓰는 에세이", d: "평소 수업에서 이어지는 초고와 피드백." },
      { icon: "goal", t: "지원 전략", d: "대학 어드바이저와 함께 세우는 균형 잡힌 지원 리스트와 일정." },
      { icon: "growth", t: "학습 기록을 바탕으로", d: "정형화된 템플릿이 아니라 학생의 학습 이력을 바탕으로 설계합니다." },
    ],
  },
};

const LESSONS = [
  { d: "화", n: "14", t: "AP Chemistry · 최 선생님", m: "오후 4:30 · 12분 후", bg: "#FCEBEB", live: true },
  { d: "목", n: "16", t: "에세이 작문 · 이 선생님", m: "오후 5:00", bg: "#F8F5EF", live: false },
  { d: "토", n: "18", t: "SAT Math · 박 선생님", m: "오전 10:00", bg: "#F8F5EF", live: false },
];
const HOMEWORK = [
  { t: "연습 문제 세트 7", s: "완료", bg: "#E3EEEA", fg: "#3F6B5E" },
  { t: "Q4–Q7 압력 변화", s: "진행 중", bg: "#FCEBEB", fg: "#8F0B20" },
  { t: "에세이 본문 2단락", s: "목요일 마감", bg: "#FBF0DF", fg: "#9A5B12" },
  { t: "SAT 세트 C", s: "토요일", bg: "#F1EDE6", fg: "#4F5A6B" },
];
const GOALS = [
  { s: "화학 · 이번 주", t: "임의의 평형 반응 균형 맞추기", w: "100%", c: "#5E8C7E" },
  { s: "작문 · 이번 주", t: "논지 확정하기", w: "100%", c: "#5E8C7E" },
  { s: "수학 · 이번 달", t: "세트 C 90점", w: "60%", c: "#C8102E" },
];
const REPORT_STATS = [
  { k: "출석한 수업", v: "3 / 3", m: "이번 주" },
  { k: "달성한 목표", v: "2", m: "3개 중" },
  { k: "과제", v: "4 / 5", m: "1개 목요일 마감" },
];
const SUBJECT_BARS = [
  { t: "화학", m: "7단원 중", prev: "52%", gain: "22%" },
  { t: "작문", m: "3차 초고", prev: "48%", gain: "18%" },
  { t: "SAT 수학", m: "세트 C", prev: "60%", gain: "8%" },
];
const PARENT_CAL = [
  { t: "화학", d: "화 오후 4:30" },
  { t: "에세이 작문", d: "목 오후 5:00" },
  { t: "SAT 수학", d: "토 오전 10:00" },
];
const TUTOR_TODAY = [
  { time: "오후 3:00", who: "이민서", what: "화학 · 5회차", status: "준비 완료", sc: "#3F6B5E", bd: "#E6E1D8", bg: "#FFFFFF" },
  { time: "오후 4:30", who: "김지우", what: "화학 · 12회차", status: "다음 수업", sc: "#C8102E", bd: "#F0C4C9", bg: "#FFFAFA" },
  { time: "오후 6:00", who: "박다니엘", what: "화학 · 8회차", status: "자료 추가 필요", sc: "#9A5B12", bd: "#E6E1D8", bg: "#FFFFFF" },
];
const ROSTER = [
  { i: "김지", n: "김지우", g: "압력 변화(Q4–Q7)", x: "오늘", f: "오늘 마감", bg: "#FCEBEB", fg: "#8F0B20" },
  { i: "이민", n: "이민서", g: "몰 계산 기초", x: "오늘", f: "전송됨", bg: "#E3EEEA", fg: "#3F6B5E" },
  { i: "박다", n: "박다니엘", g: "산과 염기 복습", x: "오늘", f: "전송됨", bg: "#E3EEEA", fg: "#3F6B5E" },
  { i: "윤서", n: "윤서연", g: "반응 속도론", x: "수요일", f: "작성 중", bg: "#F1EDE6", fg: "#4F5A6B" },
];
const COLLEGES = [
  { n: "프린스턴대학교", f: "도전", bg: "#F1F4F9", fg: "#283C62" },
  { n: "UCLA", f: "적정", bg: "#EEF3FE", fg: "#284DB0" },
  { n: "뉴욕대학교", f: "적정", bg: "#EEF3FE", fg: "#284DB0" },
  { n: "미시간대학교", f: "안정", bg: "#E3EEEA", fg: "#3F6B5E" },
];
const ESSAYS = [
  { n: "자기소개서", s: "3차 초고", w: "78%" },
  { n: "UC 인사이트", s: "4개 중 2개", w: "50%" },
  { n: "지원 동기(NYU)", s: "개요", w: "18%" },
];

export default function RolesPanel() {
  const [role, setRole] = useState<Role>("student");
  const meta = ROLE_META[role];

  return (
    <section id="roles" className="bg-[#F8F5EF] px-10 py-24 md:px-20">
      <div className="grid grid-cols-1 lg:grid-cols-[440px_minmax(0,1fr)] gap-16 items-start max-w-[1440px] mx-auto">
        <div className="flex flex-col gap-6">
          <span className="font-mono text-[12px] font-medium tracking-[0.08em] text-[#C8102E]">
            하나의 학습 기록, 네 가지 화면
          </span>
          <h2 className="m-0 font-[family-name:var(--font-bricolage)] font-semibold text-[42px] leading-[1.15] tracking-[-0.02em] text-[#142240]">
            학생을 위해 설계하고, 주변 모두에게 선명하게.
          </h2>
          <div role="tablist" aria-label="화면 선택" className="grid grid-cols-2 gap-1.5 p-1.5 bg-[#EBE6DD] rounded-2xl">
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
                <strong className="text-[14px] text-[#142240]">이번 주 수업</strong>
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
                <strong className="text-[14px] text-[#142240]">과제</strong>
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
                  이샘
                </span>
                <div className="flex flex-col gap-1">
                  <span className="text-[12px] text-[#5F6778]">
                    <strong className="text-[#142240]">이 선생님</strong> · 에세이 3차 초고에 대해
                  </span>
                  <span className="text-[14px] leading-[1.5] text-[#1B2536]">
                    이제 논지가 네 목소리처럼 들려. 1단락은 그대로 두고, 2단락은 상보다 실험 이야기 중심으로 다시 써보자.
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
                  <strong className="text-[14px] text-[#142240]">이번 달 과목별 진행</strong>
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
                  <span className="text-[12px] text-[#4F5A6B]">연한 색 = 월초 · 진한 색 = 이번 달 상승분</span>
                </div>
                <div className="flex flex-col gap-3">
                  <div className="border border-[#E6E1D8] rounded-2xl p-4 flex flex-col gap-2">
                    <strong className="text-[14px] text-[#142240]">일정</strong>
                    {PARENT_CAL.map((c) => (
                      <div key={c.t} className="flex justify-between text-[13px]">
                        <span className="text-[#1B2536]">{c.t}</span>
                        <span className="text-[#5F6778]">{c.d}</span>
                      </div>
                    ))}
                  </div>
                  <button className="h-11 rounded-xl bg-[#142240] text-white font-semibold text-[14px]">
                    학부모 미팅 요청하기
                  </button>
                </div>
              </div>
              <div className="border border-[#E6E1D8] rounded-2xl p-4 flex gap-3.5">
                <span className="w-9 h-9 rounded-full bg-[#DCE6FC] text-[#284DB0] text-[12px] font-semibold flex items-center justify-center shrink-0">
                  최샘
                </span>
                <div className="flex flex-col gap-1">
                  <span className="text-[12px] text-[#5F6778]">
                    <strong className="text-[#142240]">최 선생님</strong> · 학부모님께 드리는 노트 · 10/14
                  </span>
                  <span className="text-[14px] leading-[1.5] text-[#1B2536]">
                    지우가 평형 기초 개념에 자신감이 붙었습니다. 집에서는 문제 하나를 소리 내어 설명해보게 해주시면 도움이 됩니다.
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
                  <span>학생</span>
                  <span>현재 목표</span>
                  <span>다음 수업</span>
                  <span>피드백</span>
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
                  지우 피드백 · 12회차
                </label>
                <textarea
                  id="fb"
                  readOnly
                  className="h-14 resize-none py-2.5 px-3 border border-[#DDD7CC] rounded-xl text-[13px] text-[#1B2536] box-border"
                  defaultValue="Q1–Q3 잘했어요. 다음 목표는 압력 변화(Q4–Q7)로 설정합니다."
                />
              </div>
            </div>
          )}

          {role === "college" && (
            <div className="flex-grow p-5 flex flex-col gap-4">
              <div className="py-4 px-4.5 rounded-2xl bg-[#F8F5EF] flex gap-3 items-center">
                <Icon name="growth" stroke="#3F6B5E" size={20} />
                <span className="text-[14px] leading-[1.5] text-[#1B2536]">
                  지우의 수업 이력을 바탕으로 구성: 2년간의 수강 기록, 작문 샘플, 선생님 노트까지.
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="border border-[#E6E1D8] rounded-2xl p-4 flex flex-col gap-1">
                  <div className="flex justify-between pb-1.5">
                    <strong className="text-[14px] text-[#142240]">지원 대학 리스트</strong>
                    <span className="text-[12px] text-[#4F5A6B]">4개 학교</span>
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
                  <strong className="text-[14px] text-[#142240]">에세이</strong>
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
                  <span className="font-mono text-[11px] tracking-[0.08em] text-[#97A9C8]">다음 전략 미팅</span>
                  <strong className="text-[15px] text-white">얼리 라운드 전략 · 10/21 화요일</strong>
                </div>
                <a href="#college" className="h-10 px-3.5 rounded-xl bg-white text-[#142240] text-[13px] font-semibold no-underline flex items-center">
                  대학 탐색하기
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
