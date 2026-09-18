import { describe, it, expect, vi } from "vitest";
import {
  calcHourly,
  calcCost,
  calcWaste,
} from "@/lib/cost";
import {
  formatWon,
  formatHMS,
  formatMinutes,
  formatMonthDay,
  toLocalDateKey,
} from "@/lib/format";

describe("Packet 0002: 비용 계산, 표시 포맷, 사용자 문구 순수 함수", () => {
  // ============= AC-1: calcHourly 시급 환산 =============
  describe("AC-1: calcHourly — 시급 환산", () => {
    it("should return {perPerson: 24038, team: 120192, perMinute: 2003} for (5, 5000)", () => {
      const result = calcHourly(5, 5000);
      expect(result.perPerson).toBe(24038);
      expect(result.team).toBe(120192);
      expect(result.perMinute).toBe(2003);
    });

    it("should handle edge case: attendees=1, salary=1000", () => {
      const result = calcHourly(1, 1000);
      expect(result.perPerson).toBeGreaterThanOrEqual(0);
      expect(result.team).toBeGreaterThanOrEqual(0);
      expect(result.perMinute).toBeGreaterThanOrEqual(0);
    });
  });

  // ============= AC-2: calcCost 누적 비용 계산 =============
  describe("AC-2: calcCost — 누적 비용 계산", () => {
    it("should return 90144 for calcCost(5, 5000, 2700)", () => {
      const result = calcCost(5, 5000, 2700);
      expect(result).toBe(90144);
    });

    it("should return 0 for calcCost(5, 5000, 0)", () => {
      const result = calcCost(5, 5000, 0);
      expect(result).toBe(0);
    });

    it("should return positive number for calcCost(5, 5000, 1)", () => {
      const result = calcCost(5, 5000, 1);
      expect(result).toBeGreaterThanOrEqual(0);
    });
  });

  // ============= AC-3: calcWaste 낭비 추정 =============
  describe("AC-3: calcWaste — 낭비 추정", () => {
    const fixture = {
      attendees: 5,
      annualSalaryManwon: 5000,
      plannedMinutes: 30,
      durationSec: 2700,
      totalCost: 90144,
    };

    it("should return wasteCost 60096, wasteRate 67 for outcome='none'", () => {
      const result = calcWaste(fixture, "none");
      expect(result.overtimeSec).toBe(900);
      expect(result.overtimeCost).toBe(30048);
      expect(result.wasteCost).toBe(60096);
      expect(result.wasteRate).toBe(67);
    });

    it("should return wasteCost 45072 for outcome='partial'", () => {
      const result = calcWaste(fixture, "partial");
      expect(result.wasteCost).toBe(45072);
      expect(result.wasteRate).toBe(50);
    });

    it("should return wasteCost 30048 for outcome='decided'", () => {
      const result = calcWaste(fixture, "decided");
      expect(result.wasteCost).toBe(30048);
      expect(result.wasteRate).toBe(33);
    });

    it("should return wasteRate 0 when totalCost is 0", () => {
      const zeroResult = calcWaste(
        { ...fixture, totalCost: 0 },
        "none"
      );
      expect(zeroResult.wasteRate).toBe(0);
    });

    it("should handle no overtime case", () => {
      const noOvertimeFixture = {
        ...fixture,
        durationSec: 1800, // exactly 30 minutes
      };
      const result = calcWaste(noOvertimeFixture, "none");
      expect(result.overtimeSec).toBe(0);
      expect(result.overtimeCost).toBe(0);
    });
  });

  // ============= AC-4: 표시 포맷 함수들 =============
  describe("AC-4: formatWon, formatHMS, formatMinutes, formatMonthDay", () => {
    it("should format 90144 as '90,144원'", () => {
      expect(formatWon(90144)).toBe("90,144원");
    });

    it("should format 0 as '0원'", () => {
      expect(formatWon(0)).toBe("0원");
    });

    it("should format large numbers with thousands separator", () => {
      expect(formatWon(1000000)).toBe("1,000,000원");
    });

    it("should format 2700 seconds as '00:45:00' (HH:MM:SS)", () => {
      expect(formatHMS(2700)).toBe("00:45:00");
    });

    it("should format 28800 seconds as '08:00:00'", () => {
      expect(formatHMS(28800)).toBe("08:00:00");
    });

    it("should format 0 seconds as '00:00:00'", () => {
      expect(formatHMS(0)).toBe("00:00:00");
    });

    it("should format 3661 seconds as '01:01:01'", () => {
      expect(formatHMS(3661)).toBe("01:01:01");
    });

    it("should format 60 seconds as '00:01:00'", () => {
      expect(formatHMS(60)).toBe("00:01:00");
    });

    it("should format minutes correctly", () => {
      expect(formatMinutes(30)).toBe("30분");
      expect(formatMinutes(1)).toBe("1분");
      expect(formatMinutes(480)).toBe("480분");
    });

    it("should format month/day correctly", () => {
      // MM-DD format
      const result = formatMonthDay(new Date(2026, 8, 21)); // Sep 21
      expect(result).toMatch(/09-21/);
    });
  });

  // ============= AC-5: toLocalDateKey 로컬 날짜 키 =============
  describe("AC-5: toLocalDateKey — 로컬 날짜 기준, toISOString 호출 0회", () => {
    it("should convert Date to YYYY-MM-DD using local time, no toISOString calls", () => {
      const date = new Date(2026, 8, 21); // Sep 21, 2026 local midnight
      const spy = vi.spyOn(date, "toISOString");

      const result = toLocalDateKey(date);

      expect(result).toMatch(/^2026-09-21$/);
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    it("should handle different dates correctly", () => {
      const date1 = new Date(2026, 0, 1); // Jan 1
      const date2 = new Date(2026, 11, 31); // Dec 31

      expect(toLocalDateKey(date1)).toMatch(/^2026-01-01$/);
      expect(toLocalDateKey(date2)).toMatch(/^2026-12-31$/);
    });

    it("should ignore time portion and use only local date", () => {
      const date1 = new Date(2026, 8, 21, 0, 0, 0);
      const date2 = new Date(2026, 8, 21, 23, 59, 59);

      expect(toLocalDateKey(date1)).toBe(toLocalDateKey(date2));
    });
  });

  // ============= Additional edge cases =============
  describe("Edge cases and boundary conditions", () => {
    it("should handle very small salary (1000만원)", () => {
      const result = calcHourly(2, 1000);
      expect(result.perPerson).toBeGreaterThan(0);
      expect(result.team).toBeGreaterThan(0);
    });

    it("should handle large attendees (100명)", () => {
      const result = calcHourly(100, 5000);
      expect(result.team).toBeGreaterThan(0);
      expect(result.perPerson).toBeGreaterThan(0);
    });

    it("calcWaste should handle very large totalCost", () => {
      const largeFixture = {
        attendees: 50,
        annualSalaryManwon: 50000,
        plannedMinutes: 60,
        durationSec: 3600,
        totalCost: 1000000,
      };
      const result = calcWaste(largeFixture, "none");
      expect(result.wasteCost).toBeGreaterThanOrEqual(0);
      expect(result.wasteRate).toBeGreaterThanOrEqual(0);
      expect(result.wasteRate).toBeLessThanOrEqual(100);
    });

    it("formatWon should handle 1원", () => {
      expect(formatWon(1)).toBe("1원");
    });

    it("formatHMS should handle max 28800 seconds (8 hours)", () => {
      const result = formatHMS(28800);
      expect(result).toBe("08:00:00");
    });
  });

  // ============= Import checks =============
  describe("Module exports", () => {
    it("should export all required cost functions", () => {
      expect(calcHourly).toBeDefined();
      expect(typeof calcHourly).toBe("function");
      expect(calcCost).toBeDefined();
      expect(typeof calcCost).toBe("function");
      expect(calcWaste).toBeDefined();
      expect(typeof calcWaste).toBe("function");
    });

    it("should export all required format functions", () => {
      expect(formatWon).toBeDefined();
      expect(typeof formatWon).toBe("function");
      expect(formatHMS).toBeDefined();
      expect(typeof formatHMS).toBe("function");
      expect(formatMinutes).toBeDefined();
      expect(typeof formatMinutes).toBe("function");
      expect(formatMonthDay).toBeDefined();
      expect(typeof formatMonthDay).toBe("function");
      expect(toLocalDateKey).toBeDefined();
      expect(typeof toLocalDateKey).toBe("function");
    });
  });
});
