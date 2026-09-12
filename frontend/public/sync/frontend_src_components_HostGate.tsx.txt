import { useQuery } from "@tanstack/react-query";
import { Navigate, useLocation } from "react-router-dom";
import { apiGet } from "@/lib/api";
import type { HostRole } from "@/lib/types";
import PublicPortal from "@/pages/PublicPortal";

export function useHostRole() {
  return useQuery({
    queryKey: ["host-role"],
    queryFn: () => apiGet<HostRole>("/public/host-role"),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

function Splash() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0B0E17]" data-testid="host-gate-loading">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
    </div>
  );
}

/**
 * Kök adres (/) davranışı:
 *  - Panel domaini (PANEL_DOMAIN) → yönetim girişine yönlendirir.
 *  - Reklam domainleri → ziyaretçi portalı.
 *  - ?site=slug verildiyse panelde bile önizleme portalı gösterilir.
 */
export function HostGate() {
  const { search } = useLocation();
  const preview = new URLSearchParams(search).get("site");
  const { data, isLoading } = useHostRole();

  if (preview) return <PublicPortal />;
  if (isLoading) return <Splash />;
  if (data?.role === "panel") return <Navigate to="/admin" replace />;
  return <PublicPortal />;
}

/** Reklam domainlerinde /admin adresini gizler (yalnızca panel domaininde açılır). */
export function AdminOnlyHost({ children }: { children: React.ReactNode }) {
  const { data, isLoading } = useHostRole();

  if (isLoading) return <Splash />;
  if (data?.role !== "panel") {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#0B0E17] text-center"
        data-testid="admin-not-available"
      >
        <p className="font-heading text-6xl font-black text-[#1E293B]">404</p>
        <p className="text-sm text-slate-400">Bu adres bulunamadı.</p>
        <a href="/" className="text-sm text-amber-500 hover:underline" data-testid="admin-404-home-link">
          Ana sayfaya dön
        </a>
      </div>
    );
  }
  return <>{children}</>;
}
