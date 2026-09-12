import type { LibrarySubject } from "@/app/student/materials-data";

// 2026-09-09(UAT 지적, 제품 오너 승인) — 교사 포털 "교재" 탭 최초 구현. 학생
// 쪽 MaterialsLibraryTab.tsx와 동일한 구조(담당 과목의 공개된 교재만, 클릭 시
// 공용 뷰어 /materials/[id]로 이동)를 그대로 재사용한다.
export default function TeacherMaterialsLibraryTab({
  subjects,
}: {
  subjects: LibrarySubject[];
}) {
  return (
    <div className="max-w-[640px] px-8 py-8">
      <h1 className="text-[20px] font-extrabold text-ink mb-1.5">교재</h1>
      <p className="text-[13px] text-grey-500 mb-5">
        내가 담당하는 과목의 공개된 교재만 모아봅니다.
      </p>

      {subjects.length === 0 ? (
        <div className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center">
          아직 공개된 교재가 없어요. 관리자가 교재를 공개하면 여기 보여드릴게요.
        </div>
      ) : (
        subjects.map((subject) => (
          <div key={subject.subjectId} className="mb-6">
            <h2 className="text-[14px] font-bold text-ink mb-2.5">{subject.subjectName}</h2>
            {subject.docs.map((doc) => (
              <a
                key={doc.id}
                href={`/materials/${doc.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between border-[1.5px] border-grey-200 rounded-xl px-5 py-3.5 mb-2.5"
              >
                <span className="text-[13.5px] font-semibold text-ink">
                  📖 {doc.title}
                  {doc.unitTitle && (
                    <span className="text-grey-500 font-normal"> · {doc.unitTitle}</span>
                  )}
                </span>
                <span className="text-[12px] font-semibold text-grey-500">새 탭에서 열림 →</span>
              </a>
            ))}
          </div>
        ))
      )}
    </div>
  );
}
