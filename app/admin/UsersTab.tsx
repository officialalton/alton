"use client";

import { useState } from "react";
import { inviteParent, inviteStudent, inviteTeacher } from "./users-actions";
import StudentDetailPanel from "./StudentDetailPanel";
import TeacherDetailPanel from "./TeacherDetailPanel";
import type {
  CreditTransaction,
  ParentListItem,
  QcWarning,
  StudentListItem,
  TeacherListItem,
} from "./users-data";

const SUBTABS = [
  { id: "parents", label: "학부모" },
  { id: "students", label: "학생" },
  { id: "teachers", label: "선생님" },
] as const;
type SubtabId = (typeof SUBTABS)[number]["id"];

const STUDENT_STATUS_LABEL: Record<string, string> = {
  active: "활성",
  pending: "매칭 대기",
  inactive: "비활성",
};
const TEACHER_STATUS_LABEL: Record<string, string> = {
  active: "활성",
  pending: "승인 대기",
};

export default function UsersTab({
  initialParents,
  initialStudents,
  initialTeachers,
  creditHistoryByStudent,
  qcWarningsByTeacher,
}: {
  initialParents: ParentListItem[];
  initialStudents: StudentListItem[];
  initialTeachers: TeacherListItem[];
  creditHistoryByStudent: Record<string, CreditTransaction[]>;
  qcWarningsByTeacher: Record<string, QcWarning[]>;
}) {
  const [subtab, setSubtab] = useState<SubtabId>("parents");
  const [parents, setParents] = useState(initialParents);
  const [students, setStudents] = useState(initialStudents);
  const [teachers, setTeachers] = useState(initialTeachers);
  const [history, setHistory] = useState(creditHistoryByStudent);
  const [openStudentId, setOpenStudentId] = useState<string | null>(null);
  const [openTeacherId, setOpenTeacherId] = useState<string | null>(null);

  const openStudent = students.find((s) => s.id === openStudentId);
  const openTeacher = teachers.find((t) => t.id === openTeacherId);

  function patchStudent(id: string, patch: Partial<StudentListItem>, newTx?: CreditTransaction) {
    setStudents((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    if (newTx) {
      setHistory((prev) => ({ ...prev, [id]: [newTx, ...(prev[id] ?? [])] }));
    }
  }

  function patchTeacher(id: string, patch: Partial<TeacherListItem>) {
    setTeachers((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
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

  if (openTeacher) {
    return (
      <TeacherDetailPanel
        teacher={openTeacher}
        warnings={qcWarningsByTeacher[openTeacher.id] ?? []}
        onBack={() => setOpenTeacherId(null)}
        onUpdated={(patch) => patchTeacher(openTeacher.id, patch)}
      />
    );
  }

  return (
    <div className="max-w-[640px] px-8 py-8">
      <h1 className="text-[20px] font-extrabold text-ink mb-5">사용자</h1>

      <div className="flex gap-4 mb-5 border-b border-grey-200">
        {SUBTABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setSubtab(t.id)}
            className={
              "text-[13.5px] font-semibold pb-2.5 -mb-px border-b-2 " +
              (subtab === t.id ? "text-ink border-ink" : "text-grey-500 border-transparent")
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {subtab === "parents" && (
        <>
          {parents.map((p) => (
            <div
              key={p.id}
              className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-2.5"
            >
              <div className="text-[13.5px] font-bold text-ink">{p.name}</div>
              <div className="text-[12px] text-grey-500 mt-0.5">{p.email}</div>
              <div className="text-[12px] text-grey-500 mt-0.5">
                자녀: {p.childrenNames.length ? p.childrenNames.join(", ") : "없음"}
              </div>
            </div>
          ))}
          <InviteForm
            fields={["name", "email"]}
            submitLabel="학부모 초대"
            onSubmit={async (values) => {
              await inviteParent({ name: values.name, email: values.email });
              setParents((prev) => [
                {
                  id: `pending-${Date.now()}`,
                  name: values.name,
                  email: values.email,
                  joinedAt: new Date().toISOString(),
                  childrenNames: [],
                },
                ...prev,
              ]);
            }}
          />
        </>
      )}

      {subtab === "students" && (
        <>
          {students.map((s) => (
            <button
              key={s.id}
              onClick={() => setOpenStudentId(s.id)}
              className="w-full text-left border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-2.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-[13.5px] font-bold text-ink">{s.name}</span>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-grey-100 text-ink">
                  {STUDENT_STATUS_LABEL[s.status] ?? s.status}
                </span>
              </div>
              <div className="text-[12px] text-grey-500 mt-0.5">
                {s.email} {s.grade ? `· ${s.grade}` : ""} · 수업권 {s.creditBalance}장
              </div>
            </button>
          ))}
          <InviteForm
            fields={["name", "email", "grade", "parentId"]}
            parents={parents}
            submitLabel="학생 초대"
            onSubmit={async (values) => {
              if (!values.parentId) throw new Error("학부모를 선택해주세요.");
              await inviteStudent({
                name: values.name,
                email: values.email,
                grade: values.grade,
                parentId: values.parentId,
              });
              const parent = parents.find((p) => p.id === values.parentId);
              setStudents((prev) => [
                {
                  id: `pending-${Date.now()}`,
                  name: values.name,
                  email: values.email,
                  grade: values.grade || null,
                  status: "pending",
                  creditBalance: 0,
                  parentNames: parent ? [parent.name] : [],
                  subjectNames: [],
                },
                ...prev,
              ]);
            }}
          />
        </>
      )}

      {subtab === "teachers" && (
        <>
          {teachers.map((t) => (
            <button
              key={t.id}
              onClick={() => setOpenTeacherId(t.id)}
              className="w-full text-left border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-2.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-[13.5px] font-bold text-ink">{t.name}</span>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-grey-100 text-ink">
                  {TEACHER_STATUS_LABEL[t.status] ?? t.status}
                </span>
              </div>
              <div className="text-[12px] text-grey-500 mt-0.5">
                {t.email} {t.school ? `· ${t.school}` : ""}
                {t.qcWarningCount > 0 ? ` · QC 경고 ${t.qcWarningCount}회` : ""}
              </div>
            </button>
          ))}
          <InviteForm
            fields={["name", "email", "school", "hourlyRate"]}
            submitLabel="선생님 초대"
            onSubmit={async (values) => {
              const hourlyRateKrw = Number(values.hourlyRate);
              if (!hourlyRateKrw || hourlyRateKrw <= 0) {
                throw new Error("시급을 입력해주세요.");
              }
              await inviteTeacher({
                name: values.name,
                email: values.email,
                school: values.school,
                hourlyRateKrw,
              });
              setTeachers((prev) => [
                {
                  id: `pending-${Date.now()}`,
                  name: values.name,
                  email: values.email,
                  school: values.school || null,
                  status: "pending",
                  qcWarningCount: 0,
                  subjectNames: [],
                  calendlySchedulingUrl: null,
                  hourlyRateKrw,
                },
                ...prev,
              ]);
            }}
          />
        </>
      )}
    </div>
  );
}

type FieldKey = "name" | "email" | "grade" | "school" | "parentId" | "hourlyRate";

function InviteForm({
  fields,
  parents,
  submitLabel,
  onSubmit,
}: {
  fields: FieldKey[];
  parents?: ParentListItem[];
  submitLabel: string;
  onSubmit: (values: Record<FieldKey, string>) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<FieldKey, string>>({
    name: "",
    email: "",
    grade: "",
    school: "",
    parentId: "",
    hourlyRate: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function set(field: FieldKey, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit(values);
      setDone(true);
      setValues({ name: "", email: "", grade: "", school: "", parentId: "", hourlyRate: "" });
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "초대에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <div>
        <button
          onClick={() => {
            setOpen(true);
            setDone(false);
          }}
          className="text-[12.5px] font-bold px-4 py-2.5 rounded-lg border-[1.5px] border-grey-200 text-ink w-full mt-2"
        >
          + 초대
        </button>
        {done && (
          <p className="text-[12px] text-green mt-2">
            ✓ 초대 이메일이 발송되었습니다.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mt-2">
      <div className="text-[13px] font-bold text-ink mb-3">{submitLabel}</div>
      {fields.includes("name") && (
        <input
          value={values.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="이름"
          className="w-full px-3 py-1.5 border-[1.5px] border-grey-200 rounded-lg text-[12.5px] mb-2"
        />
      )}
      {fields.includes("email") && (
        <input
          value={values.email}
          onChange={(e) => set("email", e.target.value)}
          placeholder="이메일"
          type="email"
          className="w-full px-3 py-1.5 border-[1.5px] border-grey-200 rounded-lg text-[12.5px] mb-2"
        />
      )}
      {fields.includes("grade") && (
        <input
          value={values.grade}
          onChange={(e) => set("grade", e.target.value)}
          placeholder="학년 (예: 10학년)"
          className="w-full px-3 py-1.5 border-[1.5px] border-grey-200 rounded-lg text-[12.5px] mb-2"
        />
      )}
      {fields.includes("school") && (
        <input
          value={values.school}
          onChange={(e) => set("school", e.target.value)}
          placeholder="학교 (선택)"
          className="w-full px-3 py-1.5 border-[1.5px] border-grey-200 rounded-lg text-[12.5px] mb-2"
        />
      )}
      {fields.includes("hourlyRate") && (
        <input
          value={values.hourlyRate}
          onChange={(e) => set("hourlyRate", e.target.value)}
          placeholder="시급 (원, 예: 30000)"
          type="number"
          min="1"
          className="w-full px-3 py-1.5 border-[1.5px] border-grey-200 rounded-lg text-[12.5px] mb-2"
        />
      )}
      {fields.includes("parentId") && (
        <select
          value={values.parentId}
          onChange={(e) => set("parentId", e.target.value)}
          className="w-full px-3 py-1.5 border-[1.5px] border-grey-200 rounded-lg text-[12.5px] mb-2"
        >
          <option value="">학부모 선택</option>
          {(parents ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.email})
            </option>
          ))}
        </select>
      )}
      <div className="flex gap-3 mt-1">
        <button
          disabled={submitting || !values.name.trim() || !values.email.trim()}
          onClick={handleSubmit}
          className="text-[12px] font-bold px-3.5 py-2 rounded-lg bg-ink text-white disabled:opacity-50"
        >
          {submitting ? "초대 중..." : "초대 보내기"}
        </button>
        <button onClick={() => setOpen(false)} className="text-[12px] font-semibold text-grey-500">
          취소
        </button>
      </div>
      {error && <p className="text-[12px] text-red mt-2">{error}</p>}
    </div>
  );
}
