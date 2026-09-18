import { STORAGE_KEY_BADGES, STORAGE_KEY_NO_MEETING_DAYS } from "@/lib/constants";
import { badgesFor, canDeclareToday, hasMeetingOn, toDateKey } from "@/lib/challengeRules";
import { normalizeRecords } from "@/lib/schema";
import { loadBadges, loadActive, loadNoMeetingDays, parseArray, readRaw, writeRaw } from "@/lib/storageBase";
import { STORAGE_KEY_RECORDS } from "@/lib/constants";
import type { DeclareResult, EarnedBadge, NoMeetingDay } from "@/lib/types";

export { isWeekday, canDeclareToday } from "@/lib/challengeRules";
export { rankTeams, getTeamRanking } from "@/lib/ranking";

function restore(key: string, raw: string | null): void {
  try {
    if (raw === null) localStorage.removeItem(key);
    else localStorage.setItem(key, raw);
  } catch {
    // 복원 실패는 무시 — 이미 실패 경로다
  }
}

export function declareNoMeetingDay(now: Date): DeclareResult {
  if (!canDeclareToday(now).ok) return { ok: false, reason: "weekend" };

  let daysRaw: string | null;
  let badgesRaw: string | null;
  try {
    daysRaw = localStorage.getItem(STORAGE_KEY_NO_MEETING_DAYS);
    badgesRaw = localStorage.getItem(STORAGE_KEY_BADGES);
  } catch {
    return { ok: false, reason: "unknown" };
  }

  const recs = parseArray(readRaw(STORAGE_KEY_RECORDS));
  const records = recs.ok ? normalizeRecords(recs.items) : [];
  if (hasMeetingOn(records, now, loadActive() !== null)) return { ok: false, reason: "has_meeting" };

  const date = toDateKey(now);
  const days = loadNoMeetingDays();
  if (days.some((d) => d.date === date)) return { ok: false, reason: "already_declared" };

  const ts = now.toISOString();
  const day: NoMeetingDay = { id: date, date, createdAt: ts, updatedAt: ts };
  const nextDays = [...days, day];

  const owned = loadBadges();
  const ownedIds = new Set(owned.map((b) => b.badgeId));
  const newBadges: EarnedBadge[] = badgesFor(nextDays.map((d) => d.date))
    .filter((id) => !ownedIds.has(id))
    .map((badgeId) => ({ id: badgeId, badgeId, createdAt: ts, updatedAt: ts }));

  const w1 = writeRaw(STORAGE_KEY_NO_MEETING_DAYS, nextDays);
  if (!w1.ok) {
    restore(STORAGE_KEY_NO_MEETING_DAYS, daysRaw);
    return { ok: false, reason: w1.reason === "quota" ? "quota" : "unknown" };
  }
  const w2 = writeRaw(STORAGE_KEY_BADGES, [...owned, ...newBadges]);
  if (!w2.ok) {
    restore(STORAGE_KEY_NO_MEETING_DAYS, daysRaw);
    restore(STORAGE_KEY_BADGES, badgesRaw);
    return { ok: false, reason: w2.reason === "quota" ? "quota" : "unknown" };
  }
  return { ok: true, day, newBadges };
}
