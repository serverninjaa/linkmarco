import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/api";
import type { AdSlot, AdType, PopupItem, Site } from "@/lib/types";
import { AD_TYPE_LABELS, NEON_COLORS } from "@/lib/types";
import AdminShell from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, ExternalLink, ChevronUp, ChevronDown, X } from "lucide-react";

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
        </TabsList>

        {/* GENEL */}
        <TabsContent value="genel" className="mt-6">
          <div className="grid max-w-3xl gap-4 rounded-xl border border-[#1E293B] bg-[#121620] p-6">
            <Field label="Site Adı" id="f-name">
              <Input id="f-name" value={draft.name} onChange={(e) => set("name", e.target.value)} data-testid="field-name" />
            </Field>
            <Field label="Başlık (Hero)" id="f-title">
              <Input id="f-title" value={draft.title} onChange={(e) => set("title", e.target.value)} data-testid="field-title" />
            </Field>
            <Field label="Slogan" id="f-tagline">
              <Input id="f-tagline" value={draft.tagline} onChange={(e) => set("tagline", e.target.value)} data-testid="field-tagline" />
            </Field>
            <Field label="Logo Metni" id="f-logo">
              <Input id="f-logo" value={draft.logo_text} onChange={(e) => set("logo_text", e.target.value)} data-testid="field-logo" />
            </Field>
            <Field label="Hero Görsel URL" id="f-hero">
              <Input id="f-hero" value={draft.hero_image_url} onChange={(e) => set("hero_image_url", e.target.value)} data-testid="field-hero" />
            </Field>
            <Field label="Kayan Yazılar (her satır bir metin)" id="f-marquee">
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
                draft.domains.map((d) => (
                  <div
                    key={d}
                    className="flex items-center justify-between rounded-lg border border-[#1E293B] bg-[#0B0E17] px-4 py-2.5"
                    data-testid="domain-row"
                  >
                    <code className="font-mono text-sm text-cyan-300">{d}</code>
                    <button
                      className="text-slate-500 transition-colors duration-150 hover:text-red-400"
                      aria-label={`${d} kaldır`}
                      data-testid="remove-domain-button"
                      onClick={() => {
                        const domains = draft.domains.filter((x) => x !== d);
                        set("domains", domains);
                        saveSite.mutate({ ...draft, domains });
                      }}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))
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
                      className="rounded-lg border border-[#1E293B] bg-[#0B0E17] p-4"
                      data-testid="popup-item-row"
                    >
                      <div className="grid gap-3 md:grid-cols-4">
                        <Field label="Marka Adı" id={`pi-b-${item.id}`}>
                          <Input
                            id={`pi-b-${item.id}`}
                            value={item.brand_name}
                            onChange={(e) => patchItem(idx, { brand_name: e.target.value })}
                            data-testid="popup-item-brand-input"
                          />
                        </Field>
                        <Field label="Logo URL (ops.)" id={`pi-l-${item.id}`}>
                          <Input
                            id={`pi-l-${item.id}`}
                            value={item.logo_url}
                            onChange={(e) => patchItem(idx, { logo_url: e.target.value })}
                            data-testid="popup-item-logo-input"
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
          </div>

          {list.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#1E293B] p-10 text-center text-sm text-slate-400" data-testid="slots-empty-state">
              Bu site için henüz reklam alanı yok.
            </div>
          ) : (
            <div className="space-y-4" data-testid="slots-list">
              {list.map((slot, idx) => (
                <div key={slot.id} className="rounded-xl border border-[#1E293B] bg-[#121620] p-5" data-testid="slot-editor-card">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-[#1E293B] px-2 py-0.5 text-[11px] font-bold tracking-widest text-amber-400">
                        {AD_TYPE_LABELS[slot.type]}
                      </span>
                      <span className="font-mono text-xs text-slate-500">{slot.clicks} tıklama</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        className="rounded border border-[#1E293B] p-1.5 text-slate-400 hover:text-slate-100"
                        aria-label="Yukarı taşı"
                        data-testid="slot-move-up-button"
                        disabled={idx === 0}
                        onClick={() => updateSlot.mutate({ id: slot.id, patch: { order: Math.max(0, slot.order - 1) } })}
                      >
                        <ChevronUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        className="rounded border border-[#1E293B] p-1.5 text-slate-400 hover:text-slate-100"
                        aria-label="Aşağı taşı"
                        data-testid="slot-move-down-button"
                        onClick={() => updateSlot.mutate({ id: slot.id, patch: { order: slot.order + 1 } })}
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

                  <div className="grid gap-4 md:grid-cols-2">
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
                        <Field label="Görsel URL" id={`s-img-${slot.id}`}>
                          <Input
                            id={`s-img-${slot.id}`}
                            defaultValue={slot.image_url}
                            onBlur={(e) => updateSlot.mutate({ id: slot.id, patch: { image_url: e.target.value } })}
                            data-testid="slot-image-input"
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

                  <label className="mt-4 flex items-center gap-3 text-sm">
                    <Checkbox
                      checked={slot.active}
                      onCheckedChange={(v) => updateSlot.mutate({ id: slot.id, patch: { active: Boolean(v) } })}
                      data-testid="slot-active-checkbox"
                    />
                    Yayında
                  </label>
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
