"use client";

import { useState, useTransition } from "react";
import { collectBalanceAction, setBookingStatusAction } from "@/lib/actions";
import type { BookingStatus, PaymentMethod } from "@/lib/types";
import { formatCurrency } from "@/lib/format";

const NEXT_STATUS: Partial<Record<BookingStatus, { status: BookingStatus; label: string }>> = {
  confirmada: { status: "en_curso", label: "Iniciar turno" },
  en_curso: { status: "finalizada", label: "Finalizar" },
};

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "efectivo", label: "Efectivo" },
  { value: "mercado_pago", label: "Mercado Pago" },
  { value: "transferencia", label: "Transferencia" },
  { value: "tarjeta", label: "Tarjeta" },
];

export function BookingActions({
  bookingId,
  status,
  balanceAmount,
}: {
  bookingId: string;
  status: BookingStatus;
  balanceAmount: number;
}) {
  const [pending, startTransition] = useTransition();
  const [method, setMethod] = useState<PaymentMethod>("efectivo");

  const canCollectBalance = status === "sena_pagada" && balanceAmount > 0;
  const nextStep = NEXT_STATUS[status];
  const canCancel = status === "pendiente_pago" || status === "sena_pagada" || status === "confirmada";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canCollectBalance && (
        <>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as PaymentMethod)}
            className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
          >
            {METHODS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          <button
            disabled={pending}
            onClick={() => startTransition(() => collectBalanceAction(bookingId, method))}
            className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            Cobrar saldo {formatCurrency(balanceAmount)}
          </button>
        </>
      )}

      {nextStep && (
        <button
          disabled={pending}
          onClick={() => startTransition(() => setBookingStatusAction(bookingId, nextStep.status))}
          className="rounded-lg border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          {nextStep.label}
        </button>
      )}

      {canCancel && (
        <button
          disabled={pending}
          onClick={() => startTransition(() => setBookingStatusAction(bookingId, "cancelada"))}
          className="rounded-lg px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-60 dark:text-red-400 dark:hover:bg-red-900/20"
        >
          Cancelar
        </button>
      )}

      {status === "confirmada" && (
        <button
          disabled={pending}
          onClick={() => startTransition(() => setBookingStatusAction(bookingId, "no_show"))}
          className="rounded-lg px-3 py-1 text-xs font-medium text-zinc-500 hover:bg-zinc-100 disabled:opacity-60 dark:hover:bg-zinc-800"
        >
          No show
        </button>
      )}
    </div>
  );
}
