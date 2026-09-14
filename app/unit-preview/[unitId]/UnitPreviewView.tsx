"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import LearningText from "@/app/session/[id]/LearningText";
import type { UnitPreview } from "@/app/student/curriculum-overlay-actions";

// 학생·보호자의 회차별 '수업 준비' — 예약이 없어도 회차 기준으로 열린다.
//
// 2026-09-14 제품 오너: "커리큘럼 > 회차에 들어갔을 때 예정 수업과 동일한 '수업 준비'
// 버튼이 나와야 하고 회차별로 진입이 가능해야 한다. 리스트만 있는 것은 학생 입장에서
// 가치가 없다."
//
// 수업 화면(/session/[id])과 같은 뼈대(교재 · 문제 탭)를 쓰되, 여기서는 **읽기만**
// 한다. 답을 고르거나 제출하지 않고, 필기도 남기지 않는다 — 그런 일은 실제 수업에서
// 한다. 정답·해설·지도 노트는 서버 응답(unit_preview_for_viewer)에 아예 담기지
// 않으므로 화면이 가리는 것이 아니다.

type Tab = "material" | "problems";

export default function UnitPreviewView({
  preview,
  subjectName,
  studentName,
  backHref,
  initialTab,
}: {
  preview: UnitPreview;
  subjectName: string | null;
  /** 보호자가 볼 때 누구의 회차인지. 학생 본인이면 null. */
  studentName: string | null;
  backHref: string;
  initialTab?: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(initialTab === "problems" ? "problems" : "material");

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b-[1.5px] border-grey-200 px-5 sm:px-8 py-4">
        <div className="max-w-[960px] mx-auto flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={() => router.push(backHref)}
            className="text-[13px] font-semibold text-grey-500"
          >
            ← 뒤로
          </button>
          <nav className="flex gap-1.5" aria-label="탭">
            <TabButton active={tab === "material"} onClick={() => setTab("material")}>
              교재
            </TabButton>
            <TabButton active={tab === "problems"} onClick={() => setTab("problems")}>
              문제
            </TabButton>
          </nav>
        </div>
      </header>

      <section className="border-b-[1.5px] border-grey-200 px-5 sm:px-8 py-5">
        <div className="max-w-[960px] mx-auto">
          <p className="text-[12.5px] text-grey-500 mb-1">
            {[studentName ? `${studentName} 학생` : null, subjectName].filter(Boolean).join(" · ")}
          </p>
          <div className="flex flex-wrap items-center gap-3 mb-1.5">
            <h1 className="text-[22px] font-extrabold text-ink">{preview.unitTitle}</h1>
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-grey-100 text-grey-500">
              {preview.frozen ? "수업함" : "수업 전"}
            </span>
          </div>
          <p className="text-[13.5px] text-ink">
            {preview.goal ? preview.goal : "이 회차의 목표가 아직 적히지 않았습니다."}
          </p>
          <p className="text-[12px] text-grey-500 mt-2">
            {preview.frozen
              ? "이 회차는 이미 수업에서 다뤘습니다. 그때 쓴 내용을 그대로 보여줍니다."
              : "수업 전까지 자료가 변경될 수 있습니다. 정답과 해설은 수업에서 확인합니다."}
          </p>
          {preview.sessionId && (
            <button
              onClick={() => router.push(`/session/${preview.sessionId}`)}
              className="text-[12.5px] font-bold text-blue mt-2"
            >
              {preview.frozen ? "수업 기록 →" : "예약된 수업 →"}
            </button>
          )}
        </div>
      </section>

      {tab === "material" ? (
        <MaterialList materials={preview.materials} />
      ) : (
        <ProblemList problems={preview.problems} />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={
        "text-[13px] font-bold px-3.5 py-1.5 rounded-full " +
        (active ? "bg-ink text-white" : "text-grey-500")
      }
    >
      {children}
    </button>
  );
}

function MaterialList({ materials }: { materials: UnitPreview["materials"] }) {
  if (materials.length === 0) {
    return (
      <div className="max-w-[760px] mx-auto px-6 py-12 text-center">
        <p className="text-[14px] font-bold text-ink mb-1">아직 준비된 교재가 없습니다</p>
        <p className="text-[12.5px] text-grey-500">선생님이 담으면 여기에 나타납니다.</p>
      </div>
    );
  }
  return (
    <div className="max-w-[760px] mx-auto px-5 sm:px-8 py-7">
      {materials.map((m) => (
        <article key={m.curriculumDocId} className="mb-10">
          <h2 className="text-[18px] font-extrabold text-ink mb-4">{m.title}</h2>
          {m.sections.length === 0 ? (
            <p className="text-[13px] text-grey-500">내용이 없는 교재입니다.</p>
          ) : (
            m.sections.map((s) => (
              <section key={s.id} className="mb-6">
                {s.title && <h3 className="text-[14.5px] font-bold text-ink mb-2">{s.title}</h3>}
                <LearningText
                  text={s.body}
                  className="learning-body text-[15px] sm:text-[16px] leading-[1.8] text-ink"
                />
              </section>
            ))
          )}
        </article>
      ))}
    </div>
  );
}

function ProblemList({ problems }: { problems: UnitPreview["problems"] }) {
  if (problems.length === 0) {
    return (
      <div className="max-w-[760px] mx-auto px-6 py-12 text-center">
        <p className="text-[14px] font-bold text-ink mb-1">아직 준비된 문제가 없습니다</p>
        <p className="text-[12.5px] text-grey-500">선생님이 담으면 여기에 나타납니다.</p>
      </div>
    );
  }
  return (
    <div className="max-w-[760px] mx-auto px-5 sm:px-8 py-7">
      <p className="text-[12.5px] text-grey-500 mb-4">
        미리 읽어 볼 수 있습니다. 풀이와 제출은 수업에서 합니다.
      </p>
      {problems.map((p, index) => (
        <article
          key={p.problemId}
          className="border-[1.5px] border-grey-200 rounded-2xl px-5 sm:px-7 py-6 mb-5"
        >
          <header className="flex items-center gap-2 mb-4">
            <span className="text-[14px] font-extrabold text-ink">문제 {index + 1}</span>
            <span className="text-[10.5px] font-bold rounded-full px-2 py-0.5 bg-grey-100 text-grey-500">
              수업 전 미리보기
            </span>
          </header>
          {p.passage ? (
            <LearningText
              text={p.passage}
              className="learning-body text-[15px] sm:text-[16px] leading-[1.8] text-ink mb-5"
            />
          ) : (
            <p className="text-[13px] text-grey-500 mb-4">지문이 없는 문제입니다.</p>
          )}
          {p.options && p.options.length > 0 && (
            <ol>
              {p.options.map((opt, i) => (
                <li
                  key={i}
                  className="text-[14.5px] leading-[1.75] py-2 px-3.5 rounded-lg mb-1.5 text-ink"
                >
                  <span className="text-grey-500 mr-2">{i + 1}</span>
                  <LearningText text={opt} className="learning-body inline" />
                </li>
              ))}
            </ol>
          )}
        </article>
      ))}
    </div>
  );
}
