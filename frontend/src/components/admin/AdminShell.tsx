import { Link, useLocation, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api";
import type { AdminUser } from "@/lib/types";
import { useEffect, type ReactNode } from "react";
import { LayoutGrid, Cloud, LogOut, Globe, Images } from "lucide-react";

const NAV = [
  { to: "/admin", label: "Siteler & Domainler", icon: LayoutGrid },
  { to: "/admin/library", label: "Kütüphane", icon: Images },
  { to: "/admin/cloudflare", label: "Cloudflare / DNS", icon: Cloud },
];

export default function AdminShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: user, isError } = useQuery({
    queryKey: ["me"],
    queryFn: () => apiGet<AdminUser>("/auth/me"),
    retry: false,
  });

  useEffect(() => {
    if (isError) navigate("/admin/login", { replace: true });
  }, [isError, navigate]);

  const logout = async () => {
    await apiPost("/auth/logout").catch(() => undefined);
    qc.clear();
    navigate("/admin/login", { replace: true });
  };

  return (
    <div className="flex min-h-screen bg-[#090B10] text-slate-100">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-[#1E293B] bg-[#0B0E17] lg:flex">
        <div className="flex items-center gap-2 border-b border-[#1E293B] px-6 py-5">
          <Globe className="h-5 w-5 text-amber-500" />
          <span className="font-heading text-lg font-extrabold tracking-tight">AdCore</span>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {NAV.map(({ to, label, icon: Icon }) => {
            const active = location.pathname === to;
            return (
              <Link
                key={to}
                to={to}
                data-testid={`admin-nav-${to.split("/").pop()}`}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150 ${
                  active ? "bg-[#1E293B] text-amber-400" : "text-slate-400 hover:bg-[#141A27] hover:text-slate-100"
                }`}
              >
                <Icon className="h-4 w-4" /> {label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-[#1E293B] p-3">
          <div className="px-3 pb-2 text-xs text-slate-500" data-testid="admin-username">
            {user?.username ?? "—"}
          </div>
          <button
            onClick={logout}
            data-testid="admin-logout-button"
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-400 transition-colors duration-150 hover:bg-[#141A27] hover:text-red-400"
          >
            <LogOut className="h-4 w-4" /> Çıkış Yap
          </button>
        </div>
      </aside>
      <main className="min-h-screen flex-1 p-5 md:p-8">{children}</main>
    </div>
  );
}
