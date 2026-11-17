"use client";

import * as React from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { cn, formatCompact, formatFcfa, formatNumber } from "@/lib/utils";

export type ChartPoint = { date: string } & Record<string, number | string | null>;
export type ChartSeries = { key: string; label: string; money?: boolean };

const shortDate = (iso: string) => { const [, m, d] = iso.split("-"); return `${d}/${m}`; };

/** Courbe quotidienne d'un indicateur, avec sélecteur. N'affiche que les jours réellement renseignés. */
export function MetricsChart({ data, series }: { data: ChartPoint[]; series: ChartSeries[] }) {
  const [active, setActive] = React.useState(series[0]?.key ?? "");
  const current = series.find((s) => s.key === active) ?? series[0];
  if (!current) return null;
  const format = (v: number) => (current.money ? formatFcfa(v) : formatNumber(v));
  return (
    <div>
      <div className="scrollbar-none -mx-1 mb-4 flex gap-1.5 overflow-x-auto px-1" role="tablist" aria-label="Indicateur affiché">
        {series.map((s) => (
          <button key={s.key} type="button" role="tab" aria-selected={s.key === current.key} onClick={() => setActive(s.key)}
            className={cn("shrink-0 rounded-full border px-3 py-1.5 text-[0.8125rem] font-medium transition-colors", s.key === current.key ? "border-forest bg-forest text-white" : "border-line bg-surface text-ink-soft hover:border-line-strong")}>
            {s.label}
          </button>
        ))}
      </div>
      <div className="h-60 w-full sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="rp-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1f6b4a" stopOpacity={0.22} />
                <stop offset="100%" stopColor="#1f6b4a" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#e4e0d6" vertical={false} />
            <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 12, fill: "#7a786f" }} tickLine={false} axisLine={{ stroke: "#d6d1c4" }} minTickGap={24} />
            <YAxis tickFormatter={(v: number) => formatCompact(v)} tick={{ fontSize: 12, fill: "#7a786f" }} tickLine={false} axisLine={false} width={44} allowDecimals={false} />
            <Tooltip cursor={{ stroke: "#b9b3a3" }} content={({ active: on, payload, label }) => on && payload?.length ? (
              <div className="rounded-md border border-line bg-surface px-3 py-2 text-[0.8125rem] shadow-sm">
                <p className="text-muted">{shortDate(String(label))}</p>
                <p className="tnum font-medium text-ink">{format(Number(payload[0]!.value ?? 0))} <span className="font-normal text-muted">{current.money ? "" : current.label.toLowerCase()}</span></p>
              </div>
            ) : null} />
            <Area type="monotone" dataKey={current.key} stroke="#1f6b4a" strokeWidth={2} fill="url(#rp-area)" dot={data.length < 15 ? { r: 3, fill: "#1f6b4a", strokeWidth: 0 } : false} activeDot={{ r: 4 }} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
