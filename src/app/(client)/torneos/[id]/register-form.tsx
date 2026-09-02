"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { registerTeamAction } from "@/lib/actions";

export function RegisterTeamForm({ tournamentId, sport }: { tournamentId: string; sport: string }) {
  const router = useRouter();
  const [teamName, setTeamName] = useState("");
  const [players, setPlayers] = useState(sport === "padel" ? "" : "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function handleSubmit() {
    const playerNames = players
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    if (!teamName || playerNames.length === 0) return;

    setError(null);
    startTransition(async () => {
      try {
        await registerTeamAction({ tournamentId, name: teamName, playerNames, asCurrentCustomer: true });
        setDone(true);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo inscribir el equipo");
      }
    });
  }

  if (done) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
        ¡Listo! Te inscribimos en el torneo.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="font-medium text-zinc-900 dark:text-zinc-50">Inscribirme</p>
      <label className="mt-3 block text-sm text-zinc-600 dark:text-zinc-400">
        Nombre del equipo
        <input
          type="text"
          value={teamName}
          onChange={(e) => setTeamName(e.target.value)}
          placeholder={sport === "padel" ? "Ej: Juan / Martín" : "Ej: Los Pibes FC"}
          className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
      </label>
      <label className="mt-3 block text-sm text-zinc-600 dark:text-zinc-400">
        Jugadores (separados por coma)
        <input
          type="text"
          value={players}
          onChange={(e) => setPlayers(e.target.value)}
          placeholder="Juan Pérez, Martín Gómez"
          className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
      </label>
      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
      <button
        onClick={handleSubmit}
        disabled={pending}
        className="mt-3 w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
      >
        {pending ? "Inscribiendo..." : "Confirmar inscripción"}
      </button>
    </div>
  );
}
