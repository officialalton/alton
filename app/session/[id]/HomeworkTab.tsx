"use client";

import { useState } from "react";
import type { SessionViewViewer } from "@/lib/session-view";
import type { HomeworkItem } from "./homework-data";
import type { HomeworkBatch } from "@/lib/homework-batch-data";
import HomeworkBatchPanel from "@/app/components/HomeworkBatchPanel";
import HomeworkIssueForm from "@/app/components/HomeworkIssueForm";

// 2026-09-16(제품 오너 2차 정정) — 과제는 수업(세션)과 완전히 무관하다. 발급은 교사 포털 "과제"
// 탭 또는 세션뷰 과제 탭(둘 다 학생·키워드만 고른다, 세션 선택 없음 — 수업 준비 단계에서도
// 미리 낼 수 있다) 어디서나 할 수 있고, 세션뷰의 과제 탭은 이 학생의 과제 배치를 학생 포털·
// 교사 포털 "과제 내역"과 똑같은 화면(HomeworkBatchPanel)으로 그대로 보여준다.
// docs/2026-09-16-homework-direct-issue-plan.md 참고.

export default function HomeworkTab({
  initialItems,
  studentId,
  viewerRole,
  realViewerRole,
  homeworkBatches = [],
}: {
  /** 레거시 homework_items — 읽기 전용. */
  initialItems: HomeworkItem[];
  studentId: string;
  viewerRole: SessionViewViewer;
  /** 데모션되지 않은 실제 역할 — 교사/관리자는 채점 모드로 본다. */
  realViewerRole?: SessionViewViewer;
  homeworkBatches?: HomeworkBatch[];
}) {
  const asTeacher = realViewerRole === "teacher" || realViewerRole === "admin";
  const [showIssue, setShowIssue] = useState(false);

  return (
    <div className="max-w-[760px] mx-auto px-5 sm:px-8 py-6">
      {asTeacher && (
        <div className="mb-4">
          <button
            onClick={() => setShowIssue((v) => !v)}
            className={"text-[12.5px] font-bold px-3.5 py-2 rounded-lg border-[1.5px] " + (showIssue ? "border-ink bg-ink text-white" : "border-grey-200 text-ink")}
          >
            과제 생성
          </button>
          {showIssue && (
            <div className="mt-3">
              <HomeworkIssueForm studentId={studentId} onIssued={() => window.location.reload()} />
            </div>
          )}
        </div>
      )}
      <HomeworkBatchPanel batches={homeworkBatches} viewerRole={asTeacher ? "teacher" : "student"} />

      {initialItems.length > 0 && (
        <section className="mt-6 border-t border-grey-200 pt-6">
          <h2 className="text-[13px] font-bold text-ink mb-1">예전 과제 기록</h2>
          <p className="text-[12px] text-grey-500 mb-3">이전 방식으로 낸 과제입니다. 읽기만 합니다.</p>
          {initialItems.map((item) => (
            <div key={item.id} className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-3">
              <h3 className="text-[14px] font-bold text-ink mb-1">{item.title}</h3>
              {item.description && <p className="text-[13px] text-grey-500 leading-[1.6] mb-2">{item.description}</p>}
              <div className="text-[11px] font-bold text-grey-300 uppercase tracking-wide mt-2">학생 답안</div>
              <div className="text-[13px] text-ink whitespace-pre-wrap">{item.studentAnswer || "제출하지 않았습니다."}</div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
