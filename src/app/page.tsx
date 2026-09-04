import Link from "next/link";
import { getOrganizationBySlug } from "@/lib/db";

export default async function Home() {
  const demoOrg = await getOrganizationBySlug("sport-club-palermo");

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 px-6 py-16 dark:bg-black">
      <div className="w-full max-w-md text-center">
        <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Reservas, caja y métricas</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          SportControl
        </h1>
        <p className="mt-2 text-zinc-500 dark:text-zinc-400">
          El sistema para gestionar tu complejo de pádel o fútbol, de punta a punta.
        </p>

        <div className="mt-10 flex flex-col gap-4">
          <Link
            href="/registro"
            className="rounded-2xl border border-emerald-400 bg-emerald-600 p-6 text-left text-white transition hover:bg-emerald-700"
          >
            <p className="text-lg font-semibold">Crear mi cuenta</p>
            <p className="mt-1 text-sm text-emerald-50">Elegí tu plan y arrancá hoy</p>
          </Link>
          <Link
            href="/login"
            className="rounded-2xl border border-zinc-200 bg-white p-6 text-left transition hover:border-emerald-400 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
          >
            <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Ya tengo una cuenta</p>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Iniciar sesión en mi panel</p>
          </Link>
          {demoOrg && (
            <Link
              href={`/${demoOrg.slug}/reservar`}
              className="rounded-2xl border border-zinc-200 bg-white p-6 text-left transition hover:border-emerald-400 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
            >
              <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Ver demo en vivo</p>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Reservar una cancha en {demoOrg.name}, como lo vería tu cliente
              </p>
            </Link>
          )}
        </div>

        <Link href="/planes" className="mt-8 inline-block text-sm font-medium text-emerald-600 dark:text-emerald-400">
          Ver planes →
        </Link>
      </div>
    </div>
  );
}
