import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import AdminShell from "@/components/admin/AdminShell";
import SslPanel from "@/components/admin/SslPanel";
import { apiGet, apiPut } from "@/lib/api";
import type { CfStatus, Site } from "@/lib/types";
import { ExternalLink, Server, Trash2 } from "lucide-react";
import { toast } from "sonner";

const field =
  "w-full rounded-lg border border-[#1E293B] bg-[#0B0E17] px-3 py-2 text-sm text-slate-200 outline-none transition-colors duration-150 focus:border-amber-500";
const btn =
  "inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 text-xs font-bold text-[#0B0E17] transition-transform duration-150 hover:scale-[1.03] disabled:opacity-50";
const ghost =
  "inline-flex items-center gap-1.5 rounded-lg border border-[#1E293B] px-3 py-2 text-xs text-slate-300 transition-colors duration-150 hover:border-slate-500";

function errText(e: unknown): string {
  const detail = (e as { body?: { detail?: unknown } })?.body?.detail;
  return typeof detail === "string" ? detail : "İşlem başarısız";
}

/** Domain yönetimi: sunucu IP'si, yayına alma (SSL) ve bağlı domain listesi.
 *  Cloudflare'a bağımlılık yok — DNS'i kayıt firmanızda yönetiyorsunuz. */
export default function AdminDomains() {
  const qc = useQueryClient();
  const [serverIp, setServerIp] = useState("");

  const statusQ = useQuery({
    queryKey: ["cf-status"],
    queryFn: () => apiGet<CfStatus>("/cloudflare/status"),
    retry: false,
  });
  const sitesQ = useQuery({ queryKey: ["sites"], queryFn: () => apiGet<Site[]>("/sites"), retry: false });

  const saveIp = useMutation({
    mutationFn: () => apiPut<CfStatus>("/cloudflare/settings", { server_ip: serverIp }),
    onSuccess: (s) => {
      qc.setQueryData(["cf-status"], s);
      void qc.invalidateQueries({ queryKey: ["ssl-status"] });
      toast.success("Sunucu IP kaydedildi");
    },
    onError: (e) => toast.error(errText(e)),
  });

  const removeDomain = useMutation({
    mutationFn: (v: { site: Site; domain: string }) =>
      apiPut<Site>(`/sites/${v.site.id}`, {
        domains: v.site.domains.filter((d) => d !== v.domain),
        active_domain: v.site.active_domain === v.domain ? "" : v.site.active_domain,
      }),
    onSuccess: (_s, v) => {
      void qc.invalidateQueries({ queryKey: ["sites"] });
      void qc.invalidateQueries({ queryKey: ["ssl-status"] });
      toast.success(`${v.domain} panelden kaldırıldı`);
    },
    onError: (e) => toast.error(errText(e)),
  });

  const sites = sitesQ.data ?? [];
  const rows = sites.flatMap((s) => s.domains.map((d) => ({ site: s, domain: d })));
  const savedIp = statusQ.data?.server_ip ?? "";

  return (
    <AdminShell>
      <header className="mb-7">
        <h1 className="font-heading text-2xl font-extrabold tracking-tight text-slate-50">
          Domainler & SSL
        </h1>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-400">
          Yeni domain için üç adım: kayıt firmanızda <b>A kaydı</b> → panelde siteye <b>domaini ekle</b>{" "}
          → aşağıdaki karttan <b>sertifikayı al</b>. DNS sağlayıcısı olarak Cloudflare gerekmiyor.
        </p>
      </header>

      <div className="mb-6 grid gap-5 lg:grid-cols-[minmax(0,360px)_1fr]">
        <section
          className="rounded-2xl border border-[#1E293B] bg-[#0F1320]/80 p-5"
          data-testid="server-ip-card"
        >
          <h2 className="flex items-center gap-2 text-sm font-bold tracking-wide text-slate-100">
            <Server className="h-4 w-4 text-amber-400" /> Sunucu IP adresi
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            Tüm domainlerin A kaydı bu IP'ye yazılmalı. Yayına alma kontrolleri bu değere göre yapılır.
          </p>
          <div className="mt-3 flex gap-2">
            <input
              className={field}
              value={serverIp}
              onChange={(e) => setServerIp(e.target.value)}
              placeholder={savedIp || "203.161.57.207"}
              data-testid="server-ip-input"
            />
            <button
              className={btn}
              onClick={() => saveIp.mutate()}
              disabled={!serverIp.trim() || saveIp.isPending}
              data-testid="server-ip-save-button"
            >
              Kaydet
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-500" data-testid="server-ip-current">
            Kayıtlı IP: <code className="font-mono text-cyan-300">{savedIp || "tanımsız"}</code>
          </p>
        </section>

        <section
          className="rounded-2xl border border-[#1E293B] bg-[#0F1320]/80 p-5"
          data-testid="dns-howto-card"
        >
          <h2 className="text-sm font-bold tracking-wide text-slate-100">Kayıt firmasında DNS ayarı</h2>
          <ol className="mt-3 space-y-2 text-xs leading-relaxed text-slate-400">
            <li>
              <span className="font-bold text-slate-200">1.</span> Nameserver'lar kayıt firmasının kendi
              DNS'i olsun (Namecheap → BasicDNS).
            </li>
            <li>
              <span className="font-bold text-slate-200">2.</span> Advanced DNS → park/yönlendirme
              kayıtlarını silin.
            </li>
            <li>
              <span className="font-bold text-slate-200">3.</span> İki kayıt ekleyin:{" "}
              <code className="font-mono text-cyan-300">A · @ · {savedIp || "sunucu IP"}</code> ve{" "}
              <code className="font-mono text-cyan-300">A · www · {savedIp || "sunucu IP"}</code>, TTL
              en düşük.
            </li>
          </ol>
        </section>
      </div>

      <SslPanel enabled={true} />

      <section className="mt-6 rounded-2xl border border-[#1E293B] bg-[#0F1320]/80 p-5">
        <h2 className="mb-4 text-sm font-bold tracking-wide text-slate-100">Panelde Bağlı Domainler</h2>
        {rows.length === 0 ? (
          <p className="text-sm text-slate-400" data-testid="domains-empty">
            Henüz bağlı domain yok. Bir sitenin "Domainler" sekmesinden ekleyin.
          </p>
        ) : (
          <div className="space-y-2" data-testid="domain-overview-list">
            {rows.map(({ site, domain }) => (
              <div
                key={`${site.id}-${domain}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#1E293B] bg-[#0B0E17] px-4 py-2.5"
                data-testid={`domain-overview-row-${domain}`}
              >
                <div className="flex items-center gap-2">
                  <code className="font-mono text-sm text-cyan-300">{domain}</code>
                  {site.active_domain === domain ? (
                    <span
                      className="rounded-full border border-emerald-500/50 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400"
                      data-testid={`domain-overview-active-${domain}`}
                    >
                      Aktif
                    </span>
                  ) : site.active_domain ? (
                    <span className="rounded-full border border-slate-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Pasif
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500">→ /{site.slug}</span>
                  <a
                    href={`https://${domain}`}
                    target="_blank"
                    rel="noreferrer"
                    className={ghost}
                    data-testid={`domain-open-${domain}`}
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> Aç
                  </a>
                  <Link to={`/admin/sites/${site.id}`} className={ghost} data-testid={`domain-manage-${domain}`}>
                    Yönet
                  </Link>
                  <button
                    className={`${ghost} text-rose-400`}
                    onClick={() => {
                      if (window.confirm(`${domain} panelden kaldırılsın mı? (DNS kaydınız etkilenmez)`))
                        removeDomain.mutate({ site, domain });
                    }}
                    data-testid={`domain-remove-${domain}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Kaldır
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </AdminShell>
  );
}
