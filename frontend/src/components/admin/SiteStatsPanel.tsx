import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";
import type { SiteStats } from "@/lib/types";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { MousePointerClick, TrendingUp, Trophy } from "lucide-react";

const RANGES = [7, 14, 30] as const;

/** Günlük tıklama grafiği + sponsor bazlı sıralama. */
export default function SiteStatsPanel({ siteId }: { siteId: string }) {
  const [days, setDays] = useState<number>(7);

  const { data, isLoading } = useQuery({
    queryKey: ["stats", siteId, days],
    queryFn: () => apiGet<SiteStats>(`/sites/${siteId}/stats?days=${days}`),
    retry: false,
  });

  const daily = (data?.daily ?? []).map((d) => ({
    ...d,
    label: d.day.slice(5).replace("-", "."),
  }));
  const top = data?.slots ?? [];
  const maxRange = Math.max(1, ...top.map((s) => s.clicks_range));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {RANGES.map((r) => (
          <button
            key={r}
            onClick={() => setDays(r)}
            className={`rounded-lg border px-3 py-2 text-xs font-bold uppercase tracking-wide transition-colors duration-150 ${
              days === r
                ? "border-amber-500 bg-amber-500/10 text-amber-400"
                : "border-[#1E293B] text-slate-400 hover:text-slate-100"
            }`}
            data-testid={`stats-range-${r}`}
          >
            {r} gün
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          {
            label: "Toplam tıklama (tüm zamanlar)",
            value: data?.total_clicks ?? 0,
            icon: MousePointerClick,
            testId: "stats-total-clicks",
          },
          {
            label: `Son ${days} gün`,
            value: data?.range_clicks ?? 0,
            icon: TrendingUp,
            testId: "stats-range-clicks",
          },
          {
            label: "Lider sponsor",
            value: top[0]?.clicks_range ?? 0,
            hint: top[0]?.title ?? "—",
            icon: Trophy,
            testId: "stats-top-sponsor",
          },
        ].map(({ label, value, hint, icon: Icon, testId }) => (
          <div key={label} className="rounded-xl border border-[#1E293B] bg-[#121620] p-5" data-testid={testId}>
            <Icon className="h-4 w-4 text-amber-500" />
            <p className="mt-3 font-heading text-3xl font-black tracking-tight">{value}</p>
            <p className="mt-1 text-xs text-slate-400">{label}</p>
            {hint ? <p className="mt-0.5 text-[11px] font-bold uppercase text-cyan-300">{hint}</p> : null}
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-[#1E293B] bg-[#121620] p-5">
        <h2 className="mb-4 font-heading text-base font-bold tracking-tight">Günlük Tıklama Grafiği</h2>
        {isLoading ? (
          <div className="h-64 animate-pulse rounded-lg bg-white/5" />
        ) : (
          <div className="h-64 w-full" data-testid="stats-daily-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={daily} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid stroke="#1E293B" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "#64748B", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: "#64748B", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: "#0B0E17", border: "1px solid #1E293B", borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: "#94A3B8" }}
                  formatter={(v: number) => [`${v} tıklama`, ""]}
                />
                <Bar dataKey="clicks" radius={[4, 4, 0, 0]}>
                  {daily.map((d) => (
                    <Cell key={d.day} fill="#F59E0B" />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-[#1E293B] bg-[#121620] p-5">
        <h2 className="mb-4 font-heading text-base font-bold tracking-tight">Sponsor Sıralaması</h2>
        {top.length === 0 ? (
          <p className="text-sm text-slate-400" data-testid="stats-empty">Henüz tıklama verisi yok.</p>
        ) : (
          <div className="space-y-3" data-testid="stats-slot-list">
            {top.map((s, i) => (
              <div key={s.slot_id} className="flex items-center gap-3" data-testid="stats-slot-row">
                <span className="w-5 shrink-0 font-mono text-xs text-slate-500">{i + 1}</span>
                <span className="w-36 shrink-0 truncate text-sm font-bold" title={s.title}>
                  {s.title}
                </span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[#0B0E17]">
                  <div
                    className="h-full rounded-full transition-[width] duration-500 ease-out"
                    style={{
                      width: `${Math.round((s.clicks_range / maxRange) * 100)}%`,
                      background: s.border_color,
                    }}
                  />
                </div>
                <span className="w-24 shrink-0 text-right font-mono text-xs text-slate-400">
                  {s.clicks_range} / {s.clicks_total}
                </span>
              </div>
            ))}
            <p className="pt-1 text-[11px] text-slate-500">
              Soldaki sayı seçili dönem, sağdaki tüm zamanların toplamıdır.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
