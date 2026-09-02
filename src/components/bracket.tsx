import type { TournamentMatch, TournamentTeam } from "@/lib/types";

const ROUND_LABELS = ["Primera ronda", "Cuartos", "Semifinal", "Final"];

function roundLabel(round: number, totalRounds: number) {
  const fromEnd = totalRounds - round; // 0 = final
  if (fromEnd === 0) return "Final";
  if (fromEnd === 1) return "Semifinal";
  if (fromEnd === 2) return "Cuartos de final";
  return ROUND_LABELS[0];
}

export function BracketView({
  matches,
  teams,
  renderAction,
}: {
  matches: TournamentMatch[];
  teams: TournamentTeam[];
  renderAction?: (match: TournamentMatch) => React.ReactNode;
}) {
  const totalRounds = matches.reduce((max, m) => Math.max(max, m.round), 0);
  const rounds = Array.from({ length: totalRounds }, (_, i) => i + 1);
  const teamName = (id?: string) => (id ? teams.find((t) => t.id === id)?.name ?? "—" : "Por definir");

  return (
    <div className="flex gap-6 overflow-x-auto pb-2">
      {rounds.map((round) => (
        <div key={round} className="flex min-w-[220px] flex-col justify-around gap-4">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">{roundLabel(round, totalRounds)}</p>
          {matches
            .filter((m) => m.round === round)
            .sort((a, b) => a.matchIndex - b.matchIndex)
            .map((match) => (
              <div key={match.id} className="rounded-xl border border-zinc-200 bg-white p-3 text-sm dark:border-zinc-800 dark:bg-zinc-900">
                <div
                  className={`flex justify-between rounded-md px-1.5 py-1 ${
                    match.winnerTeamId && match.winnerTeamId === match.teamAId
                      ? "bg-emerald-50 font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                      : "text-zinc-700 dark:text-zinc-300"
                  }`}
                >
                  <span className="truncate">{teamName(match.teamAId)}</span>
                </div>
                <div
                  className={`mt-1 flex justify-between rounded-md px-1.5 py-1 ${
                    match.winnerTeamId && match.winnerTeamId === match.teamBId
                      ? "bg-emerald-50 font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                      : "text-zinc-700 dark:text-zinc-300"
                  }`}
                >
                  <span className="truncate">{teamName(match.teamBId)}</span>
                </div>
                {match.scoreLabel && <p className="mt-1.5 text-xs text-zinc-400">{match.scoreLabel}</p>}
                {match.status === "bye" && <p className="mt-1.5 text-xs text-zinc-400">Bye</p>}
                {renderAction?.(match)}
              </div>
            ))}
        </div>
      ))}
    </div>
  );
}
