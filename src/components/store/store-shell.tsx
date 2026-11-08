"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, BarChart3, CircleHelp, LayoutDashboard, Package, PlugZap } from "lucide-react";
import { storeLinks } from "@/lib/store-navigation";
import type { ReactNode } from "react";

const icons = { overview: LayoutDashboard, ads: BarChart3, sales: Package };
export function StoreShell({ children }: { children: ReactNode }) {
  const pathname = usePathname().replace(/\/$/, "") || "/";
  return <div className="store-theme">
    <a className="store-skip" href="#store-main">본문으로 바로가기</a>
    <header className="store-topbar"><Link className="store-brand" href="/store/">KITSNODE <span>스토어 점검</span></Link><Link className="store-back" href="/tools/start/"><ArrowLeft size={16} aria-hidden="true" />무료 도구</Link></header>
    <div className="store-layout"><aside className="store-sidebar"><p className="store-nav-caption">내 스토어</p><nav aria-label="스토어 점검 메뉴">{storeLinks.map(item => {
      const active = item.id === "overview" ? pathname === "/store" : pathname === item.href.replace(/\/$/, "") || pathname.startsWith(item.href);
      const Icon = icons[item.id];
      return <Link key={item.id} href={item.href} aria-current={active ? "page" : undefined}><Icon size={19} aria-hidden="true" /><span>{item.label}</span></Link>;
    })}</nav><div className="store-sidebar-note"><CircleHelp size={18} aria-hidden="true" /><p>회원 기능 준비 중<br /><span>현재는 구성 안내와 합성 예시만 볼 수 있어요.</span></p></div><Link className="store-connect-link" href="/store/ads/connect/"><PlugZap size={17} aria-hidden="true" />광고 계정 연결 안내</Link></aside>
    <main id="store-main" className="store-main" tabIndex={-1}>{children}<footer className="store-footer">실제 회원 인증·광고 계정 연결은 아직 제공되지 않습니다. 개인 실적을 조회하거나 저장하지 않습니다.</footer></main></div>
  </div>;
}
