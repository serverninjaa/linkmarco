import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/api";
import type { CfDomainRemoveResult, CfRecord, CfRecordInput, CfStatus, CfZone, Site } from "@/lib/types";import AdminShell from "@/components/admin/AdminShell";
import { Cloud, Server, ShieldCheck, Copy, Plus, Trash2, RefreshCw, Zap, Check, X } from "lucide-react";
import { toast } from "sonner";
import { DomainVerifyPanel, ZoneSslPanel } from "@/components/admin/CloudflarePanels";

const NGINX = `server {
  listen 80;
  server_name _;            # tüm bağlı domainler
  location /api/ { proxy_pass http://127.0.0.1:8001; }
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;   # Host başlığı domain eşleme için şart
  }
}`;

const field =
  "w-full rounded-lg border border-[#1E293B] bg-[#0B0E17] px-3 py-2 text-sm text-slate-200 outline-none transition-colors focus:border-amber-500";
const btn =
  "inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 text-xs font-bold text-[#0B0E17] transition-transform hover:scale-[1.03] disabled:opacity-50";
const ghost =
  "inline-flex items-center gap-1.5 rounded-lg border border-[#1E293B] px-3 py-2 text-xs text-slate-300 transition-colors hover:border-slate-500";

function errText(e: unknown): string {
  const detail = (e as { body?: { detail?: unknown } })?.body?.detail;
  return typeof detail === "string" ? detail : "İşlem başarısız";
}

