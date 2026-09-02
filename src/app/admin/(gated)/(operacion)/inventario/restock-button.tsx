"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { adjustStockAction } from "@/lib/actions";

export function RestockButton({ productId, productName }: { productId: string; productName: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleRestock() {
    startTransition(async () => {
      await adjustStockAction(productId, 20, `Reposición manual — ${productName}`);
      router.refresh();
    });
  }

  return (
    <button
      onClick={handleRestock}
      disabled={pending}
      className="rounded-lg border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
    >
      {pending ? "..." : "+20 stock"}
    </button>
  );
}
