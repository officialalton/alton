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
  title: "ALTON EDUCATION — Premium Online SAT & AP Tutoring",
  description:
    "Premium 1:1 online SAT and AP tutoring for students in the US and Korea aiming for top US universities. Dedicated tutors from Korea's top graduate programs, feedback after every lesson, and progress the whole family can see.",
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
