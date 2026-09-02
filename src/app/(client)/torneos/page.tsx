import Link from "next/link";
import { listTeamsForTournament, listTournaments } from "@/lib/db";
import { formatCurrency, SPORT_LABELS } from "@/lib/format";
import { formatDateLong } from "@/lib/time";
import { Card } from "@/components/ui";

const STATUS_LABELS: Record<string, string> = {
  inscripcion: "Inscripción abierta",
  en_curso: "En curso",
  finalizado: "Finalizado",
};

export default function TorneosPage() {
  const tournaments = listTournaments();

  return (
    <div>
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Torneos</h1>

      <div className="mt-6 flex flex-col gap-3">
        {tournaments.map((tournament) => {
          const teams = listTeamsForTournament(tournament.id);
          return (
            <Link key={tournament.id} href={`/torneos/${tournament.id}`}>
              <Card className="transition hover:border-emerald-400">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-zinc-900 dark:text-zinc-50">{tournament.name}</p>
                    <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
                      {SPORT_LABELS[tournament.sport]} · {tournament.category}
                    </p>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                    {STATUS_LABELS[tournament.status]}
                  </span>
                </div>
                <p className="mt-2 text-sm capitalize text-zinc-500 dark:text-zinc-400">{formatDateLong(tournament.date)}</p>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-zinc-500 dark:text-zinc-400">
                    {teams.length}/{tournament.maxTeams} inscriptos
                  </span>
                  <span className="font-medium text-zinc-900 dark:text-zinc-50">{formatCurrency(tournament.entryFee)}</span>
                </div>
              </Card>
            </Link>
          );
        })}
        {tournaments.length === 0 && (
          <Card>
            <p className="text-sm text-zinc-400">No hay torneos programados todavía.</p>
          </Card>
        )}
      </div>
    </div>
  );
}
