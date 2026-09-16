import type { LibrarySubjectTree } from "@/lib/subject-material-library";

const KIND_BADGE: Record<string, string> = { pdf: "PDF", video: "영상" };

/**
 * 과목 → 단원 → 키워드 → 자료 목차(2026-09-15, 과목별 전체 교재 보기).
 * 학생·교사·보호자 포털이 공유한다 — 인터랙션은 네이티브 `<details>`뿐이라 서버 컴포넌트로 둔다.
 */
export default function MaterialLibraryTree({
  subjects,
  title,
  description,
  emptyMessage,
  docHref,
}: {
  subjects: LibrarySubjectTree[];
  title: string;
  description: string;
  emptyMessage: string;
  /** 자료 링크 — 보호자는 자녀를 쿼리로 붙여야 하므로 호출자가 만든다. */
  docHref: (docId: string) => string;
}) {
  return (
    <div className="max-w-[720px] px-8 py-8">
      <h1 className="text-[20px] font-extrabold text-ink mb-1.5">{title}</h1>
      <p className="text-[13px] text-grey-500 mb-5">{description}</p>

      {subjects.length === 0 ? (
        <div className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center">
          {emptyMessage}
        </div>
      ) : (
        subjects.map((subject) => (
          <div key={subject.subjectId} className="mb-7">
            <h2 className="text-[15px] font-extrabold text-ink mb-2.5">{subject.subjectName}</h2>
            {subject.units.map((unit) => (
              <details key={unit.unitId ?? "unassigned"} open className="mb-2" data-testid="material-unit-group">
                <summary className="cursor-pointer text-[13px] font-bold text-grey-500 px-2 py-1.5 rounded-lg hover:bg-grey-100">
                  {unit.unitTitle}
                </summary>
                <div className="pl-3 pt-1">
                  {unit.keywordGroups.map((kg) => (
                    <div key={kg.keywordId ?? "no-keyword"} className="mb-3">
                      <div className="text-[11px] font-bold text-grey-300 uppercase tracking-wide px-1 mb-1.5">
                        {kg.label}
                      </div>
                      {kg.docs.map((doc) => (
                        <a
                          key={doc.id}
                          href={docHref(doc.id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between border-[1.5px] border-grey-200 rounded-xl px-5 py-3.5 mb-2"
                        >
                          <span className="text-[13.5px] font-semibold text-ink flex items-center gap-1.5">
                            {KIND_BADGE[doc.kind] && (
                              <span className="text-[10.5px] font-bold text-grey-500 border border-grey-200 rounded-full px-1.5 py-0.5">
                                {KIND_BADGE[doc.kind]}
                              </span>
                            )}
                            📖 {doc.title}
                          </span>
                          <span className="text-[12px] font-semibold text-grey-500 whitespace-nowrap">
                            새 탭에서 열림 →
                          </span>
                        </a>
                      ))}
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </div>
        ))
      )}
    </div>
  );
}
