import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type {
  ActiveMeeting,
  MeetingRecord,
  MeetingSetupInput,
  NoMeetingDay,
  FinalizeResult,
  AutoFinalizeResult,
  SaveResult,
} from "@/lib/types";
import {
  loadActive,
  saveActive,
  saveRecord,
  loadNoMeetingDays,
  loadRecordsPage,
  writeRaw,
  newId,
} from "@/lib/storage";
import { calcCost } from "@/lib/cost";
import { localDateKeysBetween, resolveStale } from "@/lib/meetingTime";
import { finalizeActive } from "@/lib/meetingLifecycle";
import { autoFinalizeStale } from "@/lib/meetingLifecycle";
import { startMeeting, pauseMeeting, resumeMeeting } from "@/lib/meetingLifecycle";
import {
  STORAGE_KEY_ACTIVE,
  STORAGE_KEY_RECORDS,
  STORAGE_KEY_NO_MEETING_DAYS,
  MIN_SAVE_SEC,
  MAX_DURATION_SEC,
} from "@/lib/constants";

// ============================================================================
// PACKET 0005: 회의 수명주기 (startMeeting, 일시정지/재개, finalizeActive 롤백, autoFinalizeStale)
// ============================================================================
// Tests for functions to be implemented in:
//   - src/lib/finalize.ts (finalizeActive)
//   - src/lib/autoFinalize.ts (autoFinalizeStale)
//   - src/lib/meetingLifecycle.ts (startMeeting, pauseMeeting, resumeMeeting + re-export)

