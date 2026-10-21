import type { Metadata } from "next";
import { OG_IMAGES } from "@/lib/site-url";
import Link from "next/link";
import { PageHero, Prose, PublicPage } from "@/app/components/public/PublicShell";
import { loadStaticPublicDest } from "@/lib/landing/public-dest";
import { getPublishedPosts, urlForImage } from "@/lib/insights/sanity";

export const revalidate = 900;

const DESCRIPTION = "Practical guidance on SAT and AP preparation from ALTON Education.";

export const metadata: Metadata = {
  title: "Insights | ALTON Education",
  description: DESCRIPTION,
  alternates: { canonical: "/insights" },
  openGraph: { images: OG_IMAGES, title: "Insights | ALTON Education", description: DESCRIPTION, type: "website", url: "/insights" },
};

const formatInsightDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }) : null;

export default async function InsightsPage() {
  const [dest, posts] = await Promise.all([loadStaticPublicDest(), getPublishedPosts()]);
  return (
    <PublicPage dest={dest}>
      <PageHero eyebrow="INSIGHTS" title="Insights" intro={DESCRIPTION} />
      <Prose>
        {posts.length === 0 ? (
          <div data-testid="insights-empty">
            <h2>Coming soon</h2>
            <p>We are preparing our first articles. In the meantime, you can take free SAT and AP practice tests.</p>
            <p><Link href="/practice-tests">Browse practice tests</Link></p>
          </div>
        ) : (
          <ul className="list-none p-0 flex flex-col gap-10">
            {posts.map((p) => (
              <li key={p._id}>
                <Link href={`/insights/${p.slug}`} className="no-underline">
                  {p.coverImage && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={urlForImage(p.coverImage).width(800).height(450).url()} alt={p.coverImage.alt ?? ""} width={800} height={450} loading="lazy" className="w-full h-auto mb-4" />
                  )}
                  {formatInsightDate(p.publishedAt) && <p className="text-[13px]">{formatInsightDate(p.publishedAt)}</p>}
                  <h2>{p.title}</h2>
                  {p.excerpt && <p>{p.excerpt}</p>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Prose>
    </PublicPage>
  );
}
