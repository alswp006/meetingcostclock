import { useCallback, useEffect, useState } from "react";

// 화면 전환 직전에 쌓은 안내 — 다음에 마운트되는 화면의 큐가 이어받는다
let carryOver: string[] = [];

/** navigate() 직전에 호출: 언마운트로 사라지지 않고 다음 화면에서 뜬다. */
export function pushCarryOver(msg: string): void {
  carryOver.push(msg);
}

export function useToastQueue(): {
  current: string | null;
  push: (msg: string) => void;
  dismiss: () => void;
} {
  const [queue, setQueue] = useState<string[]>([]);
  const push = useCallback((msg: string) => setQueue((q) => [...q, msg]), []);
  const dismiss = useCallback(() => setQueue((q) => q.slice(1)), []);
  useEffect(() => {
    if (carryOver.length === 0) return;
    const pending = carryOver;
    carryOver = [];
    setQueue((q) => [...q, ...pending]);
  }, []);
  return { current: queue.length > 0 ? queue[0] : null, push, dismiss };
}
