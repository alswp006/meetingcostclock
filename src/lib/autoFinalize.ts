import { finalizeAt } from "@/lib/finalize";
import { resolveStale } from "@/lib/meetingTime";
import { loadActive } from "@/lib/storageBase";
import type { AutoFinalizeResult, FinalizeResult } from "@/lib/types";

const MAX_QUOTA_RETRIES = 2;
// active 회의 id별 quota 재시도 횟수와 토스트 노출 여부. 이 파일 한 곳에서만 센다.
const quotaRetries = new Map<string, number>();
const quotaToasted = new Set<string>();

/** 테스트용: 재시도 카운터 초기화 */
export function resetAutoFinalizeRetries(): void {
  quotaRetries.clear();
  quotaToasted.clear();
}

/** 상한을 넘긴 active를 상한 시각(capAt)으로 자동 종료한다. quota 실패는 최대 2회만 재시도. */
export function autoFinalizeStale(now: number): AutoFinalizeResult {
  const active = loadActive();
  if (!active) return { status: "not_stale" };
  const stale = resolveStale(active, now);
  if (!stale.stale) return { status: "not_stale" };

  let hadQuota = false;
  let result: FinalizeResult = finalizeAt(active, stale.endedAtMs, stale.reason);
  while (!result.ok && result.reason === "quota") {
    hadQuota = true;
    const tries = quotaRetries.get(active.id) ?? 0;
    if (tries >= MAX_QUOTA_RETRIES) break;
    quotaRetries.set(active.id, tries + 1);
    result = finalizeAt(active, stale.endedAtMs, stale.reason);
  }
  if (result.ok) quotaRetries.delete(active.id);
  // 저장 실패 안내는 같은 회의에 대해 첫 실패에만 띄운다
  const showQuotaToast = hadQuota && !quotaToasted.has(active.id);
  if (hadQuota) quotaToasted.add(active.id);
  return { status: "done", staleReason: stale.reason, result, showQuotaToast };
}
