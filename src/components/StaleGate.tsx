import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { pushCarryOver } from "@/hooks/useToastQueue";
import { autoFinalizeStale } from "@/lib/autoFinalize";
import { AUTO_CLOSED_8H, AUTO_CLOSED_12H, QUOTA_TOAST, TOO_SHORT } from "@/lib/messages";

/**
 * 앱 시작 시 1회: 상한(8h 경과/12h 벽시계)을 넘긴 진행 중 회의를 자동 종료한다.
 * 처리가 끝날 때까지 라우트를 렌더하지 않고, 저장됐으면 회고(/wrapup/:id)로 보낸다.
 * 안내 토스트는 다음에 뜨는 화면이 이어받는다.
 */
export function StaleGate({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    try {
      const r = autoFinalizeStale(Date.now());
      if (r.status === "done") {
        if (r.showQuotaToast) pushCarryOver(QUOTA_TOAST);
        if (r.result.ok) {
          pushCarryOver(r.staleReason === "elapsed_cap" ? AUTO_CLOSED_8H : AUTO_CLOSED_12H);
          navigate(`/wrapup/${r.result.record.id}`, { replace: true });
        } else if (r.result.reason === "too_short") {
          pushCarryOver(TOO_SHORT);
        }
      }
    } catch {
      /* 저장소 접근 실패 — 앱 진입을 막지 않는다 */
    }
    setReady(true);
  }, [navigate]);

  return ready ? <>{children}</> : null;
}
