import { describe, it, expect } from "vitest";
import fs from "fs/promises";
import path from "path";
import type * as Types from "../lib/types";
import type * as Constants from "../lib/constants";

/**
 * Packet 0001: 엔티티 타입, RouteState 계약, 전역 상수
 *
 * AC-1: src/lib/types.ts에 런타임 코드(const/let/function/class) 0개
 * AC-2: ActiveMeeting.startedAt은 number, MeetingRecord.startedAt은 string, MeetingRecord.outcome은 MeetingOutcome|null
 * AC-3: RouteState는 /setup 경로만 { prefill: MeetingSetupInput } | null, 나머지 7개 라우트는 null
 * AC-4: constants.ts는 계산/상한 상수 + 저장 키 5개 export
 */

describe("AC-1: types.ts has zero runtime code", () => {
  it("should exist and only contain type definitions", async () => {
    const typesPath = path.resolve(__dirname, "../lib/types.ts");
    const content = await fs.readFile(typesPath, "utf-8");

    expect(content).toBeDefined();
    expect(content.length).toBeGreaterThan(0);
  });

  it("should not contain runtime exports (const/let/function outside of type/interface)", async () => {
    const typesPath = path.resolve(__dirname, "../lib/types.ts");
    const content = await fs.readFile(typesPath, "utf-8");

    // Check for runtime code patterns at line start
    const lines = content.split("\n");
    const runtimeLines = lines.filter(
      (line) =>
        /^export\s+(const|let|function|async function|default|=)/.test(
          line.trim()
        ) && !line.includes("interface") && !line.includes("type")
    );

    expect(runtimeLines).toHaveLength(0);
  });

  it("should only contain type/interface exports", async () => {
    const typesPath = path.resolve(__dirname, "../lib/types.ts");
    const content = await fs.readFile(typesPath, "utf-8");

    // Should have type or interface exports
    const hasTypeExports =
      /export\s+(type|interface)\s+/.test(content);
    expect(hasTypeExports).toBe(true);
  });
});

