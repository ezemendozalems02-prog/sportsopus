import { notFound } from "next/navigation";
import Link from "next/link";
import { getOrganizationBySlug, getTournament, listMatchesForTournament, listTeamsForTournament } from "@/lib/db";
import { formatCurrency, SPORT_LABELS } from "@/lib/format";
import { formatDateLong } from "@/lib/time";
import { Card } from "@/components/ui";
import { BracketView } from "@/components/bracket";
import { RegisterTeamForm } from "./register-form";

export default async function TorneoDetailPage({ params }: { params: Promise<{ orgSlug: string; id: string }> }) {
  const { orgSlug, id } = await params;
  const org = await getOrganizationBySlug(orgSlug);
  if (!org) notFound();

  const tournament = await getTournament(org.id, id);
  if (!tournament) notFound();

  const teams = await listTeamsForTournament(id);
  const matches = await listMatchesForTournament(id);

  return (
    <div>
      <Link href={`/${orgSlug}/torneos`} className="text-sm text-zinc-500 dark:text-zinc-400">
        ← Torneos
      </Link>
      <h1 className="mt-2 text-xl font-semibold text-zinc-900 dark:text-zinc-50">{tournament.name}</h1>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        {SPORT_LABELS[tournament.sport]} · {tournament.category}
      </p>

      <Card className="mt-4">
        <div className="grid grid-cols-2 gap-y-1.5 text-sm">
          <span className="text-zinc-400">Fecha</span>
          <span className="text-right capitalize text-zinc-700 dark:text-zinc-300">{formatDateLong(tournament.date)}</span>
          <span className="text-zinc-400">Inscripción</span>
          <span className="text-right text-zinc-700 dark:text-zinc-300">{formatCurrency(tournament.entryFee)}</span>
          <span className="text-zinc-400">Premio</span>
          <span className="text-right text-zinc-700 dark:text-zinc-300">{tournament.prize}</span>
          <span className="text-zinc-400">Cupos</span>
          <span className="text-right text-zinc-700 dark:text-zinc-300">
            {teams.length}/{tournament.maxTeams}
          </span>
        </div>
      </Card>

      {tournament.status === "inscripcion" && teams.length < tournament.maxTeams && (
        <div className="mt-4">
          <RegisterTeamForm organizationId={org.id} tournamentId={tournament.id} sport={tournament.sport} />
        </div>
      )}

      <div className="mt-6">
        <p className="mb-2 text-sm font-medium text-zinc-900 dark:text-zinc-50">Equipos inscriptos</p>
        <div className="flex flex-col gap-1.5">
          {teams.map((team) => (
            <div key={team.id} className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900">
              {team.name}
            </div>
          ))}
          {teams.length === 0 && <p className="text-sm text-zinc-400">Todavía no hay equipos inscriptos.</p>}
        </div>
      </div>

      {matches.length > 0 && (
        <div className="mt-6">
          <p className="mb-2 text-sm font-medium text-zinc-900 dark:text-zinc-50">Cuadro</p>
          <BracketView matches={matches} teams={teams} />
        </div>
      )}
    </div>
  );
}
