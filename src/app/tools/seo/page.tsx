import type { Metadata } from "next";
import { ToolWorkspace } from "@/components/tool-workspace";
export const metadata: Metadata = { title: "SEO 분석 | KITS Tools" };
export default function Page() {
  return <ToolWorkspace id="seo" />;
}
