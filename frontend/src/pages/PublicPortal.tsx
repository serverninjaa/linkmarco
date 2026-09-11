import { useQuery } from "@tanstack/react-query";
import { useSearchParams, Link } from "react-router-dom";
import { apiGet } from "@/lib/api";
import type { PublicSite } from "@/lib/types";
import { DEFAULT_THEME } from "@/lib/types";
import AdSlotRenderer from "@/components/portal/AdSlotRenderer";
import WelcomePopupModal from "@/components/portal/WelcomePopupModal";
import { ShieldCheck, Zap, Clock } from "lucide-react";

const COLS: Record<number, string> = {
  1: "md:grid-cols-1",
  2: "md:grid-cols-2",
  3: "md:grid-cols-3",
  4: "md:grid-cols-4",
  5: "md:grid-cols-5",
  6: "md:grid-cols-6",
};

export default function PublicPortal() {
  const [params] = useSearchParams();
  const slug = params.get("site") ?? "";

  const { data, isError, isLoading } = useQuery({
    queryKey: ["public-site", slug],
    queryFn: () => apiGet<PublicSite>(`/public/site${slug ? `?slug=${encodeURIComponent(slug)}` : ""}`),
    retry: false,
  });

  const site = isError ? undefined : data?.site;
  const slots = isError ? [] : (data?.slots ?? []);
  const theme = site?.theme ?? DEFAULT_THEME;
  const ticker = site?.marquee?.length ? site.marquee : ["Güncel giriş adresleri 7/24 yayında"];

  return (
    <div className="min-h-screen" style={{ background: theme.bg, color: theme.text }}>
      {site?.custom_css ? <style>{site.custom_css}</style> : null}
      {site?.popup ? (
        <WelcomePopupModal popup={site.popup} accent={theme.accent} accent2={theme.accent2} />
      ) : null}

      {/* marquee */}
      <div className="overflow-hidden border-b border-white/10 py-2" style={{ background: theme.panel }}>
        <div className="animate-marquee flex w-max gap-12 whitespace-nowrap" data-testid="marquee-ticker">
          {[...ticker, ...ticker, ...ticker, ...ticker].map((t, i) => (
            <span key={i} className="text-xs font-semibold tracking-wide" style={{ color: theme.accent2 }}>
              ★ {t}
            </span>
          ))}
        </div>
      </div>

      {/* header */}
      <header
        className="sticky top-0 z-30 border-b border-white/10 backdrop-blur-md"
        style={{ background: `${theme.panel}E6` }}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-lg font-heading text-sm font-black"
              style={{ background: theme.accent, color: "#000" }}
            >
              {(site?.logo_text ?? "AD").slice(0, 2)}
            </div>
            <span className="font-heading text-xl font-extrabold tracking-tight" data-testid="portal-logo">
              {site?.logo_text || "REKLAM PORTALI"}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden items-center gap-2 text-xs text-slate-400 sm:flex">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              Yayında
            </span>
            <Link
              to="/admin"
              className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold transition-colors duration-150 hover:border-white/40"
              data-testid="portal-admin-link"
            >
              Yönetim
            </Link>
          </div>
        </div>
      </header>

      {/* hero */}
      <section className="relative overflow-hidden">
        {site?.hero_image_url ? (
          <img src={site.hero_image_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : null}
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(180deg, ${theme.bg}BF 0%, ${theme.bg}EB 80%, ${theme.bg} 100%)`,
          }}
        />
        <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <p className="text-xs font-bold tracking-[0.3em]" style={{ color: theme.accent2 }}>
            GÜNCEL GİRİŞ MERKEZİ
          </p>
          <h1
            className="mt-4 max-w-3xl font-heading text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl"
            data-testid="portal-title"
          >
            {site?.title || "REKLAM ALANLARI YAYINDA"}
          </h1>
          <p className="mt-5 max-w-xl text-base text-slate-300" data-testid="portal-tagline">
            {site?.tagline || "Panelden yönetilen çok domainli reklam portalı."}
          </p>
          <div className="mt-8 flex flex-wrap gap-3 text-xs font-semibold">
            {[
              { icon: ShieldCheck, label: "Güvenli & Lisanslı" },
              { icon: Zap, label: "Anında Erişim" },
              { icon: Clock, label: "7/24 Güncel" },
            ].map(({ icon: Icon, label }) => (
              <span
                key={label}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2"
                style={{ background: `${theme.card}CC` }}
              >
                <Icon className="h-3.5 w-3.5" style={{ color: theme.accent }} /> {label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ad grid */}
      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-end justify-between border-b border-white/10 pb-4">
          <h2 className="font-heading text-2xl font-bold tracking-tight">Reklam Alanları</h2>
          <span className="font-mono text-xs text-slate-500" data-testid="slot-count">
            {slots.length} aktif alan
          </span>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-56 animate-pulse rounded-xl bg-white/5" />
            ))}
          </div>
        ) : slots.length === 0 ? (
          <div
            className="rounded-xl border border-dashed border-white/15 p-12 text-center text-sm text-slate-400"
            data-testid="empty-slots"
          >
            Bu domain için henüz reklam alanı tanımlanmadı. Yönetim panelinden ekleyebilirsiniz.
          </div>
        ) : (
          <div
            className={`grid grid-cols-1 gap-5 sm:grid-cols-2 ${COLS[site?.columns ?? 4] ?? "md:grid-cols-4"}`}
            data-testid="ad-grid"
          >
            {slots.map((slot) => (
              <AdSlotRenderer
                key={slot.id}
                slot={slot}
                accent={theme.accent}
                accent2={theme.accent2}
                cardBg={theme.card}
              />
            ))}
          </div>
        )}
      </main>

      <footer className="border-t border-white/10 py-8" style={{ background: theme.panel }}>
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 text-xs text-slate-500 sm:px-6 lg:px-8">
          <span>
            © {new Date().getFullYear()} {site?.name || "Reklam Portalı"} — tüm reklam alanları panelden yönetilir.
          </span>
          <span className="font-mono">
            Aktif domainler: {site?.domains?.join(", ") || "—"}
          </span>
        </div>
      </footer>
    </div>
  );
}
