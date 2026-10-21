import type { MetadataRoute } from "next";
import { allSubjectSlugs } from "@/lib/landing/subjects";
import { getPublishedPosts } from "@/lib/insights/sanity";
import { getAllPublicTestPaths } from "@/lib/landing/test-pages";
import { SITE_URL } from "@/lib/site-url";

export const revalidate = 3600;

/** 공개 마케팅 콘텐츠를 마지막으로 의미 있게 고친 날. 내용을 바꿀 때 갱신한다(요청 시각을 쓰지 않는다 — 거짓 lastmod는 무시된다). */
export const CONTENT_LASTMOD = "2026-10-21";

const PAGES = ["", "/about", "/practice-tests", "/ap-practice-tests", "/sat-math-practice", "/sat-reading-and-writing-practice", "/learning-tools", "/premium-tutoring", "/contact", "/privacy", "/terms"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const slugs = allSubjectSlugs();
  const [posts, tests] = await Promise.all([getPublishedPosts(), getAllPublicTestPaths(slugs)]);
  const entries: MetadataRoute.Sitemap = PAGES.map((p) => ({ url: `${SITE_URL}${p}`, lastModified: CONTENT_LASTMOD, changeFrequency: p === "" ? "weekly" : "monthly", priority: p === "" ? 1 : 0.7 }));
  for (const s of slugs) entries.push({ url: `${SITE_URL}/practice-tests/${s}`, lastModified: CONTENT_LASTMOD, changeFrequency: "weekly", priority: 0.8 });
  for (const t of tests) entries.push({ url: `${SITE_URL}/practice-tests/${t.subject}/${t.test.slug}`, lastModified: CONTENT_LASTMOD, changeFrequency: "monthly", priority: 0.6 });
  if (posts.length > 0) {
    entries.push({ url: `${SITE_URL}/insights`, changeFrequency: "weekly", priority: 0.6 });
    for (const p of posts) entries.push({ url: `${SITE_URL}/insights/${p.slug}`, lastModified: p.publishedAt ?? undefined, changeFrequency: "monthly", priority: 0.6 });
  }
  return entries;
}
