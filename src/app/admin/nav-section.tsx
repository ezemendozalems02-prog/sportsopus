"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ICON, LockIcon } from "@/lib/icons";

export function NavSection({
  title,
  items,
  locked,
}: {
  title?: string;
  items: { href: string; label: string }[];
  locked?: boolean;
}) {
  const pathname = usePathname();

  return (
    <>
      {title && (
        <p className="mt-4 flex items-center gap-1.5 px-3 text-xs font-medium uppercase tracking-wide text-zinc-400">
          {title}
          {locked && <LockIcon className="h-3 w-3" aria-label="Requiere mejorar tu plan" />}
        </p>
      )}
      <nav className={`flex flex-col gap-0.5 ${title ? "mt-1" : "mt-6"}`}>
        {items.map((item) => {
          const Icon = NAV_ICON[item.href];
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                active
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                  : locked
                    ? "text-zinc-400 hover:bg-zinc-100 dark:text-zinc-500 dark:hover:bg-zinc-800"
                    : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
              }`}
            >
              {Icon && <Icon className="h-4 w-4 shrink-0" />}
              {item.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
