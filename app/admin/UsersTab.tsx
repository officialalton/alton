"use client";

import { useEffect, useState, type MouseEvent } from "react";
import {
  listParentsForUsersTabAction,
  listStudentsForUsersTabAction,
  listTeachersForUsersTabAction,
} from "./users-actions";
import { updateUserBasicInfo } from "./user-edit-actions";
import ArchivedHouseholdsList from "./ArchivedHouseholdsList";
import HouseholdArchiveControls from "./HouseholdArchiveControls";
import StudentDetailPanel from "./StudentDetailPanel";
import TeacherDetailPanel from "./TeacherDetailPanel";
import type { AdminSubject } from "./subject-data";
import type {
  CreditTransaction,
  ParentListItem,
  QcWarning,
  StudentListItem,
  TeacherListItem,
} from "./users-data";

// 2026-09-10(P1 — 관리자 "사용자" 탭 최초 진입 15~20초 개선) — 이전에는
// 기본 서브탭이 "학부모"인데도 admin/page.tsx가 학생·선생님 목록(가구 관계·
// 수강 과목·AP·비교과·Auth 이메일까지 포함한 무거운 조회)을 함께 SSR로
// 읽었다. 이제 학부모만 SSR로 즉시 표시하고, 학생/선생님은 그 서브탭을
// 실제로 열 때만 listStudentsForUsersTabAction()/listTeachersForUsersTabAction()
// 으로 조회한다(각각 인증 1회, 수업권 이력/QC 경고도 같은 액션에 묶임).

const SUBTABS = [
  { id: "parents", label: "학부모" },
  { id: "students", label: "학생" },
  { id: "teachers", label: "선생님" },
  // P4-1(B, 2026-09-11) — 아카이브된 가구는 위 목록에서 빠지고 여기서만 보인다.
  { id: "archived", label: "아카이브됨" },
] as const;
type SubtabId = (typeof SUBTABS)[number]["id"];

const STUDENT_STATUS_LABEL: Record<string, string> = {
  active: "활성",
  pending: "매칭 대기",
  suspended: "일시정지",
  inactive: "비활성(레거시)",
};
const TEACHER_STATUS_LABEL: Record<string, string> = {
  active: "활성",
  pending: "승인 대기",
  suspended: "일시정지",
};

