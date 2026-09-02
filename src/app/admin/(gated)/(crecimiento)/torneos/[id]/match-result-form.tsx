"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recordMatchResultAction } from "@/lib/actions";

export function MatchResultForm({
  matchId,
  tournamentId,
  teamAId,
  teamBId,
  teamAName,
  teamBName,
}: {
  matchId: string;
  tournamentId: string;
  teamAId: string;
  teamBId: string;
  teamAName: string;
  teamBName: string;
}) {
  const router = useRouter();
  const [winner, setWinner] = useState<string>(teamAId);
  const [score, setScore] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <div className="mt-2 border-t border-zinc-100 pt-2 dark:border-zinc-800">
      <select
        value={winner}
        onChange={(e) => setWinner(e.target.value)}
        className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-950"
      >
        <option value={teamAId}>Ganó: {teamAName}</option>
        <option value={teamBId}>Ganó: {teamBName}</option>
      </select>
      <input
        type="text"
        value={score}
        onChange={(e) => setScore(e.target.value)}
        placeholder="Resultado (ej: 6-4 6-3)"
        className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-950"
      />
      <button
        onClick={() =>
          startTransition(async () => {
            await recordMatchResultAction(matchId, winner, score, tournamentId);
            router.refresh();
          })
        }
        disabled={pending}
        className="mt-1.5 w-full rounded-lg bg-emerald-600 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
      >
        {pending ? "Guardando..." : "Cargar resultado"}
      </button>
    </div>
  );
}
