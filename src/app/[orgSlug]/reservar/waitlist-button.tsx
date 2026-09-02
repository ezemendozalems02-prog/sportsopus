"use client";

import { useState, useTransition } from "react";
import { joinWaitlistAction } from "@/lib/actions";

export function WaitlistButton({
  organizationId,
  courtId,
  date,
  startTime,
}: {
  organizationId: string;
  courtId: string;
  date: string;
  startTime: string;
}) {
  const [open, setOpen] = useState(false);
  const [joined, setJoined] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pending, startTransition] = useTransition();

  if (joined) {
    return <p className="mt-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">Te avisamos ✓</p>;
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-1 text-[11px] font-medium text-zinc-500 underline dark:text-zinc-400"
      >
        Avisarme si se libera
      </button>
    );
  }

  return (
    <div className="mt-1.5 flex flex-col gap-1">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nombre"
        className="rounded border border-zinc-200 bg-white px-1.5 py-1 text-[10px] dark:border-zinc-700 dark:bg-zinc-950"
      />
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        className="rounded border border-zinc-200 bg-white px-1.5 py-1 text-[10px] dark:border-zinc-700 dark:bg-zinc-950"
      />
      <button
        disabled={pending || !name || !email}
        onClick={() =>
          startTransition(async () => {
            await joinWaitlistAction(organizationId, courtId, date, startTime, { name, email, phone: "" });
            setJoined(true);
          })
        }
        className="rounded bg-zinc-900 py-1 text-[10px] font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {pending ? "..." : "Confirmar"}
      </button>
    </div>
  );
}
