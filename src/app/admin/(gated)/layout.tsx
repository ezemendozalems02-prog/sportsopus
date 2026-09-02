import { computeAccessState } from "@/lib/db";
import { SubscriptionPaywall } from "@/components/paywall";

export default function GatedLayout({ children }: { children: React.ReactNode }) {
  const access = computeAccessState();
  if (access.blocked) return <SubscriptionPaywall reason={access.reason} />;
  return <>{children}</>;
}
