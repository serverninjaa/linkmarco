import { useEffect, useState } from "react";
import type { Popup } from "@/lib/types";
import { X } from "lucide-react";

interface Props {
  popup: Popup;
  accent: string;
}

const SPAN: Record<number, string> = {
  1: "sm:col-span-1",
  2: "sm:col-span-2",
  3: "sm:col-span-3",
  4: "sm:col-span-4",
  5: "sm:col-span-5",
  6: "sm:col-span-6",
};

const COLS: Record<number, string> = {
  1: "sm:grid-cols-1",
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-4",
  5: "sm:grid-cols-5",
  6: "sm:grid-cols-6",
};

/** deniz23-style entry pop-up: a columned grid of neon-bordered sponsor cards. */
export default function WelcomePopupModal({ popup, accent }: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!popup.enabled) return;
    const t = setTimeout(() => setOpen(true), 700);
    return () => clearTimeout(t);
  }, [popup.enabled]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!popup.enabled || !open) return null;

  const items = [...popup.items].sort((a, b) => a.order - b.order);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/85 p-4 py-10 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={popup.title}
      data-testid="welcome-popup-modal"
      onClick={(e) => e.target === e.currentTarget && setOpen(false)}
    >
      <div className="animate-pop-in relative w-full max-w-2xl">
        <button
          onClick={() => setOpen(false)}
          aria-label="Kapat"
          data-testid="popup-close-button"
          className="absolute -top-4 right-0 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-red-600 text-white shadow-lg transition-transform duration-150 hover:scale-110 hover:bg-red-500 sm:-right-4"
        >
          <X className="h-5 w-5" strokeWidth={3} />
        </button>

        <div className="rounded-2xl border border-white/10 bg-[#0A0C12] p-4 shadow-2xl sm:p-5">
          {popup.title ? (
            <h2
              className="mb-1 text-center font-heading text-lg font-black uppercase tracking-tight"
              style={{ color: accent }}
              data-testid="popup-title"
            >
              {popup.title}
            </h2>
          ) : null}
          {popup.subtitle ? (
            <p className="mb-4 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              {popup.subtitle}
            </p>
          ) : null}

          {items.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400" data-testid="popup-empty">
              Pop-up reklam kolonu tanımlanmadı. Panelden ekleyebilirsiniz.
            </p>
          ) : (
            <div
              className={`grid grid-cols-1 gap-3 ${COLS[popup.columns] ?? "sm:grid-cols-3"}`}
              data-testid="popup-grid"
            >
              {items.map((item) => {
                const c = item.border_color || accent;
                return (
                  <a
                    key={item.id}
                    href={item.url || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid="popup-ad-card"
                    className={`group relative flex flex-col items-center justify-center gap-1.5 rounded-xl border px-3 py-5 text-center transition-all duration-200 hover:-translate-y-0.5 ${SPAN[item.col_span] ?? "sm:col-span-1"}`}
                    style={{
                      background: "#05070B",
                      borderColor: `${c}80`,
                      boxShadow: `inset 0 0 40px -16px ${c}`,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = c;
                      e.currentTarget.style.boxShadow = `inset 0 0 40px -14px ${c}, 0 0 24px -6px ${c}`;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = `${c}80`;
                      e.currentTarget.style.boxShadow = `inset 0 0 40px -16px ${c}`;
                    }}
                  >
                    {[
                      "left-1.5 top-1.5 border-l-2 border-t-2",
                      "right-1.5 top-1.5 border-r-2 border-t-2",
                      "left-1.5 bottom-1.5 border-b-2 border-l-2",
                      "right-1.5 bottom-1.5 border-b-2 border-r-2",
                    ].map((cls) => (
                      <span
                        key={cls}
                        className={`pointer-events-none absolute h-3 w-3 ${cls}`}
                        style={{ borderColor: c }}
                      />
                    ))}

                    {item.logo_url ? (
                      <img
                        src={item.logo_url}
                        alt={item.brand_name}
                        className="mb-1 max-h-8 w-auto max-w-[75%] object-contain transition-transform duration-200 group-hover:scale-105"
                        data-testid="popup-ad-logo"
                      />
                    ) : (
                      <span
                        className="font-heading text-lg font-black uppercase tracking-tight"
                        style={{ color: c }}
                        data-testid="popup-ad-brand"
                      >
                        {item.brand_name}
                      </span>
                    )}
                    {item.line1 ? (
                      <span className="text-[10px] font-bold uppercase tracking-wide text-white" data-testid="popup-ad-line1">
                        {item.line1}
                      </span>
                    ) : null}
                    {item.line2 ? (
                      <span className="text-[10px] font-bold uppercase tracking-wide text-slate-300">{item.line2}</span>
                    ) : null}
                  </a>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
