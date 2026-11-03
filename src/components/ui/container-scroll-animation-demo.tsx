"use client";
import { ContainerScroll } from "./container-scroll-animation";

export function HeroScrollDemo() {
  return <ContainerScroll titleComponent={<h1 className="text-4xl font-semibold">숫자로 보는<br />내 상품의 다음 한 걸음</h1>}>
    {/* Plain image also works with the project's static GitHub Pages export. */}
    <img src="https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1400&auto=format&fit=crop&q=80" alt="노트북으로 살펴보는 마케팅 분석 화면" width={1400} height={720} className="h-auto w-full object-cover" draggable={false} />
  </ContainerScroll>;
}
