import type { Theme } from "@/lib/types";

/** Domain siteye bağlı ama panelden aktif edilmemiş: ziyaretçi içerik yerine bunu görür. */
export default function DomainPendingScreen({ theme, host }: { theme: Theme; host: string }) {
  return (
    <div
      className="flex min-h-screen items-center justify-center px-5"
      style={{ background: theme.bg, color: theme.text }}
      data-testid="domain-pending-screen"
    >
      <div
        className="w-full max-w-md rounded-2xl border p-8 text-center shadow-[0_30px_60px_-30px_rgba(0,0,0,0.9)]"
        style={{ background: theme.panel, borderColor: `${theme.accent}40` }}
      >
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full"
          style={{ background: `${theme.accent}1A`, border: `1px solid ${theme.accent}55` }}
        >
          <span
            className="block h-6 w-6 animate-spin rounded-full border-2 border-transparent"
            style={{ borderTopColor: theme.accent, borderRightColor: theme.accent }}
          />
        </div>
        <h1
          className="font-heading text-xl font-black uppercase tracking-tight"
          style={{ color: theme.accent }}
          data-testid="domain-pending-title"
        >
          Domain hazırlanıyor
        </h1>
        <p className="mt-3 text-sm leading-relaxed opacity-80" data-testid="domain-pending-text">
          {host ? <span className="font-mono">{host}</span> : "Bu adres"} bağlantısı kuruldu, yayın
          hazırlıkları sürüyor. Kısa süre içinde burada olacak.
        </p>
        <p className="mt-5 text-[11px] uppercase tracking-widest opacity-50">
          Lütfen daha sonra tekrar deneyin
        </p>
      </div>
    </div>
  );
}
