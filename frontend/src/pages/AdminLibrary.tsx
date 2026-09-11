import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiDelete, apiGet, apiUpload } from "@/lib/api";
import type { UploadItem, UploadResult } from "@/lib/types";
import AdminShell from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Upload, Trash2, Copy, Loader2, Images } from "lucide-react";

/** Medya kütüphanesi: sunucuda barındırılan tüm marka logoları. */
export default function AdminLibrary() {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const { data: items, isError } = useQuery({
    queryKey: ["uploads"],
    queryFn: () => apiGet<UploadItem[]>("/uploads"),
    retry: false,
  });

  const upload = useMutation({
    mutationFn: (file: File) => apiUpload<UploadResult>("/uploads", file),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["uploads"] });
      toast.success("Görsel kütüphaneye eklendi");
    },
    onError: () => toast.error("Yükleme başarısız — PNG/JPG/WEBP/SVG, en fazla 2 MB"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiDelete(`/uploads/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["uploads"] });
      toast.success("Görsel silindi");
    },
    onError: () => toast.error("Silinemedi"),
  });

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      for (const file of Array.from(files)) await upload.mutateAsync(file).catch(() => undefined);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const list = isError ? [] : (items ?? []);
  const totalKb = Math.round(list.reduce((sum, i) => sum + i.size, 0) / 1024);

  return (
    <AdminShell>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-black tracking-tight">Kütüphane</h1>
          <p className="mt-1 text-sm text-slate-400">
            Tüm marka logoları kendi sunucumuzda barındırılır — {list.length} görsel, {totalKb} KB.
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
          className="hidden"
          onChange={(e) => void onFiles(e.target.files)}
          data-testid="library-file-input"
        />
        <Button
          className="bg-amber-500 font-bold text-black hover:bg-amber-400"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          data-testid="library-upload-button"
        >
          {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Upload className="mr-1 h-4 w-4" />}
          {busy ? "Yükleniyor" : "Görsel Yükle"}
        </Button>
      </div>

      {list.length === 0 ? (
        <div
          className="rounded-xl border border-dashed border-[#1E293B] p-16 text-center"
          data-testid="library-empty"
        >
          <Images className="mx-auto h-8 w-8 text-slate-600" />
          <p className="mt-3 text-sm text-slate-400">Kütüphane boş. İlk logoyu yükleyin.</p>
        </div>
      ) : (
        <div
          className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
          data-testid="library-grid"
        >
          {list.map((item) => (
            <div
              key={item.id}
              className="group overflow-hidden rounded-xl border border-[#1E293B] bg-[#121620] transition-colors duration-150 hover:border-amber-500/50"
              data-testid="library-item"
            >
              <div className="flex h-28 items-center justify-center bg-[#05070B] p-3">
                <img src={item.url} alt={item.filename} className="max-h-20 max-w-full object-contain" />
              </div>
              <div className="space-y-2 p-3">
                <p className="truncate text-xs font-semibold" title={item.filename}>
                  {item.filename}
                </p>
                <p className="font-mono text-[10px] text-slate-500">
                  {Math.max(1, Math.round(item.size / 1024))} KB · {item.content_type.split("/")[1]}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      void navigator.clipboard?.writeText(item.url);
                      toast.success("Bağlantı kopyalandı");
                    }}
                    className="flex flex-1 items-center justify-center gap-1 rounded border border-[#1E293B] py-1.5 text-[11px] font-semibold text-slate-300 transition-colors duration-150 hover:border-slate-500"
                    data-testid="library-copy-button"
                  >
                    <Copy className="h-3 w-3" /> Kopyala
                  </button>
                  <button
                    onClick={() => remove.mutate(item.id)}
                    className="rounded border border-[#1E293B] px-2 py-1.5 text-slate-400 transition-colors duration-150 hover:border-red-500/60 hover:text-red-400"
                    aria-label="Görseli sil"
                    data-testid="library-delete-button"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminShell>
  );
}
