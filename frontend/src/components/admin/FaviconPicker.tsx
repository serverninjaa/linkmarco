import { useState } from "react";
import LogoPickerDialog from "@/components/admin/LogoPickerDialog";

/** Hazır favicon setleri: frontend/public/favicons altında servis edilir. */
export const DEFAULT_FAVICONS: { url: string; label: string }[] = [
  { url: "/favicons/crown.svg", label: "Taç" },
  { url: "/favicons/dice.svg", label: "Zar" },
  { url: "/favicons/flame.svg", label: "Alev" },
  { url: "/favicons/diamond.svg", label: "Elmas" },
  { url: "/favicons/star.svg", label: "Yıldız" },
  { url: "/favicons/ball.svg", label: "Top" },
  { url: "/favicons/shield.svg", label: "Kalkan" },
  { url: "/favicons/bolt.svg", label: "Şimşek" },
];

/** Favicon bölümü: hazır ikonlardan seç, kütüphaneden seç/yükle veya temizle. */
export default function FaviconPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (url: string) => void;
}) {
  const [customOpen, setCustomOpen] = useState(Boolean(value) && !value.startsWith("/favicons/"));

  return (
    <div className="space-y-4" data-testid="favicon-picker">
      <div className="flex items-center gap-3 rounded-xl border border-[#1E293B] bg-[#0B0E17] p-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#121620]">
          {value ? (
            <img
              src={value}
              alt="Seçili favicon"
              className="h-8 w-8 object-contain"
              data-testid="favicon-current-preview"
            />
          ) : (
            <span className="text-[10px] text-slate-500">yok</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-slate-200">Seçili sekme ikonu</p>
          <p className="truncate font-mono text-[11px] text-slate-500" data-testid="favicon-current-url">
            {value || "Henüz seçilmedi — aşağıdan bir ikon seçin"}
          </p>
        </div>
        {value ? (
          <button
            type="button"
            onClick={() => onChange("")}
            className="rounded-lg border border-[#1E293B] px-2.5 py-1.5 text-xs text-slate-400 transition-colors duration-150 hover:border-red-500/60 hover:text-red-400"
            data-testid="favicon-clear-button"
          >
            Kaldır
          </button>
        ) : null}
      </div>

      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
          Hazır ikonlar
        </p>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-8" data-testid="favicon-defaults-grid">
          {DEFAULT_FAVICONS.map((f) => {
            const active = value === f.url;
            return (
              <button
                key={f.url}
                type="button"
                title={f.label}
                onClick={() => onChange(f.url)}
                data-testid={`favicon-option-${f.url.split("/").pop()?.replace(".svg", "")}`}
                className={`flex flex-col items-center gap-1 rounded-xl border p-2 transition-[transform,border-color] duration-150 hover:-translate-y-0.5 ${
                  active
                    ? "border-amber-500 bg-amber-500/10"
                    : "border-[#1E293B] bg-[#0B0E17] hover:border-slate-500"
                }`}
              >
                <img src={f.url} alt={f.label} className="h-8 w-8" />
                <span className="text-[10px] text-slate-400">{f.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <button
          type="button"
          onClick={() => setCustomOpen((v) => !v)}
          className="text-xs font-bold text-amber-400 transition-opacity duration-150 hover:opacity-80"
          data-testid="favicon-custom-toggle"
        >
          {customOpen ? "− Kendi ikonumu gizle" : "+ Kendi ikonumu yükle / kütüphaneden seç"}
        </button>
        {customOpen ? (
          <div className="mt-2">
            <LogoPickerDialog value={value} onChange={onChange} testId="favicon-upload" />
            <p className="mt-1 text-[11px] text-slate-500">
              PNG/SVG, kare ve en az 64×64 px önerilir.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
