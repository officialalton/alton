import type { Metadata } from "next";
import { OG_IMAGES } from "@/lib/site-url";
import LandingView from "./LandingView";
import { JsonLd, organizationJsonLd, websiteJsonLd } from "@/lib/seo/json-ld";
import { loadPublicDest } from "@/lib/landing/public-dest";
import { getLandingAvailability } from "@/lib/landing/practice-test-count";

const TITLE = "ALTON Education | Free SAT & AP Practice Tests";
const DESCRIPTION =
  "Practice with free SAT tests, understand your mistakes, and keep your review organized with a vocabulary builder and mistake notebook. Premium tutoring and educational consulting are available when you need more support.";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { images: OG_IMAGES, title: TITLE, description: DESCRIPTION, type: "website", siteName: "ALTON Education" },
  twitter: { card: "summary_large_image", images: OG_IMAGES, title: TITLE, description: DESCRIPTION },
};

export default async function LandingPage() {
  const dest = await loadPublicDest();
  const availability = await getLandingAvailability();
  return (
    <>
      <JsonLd data={organizationJsonLd()} />
      <JsonLd data={websiteJsonLd()} />
      <LandingView dest={dest} availability={availability} />
    </>
  );
}
