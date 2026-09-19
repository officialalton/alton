"use client";

import { useEffect, useState } from "react";
import { loadStudentHomeworkBatchesAction } from "./homework-direct-client-data";
import type { HomeworkBatch } from "@/lib/homework-batch-data";
import HomeworkBatchPanel from "@/app/components/HomeworkBatchPanel";
import HomeworkIssueForm from "@/app/components/HomeworkIssueForm";
import UnderlineSubTabs from "@/app/components/UnderlineSubTabs";

export type HomeworkStudentOption = { id: string; name: string };

/** 2026-09-16(제품 오너 2차 정정) — 과제는 수업(세션)과 무관하다. 교사 포털 "과제" 탭은 학생·키워드를
 * 골라 즉시 발급("과제 생성")하고, "과제 내역"에서 배치를 눌러 그대로 채점한다. 발급마다 새 배치가
 * 생기고 이름은 발급 날짜로 자동으로 붙는다(예: "9월 16일 과제"). */
export default function HomeworkAssignTab({
  students, initialStudentId,
}: {
  students: HomeworkStudentOption[];
  initialStudentId?: string;
}) {
  const [subtab, setSubtab] = useState<"create" | "history">("create");
  const [studentId, setStudentId] = useState(initialStudentId ?? students[0]?.id ?? "");
  const [batches, setBatches] = useState<HomeworkBatch[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!studentId || subtab !== "history") return;
    setLoading(true);
    loadStudentHomeworkBatchesAction(studentId).then(setBatches).finally(() => setLoading(false));
  }, [studentId, subtab]);

  return (
    <div className="max-w-[720px]">
      <UnderlineSubTabs
        className="mb-5"
        items={[
          { id: "create", label: "과제 생성" },
          { id: "history", label: "과제 내역" },
        ]}
        activeId={subtab}
        onSelect={setSubtab}
      />

      <div className="flex flex-wrap gap-2 mb-5">
        {students.map((s) => (
          <button
            key={s.id}
            onClick={() => setStudentId(s.id)}
            className={"text-[12.5px] font-bold px-3 py-1.5 rounded-lg border-[1.5px] " + (s.id === studentId ? "border-ink bg-ink text-white" : "border-grey-200 text-ink")}
          >
            {s.name}
          </button>
        ))}
        {students.length === 0 && <p className="text-[13px] text-grey-500">담당 학생이 없습니다.</p>}
      </div>

      {!studentId ? null : subtab === "history" ? (
        loading ? <p className="text-[13px] text-grey-500">불러오는 중…</p> : <HomeworkBatchPanel batches={batches} viewerRole="teacher" />
      ) : (
        <HomeworkIssueForm studentId={studentId} />
      )}
    </div>
  );
}
