"use client";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

/** Replay card entrance motion on navigation without intercepting links. */
export function ToolsMotion({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return <div key={pathname} className="tools-route-content">{children}</div>;
}
