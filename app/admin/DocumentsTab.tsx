"use client";

import { useState } from "react";
import ConsentGapPanel from "./ConsentGapPanel";

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
      <p className="text-[12.5px] text-grey-500 mb-4">
        계약·동의서·교사 제출 서류와 회사 문서를 모아 보는 곳입니다. 여기서는 조회와
        다운로드만 합니다.
      </p>

      <div className="flex flex-wrap gap-1 mb-5 border-b border-grey-200">
        {SUB_NAV.map((item) => (
          <button
            key={item.id}
            onClick={() => setSub(item.id)}
            aria-pressed={sub === item.id}
            className={
              "text-[12.5px] font-bold px-3 py-2 -mb-px border-b-2 " +
              (sub === item.id ? "border-ink text-ink" : "border-transparent text-grey-500")
            }
          >
            {item.label}
          </button>
        ))}
      </div>

      {sub === "consent" && <ConsentGapPanel />}

      {sub === "company" && (
        <p className="text-[13px] text-grey-500 py-6">
          회사 문서는 Google Drive의 전용 폴더를 읽어 보여줍니다. 아직 연결되지 않았습니다.
        </p>
      )}
      {sub === "contracts" && (
        <p className="text-[13px] text-grey-500 py-6">계약 아카이브는 준비 중입니다.</p>
      )}
      {sub === "teacher-docs" && (
        <p className="text-[13px] text-grey-500 py-6">교사 서류 보관함은 준비 중입니다.</p>
      )}
    </div>
  );
}
