import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { apiGet } from "@/lib/api";
import type { PublicSite } from "@/lib/types";
import { DEFAULT_THEME } from "@/lib/types";
import AdSlotRenderer from "@/components/portal/AdSlotRenderer";
import WelcomePopupModal from "@/components/portal/WelcomePopupModal";
import usePortalHead from "@/lib/usePortalHead";
import DomainPendingScreen from "@/components/portal/DomainPendingScreen";

// Mobilde de aynı kolon sayısı: sıra ve yan yana görünüm masaüstüyle birebir aynı kalır.
const COLS: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
  5: "grid-cols-5",
  6: "grid-cols-6",
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

  // Panel içindeki iframe önizlemesinde pop-up kapatılır, kart düzeni net görünür.
  const isPreview = params.get("preview") === "1";
  const site = isError ? undefined : data?.site;
  const slots = isError ? [] : (data?.slots ?? []);
  const theme = site?.theme ?? DEFAULT_THEME;
  const ticker = site?.marquee?.length ? site.marquee : ["Güncel giriş adresleri 7/24 yayında"];
  const pending = data?.status === "pending";

  // Sekme başlığı / Google açıklaması / favicon — panelden yönetilir (SEO sekmesi).
  usePortalHead({
    title: site?.seo_title || site?.title || site?.name || "",
    description: site?.seo_description || site?.tagline || "",
    faviconUrl: site?.favicon_url || "",
  });

  if (pending) {
    return <DomainPendingScreen theme={theme} host={window.location.hostname} />;
  }

  return (
    <div className="flex min-h-screen flex-col" style={{ background: theme.bg, color: theme.text }}>
      {site?.custom_css ? <style>{site.custom_css}</style> : null}      {site?.popup && !isPreview ? (
        <WelcomePopupModal popup={site.popup} accent={theme.accent} />
      ) : null}

      {/* header — sadece logo, yönetim butonu yok */}
      <header
        className="sticky top-0 z-30 border-b backdrop-blur-md"
        style={{ background: `${theme.panel}F2`, borderColor: `${theme.accent}40` }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex shrink-0 items-center gap-2.5">
            <span
              className="flex h-8 w-8 items-center justify-center rounded font-heading text-xs font-black"
              style={{ background: theme.accent, color: "#000" }}
            >
              {(site?.logo_text ?? "AD").slice(0, 2)}
            </span>
            <span className="font-heading text-lg font-black uppercase tracking-tight" data-testid="portal-logo">
              {site?.logo_text || "REKLAM PORTALI"}
            </span>
          </div>
          {/* kayan yazı — logo ile "Güncel" arasında */}
          <div
            className="mx-4 min-w-0 flex-1 overflow-hidden"
            style={{
              maskImage: "linear-gradient(to right, transparent 0, #000 48px, #000 calc(100% - 48px), transparent 100%)",
              WebkitMaskImage:
                "linear-gradient(to right, transparent 0, #000 48px, #000 calc(100% - 48px), transparent 100%)",
            }}
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

          <span className="flex shrink-0 items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            Güncel
          </span>
        </div>
      </header>

      {/* reklam kartları — sayfanın ana yüzeyi */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-3 py-6 sm:px-4 sm:py-8">
        <div className="mb-4 flex items-center justify-center gap-3">
          <span className="h-px flex-1" style={{ background: `${theme.accent}40` }} />
          <h1
            className="text-center font-heading text-sm font-black uppercase tracking-[0.2em] sm:text-base"
            style={{ color: theme.accent }}
            data-testid="portal-title"
          >
            {site?.title || "GÜNCEL GİRİŞ ADRESLERİ"}
          </h1>
          <span className="h-px flex-1" style={{ background: `${theme.accent}40` }} />
        </div>

        {site?.tagline ? (
          <p
            className="mb-6 text-center text-[11px] font-bold uppercase tracking-wide"
            style={{ color: theme.accent2 }}
            data-testid="portal-tagline"
          >
            {site.tagline}
          </p>
        ) : null}

        {isLoading ? (
          <div className={`grid gap-1.5 sm:gap-3 ${COLS[site?.columns ?? 3] ?? "grid-cols-3"}`}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-[70px] animate-pulse rounded-md bg-white/5 sm:h-[150px]" />
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
            className={`grid gap-1.5 sm:gap-3 ${COLS[site?.columns ?? 3] ?? "grid-cols-3"}`}
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
