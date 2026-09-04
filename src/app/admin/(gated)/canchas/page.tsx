import { getOrganizationById, getSlotsForCourt, listCourts } from "@/lib/db";
import { requireEmployeeSession } from "@/lib/session";
import { formatCurrency, SPORT_LABELS } from "@/lib/format";
import { todayISO } from "@/lib/time";
import { Card } from "@/components/ui";
import { NewCourtForm } from "./new-court-form";
import { PaymentSettingsForm } from "./payment-settings-form";

export default async function CanchasPage() {
  const { organizationId } = await requireEmployeeSession("/admin/canchas");
  const today = todayISO();
  const organization = await getOrganizationById(organizationId);
  const courts = await listCourts(organizationId);
  const courtsWithOccupancy = await Promise.all(
    courts.map(async (court) => {
      const slotsToday = await getSlotsForCourt(organizationId, court.id, today);
      const occupied = slotsToday.filter((s) => !s.available).length;
      const occupancy = slotsToday.length ? Math.round((occupied / slotsToday.length) * 100) : 0;
      return { court, occupancy };
    })
  );

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Canchas</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{courts.length} canchas configuradas</p>
        </div>
      </div>

      <div className="mt-6">
        <PaymentSettingsForm
          paymentAlias={organization?.paymentAlias ?? ""}
          whatsappNumber={organization?.whatsappNumber ?? ""}
        />
      </div>

      <div className="mt-6">
        <NewCourtForm />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {courtsWithOccupancy.map(({ court, occupancy }) => {
          return (
            <Card key={court.id}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-zinc-900 dark:text-zinc-50">{court.name}</p>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">{SPORT_LABELS[court.sport]}</p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    court.active
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                      : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800"
                  }`}
                >
                  {court.active ? "Activa" : "Inactiva"}
                </span>
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-y-1.5 text-sm">
                <dt className="text-zinc-400">Superficie</dt>
                <dd className="text-right capitalize text-zinc-700 dark:text-zinc-300">{court.surface.replace(/_/g, " ")}</dd>
                <dt className="text-zinc-400">Ambiente</dt>
                <dd className="text-right text-zinc-700 dark:text-zinc-300">{court.indoor ? "Techada" : "Descubierta"}</dd>
                <dt className="text-zinc-400">Iluminación</dt>
                <dd className="text-right text-zinc-700 dark:text-zinc-300">{court.lighting ? "Sí" : "No"}</dd>
                <dt className="text-zinc-400">Duración turno</dt>
                <dd className="text-right text-zinc-700 dark:text-zinc-300">{court.slotMinutes} min</dd>
                <dt className="text-zinc-400">Horario</dt>
                <dd className="text-right text-zinc-700 dark:text-zinc-300">{court.openTime}–{court.closeTime}</dd>
                <dt className="text-zinc-400">Ocupación hoy</dt>
                <dd className="text-right font-medium text-zinc-900 dark:text-zinc-50">{occupancy}%</dd>
              </dl>

              <div className="mt-4 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">Precios</p>
                <div className="mt-2 flex flex-col gap-1">
                  {court.priceRules.map((rule) => (
                    <div key={rule.id} className="flex justify-between text-sm">
                      <span className="text-zinc-500 dark:text-zinc-400">
                        {rule.label} ({rule.startTime}-{rule.endTime})
                      </span>
                      <span className="font-medium text-zinc-800 dark:text-zinc-200">{formatCurrency(rule.pricePerSlot)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          );
        })}
        {courts.length === 0 && (
          <Card>
            <p className="text-sm text-zinc-400">Todavía no tenés canchas cargadas — agregá la primera arriba.</p>
          </Card>
        )}
      </div>
    </div>
  );
}
