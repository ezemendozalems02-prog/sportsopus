"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updatePaymentSettingsAction } from "@/lib/actions";
import { Card } from "@/components/ui";

export function PaymentSettingsForm({
  paymentAlias,
  whatsappNumber,
}: {
  paymentAlias: string;
  whatsappNumber: string;
}) {
  const router = useRouter();
  const [alias, setAlias] = useState(paymentAlias);
  const [whatsapp, setWhatsapp] = useState(whatsappNumber);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function handleSave() {
    setSaved(false);
    startTransition(async () => {
      await updatePaymentSettingsAction({ paymentAlias: alias, whatsappNumber: whatsapp });
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <Card>
      <p className="font-medium text-zinc-900 dark:text-zinc-50">Cobro de señas por transferencia</p>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        El cliente ve estos datos al reservar: transfiere la seña a tu alias y te manda el comprobante por WhatsApp.
        Si no confirmás el pago en 15 minutos, el turno se libera solo.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block text-sm text-zinc-600 dark:text-zinc-400">
          Alias / CBU para transferencias
          <input
            type="text"
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
            placeholder="miclub.mp"
            className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>
        <label className="block text-sm text-zinc-600 dark:text-zinc-400">
          WhatsApp para recibir comprobantes
          <input
            type="tel"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            placeholder="5491122334455"
            className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>
      </div>
      <p className="mt-1.5 text-xs text-zinc-400">WhatsApp con código de país, sin espacios ni signos (ej. 5491122334455).</p>

      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={pending}
          className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {pending ? "Guardando..." : "Guardar"}
        </button>
        {saved && !pending && <span className="text-sm text-emerald-600 dark:text-emerald-400">Guardado.</span>}
      </div>
    </Card>
  );
}
