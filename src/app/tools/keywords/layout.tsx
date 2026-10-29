import type { Metadata } from "next";
import "./keywords.css";
import "./research.css";
import "../finance-bento.css";
import "./keyword-bento.css";
export const metadata: Metadata = {
  title: "네이버 키워드 도구 | KITS Tools",
  description:
    "키워드별 최근 30일 PC·모바일 검색량과 연관 키워드를 비교하세요. 조회 결과 내 검색량 순위와 CSV 다운로드를 제공합니다.",
};
export default function KeywordsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="keyword-page finance-dashboard keyword-dashboard">
      {children}
    </div>
  );
}
