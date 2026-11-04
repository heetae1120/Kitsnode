import type { Metadata } from "next";
import Link from "next/link";
import { ToolsHeader } from "@/components/tools-header";
import { StoreSurvey } from "@/components/store-survey";
import "../finance-bento.css";
import "../kits-pages.css";

export const metadata: Metadata = {
  title: "진단 설문 | KITSNODE",
  description:
    "스토어 상황을 알려주시면, 먼저 할 일을 함께 찾습니다.",
};

export default function SurveyPage() {
  return (
    <div className="kits-page finance-dashboard">
      <ToolsHeader active="survey" />
      <main className="kp-main">
        <div className="kp-wrap kp-survey">
          <div className="kp-survey-intro">
            <h1>진단 설문</h1>
            <p>
              스토어 상황을 알려주세요. 먼저 할 일을 함께 찾을게요.
            </p>
            <ul>
              <li>최대 8개 질문, 대부분 선택형이에요</li>
              <li>정확한 숫자를 몰라도 괜찮아요</li>
              <li>마지막에 연락처를 남겨주세요</li>
            </ul>
            <p className="kp-small">
              어떤 팀인지 궁금하다면{" "}
              <Link href="/tools/about/">소개</Link>를 확인하세요.
            </p>
          </div>
          <StoreSurvey />
        </div>
        <div className="kp-wrap">
          <footer className="kp-footer light">
            <strong>KITSNODE</strong>
            <span>고객이 다시 찾는 브랜드를 만듭니다</span>
          </footer>
        </div>
      </main>
    </div>
  );
}
