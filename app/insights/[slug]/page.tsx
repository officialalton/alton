import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PortableText } from "@portabletext/react";
import { CtaButton, PageHero, Prose, PublicPage } from "@/app/components/public/PublicShell";
import { JsonLd, breadcrumbJsonLd } from "@/lib/seo/json-ld";
import { loadStaticPublicDest } from "@/lib/landing/public-dest";
import { getSubjectMeta } from "@/lib/landing/subjects";
import { getPostBySlug, getPublishedPosts, urlForImage } from "@/lib/insights/sanity";
import { OG_IMAGES, SITE_NAME, absoluteUrl } from "@/lib/site-url";

export const revalidate = 900;

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return (await getPublishedPosts()).map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) return {};
  const desc = post.excerpt ?? undefined;
  const cover = post.coverImage ? urlForImage(post.coverImage).width(1200).height(630).url() : undefined;
  return {
    title: `${post.title} — ALTON Insights`,
    description: desc,
    alternates: { canonical: `/insights/${post.slug}` },
    openGraph: { title: post.title, description: desc, type: "article", url: `/insights/${post.slug}`, publishedTime: post.publishedAt ?? undefined, images: cover ? [{ url: cover }] : OG_IMAGES },
    twitter: { card: "summary_large_image", title: post.title, description: desc, images: cover ? [cover] : OG_IMAGES },
  };
}

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }) : null);

export default async function InsightPostPage({ params }: Props) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) notFound();
  const dest = await loadStaticPublicDest();
  const path = `/insights/${post.slug}`;
  const related = (post.relatedSubjects ?? []).map((s) => getSubjectMeta(s)).filter((m): m is NonNullable<typeof m> => m !== null);
  const cover = post.coverImage ? urlForImage(post.coverImage).width(1600).height(900).url() : undefined;

  return (
    <PublicPage dest={dest}>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: post.title,
          description: post.excerpt ?? undefined,
          image: cover ? [cover] : undefined,
          datePublished: post.publishedAt ?? undefined,
          author: { "@type": "Organization", name: SITE_NAME },
          publisher: { "@type": "Organization", name: SITE_NAME },
          mainEntityOfPage: { "@type": "WebPage", "@id": absoluteUrl(path) },
        }}
      />
      <JsonLd data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Insights", path: "/insights" }, { name: post.title, path }])} />
      <PageHero eyebrow={fmt(post.publishedAt) ?? "INSIGHTS"} title={post.title} intro={post.excerpt ?? undefined} />
      <Prose>
        {cover && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt={post.coverImage?.alt ?? ""} width={1600} height={900} className="w-full h-auto mb-8" />
        )}
        {post.body && <PortableText value={post.body} />}
        {related.length > 0 && (
          <>
            <h2>Related practice tests</h2>
            <ul>{related.map((m) => <li key={m.slug}><Link href={`/practice-tests/${m.slug}`}>{m.name} practice tests</Link></li>)}</ul>
          </>
        )}
        <div className="flex flex-wrap gap-3 pt-4">
          <CtaButton href={dest.freeLearning} ctaName="free_learning" section="insights_post">Start free practice</CtaButton>
        </div>
      </Prose>
    </PublicPage>
  );
}
