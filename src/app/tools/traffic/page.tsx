import type { Metadata } from "next";
import { ToolWorkspace } from "@/components/tool-workspace";
export const metadata: Metadata = { title: "방문자 유입(키워드) | KITS Tools" };
export default function Page() {
  return <ToolWorkspace id="traffic" />;
}
