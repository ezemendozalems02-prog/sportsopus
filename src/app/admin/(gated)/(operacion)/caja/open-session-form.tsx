"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { openCashSessionAction } from "@/lib/actions";

export function OpenSessionForm() {
  const router = useRouter();
  const [amount, setAmount] = useState(20000);
  const [pending, startTransition] = useTransition();

  function handleOpen() {
    startTransition(async () => {
      await openCashSessionAction(amount);
      router.refresh();
    });
  }

  return (
    <div className="mx-auto max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 text-center dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-3xl">🔒</p>
      <h2 className="mt-2 font-medium text-zinc-900 dark:text-zinc-50">La caja está cerrada</h2>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Abrila para empezar a vender y cobrar saldos en efectivo.
      </p>

      <label className="mt-4 block text-left text-sm text-zinc-600 dark:text-zinc-400">
        Monto inicial
        <input
          type="number"
          min={0}
          step={500}
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
          className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
        />
      </label>

      <button
        onClick={handleOpen}
        disabled={pending}
        className="mt-4 w-full rounded-xl bg-emerald-600 py-2.5 font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
      >
        {pending ? "Abriendo..." : "Abrir caja"}
      </button>
    </div>
  );
}
