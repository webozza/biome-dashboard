"use client";

import { X } from "lucide-react";

interface DetailDrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function DetailDrawer({ open, onClose, title, children }: DetailDrawerProps) {
  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-md transition-opacity animate-in fade-in duration-500" onClick={onClose} />
      <div
        className="fixed right-0 top-0 h-full w-full max-w-xl z-50 overflow-y-auto detail-pane animate-slide-in-right custom-scrollbar"
      >
        <div
          className="sticky top-0 z-10 backdrop-blur-3xl px-8 py-6 flex items-center justify-between bg-surface/40 border-b border-white/5"
        >
          <div className="space-y-1">
            <h2 className="text-2xl font-black tracking-tighter text-white uppercase italic">
              {title}
            </h2>
            <p className="text-[10px] font-black tracking-[0.3em] text-muted uppercase opacity-50">Identity Inspection Mode</p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 text-muted hover:bg-white/10 hover:text-white transition-all active:scale-90 flex items-center justify-center group"
          >
            <X className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
          </button>
        </div>
        <div className="p-10">{children}</div>
      </div>
    </>
  );
}
