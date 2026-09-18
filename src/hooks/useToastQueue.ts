import { useCallback, useState } from "react";

export function useToastQueue(): {
  current: string | null;
  push: (msg: string) => void;
  dismiss: () => void;
} {
  const [queue, setQueue] = useState<string[]>([]);
  const push = useCallback((msg: string) => setQueue((q) => [...q, msg]), []);
  const dismiss = useCallback(() => setQueue((q) => q.slice(1)), []);
  return { current: queue.length > 0 ? queue[0] : null, push, dismiss };
}
