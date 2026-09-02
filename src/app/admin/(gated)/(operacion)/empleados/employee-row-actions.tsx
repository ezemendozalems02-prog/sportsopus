"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setEmployeeActiveAction, updateEmployeeRoleAction } from "@/lib/actions";
import { EMPLOYEE_ROLE_LABELS } from "@/lib/format";
import type { Employee, EmployeeRole } from "@/lib/types";

const ROLES = Object.keys(EMPLOYEE_ROLE_LABELS) as EmployeeRole[];

export function EmployeeRowActions({ employee }: { employee: Employee }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const isOwner = employee.role === "owner";

  function handleRoleChange(role: EmployeeRole) {
    startTransition(async () => {
      await updateEmployeeRoleAction(employee.id, role);
      router.refresh();
    });
  }

  function toggleActive() {
    startTransition(async () => {
      await setEmployeeActiveAction(employee.id, !employee.active);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={employee.role}
        disabled={pending || isOwner}
        onChange={(e) => handleRoleChange(e.target.value as EmployeeRole)}
        className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950"
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {EMPLOYEE_ROLE_LABELS[r]}
          </option>
        ))}
      </select>
      {!isOwner && (
        <button
          onClick={toggleActive}
          disabled={pending}
          className="rounded-lg px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-60 dark:text-red-400 dark:hover:bg-red-900/20"
        >
          {employee.active ? "Desactivar" : "Reactivar"}
        </button>
      )}
    </div>
  );
}
