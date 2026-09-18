import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type {
  MeetingRecord,
  NoMeetingDay,
  EarnedBadge,
  TeamRank,
  DeclareResult,
} from "@/lib/types";
import {
  STORAGE_KEY_RECORDS,
  STORAGE_KEY_NO_MEETING_DAYS,
  STORAGE_KEY_BADGES,
} from "@/lib/constants";

// These will be implemented in later packets — we import them for type checking
// The actual implementations don't exist yet (TDD RED phase)
import { rankTeams } from "@/lib/ranking";
import { declareNoMeetingDay, canDeclareToday, isWeekday } from "@/lib/challenge";
import { writeRaw, readRaw } from "@/lib/storage";

// ============================================================================
// PACKET 0006: 팀 랭킹, 챌린지 규칙, declareNoMeetingDay (challenge.ts)
// ============================================================================
// Tests for functions to be implemented in:
//   - src/lib/ranking.ts (rankTeams)
//   - src/lib/challengeRules.ts (isWeekday, canDeclareToday, etc.)
//   - src/lib/challenge.ts (declareNoMeetingDay, re-export)

// ── Test helpers ──
function makeRecord(
  teamName: string,
  totalCost: number,
  endedAt: string,
  overrides?: Partial<MeetingRecord>,
): MeetingRecord {
  const now = new Date().toISOString();
  return {
    id: `record-${Date.now()}-${Math.random()}`,
    title: `Meeting-${teamName}`,
    teamName,
    attendees: 5,
    annualSalaryManwon: 50000,
    plannedMinutes: 60,
    startedAt: new Date(endedAt).toISOString(),
    endedAt,
    durationSec: 3600,
    totalCost,
    outcome: "decided",
    wasteCost: 0,
    reportUnlocked: false,
    shareUnlocked: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeNoMeetingDay(date: string, overrides?: Partial<NoMeetingDay>): NoMeetingDay {
  const now = new Date().toISOString();
  return {
    id: date,
    date,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeBadge(badgeId: "first_free_day" | "streak_3" | "total_5" | "total_10" | "total_20"): EarnedBadge {
  const now = new Date().toISOString();
  return {
    id: badgeId,
    badgeId,
    createdAt: now,
    updatedAt: now,
  };
}

describe("Packet 0006: 팀 랭킹, 챌린지 규칙, declareNoMeetingDay", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // AC-1: 팀A 기록 2건(각 90144원)과 팀B 1건이 있으면 rankTeams 1위는 팀A이고
  //       totalCost=180288이다. 지난달 기록은 제외된다
  // ══════════════════════════════════════════════════════════════════════════════
  it("AC-1[P0]: should rank teams by total cost, excluding past months", () => {
    // This month: 2026-09-*
    const septemberRecord1 = makeRecord("TeamA", 90144, "2026-09-01T10:00:00Z");
    const septemberRecord2 = makeRecord("TeamA", 90144, "2026-09-15T14:00:00Z");
    const septemberRecord3 = makeRecord("TeamB", 50000, "2026-09-20T16:00:00Z");

    // Previous month: 2026-08-* (should be excluded)
    const augustRecord = makeRecord("TeamA", 80000, "2026-08-25T09:00:00Z");

    const records = [septemberRecord1, septemberRecord2, septemberRecord3, augustRecord];
    const now = new Date("2026-09-25T12:00:00Z");

    const ranks = rankTeams(records, now);

    // Verify: only 2 teams (A and B), A is rank 1
    expect(ranks).toHaveLength(2);
    expect(ranks[0].rank).toBe(1);
    expect(ranks[0].teamName).toBe("TeamA");
    expect(ranks[0].totalCost).toBe(180288); // 90144 + 90144
    expect(ranks[0].count).toBe(2);

    expect(ranks[1].rank).toBe(2);
    expect(ranks[1].teamName).toBe("TeamB");
    expect(ranks[1].totalCost).toBe(50000);
    expect(ranks[1].count).toBe(1);
  });

  it("AC-1[P0]: should calculate correct sharePercent for each team", () => {
    const records = [
      makeRecord("TeamA", 100, "2026-09-01T10:00:00Z"),
      makeRecord("TeamB", 200, "2026-09-01T10:00:00Z"),
    ];
    const now = new Date("2026-09-25T12:00:00Z");

    const ranks = rankTeams(records, now);

    // Total: 300 (100 + 200)
    // TeamA: 100/300 ≈ 33.33%
    // TeamB: 200/300 ≈ 66.67%
    // Sorted by cost: TeamB first
    expect(ranks[0].teamName).toBe("TeamB");
    expect(ranks[0].sharePercent).toBeGreaterThan(66);
    expect(ranks[0].sharePercent).toBeLessThan(67);
    expect(ranks[1].sharePercent).toBeGreaterThan(33);
    expect(ranks[1].sharePercent).toBeLessThan(34);
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // AC-2: 토요일이나 일요일에는 declareNoMeetingDay가 {ok:false, reason:'weekend'}를
  //       반환하고 저장소를 바꾸지 않는다
  // ══════════════════════════════════════════════════════════════════════════════
  it("AC-2[P0]: should reject Saturday with reason='weekend' and not modify storage", () => {
    // 2026-09-19 is a Saturday (verified: getDay() = 6)
    const saturday = new Date("2026-09-19T12:00:00Z");
    expect(saturday.getDay()).toBe(6); // Sanity check: Saturday

    // Seed initial state
    localStorage.setItem(STORAGE_KEY_NO_MEETING_DAYS, JSON.stringify([]));

    const result = declareNoMeetingDay(saturday);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("weekend");
    }

    // Verify storage was not modified
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY_NO_MEETING_DAYS) ?? "[]");
    expect(stored).toEqual([]);
  });

  it("AC-2[P0]: should reject Sunday with reason='weekend'", () => {
    // 2026-09-20 is a Sunday (verified: getDay() = 0)
    const sunday = new Date("2026-09-20T12:00:00Z");
    expect(sunday.getDay()).toBe(0); // Sanity check: Sunday

    localStorage.setItem(STORAGE_KEY_NO_MEETING_DAYS, JSON.stringify([]));

    const result = declareNoMeetingDay(sunday);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("weekend");
    }
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // AC-3: 오늘 날짜 키를 포함하는 기록이나 진행 중인 active가 있으면
  //       {ok:false, reason:'has_meeting'}을 반환한다
  // ══════════════════════════════════════════════════════════════════════════════
  it("AC-3[P0]: should reject if today has a meeting record", () => {
    const today = new Date("2026-09-18T12:00:00Z"); // Friday
    const todayRecord = makeRecord("TeamA", 50000, today.toISOString());

    localStorage.setItem(STORAGE_KEY_RECORDS, JSON.stringify([todayRecord]));
    localStorage.setItem(STORAGE_KEY_NO_MEETING_DAYS, JSON.stringify([]));

    const result = declareNoMeetingDay(today);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("has_meeting");
    }
  });

  it("AC-3[P0]: should reject if active meeting exists (regardless of today)", () => {
    const today = new Date("2026-09-18T12:00:00Z");
    const activeMeeting = {
      id: "active-1",
      setup: {
        title: "Ongoing",
        teamName: "TeamA",
        attendees: 5,
        annualSalaryManwon: 50000,
        plannedMinutes: 60,
      },
      startedAt: today.getTime() - 1800000, // started 30 min ago
      pausedAt: null,
      totalPausedMs: 0,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    };

    localStorage.setItem("mcc:v1:active", JSON.stringify(activeMeeting));
    localStorage.setItem(STORAGE_KEY_NO_MEETING_DAYS, JSON.stringify([]));

    const result = declareNoMeetingDay(today);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("has_meeting");
    }
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // AC-4: 첫 선언이 성공하면 badges에 first_free_day가 추가된다.
  //       같은 날짜를 다시 선언해도 NoMeetingDay 행은 1개다
  // ══════════════════════════════════════════════════════════════════════════════
  it("AC-4[P0]: should add first_free_day badge on first successful declaration", () => {
    const today = new Date("2026-09-17T12:00:00Z"); // Wednesday (weekday)
    const todayStr = today.toISOString().split("T")[0]; // "2026-09-17"

    localStorage.setItem(STORAGE_KEY_RECORDS, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEY_NO_MEETING_DAYS, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEY_BADGES, JSON.stringify([]));

    const result = declareNoMeetingDay(today);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.day).toBeDefined();
      expect(result.day.date).toBe(todayStr);

      expect(result.newBadges).toHaveLength(1);
      expect(result.newBadges[0].badgeId).toBe("first_free_day");

      // Verify storage was updated
      const storedDays: NoMeetingDay[] = JSON.parse(
        localStorage.getItem(STORAGE_KEY_NO_MEETING_DAYS) ?? "[]"
      );
      expect(storedDays).toHaveLength(1);
      expect(storedDays[0].date).toBe(todayStr);

      const storedBadges: EarnedBadge[] = JSON.parse(
        localStorage.getItem(STORAGE_KEY_BADGES) ?? "[]"
      );
      expect(storedBadges).toHaveLength(1);
      expect(storedBadges[0].badgeId).toBe("first_free_day");
    }
  });

  it("AC-4[P0]: should not create duplicate NoMeetingDay if same date declared twice", () => {
    const today = new Date("2026-09-17T12:00:00Z"); // Wednesday
    const todayStr = today.toISOString().split("T")[0];

    localStorage.setItem(STORAGE_KEY_RECORDS, JSON.stringify([]));
    const initialDay = makeNoMeetingDay(todayStr);
    localStorage.setItem(STORAGE_KEY_NO_MEETING_DAYS, JSON.stringify([initialDay]));
    localStorage.setItem(STORAGE_KEY_BADGES, JSON.stringify([]));

    const result = declareNoMeetingDay(today);

    expect(result.ok).toBe(false); // Second declaration should fail
    if (!result.ok) {
      expect(result.reason).toBe("already_declared");
    }

    // Storage should still have exactly 1 entry
    const storedDays: NoMeetingDay[] = JSON.parse(
      localStorage.getItem(STORAGE_KEY_NO_MEETING_DAYS) ?? "[]"
    );
    expect(storedDays).toHaveLength(1);
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // AC-5: failSetItemOnNth로 noMeetingDays 쓰기를 실패시키면 원본 문자열로
  //       복원되고 reason은 'quota'다
  // ══════════════════════════════════════════════════════════════════════════════
  it("AC-5[P0]: should rollback and return reason='quota' on write failure", () => {
    const today = new Date("2026-09-17T12:00:00Z"); // Wednesday

    // Setup: inject a storage write failure scenario
    // We'll mock localStorage.setItem to fail on the first call
    const originalSetItem = Storage.prototype.setItem;
    let armed = false;

    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (
      this: Storage,
      key: string,
      value: string,
    ) {
      if (armed && key === STORAGE_KEY_NO_MEETING_DAYS) {
        // Simulate QuotaExceededError
        const err = new DOMException("Quota exceeded", "QuotaExceededError");
        throw err;
      }
      originalSetItem.call(this, key, value);
    });

    localStorage.setItem(STORAGE_KEY_RECORDS, JSON.stringify([]));
    const initialState = JSON.stringify([]);
    localStorage.setItem(STORAGE_KEY_NO_MEETING_DAYS, initialState);
    localStorage.setItem(STORAGE_KEY_BADGES, JSON.stringify([]));

    armed = true;
    const result = declareNoMeetingDay(today);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("quota");
    }

    // Verify original storage is restored
    const restored = localStorage.getItem(STORAGE_KEY_NO_MEETING_DAYS);
    expect(restored).toBe(initialState);

    spy.mockRestore();
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // Helper function tests (pure functions from challengeRules.ts)
  // ══════════════════════════════════════════════════════════════════════════════
  it("isWeekday: should return true for weekdays and false for weekends", () => {
    // 2026-09-17 is Wednesday (weekday)
    const wednesday = new Date("2026-09-17T12:00:00Z");
    expect(isWeekday(wednesday)).toBe(true);

    // 2026-09-19 is Saturday (weekend)
    const saturday = new Date("2026-09-19T12:00:00Z");
    expect(isWeekday(saturday)).toBe(false);

    // 2026-09-21 is Sunday (weekend)
    const sunday = new Date("2026-09-20T12:00:00Z");
    expect(isWeekday(sunday)).toBe(false);
  });

  it("canDeclareToday: should return true for weekday with no active/records", () => {
    const friday = new Date("2026-09-18T12:00:00Z");

    localStorage.setItem(STORAGE_KEY_RECORDS, JSON.stringify([]));
    localStorage.setItem("mcc:v1:active", JSON.stringify(null));
    localStorage.setItem(STORAGE_KEY_NO_MEETING_DAYS, JSON.stringify([]));

    const result = canDeclareToday(friday);

    expect(result.ok).toBe(true);
  });

  it("canDeclareToday: should reject weekend", () => {
    const saturday = new Date("2026-09-19T12:00:00Z");

    const result = canDeclareToday(saturday);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("weekend");
    }
  });
});