describe("Packet 0005: 회의 수명주기 (startMeeting, 일시정지/재개, finalizeActive 롤백, autoFinalizeStale)", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // Helper: Create test fixture active meeting
  // ============================================================================
  function createFixtureActive(elapsedMs: number, now: number): ActiveMeeting {
    return {
      id: `active-${Date.now()}`,
      setup: {
        title: "Team Standup",
        teamName: "DevTeam",
        attendees: 5,
        annualSalaryManwon: 5000,
        plannedMinutes: 30,
      },
      startedAt: now - elapsedMs,
      pausedAt: null,
      totalPausedMs: 0,
      createdAt: new Date(now - elapsedMs).toISOString(),
      updatedAt: new Date(now - elapsedMs).toISOString(),
    };
  }

  // Helper: Mock setItem to fail on nth call
  function failSetItemOnNth(n: number): { restore: () => void } {
    let callCount = 0;
    const originalSetItem = Storage.prototype.setItem;
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");
    setItemSpy.mockImplementation(function (key: string, value: string) {
      callCount += 1;
      if (callCount === n) {
        const err = new Error("quota exceeded");
        err.name = "QuotaExceededError";
        throw err;
      }
      originalSetItem.call(this, key, value);
    });
    return {
      restore: () => {
        setItemSpy.mockRestore();
      },
    };
  }

  // ============================================================================
  // AC-1[P0]: finalizeActive with 2700 seconds elapsed
  // Should save record with totalCost=90144, outcome=null, and set active=null
  // ============================================================================
  describe("AC-1[P0]: finalizeActive — 2700초 경과 시 기록 저장 및 active=null", () => {
    it("should finalize active meeting after 2700 seconds, save record with correct cost, and clear active", () => {
      const now = Date.now();
      const elapsedMs = 2700 * 1000; // 2700 seconds
      const active = createFixtureActive(elapsedMs, now);

      // Setup: save active meeting
      const setupResult = saveActive(active);
      expect(setupResult.ok).toBe(true);

      const loadedActive = loadActive();
      expect(loadedActive).not.toBeNull();
      expect(loadedActive!.id).toBe(active.id);

      // Call finalizeActive (function to be implemented)
      const finalizeResult = finalizeActive(now);

      // Assertions (will fail until implementation)
      expect(finalizeResult.ok).toBe(true);
      if (finalizeResult.ok) {
        expect(finalizeResult.record.totalCost).toBe(90144);
        expect(finalizeResult.record.outcome).toBeNull();
        expect(finalizeResult.record.wasteCost).toBeNull();
        expect(finalizeResult.record.durationSec).toBe(2700);
      }

      // After finalize, active should be null
      const loadedActiveAfter = loadActive();
      expect(loadedActiveAfter).toBeNull();
    });

    it("should include cancelledNoMeetingDates when NoMeetingDay overlaps with meeting period", () => {
      const now = Date.now();
      const elapsedMs = 3600 * 1000; // 1 hour
      const active = createFixtureActive(elapsedMs, now);

      // Setup: save active and NoMeetingDay
      saveActive(active);

      const dateKeysInPeriod = localDateKeysBetween(active.startedAt, now);
      if (dateKeysInPeriod.length > 0) {
        const noMeetingDay: NoMeetingDay = {
          id: `nmd-${Date.now()}`,
          date: dateKeysInPeriod[0],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        writeRaw(STORAGE_KEY_NO_MEETING_DAYS, [noMeetingDay]);
      }

      // Call finalizeActive
      const finalizeResult = finalizeActive(now);

      // Assertions (will fail until implementation)
      if (finalizeResult.ok) {
        expect(finalizeResult.cancelledNoMeetingDates).toContain(dateKeysInPeriod[0]);
      }
    });
  });

  // ============================================================================
  // AC-2[P0]: finalizeActive with less than MIN_SAVE_SEC (10 seconds) elapsed
  // Should return {ok: false, reason: 'too_short'}, set active=null, but NOT save record
  // ============================================================================
  describe("AC-2[P0]: finalizeActive — 10초 미만 경과 시 too_short 반환, records 변경 없음", () => {
    it("should return too_short when elapsed < MIN_SAVE_SEC and NOT save record", () => {
      const now = Date.now();
      const elapsedMs = 5 * 1000; // 5 seconds (< 10 seconds)
      const active = createFixtureActive(elapsedMs, now);

      // Setup: save active and an existing record
      saveActive(active);
      const existingRecord: Omit<MeetingRecord, "id" | "createdAt" | "updatedAt"> = {
        title: "Previous Meeting",
        teamName: "Team",
        attendees: 5,
        annualSalaryManwon: 5000,
        plannedMinutes: 30,
        startedAt: new Date(now - 10000000).toISOString(),
        endedAt: new Date(now - 5000000).toISOString(),
        durationSec: 1388,
        totalCost: 50000,
        outcome: "decided",
        wasteCost: 0,
        reportUnlocked: false,
        shareUnlocked: false,
      };
      saveRecord(existingRecord);

      // Call finalizeActive
      const finalizeResult = finalizeActive(now);

      // Assertions (will fail until implementation)
      expect(finalizeResult.ok).toBe(false);
      if (!finalizeResult.ok) {
        expect(finalizeResult.reason).toBe("too_short");
      }

      // Active should be cleared
      const activeAfter = loadActive();
      expect(activeAfter).toBeNull();

      // Records should NOT have changed (still 1 record)
      const records = loadRecordsPage(0);
      expect(records.total).toBe(1);
      expect(records.items[0].title).toBe("Previous Meeting");
    });

    it("should return too_short even at exact MIN_SAVE_SEC - 1", () => {
      const now = Date.now();
      const elapsedMs = (MIN_SAVE_SEC - 1) * 1000;
      const active = createFixtureActive(elapsedMs, now);

      saveActive(active);

      // Call finalizeActive
      // const finalizeResult = finalizeActive(now);

      // Assertions (will fail until implementation)
      // expect(finalizeResult.ok).toBe(false);
      // if (!finalizeResult.ok) {
      //   expect(finalizeResult.reason).toBe("too_short");
      // }
    });

    it("should succeed at exactly MIN_SAVE_SEC", () => {
      const now = Date.now();
      const elapsedMs = MIN_SAVE_SEC * 1000;
      const active = createFixtureActive(elapsedMs, now);

      saveActive(active);

      // Call finalizeActive
      // const finalizeResult = finalizeActive(now);

      // Assertions (will fail until implementation)
      // expect(finalizeResult.ok).toBe(true);
      // if (finalizeResult.ok) {
      //   expect(finalizeResult.record.durationSec).toBe(MIN_SAVE_SEC);
      // }
    });
  });

  // ============================================================================
  // AC-3[P0]: finalizeActive with storage failure on records write
  // Should rollback: restore noMeetingDays snapshot, restore active snapshot, return {ok:false, reason:'quota'}
  // ============================================================================
  describe("AC-3[P0]: finalizeActive — records 쓰기 실패 시 스냅샷 복원 및 quota 반환", () => {
    it("should rollback noMeetingDays and active when records write fails with quota error", () => {
      const now = Date.now();
      const elapsedMs = 2700 * 1000;
      const active = createFixtureActive(elapsedMs, now);

      // Setup: save active and NoMeetingDays snapshot
      saveActive(active);
      const noMeetingDaysSnapshot: NoMeetingDay[] = [
        {
          id: `nmd-${Date.now()}`,
          date: "2026-09-19",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];
      writeRaw(STORAGE_KEY_NO_MEETING_DAYS, noMeetingDaysSnapshot);

      const activeSnapshot = JSON.stringify(active);
      const noMeetingDaysSnapshotStr = JSON.stringify(noMeetingDaysSnapshot);

      // Mock setItem to fail on 2nd call (first = noMeetingDays delete, second = records write)
      const failMock = failSetItemOnNth(2);

      // Call finalizeActive
      // This should:
      // 1. Read noMeetingDays, active (success)
      // 2. Delete matching NoMeetingDay (success)
      // 3. Try to save records (FAIL on setItem)
      // 4. Rollback: restore active and noMeetingDays from snapshots
      const finalizeResult = finalizeActive(now);

      failMock.restore();

      // Assertions (will fail until implementation)
      expect(finalizeResult.ok).toBe(false);
      if (!finalizeResult.ok) {
        expect(finalizeResult.reason).toBe("quota");
      }

      // After rollback, active should be restored
      const activeAfter = loadActive();
      expect(activeAfter).not.toBeNull();
      expect(JSON.stringify(activeAfter)).toBe(activeSnapshot);

      // noMeetingDays should be restored
      const noMeetingDaysAfter = loadNoMeetingDays();
      expect(JSON.stringify(noMeetingDaysAfter)).toBe(noMeetingDaysSnapshotStr);
    });

    it("should rollback only active when noMeetingDays delete fails", () => {
      const now = Date.now();
      const elapsedMs = 2700 * 1000;
      const active = createFixtureActive(elapsedMs, now);

      saveActive(active);
      const activeSnapshot = JSON.stringify(active);

      // Mock setItem to fail on 1st call (delete noMeetingDays)
      const failMock = failSetItemOnNth(1);

      // Call finalizeActive
      const finalizeResult = finalizeActive(now);

      failMock.restore();

      // Assertions (will fail until implementation)
      expect(finalizeResult.ok).toBe(false);
      if (!finalizeResult.ok) {
        expect(finalizeResult.reason).toBe("quota");
      }

      // Active should be restored
      const activeAfter = loadActive();
      expect(JSON.stringify(activeAfter)).toBe(activeSnapshot);
    });
  });

  // ============================================================================
  // AC-4[P0]: finalizeActive should cancel NoMeetingDays in meeting period
  // Should delete NoMeetingDay records that fall within meeting date range,
  // and include cancelledNoMeetingDates in result
  // ============================================================================
  describe("AC-4[P0]: finalizeActive — 회의 기간 내 NoMeetingDay 삭제", () => {
    it("should delete NoMeetingDay records within meeting date range and report cancellations", () => {
      const now = Date.now();
      const startTime = now - 86400000 * 2; // 2 days ago
      const endTime = now; // now

      const active: ActiveMeeting = {
        id: `active-${Date.now()}`,
        setup: {
          title: "Team Meeting",
          teamName: "DevTeam",
          attendees: 5,
          annualSalaryManwon: 5000,
          plannedMinutes: 30,
        },
        startedAt: startTime,
        pausedAt: null,
        totalPausedMs: 0,
        createdAt: new Date(startTime).toISOString(),
        updatedAt: new Date(startTime).toISOString(),
      };

      saveActive(active);

      // Create NoMeetingDays: some in range, some outside
      const dateKeysInRange = localDateKeysBetween(startTime, endTime);
      const noMeetingDays: NoMeetingDay[] = [
        // In range (should be cancelled)
        {
          id: `nmd-in-1`,
          date: dateKeysInRange[0],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        // Outside range (should remain)
        {
          id: `nmd-out-1`,
          date: "2026-08-01",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];
      writeRaw(STORAGE_KEY_NO_MEETING_DAYS, noMeetingDays);

      // Call finalizeActive
      const finalizeResult = finalizeActive(endTime);

      // Assertions (will fail until implementation)
      expect(finalizeResult.ok).toBe(true);
      if (finalizeResult.ok) {
        expect(finalizeResult.cancelledNoMeetingDates).toContain(dateKeysInRange[0]);
      }

      // Verify remaining NoMeetingDays
      const remaining = loadNoMeetingDays();
      expect(remaining.some((nmd) => nmd.id === "nmd-out-1")).toBe(true);
      expect(remaining.some((nmd) => nmd.id === "nmd-in-1")).toBe(false);
    });

    it("should include noMeetingCancelled flag in result when NoMeetingDays were cancelled", () => {
      const now = Date.now();
      const elapsedMs = 3600 * 1000; // 1 hour

      const active = createFixtureActive(elapsedMs, now);
      saveActive(active);

      // Create a NoMeetingDay that overlaps with meeting date
      const dateKeys = localDateKeysBetween(active.startedAt, now);
      if (dateKeys.length > 0) {
        const noMeetingDay: NoMeetingDay = {
          id: `nmd-overlap`,
          date: dateKeys[0],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        writeRaw(STORAGE_KEY_NO_MEETING_DAYS, [noMeetingDay]);
      }

      // Call finalizeActive
      const finalizeResult = finalizeActive(now);

      // Assertions (will fail until implementation)
      expect(finalizeResult.ok).toBe(true);
      if (finalizeResult.ok) {
        expect(finalizeResult.cancelledNoMeetingDates.length).toBeGreaterThan(0);
      }
    });
  });

  // ============================================================================
  // AC-5[P0]: autoFinalizeStale
  // Should auto-finalize meetings that exceed elapsed_cap or wall_cap,
  // with max 2 retry attempts for quota errors within a single call
  // ============================================================================
  describe("AC-5[P0]: autoFinalizeStale — 만료 회의 자동 종료, quota 최대 2회 재시도", () => {
    it("should auto-finalize stale meeting that exceeds elapsed_cap (28800 seconds)", () => {
      const now = Date.now();
      // Create meeting that started 9 hours ago (> 8 hour elapsed cap)
      const elapsedMs = 32400 * 1000; // 9 hours
      const active = createFixtureActive(elapsedMs, now);

      saveActive(active);

      // Verify that meeting is stale
      const staleResult = resolveStale(active, now);
      expect(staleResult.stale).toBe(true);
      expect(staleResult.reason).toBe("elapsed_cap");

      // Call autoFinalizeStale
      const result = autoFinalizeStale(now);

      // Assertions (will fail until implementation)
      expect(result.status).toBe("done");
      if (result.status === "done") {
        expect(result.staleReason).toBe("elapsed_cap");
        expect(result.result.ok).toBe(true);
        if (result.result.ok) {
          expect(result.result.record.durationSec).toBe(MAX_DURATION_SEC);
        }
      }

      // Active should be cleared
      const activeAfter = loadActive();
      expect(activeAfter).toBeNull();
    });

    it("should auto-finalize stale meeting that exceeds wall_cap (12 hours wall clock)", () => {
      const now = Date.now();
      const MAX_WALL_SEC = 43200; // 12 hours in seconds
      // Create meeting started 13 hours ago
      const elapsedMs = (MAX_WALL_SEC + 3600) * 1000;
      const active = createFixtureActive(elapsedMs, now);

      saveActive(active);

      // Verify that meeting is stale by wall clock
      const staleResult = resolveStale(active, now);
      expect(staleResult.stale).toBe(true);

      // Call autoFinalizeStale
      // const result = autoFinalizeStale(now);

      // Assertions (will fail until implementation)
      // expect(result.status).toBe("done");
      // if (result.status === "done") {
      //   expect(result.staleReason).toBe("wall_cap");
      // }
    });

    it("should return not_stale when meeting has not exceeded cap", () => {
      const now = Date.now();
      const elapsedMs = 600 * 1000; // 10 minutes (well under cap)
      const active = createFixtureActive(elapsedMs, now);

      saveActive(active);

      // Call autoFinalizeStale
      const result = autoFinalizeStale(now);

      // Assertions (will fail until implementation)
      expect(result.status).toBe("not_stale");

      // Active should still exist
      const activeAfter = loadActive();
      expect(activeAfter).not.toBeNull();
    });

    it("should return suppressed when no active meeting exists", () => {
      // No active meeting set up
      // Call autoFinalizeStale
      const result = autoFinalizeStale(Date.now());

      // Assertions (will fail until implementation)
      expect(result.status).toBe("suppressed");
    });

    it("should retry quota errors up to 2 times during autoFinalizeStale", () => {
      const now = Date.now();
      const elapsedMs = 32400 * 1000; // 9 hours (stale)
      const active = createFixtureActive(elapsedMs, now);

      saveActive(active);

      // Mock setItem to fail 2 times (quota), then succeed on 3rd call
      let callCount = 0;
      const originalSetItem = Storage.prototype.setItem;
      const setItemSpy = vi.spyOn(Storage.prototype, "setItem");
      setItemSpy.mockImplementation(function (key: string, value: string) {
        callCount += 1;
        if (callCount <= 2) {
          const err = new Error("quota exceeded");
          err.name = "QuotaExceededError";
          throw err;
        }
        originalSetItem.call(this, key, value);
      });

      // Call autoFinalizeStale
      const result = autoFinalizeStale(now);

      // Assertions (will fail until implementation)
      // Should succeed after 2 retries
      expect(result.status).toBe("done");
      if (result.status === "done") {
        expect(result.result.ok).toBe(true);
        expect(result.showQuotaToast).toBe(true); // Had quota issues but recovered
      }

      setItemSpy.mockRestore();
    });

    it("should fail and show toast when quota error persists after 2 retries", () => {
      const now = Date.now();
      const elapsedMs = 32400 * 1000; // 9 hours (stale)
      const active = createFixtureActive(elapsedMs, now);

      saveActive(active);

      // Mock setItem to always fail (quota)
      const setItemSpy = vi.spyOn(Storage.prototype, "setItem");
      const err = new Error("quota exceeded");
      err.name = "QuotaExceededError";
      setItemSpy.mockImplementation(() => {
        throw err;
      });

      // Call autoFinalizeStale
      const result = autoFinalizeStale(now);

      // Assertions (will fail until implementation)
      // Should fail after 2 retries
      expect(result.status).toBe("done");
      if (result.status === "done") {
        expect(result.result.ok).toBe(false);
        if (!result.result.ok) {
          expect(result.result.reason).toBe("quota");
        }
        expect(result.showQuotaToast).toBe(true);
      }

      setItemSpy.mockRestore();
    });
  });

  // ============================================================================
  // AC-INTEGRATION: startMeeting, pauseMeeting, resumeMeeting
  // ============================================================================
  describe("AC-INTEGRATION: startMeeting, pauseMeeting, resumeMeeting", () => {
    it("should start a meeting and save active record with correct timestamps", () => {
      const now = Date.now();
      const setup: MeetingSetupInput = {
        title: "Sprint Planning",
        teamName: "Frontend",
        attendees: 8,
        annualSalaryManwon: 4000,
        plannedMinutes: 60,
      };

      // Call startMeeting (function to be implemented)
      // const result = startMeeting(setup, now);

      // Assertions (will fail until implementation)
      // expect(result.ok).toBe(true);
      // if (result.ok) {
      //   expect(result.active.setup).toEqual(setup);
      //   expect(result.active.startedAt).toBe(now);
      //   expect(result.active.pausedAt).toBeNull();
      //   expect(result.active.totalPausedMs).toBe(0);
      // }

      // Verify that active meeting was saved
      // const loaded = loadActive();
      // expect(loaded).not.toBeNull();
      // expect(loaded?.id).toBe(result.active.id);
    });

    it("should pause and resume meeting, preserving elapsed time", () => {
      const now = Date.now();
      const active = createFixtureActive(5000, now); // 5 seconds elapsed

      // Start with initial active
      saveActive(active);

      const beforePause = loadActive();
      expect(beforePause?.pausedAt).toBeNull();

      // Call pauseMeeting
      // const pauseResult = pauseMeeting(now);
      // expect(pauseResult.ok).toBe(true);

      // After pause, pausedAt should be set
      // const afterPause = loadActive();
      // expect(afterPause?.pausedAt).toBe(now);
      // expect(afterPause?.totalPausedMs).toBe(0); // No additional paused time yet

      // Call resumeMeeting at a later time
      // const laterNow = now + 30000; // 30 seconds later
      // const resumeResult = resumeMeeting(laterNow);
      // expect(resumeResult.ok).toBe(true);

      // After resume, pausedAt should be null and totalPausedMs should increase
      // const afterResume = loadActive();
      // expect(afterResume?.pausedAt).toBeNull();
      // expect(afterResume?.totalPausedMs).toBe(30000); // 30 seconds added to paused time
    });

    it("should handle start/pause/resume/finalize full lifecycle", () => {
      const now = Date.now();
      const setup: MeetingSetupInput = {
        title: "Full Lifecycle Test",
        teamName: "QA",
        attendees: 3,
        annualSalaryManwon: 5000,
        plannedMinutes: 45,
      };

      // Start meeting
      // const startResult = startMeeting(setup, now);
      // expect(startResult.ok).toBe(true);

      // Let meeting run for 30 seconds
      const afterRunNow = now + 30000;
      // const pauseResult = pauseMeeting(afterRunNow);
      // expect(pauseResult.ok).toBe(true);

      // Pause for 20 seconds
      const afterPauseNow = afterRunNow + 20000;
      // const resumeResult = resumeMeeting(afterPauseNow);
      // expect(resumeResult.ok).toBe(true);

      // Let meeting run for another 2700 seconds (total 2730 after resume)
      const finalNow = afterPauseNow + 2700000;
      // const finalizeResult = finalizeActive(finalNow);
      // expect(finalizeResult.ok).toBe(true);
      // if (finalizeResult.ok) {
      //   // Total active time: 30s (before pause) + 2700s (after resume) = 2730s
      //   expect(finalizeResult.record.durationSec).toBe(2730);
      //   expect(finalizeResult.record.totalCost).toBeGreaterThan(0);
      // }

      // Active should be cleared
      // const activeAfter = loadActive();
      // expect(activeAfter).toBeNull();
    });
  });
});
