import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/api";
import type {
  AdSlot,
  AdType,
  BadgePosition,
  BadgeStyle,
  CardEffect,
  LinkCheckSummary,
  PopupItem,
  Site,
  TextSize,
} from "@/lib/types";
import {
  AD_TYPE_LABELS,
  BADGE_POSITION_LABELS,
  BADGE_STYLE_LABELS,
  CARD_EFFECT_LABELS,
  LINK_STATUS_LABELS,
  NEON_COLORS,
  TEXT_SIZE_LABELS,
} from "@/lib/types";
import AdminShell from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, ExternalLink, ChevronUp, ChevronDown, X, GripVertical, Pencil, ShieldAlert, Link2, Loader2 } from "lucide-react";
import LogoPickerDialog from "@/components/admin/LogoPickerDialog";
import FaviconPicker from "@/components/admin/FaviconPicker";
import SiteStatsPanel from "@/components/admin/SiteStatsPanel";
import LiveSitePreview from "@/components/admin/LiveSitePreview";

const COLORS: { key: "bg" | "panel" | "card" | "accent" | "accent2" | "text"; label: string }[] = [
  { key: "bg", label: "Arka Plan" },
  { key: "panel", label: "Panel" },
  { key: "card", label: "Kart" },
  { key: "accent", label: "Vurgu 1" },
  { key: "accent2", label: "Vurgu 2" },
  { key: "text", label: "Metin" },
];