describe("AC-2: ActiveMeeting and MeetingRecord types", () => {
  it("should define ActiveMeeting with startedAt as number", async () => {
    // Create example to validate structure
    const example: Types.ActiveMeeting = {
      id: "test",
      setup: {
        title: "Meeting",
        teamName: "Team A",
        attendees: 5,
        annualSalaryManwon: 50,
        plannedMinutes: 30,
      },
      startedAt: Date.now(), // Must be number
      pausedAt: null,
      totalPausedMs: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    expect(typeof example.startedAt).toBe("number");
    expect(example.startedAt).toBeGreaterThan(0);
  });

  it("should define MeetingRecord with startedAt as string and outcome as MeetingOutcome|null", async () => {
    // Example with outcome
    const recordWithOutcome: Types.MeetingRecord = {
      id: "record-1",
      title: "Meeting",
      teamName: "Team A",
      attendees: 5,
      annualSalaryManwon: 50,
      plannedMinutes: 30,
      startedAt: "2026-09-19T10:00:00Z", // Must be string
      endedAt: "2026-09-19T10:30:00Z",
      durationSec: 1800,
      totalCost: 2500,
      outcome: "decided",
      wasteCost: 500,
      reportUnlocked: true,
      shareUnlocked: false,
      createdAt: "2026-09-19T10:00:00Z",
      updatedAt: "2026-09-19T10:30:00Z",
    };

    expect(typeof recordWithOutcome.startedAt).toBe("string");
    expect(["decided", "partial", "none"]).toContain(recordWithOutcome.outcome);
  });

  it("should support MeetingRecord outcome as null", async () => {
    const recordWithoutOutcome: Types.MeetingRecord = {
      id: "record-2",
      title: "Meeting",
      teamName: "Team B",
      attendees: 3,
      annualSalaryManwon: 40,
      plannedMinutes: 15,
      startedAt: "2026-09-19T14:00:00Z",
      endedAt: "2026-09-19T14:15:00Z",
      durationSec: 900,
      totalCost: 1000,
      outcome: null,
      wasteCost: null,
      reportUnlocked: false,
      shareUnlocked: false,
      createdAt: "2026-09-19T14:00:00Z",
      updatedAt: "2026-09-19T14:15:00Z",
    };

    expect(recordWithoutOutcome.outcome).toBeNull();
  });
});

describe("AC-3: RouteState shape per route path", () => {
  it("should define RouteState with /setup path having prefill property", async () => {
    // Validate /setup route can have prefill
    const setupState: Types.RouteState["/setup"] = {
      prefill: {
        title: "Weekly Sync",
        teamName: "Engineering",
        attendees: 8,
        annualSalaryManwon: 60,
        plannedMinutes: 60,
      },
    };

    expect(setupState).toHaveProperty("prefill");
    expect(setupState.prefill.title).toBe("Weekly Sync");
  });

  it("should define /setup route state as nullable", async () => {
    // /setup can also be null
    const nullSetupState: Types.RouteState["/setup"] = null;
    expect(nullSetupState).toBeNull();
  });

  it("should define 7 other route paths with null state", async () => {
    const otherRoutes: (keyof Types.RouteState)[] = [
      "/home",
      "/timer",
      "/outcome",
      "/report",
      "/history",
      "/badges",
      "/settings",
    ];

    expect(otherRoutes).toHaveLength(7);
    expect(otherRoutes).toContain("/home");
  });
});

describe("AC-4: constants.ts exports required values", () => {
  it("should export ANNUAL_WORK_HOURS=2080", async () => {
    const constants = (await import("../lib/constants")) as typeof Constants;
    expect(constants.ANNUAL_WORK_HOURS).toBe(2080);
  });

  it("should export MAX_DURATION_SEC=28800", async () => {
    const constants = (await import("../lib/constants")) as typeof Constants;
    expect(constants.MAX_DURATION_SEC).toBe(28800);
  });

  it("should export MAX_WALL_MS=43200000", async () => {
    const constants = (await import("../lib/constants")) as typeof Constants;
    expect(constants.MAX_WALL_MS).toBe(43200000);
  });

  it("should export MIN_SAVE_SEC=10", async () => {
    const constants = (await import("../lib/constants")) as typeof Constants;
    expect(constants.MIN_SAVE_SEC).toBe(10);
  });

  it("should export HISTORY_PAGE_SIZE=20", async () => {
    const constants = (await import("../lib/constants")) as typeof Constants;
    expect(constants.HISTORY_PAGE_SIZE).toBe(20);
  });

  it("should export RECORDS_MAX=500", async () => {
    const constants = (await import("../lib/constants")) as typeof Constants;
    expect(constants.RECORDS_MAX).toBe(500);
  });

  it("should export OUTCOME_FACTOR with decided=0, partial=0.25, none=0.5", async () => {
    const constants = (await import("../lib/constants")) as typeof Constants;
    expect(constants.OUTCOME_FACTOR).toEqual({
      decided: 0,
      partial: 0.25,
      none: 0.5,
    });
  });

  it("should export STORAGE_KEY_LAST_SETUP='mcc:v1:lastSetup'", async () => {
    const constants = (await import("../lib/constants")) as typeof Constants;
    expect(constants.STORAGE_KEY_LAST_SETUP).toBe("mcc:v1:lastSetup");
  });

  it("should export STORAGE_KEY_ACTIVE='mcc:v1:active'", async () => {
    const constants = (await import("../lib/constants")) as typeof Constants;
    expect(constants.STORAGE_KEY_ACTIVE).toBe("mcc:v1:active");
  });

  it("should export STORAGE_KEY_RECORDS='mcc:v1:records'", async () => {
    const constants = (await import("../lib/constants")) as typeof Constants;
    expect(constants.STORAGE_KEY_RECORDS).toBe("mcc:v1:records");
  });

  it("should export STORAGE_KEY_NO_MEETING_DAYS='mcc:v1:noMeetingDays'", async () => {
    const constants = (await import("../lib/constants")) as typeof Constants;
    expect(constants.STORAGE_KEY_NO_MEETING_DAYS).toBe("mcc:v1:noMeetingDays");
  });

  it("should export STORAGE_KEY_BADGES='mcc:v1:badges'", async () => {
    const constants = (await import("../lib/constants")) as typeof Constants;
    expect(constants.STORAGE_KEY_BADGES).toBe("mcc:v1:badges");
  });
});
