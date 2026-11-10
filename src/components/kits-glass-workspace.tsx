"use client";

import type { ReactNode } from "react";
import GlassWorkspace from "@/components/ui/adjustable-glass-dashboard";
import { warmPalette } from "@/components/ui/warm-glass-palette";

const glass = { blur: 22, opacity: 0.72, saturation: 1.05, edge: 0.6, tint: "#eadbc7" };

/** Shared presentation only: calculation and research state stay in their own tools. */
export function KitsGlassWorkspace({ children }: { children: ReactNode }) {
  return (
    <GlassWorkspace
      brand="KITSNODE"
      className="kits-glass"
      useHostTheme={false}
      theme="light"
      currency="KRW"
      style={warmPalette}
      glass={glass}
    >
      {children}
    </GlassWorkspace>
  );
}
