"use client";
import {
  createContext, useCallback, useContext, useEffect, useRef, useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";

type Phase = "idle" | "covering" | "revealing";
const MotionContext = createContext<(href: string) => boolean>(() => false);
export const useToolsMotion = () => useContext(MotionContext);

export function ToolsMotion({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const previousPath = useRef(pathname);
  const navigationTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (previousPath.current === pathname) return;
    previousPath.current = pathname;
    clearTimeout(navigationTimer.current);
    setPhase((current) => current === "idle" ? "idle" : "revealing");
  }, [pathname]);

  useEffect(() => {
    if (phase === "idle") return;
    // Always release the overlay, including when a destination cannot load.
    const timer = setTimeout(() => setPhase("idle"), phase === "revealing" ? 340 : 4000);
    return () => clearTimeout(timer);
  }, [phase]);

  useEffect(() => () => clearTimeout(navigationTimer.current), []);

  const navigate = useCallback((href: string) => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
    if (pathname.replace(/\/+$/, "").endsWith(href.replace(/\/+$/, ""))) return false;
    // A departing wave may already expose the next link: let that click start a new transition.
    if (phase === "covering") return true;
    setPhase("covering");
    clearTimeout(navigationTimer.current);
    navigationTimer.current = setTimeout(() => router.push(href), 240);
    return true;
  }, [pathname, phase, router]);

  return (
    <MotionContext.Provider value={navigate}>
      <div key={pathname} className="tools-route-content">{children}</div>
      {phase !== "idle" && (
        <div className={`tools-wave-transition ${phase}`} aria-hidden="true">
          <svg viewBox="0 0 1440 960" preserveAspectRatio="none" focusable="false">
            <path fill="#dbeafe" d="M0 140C300 20 510 230 820 125S1220 30 1440 140V960H0Z" />
            <path fill="#93b4f5" d="M0 200C320 80 550 280 850 185S1240 90 1440 200V960H0Z" />
            <path fill="#142543" d="M0 260C340 140 580 340 880 245S1260 150 1440 260V960H0Z" />
            <path className="tools-wave-line" d="M0 470C320 340 580 550 880 455S1260 360 1440 470" />
          </svg>
        </div>
      )}
    </MotionContext.Provider>
  );
}
