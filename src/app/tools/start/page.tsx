import type { Metadata } from "next";
import { AdHealthCheck } from "@/components/ad-health-check";
export const metadata: Metadata = {
  title: "광고 건강검진 | KITS Tools",
  description:
    "이익 확보와 재고 회전 목표에 맞춰 광고 수익성, 필요한 예산과 개선 우선순위를 확인하세요.",
};
export default function Page() {
  return <AdHealthCheck />;
}
