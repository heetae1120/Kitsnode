import type { Metadata } from "next";
import Link from "next/link";
import { ToolsHeader } from "@/components/tools-header";
import { TallyEmbed } from "@/components/tally-embed";
import "../finance-bento.css";
import "../kits-pages.css";

const FORM_ID = "WODL2v";

export const metadata: Metadata = {
  title: "진단 설문 | KITSNODE",
  description:
    "스마트스토어의 현재 상황을 알려 주세요. 데이터부터 함께 보고 운영할 수 있는 브랜드의 기반을 진단합니다.",
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
            <p className="kp-small">
              설문이 보이지 않으면{" "}
              <a
                href={`https://tally.so/r/${FORM_ID}`}
                target="_blank"
                rel="noreferrer"
              >
                새 창에서 설문 열기
              </a>
              . 우리가 어떤 팀인지 먼저 보고 싶다면{" "}
              <Link href="/tools/about/">소개</Link>를 확인하세요.
            </p>
          </div>
          <div className="kp-form">
            <TallyEmbed formId={FORM_ID} title="KITSNODE 진단 설문" />
            <noscript>
              <p>
                <a href={`https://tally.so/r/${FORM_ID}`}>설문 열기</a>
              </p>
            </noscript>
          </div>
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
