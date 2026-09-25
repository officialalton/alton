"use client";

import { trackEvent } from "@/lib/analytics/track";

// 제품 분석 P0(2026-09-25) — 랜딩 CTA 클릭 계측. app/page.tsx는 서버 컴포넌트라
// onClick을 직접 못 달아서 이 작은 클라이언트 컴포넌트로 감싼다.
export default function LandingCtaLink({
  href,
  ctaName,
  section,
  className,
  children,
}: {
  href: string;
  ctaName: string;
  section?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      className={className}
      onClick={() => trackEvent("landing_cta_clicked", { cta_name: ctaName, section })}
    >
      {children}
    </a>
  );
}
