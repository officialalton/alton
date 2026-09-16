import type { ParentChildLibrary } from "./materials-data";
import MaterialLibraryTree from "@/app/materials/MaterialLibraryTree";

// 2026-09-15 — 보호자 포털 "교재" 탭 최초 구현(과목별 전체 교재 보기). 자녀별로 구분해서 보여준다 —
// 문제의 정답·해설 노출 여부가 "그 자녀가 풀었는가"로 갈리므로, 링크에 자녀를 표시해 둔다.
export default function ParentMaterialsLibraryTab({ childLibraries }: { childLibraries: ParentChildLibrary[] }) {
  if (childLibraries.length === 0) {
    return (
      <div className="max-w-[720px] px-8 py-8">
        <h1 className="text-[20px] font-extrabold text-ink mb-1.5">교재</h1>
        <div className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center">
          아직 활성 자녀가 없어요.
        </div>
      </div>
    );
  }
  return (
    <div>
      {childLibraries.map((child) => (
        <div key={child.childId} className="border-b border-grey-100 last:border-b-0">
          <MaterialLibraryTree
            subjects={child.tree}
            title={`${child.childName} 학생 교재`}
            description="자녀가 듣고 있는 과목의 교재를 단원·키워드 순서로 모아봅니다. 문제 정답·해설은 그 자녀가 이미 푼 것만 보입니다."
            emptyMessage="아직 배정된 교재가 없어요."
            docHref={(docId) => `/materials/${docId}?childId=${child.childId}`}
          />
        </div>
      ))}
    </div>
  );
}
