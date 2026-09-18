import type { MeetingRecord } from "@/lib/types";
import type { getWeekSummaryFn } from "@/lib/contract";

export interface WeekSummary {
  weekTotal: number;
  weekCount: number;
  recent3: MeetingRecord[];
}

/** 이번 주 월요일 00:00 (로컬) */
function weekStartMs(now: Date): number {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const offset = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - offset);
  return d.getTime();
}

export function weekSummary(records: MeetingRecord[], now: Date | number): WeekSummary {
  const list = Array.isArray(records) ? records : [];
  const start = weekStartMs(new Date(now));
  const valid = list
    .map((r) => ({ r, t: Date.parse(r?.endedAt) }))
    .filter((x) => Number.isFinite(x.t));
  const thisWeek = valid.filter((x) => x.t >= start);
  return {
    weekTotal: thisWeek.reduce((sum, x) => sum + (Number(x.r.totalCost) || 0), 0),
    weekCount: thisWeek.length,
    recent3: [...valid]
      .sort((a, b) => b.t - a.t)
      .slice(0, 3)
      .map((x) => x.r),
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** 홈 대시보드 주간 합계 — weekStartDate부터 7일(시작 포함, 종료 미포함) 안의 기록만 합산 */
export const getWeekSummary: getWeekSummaryFn = (records, weekStartDate) => {
  const start = Date.parse(weekStartDate);
  const result = { totalMs: 0, totalCostKrw: 0, count: 0 };
  if (!Array.isArray(records) || !Number.isFinite(start)) return result;
  const end = start + 7 * DAY_MS;
  for (const r of records) {
    const t = Date.parse(r?.date);
    if (!Number.isFinite(t) || t < start || t >= end) continue;
    result.totalMs += Number(r.durationMs) || 0;
    result.totalCostKrw += Number(r.costKrw) || 0;
    result.count += 1;
  }
  return result;
};
