import Link from "next/link";
import { getCourt, getCustomer, listBookingsForDate } from "@/lib/db";
import { requireEmployeeSession } from "@/lib/session";
import { formatCurrency } from "@/lib/format";
import { addDaysISO, formatDateLong, todayISO } from "@/lib/time";
import { Card, StatusBadge } from "@/components/ui";
import { BookingActions } from "./booking-actions";

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { organizationId } = await requireEmployeeSession("/admin/agenda");
  const { date: dateParam } = await searchParams;
  const date = dateParam ?? todayISO();
  const bookingsForDate = await listBookingsForDate(organizationId, date);
  const bookings = bookingsForDate.sort((a, b) => (a.startTime > b.startTime ? 1 : -1));
  const bookingsWithDetails = await Promise.all(
    bookings.map(async (booking) => ({
      booking,
      court: await getCourt(organizationId, booking.courtId),
      customer: await getCustomer(organizationId, booking.customerId),
    }))
  );

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Agenda</h1>
          <p className="mt-1 text-sm capitalize text-zinc-500 dark:text-zinc-400">{formatDateLong(date)}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/admin/agenda?date=${addDaysISO(date, -1)}`}
            className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            ← Anterior
          </Link>
          <Link
            href={`/admin/agenda?date=${todayISO()}`}
            className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Hoy
          </Link>
          <Link
            href={`/admin/agenda?date=${addDaysISO(date, 1)}`}
            className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Siguiente →
          </Link>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3">
        {bookingsWithDetails.map(({ booking, court, customer }) => {
          return (
            <Card key={booking.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-4">
                  <div className="text-center">
                    <p className="font-semibold text-zinc-900 dark:text-zinc-50">{booking.startTime}</p>
                    <p className="text-xs text-zinc-400">{booking.endTime}</p>
                  </div>
                  <div>
                    <p className="font-medium text-zinc-900 dark:text-zinc-50">{court?.name}</p>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">{customer?.name}</p>
                    <p className="mt-1 text-xs text-zinc-400">
                      Total {formatCurrency(booking.totalPrice)} · Seña {formatCurrency(booking.depositAmount)}
                      {booking.balanceAmount > 0 && ` · Saldo ${formatCurrency(booking.balanceAmount)}`}
                    </p>
                  </div>
                </div>
                <StatusBadge status={booking.status} />
              </div>
              <div className="mt-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                <BookingActions bookingId={booking.id} status={booking.status} balanceAmount={booking.balanceAmount} />
              </div>
            </Card>
          );
        })}
        {bookings.length === 0 && (
          <Card>
            <p className="text-sm text-zinc-400">No hay reservas para este día.</p>
          </Card>
        )}
      </div>
    </div>
  );
}
