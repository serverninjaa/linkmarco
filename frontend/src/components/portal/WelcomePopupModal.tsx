import { useEffect, useState } from "react";
import type { Popup } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface Props {
  popup: Popup;
  accent: string;
  accent2: string;
}

export default function WelcomePopupModal({ popup, accent, accent2 }: Props) {
  const [open, setOpen] = useState(false);
  const [left, setLeft] = useState(popup.countdown_seconds);

  useEffect(() => {
    if (!popup.enabled) return;
    const t = setTimeout(() => setOpen(true), 900);
    return () => clearTimeout(t);
  }, [popup.enabled]);

  useEffect(() => {
    if (!open) return;
    const i = setInterval(() => setLeft((v) => (v > 0 ? v - 1 : 0)), 1000);
    return () => clearInterval(i);
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!popup.enabled || !open) return null;

  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      data-testid="welcome-popup-modal"
    >
      <div
        className="animate-pop-in relative w-full max-w-lg overflow-hidden rounded-2xl border bg-[#0F131D] shadow-2xl"
        style={{ borderColor: `${accent}66`, boxShadow: `0 0 60px -12px ${accent}66` }}
      >
        <button
          onClick={() => setOpen(false)}
          aria-label="Kapat"
          data-testid="popup-close-button"
          className="absolute right-3 top-3 z-10 rounded-full bg-black/60 p-2 text-white transition-colors duration-150 hover:bg-black"
        >
          <X className="h-4 w-4" />
        </button>

        {popup.image_url ? (
          <div className="relative h-44 w-full overflow-hidden">
            <img src={popup.image_url} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0F131D] via-[#0F131D]/40 to-transparent" />
          </div>
        ) : null}

        <div className="space-y-5 p-7 text-center">
          <div
            className="inline-block rounded-full px-3 py-1 text-[11px] font-bold tracking-widest"
            style={{ background: accent2, color: "#000" }}
          >
            SINIRLI SÜRE
          </div>
          <h2
            className="font-heading text-3xl font-extrabold tracking-tight"
            style={{ color: accent }}
            data-testid="popup-title"
          >
            {popup.title}
          </h2>
          <p className="text-sm leading-relaxed text-slate-300">{popup.subtitle}</p>

          <div className="flex items-center justify-center gap-2 font-mono text-2xl font-bold text-white">
            <span className="rounded-lg bg-white/5 px-3 py-1.5" data-testid="popup-countdown">
              {mm}:{ss}
            </span>
          </div>

          <Button
            className="animate-glow h-12 w-full text-base font-extrabold tracking-wide"
            style={{ background: accent, color: "#000" }}
            data-testid="popup-modal-cta"
            onClick={() => {
              if (popup.cta_url && popup.cta_url !== "#") window.open(popup.cta_url, "_blank");
              setOpen(false);
            }}
          >
            {popup.cta_text}
          </Button>
          <button
            className="text-xs text-slate-500 underline-offset-4 transition-colors duration-150 hover:text-slate-300 hover:underline"
            onClick={() => setOpen(false)}
            data-testid="popup-dismiss-link"
          >
            Teşekkürler, şimdi değil
          </button>
        </div>
      </div>
    </div>
  );
}
