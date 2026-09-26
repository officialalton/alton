"use client";

import { useState } from "react";
import ConsentGapPanel from "./ConsentGapPanel";
import ContractArchivePanel from "./ContractArchivePanel";
import TeacherDocumentsPanel from "./TeacherDocumentsPanel";
import CompanyDocumentsPanel from "./CompanyDocumentsPanel";
import UnderlineSubTabs from "@/app/components/UnderlineSubTabs";

// P4-3 — 관리자 `문서` 탭. 회사 문서 / 계약 / 동의서 / 교사 서류 네 영역의
// 아카이브다. **조회·다운로드만 한다** — 계약 발송·재발송·무효화 같은 쓰기
// 동작의 진입점은 `신규 > 정규 계약 발송` 한 곳뿐이고, 교사 서류의 업로드
// 창구는 교사 포털 `정산` 탭 하나뿐이다.
//
// 서브탭 게이트가 서로 다르다(회사 문서만 별도 capability). 한 서브탭이 권한
// 부족으로 비어도 나머지는 정상 동작해야 하므로 탭 전체를 막지 않는다.
type SubTab = "company" | "contracts" | "consent" | "teacher-docs";

const SUB_NAV: { id: SubTab; label: string }[] = [
  { id: "company", label: "회사 문서" },
  { id: "contracts", label: "계약" },
  { id: "consent", label: "동의서" },
  { id: "teacher-docs", label: "교사 서류" },
];

// 기본 서브탭은 계약이다 — 회사 문서는 Drive 연결 전까지 빈 화면이고,
// 계약이 가장 자주 쓰이는 조회 대상이다.
const DEFAULT_SUB: SubTab = "contracts";

export default function DocumentsTab() {
  const [sub, setSub] = useState<SubTab>(DEFAULT_SUB);

  return (
    <div className="px-5 sm:px-8 py-6">
      <h2 className="text-[17px] font-extrabold text-ink mb-1">문서</h2>
      <p className="text-[12.5px] text-grey-500 mb-4">여기서는 조회와 다운로드만 합니다.</p>

      <UnderlineSubTabs className="mb-5" items={SUB_NAV} activeId={sub} onSelect={setSub} />

      {sub === "consent" && <ConsentGapPanel />}

      {sub === "company" && <CompanyDocumentsPanel />}
      {sub === "contracts" && <ContractArchivePanel />}
      {sub === "teacher-docs" && <TeacherDocumentsPanel />}
    </div>
  );
}
