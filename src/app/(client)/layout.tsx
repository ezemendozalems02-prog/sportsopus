import Link from "next/link";
import { getCurrentCustomer } from "@/lib/db";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const customer = getCurrentCustomer();

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <header className="border-b border-zinc-200 bg-white px-4 py-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex w-full max-w-md items-center justify-between">
          <Link href="/" className="font-semibold text-zinc-900 dark:text-zinc-50">
            SportControl
          </Link>
          <span className="text-sm text-zinc-500 dark:text-zinc-400">Hola, {customer.name.split(" ")[0]} 👋</span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 px-4 py-6">{children}</main>

      <nav className="sticky bottom-0 border-t border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex w-full max-w-md">
          <Link href="/reservar" className="flex-1 py-3 text-center text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Reservar
          </Link>
          <Link href="/mis-reservas" className="flex-1 py-3 text-center text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Mis turnos
          </Link>
          <Link href="/torneos" className="flex-1 py-3 text-center text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Torneos
          </Link>
          <Link href="/beneficios" className="flex-1 py-3 text-center text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Beneficios
          </Link>
        </div>
      </nav>
    </div>
  );
}
