"use client";

import type { ReactNode } from "react";

// 2026-09-19(UI 통일화) — Acely 레퍼런스 컨셉: 각 탭 페이지는
// "영어 제목(고정 위치) + 서브탭(있으면 제목 바로 아래) + 가운데 정렬
// 고정폭 본문"의 동일한 프레임 안에서 렌더링된다. 개별 탭 컴포넌트가
// 각자 제목·정렬을 만들지 않고 이 컴포넌트가 그 자리를 통일한다.
export default function PageFrame({
  title,
  description,
  subtabs,
  actions,
  children,
  maxWidthClassName = "max-w-5xl",
}: {
  title: string;
  description?: string;
  subtabs?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  /** 표·대시보드처럼 더 넓은 본문이 필요한 탭용 오버라이드. */
  maxWidthClassName?: string;
}) {
  return (
    <div className={`w-full ${maxWidthClassName} mx-auto px-5 md:px-8 py-6 md:py-8`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[20px] md:text-[22px] font-extrabold text-ink">{title}</h1>
          {description && <p className="mt-1 text-[13px] text-grey-500">{description}</p>}
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </div>
      {subtabs && <div className="mt-4">{subtabs}</div>}
      <div className="mt-6">{children}</div>
    </div>
  );
}
