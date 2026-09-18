import { useEffect, useRef } from "react";
import { Toast } from "@toss/tds-mobile";
import { useToastQueue } from "@/hooks/useToastQueue";
import { autoFinalizeStale } from "@/lib/autoFinalize";
import { AUTO_CLOSED_8H, AUTO_CLOSED_12H, QUOTA_TOAST } from "@/lib/messages";

/**
 * 앱 시작 시 1회: 상한(8h 경과/12h 벽시계)을 넘긴 진행 중 회의를 자동 종료하고 안내 토스트를 띄운다.
 * 화면을 가리지 않는다 — 토스트(position bottom) 1개만 렌더.
 */
export function StaleGate() {
  const toast = useToastQueue();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    try {
      const r = autoFinalizeStale(Date.now());
      if (r.status !== "done") return;
      if (r.result.ok) {
        toast.push(r.staleReason === "elapsed_cap" ? AUTO_CLOSED_8H : AUTO_CLOSED_12H);
      } else if (r.showQuotaToast) {
        toast.push(QUOTA_TOAST);
      }
    } catch {
      /* 저장소 접근 실패 — 앱 진입을 막지 않는다 */
    }
  }, [toast]);

  return (
    <Toast
      open={toast.current !== null}
      position="bottom"
      text={toast.current ?? ""}
      onClose={toast.dismiss}
    />
  );
}
