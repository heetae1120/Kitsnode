import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import "./brand.css";
import "./dark-studio.css";
import { VisitorAnalytics } from "@/components/visitor-analytics";
import { DraftPreview } from "@/components/draft-preview";
import { StudioFooter } from "@/components/studio-footer";
import { PublishedLayout } from "@/components/published-layout";
const pretendard = localFont({
  src: "./fonts/PretendardVariable.woff2",
  variable: "--font-pretendard",
  display: "swap",
  weight: "100 900",
});
export const metadata: Metadata = {
  referrer: "no-referrer",
  title: "kitsnode — Independent Creative Studio",
  description:
    "브랜드 전략과 크리에이티브, 퍼포먼스 마케팅을 연결하는 독립 크리에이티브 스튜디오.",
  openGraph: {
    title: "kitsnode — Independent Creative Studio",
    description:
      "Independent creative thinking for brands that move forward.",
    type: "website",
    locale: "ko_KR",
  },
  robots: { index: true, follow: true },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" className={pretendard.variable} data-scroll-behavior="smooth">
      <body>{children}<StudioFooter /><PublishedLayout /><DraftPreview /><VisitorAnalytics /></body>
    </html>
  );
}
