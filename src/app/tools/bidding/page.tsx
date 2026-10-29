import type { Metadata } from "next";
import { ToolWorkspace } from "@/components/tool-workspace";
export const metadata: Metadata = { title: "자동입찰 | KITS Tools" };
export default function Page() {
  return <ToolWorkspace id="bidding" />;
}
