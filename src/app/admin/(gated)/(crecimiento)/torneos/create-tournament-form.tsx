"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createTournamentAction } from "@/lib/actions";
import { SPORT_LABELS } from "@/lib/format";
import { addDaysISO, todayISO } from "@/lib/time";
import type { Sport } from "@/lib/types";

const SPORTS = Object.keys(SPORT_LABELS) as Sport[];
const SIZES = [4, 8, 16];

export function CreateTournamentForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [sport, setSport] = useState<Sport>("padel");
  const [category, setCategory] = useState("8va");
  const [date, setDate] = useState(addDaysISO(todayISO(), 14));
  const [maxTeams, setMaxTeams] = useState(8);
  const [entryFee, setEntryFee] = useState(30000);
  const [prize, setPrize] = useState("Trofeo + productos");
  const [pending, startTransition] = useTransition();

  function handleSubmit() {
    if (!name) return;
    startTransition(async () => {
      await createTournamentAction({ name, sport, category, date, maxTeams, entryFee, prize });
      setName("");
      router.refresh();
    });
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="font-medium text-zinc-900 dark:text-zinc-50">Nuevo torneo</p>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nombre del torneo"
          className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950 sm:col-span-2"
        />
        <select
          value={sport}
          onChange={(e) => setSport(e.target.value as Sport)}
          className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        >
          {SPORTS.map((s) => (
            <option key={s} value={s}>
              {SPORT_LABELS[s]}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="Categoría (Ej: 8va, Libre)"
          className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
        <label className="text-sm text-zinc-600 dark:text-zinc-400">
          Fecha
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>
        <label className="text-sm text-zinc-600 dark:text-zinc-400">
          Cupos
          <select
            value={maxTeams}
            onChange={(e) => setMaxTeams(Number(e.target.value))}
            className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          >
            {SIZES.map((s) => (
              <option key={s} value={s}>
                {s} equipos
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-zinc-600 dark:text-zinc-400">
          Inscripción
          <input
            type="number"
            min={0}
            value={entryFee}
            onChange={(e) => setEntryFee(Number(e.target.value))}
            className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>
        <input
          type="text"
          value={prize}
          onChange={(e) => setPrize(e.target.value)}
          placeholder="Premio"
          className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
      </div>
      <button
        onClick={handleSubmit}
        disabled={pending || !name}
        className="mt-3 w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60 sm:w-auto sm:px-6"
      >
        {pending ? "Creando..." : "Crear torneo"}
      </button>
    </div>
  );
}