export default function AdminCloudflare() {
  const qc = useQueryClient();
  const [serverIp, setServerIp] = useState("");
  const [newZone, setNewZone] = useState("");
  const [openZone, setOpenZone] = useState<string | null>(null);
  const [autowireDomain, setAutowireDomain] = useState("");
  const [autowireSiteId, setAutowireSiteId] = useState("");
  const [removeTarget, setRemoveTarget] = useState<{ domain: string; siteId: string; deleteDns: boolean } | null>(null);
  const [rec, setRec] = useState<CfRecordInput>({ type: "A", name: "", content: "", ttl: 1, proxied: true });

  const { data: sites } = useQuery({ queryKey: ["sites"], queryFn: () => apiGet<Site[]>("/sites"), retry: false });
  const statusQ = useQuery({ queryKey: ["cf-status"], queryFn: () => apiGet<CfStatus>("/cloudflare/status"), retry: false });
  const live = statusQ.data?.token_valid === true;

  const zonesQ = useQuery({
    queryKey: ["cf-zones"],
    queryFn: () => apiGet<CfZone[]>("/cloudflare/zones"),
    enabled: live,
    retry: false,
  });

  const recordsQ = useQuery({
    queryKey: ["cf-records", openZone],
    queryFn: () => apiGet<CfRecord[]>(`/cloudflare/zones/${openZone}/records`),
    enabled: !!openZone,
    retry: false,
  });

  const saveIp = useMutation({    mutationFn: () => apiPut<CfStatus>("/cloudflare/settings", { server_ip: serverIp }),
    onSuccess: (s) => {
      qc.setQueryData(["cf-status"], s);
      toast.success("Sunucu IP kaydedildi");
    },
    onError: (e) => toast.error(errText(e)),
  });

  const autoPurge = useMutation({
    mutationFn: (value: boolean) => apiPut<CfStatus>("/cloudflare/auto-purge", { auto_purge: value }),
    onSuccess: (s) => {
      qc.setQueryData(["cf-status"], s);
      toast.success(s.auto_purge ? "Otomatik önbellek temizliği açık" : "Otomatik önbellek temizliği kapalı");
    },
    onError: (e) => toast.error(errText(e)),
  });

  const removeDomain = useMutation({
    mutationFn: (v: { siteId: string; domain: string; deleteDns: boolean }) =>
      apiPost<CfDomainRemoveResult>("/cloudflare/remove-domain", {
        site_id: v.siteId,
        domain: v.domain,
        delete_dns: v.deleteDns,
      }),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: ["sites"] });
      void qc.invalidateQueries({ queryKey: ["cf-verify-domains"] });
      toast.success(
        r.warning
          ? `${r.domain} kaldırıldı — ${r.warning}`
          : r.deleted_records.length > 0
            ? `${r.domain} kaldırıldı, DNS kayıtları silindi: ${r.deleted_records.join(", ")}`
            : `${r.domain} panelden kaldırıldı`,
      );
    },
    onError: (e) => toast.error(errText(e)),
  });

  const createZone = useMutation({
    mutationFn: () => apiPost<CfZone>("/cloudflare/zones", { name: newZone }),
    onSuccess: () => {
      setNewZone("");
      void qc.invalidateQueries({ queryKey: ["cf-zones"] });
      toast.success("Zone oluşturuldu — nameserver'ları kayıt firmanızda güncelleyin");
    },
    onError: (e) => toast.error(errText(e)),
  });

  const autowire = useMutation({    mutationFn: (opts?: { domain?: string; siteId?: string }) =>
      apiPost<{ created_zone: boolean; name_servers: string[] }>("/cloudflare/autowire", {
        domain: opts?.domain ?? autowireDomain,
        site_id: (opts?.siteId ?? autowireSiteId) || null,
      }),
    onSuccess: (r) => {
      setAutowireDomain("");
      void qc.invalidateQueries({ queryKey: ["cf-zones"] });
      void qc.invalidateQueries({ queryKey: ["cf-records"] });
      void qc.invalidateQueries({ queryKey: ["cf-verify-domains"] });
      void qc.invalidateQueries({ queryKey: ["sites"] });
      toast.success(r.created_zone ? `Zone açıldı, A kayıtları yazıldı. NS: ${r.name_servers.join(", ")}` : "A kayıtları yazıldı");
    },
    onError: (e) => toast.error(errText(e)),
  });

  const addRecord = useMutation({
    mutationFn: () => apiPost<CfRecord>(`/cloudflare/zones/${openZone}/records`, rec),
    onSuccess: () => {
      setRec({ type: "A", name: "", content: "", ttl: 1, proxied: true });
      void qc.invalidateQueries({ queryKey: ["cf-records", openZone] });
      toast.success("Kayıt eklendi");
    },
    onError: (e) => toast.error(errText(e)),
  });

  const toggleProxy = useMutation({
    mutationFn: (r: CfRecord) =>
      apiPut<CfRecord>(`/cloudflare/zones/${openZone}/records/${r.id}`, {
        type: r.type === "CNAME" ? "CNAME" : "A",
        name: r.name,
        content: r.content,
        ttl: r.ttl,
        proxied: !r.proxied,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["cf-records", openZone] });
      toast.success("Proxy durumu güncellendi");
    },
    onError: (e) => toast.error(errText(e)),
  });

  const delRecord = useMutation({
    mutationFn: (id: string) => apiDelete<{ ok: boolean }>(`/cloudflare/zones/${openZone}/records/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["cf-records", openZone] });
      toast.success("Kayıt silindi");
    },
    onError: (e) => toast.error(errText(e)),
  });

  const domains = (sites ?? []).flatMap((s) => s.domains.map((d) => ({ d, slug: s.slug, siteId: s.id })));
  const ip = statusQ.data?.server_ip || "SUNUCU_IP_ADRESINIZ";

  const copy = (text: string) => {
    void navigator.clipboard?.writeText(text);
    toast.success("Kopyalandı");
  };

  return (
    <AdminShell>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-black tracking-tight">Cloudflare / DNS Kurulumu</h1>
          <p className="mt-1 text-sm text-slate-400">
            Domainleri doğrudan Cloudflare hesabınızda açın, A kayıtlarını panelden yazın.
          </p>
        </div>
        <div
          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${
            live ? "border-emerald-700 text-emerald-400" : "border-rose-800 text-rose-400"
          }`}
          data-testid="cf-connection-status"
        >
          <Cloud className="h-4 w-4" />
          {statusQ.isLoading
            ? "Kontrol ediliyor…"
            : live
              ? `Bağlı${statusQ.data?.account_name ? ` — ${statusQ.data.account_name}` : ""}`
              : statusQ.data?.message || "Bağlantı yok"}
          <button onClick={() => void statusQ.refetch()} className="ml-1" data-testid="cf-refresh-status-button">
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Sunucu IP + hızlı bağlama */}
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-xl border border-[#1E293B] bg-[#121620] p-6">
          <h2 className="font-heading text-lg font-bold tracking-tight">Sunucu IP adresi</h2>
          <p className="mt-1 text-sm text-slate-400">A kayıtları bu IP'ye yazılır (proxy açık).</p>
          <div className="mt-4 flex gap-2">
            <input
              className={field}
              placeholder={statusQ.data?.server_ip || "örn. 203.0.113.10"}
              value={serverIp}
              onChange={(e) => setServerIp(e.target.value)}
              data-testid="cf-server-ip-input"
            />
            <button className={btn} onClick={() => saveIp.mutate()} disabled={!serverIp.trim()} data-testid="cf-save-ip-button">
              Kaydet
            </button>
          </div>
          {statusQ.data?.server_ip && (
            <p className="mt-2 text-xs text-slate-500" data-testid="cf-current-ip">
              Kayıtlı IP: <code className="font-mono text-cyan-300">{statusQ.data.server_ip}</code>
            </p>
          )}
          <button
            className={`${ghost} mt-4`}
            onClick={() => autoPurge.mutate(!(statusQ.data?.auto_purge ?? true))}
            disabled={!statusQ.data || autoPurge.isPending}
            data-testid="cf-auto-purge-toggle"
          >
            Tasarım kaydında önbelleği temizle:{" "}
            <span className={statusQ.data?.auto_purge ? "text-emerald-400" : "text-slate-500"}>
              {statusQ.data?.auto_purge ? "AÇIK" : "KAPALI"}
            </span>
          </button>
        </div>

        <div className="rounded-xl border border-[#1E293B] bg-[#121620] p-6">
          <h2 className="flex items-center gap-2 font-heading text-lg font-bold tracking-tight">
            <Zap className="h-4 w-4 text-amber-500" /> Tek tıkla domain bağla
          </h2>
          <p className="mt-1 text-sm text-slate-400">Zone yoksa açılır, @ ve www A kayıtları otomatik yazılır.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <input
              className={`${field} flex-1`}
              placeholder="ornek.com"
              value={autowireDomain}
              onChange={(e) => setAutowireDomain(e.target.value)}
              data-testid="cf-autowire-domain-input"
            />
            <select
              className={`${field} w-48`}
              value={autowireSiteId}
              onChange={(e) => setAutowireSiteId(e.target.value)}
              data-testid="cf-autowire-site-select"
            >
              <option value="">Siteye bağlama (opsiyonel)</option>
              {(sites ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <button
              className={btn}
              onClick={() => autowire.mutate(undefined)}
              disabled={!live || !autowireDomain.trim() || autowire.isPending}
              data-testid="cf-autowire-button"
            >
              {autowire.isPending ? "Yazılıyor…" : "Bağla"}
            </button>
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-5">
        <DomainVerifyPanel live={live} />
        <ZoneSslPanel zones={zonesQ.data ?? []} />
      </div>

      {/* Zone listesi */}
      <div className="mt-8 rounded-xl border border-[#1E293B] bg-[#121620] p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-heading text-lg font-bold tracking-tight">Cloudflare Zone'ları</h2>
          <div className="flex gap-2">
            <input
              className={`${field} w-56`}
              placeholder="yeni-domain.com"
              value={newZone}
              onChange={(e) => setNewZone(e.target.value)}
              data-testid="cf-new-zone-input"
            />
            <button
              className={btn}
              onClick={() => createZone.mutate()}
              disabled={!live || !newZone.trim() || createZone.isPending}
              data-testid="cf-create-zone-button"
            >
              <Plus className="h-3.5 w-3.5" /> Zone Ekle
            </button>
          </div>
        </div>

        {!live ? (
          <p className="text-sm text-rose-400" data-testid="cf-zones-disabled">
            Cloudflare token doğrulanamadı — zone işlemleri devre dışı.
          </p>
        ) : zonesQ.isLoading ? (
          <p className="text-sm text-slate-400">Yükleniyor…</p>
        ) : (zonesQ.data ?? []).length === 0 ? (
          <p className="text-sm text-slate-400" data-testid="cf-zones-empty">
            Hesapta zone yok. Yukarıdan ekleyin.
          </p>
        ) : (
          <div className="space-y-3" data-testid="cf-zone-list">
            {(zonesQ.data ?? []).map((z) => (
              <div key={z.id} className="rounded-lg border border-[#1E293B] bg-[#0B0E17]" data-testid="cf-zone-row">
                <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <code className="font-mono text-sm text-cyan-300">{z.name}</code>
                    <span
                      className={`ml-3 rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                        z.status === "active" ? "bg-emerald-900/50 text-emerald-400" : "bg-amber-900/40 text-amber-400"
                      }`}
                      data-testid="cf-zone-status"
                    >
                      {z.status}
                    </span>
                    {z.name_servers.length > 0 && (
                      <p className="mt-1 font-mono text-[11px] text-slate-500" data-testid="cf-zone-nameservers">
                        NS: {z.name_servers.join("  •  ")}
                      </p>
                    )}
                  </div>
                  <button
                    className={ghost}
                    onClick={() => setOpenZone(openZone === z.id ? null : z.id)}
                    data-testid="cf-zone-toggle-records-button"
                  >
                    {openZone === z.id ? "Kapat" : "DNS Kayıtları"}
                  </button>
                </div>

                {openZone === z.id && (
                  <div className="border-t border-[#1E293B] p-4" data-testid="cf-records-panel">
                    <div className="mb-3 grid gap-2 sm:grid-cols-[90px_1fr_1fr_auto]">
                      <select
                        className={field}
                        value={rec.type}
                        onChange={(e) => setRec({ ...rec, type: e.target.value as "A" | "CNAME" })}
                        data-testid="cf-record-type-select"
                      >
                        <option value="A">A</option>
                        <option value="CNAME">CNAME</option>
                      </select>
                      <input
                        className={field}
                        placeholder={`ad (örn. www.${z.name})`}
                        value={rec.name}
                        onChange={(e) => setRec({ ...rec, name: e.target.value })}
                        data-testid="cf-record-name-input"
                      />
                      <input
                        className={field}
                        placeholder={rec.type === "A" ? ip : "hedef.alan-adi.com"}
                        value={rec.content}
                        onChange={(e) => setRec({ ...rec, content: e.target.value })}
                        data-testid="cf-record-content-input"
                      />
                      <button
                        className={btn}
                        onClick={() => addRecord.mutate()}
                        disabled={!rec.name.trim() || !rec.content.trim() || addRecord.isPending}
                        data-testid="cf-add-record-button"
                      >
                        <Plus className="h-3.5 w-3.5" /> Ekle
                      </button>
                    </div>

                    {recordsQ.isLoading ? (
                      <p className="text-sm text-slate-400">Kayıtlar yükleniyor…</p>
                    ) : (recordsQ.data ?? []).length === 0 ? (
                      <p className="text-sm text-slate-400" data-testid="cf-records-empty">Kayıt yok.</p>
                    ) : (
                      <div className="space-y-1.5" data-testid="cf-record-list">
                        {(recordsQ.data ?? []).map((r) => (
                          <div
                            key={r.id}
                            className="flex flex-wrap items-center gap-3 rounded-lg border border-[#141B29] px-3 py-2 text-xs"
                            data-testid="cf-record-row"
                          >
                            <span className="w-14 font-mono font-bold text-amber-500">{r.type}</span>
                            <span className="flex-1 font-mono text-slate-200">{r.name}</span>
                            <span className="flex-1 font-mono text-slate-400">{r.content}</span>
                            <button
                              onClick={() => toggleProxy.mutate(r)}
                              className={`flex items-center gap-1 rounded px-2 py-1 ${
                                r.proxied ? "bg-amber-900/40 text-amber-400" : "bg-slate-800 text-slate-400"
                              }`}
                              data-testid="cf-record-proxy-toggle"
                            >
                              {r.proxied ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />} proxy
                            </button>
                            <button
                              onClick={() => delRecord.mutate(r.id)}
                              className="text-rose-400 hover:text-rose-300"
                              data-testid="cf-delete-record-button"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Rehber */}
      <div className="mt-8 grid gap-5 lg:grid-cols-3">
        {[
          {
            icon: Cloud,
            title: "1. Domaini zone olarak ekleyin",
            body: "Yukarıdan zone ekleyin, ardından kayıt firmanızdaki nameserver'ları Cloudflare'ın verdiği NS değerleriyle değiştirin.",
          },
          {
            icon: Server,
            title: "2. A kaydını yazın",
            body: `@ ve www için A kaydı → ${ip}. Proxy açık olmalı; Cloudflare SSL modu "Full (strict)" seçilmeli.`,
          },
          {
            icon: ShieldCheck,
            title: "3. Panelden domaini bağlayın",
            body: "İlgili sitenin 'Domainler' alanına domaini ekleyin. Sistem Host başlığına göre o sitenin tasarımını gösterir.",
          },
        ].map(({ icon: Icon, title, body }) => (
          <div key={title} className="rounded-xl border border-[#1E293B] bg-[#121620] p-5" data-testid="cf-step-card">
            <Icon className="h-5 w-5 text-amber-500" />
            <h2 className="mt-3 font-heading text-base font-bold tracking-tight">{title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">{body}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-xl border border-[#1E293B] bg-[#121620] p-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-heading text-lg font-bold tracking-tight">Nginx reverse proxy örneği</h2>
          <button onClick={() => copy(NGINX)} className={ghost} data-testid="copy-nginx-button">
            <Copy className="h-3.5 w-3.5" /> Kopyala
          </button>
        </div>
        <pre className="overflow-x-auto rounded-lg bg-[#0B0E17] p-4 font-mono text-xs leading-relaxed text-slate-300">
          {NGINX}
        </pre>
      </div>

      <div className="mt-8 rounded-xl border border-[#1E293B] bg-[#121620] p-6">
        <h2 className="mb-4 font-heading text-lg font-bold tracking-tight">Panelde Bağlı Domainler</h2>
        {domains.length === 0 ? (
          <p className="text-sm text-slate-400" data-testid="cf-domains-empty">Henüz bağlı domain yok.</p>
        ) : (
          <div className="space-y-2" data-testid="cf-domain-list">
            {domains.map(({ d, slug, siteId }) => (
              <div
                key={d}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#1E293B] bg-[#0B0E17] px-4 py-2.5"
                data-testid="cf-domain-row"
              >
                <code className="font-mono text-sm text-cyan-300">{d}</code>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500">→ /{slug}</span>
                  <button
                    className={ghost}
                    onClick={() => {
                      setAutowireDomain(d);
                      autowire.mutate({ domain: d });
                    }}
                    disabled={!live || autowire.isPending}
                    data-testid="cf-domain-autowire-button"
                  >
                    <Zap className="h-3.5 w-3.5" /> DNS yaz
                  </button>
                  <button
                    className={`${ghost} text-rose-400`}
                    onClick={() => setRemoveTarget({ domain: d, siteId, deleteDns: false })}
                    data-testid="cf-domain-remove-button"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Kaldır
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {removeTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          data-testid="cf-remove-domain-dialog"
        >
          <div className="w-full max-w-md rounded-xl border border-[#1E293B] bg-[#121620] p-6">
            <h3 className="font-heading text-lg font-bold tracking-tight">Domaini kaldır</h3>
            <p className="mt-2 text-sm text-slate-400">
              <code className="font-mono text-cyan-300">{removeTarget.domain}</code> panelden kaldırılacak.
              Bu domaine gelen ziyaretçiler artık bu siteyi görmez.
            </p>
            <label className="mt-4 flex items-start gap-2 rounded-lg border border-[#1E293B] bg-[#0B0E17] p-3 text-sm text-slate-300">
              <input
                type="checkbox"
                className="mt-0.5 accent-amber-500"
                checked={removeTarget.deleteDns}
                onChange={(e) => setRemoveTarget({ ...removeTarget, deleteDns: e.target.checked })}
                data-testid="cf-remove-delete-dns-checkbox"
              />
              <span>
                Cloudflare'daki DNS kayıtlarını da sil
                <span className="block text-xs text-slate-500">kök ve www A/CNAME kayıtları silinir</span>
              </span>
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button className={ghost} onClick={() => setRemoveTarget(null)} data-testid="cf-remove-cancel-button">
                Vazgeç
              </button>
              <button
                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-2 text-xs font-bold text-white transition-transform hover:scale-[1.03] disabled:opacity-50"
                onClick={() => {
                  removeDomain.mutate({
                    siteId: removeTarget.siteId,
                    domain: removeTarget.domain,
                    deleteDns: removeTarget.deleteDns,
                  });
                  setRemoveTarget(null);
                }}
                disabled={removeDomain.isPending}
                data-testid="cf-remove-confirm-button"
              >
                <Trash2 className="h-3.5 w-3.5" /> Kaldır
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
