import { describe, it, expect } from "vitest";
import {
  isMeetingSetup,
  isActiveMeeting,
  normalizeRecords,
  normalizeNoMeetingDays,
  normalizeBadges,
} from "@/lib/schema";

const T = "2026-09-21T01:00:00.000Z";
const setup = { title: "주간", teamName: "플랫폼", attendees: 5, annualSalaryManwon: 5000, plannedMinutes: 30 };
const rec = (o: Record<string, unknown> = {}) => ({
  id: "a", ...setup, startedAt: T, endedAt: "2026-09-21T02:00:00.000Z", durationSec: 3600,
  totalCost: 1000, outcome: "decided", wasteCost: 0, reportUnlocked: false, shareUnlocked: false,
  createdAt: T, updatedAt: T, ...o,
});

describe("schema", () => {
  it("guards", () => {
    const s = { id: "lastSetup", ...setup, createdAt: T, updatedAt: T };
    expect(isMeetingSetup(s)).toBe(true);
    expect(isMeetingSetup({ ...s, id: "other" })).toBe(false);
    expect(isMeetingSetup({ ...s, attendees: 1 })).toBe(false);
    const a = { id: "m", setup, startedAt: 1, pausedAt: null, totalPausedMs: 0, createdAt: T, updatedAt: T };
    expect(isActiveMeeting(a)).toBe(true);
    expect(isActiveMeeting({ ...a, totalPausedMs: -1 })).toBe(false);
  });

  it("normalizeRecords drops invalid, dedupes, sorts", () => {
    const rows = Object.freeze([
      rec(), rec({ id: "no", createdAt: undefined }), rec({ id: "x", updatedAt: "x" }),
      rec({ id: "n", outcome: "none", wasteCost: null }),
      rec({ id: "bad", endedAt: "2026-09-21T00:00:00.000Z" }),
      rec({ id: "a", updatedAt: "2026-09-22T00:00:00.000Z", totalCost: 7 }),
      rec({ id: "b" }),
    ]);
    const out = normalizeRecords(rows);
    expect(out.map((r) => r.id)).toEqual(["a", "b"]);
    expect(out[0].totalCost).toBe(7);
  });

  it("caps at 500", () => {
    const rows = Array.from({ length: 510 }, (_, i) => rec({ id: `id${i}` }));
    expect(normalizeRecords(rows)).toHaveLength(500);
  });

  it("days and badges", () => {
    const d = { id: "2026-09-21", date: "2026-09-21", createdAt: T, updatedAt: T };
    expect(normalizeNoMeetingDays(Object.freeze([d, { ...d, id: "z" }]))).toHaveLength(1);
    const b = { id: "total_5", badgeId: "total_5", createdAt: T, updatedAt: T };
    expect(normalizeBadges(Object.freeze([b, { ...b, id: "x" }]))).toHaveLength(1);
  });
});
