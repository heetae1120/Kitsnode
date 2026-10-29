import type { Metadata } from "next";
import { ToolsMotion } from "@/components/tools-motion";
import "./tools.css";
import "./tools-navigation.css";
export const metadata: Metadata = {
  title: "광고 수익성 진단 | KITS Tools",
  description:
    "판매가와 원가, CPC로 계산하는 광고 수익성. 예상 ROAS와 손익분기 ROAS, 개당 허용 클릭 수와 예산별 최소 판매량을 함께 확인하세요.",
};
export default function ToolsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="profit-tool">
      <ToolsMotion>{children}</ToolsMotion>
    </div>
  );
}
