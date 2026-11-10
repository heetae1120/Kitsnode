import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";

// Same component and visual contracts as the admin system, isolated from the editor.
export function StoreButton({ className = "", type = "button", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} type={type} className={"store-button " + className} />;
}
export function StoreBadge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "primary" | "warning" }) {
  return <span className={"store-badge store-badge--" + tone}>{children}</span>;
}
export function StoreCard({ className = "", ...props }: HTMLAttributes<HTMLElement>) {
  return <section {...props} className={"store-card " + className} />;
}
export function StoreHeading({ title, description }: { title: string; description: string }) {
  return <div className="store-heading" aria-description={description}><p className="store-eyebrow">KITSNODE / 스토어 점검</p><h1>{title}</h1></div>;
}
