"use client";

import { useRef, type ReactNode } from "react";
import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from "framer-motion";
import { cn } from "@/lib/utils";

export function ContainerScroll({ titleComponent, children, className }: {
  titleComponent: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: containerRef, offset: ["start end", "center center"] });
  const rotate = useTransform(scrollYProgress, [0, 1], [reduced ? 0 : 12, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [reduced ? 1 : 0.96, 1]);
  const translate = useTransform(scrollYProgress, [0, 1], [0, reduced ? 0 : -24]);
  return <div ref={containerRef} className={cn("relative w-full py-8 md:py-16", className)}>
    <div style={{ perspective: "1000px" }}>
      <Header translate={translate} titleComponent={titleComponent} />
      <Card rotate={rotate} scale={scale}>{children}</Card>
    </div>
  </div>;
}

export function Header({ translate, titleComponent }: { translate: MotionValue<number>; titleComponent: ReactNode }) {
  return <motion.div style={{ translateY: translate }} className="mx-auto mb-10 max-w-3xl text-center">{titleComponent}</motion.div>;
}

export function Card({ rotate, scale, children }: { rotate: MotionValue<number>; scale: MotionValue<number>; children: ReactNode }) {
  return <motion.div style={{ rotateX: rotate, scale }} className="mp-scroll-card mx-auto w-full max-w-5xl rounded-[28px] border-4 border-slate-700 bg-slate-800 p-2 shadow-2xl md:p-4">
    <div className="overflow-hidden rounded-[18px] bg-white">{children}</div>
  </motion.div>;
}
