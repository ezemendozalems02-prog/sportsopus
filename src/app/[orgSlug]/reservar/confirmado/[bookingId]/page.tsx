import Link from "next/link";
import { notFound } from "next/navigation";
import { getBooking, getCourt, getOrganizationBySlug } from "@/lib/db";
import { formatCurrency } from "@/lib/format";
import { formatDateLong } from "@/lib/time";
import { Card, StatusBadge } from "@/components/ui";
import { PendingCountdown } from "./pending-countdown";

const PENDING_PAYMENT_MINUTES = 15;

export default async function ConfirmadoPage({
  params,
}: {
  params: Promise<{ orgSlug: string; bookingId: string }>;
}) {
  const { orgSlug, bookingId } = await params;
  const org = await getOrganizationBySlug(orgSlug);
  if (!org) notFound();

  const booking = await getBooking(org.id, bookingId);
  if (!booking) notFound();

  const court = await getCourt(org.id, booking.courtId);

  if (booking.status === "pendiente_pago") {
    const whatsappDigits = org.whatsappNumber?.replace(/\D/g, "");
    const message = `Hola! Te mando el comprobante de la seña de mi reserva en ${court?.name ?? "cancha"} el ${formatDateLong(booking.date)} a las ${booking.startTime}. Reserva #${booking.id.slice(-6)}.`;
    const whatsappUrl = whatsappDigits
      ? `https://wa.me/${whatsappDigits}?text=${encodeURIComponent(message)}`
      : undefined;

    return (
      <div className="flex flex-col items-center text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-2xl dark:bg-amber-900/40">
          ⏳
        </div>
        <h1 className="mt-4 text-xl font-semibold text-zinc-900 dark:text-zinc-50">Falta confirmar la seña</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Reservamos tu turno en {court?.name} el {formatDateLong(booking.date)} a las {booking.startTime} — todavía
          no está confirmado.
        </p>

        <div className="mt-4 w-full rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          ⚠️ Si no recibimos la seña en{" "}
          <PendingCountdown createdAt={booking.createdAt} minutes={PENDING_PAYMENT_MINUTES} /> minutos, el turno se
          libera automáticamente.
        </div>

        <Card className="mt-4 w-full text-left">
          <p className="font-medium text-zinc-900 dark:text-zinc-50">Transferí la seña</p>
          <div className="mt-3 flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2.5 dark:bg-zinc-800">
            <span className="text-sm text-zinc-500 dark:text-zinc-400">Monto</span>
            <span className="font-semibold text-zinc-900 dark:text-zinc-50">{formatCurrency(booking.depositAmount)}</span>
          </div>
          <div className="mt-2 flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2.5 dark:bg-zinc-800">
            <span className="text-sm text-zinc-500 dark:text-zinc-400">Alias / CBU</span>
            <span className="font-semibold text-zinc-900 dark:text-zinc-50">{org.paymentAlias || "Consultale al club"}</span>
          </div>
          <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
            Después de transferir, mandanos la captura del comprobante por WhatsApp para confirmar tu turno.
          </p>
          {whatsappUrl ? (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-3 block w-full rounded-xl bg-emerald-600 py-3 text-center font-medium text-white hover:bg-emerald-700"
            >
              Enviar comprobante por WhatsApp
            </a>
          ) : (
            <p className="mt-3 text-sm text-amber-600 dark:text-amber-400">El club todavía no cargó un WhatsApp de contacto.</p>
          )}
        </Card>

        <Link href={`/${orgSlug}/mis-reservas`} className="mt-4 text-sm text-zinc-500 underline dark:text-zinc-400">
          Ver mis turnos
        </Link>
      </div>
    );
  }

  if (booking.status === "cancelada") {
    return (
      <div className="flex flex-col items-center text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-100 text-2xl dark:bg-zinc-800">
          ⏰
        </div>
        <h1 className="mt-4 text-xl font-semibold text-zinc-900 dark:text-zinc-50">El turno se liberó</h1>
        <p className="mt-1 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
          No llegó la confirmación de la seña a tiempo, así que el horario volvió a estar disponible. Si sigue
          libre, podés reservarlo de nuevo.
        </p>
        <Link
          href={`/${orgSlug}/reservar`}
          className="mt-6 w-full rounded-xl bg-zinc-900 py-3 font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          Volver a reservar
        </Link>
      </div>
    );
  }

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
        href={`/${orgSlug}/mis-reservas`}
        className="mt-6 w-full rounded-xl bg-zinc-900 py-3 font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
      >
        Ver mis turnos
      </Link>
    </div>
  );
}
