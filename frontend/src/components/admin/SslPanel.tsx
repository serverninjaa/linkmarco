import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api";
import type { SslIssueResult, SslStatus } from "@/lib/types";
import { CheckCircle2, RefreshCw, ShieldCheck, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

const btn =
  "inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3.5 py-2 text-xs font-bold text-[#04140C] transition-transform duration-150 hover:scale-[1.03] disabled:opacity-50";
const ghost =
  "inline-flex items-center gap-1.5 rounded-lg border border-[#1E293B] px-3 py-2 text-xs text-slate-300 transition-colors duration-150 hover:border-slate-500";

function errText(e: unknown): string {
  const detail = (e as { body?: { detail?: unknown } })?.body?.detail;
  return typeof detail === "string" ? detail : "İşlem başarısız";
}

/** Domainin DNS'i sunucuya bakıyor mu + sertifikası var mı; tek tıkla yayına alma. */
export default function SslPanel({ enabled }: { enabled: boolean }) {
  const qc = useQueryClient();
  const [log, setLog] = useState("");

  const statusQ = useQuery({
    queryKey: ["ssl-status"],
    queryFn: () => apiGet<SslStatus>("/ssl"),
    enabled,
    retry: false,
    staleTime: 0,
  });

  const issue = useMutation({
    mutationFn: (domains?: string[]) => apiPost<SslIssueResult>("/ssl/issue", { domains }),
    onSuccess: (r) => {
      setLog(r.output);
      void qc.invalidateQueries({ queryKey: ["ssl-status"] });
      if (r.ok) toast.success(r.message);
      else toast.error(r.message);
    },
    onError: (e) => toast.error(errText(e)),
  });

  const s = statusQ.data;
  const rows = s?.domains ?? [];

  return (
    <section
      data-testid="ssl-panel"
      className="rounded-2xl border border-[#1E293B] bg-[#0F1320]/80 p-5 shadow-[0_18px_40px_-28px_rgba(0,0,0,0.9)]"
    >
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-bold tracking-wide text-slate-100">
            <ShieldCheck className="h-4 w-4 text-emerald-400" /> Domain Yayına Alma (SSL)
          </h2>
          <p className="mt-1 max-w-xl text-xs leading-relaxed text-slate-400">
            Kayıt firmasında A kaydını <span className="font-mono text-slate-200">{s?.server_ip || "sunucu IP"}</span>{" "}
            yapın, domaini panele ekleyin ve burada tek tıkla sertifikayı alın. SSH gerekmez.
          </p>
        </div>
        <button
          className={ghost}
          onClick={() => {
            void statusQ
              .refetch()
              .then(() => toast.success("DNS ve sertifika durumu yenilendi"))
              .catch(() => toast.error("Durum alınamadı"));
          }}
          disabled={!enabled || statusQ.isFetching}
          data-testid="ssl-refresh-button"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${statusQ.isFetching ? "animate-spin" : ""}`} />
          {statusQ.isFetching ? "Kontrol ediliyor…" : "Yenile"}
        </button>
      </header>

      {rows.length === 0 ? (
        <p className="text-xs text-slate-400" data-testid="ssl-empty">
          {statusQ.isLoading ? "Kontrol ediliyor…" : "Panelde reklam domaini yok."}
        </p>
      ) : (
        <div className="space-y-2" data-testid="ssl-domain-list">
          {rows.map((d) => (
            <div
              key={d.domain}
              data-testid={`ssl-row-${d.domain}`}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#1E293B] bg-[#0B0E17] px-4 py-2.5"
            >
              <div className="min-w-0">
                <p className="font-mono text-sm text-cyan-300">{d.domain}</p>
                <p className="text-[11px] text-slate-500">
                  {d.site_slug ? `site: ${d.site_slug} · ` : ""}
                  {d.resolved_ip ? `kök: ${d.resolved_ip}` : "kök: yok"} ·{" "}
                  {d.www_resolved_ip ? `www: ${d.www_resolved_ip}` : "www: yok"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge ok={d.dns_ok} label="KÖK" testid={`ssl-dns-${d.domain}`} />
                <Badge ok={d.www_dns_ok} label="WWW" testid={`ssl-www-${d.domain}`} />
                <Badge ok={d.cert_ok} label="SSL" testid={`ssl-cert-${d.domain}`} />
                {d.ready ? (
                  <span
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400"
                    data-testid={`ssl-ready-${d.domain}`}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" /> Yayında
                  </span>
                ) : (
                  <button
                    className={btn}
                    disabled={!enabled || !d.dns_ok || issue.isPending}
                    title={d.dns_ok ? "Sertifikayı al ve Nginx'i yenile" : d.issue}
                    onClick={() => issue.mutate([d.domain])}
                    data-testid={`ssl-issue-button-${d.domain}`}
                  >
                    <ShieldCheck className={`h-3.5 w-3.5 ${issue.isPending ? "animate-pulse" : ""}`} />
                    Sertifika al & yayına al
                  </button>
                )}
              </div>
              {d.issue ? (
                <p
                  className="flex w-full items-center gap-1.5 text-[11px] text-amber-300"
                  data-testid={`ssl-issue-text-${d.domain}`}
                >
                  <TriangleAlert className="h-3 w-3" /> {d.issue}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {s && (!s.certbot_available || !s.script_available) ? (
        <p className="mt-3 text-[11px] text-slate-500" data-testid="ssl-env-warning">
          Bu ortamda sertifika alınamaz (certbot/script yok) — düğme yalnızca kendi sunucunuzda çalışır.
        </p>
      ) : null}

      {log ? (
        <pre
          className="mt-3 max-h-48 overflow-auto rounded-lg bg-[#0B0E17] p-3 font-mono text-[11px] leading-relaxed text-slate-400"
          data-testid="ssl-log"
        >
{log}
        </pre>
      ) : null}
    </section>
  );
}

function Badge({ ok, label, testid }: { ok: boolean; label: string; testid: string }) {
  return (
    <span
      data-testid={testid}
      className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
        ok
          ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400"
          : "border-slate-600 bg-slate-700/20 text-slate-400"
      }`}
    >
      {label} {ok ? "✓" : "×"}
    </span>
  );
}
