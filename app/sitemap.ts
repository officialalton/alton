import type { MetadataRoute } from "next";
import { allSubjectSlugs } from "@/lib/landing/subjects";
import { getPublishedPosts } from "@/lib/insights/sanity";
import { SITE_URL } from "@/lib/site-url";

export const revalidate = 3600;

const PAGES = ["", "/about", "/practice-tests", "/learning-tools", "/premium-tutoring", "/contact", "/privacy", "/terms"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await getPublishedPosts();
  const entries: MetadataRoute.Sitemap = PAGES.map((p) => ({ url: `${SITE_URL}${p}`, changeFrequency: p === "" ? "weekly" : "monthly", priority: p === "" ? 1 : 0.7 }));
  for (const s of allSubjectSlugs()) entries.push({ url: `${SITE_URL}/practice-tests/${s}`, changeFrequency: "weekly", priority: 0.8 });
  if (posts.length > 0) {
    entries.push({ url: `${SITE_URL}/insights`, changeFrequency: "weekly", priority: 0.6 });
    for (const p of posts) entries.push({ url: `${SITE_URL}/insights/${p.slug}`, lastModified: p.publishedAt ?? undefined, changeFrequency: "monthly", priority: 0.6 });
  }
  return entries;
}
