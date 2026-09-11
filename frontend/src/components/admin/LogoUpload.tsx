import { useRef, useState } from "react";
import { apiUpload } from "@/lib/api";
import type { UploadResult } from "@/lib/types";
import { toast } from "sonner";
import { Upload, X, Loader2 } from "lucide-react";

interface Props {
  value: string;
  onChange: (url: string) => void;
  testId?: string;
}

/** Logo yükleme: dosya seçilir, /api/uploads'a gider, dönen URL alana yazılır. */
export default function LogoUpload({ value, onChange, testId = "logo-upload" }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const res = await apiUpload<UploadResult>("/uploads", file);
      onChange(res.url);
      toast.success("Logo yüklendi");
    } catch {
      toast.error("Yükleme başarısız — PNG/JPG/WEBP/SVG, en fazla 2 MB");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="flex items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
        className="hidden"
        onChange={(e) => void pick(e.target.files?.[0])}
        data-testid={`${testId}-input`}
      />
      <div
        className="flex h-9 w-14 shrink-0 items-center justify-center overflow-hidden rounded border border-[#1E293B] bg-[#05070B]"
        data-testid={`${testId}-preview`}
      >
        {value ? (
          <img src={value} alt="logo" className="max-h-8 max-w-full object-contain" />
        ) : (
          <span className="text-[9px] uppercase tracking-widest text-slate-600">yok</span>
        )}
      </div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="flex items-center gap-1.5 rounded border border-[#1E293B] px-2.5 py-2 text-xs font-semibold text-slate-300 transition-colors duration-150 hover:border-amber-500/60 hover:text-amber-400 disabled:opacity-50"
        data-testid={`${testId}-button`}
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
        {busy ? "Yükleniyor" : "Logo Yükle"}
      </button>
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Logoyu kaldır"
          className="rounded border border-[#1E293B] p-2 text-slate-500 transition-colors duration-150 hover:text-red-400"
          data-testid={`${testId}-clear`}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}
