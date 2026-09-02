import { notFound } from "next/navigation";
import Link from "next/link";
import { getTournament, listMatchesForTournament, listTeamsForTournament } from "@/lib/db";
import { formatCurrency, SPORT_LABELS } from "@/lib/format";
import { formatDateLong } from "@/lib/time";
import { Card, StatTile } from "@/components/ui";
import { BracketView } from "@/components/bracket";
import { RegisterTeamForm } from "./register-team-form";
import { GenerateBracketButton } from "./generate-bracket-button";
import { MatchResultForm } from "./match-result-form";

export default async function AdminTorneoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tournament = getTournament(id);
  if (!tournament) notFound();

  const teams = listTeamsForTournament(id);
  const matches = listMatchesForTournament(id);
  const revenue = teams.length * tournament.entryFee;

  return (
    <div>
      <Link href="/admin/torneos" className="text-sm text-zinc-500 dark:text-zinc-400">
        ← Torneos
      </Link>
      <h1 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{tournament.name}</h1>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        {SPORT_LABELS[tournament.sport]} · {tournament.category} · <span className="capitalize">{formatDateLong(tournament.date)}</span>
      </p>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile label="Inscriptos" value={`${teams.length}/${tournament.maxTeams}`} />
        <StatTile label="Ingresos" value={formatCurrency(revenue)} />
        <StatTile label="Premio" value={tournament.prize} />
        <StatTile label="Estado" value={tournament.status === "inscripcion" ? "Inscripción" : tournament.status === "en_curso" ? "En curso" : "Finalizado"} />
      </div>

      {tournament.status === "inscripcion" && (
        <div className="mt-6 flex flex-col gap-4">
          <RegisterTeamForm tournamentId={tournament.id} />
          {teams.length >= 2 && <GenerateBracketButton tournamentId={tournament.id} />}
        </div>
      )}

      {teams.length > 0 && matches.length === 0 && (
        <div className="mt-6">
          <p className="mb-2 text-sm font-medium text-zinc-900 dark:text-zinc-50">Equipos inscriptos</p>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {teams.map((team) => (
              <div key={team.id} className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900">
                {team.name}
              </div>
            ))}
          </div>
        </div>
      )}

      {matches.length > 0 && (
        <div className="mt-6">
          <p className="mb-2 text-sm font-medium text-zinc-900 dark:text-zinc-50">Cuadro</p>
          <Card>
            <BracketView
              matches={matches}
              teams={teams}
              renderAction={(match) =>
                match.status === "pendiente" && match.teamAId && match.teamBId ? (
                  <MatchResultForm
                    matchId={match.id}
                    tournamentId={tournament.id}
                    teamAId={match.teamAId}
                    teamBId={match.teamBId}
                    teamAName={teams.find((t) => t.id === match.teamAId)?.name ?? ""}
                    teamBName={teams.find((t) => t.id === match.teamBId)?.name ?? ""}
                  />
                ) : null
              }
            />
          </Card>
        </div>
      )}
    </div>
  );
}
