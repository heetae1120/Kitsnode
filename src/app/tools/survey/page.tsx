import type { Metadata } from "next";
import Link from "next/link";
import { ToolsHeader } from "@/components/tools-header";
import { StoreSurvey } from "@/components/store-survey";
import "../finance-bento.css";
import "../kits-pages.css";

export const metadata: Metadata = {
  title: "진단 설문 | KITSNODE",
  description:
    "스마트스토어의 현재 상황을 알려 주세요. 순위나 ROAS가 아니라, 운영할 수 있는 브랜드의 기반부터 함께 봅니다.",
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
              스토어의 현재 상황을 알려 주세요. 순위나 ROAS 한 줄이 아니라,
              운영할 수 있는 브랜드의 기반부터 함께 보겠습니다.
            </p>
            <ul>
              <li>질문 8개 이하, 대부분 고르기만 하면 됩니다</li>
              <li>정확한 숫자를 몰라도 구간으로 답할 수 있습니다</li>
              <li>마지막에 연락처를 남기면 접수됩니다</li>
            </ul>
            <p className="kp-small">
              우리가 어떤 팀인지 먼저 보고 싶다면{" "}
              <Link href="/tools/about/">소개</Link>를 확인하세요.
            </p>
          </div>
          <StoreSurvey />
        </div>
        <div className="kp-wrap">
          <footer className="kp-footer light">
            <strong>KITSNODE</strong>
            <span>운영할 수 있는 브랜드를 만듭니다</span>
          </footer>
        </div>
      </main>
    </div>
  );
}
