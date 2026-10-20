import { unstable_cache } from "next/cache";
import { createClient, type SanityClient } from "next-sanity";
import imageUrlBuilder from "@sanity/image-url";
import type { SanityImageSource } from "@sanity/image-url";
import type { PortableTextBlock } from "@portabletext/react";
import { projectId, dataset, apiVersion } from "../../sanity/env";

/**
 * Sanity가 /insights의 유일한 CMS. 토큰 없이 CDN으로 게시본만 읽는다(초안은 보이지 않음).
 * projectId 미설정이면 모든 조회는 빈 값 — 빈 상태 페이지가 안전하게 렌더된다.
 */
let cachedClient: SanityClient | null = null;
function getClient(): SanityClient {
  if (!cachedClient) cachedClient = createClient({ projectId, dataset, apiVersion, useCdn: true });
  return cachedClient;
}

export const insightsConfigured = () => Boolean(projectId);

export function urlForImage(source: SanityImageSource) {
  return imageUrlBuilder(getClient()).image(source);
}

export type Post = {
  _id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  coverImage: (SanityImageSource & { alt?: string }) | null;
  publishedAt: string | null;
  body?: PortableTextBlock[];
  relatedSubjects?: string[] | null;
};

/** 슬러그 형식 검증(소문자·숫자·하이픈). 이상한 값은 라우트·sitemap에서 제외한다. */
export const isValidInsightSlug = (s: unknown): s is string => typeof s === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s) && s.length <= 96;

const LIST = `{ _id, title, "slug": slug.current, excerpt, coverImage, publishedAt }`;

async function safe<T>(fallback: T, fn: () => Promise<T>): Promise<T> {
  if (!projectId) return fallback;
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

const cachedPosts = unstable_cache(
  () => safe<Post[]>([], async () => {
    const rows = await getClient().fetch<Post[]>(`*[_type == "post" && defined(slug.current) && defined(publishedAt)] | order(publishedAt desc) ${LIST}`);
    return rows.filter((p) => isValidInsightSlug(p.slug));
  }),
  ["insights-posts-v1"],
  { revalidate: 900 },
);

export async function getPublishedPosts(): Promise<Post[]> {
  if (!projectId) return []; // 미설정이면 캐시·네트워크 없이 빈 값
  return cachedPosts();
}

export async function hasPublishedInsights(): Promise<boolean> {
  return (await getPublishedPosts()).length > 0;
}

export async function getPostBySlug(slug: string): Promise<Post | null> {
  if (!isValidInsightSlug(slug)) return null;
  return safe<Post | null>(null, async () =>
    (await getClient().fetch<Post | null>(
      `*[_type == "post" && slug.current == $slug && defined(publishedAt)][0]{ _id, title, "slug": slug.current, excerpt, coverImage, publishedAt, body, relatedSubjects }`,
      { slug },
    )) ?? null,
  );
}
