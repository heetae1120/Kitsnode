"use client";
import { LiquidNavbar } from "@/components/ui/liquid-glass-navbar";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, BarChart3, CircleHelp, LayoutDashboard, Package, PlugZap } from "lucide-react";
import { storeLinks } from "@/lib/store-navigation";
import type { ReactNode } from "react";
import { BrandWordmark } from "../brand-wordmark";
import { ToolsHeader } from "../tools-header";

const icons = { overview: LayoutDashboard, ads: BarChart3, sales: Package };
export function StoreShell({ children }: { children: ReactNode }) {
  const pathname = usePathname().replace(/\/$/, "") || "/";
  const selected = storeLinks.findIndex(item => item.id === "overview" ? pathname === "/store" : pathname === item.href.replace(/\/$/, "") || pathname.startsWith(item.href));
  if (pathname === "/store/login" || pathname === "/store/signup") return <div className="member-page">
    <a className="member-skip" href="#member-main">본문으로 바로가기</a>
    <header className="member-header"><Link className="member-brand" href="/tools/start/" aria-label="키츠노드 홈"><BrandWordmark/></Link><Link className="member-back" href="/tools/start/"><ArrowLeft size={16} aria-hidden="true"/>홈으로 돌아가기</Link></header>
    <main id="member-main" className="member-main" tabIndex={-1}><div className="member-intro"><span>YOUR NEXT STEP</span><h1>브랜드의 다음을<br/><em>함께 만듭니다.</em></h1><p>키츠노드 계정으로 로그인하고<br/>나에게 필요한 도구를 만나보세요.</p><div className="member-mark" aria-hidden="true" /></div><div className="member-panel">{children}</div></main>
  </div>;
  const adsHome=pathname==="/store/ads";
  return <div className={adsHome?"store-theme shared-ads-shell":"store-theme"}>{adsHome&&<ToolsHeader active="ads"/>}{children}</div>;
}
