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
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<EmployeeRole>("cajero");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit() {
    if (!name || !email || password.length < 6) return;
    setError(null);
    startTransition(async () => {
      try {
        await addEmployeeAction({ name, email, role, password });
        setName("");
        setEmail("");
        setPassword("");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo agregar el empleado");
      }
    });
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="font-medium text-zinc-900 dark:text-zinc-50">Agregar empleado</p>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-4">
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
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Contraseña (mín. 6)"
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
      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
      <button
        onClick={handleSubmit}
        disabled={pending || !name || !email || password.length < 6}
        className="mt-3 w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60 sm:w-auto sm:px-6"
      >
        {pending ? "Guardando..." : "Agregar"}
      </button>
    </div>
  );
}
