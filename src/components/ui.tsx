import { BOOKING_STATUS_LABELS } from "@/lib/format";
import type { BookingStatus } from "@/lib/types";

const badgeColors: Record<string, string> = {
  amber: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  blue: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  violet: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300",
  orange: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  zinc: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  red: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  green: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
};

export function StatusBadge({ status }: { status: BookingStatus }) {
  const meta = BOOKING_STATUS_LABELS[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap ${badgeColors[meta.color]}`}
    >
      {meta.label}
    </span>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 ${className}`}>
      {children}
    </div>
  );
}

export function StatTile({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <Card>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">{value}</p>
      {sub && <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{sub}</p>}
    </Card>
  );
}

export function OccupancyBar({ label, percentage }: { label: string; percentage: number }) {
  const pct = Math.round(percentage * 100);
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 shrink-0 text-sm text-zinc-600 dark:text-zinc-400">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
        <div
          className="h-full rounded-full bg-emerald-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-10 shrink-0 text-right text-sm font-medium text-zinc-700 dark:text-zinc-300">{pct}%</span>
    </div>
  );
}

export function BarChart({
  data,
  formatValue,
  formatLabel,
}: {
  data: { label: string; value: number }[];
  formatValue?: (value: number) => string;
  formatLabel?: (label: string) => string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex h-40 items-end gap-1.5">
      {data.map((d) => (
        <div key={d.label} className="group relative flex flex-1 flex-col items-center justify-end gap-1">
          <span className="pointer-events-none absolute -top-6 hidden whitespace-nowrap rounded-md bg-zinc-900 px-1.5 py-0.5 text-[10px] text-white group-hover:block dark:bg-zinc-700">
            {formatValue ? formatValue(d.value) : d.value}
          </span>
          <div
            className="w-full rounded-t-sm bg-emerald-500/80 transition group-hover:bg-emerald-500"
            style={{ height: `${Math.max(2, (d.value / max) * 100)}%` }}
          />
          <span className="text-[10px] text-zinc-400">{formatLabel ? formatLabel(d.label) : d.label}</span>
        </div>
      ))}
    </div>
  );
}
