"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { redeemRewardAction } from "@/lib/actions";

export function RedeemButton({ organizationId, rewardId, canAfford }: { organizationId: string; rewardId: string; canAfford: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <button
        onClick={() =>
          startTransition(async () => {
            setError(null);
            try {
              await redeemRewardAction(organizationId, rewardId);
              router.refresh();
            } catch (e) {
              setError(e instanceof Error ? e.message : "No se pudo canjear");
            }
          })
        }
        disabled={pending || !canAfford}
        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {pending ? "Canjeando..." : canAfford ? "Canjear" : "Te faltan puntos"}
      </button>
      {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
