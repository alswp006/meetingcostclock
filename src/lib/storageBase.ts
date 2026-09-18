import {
  STORAGE_KEY_ACTIVE,
  STORAGE_KEY_BADGES,
  STORAGE_KEY_LAST_SETUP,
  STORAGE_KEY_NO_MEETING_DAYS,
} from "@/lib/constants";
import {
  isActiveMeeting,
  isMeetingSetup,
  normalizeBadges,
  normalizeNoMeetingDays,
} from "@/lib/schema";
import type {
  ActiveMeeting,
  EarnedBadge,
  MeetingSetup,
  MeetingSetupInput,
  NoMeetingDay,
  SaveResult,
} from "@/lib/types";

export type ReadResult =
  | { ok: true; value: unknown }
  | { ok: false; error: "corrupted" | "unavailable" };

/** 읽기 전용. 키가 없으면 value=null, JSON이 깨졌으면 corrupted, 접근 불가면 unavailable. */
export function readRaw(key: string): ReadResult {
  let text: string | null;
  try {
    text = localStorage.getItem(key);
  } catch {
    return { ok: false, error: "unavailable" };
  }
  if (text === null) return { ok: true, value: null };
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, error: "corrupted" };
  }
}

/** 배열이 아니면 corrupted로 본다. 키가 없으면 빈 배열. */
export function parseArray(
  r: ReadResult,
): { ok: true; items: unknown[] } | { ok: false; error: "corrupted" | "unavailable" } {
  if (!r.ok) return r;
  if (r.value === null) return { ok: true, items: [] };
  if (!Array.isArray(r.value)) return { ok: false, error: "corrupted" };
  return { ok: true, items: r.value };
}

function isQuotaError(e: unknown): boolean {
  if (typeof e !== "object" || e === null) return false;
  const { name, code } = e as { name?: unknown; code?: unknown };
  return (
    name === "QuotaExceededError" ||
    name === "NS_ERROR_DOM_QUOTA_REACHED" ||
    code === 22 ||
    code === 1014
  );
}

export function writeRaw(key: string, value: unknown): SaveResult {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: isQuotaError(e) ? "quota" : "unknown" };
  }
}

let idSeq = 0;
export function newId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    // fall through
  }
  idSeq += 1;
  return `${Date.now().toString(36)}-${idSeq.toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function loadLastSetup(): MeetingSetup | null {
  const r = readRaw(STORAGE_KEY_LAST_SETUP);
  return r.ok && isMeetingSetup(r.value) ? r.value : null;
}

export function saveLastSetup(input: MeetingSetupInput): SaveResult {
  const prev = loadLastSetup();
  const now = new Date().toISOString();
  const setup: MeetingSetup = {
    id: "lastSetup",
    title: input.title,
    teamName: input.teamName,
    attendees: input.attendees,
    annualSalaryManwon: input.annualSalaryManwon,
    plannedMinutes: input.plannedMinutes,
    createdAt: prev?.createdAt ?? now,
    updatedAt: now,
  };
  return writeRaw(STORAGE_KEY_LAST_SETUP, setup);
}

export function loadActive(): ActiveMeeting | null {
  const r = readRaw(STORAGE_KEY_ACTIVE);
  return r.ok && isActiveMeeting(r.value) ? r.value : null;
}

export function saveActive(a: ActiveMeeting | null): SaveResult {
  return writeRaw(STORAGE_KEY_ACTIVE, a);
}

export function loadNoMeetingDays(): NoMeetingDay[] {
  const p = parseArray(readRaw(STORAGE_KEY_NO_MEETING_DAYS));
  return p.ok ? normalizeNoMeetingDays(p.items) : [];
}

export function loadBadges(): EarnedBadge[] {
  const p = parseArray(readRaw(STORAGE_KEY_BADGES));
  return p.ok ? normalizeBadges(p.items) : [];
}
