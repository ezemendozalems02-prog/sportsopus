import { listPromotions } from "@/lib/db";
import { requireEmployeeSession } from "@/lib/session";
import { SPORT_LABELS } from "@/lib/format";
import { Card } from "@/components/ui";
import { AddPromotionForm } from "./add-promotion-form";
import { TogglePromotionButton } from "./toggle-promotion-button";
import type { Sport } from "@/lib/types";

const WEEKDAY_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

export default async function PromocionesPage({
  searchParams,
}: {
  searchParams: Promise<{ dow?: string; band?: string; sport?: string }>;
}) {
  const { organizationId } = await requireEmployeeSession();
  const promotions = await listPromotions(organizationId);
  const { dow, band, sport } = await searchParams;
  const [prefillStart, prefillEnd] = band?.split("-") ?? [];

  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Promociones</h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Se aplican automáticamente al precio cuando el cliente reserva en ese horario.
      </p>

      <div className="mt-6">
        <AddPromotionForm
          initialLabel={dow && band ? "Promo baja demanda" : undefined}
          initialDays={dow !== undefined ? [Number(dow)] : undefined}
          initialStartTime={prefillStart ? `${prefillStart.padStart(2, "0")}:00` : undefined}
          initialEndTime={prefillEnd ? `${prefillEnd.padStart(2, "0")}:00` : undefined}
          initialSports={sport ? [sport as Sport] : undefined}
        />
      </div>

      <div className="mt-6 flex flex-col gap-2">
        {promotions.map((promo) => (
          <Card key={promo.id} className="flex items-center justify-between gap-3">
            <div>
              <p className="font-medium text-zinc-900 dark:text-zinc-50">
                {promo.label} <span className="text-emerald-600 dark:text-emerald-400">-{Math.round(promo.discountPercentage * 100)}%</span>
              </p>
              <p className="text-xs text-zinc-400">
                {promo.daysOfWeek.map((d) => WEEKDAY_SHORT[d]).join(", ")} · {promo.startTime}-{promo.endTime}
                {promo.sports && promo.sports.length > 0 && ` · ${promo.sports.map((s) => SPORT_LABELS[s]).join(", ")}`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  promo.active
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                    : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800"
                }`}
              >
                {promo.active ? "Activa" : "Inactiva"}
              </span>
              <TogglePromotionButton promotionId={promo.id} active={promo.active} />
            </div>
          </Card>
        ))}
        {promotions.length === 0 && (
          <Card>
            <p className="text-sm text-zinc-400">No hay promociones creadas.</p>
          </Card>
        )}
      </div>
    </div>
  );
}
