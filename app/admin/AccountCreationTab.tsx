"use client";

// 2026-09-10(P1-B 신규 통합 보드 — 계정 생성 탭 이관) — 사용자 > 학부모
// 탭에 있던 "계정 생성"(구 "지인/추천 — 상담 없이 바로 계정 생성") 폼과
// 발송 내역 목록을 신규 > 계정 생성 탭으로 옮겼다. 보호자·자녀 생성,
// 생성 결과, 자녀별 계정 상태, 초대 발송 상태, 재발송을 여기 한 곳에서
// 처리·확인한다. 사용자 탭은 이제 이미 생성된 학부모·학생·선생님의
// 조회·관리만 담당한다. 컴포넌트 자체(DirectAccountCreationForm/
// DirectAccountLinksList)는 로직 변경 없이 그대로 옮겼다.

import { useRef } from "react";
import AddChildToGuardianForm from "./AddChildToGuardianForm";
import DirectAccountCreationForm from "./DirectAccountCreationForm";
import DirectAccountLinksList, { type DirectAccountLinksListHandle } from "./DirectAccountLinksList";

export default function AccountCreationTab() {
  const linksListRef = useRef<DirectAccountLinksListHandle>(null);

  return (
    <div className="max-w-[640px] px-8 py-8">
      <h1 className="text-[20px] font-extrabold text-ink mb-1.5">계정 생성</h1>
      <p className="text-[13px] text-grey-500 mb-5">
        상담 없이 계정을 바로 만듭니다. <b>부모 계정 생성</b>은 보호자와 자녀를 함께 새로
        만들고, <b>자녀 추가</b>는 이미 계정이 있는 주 보호자에게 자녀 1명을 더합니다. 발송·생성
        결과와 자녀별 계정 상태는 아래 발송 내역에서 확인·재발송할 수 있습니다.
      </p>
      <DirectAccountCreationForm onSent={() => linksListRef.current?.refresh()} />
      <AddChildToGuardianForm onSent={() => linksListRef.current?.refresh()} />
      <DirectAccountLinksList ref={linksListRef} />
    </div>
  );
}
