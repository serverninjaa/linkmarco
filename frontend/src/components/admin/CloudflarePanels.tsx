import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPut } from "@/lib/api";
import type { CfDomainCheck, CfSslSettings, CfZone } from "@/lib/types";
import { CheckCircle2, AlertTriangle, RefreshCw, Trash, Lock } from "lucide-react";
import { toast } from "sonner";

const btn =
  "inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 text-xs font-bold text-[#0B0E17] transition-transform hover:scale-[1.03] disabled:opacity-50";
const ghost =
  "inline-flex items-center gap-1.5 rounded-lg border border-[#1E293B] px-3 py-2 text-xs text-slate-300 transition-colors hover:border-slate-500 disabled:opacity-50";
const field =
  "rounded-lg border border-[#1E293B] bg-[#0B0E17] px-3 py-2 text-sm text-slate-200 outline-none transition-colors focus:border-amber-500";

function errText(e: unknown): string {
  const detail = (e as { body?: { detail?: unknown } })?.body?.detail;
  return typeof detail === "string" ? detail : "İşlem başarısız";
}

/** Domain doğrulama tablosu: zone + NS delegasyonu + A kaydı sağlığı. */
export function DomainVerifyPanel({ live }: { live: boolean }) {
  const q = useQuery({
    queryKey: ["cf-verify-domains"],
    queryFn: () => apiGet<CfDomainCheck[]>("/cloudflare/verify-domains"),
    retry: false,
  });

  return (
    <div className="rounded-xl border border-[#1E293B] bg-[#121620] p-6" data-testid="cf-verify-panel">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-lg font-bold tracking-tight">Domain Doğrulama</h2>
          <p className="mt-1 text-sm text-slate-400">
            Her domain için Cloudflare zone'u, nameserver delegasyonu ve A kaydı kontrol edilir.
          </p>
        </div>
        <button
          className={ghost}
          onClick={() => void q.refetch()}
          disabled={q.isFetching}
          data-testid="cf-verify-refresh-button"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${q.isFetching ? "animate-spin" : ""}`} /> Yeniden kontrol et
        </button>
      </div>

      {!live && (
        <p className="mb-3 text-xs text-amber-400" data-testid="cf-verify-offline-note">
          Token doğrulanamadı — zone bilgileri boş gelebilir, yalnızca DNS çözümlemesi gösterilir.
        </p>
      )}

      {q.isLoading ? (
        <p className="text-sm text-slate-400">Kontrol ediliyor…</p>
      ) : (q.data ?? []).length === 0 ? (
        <p className="text-sm text-slate-400" data-testid="cf-verify-empty">Kontrol edilecek domain yok.</p>
      ) : (
        <div className="space-y-2" data-testid="cf-verify-list">
          {(q.data ?? []).map((c) => {
            const ok = c.issues.length === 0;
            return (
              <div
                key={`${c.site_slug}-${c.domain}`}
                className={`rounded-lg border px-4 py-3 ${ok ? "border-emerald-900/60 bg-emerald-950/20" : "border-amber-900/50 bg-[#0B0E17]"}`}
                data-testid="cf-verify-row"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {ok ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-amber-400" />
                    )}
                    <code className="font-mono text-sm text-cyan-300">{c.domain}</code>
                    <span className="text-xs text-slate-500">→ {c.site_name || `/${c.site_slug}`}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-bold uppercase">
                    <span
                      className={`rounded px-2 py-0.5 ${c.ns_delegated ? "bg-emerald-900/50 text-emerald-400" : "bg-amber-900/40 text-amber-400"}`}
                      data-testid="cf-verify-ns-badge"
                    >
                      NS {c.zone_status}
                    </span>
                    <span
                      className={`rounded px-2 py-0.5 ${c.a_record_ok ? "bg-emerald-900/50 text-emerald-400" : "bg-rose-900/40 text-rose-400"}`}
                      data-testid="cf-verify-a-badge"
                    >
                      A {c.a_record_ok ? "doğru" : "hatalı"}
                    </span>
                    {c.proxied && (
                      <span className="rounded bg-amber-900/40 px-2 py-0.5 text-amber-400">proxy</span>
                    )}
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-[11px] text-slate-500">
                  {c.a_record_content && (
                    <span data-testid="cf-verify-a-content">A kaydı: {c.a_record_content}</span>
                  )}
                  {c.resolved_ips.length > 0 && <span>Çözümlenen: {c.resolved_ips.join(", ")}</span>}
                  {c.name_servers.length > 0 && <span>NS: {c.name_servers.join(" • ")}</span>}
                </div>
                {!ok && (
                  <ul className="mt-2 space-y-0.5 text-xs text-amber-400" data-testid="cf-verify-issues">
                    {c.issues.map((i) => (
                      <li key={i}>• {i}</li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Zone başına SSL modu, Always Use HTTPS ve cache temizleme. */
export function ZoneSslPanel({ zones }: { zones: CfZone[] }) {
  const qc = useQueryClient();
  const [zoneId, setZoneId] = useState<string>(zones[0]?.id ?? "");
  const active = zoneId || zones[0]?.id || "";

  const sslQ = useQuery({
    queryKey: ["cf-ssl", active],
    queryFn: () => apiGet<CfSslSettings>(`/cloudflare/zones/${active}/ssl`),
    enabled: !!active,
    retry: false,
  });

  const save = useMutation({
    mutationFn: (patch: { ssl?: string; always_use_https?: boolean }) =>
      apiPut<CfSslSettings>(`/cloudflare/zones/${active}/ssl`, patch),
    onSuccess: (s) => {
      qc.setQueryData(["cf-ssl", active], s);
      toast.success("SSL ayarı güncellendi");
    },
    onError: (e) => toast.error(errText(e)),
  });

  const purge = useMutation({
    mutationFn: () => apiPost<{ ok: boolean }>(`/cloudflare/zones/${active}/purge-cache`),
    onSuccess: () => toast.success("Cloudflare önbelleği boşaltıldı"),
    onError: (e) => toast.error(errText(e)),
  });

  return (
    <div className="rounded-xl border border-[#1E293B] bg-[#121620] p-6" data-testid="cf-ssl-panel">
      <h2 className="flex items-center gap-2 font-heading text-lg font-bold tracking-tight">
        <Lock className="h-4 w-4 text-amber-500" /> SSL & Önbellek
      </h2>
      <p className="mt-1 text-sm text-slate-400">Zone seçin, SSL modunu ayarlayın veya önbelleği temizleyin.</p>

      {zones.length === 0 ? (
        <p className="mt-4 text-sm text-slate-400" data-testid="cf-ssl-no-zone">
          Henüz zone yok — önce bir domain bağlayın.
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          <select
            className={`${field} w-full`}
            value={active}
            onChange={(e) => setZoneId(e.target.value)}
            data-testid="cf-ssl-zone-select"
          >
            {zones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.name}
              </option>
            ))}
          </select>

          <div className="flex flex-wrap items-center gap-3">
            <label className="text-xs text-slate-400">SSL modu</label>
            <select
              className={field}
              value={sslQ.data?.ssl ?? "off"}
              onChange={(e) => save.mutate({ ssl: e.target.value })}
              disabled={!sslQ.data || save.isPending}
              data-testid="cf-ssl-mode-select"
            >
              <option value="off">Off</option>
              <option value="flexible">Flexible</option>
              <option value="full">Full</option>
              <option value="strict">Full (strict)</option>
            </select>

            <button
              className={ghost}
              onClick={() => save.mutate({ always_use_https: !(sslQ.data?.always_use_https ?? false) })}
              disabled={!sslQ.data || save.isPending}
              data-testid="cf-always-https-toggle"
            >
              Always Use HTTPS:{" "}
              <span className={sslQ.data?.always_use_https ? "text-emerald-400" : "text-slate-500"}>
                {sslQ.data?.always_use_https ? "AÇIK" : "KAPALI"}
              </span>
            </button>

            <button
              className={btn}
              onClick={() => purge.mutate()}
              disabled={purge.isPending}
              data-testid="cf-purge-cache-button"
            >
              <Trash className="h-3.5 w-3.5" /> {purge.isPending ? "Temizleniyor…" : "Önbelleği Temizle"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
