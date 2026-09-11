import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiDelete, apiGet, apiPost } from "@/lib/api";
import type { Site } from "@/lib/types";
import AdminShell from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2, ExternalLink, Settings2, Copy, Star } from "lucide-react";

export default function AdminSites() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [domain, setDomain] = useState("");

  // Şablon kopyalama
  const [cloneSource, setCloneSource] = useState<Site | null>(null);
  const [cloneName, setCloneName] = useState("");
  const [cloneSlug, setCloneSlug] = useState("");
  const [cloneDomain, setCloneDomain] = useState("");

  const { data: sites, isError } = useQuery({
    queryKey: ["sites"],
    queryFn: () => apiGet<Site[]>("/sites"),
    retry: false,
  });

  const create = useMutation({
    mutationFn: () =>
      apiPost<Site>("/sites", {
        slug: slug.trim(),
        name: name.trim(),
        domains: domain.trim() ? [domain.trim().toLowerCase()] : [],
        title: name.trim().toUpperCase(),
        tagline: "Güncel giriş ve reklam alanları",
        logo_text: name.trim().toUpperCase().slice(0, 10),
        marquee: ["Yeni site yayında"],
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["sites"] });
      toast.success("Site oluşturuldu");
      setOpen(false);
      setName("");
      setSlug("");
      setDomain("");
    },
    onError: () => toast.error("Site oluşturulamadı — slug benzersiz olmalı"),
  });

  const duplicate = useMutation({
    mutationFn: () =>
      apiPost<Site>(`/sites/${cloneSource?.id}/duplicate`, {
        slug: cloneSlug.trim(),
        name: cloneName.trim(),
        domains: cloneDomain.trim() ? [cloneDomain.trim().toLowerCase()] : [],
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["sites"] });
      toast.success("Şablon kopyalandı — tasarım ve tüm kartlar yeni siteye aktarıldı");
      setCloneSource(null);
    },
    onError: () => toast.error("Kopyalanamadı — slug benzersiz olmalı"),
  });

  const setDefault = useMutation({
    mutationFn: (id: string) => apiPost<Site>(`/sites/${id}/set-default`, {}),
    onSuccess: (site) => {
      void qc.invalidateQueries({ queryKey: ["sites"] });
      toast.success(`${site.name} varsayılan tasarım şablonu olarak kaydedildi`);
    },
    onError: () => toast.error("Varsayılan tasarım kaydedilemedi"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiDelete(`/sites/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["sites"] });
      toast.success("Site silindi");
    },
    onError: () => toast.error("Site silinemedi"),
  });

  const list = isError ? [] : (sites ?? []);

  return (
    <AdminShell>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-black tracking-tight">Siteler & Domainler</h1>
          <p className="mt-1 text-sm text-slate-400">
            Her site kendi domainleri, teması, reklam alanları ve pop-up'ı ile yönetilir.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger
            render={
              <Button className="bg-amber-500 font-bold text-black hover:bg-amber-400" data-testid="add-site-button">
                <Plus className="mr-1 h-4 w-4" /> Yeni Site
              </Button>
            }
          />
          <DialogContent className="border-[#1E293B] bg-[#121620]">
            <DialogHeader>
              <DialogTitle>Yeni Site Ekle</DialogTitle>
            </DialogHeader>
            <form
              className="space-y-4"
              data-testid="add-site-form"
              onSubmit={(e) => {
                e.preventDefault();
                create.mutate();
              }}
            >
              <p className="rounded-lg border border-[#1E293B] bg-[#0B0E17] p-3 text-xs text-slate-400">
                Yeni site,{" "}
                <strong className="text-amber-400">
                  {list.find((s) => s.is_default)?.name ?? "varsayılan"}
                </strong>{" "}
                tasarımını (tema, kolon sayısı, pop-up ayarları, özel CSS) otomatik devralır.
              </p>
              <div className="space-y-2">
                <Label htmlFor="site-name">Site Adı</Label>
                <Input
                  id="site-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Örn. Marco Portal"
                  data-testid="site-name-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="site-slug">Slug (önizleme: /?site=slug)</Label>
                <Input
                  id="site-slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="marco"
                  data-testid="site-slug-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="site-domain">İlk Domain (opsiyonel)</Label>
                <Input
                  id="site-domain"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder="marco.com"
                  data-testid="site-domain-input"
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-amber-500 font-bold text-black hover:bg-amber-400"
                disabled={create.isPending || !slug.trim() || !name.trim()}
                data-testid="save-site-button"
              >
                Kaydet
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {list.length === 0 ? (
        <div
          className="rounded-xl border border-dashed border-[#1E293B] p-12 text-center text-sm text-slate-400"
          data-testid="sites-empty-state"
        >
          Henüz site yok. "Yeni Site" ile ilk domaininizi bağlayın.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3" data-testid="sites-grid">
          {list.map((site) => (
            <div
              key={site.id}
              className="rounded-xl border border-[#1E293B] bg-[#121620] p-5 transition-colors duration-200 hover:border-amber-500/50"
              data-testid="site-card"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-heading text-lg font-bold tracking-tight" data-testid="site-card-name">
                    {site.name}
                  </h2>
                  <code className="font-mono text-xs text-slate-500">/{site.slug}</code>
                  {site.is_default ? (
                    <span
                      className="mt-2 flex w-fit items-center gap-1 rounded bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-400 ring-1 ring-amber-500/40"
                      data-testid="site-default-badge"
                    >
                      <Star className="h-3 w-3" /> Varsayılan tasarım
                    </span>
                  ) : null}
                </div>
                <span
                  className="h-8 w-8 shrink-0 rounded-lg"
                  style={{ background: site.theme.accent }}
                  aria-hidden
                />
              </div>

              <div className="mt-4 space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Domainler</p>
                {site.domains.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {site.domains.map((d) => (
                      <span
                        key={d}
                        className="rounded bg-[#1E293B] px-2 py-0.5 font-mono text-[11px] text-cyan-300"
                        data-testid="site-domain-chip"
                      >
                        {d}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-xs text-slate-500">Domain bağlanmadı</span>
                )}
              </div>

              <div className="mt-4 flex items-center gap-3 text-xs text-slate-400">
                <span>{site.columns} kolon</span>
                <span>•</span>
                <span>{site.popup.enabled ? "Pop-up açık" : "Pop-up kapalı"}</span>
                <span>•</span>
                <span className={site.active ? "text-emerald-400" : "text-red-400"}>
                  {site.active ? "Yayında" : "Pasif"}
                </span>
              </div>

              <div className="mt-5 flex gap-2">
                <Link
                  to={`/admin/sites/${site.id}`}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 text-xs font-bold text-black transition-colors duration-150 hover:bg-amber-400"
                  data-testid="site-manage-link"
                >
                  <Settings2 className="h-3.5 w-3.5" /> Yönet
                </Link>
                <Link
                  to={`/?site=${site.slug}`}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-[#1E293B] px-3 py-2 text-xs font-semibold text-slate-300 transition-colors duration-150 hover:border-slate-500"
                  data-testid="site-preview-link"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Önizle
                </Link>
                {site.is_default ? null : (
                  <button
                    onClick={() => setDefault.mutate(site.id)}
                    className="rounded-lg border border-[#1E293B] px-3 py-2 text-slate-400 transition-colors duration-150 hover:border-amber-500/60 hover:text-amber-400"
                    aria-label="Varsayılan tasarım yap"
                    title="Varsayılan tasarım yap"
                    data-testid="site-set-default-button"
                  >
                    <Star className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  onClick={() => {
                    setCloneSource(site);
                    setCloneName(`${site.name} Kopya`);
                    setCloneSlug(`${site.slug}-kopya`);
                    setCloneDomain("");
                  }}
                  className="rounded-lg border border-[#1E293B] px-3 py-2 text-slate-400 transition-colors duration-150 hover:border-cyan-500/60 hover:text-cyan-400"
                  aria-label="Şablonu kopyala"
                  title="Şablonu kopyala"
                  data-testid="site-duplicate-button"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => remove.mutate(site.id)}
                  className="rounded-lg border border-[#1E293B] px-3 py-2 text-slate-400 transition-colors duration-150 hover:border-red-500/60 hover:text-red-400"
                  aria-label="Sil"
                  data-testid="site-delete-button"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Şablon kopyalama diyaloğu */}
      <Dialog open={cloneSource !== null} onOpenChange={(v) => !v && setCloneSource(null)}>
        <DialogContent className="border-[#1E293B] bg-[#121620]">
          <DialogHeader>
            <DialogTitle>Şablonu Kopyala</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            data-testid="duplicate-site-form"
            onSubmit={(e) => {
              e.preventDefault();
              duplicate.mutate();
            }}
          >
            <p className="text-sm text-slate-400">
              <strong className="text-slate-200">{cloneSource?.name}</strong> sitesinin tüm tasarımı,
              pop-up kolonları ve reklam kartları yeni domaine kopyalanır.
            </p>
            <div className="space-y-2">
              <Label htmlFor="clone-name">Yeni Site Adı</Label>
              <Input
                id="clone-name"
                value={cloneName}
                onChange={(e) => setCloneName(e.target.value)}
                data-testid="clone-name-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="clone-slug">Yeni Slug</Label>
              <Input
                id="clone-slug"
                value={cloneSlug}
                onChange={(e) => setCloneSlug(e.target.value)}
                data-testid="clone-slug-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="clone-domain">Yeni Domain (opsiyonel)</Label>
              <Input
                id="clone-domain"
                value={cloneDomain}
                onChange={(e) => setCloneDomain(e.target.value)}
                placeholder="yeni-domain.com"
                data-testid="clone-domain-input"
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-cyan-500 font-bold text-black hover:bg-cyan-400"
              disabled={duplicate.isPending || !cloneSlug.trim() || !cloneName.trim()}
              data-testid="confirm-duplicate-button"
            >
              {duplicate.isPending ? "Kopyalanıyor..." : "Kopyala"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
