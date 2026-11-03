"use client";
import { useEffect, useRef } from "react";

declare global {
  interface Window {
    Tally?: { loadEmbeds: () => void };
  }
}

const SCRIPT = "https://tally.so/widgets/embed.js";

/** Tally form embed: Tally's script sizes the iframe to the form's height. */
export function TallyEmbed({ formId, title }: { formId: string; title: string }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const src = `https://tally.so/embed/${formId}?alignLeft=1&transparentBackground=1&dynamicHeight=1`;
  useEffect(() => {
    const fallback = () => {
      if (frame.current && !frame.current.src) frame.current.src = src;
    };
    const load = () => {
      if (window.Tally) window.Tally.loadEmbeds();
      else fallback();
    };
    if (window.Tally) {
      load();
      return;
    }
    let script = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT}"]`);
    if (!script) {
      script = document.createElement("script");
      script.src = SCRIPT;
      script.async = true;
      document.body.appendChild(script);
    }
    script.addEventListener("load", load);
    script.addEventListener("error", fallback);
    const timer = window.setTimeout(fallback, 4000);
    return () => {
      script?.removeEventListener("load", load);
      script?.removeEventListener("error", fallback);
      window.clearTimeout(timer);
    };
  }, [src]);
  return (
    <iframe
      ref={frame}
      data-tally-src={src}
      loading="lazy"
      width="100%"
      height="600"
      title={title}
    />
  );
}
