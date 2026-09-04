"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function PendingCountdown({ createdAt, minutes }: { createdAt: string; minutes: number }) {
  const deadline = new Date(createdAt).getTime() + minutes * 60 * 1000;
  const [remaining, setRemaining] = useState(() => Math.max(0, deadline - Date.now()));
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => {
      const left = Math.max(0, deadline - Date.now());
      setRemaining(left);
      if (left === 0) {
        clearInterval(id);
        router.refresh();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [deadline, router]);

  const mm = Math.floor(remaining / 60000);
  const ss = Math.floor((remaining % 60000) / 1000);

  return (
    <span className="font-mono font-semibold">
      {String(mm).padStart(2, "0")}:{String(ss).padStart(2, "0")}
    </span>
  );
}
