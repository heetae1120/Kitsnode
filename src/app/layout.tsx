import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "킷츠노드 | 내 상품 광고 수익성 진단",
  description:
    "판매가와 원가로 살펴보는 네이버 검색광고 예상 수익성. 손익분기점과 광고 예산을 직접 시뮬레이션하세요.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
