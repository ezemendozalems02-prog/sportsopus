import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getCourt, getCustomer, getOrganizationBySlug, listPromotions } from "@/lib/db";
import { getCustomerSession } from "@/lib/session";
import { applyPromotion, computeDeposit, findApplicablePromotion, resolveSlotPrice } from "@/lib/pricing";
import { formatCurrency } from "@/lib/format";
import { formatDateLong } from "@/lib/time";
import { Card } from "@/components/ui";
import { PayButton } from "./pay-button";

export default async function ConfirmarPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ courtId?: string; date?: string; startTime?: string }>;
}) {
  const { orgSlug } = await params;
  const org = await getOrganizationBySlug(orgSlug);
  if (!org) notFound();

  const { courtId, date, startTime } = await searchParams;
  if (!courtId || !date || !startTime) redirect(`/${orgSlug}/reservar`);

  const court = await getCourt(org.id, courtId);
  if (!court) redirect(`/${orgSlug}/reservar`);

  const basePrice = resolveSlotPrice(court, date, startTime);
  const promotions = await listPromotions(org.id);
  const promotion = findApplicablePromotion(promotions, court, date, startTime);
  const { finalPrice: totalPrice, discountLabel } = applyPromotion(basePrice, promotion);
  const { depositAmount, balanceAmount } = computeDeposit(totalPrice, org);
  const existingSession = await getCustomerSession(org.id);
  const existingCustomer = existingSession ? await getCustomer(org.id, existingSession.customerId) : undefined;

  return (
    <div>
      <Link href={`/${orgSlug}/reservar?courtId=${courtId}&sport=${court.sport}&date=${date}`} className="text-sm text-zinc-500 dark:text-zinc-400">
        ← Volver
      </Link>
      <h1 className="mt-2 text-xl font-semibold text-zinc-900 dark:text-zinc-50">Confirmar reserva</h1>

      <Card className="mt-6">
        <p className="font-medium text-zinc-900 dark:text-zinc-50">{court.name}</p>
        <p className="mt-1 text-sm capitalize text-zinc-500 dark:text-zinc-400">{formatDateLong(date)}</p>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{startTime} hs · {court.slotMinutes} min</p>

        {discountLabel && (
          <p className="mt-3 inline-block rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
            🎉 {discountLabel}
          </p>
        )}

        <div className="mt-5 space-y-2 border-t border-zinc-100 pt-4 text-sm dark:border-zinc-800">
          <div className="flex justify-between">
            <span className="text-zinc-500 dark:text-zinc-400">Total</span>
            <span className="font-medium text-zinc-900 dark:text-zinc-50">
              {discountLabel && <span className="mr-2 text-zinc-400 line-through">{formatCurrency(basePrice)}</span>}
              {formatCurrency(totalPrice)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500 dark:text-zinc-400">
              Seña ({Math.round(org.depositPercentage * 100)}%)
            </span>
            <span className="font-medium text-emerald-600 dark:text-emerald-400">{formatCurrency(depositAmount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500 dark:text-zinc-400">Saldo a pagar en el club</span>
            <span className="font-medium text-zinc-900 dark:text-zinc-50">{formatCurrency(balanceAmount)}</span>
          </div>
        </div>
      </Card>

      <p className="mt-4 text-xs text-zinc-400">
        Al reservar te vamos a mostrar el alias para transferir la seña — el turno queda reservado por 15 minutos mientras se confirma el pago.
      </p>

      <PayButton
        organizationId={org.id}
        orgSlug={orgSlug}
        courtId={courtId}
        date={date}
        startTime={startTime}
        initialContact={
          existingCustomer
            ? { name: existingCustomer.name, email: existingCustomer.email, phone: existingCustomer.phone }
            : undefined
        }
      />
    </div>
  );
}
