import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import AdminShell from "@/components/admin/AdminShell";
import { apiDelete, apiGet, apiPost } from "@/lib/api";
import type { DesignTemplate, Site } from "@/lib/types";
import { Layers, Plus, Trash2, Wand2, X } from "lucide-react";
import { toast } from "sonner";

const btn =
  "inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3.5 py-2 text-xs font-bold text-[#0B0E17] transition-transform duration-150 hover:scale-[1.03] disabled:opacity-50";
const ghost =
  "inline-flex items-center gap-1.5 rounded-lg border border-[#1E293B] px-3 py-2 text-xs text-slate-300 transition-colors duration-150 hover:border-slate-500";
const input =
  "w-full rounded-lg border border-[#1E293B] bg-[#0B0E17] px-3 py-2 text-sm text-slate-100 outline-none transition-colors duration-150 focus:border-amber-500/70";

function errText(e: unknown): string {
  const detail = (e as { body?: { detail?: unknown } })?.body?.detail;
  return typeof detail === "string" ? detail : "İşlem başarısız";
}

export default function AdminTemplates() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [saveOpen, setSaveOpen] = useState(false);
  const [useTemplate, setUseTemplate] = useState<DesignTemplate | null>(null);

  const templatesQ = useQuery({
    queryKey: ["templates"],
    queryFn: () => apiGet<DesignTemplate[]>("/templates"),
  });
  const sitesQ = useQuery({ queryKey: ["sites"], queryFn: () => apiGet<Site[]>("/sites") });

  const remove = useMutation({
    mutationFn: (id: string) => apiDelete<{ ok: boolean }>(`/templates/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["templates"] });
      toast.success("Şablon silindi");
    },
    onError: (e) => toast.error(errText(e)),
  });

  const templates = templatesQ.data ?? [];

  return (
    <AdminShell>
      <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-extrabold tracking-tight text-slate-50">
            Default Tasarımlar
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-400">
            Beğendiğiniz bir sitenin tasarımını isimlendirip buraya kaydedin. Şablona tıklayıp
            <span className="text-amber-400"> "Bu tasarımla site oluştur"</span> ile saniyeler içinde
            aynı görünümde yeni bir site açın.
          </p>
        </div>
        <button className={btn} onClick={() => setSaveOpen(true)} data-testid="template-save-open-button">
          <Plus className="h-3.5 w-3.5" /> Siteden şablon kaydet
        </button>
      </header>

      {templatesQ.isLoading ? (
        <p className="text-sm text-slate-400" data-testid="templates-loading">
          Yükleniyor…
        </p>
      ) : templates.length === 0 ? (
        <div
          className="rounded-2xl border border-dashed border-[#1E293B] bg-[#0F1320]/60 p-10 text-center"
          data-testid="templates-empty"
        >
          <Layers className="mx-auto h-8 w-8 text-slate-600" />
          <p className="mt-3 text-sm text-slate-400">
            Henüz şablon yok. "Siteden şablon kaydet" ile ilk tasarımınızı ekleyin.
          </p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3" data-testid="templates-grid">
          {templates.map((t) => (
            <article
              key={t.id}
              data-testid={`template-card-${t.id}`}
              onClick={() => setUseTemplate(t)}
              className="group cursor-pointer overflow-hidden rounded-2xl border border-[#1E293B] bg-[#0F1320]/80 shadow-[0_18px_40px_-28px_rgba(0,0,0,0.9)] transition-[transform,border-color] duration-200 hover:-translate-y-1 hover:border-amber-500/60"
            >
              <div
                className="relative h-28 border-b border-[#1E293B]"
                style={{
                  background: `linear-gradient(120deg, ${t.snapshot.theme.bg} 0%, ${t.snapshot.theme.panel} 55%, ${t.snapshot.theme.accent}33 100%)`,
                }}
              >
                <div className="absolute inset-x-4 bottom-3 flex gap-1.5">
                  {[t.snapshot.theme.accent, t.snapshot.theme.accent2, t.snapshot.theme.card].map(
                    (c, i) => (
                      <span
                        key={`${t.id}-sw-${i}`}
                        className="h-2.5 w-8 rounded-full"
                        style={{ background: c }}
                      />
                    ),
                  )}
                </div>
              </div>
              <div className="p-4">
                <h2
                  className="font-heading text-base font-bold text-slate-100"
                  data-testid={`template-name-${t.id}`}
                >
                  {t.name}
                </h2>
                <p className="mt-1 text-xs text-slate-400" data-testid={`template-meta-${t.id}`}>
                  {t.snapshot.columns} kolon · {t.snapshot.slots.length} kart ·{" "}
                  {t.snapshot.popup.items.length} pop-up kolonu
                  {t.source_site_slug ? ` · kaynak: ${t.source_site_slug}` : ""}
                </p>
                {t.description ? (
                  <p className="mt-2 line-clamp-2 text-xs text-slate-500">{t.description}</p>
                ) : null}
                <div className="mt-4 flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-400 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                    <Wand2 className="h-3.5 w-3.5" /> Bu tasarımla site oluştur
                  </span>
                  <button
                    className="rounded-lg p-1.5 text-slate-500 transition-colors duration-150 hover:bg-red-500/10 hover:text-red-400"
                    data-testid={`template-delete-${t.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm(`"${t.name}" şablonu silinsin mi?`)) remove.mutate(t.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {saveOpen ? (
        <SaveTemplateDialog
          sites={sitesQ.data ?? []}
          onClose={() => setSaveOpen(false)}
          onSaved={() => {
            setSaveOpen(false);
            void qc.invalidateQueries({ queryKey: ["templates"] });
          }}
        />
      ) : null}

      {useTemplate ? (
        <UseTemplateDialog
          template={useTemplate}
          onClose={() => setUseTemplate(null)}
          onCreated={(site) => {
            setUseTemplate(null);
            void qc.invalidateQueries({ queryKey: ["sites"] });
            void qc.invalidateQueries({ queryKey: ["templates"] });
            navigate(`/admin/sites/${site.id}`);
          }}
        />
      ) : null}
    </AdminShell>
  );
}

function Modal({
  title,
  onClose,
  children,
  testid,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  testid: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div
        className="w-full max-w-md rounded-2xl border border-[#1E293B] bg-[#0F1320] p-5 shadow-2xl"
        data-testid={testid}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-heading text-lg font-bold text-slate-100">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition-colors duration-150 hover:text-slate-100"
            data-testid={`${testid}-close`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function SaveTemplateDialog({
  sites,
  onClose,
  onSaved,
}: {
  sites: Site[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [siteId, setSiteId] = useState(sites[0]?.id ?? "");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [includeSlots, setIncludeSlots] = useState(true);

  const save = useMutation({
    mutationFn: () =>
      apiPost<DesignTemplate>("/templates", {
        name,
        source_site_id: siteId,
        description,
        include_slots: includeSlots,
      }),
    onSuccess: (t) => {
      toast.success(`"${t.name}" şablonu kaydedildi`);
      onSaved();
    },
    onError: (e) => toast.error(errText(e)),
  });

  return (
    <Modal title="Siteden şablon kaydet" onClose={onClose} testid="template-save-dialog">
      <div className="space-y-3">
        <label className="block text-xs text-slate-400">
          Kaynak site
          <select
            className={`${input} mt-1`}
            value={siteId}
            onChange={(e) => setSiteId(e.target.value)}
            data-testid="template-save-site-select"
          >
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.slug})
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-slate-400">
          Şablon adı
          <input
            className={`${input} mt-1`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Bant Ayar"
            data-testid="template-save-name-input"
          />
        </label>
        <label className="block text-xs text-slate-400">
          Açıklama (opsiyonel)
          <input
            className={`${input} mt-1`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Bantlı üst düzen, 4 kolon, turuncu vurgu"
            data-testid="template-save-description-input"
          />
        </label>
        <label className="flex items-center gap-2 text-xs text-slate-300">
          <input
            type="checkbox"
            checked={includeSlots}
            onChange={(e) => setIncludeSlots(e.target.checked)}
            data-testid="template-save-include-slots"
          />
          Reklam kartlarını da şablona al
        </label>
        <button
          className={`${btn} w-full justify-center`}
          disabled={!siteId || name.trim().length < 2 || save.isPending}
          onClick={() => save.mutate()}
          data-testid="template-save-submit-button"
        >
          Şablonu kaydet
        </button>
      </div>
    </Modal>
  );
}

function UseTemplateDialog({
  template,
  onClose,
  onCreated,
}: {
  template: DesignTemplate;
  onClose: () => void;
  onCreated: (site: Site) => void;
}) {
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [domains, setDomains] = useState("");
  const [includeSlots, setIncludeSlots] = useState(true);

  const create = useMutation({
    mutationFn: () =>
      apiPost<Site>(`/templates/${template.id}/create-site`, {
        slug,
        name,
        domains: domains
          .split(",")
          .map((d) => d.trim())
          .filter(Boolean),
        include_slots: includeSlots,
      }),
    onSuccess: (site) => {
      toast.success(`${site.name} oluşturuldu`);
      onCreated(site);
    },
    onError: (e) => toast.error(errText(e)),
  });

  return (
    <Modal
      title={`"${template.name}" ile site oluştur`}
      onClose={onClose}
      testid="template-use-dialog"
    >
      <div className="space-y-3">
        <label className="block text-xs text-slate-400">
          Slug (kısa ad)
          <input
            className={`${input} mt-1`}
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="harem5"
            data-testid="template-use-slug-input"
          />
        </label>
        <label className="block text-xs text-slate-400">
          Görünen isim
          <input
            className={`${input} mt-1`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Harem5"
            data-testid="template-use-name-input"
          />
        </label>
        <label className="block text-xs text-slate-400">
          Domainler (virgülle)
          <input
            className={`${input} mt-1`}
            value={domains}
            onChange={(e) => setDomains(e.target.value)}
            placeholder="harem5.com"
            data-testid="template-use-domains-input"
          />
        </label>
        <label className="flex items-center gap-2 text-xs text-slate-300">
          <input
            type="checkbox"
            checked={includeSlots}
            onChange={(e) => setIncludeSlots(e.target.checked)}
            data-testid="template-use-include-slots"
          />
          Şablondaki {template.snapshot.slots.length} reklam kartını da kopyala
        </label>
        <button
          className={`${btn} w-full justify-center`}
          disabled={slug.trim().length < 2 || create.isPending}
          onClick={() => create.mutate()}
          data-testid="template-use-submit-button"
        >
          <Wand2 className="h-3.5 w-3.5" /> Bu tasarımla site oluştur
        </button>
      </div>
    </Modal>
  );
}
