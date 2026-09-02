"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addEmployeeAction } from "@/lib/actions";
import { EMPLOYEE_ROLE_LABELS } from "@/lib/format";
import type { EmployeeRole } from "@/lib/types";

const ROLES = Object.keys(EMPLOYEE_ROLE_LABELS) as EmployeeRole[];

export function AddEmployeeForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<EmployeeRole>("cajero");
  const [pending, startTransition] = useTransition();

  function handleSubmit() {
    if (!name || !email) return;
    startTransition(async () => {
      await addEmployeeAction({ name, email, role });
      setName("");
      setEmail("");
      router.refresh();
    });
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="font-medium text-zinc-900 dark:text-zinc-50">Agregar empleado</p>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nombre"
          className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as EmployeeRole)}
          className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {EMPLOYEE_ROLE_LABELS[r]}
            </option>
          ))}
        </select>
      </div>
      <button
        onClick={handleSubmit}
        disabled={pending || !name || !email}
        className="mt-3 w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60 sm:w-auto sm:px-6"
      >
        {pending ? "Guardando..." : "Agregar"}
      </button>
    </div>
  );
}
