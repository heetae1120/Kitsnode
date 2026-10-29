import type { Metadata } from "next";
import { ToolWorkspace } from "@/components/tool-workspace";
export const metadata: Metadata = { title: "상품 순위 조회 | KITS Tools" };
export default function Page() {
  return <ToolWorkspace id="rankings" />;
}
