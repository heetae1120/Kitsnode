import type { Metadata } from "next";
import { StoreShell } from "@/components/store/store-shell";
import "@/components/store/store-tokens.css";
import "@/components/store/store.css";
export const metadata: Metadata = { title: "스토어 점검 | KITSNODE", description: "스토어 현황과 광고 성과 분석 안내", robots: { index: false, follow: false } };
export default function StoreLayout({ children }: { children: React.ReactNode }) { return <StoreShell>{children}</StoreShell>; }
