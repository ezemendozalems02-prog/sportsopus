import Link from "next/link";
import { notFound } from "next/navigation";
import { getCourt, getOrganizationBySlug, getSlotsForCourt, listCourts } from "@/lib/db";
import { formatCurrency, SPORT_LABELS } from "@/lib/format";
import { addDaysISO, dayOfWeek, formatDateLong, todayISO } from "@/lib/time";
import { Card } from "@/components/ui";
import type { Sport } from "@/lib/types";
import { WaitlistButton } from "./waitlist-button";

const WEEKDAY_SHORT = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

const SPORTS: { value: Sport; emoji: string }[] = [
  { value: "padel", emoji: "🎾" },
  { value: "futbol5", emoji: "⚽" },
  { value: "futbol8", emoji: "⚽" },
];

function buildQuery(params: Record<string, string | undefined>) {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) usp.set(k, v);
  return usp.toString();
}

export default async function ReservarPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ sport?: string; courtId?: string; date?: string }>;
}) {
  const { orgSlug } = await params;
  const org = getOrganizationBySlug(orgSlug);
  if (!org) notFound();

  const base = `/${orgSlug}/reservar`;
  const sportParams = await searchParams;
  const sport = sportParams.sport as Sport | undefined;
  const courtId = sportParams.courtId;
  const date = sportParams.date ?? todayISO();

  if (!sport) {
    return (
      <div>
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Elegí deporte</h1>
        <div className="mt-6 grid grid-cols-2 gap-3">
          {SPORTS.map((s) => (
            <Link
              key={s.value}
              href={`${base}?${buildQuery({ sport: s.value })}`}
              className="flex flex-col items-center gap-2 rounded-2xl border border-zinc-200 bg-white py-8 transition hover:border-emerald-400 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <span className="text-3xl">{s.emoji}</span>
              <span className="font-medium text-zinc-800 dark:text-zinc-200">{SPORT_LABELS[s.value]}</span>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  if (!courtId) {
    const courts = listCourts(org.id).filter((c) => c.sport === sport && c.active);
    return (
      <div>
        <Link href={base} className="text-sm text-zinc-500 dark:text-zinc-400">
          ← Cambiar deporte
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          {SPORT_LABELS[sport]} — Elegí cancha
        </h1>
        <div className="mt-6 flex flex-col gap-3">
          {courts.map((court) => {
            const cheapest = Math.min(...court.priceRules.map((r) => r.pricePerSlot));
            return (
              <Link
                key={court.id}
                href={`${base}?${buildQuery({ sport, courtId: court.id })}`}
                className="rounded-2xl border border-zinc-200 bg-white p-4 transition hover:border-emerald-400 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <p className="font-medium text-zinc-900 dark:text-zinc-50">{court.name}</p>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  {court.indoor ? "Techada" : "Descubierta"} · {court.lighting ? "Con luz" : "Sin luz"} · {court.slotMinutes} min
                </p>
                <p className="mt-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                  Desde {formatCurrency(cheapest)}
                </p>
              </Link>
            );
          })}
          {courts.length === 0 && (
            <Card>
              <p className="text-sm text-zinc-400">Todavía no hay canchas de este deporte cargadas.</p>
            </Card>
          )}
        </div>
      </div>
    );
  }

  const court = getCourt(org.id, courtId);
  if (!court) {
    return <p className="text-sm text-red-600">Cancha no encontrada.</p>;
  }

  const days = Array.from({ length: 7 }, (_, i) => addDaysISO(todayISO(), i));
  const slots = getSlotsForCourt(org.id, courtId, date);

  return (
    <div>
      <Link href={`${base}?${buildQuery({ sport })}`} className="text-sm text-zinc-500 dark:text-zinc-400">
        ← Cambiar cancha
      </Link>
      <h1 className="mt-2 text-xl font-semibold text-zinc-900 dark:text-zinc-50">{court.name}</h1>
      <p className="text-sm capitalize text-zinc-500 dark:text-zinc-400">{formatDateLong(date)}</p>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
        {days.map((d) => {
          const dayNum = Number(d.split("-")[2]);
          const active = d === date;
          return (
            <Link
              key={d}
              href={`${base}?${buildQuery({ sport, courtId, date: d })}`}
              className={`flex h-14 w-12 shrink-0 flex-col items-center justify-center rounded-xl text-sm font-medium ${
                active
                  ? "bg-emerald-600 text-white"
                  : "border border-zinc-200 bg-white text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
              }`}
            >
              <span className="text-[10px] uppercase opacity-80">{WEEKDAY_SHORT[dayOfWeek(d)]}</span>
              {dayNum}
            </Link>
          );
        })}
      </div>

      {slots.length === 0 ? (
        <Card className="mt-6">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">La cancha no abre este día.</p>
        </Card>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-3">
          {slots.map((slot) =>
            slot.available ? (
              <Link
                key={slot.startTime}
                href={`/${orgSlug}/reservar/confirmar?${buildQuery({ courtId, date, startTime: slot.startTime })}`}
                className="rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-center transition hover:border-emerald-500 dark:border-emerald-800 dark:bg-emerald-950/40"
              >
                <p className="font-medium text-emerald-700 dark:text-emerald-300">{slot.startTime}</p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400">
                  {slot.discountLabel && <span className="mr-1 text-emerald-500/70 line-through">{formatCurrency(slot.basePrice)}</span>}
                  {formatCurrency(slot.price)}
                </p>
                {slot.discountLabel && <p className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">🎉 {slot.discountLabel}</p>}
              </Link>
            ) : (
              <div
                key={slot.startTime}
                className="rounded-xl border border-zinc-200 bg-zinc-100 p-3 text-center dark:border-zinc-800 dark:bg-zinc-900"
              >
                <p className="font-medium text-zinc-400 dark:text-zinc-500">{slot.startTime}</p>
                <p className="text-xs text-zinc-400">Ocupado</p>
                <WaitlistButton organizationId={org.id} courtId={courtId} date={date} startTime={slot.startTime} />
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
