"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { registerTeamAction } from "@/lib/actions";

export function RegisterTeamForm({ tournamentId }: { tournamentId: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [players, setPlayers] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit() {
    const playerNames = players.split(",").map((p) => p.trim()).filter(Boolean);
    if (!name || playerNames.length === 0) return;
    setError(null);
    startTransition(async () => {
      try {
        await registerTeamAction({ tournamentId, name, playerNames });
        setName("");
        setPlayers("");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo inscribir");
      }
    });
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="font-medium text-zinc-900 dark:text-zinc-50">Inscribir equipo</p>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nombre del equipo"
          className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
        <input
          type="text"
          value={players}
          onChange={(e) => setPlayers(e.target.value)}
          placeholder="Jugadores separados por coma"
          className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
      </div>
      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
      <button
        onClick={handleSubmit}
        disabled={pending || !name}
        className="mt-3 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
      >
        {pending ? "Inscribiendo..." : "Inscribir"}
      </button>
    </div>
  );
}
