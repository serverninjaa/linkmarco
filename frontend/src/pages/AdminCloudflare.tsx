import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";
import type { Site } from "@/lib/types";
import AdminShell from "@/components/admin/AdminShell";
import { Cloud, Server, ShieldCheck, Copy } from "lucide-react";
import { toast } from "sonner";

const SERVER_IP = "SUNUCU_IP_ADRESINIZ";

const NGINX = `server {
  listen 80;
  server_name _;            # tüm bağlı domainler
  location /api/ { proxy_pass http://127.0.0.1:8001; }
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;   # Host başlığı domain eşleme için şart
  }
}`;

export default function AdminCloudflare() {
  const { data: sites } = useQuery({
    queryKey: ["sites"],
    queryFn: () => apiGet<Site[]>("/sites"),
    retry: false,
  });

  const domains = (sites ?? []).flatMap((s) => s.domains.map((d) => ({ d, slug: s.slug })));

  const copy = (text: string) => {
    void navigator.clipboard?.writeText(text);
    toast.success("Kopyalandı");
  };

  return (
    <AdminShell>
      <div className="mb-8">
        <h1 className="font-heading text-3xl font-black tracking-tight">Cloudflare / DNS Kurulumu</h1>
        <p className="mt-1 text-sm text-slate-400">
          Yeni bir domaini bağlamak için aşağıdaki adımları izleyin. Panelde domaini eklemeden önce DNS yönlendirmesini yapın.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {[
          {
            icon: Cloud,
            title: "1. Cloudflare'a domaini ekleyin",
            body: "Domaini Cloudflare hesabınıza ekleyin ve alan adı sağlayıcınızdaki nameserver'ları Cloudflare'ın verdiği NS kayıtlarıyla değiştirin.",
          },
          {
            icon: Server,
            title: "2. A kaydı oluşturun",
            body: `@ ve www için A kaydı → ${SERVER_IP}. Proxy (turuncu bulut) açık olmalı; SSL modu "Full (strict)" seçilmeli.`,
          },
          {
            icon: ShieldCheck,
            title: "3. Panelden domaini bağlayın",
            body: "İlgili sitenin 'Domainler' sekmesine domaini ekleyin. Sistem gelen Host başlığına göre o sitenin tasarımını ve reklamlarını gösterir.",
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
          <button
            onClick={() => copy(NGINX)}
            className="flex items-center gap-1.5 rounded-lg border border-[#1E293B] px-3 py-1.5 text-xs text-slate-300 hover:border-slate-500"
            data-testid="copy-nginx-button"
          >
            <Copy className="h-3.5 w-3.5" /> Kopyala
          </button>
        </div>
        <pre className="overflow-x-auto rounded-lg bg-[#0B0E17] p-4 font-mono text-xs leading-relaxed text-slate-300">
          {NGINX}
        </pre>
      </div>

      <div className="mt-8 rounded-xl border border-[#1E293B] bg-[#121620] p-6">
        <h2 className="mb-4 font-heading text-lg font-bold tracking-tight">Bağlı Domainler</h2>
        {domains.length === 0 ? (
          <p className="text-sm text-slate-400" data-testid="cf-domains-empty">Henüz bağlı domain yok.</p>
        ) : (
          <div className="space-y-2" data-testid="cf-domain-list">
            {domains.map(({ d, slug }) => (
              <div
                key={d}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#1E293B] bg-[#0B0E17] px-4 py-2.5"
                data-testid="cf-domain-row"
              >
                <code className="font-mono text-sm text-cyan-300">{d}</code>
                <span className="text-xs text-slate-500">→ /{slug}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminShell>
  );
}
