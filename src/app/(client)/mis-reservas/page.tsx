import {
  getCourt,
  getCurrentCustomer,
  listBookingsForCustomer,
  listWaitlistForCustomer,
} from "@/lib/db";
import { formatCurrency } from "@/lib/format";
import { formatDateLong } from "@/lib/time";
import { Card, StatusBadge } from "@/components/ui";

const WAITLIST_STATUS_LABELS: Record<string, string> = {
  esperando: "Esperando",
  notificado: "¡Se liberó! Reservalo",
  expirado: "Expirado",
  reservado: "Reservado",
};

export default function MisReservasPage() {
  const customer = getCurrentCustomer();
  const bookings = listBookingsForCustomer(customer.id);
  const waitlist = listWaitlistForCustomer(customer.id).filter((w) => w.status !== "reservado");

  return (
    <div>
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Mis turnos</h1>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">{bookings.length} reservas en total</p>

      {waitlist.length > 0 && (
        <div className="mt-4 flex flex-col gap-2">
          {waitlist.map((entry) => {
            const court = getCourt(entry.courtId);
            return (
              <div
                key={entry.id}
                className={`rounded-xl border px-3 py-2.5 text-sm ${
                  entry.status === "notificado"
                    ? "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40"
                    : "border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900"
                }`}
              >
                <p className="font-medium text-zinc-800 dark:text-zinc-200">
                  Lista de espera · {court?.name} — {entry.date} {entry.startTime}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">{WAITLIST_STATUS_LABELS[entry.status]}</p>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-6 flex flex-col gap-3">
        {bookings.map((booking) => {
          const court = getCourt(booking.courtId);
          return (
            <Card key={booking.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-zinc-900 dark:text-zinc-50">
                    {court?.name}
                    {booking.recurringGroupId && (
                      <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                        Serie semanal
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-sm capitalize text-zinc-500 dark:text-zinc-400">
                    {formatDateLong(booking.date)} · {booking.startTime}
                  </p>
                  {booking.discountLabel && (
                    <p className="mt-0.5 text-xs text-emerald-600 dark:text-emerald-400">🎉 {booking.discountLabel}</p>
                  )}
                </div>
                <StatusBadge status={booking.status} />
              </div>
              <div className="mt-3 flex justify-between text-sm">
                <span className="text-zinc-500 dark:text-zinc-400">Total {formatCurrency(booking.totalPrice)}</span>
                {booking.status === "pendiente_pago" ? (
                  <span className="font-medium text-amber-600 dark:text-amber-400">
                    Falta seña {formatCurrency(booking.depositAmount)}
                  </span>
                ) : booking.balanceAmount > 0 && booking.status !== "cancelada" ? (
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">
                    Saldo en cancha {formatCurrency(booking.balanceAmount)}
                  </span>
                ) : (
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">Pagado</span>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
