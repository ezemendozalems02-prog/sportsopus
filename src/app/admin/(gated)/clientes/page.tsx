import { getCourt, listBookingsForCustomer, listCustomers } from "@/lib/db";
import { requireEmployeeSession } from "@/lib/session";
import { formatCurrency } from "@/lib/format";

async function customerStats(organizationId: string, customerId: string) {
  const bookings = await listBookingsForCustomer(organizationId, customerId);
  const spent = bookings.reduce(
    (sum, b) => sum + b.payments.reduce((s, p) => s + p.amount, 0),
    0
  );
  const cancellations = bookings.filter((b) => b.status === "cancelada").length;
  const noShows = bookings.filter((b) => b.status === "no_show").length;
  const lastBooking = bookings[0];

  const courtCounts = new Map<string, number>();
  for (const b of bookings) courtCounts.set(b.courtId, (courtCounts.get(b.courtId) ?? 0) + 1);
  const favoriteCourtId = [...courtCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];

  return { total: bookings.length, spent, cancellations, noShows, lastBooking, favoriteCourtId };
}

export default async function ClientesPage() {
  const { organizationId } = await requireEmployeeSession("/admin/clientes");
  const customers = await listCustomers(organizationId);
  const customersWithStats = await Promise.all(
    customers.map(async (customer) => {
      const stats = await customerStats(organizationId, customer.id);
      const favoriteCourt = stats.favoriteCourtId ? await getCourt(organizationId, stats.favoriteCourtId) : undefined;
      return { customer, stats, favoriteCourt };
    })
  );

  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Clientes</h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{customers.length} clientes registrados</p>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[720px] border-separate border-spacing-y-2 text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-zinc-400">
              <th className="px-3">Cliente</th>
              <th className="px-3">Reservas</th>
              <th className="px-3">Gastado</th>
              <th className="px-3">Cancha favorita</th>
              <th className="px-3">Última reserva</th>
              <th className="px-3">Cancelaciones</th>
              <th className="px-3">No show</th>
              <th className="px-3">Puntos</th>
            </tr>
          </thead>
          <tbody>
            {customersWithStats.map(({ customer, stats, favoriteCourt }) => {
              return (
                <tr key={customer.id}>
                  <td className="rounded-l-xl bg-white px-3 py-3 dark:bg-zinc-900">
                    <p className="font-medium text-zinc-900 dark:text-zinc-50">{customer.name}</p>
                    <p className="text-xs text-zinc-400">{customer.email}</p>
                  </td>
                  <td className="bg-white px-3 py-3 dark:bg-zinc-900">{stats.total}</td>
                  <td className="bg-white px-3 py-3 font-medium text-zinc-900 dark:bg-zinc-900 dark:text-zinc-50">
                    {formatCurrency(stats.spent)}
                  </td>
                  <td className="bg-white px-3 py-3 dark:bg-zinc-900">{favoriteCourt?.name ?? "—"}</td>
                  <td className="bg-white px-3 py-3 dark:bg-zinc-900">{stats.lastBooking?.date ?? "—"}</td>
                  <td className="bg-white px-3 py-3 dark:bg-zinc-900">{stats.cancellations}</td>
                  <td className="bg-white px-3 py-3 dark:bg-zinc-900">{stats.noShows}</td>
                  <td className="rounded-r-xl bg-white px-3 py-3 dark:bg-zinc-900">{customer.loyaltyPoints}</td>
                </tr>
              );
            })}
            {customers.length === 0 && (
              <tr>
                <td colSpan={8} className="rounded-xl bg-white px-3 py-6 text-center text-zinc-400 dark:bg-zinc-900">
                  Todavía no tenés clientes — van a aparecer acá apenas alguien reserve.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
