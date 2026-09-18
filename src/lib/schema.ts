import type {
  ActiveMeeting,
  EarnedBadge,
  MeetingRecord,
  MeetingSetup,
  MeetingSetupInput,
  NoMeetingDay,
} from "@/lib/types";
import { RECORDS_MAX } from "@/lib/constants";

const BADGE_IDS = ["first_free_day", "streak_3", "total_5", "total_10", "total_20"];
const OUTCOMES = ["decided", "partial", "none"];

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function isStr(v: unknown): v is string {
  return typeof v === "string";
}
function intIn(v: unknown, min: number, max: number): boolean {
  return typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;
}
function isNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;
function isIso(v: unknown): v is string {
  return isStr(v) && ISO_RE.test(v) && !Number.isNaN(Date.parse(v));
}
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isMeetingSetupInput(v: unknown): v is MeetingSetupInput {
  return (
    isObj(v) &&
    isStr(v.title) &&
    isStr(v.teamName) &&
    intIn(v.attendees, 2, 100) &&
    intIn(v.annualSalaryManwon, 1000, 50000) &&
    intIn(v.plannedMinutes, 5, 480)
  );
}

export function isMeetingSetup(v: unknown): v is MeetingSetup {
  return (
    isMeetingSetupInput(v) &&
    (v as unknown as Record<string, unknown>).id === "lastSetup" &&
    isIso((v as unknown as Record<string, unknown>).createdAt) &&
    isIso((v as unknown as Record<string, unknown>).updatedAt)
  );
}

export function isActiveMeeting(v: unknown): v is ActiveMeeting {
  return (
    isObj(v) &&
    isStr(v.id) &&
    v.id !== "" &&
    isMeetingSetupInput(v.setup) &&
    isNum(v.startedAt) &&
    (v.pausedAt === null || isNum(v.pausedAt)) &&
    isNum(v.totalPausedMs) &&
    v.totalPausedMs >= 0 &&
    isIso(v.createdAt) &&
    isIso(v.updatedAt)
  );
}

export function isMeetingRecord(v: unknown): v is MeetingRecord {
  if (!isObj(v)) return false;
  if (!isStr(v.id) || v.id === "") return false;
  if (!isStr(v.title) || !isStr(v.teamName)) return false;
  if (!intIn(v.attendees, 2, 100)) return false;
  if (!intIn(v.annualSalaryManwon, 1000, 50000)) return false;
  if (!intIn(v.plannedMinutes, 5, 480)) return false;
  if (!isIso(v.startedAt) || !isIso(v.endedAt)) return false;
  if (Date.parse(v.endedAt) < Date.parse(v.startedAt)) return false;
  if (!intIn(v.durationSec, 10, 28800)) return false;
  if (!isNum(v.totalCost) || v.totalCost < 0) return false;
  const outcomeNull = v.outcome === null;
  const wasteNull = v.wasteCost === null;
  if (outcomeNull !== wasteNull) return false;
  if (!outcomeNull) {
    if (!isStr(v.outcome) || !OUTCOMES.includes(v.outcome)) return false;
    if (!isNum(v.wasteCost) || v.wasteCost < 0) return false;
  }
  if (typeof v.reportUnlocked !== "boolean" || typeof v.shareUnlocked !== "boolean") {
    return false;
  }
  return isIso(v.createdAt) && isIso(v.updatedAt);
}

export function isNoMeetingDay(v: unknown): v is NoMeetingDay {
  return (
    isObj(v) &&
    isStr(v.id) &&
    isStr(v.date) &&
    DATE_RE.test(v.date) &&
    v.id === v.date &&
    isIso(v.createdAt) &&
    isIso(v.updatedAt)
  );
}

export function isEarnedBadge(v: unknown): v is EarnedBadge {
  return (
    isObj(v) &&
    isStr(v.id) &&
    isStr(v.badgeId) &&
    BADGE_IDS.includes(v.badgeId) &&
    v.id === v.badgeId &&
    isIso(v.createdAt) &&
    isIso(v.updatedAt)
  );
}

/** 같은 id 중 updatedAt이 가장 늦은 행만 남긴다(동률이면 먼저 나온 행). */
function dedupeById<T extends { id: string; updatedAt: string }>(rows: T[]): T[] {
  const map = new Map<string, T>();
  for (const r of rows) {
    const prev = map.get(r.id);
    if (!prev || Date.parse(r.updatedAt) > Date.parse(prev.updatedAt)) map.set(r.id, r);
  }
  return [...map.values()];
}

function cmpStr(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function normalizeRecords(raw: unknown): MeetingRecord[] {
  if (!Array.isArray(raw)) return [];
  const valid = raw.filter(isMeetingRecord);
  return dedupeById(valid)
    .sort(
      (a, b) =>
        Date.parse(b.endedAt) - Date.parse(a.endedAt) || cmpStr(a.id, b.id),
    )
    .slice(0, RECORDS_MAX);
}

export function normalizeNoMeetingDays(raw: unknown): NoMeetingDay[] {
  if (!Array.isArray(raw)) return [];
  return dedupeById(raw.filter(isNoMeetingDay)).sort((a, b) =>
    cmpStr(a.date, b.date),
  );
}

export function normalizeBadges(raw: unknown): EarnedBadge[] {
  if (!Array.isArray(raw)) return [];
  return dedupeById(raw.filter(isEarnedBadge)).sort(
    (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || cmpStr(a.id, b.id),
  );
}
