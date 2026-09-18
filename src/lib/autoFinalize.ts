import { finalizeAt } from "@/lib/finalize";
import { resolveStale } from "@/lib/meetingTime";
import { loadActive } from "@/lib/storageBase";
import type { AutoFinalizeResult, FinalizeResult } from "@/lib/types";

const MAX_QUOTA_RETRIES = 2;
// 런타임(모듈) 동안 쓴 quota 재시도 횟수. 이 파일 한 곳에서만 센다. 저장에 성공하면 0으로 돌아간다.
let quotaRetries = 0;

/** 테스트용: 재시도 카운터 초기화 */
export function resetAutoFinalizeRetries(): void {
  quotaRetries = 0;
}

/** 상한을 넘긴 active를 상한 시각(capAt)으로 자동 종료한다. quota 실패는 최대 2회만 재시도. */
export function autoFinalizeStale(now: number): AutoFinalizeResult {
  const active = loadActive();
  if (!active) return { status: "suppressed" };
  const stale = resolveStale(active, now);
  if (!stale.stale) return { status: "not_stale" };

  let hadQuota = false;
  let result: FinalizeResult = finalizeAt(active, stale.endedAtMs, stale.reason);
  while (!result.ok && result.reason === "quota") {
    hadQuota = true;
    if (quotaRetries >= MAX_QUOTA_RETRIES) break;
    quotaRetries += 1;
    result = finalizeAt(active, stale.endedAtMs, stale.reason);
  }
  if (result.ok) quotaRetries = 0;
  return { status: "done", staleReason: stale.reason, result, showQuotaToast: hadQuota };
}
