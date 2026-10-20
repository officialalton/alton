import type { MetadataRoute } from "next";

const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://alton.education").replace(/\/$/, "");

// 공개 마케팅·법적 페이지만 색인 허용. 로그인 이후 포털·API·인증 경로는 막는다.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/student", "/parent", "/teacher", "/consultant", "/api/", "/auth/", "/session", "/invite", "/set-password", "/reset-password", "/complete-profile"] }],
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
