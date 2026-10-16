import type { Metadata } from "next";
import LandingView from "./LandingView";
import { resolveLandingDestinations } from "@/lib/landing/cta";
import { loadLandingViewer } from "@/lib/landing/viewer";
import { getLandingAvailability } from "@/lib/landing/practice-test-count";

const TITLE = "ALTON — Free SAT Practice Tests, Learning Tools & Premium Tutoring";
const DESCRIPTION =
  "Practice with free SAT tests, understand your mistakes, and keep your review organized with a vocabulary builder and mistake notebook. Premium tutoring and educational consulting are available when you need more support.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { title: TITLE, description: DESCRIPTION, type: "website", siteName: "ALTON Education" },
  twitter: { card: "summary", title: TITLE, description: DESCRIPTION },
};

export default async function LandingPage() {
  const dest = resolveLandingDestinations(await loadLandingViewer());
  const availability = await getLandingAvailability();
  return <LandingView dest={dest} availability={availability} />;
}
