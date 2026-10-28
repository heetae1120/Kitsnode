import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
const pretendard = localFont({
  src: "./fonts/PretendardVariable.woff2",
  variable: "--font-pretendard",
  display: "swap",
  weight: "100 900",
});
export const metadata: Metadata = {
  title: "KITS — Sensible Everyday Kits",
  description:
    "시대의 유산부터 동시대의 트렌드, 내일의 감각까지. 삶과 브랜드의 순간을 완성하는 오브제 큐레이션 & 크리에이티브 랩, KITS.",
  openGraph: {
    title: "KITS — Sensible Everyday Kits",
    description:
      "어제의 가치를 잇고, 오늘의 트렌드를 담으며, 내일의 감각을 제안합니다.",
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
      <body>{children}</body>
    </html>
  );
}
