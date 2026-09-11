import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiUpload } from "@/lib/api";
import type { UploadItem, UploadResult } from "@/lib/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Upload, X, Loader2, Images, Check } from "lucide-react";

interface Props {
  value: string;
  onChange: (url: string) => void;
  testId?: string;
}

/** Marka logosu seçici: kütüphanedeki görseller + yeni yükleme. */
export default function LogoPickerDialog({ value, onChange, testId = "logo-picker" }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  const { data: library } = useQuery({
    queryKey: ["uploads"],
    queryFn: () => apiGet<UploadItem[]>("/uploads"),
    enabled: open,
    retry: false,
  });

  const upload = useMutation({
    mutationFn: (file: File) => apiUpload<UploadResult>("/uploads", file),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: ["uploads"] });
      onChange(res.url);
      toast.success("Logo yüklendi ve kütüphaneye eklendi");
      setOpen(false);
    },
    onError: () => toast.error("Yükleme başarısız — PNG/JPG/WEBP/SVG, en fazla 2 MB"),
  });

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      await upload.mutateAsync(file);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="flex items-center gap-2">
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

      <Button
        type="button"
        variant="outline"
        className="border-[#1E293B] text-xs"
        onClick={() => setOpen(true)}
        data-testid={`${testId}-button`}
      >
        <Images className="mr-1 h-3.5 w-3.5" /> Logo Seç
      </Button>

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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto border-[#1E293B] bg-[#121620] sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Marka Logosu Seç</DialogTitle>
          </DialogHeader>

          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
            className="hidden"
            onChange={(e) => void pick(e.target.files?.[0])}
            data-testid={`${testId}-file-input`}
          />

          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1E293B] pb-4">
            <p className="text-xs text-slate-400">
              Kütüphanedeki görsellerden seçin veya yeni bir logo yükleyin.
            </p>
            <Button
              type="button"
              className="bg-amber-500 font-bold text-black hover:bg-amber-400"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              data-testid={`${testId}-upload-button`}
            >
              {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Upload className="mr-1 h-4 w-4" />}
              {busy ? "Yükleniyor" : "Bilgisayardan Yükle"}
            </Button>
          </div>

          {!library ? (
            <div className="grid grid-cols-3 gap-3 py-2 sm:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-20 animate-pulse rounded-lg bg-white/5" />
              ))}
            </div>
          ) : library.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400" data-testid={`${testId}-empty`}>
              Kütüphane boş. İlk logoyu yükleyin.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-3 py-2 sm:grid-cols-4" data-testid={`${testId}-library-grid`}>
              {library.map((item) => {
                const selected = value === item.url;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onChange(item.url);
                      setOpen(false);
                    }}
                    className={`group relative flex h-20 items-center justify-center rounded-lg border bg-[#05070B] p-2 transition-colors duration-150 ${
                      selected ? "border-amber-500" : "border-[#1E293B] hover:border-slate-500"
                    }`}
                    title={item.filename}
                    data-testid={`${testId}-library-item`}
                  >
                    <img src={item.url} alt={item.filename} className="max-h-12 max-w-full object-contain" />
                    {selected ? (
                      <span className="absolute right-1 top-1 rounded-full bg-amber-500 p-0.5 text-black">
                        <Check className="h-3 w-3" />
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