export default function AdminSiteEditor() {
  const { siteId = "" } = useParams();
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Site | null>(null);
  const [newDomain, setNewDomain] = useState("");
  const [dragItem, setDragItem] = useState<number | null>(null);
  const [dragSlot, setDragSlot] = useState<number | null>(null);
  const [openSlot, setOpenSlot] = useState<string | null>(null);

  const { data: site } = useQuery({
    queryKey: ["site", siteId],
    queryFn: () => apiGet<Site>(`/sites/${siteId}`),
    retry: false,
  });
  const { data: slots } = useQuery({
    queryKey: ["slots", siteId],
    queryFn: () => apiGet<AdSlot[]>(`/sites/${siteId}/slots`),
    retry: false,
  });

  useEffect(() => {
    if (site) setDraft(site);
  }, [site]);

  const saveSite = useMutation({
    mutationFn: (patch: Partial<Site>) => apiPut<Site>(`/sites/${siteId}`, patch),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["site", siteId] });
      void qc.invalidateQueries({ queryKey: ["sites"] });
      toast.success("Kaydedildi");
    },
    onError: () => toast.error("Kaydedilemedi"),
  });

  const addSlot = useMutation({
    mutationFn: (type: AdType) =>
      apiPost<AdSlot>(`/sites/${siteId}/slots`, {
        site_id: siteId,
        type,
        title: "YENİ MARKA",
        badge: "",
        badge_position: "center",
        badge_style: "tab",
        badge_bg: "",
        badge_text_color: "",
        text_size: "md",
        effect: "none",
        effect_speed: 6,
        description: "500₺ DENEME BONUSU",
        line2: "%30 KAYIP BONUSU",
        image_url: "",
        target_url: "https://example.com",
        cta_text: "HEMEN AL",
        html: '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#22C55E">REKLAM KODU</div>',
        border_color: NEON_COLORS[(slots?.length ?? 0) % NEON_COLORS.length],
        col_span: 1,
        height: 150,
        order: slots?.length ?? 0,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["slots", siteId] });
      toast.success("Reklam alanı eklendi");
    },
    onError: () => toast.error("Eklenemedi"),
  });

  const updateSlot = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<AdSlot> }) =>
      apiPut<AdSlot>(`/sites/${siteId}/slots/${id}`, patch),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["slots", siteId] });
    },
    onError: () => toast.error("Güncellenemedi"),
  });

  const reorderSlots = useMutation({
    mutationFn: (ids: string[]) => apiPost<AdSlot[]>(`/sites/${siteId}/slots/reorder`, { ids }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["slots", siteId] });
      toast.success("Sıralama güncellendi");
    },
    onError: () => toast.error("Sıralama kaydedilemedi"),
  });

  const checkLinks = useMutation({
    mutationFn: () => apiPost<LinkCheckSummary>(`/sites/${siteId}/slots/check-links`, {}),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: ["slots", siteId] });
      if (res.problems === 0) toast.success(`${res.checked} link kontrol edildi — tümü çalışıyor`);
      else toast.error(`${res.problems} sorunlu link bulundu (${res.ok} çalışıyor)`);
    },
    onError: () => toast.error("Link kontrolü başarısız"),
  });

  const removeSlot = useMutation({
    mutationFn: (id: string) => apiDelete(`/sites/${siteId}/slots/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["slots", siteId] });
      toast.success("Reklam alanı silindi");
    },
    onError: () => toast.error("Silinemedi"),
  });

  if (!draft) {
    return (
      <AdminShell>
        <div className="text-sm text-slate-400" data-testid="site-editor-loading">
          Site yükleniyor...
        </div>
      </AdminShell>
    );
  }

  const set = <K extends keyof Site>(key: K, value: Site[K]) =>
    setDraft((d) => (d ? { ...d, [key]: value } : d));

  const patchItem = (idx: number, patch: Partial<PopupItem>) =>
    setDraft((d) => {
      if (!d) return d;
      const items = d.popup.items.map((it, i) => (i === idx ? { ...it, ...patch } : it));
      return { ...d, popup: { ...d.popup, items } };
    });

  const moveItem = (idx: number, dir: -1 | 1) =>
    setDraft((d) => {
      if (!d) return d;
      const items = [...d.popup.items];
      const target = idx + dir;
      if (target < 0 || target >= items.length) return d;
      [items[idx], items[target]] = [items[target], items[idx]];
      return { ...d, popup: { ...d.popup, items: items.map((it, i) => ({ ...it, order: i })) } };
    });

  // Sürükle-bırak: kaynak kolonu hedef konuma taşı.
  const reorderItems = (from: number, to: number) =>
    setDraft((d) => {
      if (!d) return d;
      const items = [...d.popup.items];
      const [moved] = items.splice(from, 1);
      items.splice(to, 0, moved);
      return { ...d, popup: { ...d.popup, items: items.map((it, i) => ({ ...it, order: i })) } };
    });

  const list = slots ?? [];

  return (
    <AdminShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            to="/admin"
            className="rounded-lg border border-[#1E293B] p-2 text-slate-400 transition-colors duration-150 hover:text-slate-100"
            data-testid="back-to-sites-link"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="font-heading text-2xl font-black tracking-tight" data-testid="editor-site-name">
              {draft.name}
            </h1>
            <code className="font-mono text-xs text-slate-500">/{draft.slug}</code>
          </div>
        </div>
        <div className="flex gap-2">
          <Link
            to={`/?site=${draft.slug}`}
            className="flex items-center gap-1.5 rounded-lg border border-[#1E293B] px-3 py-2 text-xs font-semibold text-slate-300 hover:border-slate-500"
            data-testid="editor-preview-link"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Canlı Önizleme
          </Link>
          <Button
            className="bg-amber-500 font-bold text-black hover:bg-amber-400"
            onClick={() => saveSite.mutate(draft)}
            disabled={saveSite.isPending}
            data-testid="admin-save-site-btn"
          >
            Değişiklikleri Kaydet
          </Button>
        </div>
      </div>

      <Tabs defaultValue="genel">
        <TabsList data-testid="editor-tabs">
          <TabsTrigger value="genel" data-testid="tab-genel">Genel</TabsTrigger>
          <TabsTrigger value="domainler" data-testid="tab-domainler">Domainler</TabsTrigger>
          <TabsTrigger value="tasarim" data-testid="tab-tasarim">Tasarım</TabsTrigger>
          <TabsTrigger value="popup" data-testid="tab-popup">Pop-up</TabsTrigger>
          <TabsTrigger value="reklam" data-testid="tab-reklam">Reklam Alanları</TabsTrigger>
          <TabsTrigger value="seo" data-testid="tab-seo">SEO / Sekme</TabsTrigger>
          <TabsTrigger value="onizleme" data-testid="tab-onizleme">Canlı Önizleme</TabsTrigger>
          <TabsTrigger value="istatistik" data-testid="tab-istatistik">İstatistikler</TabsTrigger>
        </TabsList>

        {/* TIKLAMA İSTATİSTİKLERİ */}
        <TabsContent value="istatistik" className="mt-6">
          <SiteStatsPanel siteId={siteId} />
        </TabsContent>

        {/* SEO / SEKME — Google sonucu ve tarayıcı sekmesi */}
        <TabsContent value="seo" className="mt-6">
          <div className="grid max-w-3xl gap-4 rounded-xl border border-[#1E293B] bg-[#121620] p-6">
            <p className="text-sm leading-relaxed text-slate-400">
              Bu alanlar Google sonuçlarında ve tarayıcı sekmesinde görünür. Her domain kendi
              sitesinin değerlerini kullanır. Boş bırakılırsa Grid Başlığı ve Slogan kullanılır.
            </p>

            <Field label="Sayfa Başlığı (sekme + Google başlığı)" id="f-seo-title">
              <Input
                id="f-seo-title"
                value={draft.seo_title}
                onChange={(e) => set("seo_title", e.target.value)}
                placeholder="Güvenilir Siteler"
                data-testid="field-seo-title"
              />
            </Field>
            <Field label="Açıklama (Google sonucundaki alt yazı — 150-160 karakter ideal)" id="f-seo-desc">
              <Textarea
                id="f-seo-desc"
                rows={3}
                value={draft.seo_description}
                onChange={(e) => set("seo_description", e.target.value)}
                placeholder="Güvenilir Siteler. HerkulBet 500TL Deneme, Etobahis 10.000 Yatır 12.000"
                data-testid="field-seo-description"
              />
              <span className="mt-1 block text-xs text-slate-500" data-testid="seo-description-count">
                {draft.seo_description.length} karakter
              </span>
            </Field>
            <Field label="Sekme İkonu / Favicon" id="f-favicon">
              <FaviconPicker value={draft.favicon_url} onChange={(url) => set("favicon_url", url)} />
            </Field>

            {/* robots.txt / sitemap.xml — otomatik üretiliyor */}
            <div
              className="rounded-xl border border-[#1E293B] bg-[#0B0E17] p-4"
              data-testid="seo-robots-block"
            >
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Arama motoru dosyaları (otomatik)
              </p>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">
                Her domain için <span className="text-slate-200">robots.txt</span> ve{" "}
                <span className="text-slate-200">sitemap.xml</span> sunucu tarafında otomatik
                üretilir — panel domaini aramaya kapalı, reklam domainleri açıktır.
              </p>
              <div className="mt-2 space-y-1 font-mono text-[11px] text-cyan-300">
                <p data-testid="seo-robots-url">
                  https://{draft.domains[0] ?? `${draft.slug}.com`}/robots.txt
                </p>
                <p data-testid="seo-sitemap-url">
                  https://{draft.domains[0] ?? `${draft.slug}.com`}/sitemap.xml
                </p>
              </div>
            </div>

            {/* Google sonucu önizlemesi */}
            <div
              className="rounded-xl border border-[#1E293B] bg-[#0B0E17] p-4"
              data-testid="seo-preview"
            >
              <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">
                Google'da böyle görünecek
              </p>
              <div className="flex items-center gap-2">
                {draft.favicon_url ? (
                  <img
                    src={draft.favicon_url}
                    alt="favicon"
                    className="h-6 w-6 rounded-full bg-white object-contain p-0.5"
                    data-testid="seo-preview-favicon"
                  />
                ) : (
                  <span className="h-6 w-6 rounded-full bg-slate-700" />
                )}
                <div className="leading-tight">
                  <p className="text-xs text-slate-300">{draft.domains[0] ?? draft.slug}</p>
                  <p className="text-[11px] text-slate-500">
                    https://{draft.domains[0] ?? `${draft.slug}.com`}
                  </p>
                </div>
              </div>
              <p
                className="mt-2 text-lg text-[#8ab4f8] underline-offset-2 hover:underline"
                data-testid="seo-preview-title"
              >
                {draft.seo_title || draft.title || draft.name}
              </p>
              <p className="mt-1 text-sm text-slate-400" data-testid="seo-preview-description">
                {draft.seo_description || draft.tagline || "Açıklama girilmedi."}
              </p>
            </div>
          </div>
        </TabsContent>

        {/* CANLI CİHAZ ÖNİZLEMESİ */}
        <TabsContent value="onizleme" className="mt-6">
          <LiveSitePreview slug={draft.slug} />
        </TabsContent>

        {/* GENEL */}
        <TabsContent value="genel" className="mt-6">
          <div className="grid max-w-3xl gap-4 rounded-xl border border-[#1E293B] bg-[#121620] p-6">
            <Field label="Site Adı" id="f-name">
              <Input id="f-name" value={draft.name} onChange={(e) => set("name", e.target.value)} data-testid="field-name" />
            </Field>
            <Field label="Grid Başlığı (ziyaretçi sayfasının üst başlığı)" id="f-title">
              <Input id="f-title" value={draft.title} onChange={(e) => set("title", e.target.value)} data-testid="field-title" />
            </Field>
            <Field label="Alt Başlık / Slogan" id="f-tagline">
              <Input id="f-tagline" value={draft.tagline} onChange={(e) => set("tagline", e.target.value)} data-testid="field-tagline" />
            </Field>
            <Field label="Logo Metni" id="f-logo">
              <Input id="f-logo" value={draft.logo_text} onChange={(e) => set("logo_text", e.target.value)} data-testid="field-logo" />
            </Field>
            <Field label="Kayan Yazılar — üst barda logo ile durum arasında gösterilir (her satır bir metin)" id="f-marquee">
              <Textarea
                id="f-marquee"
                rows={3}
                value={draft.marquee.join("\n")}
                onChange={(e) => set("marquee", e.target.value.split("\n"))}
                data-testid="field-marquee"
              />
            </Field>
            <label className="flex items-center gap-3 text-sm">
              <Checkbox
                checked={draft.active}
                onCheckedChange={(v) => set("active", Boolean(v))}
                data-testid="field-active"
              />
              Site yayında
            </label>
          </div>
        </TabsContent>

        {/* DOMAINLER */}
        <TabsContent value="domainler" className="mt-6">
          <div className="max-w-2xl space-y-4 rounded-xl border border-[#1E293B] bg-[#121620] p-6">
            <p className="text-sm text-slate-400">
              Buraya eklenen her domain, gelen isteğin Host başlığına göre bu siteyi gösterir.
              <span className="mt-1 block text-xs text-amber-400/90">
                Yalnızca <b>aktif</b> domain siteyi yayınlar. Diğer domainlere girenler
                "Domain hazırlanıyor" ekranını görür. Hiçbiri seçilmezse tüm domainler yayında olur.
              </span>
            </p>
            <div className="flex gap-2">
              <Input
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                placeholder="ornek-domain.com"
                data-testid="new-domain-input"
              />
              <Button
                className="bg-cyan-500 font-bold text-black hover:bg-cyan-400"
                data-testid="add-domain-button"
                onClick={() => {
                  const d = newDomain.trim().toLowerCase().replace(/^www\./, "");
                  if (!d) return;
                  const domains = [...draft.domains, d];
                  set("domains", domains);
                  saveSite.mutate({ ...draft, domains });
                  setNewDomain("");
                }}
              >
                <Plus className="h-4 w-4" /> Ekle
              </Button>
            </div>
            <div className="space-y-2" data-testid="domain-list">
              {draft.domains.length === 0 ? (
                <p className="text-xs text-slate-500">Henüz domain bağlanmadı.</p>
              ) : (
                draft.domains.map((d) => {
                  const isActive = draft.active_domain === d;
                  return (
                  <div
                    key={d}
                    className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-2.5 transition-colors duration-150 ${
                      isActive
                        ? "border-emerald-500/60 bg-emerald-500/5"
                        : "border-[#1E293B] bg-[#0B0E17]"
                    }`}
                    data-testid="domain-row"
                  >
                    <code className="font-mono text-sm text-cyan-300">{d}</code>
                    <div className="flex items-center gap-2">
                      {isActive ? (
                        <span
                          className="rounded-full border border-emerald-500/50 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-400"
                          data-testid={`domain-active-badge-${d}`}
                        >
                          Aktif
                        </span>
                      ) : (
                        <button
                          className="rounded-lg border border-[#1E293B] px-2.5 py-1 text-[11px] font-bold text-slate-300 transition-colors duration-150 hover:border-emerald-500/60 hover:text-emerald-400"
                          data-testid={`domain-activate-button-${d}`}
                          onClick={() => {
                            set("active_domain", d);
                            saveSite.mutate({ ...draft, active_domain: d });
                          }}
                        >
                          Aktif Et
                        </button>
                      )}
                      <button
                        className="text-slate-500 transition-colors duration-150 hover:text-red-400"
                        aria-label={`${d} kaldır`}
                        data-testid="remove-domain-button"
                        onClick={() => {
                          const domains = draft.domains.filter((x) => x !== d);
                          const active_domain =
                            draft.active_domain === d ? "" : draft.active_domain;
                          set("domains", domains);
                          set("active_domain", active_domain);
                          saveSite.mutate({ ...draft, domains, active_domain });
                        }}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  );
                })
              )}
            </div>
          </div>
        </TabsContent>

        {/* TASARIM */}
        <TabsContent value="tasarim" className="mt-6">
          <div className="max-w-3xl space-y-6 rounded-xl border border-[#1E293B] bg-[#121620] p-6">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {COLORS.map(({ key, label }) => (
                <div key={key} className="space-y-2">
                  <Label htmlFor={`color-${key}`}>{label}</Label>
                  <div className="flex items-center gap-2">
                    <input
                      id={`color-${key}`}
                      type="color"
                      value={draft.theme[key]}
                      onChange={(e) => set("theme", { ...draft.theme, [key]: e.target.value })}
                      className="h-9 w-10 cursor-pointer rounded border border-[#1E293B] bg-transparent"
                      data-testid={`theme-color-${key}`}
                    />
                    <code className="font-mono text-xs text-slate-400">{draft.theme[key]}</code>
                  </div>
                </div>
              ))}
            </div>

            <Field label="Kolon Sayısı (1-6)" id="f-cols">
              <Select
                value={String(draft.columns)}
                onValueChange={(v: string) => set("columns", Number(v))}
              >
                <SelectTrigger id="f-cols" data-testid="columns-select">
                  <SelectValue>{(v) => `${String(v)} Kolon`}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n} Kolon
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Özel CSS" id="f-css">
              <Textarea
                id="f-css"
                rows={5}
                className="font-mono text-xs"
                value={draft.custom_css}
                onChange={(e) => set("custom_css", e.target.value)}
                data-testid="field-custom-css"
              />
            </Field>
          </div>
        </TabsContent>

        {/* POPUP */}
        <TabsContent value="popup" className="mt-6">
          <div className="max-w-4xl space-y-5">
            <div className="space-y-4 rounded-xl border border-[#1E293B] bg-[#121620] p-6">
              <label className="flex items-center gap-3 text-sm">
                <Checkbox
                  checked={draft.popup.enabled}
                  onCheckedChange={(v) => set("popup", { ...draft.popup, enabled: Boolean(v) })}
                  data-testid="popup-enabled-checkbox"
                />
                Karşılama pop-up'ı aktif
              </label>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Pop-up Başlığı (boş bırakılabilir)" id="p-title">
                  <Input
                    id="p-title"
                    value={draft.popup.title}
                    onChange={(e) => set("popup", { ...draft.popup, title: e.target.value })}
                    data-testid="popup-title-input"
                  />
                </Field>
                <Field label="Pop-up Kolon Sayısı" id="p-cols">
                  <Select
                    value={String(draft.popup.columns)}
                    onValueChange={(v: string) => set("popup", { ...draft.popup, columns: Number(v) })}
                  >
                    <SelectTrigger id="p-cols" data-testid="popup-columns-select">
                      <SelectValue>{(v) => `${String(v)} Kolon`}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5, 6].map((n) => (
                        <SelectItem key={n} value={String(n)}>{n} Kolon</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <Field label="Alt Metin" id="p-sub">
                <Textarea
                  id="p-sub"
                  rows={2}
                  value={draft.popup.subtitle}
                  onChange={(e) => set("popup", { ...draft.popup, subtitle: e.target.value })}
                  data-testid="popup-subtitle-input"
                />
              </Field>
            </div>

            <div className="rounded-xl border border-[#1E293B] bg-[#121620] p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-heading text-base font-bold tracking-tight">Pop-up Reklam Kolonları</h2>
                  <p className="mt-1 text-xs text-slate-400">
                    Her kolon ayrı bir marka kartıdır; genişlik ve neon rengi ayrı ayrı ayarlanır.
                  </p>
                </div>
                <Button
                  className="bg-amber-500 font-bold text-black hover:bg-amber-400"
                  data-testid="add-popup-item-button"
                  onClick={() => {
                    const items = [...draft.popup.items, newPopupItem(draft.popup.items.length)];
                    set("popup", { ...draft.popup, items });
                  }}
                >
                  <Plus className="mr-1 h-4 w-4" /> Kolon Ekle
                </Button>
              </div>

              {draft.popup.items.length === 0 ? (
                <p className="rounded-lg border border-dashed border-[#1E293B] p-8 text-center text-sm text-slate-400" data-testid="popup-items-empty">
                  Henüz pop-up kolonu yok.
                </p>
              ) : (
                <div className="space-y-3" data-testid="popup-items-list">
                  {draft.popup.items.map((item, idx) => (
                    <div
                      key={item.id}
                      className={`rounded-lg border bg-[#0B0E17] p-4 transition-colors duration-150 ${
                        dragItem === idx ? "border-amber-500 opacity-60" : "border-[#1E293B]"
                      }`}
                      data-testid="popup-item-row"
                      draggable
                      onDragStart={() => setDragItem(idx)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (dragItem !== null && dragItem !== idx) reorderItems(dragItem, idx);
                        setDragItem(null);
                      }}
                      onDragEnd={() => setDragItem(null)}
                    >
                      <div className="mb-3 flex cursor-grab items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-500 active:cursor-grabbing">
                        <GripVertical className="h-3.5 w-3.5" /> Sürükleyerek sırala · {idx + 1}. kolon
                      </div>
                      <div className="grid gap-3 md:grid-cols-4">
                        <Field label="Marka Adı" id={`pi-b-${item.id}`}>
                          <Input
                            id={`pi-b-${item.id}`}
                            value={item.brand_name}
                            onChange={(e) => patchItem(idx, { brand_name: e.target.value })}
                            data-testid="popup-item-brand-input"
                          />
                        </Field>
                        <Field label="Logo (kütüphaneden seç veya yükle)" id={`pi-l-${item.id}`}>
                          <LogoPickerDialog
                            value={item.logo_url}
                            onChange={(url) => patchItem(idx, { logo_url: url })}
                            testId="popup-item-logo"
                          />
                        </Field>
                        <Field label="1. Satır" id={`pi-1-${item.id}`}>
                          <Input
                            id={`pi-1-${item.id}`}
                            value={item.line1}
                            onChange={(e) => patchItem(idx, { line1: e.target.value })}
                            data-testid="popup-item-line1-input"
                          />
                        </Field>
                        <Field label="2. Satır" id={`pi-2-${item.id}`}>
                          <Input
                            id={`pi-2-${item.id}`}
                            value={item.line2}
                            onChange={(e) => patchItem(idx, { line2: e.target.value })}
                            data-testid="popup-item-line2-input"
                          />
                        </Field>
                        <Field label="Hedef Link" id={`pi-u-${item.id}`}>
                          <Input
                            id={`pi-u-${item.id}`}
                            value={item.url}
                            onChange={(e) => patchItem(idx, { url: e.target.value })}
                            data-testid="popup-item-url-input"
                          />
                        </Field>
                        <Field label="Kolon Genişliği" id={`pi-s-${item.id}`}>
                          <Select
                            value={String(item.col_span)}
                            onValueChange={(v: string) => patchItem(idx, { col_span: Number(v) })}
                          >
                            <SelectTrigger id={`pi-s-${item.id}`} data-testid="popup-item-span-select">
                              <SelectValue>{(v) => `${String(v)} kolon`}</SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {[1, 2, 3, 4, 5, 6].map((n) => (
                                <SelectItem key={n} value={String(n)}>{n} kolon</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </Field>
                        <Field label="Neon Renk" id={`pi-c-${item.id}`}>
                          <div className="flex items-center gap-2">
                            <input
                              id={`pi-c-${item.id}`}
                              type="color"
                              value={item.border_color}
                              onChange={(e) => patchItem(idx, { border_color: e.target.value })}
                              className="h-9 w-10 cursor-pointer rounded border border-[#1E293B] bg-transparent"
                              data-testid="popup-item-color-input"
                            />
                            <code className="font-mono text-xs text-slate-400">{item.border_color}</code>
                          </div>
                        </Field>
                        <div className="flex items-end gap-2">
                          <button
                            className="rounded border border-[#1E293B] p-2 text-slate-400 hover:text-slate-100"
                            aria-label="Yukarı taşı"
                            data-testid="popup-item-up-button"
                            onClick={() => moveItem(idx, -1)}
                          >
                            <ChevronUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            className="rounded border border-[#1E293B] p-2 text-slate-400 hover:text-slate-100"
                            aria-label="Aşağı taşı"
                            data-testid="popup-item-down-button"
                            onClick={() => moveItem(idx, 1)}
                          >
                            <ChevronDown className="h-3.5 w-3.5" />
                          </button>
                          <button
                            className="rounded border border-[#1E293B] p-2 text-slate-400 hover:text-red-400"
                            aria-label="Kolonu sil"
                            data-testid="popup-item-delete-button"
                            onClick={() => {
                              const items = draft.popup.items.filter((_, i) => i !== idx);
                              set("popup", { ...draft.popup, items });
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <p className="mt-4 text-xs text-slate-500">
                Değişiklikler "Değişiklikleri Kaydet" ile yayına alınır.
              </p>
            </div>
          </div>
        </TabsContent>

        {/* REKLAM ALANLARI */}
        <TabsContent value="reklam" className="mt-6">
          <div className="mb-4 flex flex-wrap gap-2">
            {(["image", "html", "cta"] as AdType[]).map((t) => (
              <Button
                key={t}
                variant="outline"
                className="border-[#1E293B]"
                onClick={() => addSlot.mutate(t)}
                data-testid={`add-slot-${t}-button`}
              >
                <Plus className="mr-1 h-4 w-4" /> {AD_TYPE_LABELS[t]}
              </Button>
            ))}
            <Button
              variant="outline"
              className="ml-auto border-[#1E293B]"
              onClick={() => checkLinks.mutate()}
              disabled={checkLinks.isPending}
              data-testid="check-links-button"
            >
              {checkLinks.isPending ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Link2 className="mr-1 h-4 w-4" />
              )}
              {checkLinks.isPending ? "Kontrol ediliyor" : "Linkleri Kontrol Et"}
            </Button>
          </div>

          {list.length > 1 ? (
            <p className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <GripVertical className="h-3.5 w-3.5" /> Kartları sürükleyip bırakarak sırayı değiştirebilirsiniz.
              </span>
              {list.some((s) => s.link_status !== "unknown" && s.link_status !== "ok") ? (
                <span className="font-bold text-red-400" data-testid="link-problem-summary">
                  {list.filter((s) => s.link_status !== "unknown" && s.link_status !== "ok").length} kartta link sorunu var
                </span>
              ) : null}
            </p>
          ) : null}

          {list.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#1E293B] p-10 text-center text-sm text-slate-400" data-testid="slots-empty-state">
              Bu site için henüz reklam alanı yok.
            </div>
          ) : (
            <div className="space-y-4" data-testid="slots-list">
              {list.map((slot, idx) => (
                <div
                  key={slot.id}
                  className={`rounded-lg border bg-[#121620] px-4 py-3 transition-colors duration-150 ${
                    dragSlot === idx ? "border-amber-500 opacity-60" : "border-[#1E293B]"
                  }`}
                  data-testid="slot-editor-card"
                  draggable
                  onDragStart={() => setDragSlot(idx)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragSlot !== null && dragSlot !== idx) {
                      const ids = list.map((s) => s.id);
                      const [moved] = ids.splice(dragSlot, 1);
                      ids.splice(idx, 0, moved);
                      reorderSlots.mutate(ids);
                    }
                    setDragSlot(null);
                  }}
                  onDragEnd={() => setDragSlot(null)}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="flex cursor-grab items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-slate-500 active:cursor-grabbing">
                        <GripVertical className="h-3.5 w-3.5" /> {idx + 1}
                      </span>
                      {slot.image_url ? (
                        <img src={slot.image_url} alt="" className="h-5 w-10 shrink-0 object-contain" />
                      ) : null}
                      <span className="truncate font-heading text-sm font-bold tracking-tight" data-testid="slot-summary-title">
                        {slot.title || "(başlıksız)"}
                      </span>
                      <span
                        className="h-3 w-3 shrink-0 rounded-full border border-white/20"
                        style={{ background: slot.border_color }}
                        aria-hidden
                      />
                      <span className="hidden rounded bg-[#1E293B] px-1.5 py-0.5 text-[10px] font-bold tracking-widest text-amber-400 sm:inline">
                        {AD_TYPE_LABELS[slot.type]}
                      </span>
                      {slot.link_status !== "unknown" && slot.link_status !== "ok" ? (
                        <span
                          className="inline-flex shrink-0 items-center gap-1 rounded bg-red-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-400 ring-1 ring-red-500/40"
                          title={`${LINK_STATUS_LABELS[slot.link_status]}${slot.link_http_status ? ` (HTTP ${slot.link_http_status})` : ""}`}
                          data-testid="slot-link-broken-badge"
                        >
                          <ShieldAlert className="h-3 w-3" />
                          {LINK_STATUS_LABELS[slot.link_status]}
                          {slot.link_http_status ? ` ${slot.link_http_status}` : ""}
                        </span>
                      ) : null}
                      {slot.link_status === "ok" ? (
                        <span
                          className="hidden shrink-0 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-400 sm:inline"
                          data-testid="slot-link-ok-badge"
                        >
                          link ok
                        </span>
                      ) : null}
                      <span className="hidden font-mono text-[10px] text-slate-500 md:inline">
                        {slot.col_span} kolon · {TEXT_SIZE_LABELS[slot.text_size]} yazı · {slot.clicks} tıklama ·{" "}
                        {slot.active ? "yayında" : "pasif"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        className="flex items-center gap-1 rounded border border-[#1E293B] px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-300 transition-colors duration-150 hover:border-amber-500/60 hover:text-amber-400"
                        data-testid="slot-edit-toggle"
                        aria-expanded={openSlot === slot.id}
                        onClick={() => setOpenSlot(openSlot === slot.id ? null : slot.id)}
                      >
                        <Pencil className="h-3 w-3" />
                        {openSlot === slot.id ? "Kapat" : "Düzenle"}
                      </button>
                      <button
                        className="rounded border border-[#1E293B] p-1.5 text-slate-400 hover:text-slate-100"
                        aria-label="Yukarı taşı"
                        data-testid="slot-move-up-button"
                        disabled={idx === 0}
                        onClick={() => {
                          const ids = list.map((s) => s.id);
                          if (idx === 0) return;
                          [ids[idx - 1], ids[idx]] = [ids[idx], ids[idx - 1]];
                          reorderSlots.mutate(ids);
                        }}
                      >
                        <ChevronUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        className="rounded border border-[#1E293B] p-1.5 text-slate-400 hover:text-slate-100"
                        aria-label="Aşağı taşı"
                        data-testid="slot-move-down-button"
                        disabled={idx === list.length - 1}
                        onClick={() => {
                          const ids = list.map((s) => s.id);
                          if (idx >= ids.length - 1) return;
                          [ids[idx], ids[idx + 1]] = [ids[idx + 1], ids[idx]];
                          reorderSlots.mutate(ids);
                        }}
                      >
                        <ChevronDown className="h-3.5 w-3.5" />
                      </button>
                      <button
                        className="rounded border border-[#1E293B] p-1.5 text-slate-400 hover:text-red-400"
                        aria-label="Reklam alanını sil"
                        data-testid="slot-delete-button"
                        onClick={() => removeSlot.mutate(slot.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className={`${openSlot === slot.id ? "mt-4 grid" : "hidden"} gap-4 md:grid-cols-2`} data-testid="slot-detail-panel">
                    <Field label="Başlık" id={`s-title-${slot.id}`}>
                      <Input
                        id={`s-title-${slot.id}`}
                        defaultValue={slot.title}
                        onBlur={(e) => updateSlot.mutate({ id: slot.id, patch: { title: e.target.value } })}
                        data-testid="slot-title-input"
                      />
                    </Field>
                    <Field label="Rozet" id={`s-badge-${slot.id}`}>
                      <Input
                        id={`s-badge-${slot.id}`}
                        defaultValue={slot.badge}
                        onBlur={(e) => updateSlot.mutate({ id: slot.id, patch: { badge: e.target.value } })}
                        data-testid="slot-badge-input"
                      />
                    </Field>
                    <Field label="Rozet Konumu" id={`s-bpos-${slot.id}`}>
                      <Select
                        value={slot.badge_position}
                        onValueChange={(v: string) =>
                          updateSlot.mutate({ id: slot.id, patch: { badge_position: v as BadgePosition } })
                        }
                      >
                        <SelectTrigger id={`s-bpos-${slot.id}`} data-testid="slot-badge-position-select">
                          <SelectValue>{(v) => BADGE_POSITION_LABELS[v as string]}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {(["left", "center", "right"] as BadgePosition[]).map((p) => (
                            <SelectItem key={p} value={p}>
                              {BADGE_POSITION_LABELS[p]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Rozet Stili" id={`s-bst-${slot.id}`}>
                      <Select
                        value={slot.badge_style}
                        onValueChange={(v: string) =>
                          updateSlot.mutate({ id: slot.id, patch: { badge_style: v as BadgeStyle } })
                        }
                      >
                        <SelectTrigger id={`s-bst-${slot.id}`} data-testid="slot-badge-style-select">
                          <SelectValue>{(v) => BADGE_STYLE_LABELS[v as string]}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {(["tab", "corner", "strip", "ribbon"] as BadgeStyle[]).map((s) => (
                            <SelectItem key={s} value={s}>
                              {BADGE_STYLE_LABELS[s]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Rozet Arka Plan Rengi" id={`s-bbg-${slot.id}`}>
                      <div className="flex items-center gap-2">
                        <input
                          id={`s-bbg-${slot.id}`}
                          type="color"
                          defaultValue={slot.badge_bg || slot.border_color || "#22C55E"}
                          onBlur={(e) => updateSlot.mutate({ id: slot.id, patch: { badge_bg: e.target.value } })}
                          className="h-9 w-10 cursor-pointer rounded border border-[#1E293B] bg-transparent"
                          data-testid="slot-badge-bg-input"
                        />
                        <code className="font-mono text-xs text-slate-400">
                          {slot.badge_bg || "kart rengi"}
                        </code>
                      </div>
                    </Field>
                    <Field label="Rozet Yazı Rengi" id={`s-bfg-${slot.id}`}>
                      <div className="flex items-center gap-2">
                        <input
                          id={`s-bfg-${slot.id}`}
                          type="color"
                          defaultValue={slot.badge_text_color || "#000000"}
                          onBlur={(e) =>
                            updateSlot.mutate({ id: slot.id, patch: { badge_text_color: e.target.value } })
                          }
                          className="h-9 w-10 cursor-pointer rounded border border-[#1E293B] bg-transparent"
                          data-testid="slot-badge-text-input"
                        />
                        <code className="font-mono text-xs text-slate-400">
                          {slot.badge_text_color || "siyah"}
                        </code>
                      </div>
                    </Field>
                    <Field label="Yazı Boyutu" id={`s-ts-${slot.id}`}>
                      <Select
                        value={slot.text_size}
                        onValueChange={(v: string) =>
                          updateSlot.mutate({ id: slot.id, patch: { text_size: v as TextSize } })
                        }
                      >
                        <SelectTrigger id={`s-ts-${slot.id}`} data-testid="slot-text-size-select">
                          <SelectValue>{(v) => TEXT_SIZE_LABELS[v as string]}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {(["sm", "md", "lg"] as TextSize[]).map((s) => (
                            <SelectItem key={s} value={s}>
                              {TEXT_SIZE_LABELS[s]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    {slot.type === "html" ? (
                      <div className="md:col-span-2">
                        <Field label="HTML / Embed Kodu" id={`s-html-${slot.id}`}>
                          <Textarea
                            id={`s-html-${slot.id}`}
                            rows={4}
                            className="font-mono text-xs"
                            defaultValue={slot.html}
                            onBlur={(e) => updateSlot.mutate({ id: slot.id, patch: { html: e.target.value } })}
                            data-testid="slot-html-input"
                          />
                        </Field>
                      </div>
                    ) : (
                      <>
                        <Field label="Marka Logosu (kütüphaneden seç veya yükle)" id={`s-img-${slot.id}`}>
                          <LogoPickerDialog
                            value={slot.image_url}
                            onChange={(url) => updateSlot.mutate({ id: slot.id, patch: { image_url: url } })}
                            testId="slot-logo"
                          />
                        </Field>
                        <Field label="Hedef Link" id={`s-url-${slot.id}`}>
                          <Input
                            id={`s-url-${slot.id}`}
                            defaultValue={slot.target_url}
                            onBlur={(e) => updateSlot.mutate({ id: slot.id, patch: { target_url: e.target.value } })}
                            data-testid="slot-target-input"
                          />
                        </Field>
                        <Field label="1. Satır (bonus metni)" id={`s-desc-${slot.id}`}>
                          <Input
                            id={`s-desc-${slot.id}`}
                            defaultValue={slot.description}
                            onBlur={(e) => updateSlot.mutate({ id: slot.id, patch: { description: e.target.value } })}
                            data-testid="slot-description-input"
                          />
                        </Field>
                        <Field label="2. Satır" id={`s-line2-${slot.id}`}>
                          <Input
                            id={`s-line2-${slot.id}`}
                            defaultValue={slot.line2}
                            onBlur={(e) => updateSlot.mutate({ id: slot.id, patch: { line2: e.target.value } })}
                            data-testid="slot-line2-input"
                          />
                        </Field>
                      </>
                    )}
                    <Field label="Kolon Genişliği" id={`s-span-${slot.id}`}>
                      <Select
                        value={String(slot.col_span)}
                        onValueChange={(v: string) => updateSlot.mutate({ id: slot.id, patch: { col_span: Number(v) } })}
                      >
                        <SelectTrigger id={`s-span-${slot.id}`} data-testid="slot-span-select">
                          <SelectValue>{(v) => `${String(v)} kolon`}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 4, 5, 6].map((n) => (
                            <SelectItem key={n} value={String(n)}>{n} kolon</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Arka Plan Efekti" id={`s-fx-${slot.id}`}>
                      <Select
                        value={slot.effect}
                        onValueChange={(v: string) =>
                          updateSlot.mutate({ id: slot.id, patch: { effect: v as CardEffect } })
                        }
                      >
                        <SelectTrigger id={`s-fx-${slot.id}`} data-testid="slot-effect-select">
                          <SelectValue>{(v) => CARD_EFFECT_LABELS[v as string]}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {(["none", "glow", "sweep", "aurora", "border"] as CardEffect[]).map((e) => (
                            <SelectItem key={e} value={e}>
                              {CARD_EFFECT_LABELS[e]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Efekt Hızı (saniye)" id={`s-fxs-${slot.id}`}>
                      <Input
                        id={`s-fxs-${slot.id}`}
                        type="number"
                        min={1}
                        max={30}
                        defaultValue={slot.effect_speed}
                        onBlur={(e) =>
                          updateSlot.mutate({
                            id: slot.id,
                            patch: { effect_speed: Math.max(1, Math.min(30, Number(e.target.value) || 6)) },
                          })
                        }
                        data-testid="slot-effect-speed-input"
                      />
                    </Field>
                    <Field label="Yükseklik (px)" id={`s-h-${slot.id}`}>
                      <Input
                        id={`s-h-${slot.id}`}
                        type="number"
                        defaultValue={slot.height}
                        onBlur={(e) => updateSlot.mutate({ id: slot.id, patch: { height: Number(e.target.value) || 150 } })}
                        data-testid="slot-height-input"
                      />
                    </Field>
                    <Field label="Neon Çerçeve Rengi" id={`s-c-${slot.id}`}>
                      <div className="flex items-center gap-2">
                        <input
                          id={`s-c-${slot.id}`}
                          type="color"
                          defaultValue={slot.border_color || "#22C55E"}
                          onBlur={(e) => updateSlot.mutate({ id: slot.id, patch: { border_color: e.target.value } })}
                          className="h-9 w-10 cursor-pointer rounded border border-[#1E293B] bg-transparent"
                          data-testid="slot-color-input"
                        />
                        <code className="font-mono text-xs text-slate-400">{slot.border_color}</code>
                      </div>
                    </Field>
                  </div>

                  {openSlot === slot.id ? (
                    <label className="mt-4 flex items-center gap-3 text-sm">
                      <Checkbox
                        checked={slot.active}
                        onCheckedChange={(v) => updateSlot.mutate({ id: slot.id, patch: { active: Boolean(v) } })}
                        data-testid="slot-active-checkbox"
                      />
                      Yayında
                    </label>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </AdminShell>
  );
}

function newPopupItem(index: number): PopupItem {
  return {
    id: `tmp-${Date.now()}-${index}`,
    brand_name: "YENİ MARKA",
    logo_url: "",
    line1: "500₺ DENEME BONUSU",
    line2: "%30 KAYIP BONUSU",
    url: "https://example.com",
    border_color: NEON_COLORS[index % NEON_COLORS.length],
    col_span: 1,
    order: index,
  };
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}
