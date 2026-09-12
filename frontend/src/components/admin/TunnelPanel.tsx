import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api";
import type { CfTunnelAttachResult, CfTunnelRebuildResult, CfTunnelStatus } from "@/lib/types";
import { Copy, RefreshCw, Radio } from "lucide-react";
import { toast } from "sonner";

const btn =
  "inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 text-xs font-bold text-[#0B0E17] transition-transform hover:scale-[1.03] disabled:opacity-50";
const ghost =
  "inline-flex items-center gap-1.5 rounded-lg border border-[#1E293B] px-3 py-2 text-xs text-slate-300 transition-colors hover:border-slate-500";

function errText(e: unknown): string {
  const detail = (e as { body?: { detail?: unknown } })?.body?.detail;
  return typeof detail === "string" ? detail : "İşlem başarısız";
}

export default function TunnelPanel({ enabled }: { enabled: boolean }) {
  const qc = useQueryClient();
  const [result, setResult] = useState<CfTunnelRebuildResult | null>(null);

  const tunnelQ = useQuery({
    queryKey: ["cf-tunnel"],
    queryFn: () => apiGet<CfTunnelStatus>("/cloudflare/tunnel"),
    enabled,
    retry: false,
  });

  const rebuild = useMutation({
    mutationFn: () =>
      apiPost<CfTunnelRebuildResult>("/cloudflare/tunnel/rebuild", {
        name: "marco-tunnel",
        include_panel: false,
      }),
    onSuccess: (r) => {
      setResult(r);
      void qc.invalidateQueries({ queryKey: ["cf-tunnel"] });
      void qc.invalidateQueries({ queryKey: ["cf-verify-domains"] });
      toast.success(`Tünel kuruldu — ${r.rewired_domains.length} domain bağlandı`);
    },
    onError: (e) => toast.error(errText(e)),
  });

  const attachPanel = useMutation({
    mutationFn: () => apiPost<CfTunnelAttachResult>("/cloudflare/tunnel/attach-panel", {}),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: ["cf-tunnel"] });
      void qc.invalidateQueries({ queryKey: ["cf-verify-domains"] });
      toast.success(`${r.panel_domain} tünele bağlandı`);
    },
    onError: (e) => toast.error(errText(e)),
  });

  const t = tunnelQ.data;
  const healthy = t?.status === "healthy" && (t?.connections ?? 0) > 0;

  return (
    <section
      data-testid="tunnel-panel"
      className="rounded-2xl border border-[#1E293B] bg-[#0F1320]/80 p-5 shadow-[0_18px_40px_-28px_rgba(0,0,0,0.9)]"
    >
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-bold tracking-wide text-slate-100">
            <Radio className="h-4 w-4 text-amber-400" /> Cloudflare Tunnel
          </h2>
          <p className="mt-1 max-w-xl text-xs leading-relaxed text-slate-400">
            Tek tünel tüm domainleri taşır. Domainler sunucu IP'si yerine tünele bağlanır; böylece
            edge → origin bağlantı hataları (522) ve IP sızması ortadan kalkar.
          </p>
        </div>
        <button
          className={ghost}
          onClick={() => void tunnelQ.refetch()}
          disabled={!enabled}
          data-testid="tunnel-refresh-button"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Yenile
        </button>
      </header>

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Durum" value={t?.status ?? "-"} testid="tunnel-status-value" ok={healthy} />
        <Stat
          label="Bağlantı"
          value={String(t?.connections ?? 0)}
          testid="tunnel-connections-value"
          ok={(t?.connections ?? 0) > 0}
        />
        <Stat
          label="Edge lokasyon"
          value={t?.colos?.join(", ") || "-"}
          testid="tunnel-colos-value"
        />
        <Stat
          label="Yönlendirme"
          value={t?.ingress_ok ? "127.0.0.1:80" : "yok"}
          testid="tunnel-ingress-value"
          ok={!!t?.ingress_ok}
        />
      </div>

      {t?.target ? (
        <p className="mt-3 break-all font-mono text-[11px] text-slate-400" data-testid="tunnel-target-value">
          Hedef: {t.target}
        </p>
      ) : null}
      {t?.message ? (
        <p className="mt-3 text-xs text-amber-300" data-testid="tunnel-message">
          {t.message}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          className={btn}
          disabled={!enabled || rebuild.isPending}
          onClick={() => {
            const ok = window.confirm(
              "DİKKAT: Mevcut tünel silinir ve panel dahil tüm domainler, sunucuda yeni token kurulana kadar ERİŞİLEMEZ olur.\n\n" +
                "Kurulum sonrası çıkan komutu sunucuda çalıştırmanız ZORUNLUDUR. Devam edilsin mi?",
            );
            if (ok) rebuild.mutate();
          }}
          data-testid="tunnel-rebuild-button"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${rebuild.isPending ? "animate-spin" : ""}`} />
          Tüneli sıfırdan kur
        </button>
        <button
          className={ghost}
          disabled={!enabled || attachPanel.isPending || !t?.tunnel_id}
          onClick={() => attachPanel.mutate()}
          data-testid="tunnel-attach-panel-button"
        >
          Panel domainini de bağla
        </button>
        <span className="text-[11px] text-slate-500">
          Eski tüneller silinir, yeni tünel kurulur ve tüm domainler yeniden bağlanır.
        </span>
      </div>

      {result ? (
        <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4" data-testid="tunnel-install-block">
          <p className="text-xs font-bold text-amber-300">
            Son adım — sunucunuzda (VPS) şu komutu root olarak çalıştırın:
          </p>
          <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-[#0B0E17] p-3 font-mono text-[11px] leading-relaxed text-slate-300">
{result.install_command}
          </pre>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              className={ghost}
              onClick={() => {
                void navigator.clipboard.writeText(result.install_command);
                toast.success("Komut kopyalandı");
              }}
              data-testid="tunnel-copy-command-button"
            >
              <Copy className="h-3.5 w-3.5" /> Komutu kopyala
            </button>
          </div>
          <p className="mt-2 text-[11px] text-slate-400" data-testid="tunnel-rewired-domains">
            Bağlanan domainler: {result.rewired_domains.join(", ") || "-"}
          </p>
          {result.warnings.length > 0 ? (
            <p className="mt-1 text-[11px] text-rose-300" data-testid="tunnel-warnings">
              Uyarılar: {result.warnings.join(" | ")}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function Stat({
  label,
  value,
  testid,
  ok,
}: {
  label: string;
  value: string;
  testid: string;
  ok?: boolean;
}) {
  return (
    <div className="rounded-xl border border-[#1E293B] bg-[#0B0E17] px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
      <p
        className={`mt-0.5 truncate text-sm font-semibold ${
          ok === undefined ? "text-slate-200" : ok ? "text-emerald-400" : "text-rose-400"
        }`}
        data-testid={testid}
      >
        {value}
      </p>
    </div>
  );
}
