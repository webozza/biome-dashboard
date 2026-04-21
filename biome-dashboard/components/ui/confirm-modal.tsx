"use client";

import { AlertTriangle, Loader2, X } from "lucide-react";
import { createPortal } from "react-dom";

type Tone = "danger" | "primary" | "neutral";

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: Tone;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "danger",
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!open || typeof document === "undefined") return null;

  const confirmClass =
    tone === "danger"
      ? "bg-red-500 text-white hover:bg-red-600"
      : tone === "primary"
        ? "bg-primary text-white hover:bg-emerald-600"
        : "bg-surface-hover text-main border border-border hover:bg-surface";

  const iconClass =
    tone === "danger"
      ? "bg-red-500/10 text-red-500"
      : tone === "primary"
        ? "bg-primary/10 text-primary"
        : "bg-surface-hover text-muted";

  return createPortal(
    <>
      <div
        onClick={loading ? undefined : onCancel}
        className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-md animate-fade-in"
      />
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 pointer-events-none animate-fade-in">
        <div className="w-full max-w-md rounded-3xl border border-border bg-surface/95 shadow-2xl backdrop-blur-3xl pointer-events-auto overflow-hidden">
          <div className="flex items-start gap-4 p-6">
            <div className={`shrink-0 w-11 h-11 rounded-2xl flex items-center justify-center ${iconClass}`}>
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1 space-y-1.5">
              <h2 className="text-base font-black tracking-tight text-main">{title}</h2>
              <div className="text-sm text-muted leading-relaxed">{message}</div>
            </div>
            <button
              onClick={onCancel}
              disabled={loading}
              className="shrink-0 w-8 h-8 rounded-lg text-muted hover:text-main hover:bg-surface-hover transition-colors flex items-center justify-center disabled:opacity-40"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border bg-surface-hover/30">
            <button
              onClick={onCancel}
              disabled={loading}
              className="px-4 py-2 rounded-xl border border-border bg-surface text-xs font-bold uppercase tracking-widest text-muted hover:text-main transition-colors disabled:opacity-40"
            >
              {cancelLabel}
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              className={`inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-colors disabled:opacity-60 ${confirmClass}`}
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
