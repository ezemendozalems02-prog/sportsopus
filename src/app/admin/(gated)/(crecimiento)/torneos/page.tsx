import Link from "next/link";
import { listTeamsForTournament, listTournaments } from "@/lib/db";
import { requireEmployeeSession } from "@/lib/session";
import { formatCurrency, SPORT_LABELS } from "@/lib/format";
import { formatDateLong } from "@/lib/time";
import { Card } from "@/components/ui";
import { CreateTournamentForm } from "./create-tournament-form";

const STATUS_LABELS: Record<string, string> = {
  inscripcion: "Inscripción",
  en_curso: "En curso",
  finalizado: "Finalizado",
};

export default async function TorneosAdminPage() {
  const { organizationId } = await requireEmployeeSession("/admin/torneos");
  const tournaments = await listTournaments(organizationId);
  const tournamentsWithTeams = await Promise.all(
    tournaments.map(async (tournament) => ({
      tournament,
      teams: await listTeamsForTournament(tournament.id),
    }))
  );

  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Torneos</h1>

      <div className="mt-6">
        <CreateTournamentForm />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {tournamentsWithTeams.map(({ tournament, teams }) => {
          const revenue = teams.length * tournament.entryFee;
          return (
            <Link key={tournament.id} href={`/admin/torneos/${tournament.id}`}>
              <Card className="transition hover:border-emerald-400">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-zinc-900 dark:text-zinc-50">{tournament.name}</p>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
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
                  <span className="font-medium text-zinc-900 dark:text-zinc-50">Ingresos {formatCurrency(revenue)}</span>
                </div>
              </Card>
            </Link>
          );
        })}
        {tournamentsWithTeams.length === 0 && (
          <Card>
            <p className="text-sm text-zinc-400">No hay torneos creados.</p>
          </Card>
        )}
      </div>
    </div>
  );
}
