import { SITE_NAME, SITE_URL, absoluteUrl } from "@/lib/site-url";

/** 서버 컴포넌트용 JSON-LD. `<` 이스케이프로 스크립트 종료 주입을 막는다. */
export function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}

export const organizationJsonLd = () => ({
  "@context": "https://schema.org",
  "@type": "EducationalOrganization",
  "@id": absoluteUrl("/#organization"),
  name: "ALTON Education",
  alternateName: ["ALTON", "Alton Education LLC"],
  legalName: "Alton Education LLC",
  url: SITE_URL,
  logo: absoluteUrl("/apple-icon"),
  email: "official@alton.education",
  description: "Free SAT and AP practice tests, learning tools and premium online tutoring for students in the US and Korea.",
  address: { "@type": "PostalAddress", addressRegion: "CA", addressCountry: "US" },
  contactPoint: [{ "@type": "ContactPoint", contactType: "customer support", email: "official@alton.education", availableLanguage: ["English", "Korean"] }],
  // sameAs: 오너가 확인한 공식 프로필만(2026-10-21 Instagram). 다른 SNS는 개설·확인 후에만 추가한다.
  sameAs: ["https://www.instagram.com/alton_education/"],
});

export const websiteJsonLd = () => ({
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": absoluteUrl("/#website"),
  name: "ALTON Education",
  alternateName: ["ALTON", "alton.education"],
  url: SITE_URL,
  publisher: { "@id": absoluteUrl("/#organization") },
  inLanguage: "en-US",
});

export const breadcrumbJsonLd = (items: { name: string; path: string }[]) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: absoluteUrl(it.path) })),
});
