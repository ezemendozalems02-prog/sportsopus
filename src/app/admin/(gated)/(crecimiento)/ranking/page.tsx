import { computeRanking } from "@/lib/db";
import { Card } from "@/components/ui";

const MEDALS = ["🥇", "🥈", "🥉"];

export default function RankingPage() {
  const ranking = computeRanking();

  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Ranking</h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Se actualiza automáticamente con los resultados cargados en Torneos.
      </p>

      <div className="mt-6 flex flex-col gap-2">
        {ranking.map((entry, i) => (
          <Card key={entry.playerName} className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="w-6 text-center text-lg">{MEDALS[i] ?? i + 1}</span>
              <div>
                <p className="font-medium text-zinc-900 dark:text-zinc-50">{entry.playerName}</p>
                <p className="text-xs text-zinc-400">
                  {entry.wins} victoria{entry.wins !== 1 ? "s" : ""}
                  {entry.titles > 0 && ` · ${entry.titles} título${entry.titles !== 1 ? "s" : ""}`}
                </p>
              </div>
            </div>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">{entry.points} pts</span>
          </Card>
        ))}
        {ranking.length === 0 && (
          <Card>
            <p className="text-sm text-zinc-400">Todavía no hay resultados de torneos cargados.</p>
          </Card>
        )}
      </div>
    </div>
  );
}
