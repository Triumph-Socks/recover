import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useUI } from "../store";
import { fmtMoneyCompact } from "../lib/utils";

function useChartTheme() {
  const theme = useUI((s) => s.theme);
  const dark = theme === "dark";
  return {
    grid: dark ? "#27272a" : "#e4e4e7",
    axis: dark ? "#71717a" : "#a1a1aa",
    tooltipBg: dark ? "#18181b" : "#ffffff",
    tooltipBorder: dark ? "#27272a" : "#e4e4e7",
    blue: dark ? "#3b82f6" : "#2563eb",
    emerald: dark ? "#10b981" : "#059669",
    rose: dark ? "#fb7185" : "#e11d48",
    amber: dark ? "#f59e0b" : "#d97706",
    blueFill: dark ? "rgba(59,130,246,0.14)" : "rgba(37,99,235,0.08)",
    emeraldFill: dark ? "rgba(16,185,129,0.12)" : "rgba(5,150,105,0.07)",
  };
}

function ChartTooltipContent({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  const t = useChartTheme();
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-md border px-3 py-2 shadow-lg" style={{ background: t.tooltipBg, borderColor: t.tooltipBorder }}>
      <p className="mb-1 text-[11px] font-medium text-muted-foreground">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 text-xs">
          <span className="h-2 w-2 rounded-[2px]" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="tnum font-semibold text-foreground">{fmtMoneyCompact(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

/* ---------- daily collections area chart ---------- */

export function CollectionsArea({ data, height = 260 }: { data: { label: string; collected: number; target: number }[]; height?: number }) {
  const t = useChartTheme();
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="collFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={t.blue} stopOpacity={0.22} />
            <stop offset="100%" stopColor={t.blue} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={t.grid} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" tick={{ fill: t.axis, fontSize: 10.5 }} tickLine={false} axisLine={{ stroke: t.grid }} interval="preserveStartEnd" minTickGap={28} />
        <YAxis tick={{ fill: t.axis, fontSize: 10.5 }} tickLine={false} axisLine={false} tickFormatter={(v: number) => fmtMoneyCompact(v)} width={52} />
        <Tooltip content={<ChartTooltipContent />} cursor={{ stroke: t.axis, strokeDasharray: "3 3" }} />
        <ReferenceLine y={data.length ? data[0].target : 0} stroke={t.amber} strokeDasharray="5 4" strokeWidth={1.2} />
        <Area type="monotone" dataKey="collected" name="Collected" stroke={t.blue} strokeWidth={2} fill="url(#collFill)" dot={false} activeDot={{ r: 3.5, strokeWidth: 0 }} isAnimationActive animationDuration={700} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* ---------- aging buckets bar chart ---------- */

export function BucketsBar({ data, height = 260 }: { data: { label: string; balance: number; color: string }[]; height?: number }) {
  const t = useChartTheme();
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="28%">
        <CartesianGrid stroke={t.grid} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" tick={{ fill: t.axis, fontSize: 10.5 }} tickLine={false} axisLine={{ stroke: t.grid }} />
        <YAxis tick={{ fill: t.axis, fontSize: 10.5 }} tickLine={false} axisLine={false} tickFormatter={(v: number) => fmtMoneyCompact(v)} width={52} />
        <Tooltip content={<ChartTooltipContent />} cursor={{ fill: t.grid, opacity: 0.35 }} />
        <Bar dataKey="balance" name="Outstanding" radius={[4, 4, 0, 0]} isAnimationActive animationDuration={700}>
          {data.map((d) => (
            <Cell key={d.label} fill={d.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ---------- sparkline ---------- */

export function Sparkline({ data, color, height = 36 }: { data: number[]; color: string; height?: number }) {
  const points = data.map((v, i) => ({ i, v }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={points} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`spark-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.25} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.6} fill={`url(#spark-${color.replace("#", "")})`} dot={false} isAnimationActive animationDuration={600} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
