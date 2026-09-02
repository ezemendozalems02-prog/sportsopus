import type { Booking, Court, TimeSlot } from "./types";
import { resolveSlotPrice } from "./pricing";
import { dayOfWeek, minutesToTime, timeToMinutes } from "./time";

export const BLOCKING_STATUSES = new Set(["pendiente_pago", "sena_pagada", "confirmada", "en_curso"]);

export function generateSlots(court: Court, dateISO: string, bookings: Booking[]): TimeSlot[] {
  if (!court.daysOpen.includes(dayOfWeek(dateISO))) return [];

  const slots: TimeSlot[] = [];
  const open = timeToMinutes(court.openTime);
  const close = timeToMinutes(court.closeTime);

  const dayBookings = bookings.filter(
    (b) => b.courtId === court.id && b.date === dateISO && BLOCKING_STATUSES.has(b.status)
  );

  for (let start = open; start + court.slotMinutes <= close; start += court.slotMinutes) {
    const startTime = minutesToTime(start);
    const endTime = minutesToTime(start + court.slotMinutes);
    const occupying = dayBookings.find((b) => b.startTime === startTime);

    const basePrice = resolveSlotPrice(court, dateISO, startTime);
    slots.push({
      startTime,
      endTime,
      price: basePrice,
      basePrice,
      available: !occupying,
      bookingId: occupying?.id,
    });
  }

  return slots;
}
