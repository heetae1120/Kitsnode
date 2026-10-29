import type { Metadata } from "next";
import { BusinessIntake } from "@/components/business-intake";
export const metadata: Metadata = {
  title: "맞춤 비즈니스 진단 | KITS Tools",
  description:
    "스토어와 광고 경험에 맞춰 키워드 시장, 광고 수익성, 운영 리포트를 한눈에 확인하세요.",
};
export default function Page() {
  return <BusinessIntake />;
}
