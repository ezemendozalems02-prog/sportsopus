"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPromotionAction } from "@/lib/actions";
import { SPORT_LABELS } from "@/lib/format";
import type { Sport } from "@/lib/types";

const DAYS = [
  { value: 1, label: "Lun" },
  { value: 2, label: "Mar" },
  { value: 3, label: "Mié" },
  { value: 4, label: "Jue" },
  { value: 5, label: "Vie" },
  { value: 6, label: "Sáb" },
  { value: 0, label: "Dom" },
];

const SPORTS = Object.keys(SPORT_LABELS) as Sport[];

export function AddPromotionForm({
  initialLabel = "",
  initialDays = [1, 2, 3, 4],
  initialStartTime = "14:00",
  initialEndTime = "17:00",
  initialSports = [],
}: {
  initialLabel?: string;
  initialDays?: number[];
  initialStartTime?: string;
  initialEndTime?: string;
  initialSports?: Sport[];
}) {
  const router = useRouter();
  const [label, setLabel] = useState(initialLabel);
  const [discount, setDiscount] = useState(20);
  const [days, setDays] = useState<number[]>(initialDays);
  const [startTime, setStartTime] = useState(initialStartTime);
  const [endTime, setEndTime] = useState(initialEndTime);
  const [sports, setSports] = useState<Sport[]>(initialSports);
  const [pending, startTransition] = useTransition();

  function toggleDay(day: number) {
    setDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  }

  function toggleSport(sport: Sport) {
    setSports((prev) => (prev.includes(sport) ? prev.filter((s) => s !== sport) : [...prev, sport]));
  }

  function handleSubmit() {
    if (!label || days.length === 0) return;
    startTransition(async () => {
      await createPromotionAction({
        label,
        discountPercentage: discount / 100,
        daysOfWeek: days,
        startTime,
        endTime,
        sports: sports.length > 0 ? sports : undefined,
      });
      setLabel("");
      router.refresh();
    });
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="font-medium text-zinc-900 dark:text-zinc-50">Nueva promoción</p>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Ej: Happy Hour"
          className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
        <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
          Descuento
          <input
            type="number"
            min={1}
            max={90}
            value={discount}
            onChange={(e) => setDiscount(Number(e.target.value))}
            className="w-20 rounded-lg border border-zinc-200 bg-white px-2 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
          %
        </label>
        <label className="text-sm text-zinc-600 dark:text-zinc-400">
          Desde
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>
        <label className="text-sm text-zinc-600 dark:text-zinc-400">
          Hasta
          <input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>
      </div>

      <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">Días</p>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {DAYS.map((d) => (
          <button
            key={d.value}
            onClick={() => toggleDay(d.value)}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
              days.includes(d.value)
                ? "bg-emerald-600 text-white"
                : "border border-zinc-200 text-zinc-500 dark:border-zinc-700 dark:text-zinc-400"
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>

      <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">Deportes (vacío = todos)</p>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {SPORTS.map((sport) => (
          <button
            key={sport}
            onClick={() => toggleSport(sport)}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
              sports.includes(sport)
                ? "bg-emerald-600 text-white"
                : "border border-zinc-200 text-zinc-500 dark:border-zinc-700 dark:text-zinc-400"
            }`}
          >
            {SPORT_LABELS[sport]}
          </button>
        ))}
      </div>

      <button
        onClick={handleSubmit}
        disabled={pending || !label || days.length === 0}
        className="mt-4 w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60 sm:w-auto sm:px-6"
      >
        {pending ? "Guardando..." : "Crear promoción"}
      </button>
    </div>
  );
}
