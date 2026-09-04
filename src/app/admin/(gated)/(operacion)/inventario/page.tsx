import { listLowStockProducts, listProductCategories, listProducts } from "@/lib/db";
import { requireEmployeeSession } from "@/lib/session";
import { formatCurrency } from "@/lib/format";
import { RestockButton } from "./restock-button";

export default async function InventarioPage() {
  const { organizationId } = await requireEmployeeSession("/admin/inventario");
  const categories = await listProductCategories(organizationId);
  const products = await listProducts(organizationId);
  const lowStock = await listLowStockProducts(organizationId);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Inventario</h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{products.length} productos</p>

      {lowStock.length > 0 && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
          🔔 Tenés {lowStock.length} producto{lowStock.length > 1 ? "s" : ""} con stock bajo:{" "}
          {lowStock.map((p) => p.name).join(", ")}
        </div>
      )}

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[820px] border-separate border-spacing-y-2 text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-zinc-400">
              <th className="px-3">Producto</th>
              <th className="px-3">Categoría</th>
              <th className="px-3">Stock</th>
              <th className="px-3">Costo</th>
              <th className="px-3">Precio</th>
              <th className="px-3">Margen</th>
              <th className="px-3"></th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => {
              const category = categories.find((c) => c.id === product.categoryId);
              const margin = product.price - product.cost;
              const low = product.stock <= product.minStock;
              return (
                <tr key={product.id}>
                  <td className="rounded-l-xl bg-white px-3 py-3 dark:bg-zinc-900">
                    <p className="font-medium text-zinc-900 dark:text-zinc-50">{product.name}</p>
                    <p className="text-xs text-zinc-400">{product.sku}</p>
                  </td>
                  <td className="bg-white px-3 py-3 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">{category?.name}</td>
                  <td className="bg-white px-3 py-3 dark:bg-zinc-900">
                    <span
                      className={
                        low
                          ? "rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                          : "text-zinc-700 dark:text-zinc-300"
                      }
                    >
                      {product.stock}
                    </span>
                    <span className="ml-1 text-xs text-zinc-400">/ mín {product.minStock}</span>
                  </td>
                  <td className="bg-white px-3 py-3 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">{formatCurrency(product.cost)}</td>
                  <td className="bg-white px-3 py-3 font-medium text-zinc-900 dark:bg-zinc-900 dark:text-zinc-50">
                    {formatCurrency(product.price)}
                  </td>
                  <td className="bg-white px-3 py-3 text-emerald-600 dark:bg-zinc-900 dark:text-emerald-400">
                    {formatCurrency(margin)}
                  </td>
                  <td className="rounded-r-xl bg-white px-3 py-3 dark:bg-zinc-900">
                    <RestockButton productId={product.id} productName={product.name} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
