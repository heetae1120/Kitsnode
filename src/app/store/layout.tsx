import type { Metadata } from "next";
import { StoreShell } from "@/components/store/store-shell";
import { KitsGlassWorkspace } from "@/components/kits-glass-workspace";
import "@/components/store/store-tokens.css";
import "@/components/store/store.css";
import "../glass-theme.css";
export const metadata: Metadata = { title: "스토어 점검 | KITSNODE", description: "스토어 현황과 광고 성과 분석 안내", robots: { index: false, follow: false } };
export default function StoreLayout({ children }: { children: React.ReactNode }) { return <KitsGlassWorkspace><StoreShell>{children}</StoreShell></KitsGlassWorkspace>; }
