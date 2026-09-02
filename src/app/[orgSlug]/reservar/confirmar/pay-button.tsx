"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { reserveSlotAction } from "@/lib/actions";

const WEEK_OPTIONS = [
  { value: 1, label: "Solo esta vez" },
  { value: 4, label: "4 semanas" },
  { value: 8, label: "8 semanas" },
  { value: 12, label: "12 semanas" },
];

export function PayButton({
  organizationId,
  orgSlug,
  courtId,
  date,
  startTime,
  initialContact,
}: {
  organizationId: string;
  orgSlug: string;
  courtId: string;
  date: string;
  startTime: string;
  initialContact?: { name: string; email: string; phone: string };
}) {
  const router = useRouter();
  const [weeks, setWeeks] = useState(1);
  const [name, setName] = useState(initialContact?.name ?? "");
  const [email, setEmail] = useState(initialContact?.email ?? "");
  const [phone, setPhone] = useState(initialContact?.phone ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ createdCount: number; skippedDates: string[] } | null>(null);

  async function handlePay() {
    setLoading(true);
    setError(null);
    try {
      const res = await reserveSlotAction({
        organizationId,
        courtId,
        date,
        startTime,
        weeks,
        contact: { name, email, phone },
      });
      if (weeks === 1) {
        router.push(`/${orgSlug}/reservar/confirmado/${res.bookingId}`);
        return;
      }
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo completar la reserva");
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    return (
      <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm dark:border-emerald-900 dark:bg-emerald-950/40">
        <p className="font-medium text-emerald-800 dark:text-emerald-300">
          Reservamos {result.createdCount} turno{result.createdCount > 1 ? "s" : ""} semanal{result.createdCount > 1 ? "es" : ""}.
        </p>
        {result.skippedDates.length > 0 && (
          <p className="mt-1 text-amber-700 dark:text-amber-400">
            No pudimos reservar: {result.skippedDates.join(", ")} (horario ya ocupado).
          </p>
        )}
        <button
          onClick={() => router.push(`/${orgSlug}/mis-reservas`)}
          className="mt-3 w-full rounded-xl bg-zinc-900 py-2.5 font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          Ver mis turnos
        </button>
      </div>
    );
  }

  const canSubmit = name && email && phone;

  return (
    <div className="mt-6">
      <div className="flex flex-col gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Tu nombre"
          className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Tu email"
          className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Tu teléfono"
          className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
      </div>

      <label className="mt-3 block text-sm text-zinc-600 dark:text-zinc-400">
        Repetir todas las semanas
        <select
          value={weeks}
          onChange={(e) => setWeeks(Number(e.target.value))}
          className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        >
          {WEEK_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>

      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}

      <button
        onClick={handlePay}
        disabled={loading || !canSubmit}
        className="mt-3 w-full rounded-xl bg-emerald-600 py-3 font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60"
      >
        {loading ? "Procesando pago..." : "Pagar seña con Mercado Pago"}
      </button>
    </div>
  );
}
