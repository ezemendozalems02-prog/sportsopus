"use client";

import { useState, useTransition } from "react";
import { joinWaitlistAction } from "@/lib/actions";

export function WaitlistButton({ courtId, date, startTime }: { courtId: string; date: string; startTime: string }) {
  const [joined, setJoined] = useState(false);
  const [pending, startTransition] = useTransition();

  if (joined) {
    return <p className="mt-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">Te avisamos ✓</p>;
  }

  return (
    <button
      onClick={() =>
        startTransition(async () => {
          await joinWaitlistAction(courtId, date, startTime);
          setJoined(true);
        })
      }
      disabled={pending}
      className="mt-1 text-[11px] font-medium text-zinc-500 underline disabled:opacity-60 dark:text-zinc-400"
    >
      Avisarme si se libera
    </button>
  );
}
