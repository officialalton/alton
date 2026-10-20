export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://alton.education").replace(/\/$/, "");
export const SITE_NAME = "ALTON Education";
/** 페이지가 자체 openGraph를 지정하면 루트 opengraph-image 파일 규칙이 합쳐지지 않으므로 명시한다. */
export const OG_IMAGES = [{ url: "/opengraph-image", width: 1200, height: 630, alt: "ALTON — Free SAT & AP Practice Tests" }];
export const absoluteUrl = (path: string) => `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
