import type { Metadata } from "next";
import { Inter, Noto_Sans_KR } from "next/font/google";
import "./globals.css";
import AnalyticsScripts from "@/lib/analytics/AnalyticsScripts";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const notoSansKr = Noto_Sans_KR({
  variable: "--font-noto-sans-kr",
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
});

export const metadata: Metadata = {
  title: "ALTON — Free SAT Practice Tests, Learning Tools & Premium Tutoring",
  description:
    "Practice with free SAT tests, understand your mistakes, and keep your review organized. Premium tutoring and educational consulting are available when you need more support.",
  openGraph: {
    title: "ALTON — Free SAT Practice Tests, Learning Tools & Premium Tutoring",
    description:
      "Practice with free SAT tests, understand your mistakes, and keep your review organized. Premium tutoring and educational consulting are available when you need more support.",
    type: "website",
    siteName: "ALTON Education",
  },
  twitter: { card: "summary", title: "ALTON — Free SAT Practice Tests, Learning Tools & Premium Tutoring" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${notoSansKr.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <AnalyticsScripts />
      </body>
    </html>
  );
}
