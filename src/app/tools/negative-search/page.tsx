import type { Metadata } from "next";
import { ToolWorkspace } from "@/components/tool-workspace";
export const metadata: Metadata = { title: "부정검색 체크 | KITS Tools" };
export default function Page() {
  return <ToolWorkspace id="negative-search" />;
}
