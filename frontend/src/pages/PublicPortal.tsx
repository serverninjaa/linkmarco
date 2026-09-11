import { useQuery } from "@tanstack/react-query";
import { useSearchParams, Link } from "react-router-dom";
import { apiGet } from "@/lib/api";
import type { PublicSite } from "@/lib/types";
import { DEFAULT_THEME } from "@/lib/types";
import AdSlotRenderer from "@/components/portal/AdSlotRenderer";
import WelcomePopupModal from "@/components/portal/WelcomePopupModal";

const COLS: Record<number, string> = {
  1: "sm:grid-cols-1",
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-4",
  5: "sm:grid-cols-5",
  6: "sm:grid-cols-6",
};

export default function PublicPortal() {
  const [params] = useSearchParams();
  const slug = params.get("site") ?? "";

  const { data, isError, isLoading } = useQuery({
    queryKey: ["public-site", slug],
    queryFn: () =>
      apiGet<PublicSite>(`/public/site${slug ? `?slug=${encodeURIComponent(slug)}` : ""}`),
    retry: false,
  });

  const site = isError ? undefined : data?.site;
  const slots = isError ? [] : (data?.slots ?? []);
  const theme = site?.theme ?? DEFAULT_THEME;
  const ticker = site?.marquee?.length ? site.marquee : ["Güncel giriş adresleri 7/24 yayında"];

  return (
    <div className="min-h-screen" style={{ background: theme.bg, color: theme.text }}>
      {site?.custom_css ? <style>{site.custom_css}</style> : null}
      {site?.popup ? <WelcomePopupModal popup={site.popup} accent={theme.accent} /> : null}

      {/* top marquee */}
      <div
        className="overflow-hidden border-b py-1.5"
        style={{ background: "#05070B", borderColor: `${theme.accent}33` }}
      >
        <div className="animate-marquee flex w-max gap-10 whitespace-nowrap" data-testid="marquee-ticker">
          {[...ticker, ...ticker, ...ticker, ...ticker].map((t, i) => (
            <span
              key={i}
              className="text-[11px] font-bold uppercase tracking-wide"
              style={{ color: i % 2 ? theme.accent2 : theme.accent }}
            >
              ◆ {t}
            </span>
          ))}
        </div>
      </div>

      {/* compact header — tuna40 style: logo band + neon rule */}
      <header
        className="sticky top-0 z-30 border-b backdrop-blur-md"
        style={{ background: `${theme.panel}F2`, borderColor: `${theme.accent}40` }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <span
              className="flex h-8 w-8 items-center justify-center rounded font-heading text-xs font-black"
              style={{ background: theme.accent, color: "#000" }}
            >
              {(site?.logo_text ?? "AD").slice(0, 2)}
            </span>
            <span
              className="font-heading text-lg font-black uppercase tracking-tight"
              data-testid="portal-logo"
            >
              {site?.logo_text || "REKLAM PORTALI"}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 sm:flex">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              Güncel
            </span>
            <Link
              to="/admin"
              className="rounded border px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest transition-colors duration-150"
              style={{ borderColor: `${theme.accent}66`, color: theme.accent }}
              data-testid="portal-admin-link"
            >
              Yönetim
            </Link>
          </div>
        </div>
      </header>

      {/* slim hero banner — tuna40 keeps this tight, the grid is the hero */}
      <section className="relative overflow-hidden border-b" style={{ borderColor: `${theme.accent}26` }}>
        {site?.hero_image_url ? (
          <img src={site.hero_image_url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-40" />
        ) : null}
        <div
          className="absolute inset-0"
          style={{ background: `linear-gradient(180deg, ${theme.bg}CC 0%, ${theme.bg}F2 70%, ${theme.bg} 100%)` }}
        />
        <div className="relative mx-auto max-w-6xl px-4 py-8 text-center sm:py-10">
          <h1
            className="font-heading text-2xl font-black uppercase leading-tight tracking-tight sm:text-4xl"
            data-testid="portal-title"
          >
            {site?.title || "REKLAM ALANLARI YAYINDA"}
          </h1>
          <p
            className="mx-auto mt-2 max-w-2xl text-[11px] font-bold uppercase tracking-wide sm:text-xs"
            style={{ color: theme.accent2 }}
            data-testid="portal-tagline"
          >
            {site?.tagline || "Panelden yönetilen çok domainli reklam portalı."}
          </p>
        </div>
      </section>

      {/* ad grid — the main tuna40 surface */}
      <main className="mx-auto max-w-6xl px-3 py-6 sm:px-4 sm:py-8">
        <div className="mb-4 flex items-center justify-center gap-3">
          <span className="h-px flex-1" style={{ background: `${theme.accent}40` }} />
          <h2
            className="font-heading text-xs font-black uppercase tracking-[0.25em]"
            style={{ color: theme.accent }}
          >
            Güncel Giriş Adresleri
          </h2>
          <span className="h-px flex-1" style={{ background: `${theme.accent}40` }} />
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-[150px] animate-pulse rounded-lg bg-white/5" />
            ))}
          </div>
        ) : slots.length === 0 ? (
          <div
            className="rounded-lg border border-dashed border-white/15 p-12 text-center text-sm text-slate-400"
            data-testid="empty-slots"
          >
            Bu domain için henüz reklam alanı tanımlanmadı. Yönetim panelinden ekleyebilirsiniz.
          </div>
        ) : (
          <div
            className={`grid grid-cols-1 gap-3 ${COLS[site?.columns ?? 3] ?? "sm:grid-cols-3"}`}
            data-testid="ad-grid"
          >
            {slots.map((slot) => (
              <AdSlotRenderer key={slot.id} slot={slot} accent={theme.accent} cardBg={theme.card} />
            ))}
          </div>
        )}

        <p className="mt-5 text-center font-mono text-[10px] uppercase tracking-widest text-slate-500" data-testid="slot-count">
          {slots.length} aktif reklam alanı
        </p>
      </main>

      <footer className="border-t py-6" style={{ background: "#05070B", borderColor: `${theme.accent}26` }}>
        <div className="mx-auto max-w-6xl space-y-1 px-4 text-center text-[10px] uppercase tracking-widest text-slate-500">
          <p>
            © {new Date().getFullYear()} {site?.name || "Reklam Portalı"} — 18+ · Sorumlu reklam yayıncılığı
          </p>
          <p className="font-mono normal-case tracking-normal">
            Aktif domainler: {site?.domains?.join(" · ") || "—"}
          </p>
        </div>
      </footer>
    </div>
  );
}
