import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { VisitorAnalytics } from "@/components/visitor-analytics";
import { DraftPreview } from "@/components/draft-preview";
import { PublishedLayout } from "@/components/published-layout";
const pretendard = localFont({
  src: "./fonts/PretendardVariable.woff2",
  variable: "--font-pretendard",
  display: "swap",
  weight: "100 900",
});
export const metadata: Metadata = {
  referrer: "no-referrer",
  title: "KITSNODE — 셀러를 위한 수익성·키워드 분석",
  description:
    "상품 비용과 광고 예산을 계산하고 네이버 키워드를 비교하는 KITSNODE 도구입니다.",
  openGraph: {
    title: "KITSNODE — 셀러를 위한 수익성·키워드 분석",
    description:
      "판매 계획에 맞는 수익성 분석과 키워드 리서치를 시작하세요.",
    type: "website",
    locale: "ko_KR",
  },
  robots: { index: true, follow: true },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" className={pretendard.variable}>
      <body>{children}<PublishedLayout /><DraftPreview /><VisitorAnalytics /></body>
    </html>
  );
}
