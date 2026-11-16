"use client";
import { LiquidNavbar } from "@/components/ui/liquid-glass-navbar";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, BarChart3, CircleHelp, LayoutDashboard, Package, PlugZap } from "lucide-react";
import { storeLinks } from "@/lib/store-navigation";
import type { ReactNode } from "react";

const icons = { overview: LayoutDashboard, ads: BarChart3, sales: Package };
export function StoreShell({ children }: { children: ReactNode }) {
  const pathname = usePathname().replace(/\/$/, "") || "/";
  const selected = storeLinks.findIndex(item => item.id === "overview" ? pathname === "/store" : pathname === item.href.replace(/\/$/, "") || pathname.startsWith(item.href));
  if (pathname === "/store/login" || pathname === "/store/signup") return <div className="member-page">
    <a className="member-skip" href="#member-main">본문으로 바로가기</a>
    <header className="member-header"><Link className="member-brand" href="/tools/start/" aria-label="키츠노드 홈">kitsnode<span>®</span></Link><Link className="member-back" href="/tools/start/"><ArrowLeft size={16} aria-hidden="true"/>홈으로 돌아가기</Link></header>
    <main id="member-main" className="member-main" tabIndex={-1}><div className="member-intro"><span>YOUR NEXT STEP</span><h1>브랜드의 다음을<br/><em>함께 만듭니다.</em></h1><p>키츠노드 계정으로 로그인하고<br/>나에게 필요한 도구를 만나보세요.</p><div className="member-mark" aria-hidden="true" /></div><div className="member-panel">{children}</div></main>
  </div>;
  return <div className="store-theme">
    <a className="store-skip" href="#store-main">본문으로 바로가기</a>
    <header className="store-topbar"><Link className="store-brand" href="/store/">KITSNODE <span>스토어 점검</span></Link><Link className="store-back" href="/tools/start/"><ArrowLeft size={16} aria-hidden="true" />무료 도구</Link></header>
    <div className="store-layout"><aside className="store-sidebar"><p className="store-nav-caption">내 스토어</p><LiquidNavbar ariaLabel="스토어 점검 메뉴" motionKey="store" className="nimbus-store" compact={false} renderMode="css" active={selected} items={storeLinks.map(item=>({label:item.label,fx:"pop"}))}>{storeLinks.map(item => {
      const active = item.id === "overview" ? pathname === "/store" : pathname === item.href.replace(/\/$/, "") || pathname.startsWith(item.href);
      const Icon = icons[item.id];
      return <Link className="nimbus-item" key={item.id} href={item.href} aria-current={active ? "page" : undefined}><span className="nv-ico"><Icon size={19} aria-hidden="true" /></span><span>{item.label}</span></Link>;
    })}</LiquidNavbar><div className="store-sidebar-note"><CircleHelp size={18} aria-hidden="true" /><p>광고 계정 연결 준비 중<br /><span>광고 성과 연결과 개인 실적 조회는 아직 준비 중이에요.</span></p></div><Link className="store-connect-link" href="/store/ads/connect/"><PlugZap size={17} aria-hidden="true" />광고 계정 연결 안내</Link></aside>
    <main id="store-main" className="store-main" tabIndex={-1}>{children}<footer className="store-footer">광고 계정 연결과 개인 실적 조회는 준비 중입니다. 현재 개인 실적을 조회하거나 저장하지 않습니다.</footer></main></div>
  </div>;
}
