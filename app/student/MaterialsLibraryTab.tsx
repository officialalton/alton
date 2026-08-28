import type { LibrarySubject } from "./materials-data";

export default function MaterialsLibraryTab({
  subjects,
}: {
  subjects: LibrarySubject[];
}) {
  return (
    <div className="max-w-[640px] px-8 py-8">
      <h1 className="text-[20px] font-extrabold text-ink mb-1.5">교재</h1>
      <p className="text-[13px] text-grey-500 mb-5">
        내가 듣고 있는 과목의 교재만 모아봅니다.
      </p>

      {subjects.length === 0 ? (
        <div className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center">
          열람할 수 있는 교재가 없습니다.
        </div>
      ) : (
        subjects.map((subject) => (
          <div key={subject.subjectId} className="mb-6">
            <h2 className="text-[14px] font-bold text-ink mb-2.5">
              {subject.subjectName}
            </h2>
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
                    <span className="text-grey-500 font-normal">
                      {" "}
                      · {doc.unitTitle}
                    </span>
                  )}
                </span>
                <span className="text-[12px] font-semibold text-grey-500">
                  새 탭에서 열림 →
                </span>
              </a>
            ))}
          </div>
        ))
      )}
    </div>
  );
}
