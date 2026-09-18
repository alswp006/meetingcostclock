import type { BadgeId, MeetingRecord } from "@/lib/types";

export function isWeekday(date: Date): boolean {
  const d = date.getDay();
  return d !== 0 && d !== 6;
}

/** 로컬 날짜 YYYY-MM-DD */
export function toDateKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function hasMeetingOn(records: MeetingRecord[], date: Date, hasActive: boolean): boolean {
  if (hasActive) return true;
  const key = toDateKey(date);
  return records.some((r) => {
    const t = new Date(r?.endedAt);
    return !Number.isNaN(t.getTime()) && toDateKey(t) === key;
  });
}

export function canDeclareToday(date: Date): { ok: true } | { ok: false; reason: string } {
  if (!isWeekday(date)) return { ok: false, reason: "weekend" };
  return { ok: true };
}

/** 날짜 목록에서 마지막 날짜 기준 연속 평일 수 (주말은 건너뜀) */
export function trailingStreak(dates: string[]): number {
  const set = new Set(dates);
  const sorted = [...set].sort();
  if (sorted.length === 0) return 0;
  const cur = new Date(`${sorted[sorted.length - 1]}T12:00:00`);
  let streak = 0;
  while (set.has(toDateKey(cur)) || !isWeekday(cur)) {
    if (isWeekday(cur)) streak += 1;
    cur.setDate(cur.getDate() - 1);
    if (streak > 400) break;
  }
  return streak;
}

export function badgesFor(dates: string[]): BadgeId[] {
  const out: BadgeId[] = [];
  const n = new Set(dates).size;
  if (n >= 1) out.push("first_free_day");
  if (trailingStreak(dates) >= 3) out.push("streak_3");
  if (n >= 5) out.push("total_5");
  if (n >= 10) out.push("total_10");
  if (n >= 20) out.push("total_20");
  return out;
}
