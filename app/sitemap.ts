import type { MetadataRoute } from "next";

const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://alton.education").replace(/\/$/, "");
const PAGES = ["", "/about", "/practice-tests", "/learning-tools", "/premium-tutoring", "/contact", "/privacy", "/terms"];

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.map((p) => ({ url: `${SITE}${p}`, changeFrequency: p === "" ? "weekly" : "monthly", priority: p === "" ? 1 : 0.7 }));
}
