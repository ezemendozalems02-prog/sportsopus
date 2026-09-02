"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSaleAction } from "@/lib/actions";
import { formatCurrency } from "@/lib/format";
import type { PaymentMethod, Product, ProductCategory } from "@/lib/types";

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "efectivo", label: "Efectivo" },
  { value: "mercado_pago", label: "Mercado Pago" },
  { value: "transferencia", label: "Transferencia" },
  { value: "tarjeta", label: "Tarjeta" },
];

export function PosPanel({ products, categories }: { products: Product[]; categories: ProductCategory[] }) {
  const router = useRouter();
  const [cart, setCart] = useState<Record<string, number>>({});
  const [method, setMethod] = useState<PaymentMethod>("efectivo");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const cartItems = useMemo(
    () =>
      Object.entries(cart)
        .filter(([, qty]) => qty > 0)
        .map(([productId, quantity]) => ({
          product: products.find((p) => p.id === productId)!,
          quantity,
        })),
    [cart, products]
  );
  const total = cartItems.reduce((sum, it) => sum + it.product.price * it.quantity, 0);

  function addToCart(productId: string) {
    setCart((prev) => ({ ...prev, [productId]: (prev[productId] ?? 0) + 1 }));
  }

  function changeQty(productId: string, delta: number) {
    setCart((prev) => {
      const next = Math.max(0, (prev[productId] ?? 0) + delta);
      return { ...prev, [productId]: next };
    });
  }

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      try {
        await createSaleAction({
          items: cartItems.map((it) => ({ productId: it.product.id, quantity: it.quantity })),
          method,
        });
        setCart({});
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo registrar la venta");
      }
    });
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2">
        {categories.map((category) => {
          const items = products.filter((p) => p.categoryId === category.id && p.active);
          if (items.length === 0) return null;
          return (
            <div key={category.id} className="mb-5">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-400">{category.name}</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {items.map((product) => (
                  <button
                    key={product.id}
                    onClick={() => addToCart(product.id)}
                    disabled={product.stock <= 0}
                    className="rounded-xl border border-zinc-200 bg-white p-3 text-left transition hover:border-emerald-400 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-800 dark:bg-zinc-900"
                  >
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{product.name}</p>
                    <p className="mt-1 text-sm text-emerald-600 dark:text-emerald-400">{formatCurrency(product.price)}</p>
                    <p className="mt-0.5 text-xs text-zinc-400">Stock: {product.stock}</p>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="font-medium text-zinc-900 dark:text-zinc-50">Nueva venta</p>
        <div className="mt-3 flex flex-col gap-2">
          {cartItems.length === 0 && <p className="text-sm text-zinc-400">Tocá un producto para agregarlo.</p>}
          {cartItems.map(({ product, quantity }) => (
            <div key={product.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="flex-1 text-zinc-700 dark:text-zinc-300">{product.name}</span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => changeQty(product.id, -1)}
                  className="h-6 w-6 rounded-full border border-zinc-300 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300"
                >
                  −
                </button>
                <span className="w-4 text-center">{quantity}</span>
                <button
                  onClick={() => changeQty(product.id, 1)}
                  className="h-6 w-6 rounded-full border border-zinc-300 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300"
                >
                  +
                </button>
              </div>
              <span className="w-20 text-right font-medium text-zinc-900 dark:text-zinc-50">
                {formatCurrency(product.price * quantity)}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-zinc-100 pt-3 text-sm font-semibold dark:border-zinc-800">
          <span className="text-zinc-500 dark:text-zinc-400">Total</span>
          <span className="text-zinc-900 dark:text-zinc-50">{formatCurrency(total)}</span>
        </div>

        <select
          value={method}
          onChange={(e) => setMethod(e.target.value as PaymentMethod)}
          className="mt-3 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        >
          {METHODS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>

        {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}

        <button
          onClick={handleConfirm}
          disabled={pending || cartItems.length === 0}
          className="mt-3 w-full rounded-xl bg-emerald-600 py-2.5 font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {pending ? "Confirmando..." : "Confirmar venta"}
        </button>
      </div>
    </div>
  );
}
