"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addExpenseAction } from "@/lib/actions";
import { EXPENSE_CATEGORY_LABELS } from "@/lib/format";
import { todayISO } from "@/lib/time";
import type { ExpenseCategory } from "@/lib/types";

const CATEGORIES = Object.keys(EXPENSE_CATEGORY_LABELS) as ExpenseCategory[];

export function AddExpenseForm() {
  const router = useRouter();
  const [category, setCategory] = useState<ExpenseCategory>("mantenimiento");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState(todayISO());
  const [pending, startTransition] = useTransition();

  function handleSubmit() {
    if (!description || amount <= 0) return;
    startTransition(async () => {
      await addExpenseAction({ category, description, amount, date });
      setDescription("");
      setAmount(0);
      router.refresh();
    });
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="font-medium text-zinc-900 dark:text-zinc-50">Nuevo gasto</p>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="text-sm text-zinc-600 dark:text-zinc-400">
          Categoría
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
            className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {EXPENSE_CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-zinc-600 dark:text-zinc-400">
          Fecha
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>
        <label className="text-sm text-zinc-600 dark:text-zinc-400 sm:col-span-2">
          Descripción
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ej: Compra de pelotas de pádel"
            className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>
        <label className="text-sm text-zinc-600 dark:text-zinc-400">
          Monto
          <input
            type="number"
            min={0}
            value={amount || ""}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>
      </div>
      <button
        onClick={handleSubmit}
        disabled={pending || !description || amount <= 0}
        className="mt-3 w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60 sm:w-auto sm:px-6"
      >
        {pending ? "Guardando..." : "Registrar gasto"}
      </button>
    </div>
  );
}
