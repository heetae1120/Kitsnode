import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { DiagnosisHeader } from "@/components/diagnosis-header";
import "../diagnosis-studio.css";
import "../selling-diagnosis.css";

export const metadata: Metadata = {
  title: "판매 진단 | 키츠노드",
  description: "판매가와 비용을 바탕으로 예상 이익과 재고 일정을 확인하세요.",
};

export default function Page() {
  return (
    <div className="finance-dashboard mp-shell diagnosis-studio selling-diagnosis">
      <DiagnosisHeader active="profit" />
      <main className="sd-landing">
        <div className="sd-landing-hero">
          <div>
            <p className="sd-kicker">상품 판매 진단</p>
            <h1>내 상품을 팔면<br />얼마가 남을까요?</h1>
            <p>판매가, 재고, 비용을 입력하면 예상 이익과 재발주 일정을 확인할 수 있어요.</p>
            <Link className="mp-primary" href="/tools/" data-layout-target="start-diagnosis-link">
              판매 진단 시작 <ArrowRight size={20} aria-hidden="true" />
            </Link>
          </div>
          <svg className="sd-landing-mark" viewBox="0 0 120 120" aria-hidden="true">
            <circle cx="60" cy="60" r="43" fill="none" stroke="currentColor" strokeWidth="17" strokeDasharray="43 24" />
            <circle cx="60" cy="60" r="10" fill="currentColor" />
          </svg>
        </div>
        <ol className="sd-landing-steps" aria-label="판매 진단 순서">
          <li><strong>판매 조건</strong><span>상품, 판매가, 재고, 예산</span></li>
          <li><strong>추가 비용</strong><span>수수료, 배송비, 포장비, 반품비, 제작비</span></li>
          <li><strong>진단 결과</strong><span>예상 이익, 재발주 일정, 판매 계획</span></li>
        </ol>
      </main>
    </div>
  );
}
