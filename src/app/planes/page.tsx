import Link from "next/link";
import { listPlans } from "@/lib/db";
import { formatCurrency } from "@/lib/format";

export default function PlanesPage() {
  const plans = listPlans();

  return (
    <div className="flex flex-1 flex-col items-center bg-zinc-50 px-6 py-16 dark:bg-black">
      <div className="w-full max-w-4xl text-center">
        <Link href="/" className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
          ← SportControl
        </Link>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Un plan para cada etapa de tu complejo
        </h1>
        <p className="mt-2 text-zinc-500 dark:text-zinc-400">
          Registrate, elegí tu plan y pagalo con Mercado Pago para arrancar.
        </p>

        <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`flex flex-col rounded-2xl border bg-white p-6 text-left dark:bg-zinc-900 ${
                plan.id === "pro"
                  ? "border-emerald-400 shadow-sm ring-1 ring-emerald-400"
                  : "border-zinc-200 dark:border-zinc-800"
              }`}
            >
              {plan.id === "pro" && (
                <span className="mb-2 w-fit rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                  Más elegido
                </span>
              )}
              <p className="font-medium text-zinc-900 dark:text-zinc-50">{plan.name}</p>
              <p className="mt-1 text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
                {formatCurrency(plan.priceARS)}
                <span className="text-sm font-normal text-zinc-400">/mes</span>
              </p>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{plan.tagline}</p>

              <ul className="mt-5 flex flex-1 flex-col gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                {plan.highlights.map((h) => (
                  <li key={h} className="flex gap-2">
                    <span className="text-emerald-500">✓</span>
                    {h}
                  </li>
                ))}
              </ul>

              <Link
                href={`/registro?plan=${plan.id}`}
                className={`mt-6 rounded-xl py-2.5 text-center text-sm font-medium ${
                  plan.id === "pro"
                    ? "bg-emerald-600 text-white hover:bg-emerald-700"
                    : "border border-zinc-200 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                }`}
              >
                Crear cuenta
              </Link>
            </div>
          ))}
        </div>

        <p className="mt-8 text-xs text-zinc-400">
          Cada cuenta que se registra arranca aislada, con su propio panel y su propio link de reserva. El cobro se
          procesa con Mercado Pago Suscripciones — para acceder al panel hay que elegir y pagar un plan.
        </p>
      </div>
    </div>
  );
}
