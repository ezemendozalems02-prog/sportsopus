"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateProductAction } from "@/lib/actions";
import type { Product, ProductCategory } from "@/lib/types";

export function EditProductButton({ product, categories }: { product: Product; categories: ProductCategory[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(product.name);
  const [categoryId, setCategoryId] = useState(product.categoryId);
  const [cost, setCost] = useState(product.cost);
  const [price, setPrice] = useState(product.price);
  const [minStock, setMinStock] = useState(product.minStock);
  const [active, setActive] = useState(product.active);
  const [pending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      await updateProductAction(product.id, { name, categoryId, cost, price, minStock, active });
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        Editar
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={() => setOpen(false)}>
      <div
        className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="font-medium text-zinc-900 dark:text-zinc-50">Editar {product.name}</p>
        <div className="mt-3 flex flex-col gap-3">
          <label className="text-sm text-zinc-600 dark:text-zinc-400">
            Nombre
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
          </label>
          <label className="text-sm text-zinc-600 dark:text-zinc-400">
            Categoría
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm text-zinc-600 dark:text-zinc-400">
              Costo
              <input
                type="number"
                value={cost}
                onChange={(e) => setCost(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              />
            </label>
            <label className="text-sm text-zinc-600 dark:text-zinc-400">
              Precio
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              />
            </label>
          </div>
          <label className="text-sm text-zinc-600 dark:text-zinc-400">
            Stock mínimo
            <input
              type="number"
              value={minStock}
              onChange={(e) => setMinStock(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            Producto activo (visible en punto de venta)
          </label>
        </div>
        <div className="mt-4 flex gap-2">
          <button
            onClick={handleSave}
            disabled={pending || !name}
            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {pending ? "Guardando..." : "Guardar"}
          </button>
          <button
            onClick={() => setOpen(false)}
            className="rounded-xl px-4 py-2 text-sm font-medium text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
