import { listEmployees } from "@/lib/db";
import { requireEmployeeSession } from "@/lib/session";
import { EMPLOYEE_ROLE_LABELS } from "@/lib/format";
import { Card } from "@/components/ui";
import { AddEmployeeForm } from "./add-employee-form";
import { EmployeeRowActions } from "./employee-row-actions";

export default async function EmpleadosPage() {
  const { organizationId } = await requireEmployeeSession();
  const employees = listEmployees(organizationId);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Empleados</h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{employees.length} personas con acceso</p>

      <div className="mt-6">
        <AddEmployeeForm />
      </div>

      <div className="mt-6 flex flex-col gap-2">
        {employees.map((employee) => (
          <Card key={employee.id} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 text-sm font-medium text-white">
                {employee.name.charAt(0)}
              </div>
              <div>
                <p className={`font-medium ${employee.active ? "text-zinc-900 dark:text-zinc-50" : "text-zinc-400 line-through"}`}>
                  {employee.name}
                </p>
                <p className="text-xs text-zinc-400">
                  {employee.email} · {EMPLOYEE_ROLE_LABELS[employee.role]}
                </p>
              </div>
            </div>
            <EmployeeRowActions employee={employee} />
          </Card>
        ))}
      </div>

      <p className="mt-6 text-xs text-zinc-400">
        Los permisos por rol (qué puede ver cada uno) todavía no están aplicados en la UI — hoy es solo un directorio.
        Eso llega junto con Supabase Auth.
      </p>
    </div>
  );
}
