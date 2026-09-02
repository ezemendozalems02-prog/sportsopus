"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setPromotionActiveAction } from "@/lib/actions";

export function TogglePromotionButton({ promotionId, active }: { promotionId: string; active: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      onClick={() =>
        startTransition(async () => {
          await setPromotionActiveAction(promotionId, !active);
          router.refresh();
        })
      }
      disabled={pending}
      className={`rounded-lg px-2.5 py-1 text-xs font-medium disabled:opacity-60 ${
        active
          ? "text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
          : "text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-900/20"
      }`}
    >
      {active ? "Desactivar" : "Activar"}
    </button>
  );
}
