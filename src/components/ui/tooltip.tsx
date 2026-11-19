"use client";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { Info } from "lucide-react";
import { useRef, useState } from "react";
export function Help({ text, label }: { text: string; label: string }) {
  const [open, setOpen] = useState(false);
  const openBeforePointer = useRef(false);
  const pinned = useRef(false);
  return (
    <TooltipPrimitive.Provider delayDuration={150}>
      <TooltipPrimitive.Root open={open} onOpenChange={(value) => { if (!value) pinned.current = false; setOpen(value); }}>
        <TooltipPrimitive.Trigger asChild>
          <button
            type="button"
            aria-label={`${label} 설명`}
            aria-expanded={open}
            className="tool-help"
            onPointerDownCapture={() => { openBeforePointer.current = open; }}
            onPointerLeave={(event) => { if (pinned.current) event.preventDefault(); }}
            onClick={(event) => { event.preventDefault(); const next = event.detail === 0 ? true : !openBeforePointer.current; pinned.current = next; setOpen(next); }}
          >
            <Info size={13} />
          </button>
        </TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content sideOffset={6} className="tool-tooltip">
            {text}
            <TooltipPrimitive.Arrow className="fill-neutral-900" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
