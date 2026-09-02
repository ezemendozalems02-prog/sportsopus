"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createCourtAction } from "@/lib/actions";
import type { Sport } from "@/lib/types";

const SPORTS: { value: Sport; label: string }[] = [
  { value: "padel", label: "Pádel" },
  { value: "futbol5", label: "Fútbol 5" },
  { value: "futbol8", label: "Fútbol 8" },
  { value: "futbol11", label: "Fútbol 11" },
];

export function NewCourtForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [sport, setSport] = useState<Sport>("padel");
  const [basePrice, setBasePrice] = useState(15000);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-xl border border-dashed border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-600 hover:border-emerald-400 hover:text-emerald-600 dark:border-zinc-700 dark:text-zinc-300"
      >
        + Agregar cancha
      </button>
    );
  }

  function handleSubmit() {
    if (!name || basePrice <= 0) return;
    setError(null);
    startTransition(async () => {
      try {
        await createCourtAction({
          name,
          sport,
          basePrice,
          surface: "sintetico",
          indoor: false,
          lighting: true,
          slotMinutes: sport === "padel" ? 90 : 60,
          openTime: "08:00",
          closeTime: "23:00",
        });
        setName("");
        setOpen(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo crear la cancha");
      }
    });
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="font-medium text-zinc-900 dark:text-zinc-50">Nueva cancha</p>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="text-sm text-zinc-600 dark:text-zinc-400">
          Nombre
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Pádel 5"
            className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>
        <label className="text-sm text-zinc-600 dark:text-zinc-400">
          Deporte
          <select
            value={sport}
            onChange={(e) => setSport(e.target.value as Sport)}
            className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          >
            {SPORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-zinc-600 dark:text-zinc-400">
          Precio base del turno
          <input
            type="number"
            value={basePrice}
            onChange={(e) => setBasePrice(Number(e.target.value))}
            className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>
      </div>
      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={pending || !name}
          className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {pending ? "Creando..." : "Crear cancha"}
        </button>
        <button
          onClick={() => setOpen(false)}
          className="rounded-xl px-4 py-2 text-sm font-medium text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
