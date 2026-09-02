import { getCurrentCustomer, listLoyaltyRedemptions, listLoyaltyRewards } from "@/lib/db";
import { Card } from "@/components/ui";
import { RedeemButton } from "./redeem-button";

export default function BeneficiosPage() {
  const customer = getCurrentCustomer();
  const rewards = listLoyaltyRewards();
  const redemptions = listLoyaltyRedemptions(customer.id);

  return (
    <div>
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Sport Points</h1>

      <Card className="mt-6 text-center">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Tus puntos</p>
        <p className="mt-1 text-3xl font-semibold text-emerald-600 dark:text-emerald-400">{customer.loyaltyPoints}</p>
        <p className="mt-1 text-xs text-zinc-400">Sumás 10 puntos por cada $1.000 que gastás en canchas.</p>
      </Card>

      <div className="mt-6 flex flex-col gap-2">
        {rewards.map((reward) => (
          <Card key={reward.id} className="flex items-center justify-between">
            <div>
              <p className="font-medium text-zinc-900 dark:text-zinc-50">{reward.label}</p>
              <p className="text-xs text-zinc-400">{reward.pointsCost} puntos</p>
            </div>
            <RedeemButton rewardId={reward.id} canAfford={customer.loyaltyPoints >= reward.pointsCost} />
          </Card>
        ))}
      </div>

      {redemptions.length > 0 && (
        <div className="mt-6">
          <p className="mb-2 text-sm font-medium text-zinc-900 dark:text-zinc-50">Canjes anteriores</p>
          <div className="flex flex-col gap-1.5">
            {redemptions.map((r) => (
              <div key={r.id} className="flex justify-between rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900">
                <span className="text-zinc-700 dark:text-zinc-300">{r.rewardLabel}</span>
                <span className="text-zinc-400">−{r.pointsSpent} pts</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
