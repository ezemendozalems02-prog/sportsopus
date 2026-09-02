import type { Court, Organization, Promotion } from "./types";
import { dayOfWeek, timeToMinutes } from "./time";

// Resolves the price of one slot starting at `startTime` on `dateISO`,
// by matching the court's price rules (day of week + time range).
// Falls back to the cheapest rule if nothing matches, so a court is never unbookable.
export function resolveSlotPrice(court: Court, dateISO: string, startTime: string): number {
  const dow = dayOfWeek(dateISO);
  const start = timeToMinutes(startTime);

  const match = court.priceRules.find(
    (rule) =>
      rule.daysOfWeek.includes(dow) &&
      start >= timeToMinutes(rule.startTime) &&
      start < timeToMinutes(rule.endTime)
  );
  if (match) return match.pricePerSlot;

  return court.priceRules.length > 0
    ? Math.min(...court.priceRules.map((r) => r.pricePerSlot))
    : 0;
}

export function computeDeposit(totalPrice: number, organization: Organization) {
  const depositAmount = Math.round(totalPrice * organization.depositPercentage);
  return { depositAmount, balanceAmount: totalPrice - depositAmount };
}

// Finds the deepest discount among active promotions that match this
// court's sport, day and time. Only one promotion applies per slot.
export function findApplicablePromotion(
  promotions: Promotion[],
  court: Court,
  dateISO: string,
  startTime: string
): Promotion | undefined {
  const dow = dayOfWeek(dateISO);
  const start = timeToMinutes(startTime);

  const matching = promotions.filter(
    (promo) =>
      promo.active &&
      promo.daysOfWeek.includes(dow) &&
      start >= timeToMinutes(promo.startTime) &&
      start < timeToMinutes(promo.endTime) &&
      (!promo.sports || promo.sports.length === 0 || promo.sports.includes(court.sport))
  );
  if (matching.length === 0) return undefined;
  return matching.reduce((best, p) => (p.discountPercentage > best.discountPercentage ? p : best));
}

export function applyPromotion(basePrice: number, promotion: Promotion | undefined) {
  if (!promotion) return { finalPrice: basePrice, discountLabel: undefined as string | undefined };
  const finalPrice = Math.round(basePrice * (1 - promotion.discountPercentage));
  return { finalPrice, discountLabel: `${promotion.label} -${Math.round(promotion.discountPercentage * 100)}%` };
}
