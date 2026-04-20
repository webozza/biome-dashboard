"use client";

import { X } from "lucide-react";
import { createPortal } from "react-dom";

interface DetailDrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  variant?: "drawer" | "modal";
  panelClassName?: string;
  bodyClassName?: string;
}

export function DetailDrawer({
  open,
  onClose,
  title,
  children,
  variant = "drawer",
  panelClassName = "",
  bodyClassName = "",
}: DetailDrawerProps) {
  if (!open || typeof document === "undefined") return null;

  const isModal = variant === "modal";

  return createPortal(
    <>
      <div
        onClick={onClose}
        className={`fixed inset-0 z-[70] ${isModal ? "bg-black/60 backdrop-blur-md" : "bg-black/15"}`}
      />
      <div
        className={
          isModal
            ? `fixed inset-0 z-[80] flex items-center justify-center p-4 md:p-8 pointer-events-none animate-fade-in ${panelClassName}`
            : `fixed right-0 top-0 h-full w-full max-w-xl z-[80] animate-slide-in-right shadow-[-24px_0_80px_rgba(187,247,208,0.08)] ${panelClassName}`
        }
      >
        <div
          className={
            isModal
              ? "w-full max-w-4xl max-h-[calc(100vh-2rem)] overflow-hidden rounded-[28px] border border-white/10 bg-[#070707]/95 shadow-2xl backdrop-blur-3xl pointer-events-auto"
              : "h-full w-full overflow-y-auto custom-scrollbar border-l border-[#d9eadd]/18 bg-[#070707]/95 shadow-[inset_1px_0_0_rgba(220,252,231,0.08)] backdrop-blur-3xl"
          }
        >
          <div className="sticky top-0 z-10 backdrop-blur-3xl px-8 py-6 flex items-center justify-between gap-4 bg-surface/40 border-b border-white/5">
            <div className="min-w-0 flex-1 space-y-1">
              <h2
                className="text-xl font-black tracking-tighter text-white uppercase italic truncate"
                title={title}
              >
                {title}
              </h2>
              <p className="text-[10px] font-black tracking-[0.3em] text-muted uppercase opacity-50 truncate">
                Identity Inspection Mode
              </p>
            </div>
            <button
              onClick={onClose}
              className="shrink-0 w-10 h-10 rounded-xl bg-white/5 border border-white/5 text-muted hover:bg-white/10 hover:text-white transition-all active:scale-90 flex items-center justify-center group"
            >
              <X className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
            </button>
          </div>
          <div
            className={`${isModal ? "max-h-[calc(100vh-9rem)] overflow-y-auto custom-scrollbar p-6 md:p-8" : "p-10"} ${bodyClassName}`}
          >
            {children}
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
