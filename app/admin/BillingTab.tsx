"use client";

import { useState } from "react";
import StudentDetailPanel from "./StudentDetailPanel";
import type { CreditTransaction, StudentListItem } from "./users-data";

const PACKAGES = [
  { name: "10장", creditCount: 10, priceUsd: 1200 },
  { name: "20장", creditCount: 20, priceUsd: 2400 },
  { name: "40장", creditCount: 40, priceUsd: 4800 },
];

export default function BillingTab({
  initialStudents,
  creditHistoryByStudent,
}: {
  initialStudents: StudentListItem[];
  creditHistoryByStudent: Record<string, CreditTransaction[]>;
}) {
  const [students, setStudents] = useState(initialStudents);
  const [history, setHistory] = useState(creditHistoryByStudent);
  const [openStudentId, setOpenStudentId] = useState<string | null>(null);

  const openStudent = students.find((s) => s.id === openStudentId);

  function patchStudent(id: string, patch: Partial<StudentListItem>, newTx?: CreditTransaction) {
    setStudents((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    if (newTx) {
      setHistory((prev) => ({ ...prev, [id]: [newTx, ...(prev[id] ?? [])] }));
    }
  }

  if (openStudent) {
    return (
      <StudentDetailPanel
        student={openStudent}
        history={history[openStudent.id] ?? []}
        onBack={() => setOpenStudentId(null)}
        onUpdated={(patch, newTx) => patchStudent(openStudent.id, patch, newTx)}
      />
    );
  }

  return (
    <div className="max-w-[640px] px-8 py-8">
      <h1 className="text-[20px] font-extrabold text-ink mb-5">수업권</h1>

      <div className="grid grid-cols-3 gap-3 mb-6">
        {PACKAGES.map((p) => (
          <div key={p.name} className="border-[1.5px] border-grey-200 rounded-xl px-4 py-3 text-center">
            <div className="text-[14px] font-extrabold text-ink">{p.name}</div>
            <div className="text-[12px] text-grey-500 mt-1">${p.priceUsd.toLocaleString()}</div>
          </div>
        ))}
      </div>

      <h2 className="text-[14px] font-bold text-ink mb-3">학생별 수업권 현황</h2>
      {students.map((s) => (
        <button
          key={s.id}
          onClick={() => setOpenStudentId(s.id)}
          className="w-full text-left border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-2.5 flex items-center justify-between"
        >
          <div>
            <div className="text-[13.5px] font-bold text-ink">{s.name}</div>
            <div className="text-[12px] text-grey-500 mt-0.5">{s.email}</div>
          </div>
          <div className="text-[14px] font-extrabold text-ink">{s.creditBalance}장</div>
        </button>
      ))}
    </div>
  );
}
