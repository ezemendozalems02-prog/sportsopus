import Link from "next/link";
import { getOrganization } from "@/lib/db";

export default function Home() {
  const org = getOrganization();

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 px-6 py-16 dark:bg-black">
      <div className="w-full max-w-md text-center">
        <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">{org.name}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          SportControl
        </h1>
        <p className="mt-2 text-zinc-500 dark:text-zinc-400">
          Reservas, caja y métricas para tu complejo, en un solo lugar.
        </p>

        <div className="mt-10 flex flex-col gap-4">
          <Link
            href="/reservar"
            className="rounded-2xl border border-zinc-200 bg-white p-6 text-left transition hover:border-emerald-400 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
          >
            <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Soy cliente</p>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Reservar cancha, ver mis turnos y torneos
            </p>
          </Link>
          <Link
            href="/admin"
            className="rounded-2xl border border-zinc-200 bg-white p-6 text-left transition hover:border-emerald-400 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
          >
            <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Panel del negocio</p>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Agenda, cobros, canchas, clientes y métricas
            </p>
          </Link>
        </div>

        <Link href="/planes" className="mt-8 inline-block text-sm font-medium text-emerald-600 dark:text-emerald-400">
          ¿Tenés tu propio complejo? Ver planes →
        </Link>
      </div>
    </div>
  );
}
