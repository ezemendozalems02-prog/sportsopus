import Link from "next/link";
import { LayoutDashboard, LogOut, Building2 } from "lucide-react";
import { requireSuperadminSession } from "@/lib/session";
import { superadminLogoutAction } from "@/lib/actions";

const NAV = [
  { href: "/superadmin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/superadmin/organizaciones", label: "Organizaciones", icon: Building2 },
];

export default async function SuperadminGatedLayout({ children }: { children: React.ReactNode }) {
  await requireSuperadminSession();

  return (
    <div className="flex flex-1 bg-zinc-950 text-zinc-50">
      <aside className="hidden w-56 shrink-0 flex-col border-r border-zinc-800 bg-zinc-900 p-4 md:flex">
        <p className="px-2 text-lg font-semibold">SportControl</p>
        <p className="px-2 text-xs text-zinc-500">Panel de plataforma</p>

        <nav className="mt-6 flex flex-col gap-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800"
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>

        <form action={superadminLogoutAction} className="mt-auto">
          <button
            type="submit"
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-zinc-400 hover:bg-zinc-800"
          >
            <LogOut className="h-4 w-4" /> Cerrar sesión
          </button>
        </form>
      </aside>

      <div className="flex-1 overflow-x-hidden">
        <header className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900 px-4 py-3 md:hidden">
          <p className="font-semibold">SportControl · Plataforma</p>
          <nav className="flex gap-3 text-sm text-zinc-300">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href}>
                {item.label}
              </Link>
            ))}
          </nav>
        </header>
        <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
