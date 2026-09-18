import type { ActiveMeeting, StaleResult } from "@/lib/types";
import { MAX_DURATION_SEC, MAX_WALL_MS } from "@/lib/constants";

type TimeFields = Pick<ActiveMeeting, "startedAt" | "pausedAt" | "totalPausedMs">;

export type CapReason = "elapsed_cap" | "wall_cap";

export type StaleDetail =
  | { stale: false; reason?: undefined }
  | { stale: true; reason: CapReason; endedAtMs: number; durationSec: number };

const MAX_ELAPSED_MS = MAX_DURATION_SEC * 1000;

/** 일시정지를 뺀 경과 초. 항상 0 ≤ x ≤ MAX_DURATION_SEC. */
export function getElapsedSec(active: TimeFields, now: number): number {
  const currentPause = active.pausedAt !== null ? now - active.pausedAt : 0;
  const ms = now - active.startedAt - active.totalPausedMs - currentPause;
  const sec = Math.floor(ms / 1000);
  if (!Number.isFinite(sec)) return 0;
  return Math.min(Math.max(sec, 0), MAX_DURATION_SEC);
}

/** 종료 상한 시각(epoch ms)과 그 사유. */
export function getCapAt(active: TimeFields): { capAt: number; reason: CapReason } {
  let tA = active.startedAt + active.totalPausedMs + MAX_ELAPSED_MS;
  if (active.pausedAt !== null && tA > active.pausedAt) tA = Infinity;
  const tB = active.startedAt + MAX_WALL_MS;
  const capAt = Math.min(tA, tB);
  return { capAt, reason: capAt === tA ? "elapsed_cap" : "wall_cap" };
}

export function resolveStale(active: TimeFields, now: number): StaleResult & StaleDetail {
  const { capAt, reason } = getCapAt(active);
  if (now < capAt) return { stale: false };
  return {
    stale: true,
    reason,
    endedAtMs: capAt,
    durationSec: getElapsedSec(active, capAt),
  };
}

function dateKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** start·end의 로컬 날짜를 양 끝으로 포함하는 YYYY-MM-DD 배열. end<start이면 [start 키]. */
export function localDateKeysBetween(
  startMs: number | Date,
  endMs: number | Date,
): string[] {
  const s = new Date(startMs);
  const e = new Date(endMs);
  if (Number.isNaN(s.getTime())) return [];
  if (Number.isNaN(e.getTime()) || e.getTime() < s.getTime()) return [dateKey(s)];
  const keys: string[] = [];
  const cur = new Date(s.getFullYear(), s.getMonth(), s.getDate());
  const last = dateKey(e);
  for (let i = 0; i < 4000; i++) {
    const k = dateKey(cur);
    keys.push(k);
    if (k === last) break;
    cur.setDate(cur.getDate() + 1);
  }
  return keys;
}
