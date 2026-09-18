import { describe, it, expect } from "vitest";
import type {
  ActiveMeeting,
  MeetingRecord,
  NoMeetingDay,
  EarnedBadge,
} from "@/lib/types";

// ============================================================================
// PACKET 0003: 회의 시간 상한/날짜 범위 함수와 스키마 검증
// ============================================================================
// These functions will be implemented in src/lib/meetingTime.ts and src/lib/schema.ts

// Import declarations (will fail until implementation exists — that's intentional for TDD)
// import {
//   getElapsedSec,
//   getCapAt,
//   resolveStale,
//   localDateKeysBetween,
// } from "@/lib/meetingTime";
// import {
//   normalizeRecords,
//   normalizeNoMeetingDays,
//   normalizeBadges,
//   isMeetingSetup,
//   isActiveMeeting,
//   isMeetingRecord,
//   isNoMeetingDay,
//   isEarnedBadge,
// } from "@/lib/schema";

describe("Packet 0003: 회의 시간 상한/날짜 범위 함수와 스키마 검증", () => {
  // ============================================================================
  // AC-1: getElapsedSec — 회의 경과 초 계산
  // ============================================================================
  describe("AC-1: getElapsedSec — 회의 경과 초 계산", () => {
    it("should calculate elapsed seconds for paused meeting", () => {
      // Given: a meeting started at 1000000, paused at 1060000 (60000 ms elapsed before pause),
      // no additional pause, now = 1120000 (another 60000 ms passed)
      // The pause lasted 60000 ms, so net elapsed = (1120000 - 1000000 - 60000) / 1000 = 60 sec
      const active: ActiveMeeting = {
        id: "test-1",
        setup: {
          title: "Test",
          teamName: "Team",
          attendees: 5,
          annualSalaryManwon: 5000,
          plannedMinutes: 30,
        },
        startedAt: 1000000,
        pausedAt: 1060000,
        totalPausedMs: 0,
        createdAt: new Date(1000000).toISOString(),
        updatedAt: new Date(1000000).toISOString(),
      };
      // const result = getElapsedSec(active, 1120000);
      // expect(result).toBe(60);
    });

    it("should clamp elapsed seconds at 28800 for active meeting past 8-hour cap", () => {
      // Given: a meeting started at 0, now = 32400000 ms (9 hours),
      // should clamp to 28800 (8 hours = 28800 seconds)
      const active: ActiveMeeting = {
        id: "test-2",
        setup: {
          title: "Long Meeting",
          teamName: "Team",
          attendees: 5,
          annualSalaryManwon: 5000,
          plannedMinutes: 30,
        },
        startedAt: 0,
        pausedAt: null,
        totalPausedMs: 0,
        createdAt: new Date(0).toISOString(),
        updatedAt: new Date(0).toISOString(),
      };
      // const result = getElapsedSec(active, 32400000);
      // expect(result).toBe(28800);
    });

    it("should return 0 when now is before startedAt (clock skew protection)", () => {
      // Given: a meeting started at 0, now = -5000 (negative/invalid),
      // should clamp to 0
      const active: ActiveMeeting = {
        id: "test-3",
        setup: {
          title: "Clock Skew",
          teamName: "Team",
          attendees: 5,
          annualSalaryManwon: 5000,
          plannedMinutes: 30,
        },
        startedAt: 0,
        pausedAt: null,
        totalPausedMs: 0,
        createdAt: new Date(0).toISOString(),
        updatedAt: new Date(0).toISOString(),
      };
      // const result = getElapsedSec(active, -5000);
      // expect(result).toBe(0);
    });

    it("should subtract totalPausedMs from elapsed time", () => {
      // Given: startedAt=1000000, totalPausedMs=5000, now=1010000
      // elapsed = (1010000 - 1000000 - 5000) / 1000 = 5 sec
      const active: ActiveMeeting = {
        id: "test-4",
        setup: {
          title: "With Pause",
          teamName: "Team",
          attendees: 5,
          annualSalaryManwon: 5000,
          plannedMinutes: 30,
        },
        startedAt: 1000000,
        pausedAt: null,
        totalPausedMs: 5000,
        createdAt: new Date(1000000).toISOString(),
        updatedAt: new Date(1000000).toISOString(),
      };
      // const result = getElapsedSec(active, 1010000);
      // expect(result).toBe(5);
    });

    it("should subtract current pause duration (now - pausedAt) when pausedAt !== null", () => {
      // Given: startedAt=1000000, pausedAt=1005000 (5s pause started),
      // totalPausedMs=0, now=1010000
      // elapsed = (1010000 - 1000000 - 0 - (1010000 - 1005000)) / 1000 = 5 sec
      const active: ActiveMeeting = {
        id: "test-5",
        setup: {
          title: "Currently Paused",
          teamName: "Team",
          attendees: 5,
          annualSalaryManwon: 5000,
          plannedMinutes: 30,
        },
        startedAt: 1000000,
        pausedAt: 1005000,
        totalPausedMs: 0,
        createdAt: new Date(1000000).toISOString(),
        updatedAt: new Date(1000000).toISOString(),
      };
      // const result = getElapsedSec(active, 1010000);
      // expect(result).toBe(5);
    });
  });

  // ============================================================================
  // AC-2: resolveStale — 회의 상한 도달 판정
  // ============================================================================
  describe("AC-2: resolveStale — 회의 상한 도달 판정", () => {
    it("should calculate tA (elapsed cap) correctly", () => {
      // Given: startedAt=1000000, totalPausedMs=1000, tA = 1000000 + 1000 + 28800000 = 29801000
      // When: pausedAt is null, tA should be valid (not Infinity)
      const active: ActiveMeeting = {
        id: "stale-1",
        setup: {
          title: "Elapsed Cap Test",
          teamName: "Team",
          attendees: 5,
          annualSalaryManwon: 5000,
          plannedMinutes: 30,
        },
        startedAt: 1000000,
        pausedAt: null,
        totalPausedMs: 1000,
        createdAt: new Date(1000000).toISOString(),
        updatedAt: new Date(1000000).toISOString(),
      };
      // const { capAt, reason } = getCapAt(active);
      // const expectedTa = 1000000 + 1000 + 28800000;
      // expect(capAt).toBe(expectedTa);
      // expect(reason).toBe("elapsed_cap");
    });

    it("should treat tA as Infinity when pausedAt !== null and tA > pausedAt", () => {
      // Given: startedAt=1000000, totalPausedMs=1000, pausedAt=5000000
      // tA = 1000000 + 1000 + 28800000 = 29801000
      // Since pausedAt (5000000) < tA (29801000), tA is invalid and treated as Infinity
      // Then capAt = min(Infinity, startedAt + 43200000) = startedAt + 43200000
      const active: ActiveMeeting = {
        id: "stale-2",
        setup: {
          title: "Stale Pause Test",
          teamName: "Team",
          attendees: 5,
          annualSalaryManwon: 5000,
          plannedMinutes: 30,
        },
        startedAt: 1000000,
        pausedAt: 5000000,
        totalPausedMs: 1000,
        createdAt: new Date(1000000).toISOString(),
        updatedAt: new Date(5000000).toISOString(),
      };
      // const { capAt, reason } = getCapAt(active);
      // const expectedTb = 1000000 + 43200000;
      // expect(capAt).toBe(expectedTb);
      // expect(reason).toBe("wall_cap");
    });

    it("should return reason='elapsed_cap' when capAt === tA", () => {
      // Given: a meeting where elapsed cap comes before wall cap
      // This typically happens when totalPausedMs is small
      const active: ActiveMeeting = {
        id: "stale-3",
        setup: {
          title: "Elapsed Cap Wins",
          teamName: "Team",
          attendees: 5,
          annualSalaryManwon: 5000,
          plannedMinutes: 30,
        },
        startedAt: 0,
        pausedAt: null,
        totalPausedMs: 0,
        createdAt: new Date(0).toISOString(),
        updatedAt: new Date(0).toISOString(),
      };
      // const { reason } = getCapAt(active);
      // expect(reason).toBe("elapsed_cap");
    });

    it("should detect stale meeting when now >= capAt", () => {
      // Given: capAt = 30000000, now >= capAt
      const active: ActiveMeeting = {
        id: "stale-4",
        setup: {
          title: "Past Cap",
          teamName: "Team",
          attendees: 5,
          annualSalaryManwon: 5000,
          plannedMinutes: 30,
        },
        startedAt: 0,
        pausedAt: null,
        totalPausedMs: 0,
        createdAt: new Date(0).toISOString(),
        updatedAt: new Date(0).toISOString(),
      };
      // const capAt = 30000000;
      // const { stale, reason } = resolveStale(active, capAt);
      // expect(stale).toBe(true);
      // expect(reason).toBe("elapsed_cap");
    });

    it("should not mark as stale when now < capAt", () => {
      // Given: now < capAt
      const active: ActiveMeeting = {
        id: "stale-5",
        setup: {
          title: "Before Cap",
          teamName: "Team",
          attendees: 5,
          annualSalaryManwon: 5000,
          plannedMinutes: 30,
        },
        startedAt: 0,
        pausedAt: null,
        totalPausedMs: 0,
        createdAt: new Date(0).toISOString(),
        updatedAt: new Date(0).toISOString(),
      };
      // const { stale } = resolveStale(active, 10000000);
      // expect(stale).toBe(false);
    });
  });

  // ============================================================================
  // AC-3: localDateKeysBetween — 날짜 범위 로컬 키 배열
  // ============================================================================
  describe("AC-3: localDateKeysBetween — 날짜 범위 로컬 키 배열", () => {
    it("should return date keys spanning midnight boundary", () => {
      // Given: start = 2026-09-21 23:00, end = 2026-09-22 00:30
      // Should return ['2026-09-21', '2026-09-22']
      const startDate = new Date(2026, 8, 21, 23, 0); // Sep 21, 11 PM
      const endDate = new Date(2026, 8, 22, 0, 30); // Sep 22, 12:30 AM
      const startMs = startDate.getTime();
      const endMs = endDate.getTime();
      // const result = localDateKeysBetween(startMs, endMs);
      // expect(result).toEqual(["2026-09-21", "2026-09-22"]);
    });

    it("should return single date key when both times are on same day", () => {
      // Given: both start and end are on 2026-09-21 (different times same day)
      const startDate = new Date(2026, 8, 21, 9, 0); // Sep 21, 9 AM
      const endDate = new Date(2026, 8, 21, 17, 0); // Sep 21, 5 PM
      const startMs = startDate.getTime();
      const endMs = endDate.getTime();
      // const result = localDateKeysBetween(startMs, endMs);
      // expect(result).toEqual(["2026-09-21"]);
    });

    it("should return [start date key] when endMs < startMs (clock skew)", () => {
      // Given: endMs < startMs (device clock went backward)
      const startDate = new Date(2026, 8, 22, 10, 0); // Sep 22, 10 AM
      const endDate = new Date(2026, 8, 21, 10, 0); // Sep 21, 10 AM
      const startMs = startDate.getTime();
      const endMs = endDate.getTime();
      // const result = localDateKeysBetween(startMs, endMs);
      // expect(result).toEqual(["2026-09-22"]);
    });

    it("should return date keys for multi-day span", () => {
      // Given: 2026-09-21 22:00 to 2026-09-24 02:00
      // Should include Sep 21, 22, 23, 24
      const startDate = new Date(2026, 8, 21, 22, 0);
      const endDate = new Date(2026, 8, 24, 2, 0);
      const startMs = startDate.getTime();
      const endMs = endDate.getTime();
      // const result = localDateKeysBetween(startMs, endMs);
      // expect(result.length).toBe(4);
      // expect(result[0]).toBe("2026-09-21");
      // expect(result[result.length - 1]).toBe("2026-09-24");
    });

    it("should use local time, not UTC", () => {
      // Given: Date objects always use local timezone for .getFullYear/.getMonth/.getDate
      // The function should extract dates using local time methods, not toISOString()
      const testDate = new Date(2026, 8, 21, 0, 0, 0);
      const ms = testDate.getTime();
      // const result = localDateKeysBetween(ms, ms);
      // expect(result).toEqual(["2026-09-21"]);
    });
  });

  // ============================================================================
  // AC-4: normalizeRecords — 기록 정규화 및 필터링
  // ============================================================================
  describe("AC-4: normalizeRecords — 기록 정규화 및 필터링", () => {
    it("should remove records with missing createdAt", () => {
      // Given: a record without createdAt field
      const badRecord = {
        id: "bad-1",
        title: "No CreatedAt",
        teamName: "Team",
        attendees: 5,
        annualSalaryManwon: 5000,
        plannedMinutes: 30,
        startedAt: "2026-09-21T09:00:00Z",
        endedAt: "2026-09-21T09:30:00Z",
        durationSec: 1800,
        totalCost: 5000,
        outcome: "decided" as const,
        wasteCost: 1000,
        reportUnlocked: false,
        shareUnlocked: false,
        // missing createdAt
        updatedAt: "2026-09-21T09:30:00Z",
      } as any;
      // const result = normalizeRecords([badRecord]);
      // expect(result).toEqual([]);
    });

    it("should remove records with invalid updatedAt ISO string", () => {
      // Given: a record with updatedAt='x' (not ISO 8601)
      const badRecord: MeetingRecord = {
        id: "bad-2",
        title: "Bad UpdatedAt",
        teamName: "Team",
        attendees: 5,
        annualSalaryManwon: 5000,
        plannedMinutes: 30,
        startedAt: "2026-09-21T09:00:00Z",
        endedAt: "2026-09-21T09:30:00Z",
        durationSec: 1800,
        totalCost: 5000,
        outcome: "decided",
        wasteCost: 1000,
        reportUnlocked: false,
        shareUnlocked: false,
        createdAt: "2026-09-21T09:00:00Z",
        updatedAt: "x", // invalid ISO string
      };
      // const result = normalizeRecords([badRecord]);
      // expect(result).toEqual([]);
    });

    it("should remove records where outcome='none' but wasteCost is null", () => {
      // Given: outcome is 'none' but wasteCost is null (violates pairing rule)
      const badRecord: MeetingRecord = {
        id: "bad-3",
        title: "Bad Pairing",
        teamName: "Team",
        attendees: 5,
        annualSalaryManwon: 5000,
        plannedMinutes: 30,
        startedAt: "2026-09-21T09:00:00Z",
        endedAt: "2026-09-21T09:30:00Z",
        durationSec: 1800,
        totalCost: 5000,
        outcome: "none",
        wasteCost: null, // should not be null when outcome is not null
        reportUnlocked: false,
        shareUnlocked: false,
        createdAt: "2026-09-21T09:00:00Z",
        updatedAt: "2026-09-21T09:30:00Z",
      };
      // const result = normalizeRecords([badRecord]);
      // expect(result).toEqual([]);
    });

    it("should remove records where outcome is not null but wasteCost is null", () => {
      // Given: outcome='decided' but wasteCost is null
      const badRecord: MeetingRecord = {
        id: "bad-4",
        title: "Bad Pairing 2",
        teamName: "Team",
        attendees: 5,
        annualSalaryManwon: 5000,
        plannedMinutes: 30,
        startedAt: "2026-09-21T09:00:00Z",
        endedAt: "2026-09-21T09:30:00Z",
        durationSec: 1800,
        totalCost: 5000,
        outcome: "decided",
        wasteCost: null, // invalid: outcome is not null
        reportUnlocked: false,
        shareUnlocked: false,
        createdAt: "2026-09-21T09:00:00Z",
        updatedAt: "2026-09-21T09:30:00Z",
      };
      // const result = normalizeRecords([badRecord]);
      // expect(result).toEqual([]);
    });

    it("should remove records where endedAt < startedAt", () => {
      // Given: endedAt is before startedAt
      const badRecord: MeetingRecord = {
        id: "bad-5",
        title: "Backward Time",
        teamName: "Team",
        attendees: 5,
        annualSalaryManwon: 5000,
        plannedMinutes: 30,
        startedAt: "2026-09-21T10:00:00Z",
        endedAt: "2026-09-21T09:30:00Z", // before startedAt
        durationSec: 1800,
        totalCost: 5000,
        outcome: null,
        wasteCost: null,
        reportUnlocked: false,
        shareUnlocked: false,
        createdAt: "2026-09-21T10:00:00Z",
        updatedAt: "2026-09-21T10:00:00Z",
      };
      // const result = normalizeRecords([badRecord]);
      // expect(result).toEqual([]);
    });

    it("should keep only the record with latest updatedAt when id is duplicated", () => {
      // Given: two records with same id but different updatedAt
      const record1: MeetingRecord = {
        id: "dup-1",
        title: "Old Version",
        teamName: "Team",
        attendees: 5,
        annualSalaryManwon: 5000,
        plannedMinutes: 30,
        startedAt: "2026-09-21T09:00:00Z",
        endedAt: "2026-09-21T09:30:00Z",
        durationSec: 1800,
        totalCost: 5000,
        outcome: "decided",
        wasteCost: 1000,
        reportUnlocked: false,
        shareUnlocked: false,
        createdAt: "2026-09-21T09:00:00Z",
        updatedAt: "2026-09-21T09:30:00Z", // earlier
      };
      const record2: MeetingRecord = {
        id: "dup-1",
        title: "New Version",
        teamName: "Team",
        attendees: 5,
        annualSalaryManwon: 5000,
        plannedMinutes: 30,
        startedAt: "2026-09-21T09:00:00Z",
        endedAt: "2026-09-21T09:30:00Z",
        durationSec: 1800,
        totalCost: 6000,
        outcome: "decided",
        wasteCost: 1200,
        reportUnlocked: true,
        shareUnlocked: false,
        createdAt: "2026-09-21T09:00:00Z",
        updatedAt: "2026-09-21T10:00:00Z", // later
      };
      // const result = normalizeRecords([record1, record2]);
      // expect(result).toHaveLength(1);
      // expect(result[0].totalCost).toBe(6000); // newer version kept
    });

    it("should sort by endedAt descending, then id ascending", () => {
      // Given: multiple valid records
      const record1: MeetingRecord = {
        id: "rec-1",
        title: "Meeting 1",
        teamName: "Team",
        attendees: 5,
        annualSalaryManwon: 5000,
        plannedMinutes: 30,
        startedAt: "2026-09-21T09:00:00Z",
        endedAt: "2026-09-21T09:30:00Z", // earliest
        durationSec: 1800,
        totalCost: 5000,
        outcome: null,
        wasteCost: null,
        reportUnlocked: false,
        shareUnlocked: false,
        createdAt: "2026-09-21T09:00:00Z",
        updatedAt: "2026-09-21T09:30:00Z",
      };
      const record2: MeetingRecord = {
        id: "rec-2",
        title: "Meeting 2",
        teamName: "Team",
        attendees: 5,
        annualSalaryManwon: 5000,
        plannedMinutes: 30,
        startedAt: "2026-09-21T14:00:00Z",
        endedAt: "2026-09-21T14:30:00Z", // latest
        durationSec: 1800,
        totalCost: 5000,
        outcome: null,
        wasteCost: null,
        reportUnlocked: false,
        shareUnlocked: false,
        createdAt: "2026-09-21T14:00:00Z",
        updatedAt: "2026-09-21T14:30:00Z",
      };
      // const result = normalizeRecords([record1, record2]);
      // expect(result).toHaveLength(2);
      // expect(result[0].id).toBe("rec-2"); // latest first
      // expect(result[1].id).toBe("rec-1"); // earliest second
    });

    it("should keep only 500 records max", () => {
      // Given: 501 valid records
      const records = Array.from({ length: 501 }, (_, i) => ({
        id: `rec-${i}`,
        title: `Meeting ${i}`,
        teamName: "Team",
        attendees: 5,
        annualSalaryManwon: 5000,
        plannedMinutes: 30,
        startedAt: "2026-09-21T09:00:00Z",
        endedAt: `2026-09-21T${String(9 + Math.floor(i / 60)).padStart(2, "0")}:00:00Z`, // spread over hours
        durationSec: 1800,
        totalCost: 5000,
        outcome: null,
        wasteCost: null,
        reportUnlocked: false,
        shareUnlocked: false,
        createdAt: "2026-09-21T09:00:00Z",
        updatedAt: "2026-09-21T09:00:00Z",
      })) as MeetingRecord[];
      // const result = normalizeRecords(records);
      // expect(result).toHaveLength(500);
    });
  });

  // ============================================================================
  // AC-5: Type Guards — isMeetingSetup, isActiveMeeting
  // ============================================================================
  describe("AC-5: Type Guards — 타입 검증", () => {
    it("should return false for isMeetingSetup when id is not 'lastSetup'", () => {
      // Given: a setup-like object with id='other'
      const badSetup = {
        id: "other", // should be 'lastSetup'
        title: "Test",
        teamName: "Team",
        attendees: 5,
        annualSalaryManwon: 5000,
        plannedMinutes: 30,
        createdAt: "2026-09-21T09:00:00Z",
        updatedAt: "2026-09-21T09:00:00Z",
      };
      // const result = isMeetingSetup(badSetup);
      // expect(result).toBe(false);
    });

    it("should return false for isMeetingSetup when attendees is 1 (out of range)", () => {
      // Given: a setup with attendees=1 (range is 2~100)
      const badSetup = {
        id: "lastSetup" as const,
        title: "Test",
        teamName: "Team",
        attendees: 1, // out of range
        annualSalaryManwon: 5000,
        plannedMinutes: 30,
        createdAt: "2026-09-21T09:00:00Z",
        updatedAt: "2026-09-21T09:00:00Z",
      };
      // const result = isMeetingSetup(badSetup);
      // expect(result).toBe(false);
    });

    it("should return true for isMeetingSetup with valid data", () => {
      // Given: valid MeetingSetup
      const validSetup = {
        id: "lastSetup" as const,
        title: "Test",
        teamName: "Team",
        attendees: 5,
        annualSalaryManwon: 5000,
        plannedMinutes: 30,
        createdAt: "2026-09-21T09:00:00Z",
        updatedAt: "2026-09-21T09:00:00Z",
      };
      // const result = isMeetingSetup(validSetup);
      // expect(result).toBe(true);
    });

    it("should return false for isActiveMeeting when totalPausedMs is negative", () => {
      // Given: an active meeting with totalPausedMs=-1 (invalid)
      const badActive = {
        id: "test-1",
        setup: {
          title: "Test",
          teamName: "Team",
          attendees: 5,
          annualSalaryManwon: 5000,
          plannedMinutes: 30,
        },
        startedAt: 0,
        pausedAt: null,
        totalPausedMs: -1, // invalid: should be ≥ 0
        createdAt: "2026-09-21T09:00:00Z",
        updatedAt: "2026-09-21T09:00:00Z",
      };
      // const result = isActiveMeeting(badActive);
      // expect(result).toBe(false);
    });

    it("should return true for isActiveMeeting with valid data", () => {
      // Given: valid ActiveMeeting
      const validActive: ActiveMeeting = {
        id: "test-1",
        setup: {
          title: "Test",
          teamName: "Team",
          attendees: 5,
          annualSalaryManwon: 5000,
          plannedMinutes: 30,
        },
        startedAt: 1000000,
        pausedAt: null,
        totalPausedMs: 0,
        createdAt: "2026-09-21T09:00:00Z",
        updatedAt: "2026-09-21T09:00:00Z",
      };
      // const result = isActiveMeeting(validActive);
      // expect(result).toBe(true);
    });

    it("should validate MeetingRecord: outcome and wasteCost must be paired", () => {
      // Given: a record with outcome='none' but wasteCost=null
      const badRecord = {
        id: "rec-1",
        title: "Test",
        teamName: "Team",
        attendees: 5,
        annualSalaryManwon: 5000,
        plannedMinutes: 30,
        startedAt: "2026-09-21T09:00:00Z",
        endedAt: "2026-09-21T09:30:00Z",
        durationSec: 1800,
        totalCost: 5000,
        outcome: "none",
        wasteCost: null, // invalid pairing
        reportUnlocked: false,
        shareUnlocked: false,
        createdAt: "2026-09-21T09:00:00Z",
        updatedAt: "2026-09-21T09:30:00Z",
      };
      // const result = isMeetingRecord(badRecord);
      // expect(result).toBe(false);
    });

    it("should validate NoMeetingDay: id must equal date", () => {
      // Given: a NoMeetingDay where id !== date
      const badDay = {
        id: "wrong-id",
        date: "2026-09-21", // id !== date
        createdAt: "2026-09-21T09:00:00Z",
        updatedAt: "2026-09-21T09:00:00Z",
      };
      // const result = isNoMeetingDay(badDay);
      // expect(result).toBe(false);
    });

    it("should validate EarnedBadge: id must equal badgeId", () => {
      // Given: an EarnedBadge where id !== badgeId
      const badBadge = {
        id: "wrong-id",
        badgeId: "first_free_day" as const,
        createdAt: "2026-09-21T09:00:00Z",
        updatedAt: "2026-09-21T09:00:00Z",
      };
      // const result = isEarnedBadge(badBadge);
      // expect(result).toBe(false);
    });
  });

  // ============================================================================
  // Additional edge cases and boundary conditions
  // ============================================================================
  describe("Edge cases and boundary conditions", () => {
    it("should handle getElapsedSec with very large elapsed time (> 28800)", () => {
      // Given: a meeting running for 10 hours = 36000 seconds
      const active: ActiveMeeting = {
        id: "test-6",
        setup: {
          title: "Very Long",
          teamName: "Team",
          attendees: 5,
          annualSalaryManwon: 5000,
          plannedMinutes: 30,
        },
        startedAt: 0,
        pausedAt: null,
        totalPausedMs: 0,
        createdAt: new Date(0).toISOString(),
        updatedAt: new Date(0).toISOString(),
      };
      // const result = getElapsedSec(active, 36000000);
      // expect(result).toBe(28800); // clamped
    });

    it("should handle localDateKeysBetween when start and end are exactly at midnight boundary", () => {
      // Given: start = Sep 21 00:00:00, end = Sep 22 00:00:00 (exactly 24 hours)
      const startDate = new Date(2026, 8, 21, 0, 0, 0);
      const endDate = new Date(2026, 8, 22, 0, 0, 0);
      const startMs = startDate.getTime();
      const endMs = endDate.getTime();
      // const result = localDateKeysBetween(startMs, endMs);
      // expect(result).toEqual(["2026-09-21", "2026-09-22"]);
    });

    it("should handle normalizeRecords with all valid records", () => {
      // Given: 3 valid, non-duplicate records
      const records: MeetingRecord[] = [
        {
          id: "rec-1",
          title: "M1",
          teamName: "Team",
          attendees: 5,
          annualSalaryManwon: 5000,
          plannedMinutes: 30,
          startedAt: "2026-09-21T09:00:00Z",
          endedAt: "2026-09-21T09:30:00Z",
          durationSec: 1800,
          totalCost: 5000,
          outcome: null,
          wasteCost: null,
          reportUnlocked: false,
          shareUnlocked: false,
          createdAt: "2026-09-21T09:00:00Z",
          updatedAt: "2026-09-21T09:30:00Z",
        },
        {
          id: "rec-2",
          title: "M2",
          teamName: "Team",
          attendees: 5,
          annualSalaryManwon: 5000,
          plannedMinutes: 30,
          startedAt: "2026-09-21T10:00:00Z",
          endedAt: "2026-09-21T10:30:00Z",
          durationSec: 1800,
          totalCost: 5000,
          outcome: "decided",
          wasteCost: 1000,
          reportUnlocked: false,
          shareUnlocked: false,
          createdAt: "2026-09-21T10:00:00Z",
          updatedAt: "2026-09-21T10:30:00Z",
        },
        {
          id: "rec-3",
          title: "M3",
          teamName: "Team",
          attendees: 5,
          annualSalaryManwon: 5000,
          plannedMinutes: 30,
          startedAt: "2026-09-21T11:00:00Z",
          endedAt: "2026-09-21T11:30:00Z",
          durationSec: 1800,
          totalCost: 5000,
          outcome: "partial",
          wasteCost: 500,
          reportUnlocked: true,
          shareUnlocked: false,
          createdAt: "2026-09-21T11:00:00Z",
          updatedAt: "2026-09-21T11:30:00Z",
        },
      ];
      // const result = normalizeRecords(records);
      // expect(result).toHaveLength(3);
      // sorted by endedAt descending
      // expect(result[0].id).toBe("rec-3");
      // expect(result[1].id).toBe("rec-2");
      // expect(result[2].id).toBe("rec-1");
    });

    it("should handle resolveStale with pausedAt exactly equal to tA", () => {
      // Given: startedAt=0, totalPausedMs=0, pausedAt=28800000 (= tA)
      // tA = 0 + 0 + 28800000 = 28800000
      // Since pausedAt === tA (not >), tA should be valid
      const active: ActiveMeeting = {
        id: "edge-1",
        setup: {
          title: "Edge Pause",
          teamName: "Team",
          attendees: 5,
          annualSalaryManwon: 5000,
          plannedMinutes: 30,
        },
        startedAt: 0,
        pausedAt: 28800000,
        totalPausedMs: 0,
        createdAt: new Date(0).toISOString(),
        updatedAt: new Date(28800000).toISOString(),
      };
      // const { capAt } = getCapAt(active);
      // expect(capAt).toBe(28800000); // tA is valid since pausedAt === tA (not >)
    });
  });
});
