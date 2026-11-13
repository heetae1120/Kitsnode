import type { Metadata } from "next";
import { AgencyHome } from "@/components/agency/agency-home";
export const metadata: Metadata = {
  title: "kitsnode — Independent Creative Studio",
  description:
    "브랜드 전략과 크리에이티브, 퍼포먼스 마케팅을 연결하는 독립 크리에이티브 스튜디오.",
};
export default function Page() {
  return <AgencyHome />;
}
