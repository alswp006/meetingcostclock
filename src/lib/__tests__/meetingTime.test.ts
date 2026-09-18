import { describe, it, expect } from "vitest";
import {
  getElapsedSec,
  getCapAt,
  resolveStale,
  localDateKeysBetween,
} from "@/lib/meetingTime";

const act = (o: Partial<{ startedAt: number; pausedAt: number | null; totalPausedMs: number }>) => ({
  startedAt: 0,
  pausedAt: null,
  totalPausedMs: 0,
  ...o,
});

describe("meetingTime", () => {
  it("getElapsedSec: paused, cap, negative", () => {
    expect(getElapsedSec(act({ startedAt: 1000000, pausedAt: 1060000 }), 1120000)).toBe(60);
    expect(getElapsedSec(act({}), 32400000)).toBe(28800);
    expect(getElapsedSec(act({}), -5000)).toBe(0);
  });

  it("getCapAt/resolveStale reasons", () => {
    expect(getCapAt(act({}))).toEqual({ capAt: 28_800_000, reason: "elapsed_cap" });
    const paused = act({ pausedAt: 1000 });
    expect(getCapAt(paused)).toEqual({ capAt: 43_200_000, reason: "wall_cap" });
    expect(resolveStale(act({}), 28_799_999)).toEqual({ stale: false });
    expect(resolveStale(paused, 50_000_000)).toMatchObject({ stale: true, reason: "wall_cap" });
  });

  it("localDateKeysBetween", () => {
    expect(
      localDateKeysBetween(new Date(2026, 8, 21, 23, 0).getTime(), new Date(2026, 8, 22, 0, 30).getTime()),
    ).toEqual(["2026-09-21", "2026-09-22"]);
    const a = new Date(2026, 8, 21, 9).getTime();
    expect(localDateKeysBetween(a, a + 1000)).toEqual(["2026-09-21"]);
    expect(localDateKeysBetween(a, a - 10 ** 9)).toEqual(["2026-09-21"]);
  });
});
