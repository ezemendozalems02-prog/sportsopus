import Link from "next/link";
import { notFound } from "next/navigation";
import { getBooking, getCourt } from "@/lib/db";
import { formatCurrency } from "@/lib/format";
import { formatDateLong } from "@/lib/time";
import { Card, StatusBadge } from "@/components/ui";

export default async function ConfirmadoPage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const { bookingId } = await params;
  const booking = getBooking(bookingId);
  if (!booking) notFound();

  const court = getCourt(booking.courtId);

  return (
    <div className="flex flex-col items-center text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl dark:bg-emerald-900/40">
        ✅
      </div>
      <h1 className="mt-4 text-xl font-semibold text-zinc-900 dark:text-zinc-50">Reserva confirmada</h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Te esperamos en {court?.name} el {formatDateLong(booking.date)} a las {booking.startTime}.
      </p>

      <Card className="mt-6 w-full text-left">
        <div className="flex items-center justify-between">
          <p className="font-medium text-zinc-900 dark:text-zinc-50">Reserva #{booking.id.slice(-6)}</p>
          <StatusBadge status={booking.status} />
        </div>
        <div className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-zinc-500 dark:text-zinc-400">Total</span>
            <span className="font-medium">{formatCurrency(booking.totalPrice)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500 dark:text-zinc-400">Seña pagada</span>
            <span className="font-medium text-emerald-600 dark:text-emerald-400">{formatCurrency(booking.depositAmount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500 dark:text-zinc-400">Saldo en el club</span>
            <span className="font-medium">{formatCurrency(booking.balanceAmount)}</span>
          </div>
        </div>
      </Card>

      <Link
        href="/mis-reservas"
        className="mt-6 w-full rounded-xl bg-zinc-900 py-3 font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
      >
        Ver mis turnos
      </Link>
    </div>
  );
}