export default function UsersTab({
  subjects,
}: {
  subjects: AdminSubject[];
}) {
  const [subtab, setSubtab] = useState<SubtabId>("parents");
  // 2026-09-11(제품 오너 지시) — 학부모/학생/선생님 탭 우측 상단 검색.
  // 이 화면들은 서브탭을 열 때 그 탭의 전체 목록을 한 번에 불러오고
  // 페이지네이션이 없으므로(위 loadStudentsForUsersTabAction 등 참고),
  // 이미 메모리에 있는 전체 목록에 클라이언트 필터만 적용해도 "해당 탭의
  // 전체 검색 대상"을 그대로 만족한다 — 검색을 위해 서버에 추가 조회를
  // 하거나 상세·커리큘럼을 미리 불러오지 않는다.
  const [searchQuery, setSearchQuery] = useState("");
  // 2026-09-10(P1 — 학부모 SSR 회귀 조사 후속) — 학부모도 학생/선생님과
  // 동일하게 null=아직 조회 안 됨(스켈레톤), 빈 배열=조회했는데 0명을
  // 구분한다. parentsErrorCode가 있으면 목록 영역에만 "불러오지 못했습니다 ·
  // 다시 시도"를 보여준다(페이지 전체는 절대 깨지지 않는다 — 액션이
  // {ok,data,errorCode} 계약이라 예외를 던지지 않음).
  const [parents, setParents] = useState<ParentListItem[] | null>(null);
  const [parentsErrorCode, setParentsErrorCode] = useState<string | null>(null);
  const [loadingParents, setLoadingParents] = useState(false);
  // 2026-09-10(P1) — null이면 "아직 이 서브탭을 연 적 없음"(스켈레톤 표시),
  // 빈 배열이면 "조회했는데 0명"을 구분한다.
  const [students, setStudents] = useState<StudentListItem[] | null>(null);
  const [teachers, setTeachers] = useState<TeacherListItem[] | null>(null);
  const [history, setHistory] = useState<Record<string, CreditTransaction[]>>({});
  const [qcWarningsByTeacher, setQcWarningsByTeacher] = useState<Record<string, QcWarning[]>>({});
  const [openStudentId, setOpenStudentId] = useState<string | null>(null);
  const [openTeacherId, setOpenTeacherId] = useState<string | null>(null);

  function loadParentsNow() {
    setLoadingParents(true);
    setParentsErrorCode(null);
    listParentsForUsersTabAction().then((result) => {
      setLoadingParents(false);
      if (result.ok) {
        setParents(result.data);
      } else {
        setParentsErrorCode(result.errorCode);
      }
    });
  }

  useEffect(() => {
    // 기본 서브탭이 학부모이므로 최초 마운트 시 바로 조회한다(학생/선생님은
    // 해당 서브탭을 열 때만).
    if (subtab === "parents" && parents === null && !loadingParents && !parentsErrorCode) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadParentsNow();
    }
    if (subtab === "students" && students === null) {
      listStudentsForUsersTabAction().then((r) => {
        setStudents(r.students);
        setHistory(r.creditHistoryByStudent);
      });
    }
    if (subtab === "teachers" && teachers === null) {
      listTeachersForUsersTabAction().then((r) => {
        setTeachers(r.teachers);
        setQcWarningsByTeacher(r.qcWarningsByTeacher);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtab]);

  const openStudent = students?.find((s) => s.id === openStudentId);
  const openTeacher = teachers?.find((t) => t.id === openTeacherId);

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredParents = !normalizedQuery
    ? parents
    : (parents ?? []).filter(
        (p) =>
          p.name.toLowerCase().includes(normalizedQuery) ||
          p.email.toLowerCase().includes(normalizedQuery)
      );
  const filteredStudents = !normalizedQuery
    ? students
    : (students ?? []).filter(
        (s) =>
          s.name.toLowerCase().includes(normalizedQuery) ||
          s.email.toLowerCase().includes(normalizedQuery) ||
          s.parentNames.some((n) => n.toLowerCase().includes(normalizedQuery))
      );
  const filteredTeachers = !normalizedQuery
    ? teachers
    : (teachers ?? []).filter(
        (t) =>
          t.name.toLowerCase().includes(normalizedQuery) ||
          t.email.toLowerCase().includes(normalizedQuery)
      );

  function patchStudent(id: string, patch: Partial<StudentListItem>, newTx?: CreditTransaction) {
    setStudents((prev) => prev?.map((s) => (s.id === id ? { ...s, ...patch } : s)) ?? prev);
    if (newTx) {
      setHistory((prev) => ({ ...prev, [id]: [newTx, ...(prev[id] ?? [])] }));
    }
  }

  function patchTeacher(id: string, patch: Partial<TeacherListItem>) {
    setTeachers((prev) => prev?.map((t) => (t.id === id ? { ...t, ...patch } : t)) ?? prev);
  }

  function patchParent(id: string, patch: Partial<ParentListItem>) {
    setParents((prev) => prev?.map((p) => (p.id === id ? { ...p, ...patch } : p)) ?? prev);
  }

  if (openStudent) {
    return (
      <StudentDetailPanel
        student={openStudent}
        history={history[openStudent.id] ?? []}
        subjects={subjects}
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
        subjects={subjects}
        onBack={() => setOpenTeacherId(null)}
        onUpdated={(patch) => patchTeacher(openTeacher.id, patch)}
      />
    );
  }

  return (
    <div className="max-w-[640px] px-8 py-8">
      <h1 className="text-[20px] font-extrabold text-ink mb-5">사용자</h1>

      <div className="flex items-center justify-between mb-5 border-b border-grey-200">
        <div className="flex gap-4">
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
        {(subtab === "parents" || subtab === "students" || subtab === "teachers") && (
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={subtab === "students" ? "이름·이메일·보호자 이름 검색" : "이름·이메일 검색"}
            className="text-[12.5px] border-[1.5px] border-grey-200 rounded-lg px-3 py-1.5 mb-2.5 w-[220px]"
          />
        )}
      </div>

      {subtab === "parents" && parents === null && !parentsErrorCode && (
        <div aria-busy="true" data-testid="parents-skeleton">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-2.5 animate-pulse"
            >
              <div className="flex items-center justify-between">
                <div className="h-3.5 w-24 bg-grey-200 rounded" />
                <div className="h-4 w-14 bg-grey-200 rounded-full" />
              </div>
              <div className="h-3 w-40 bg-grey-100 rounded mt-2" />
            </div>
          ))}
        </div>
      )}

      {subtab === "parents" && parentsErrorCode && (
        <div
          className="border-[1.5px] border-red/30 bg-red/5 rounded-xl px-5 py-4 mb-2.5 flex items-center justify-between"
          data-testid="parents-error"
        >
          <span className="text-[13px] text-red font-semibold">불러오지 못했습니다</span>
          <button
            onClick={loadParentsNow}
            disabled={loadingParents}
            className="text-[12px] font-bold px-3 py-1.5 rounded-lg border-[1.5px] border-red/30 text-red disabled:opacity-50"
          >
            {loadingParents ? "다시 시도 중..." : "다시 시도"}
          </button>
        </div>
      )}

      {subtab === "parents" && parents !== null && (
        <>
          {(filteredParents ?? []).length === 0 && normalizedQuery && (
            <p className="text-[12.5px] text-grey-500 mb-3">검색 결과가 없습니다.</p>
          )}
          {(filteredParents ?? []).map((p) => (
            <div
              key={p.id}
              className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-[13.5px] font-bold text-ink">{p.name}</div>
                  <div className="text-[12px] text-grey-500 mt-0.5">{p.email}</div>
                  <div className="text-[12px] text-grey-500 mt-0.5">
                    자녀: {p.childrenNames.length ? p.childrenNames.join(", ") : "없음"}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <UserEditToggle
                    profileId={p.id}
                    role="parent"
                    name={p.name}
                    email={p.email}
                    onUpdated={(patch) => patchParent(p.id, patch)}
                  />
                </div>
              </div>
              {p.householdId && (
                <HouseholdArchiveControls
                  householdId={p.householdId}
                  guardianName={p.name}
                  onArchived={loadParentsNow}
                />
              )}
            </div>
          ))}
        </>
      )}

      {subtab === "archived" && <ArchivedHouseholdsList />}

      {subtab === "students" && students === null && (
        <div aria-busy="true" data-testid="students-skeleton">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-2.5 animate-pulse"
            >
              <div className="flex items-center justify-between">
                <div className="h-3.5 w-24 bg-grey-200 rounded" />
                <div className="h-4 w-14 bg-grey-200 rounded-full" />
              </div>
              <div className="h-3 w-40 bg-grey-100 rounded mt-2" />
            </div>
          ))}
        </div>
      )}

      {subtab === "students" && students !== null && (
        <>
          {(filteredStudents ?? []).length === 0 && normalizedQuery && (
            <p className="text-[12.5px] text-grey-500 mb-3">검색 결과가 없습니다.</p>
          )}
          {(filteredStudents ?? []).map((s) => (
            <div key={s.id} className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-2.5">
              <button
                onClick={() => setOpenStudentId(s.id)}
                className="w-full text-left"
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
              <div className="mt-1.5">
                <UserEditToggle
                  profileId={s.id}
                  role="student"
                  name={s.name}
                  email={s.email}
                  grade={s.grade ?? ""}
                  onUpdated={(patch) => patchStudent(s.id, patch)}
                />
              </div>
            </div>
          ))}
        </>
      )}

      {subtab === "teachers" && teachers === null && (
        <div aria-busy="true" data-testid="teachers-skeleton">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-2.5 animate-pulse"
            >
              <div className="flex items-center justify-between">
                <div className="h-3.5 w-24 bg-grey-200 rounded" />
                <div className="h-4 w-14 bg-grey-200 rounded-full" />
              </div>
              <div className="h-3 w-40 bg-grey-100 rounded mt-2" />
            </div>
          ))}
        </div>
      )}

      {subtab === "teachers" && teachers !== null && (
        <>
          {(filteredTeachers ?? []).length === 0 && normalizedQuery && (
            <p className="text-[12.5px] text-grey-500 mb-3">검색 결과가 없습니다.</p>
          )}
          {(filteredTeachers ?? []).map((t) => (
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
          {/* (2026-08-30 R2 Task 4) 개인 이메일 기반 선생님 초대는 비활성화됐다 —
              선생님 계정은 Google Workspace 프로비저닝(Task 7) 절차로만 생성된다.
              서버 액션(inviteTeacher)도 호출 시 오류를 던지지만, 폼 자체를
              숨겨 관리자가 애초에 시도하지 않도록 한다. */}
          <div className="border-[1.5px] border-dashed border-grey-200 rounded-xl px-5 py-4 text-[12px] text-grey-500">
            선생님 초대는 현재 비활성화되어 있습니다. 선생님 계정은 Google Workspace 프로비저닝(관리자가 @alton.education
            계정을 발급한 뒤 최초 로그인으로 연결) 절차로만 생성할 수 있으며, 해당 기능은 준비 중입니다.
          </div>
        </>
      )}
    </div>
  );
}

// 2026-09-07(M4 UAT 후속) — "이메일 주소가 잘못됐어가 여러 이슈가 발생할 수
// 있는데 수기로 수정할 수 있는 구조는 있어야지"(제품 오너). 보호자/학생 카드에
// 이름·이메일(학생은 학년도)을 고칠 수 있는 최소 편집 폼을 붙인다.
function UserEditToggle({
  profileId,
  role,
  name,
  email,
  grade,
  onUpdated,
}: {
  profileId: string;
  role: "parent" | "student";
  name: string;
  email: string;
  grade?: string;
  onUpdated: (patch: { name: string; email: string; grade?: string | null }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [nameValue, setNameValue] = useState(name);
  const [emailValue, setEmailValue] = useState(email);
  const [gradeValue, setGradeValue] = useState(grade ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openForm(e: MouseEvent) {
    e.stopPropagation();
    setNameValue(name);
    setEmailValue(email);
    setGradeValue(grade ?? "");
    setError(null);
    setOpen(true);
  }

  async function handleSave(e: MouseEvent) {
    e.stopPropagation();
    setError(null);
    setSaving(true);
    try {
      const result = await updateUserBasicInfo({
        profileId,
        role,
        name: nameValue,
        email: emailValue,
        grade: role === "student" ? gradeValue : undefined,
      });
      onUpdated({ name: result.name, email: result.email, grade: result.grade });
      setOpen(false);
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : "수정에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={openForm}
        data-testid={`user-edit-open-${profileId}`}
        className="text-[11px] font-bold px-2.5 py-1 rounded-lg border-[1.5px] border-grey-200 text-ink"
      >
        수정
      </button>
    );
  }

  return (
    <div
      className="border-[1.5px] border-grey-200 rounded-lg px-3 py-2.5 mt-1.5 bg-grey-50"
      onClick={(e) => e.stopPropagation()}
    >
      <input
        value={nameValue}
        onChange={(e) => setNameValue(e.target.value)}
        placeholder="이름"
        className="w-full px-2.5 py-1.5 border-[1.5px] border-grey-200 rounded-lg text-[12px] mb-1.5"
      />
      <input
        value={emailValue}
        onChange={(e) => setEmailValue(e.target.value)}
        placeholder="이메일"
        type="email"
        data-testid={`user-edit-email-${profileId}`}
        className="w-full px-2.5 py-1.5 border-[1.5px] border-grey-200 rounded-lg text-[12px] mb-1.5"
      />
      {role === "student" && (
        <input
          value={gradeValue}
          onChange={(e) => setGradeValue(e.target.value)}
          placeholder="학년 (예: 10학년)"
          className="w-full px-2.5 py-1.5 border-[1.5px] border-grey-200 rounded-lg text-[12px] mb-1.5"
        />
      )}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={handleSave}
          data-testid={`user-edit-save-${profileId}`}
          className="text-[11.5px] font-bold px-3 py-1.5 rounded-lg bg-ink text-white disabled:opacity-50"
        >
          {saving ? "저장 중..." : "저장"}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={(e) => {
            e.stopPropagation();
            setOpen(false);
          }}
          className="text-[11.5px] font-semibold text-grey-500"
        >
          취소
        </button>
      </div>
      {error && <p className="text-[11.5px] text-red mt-1.5">{error}</p>}
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
