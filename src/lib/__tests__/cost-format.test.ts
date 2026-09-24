import { describe, it, expect } from "vitest";
import { calcHourly, calcCost, calcWaste } from "@/lib/cost";
import { formatWon, formatHMS, toLocalDateKey, formatDurationLabel } from "@/lib/format";
import * as m from "@/lib/messages";

describe("cost/format/messages", () => {
  it("calc 함수", () => {
    expect(calcHourly(5, 5000)).toEqual({ perPerson: 24038, team: 120192, perMinute: 2003 });
    expect(calcCost(5, 5000, 2700)).toBe(90144);
    const r = { attendees: 5, annualSalaryManwon: 5000, plannedMinutes: 30, durationSec: 2700, totalCost: 90144 };
    expect(calcWaste(r, "none")).toMatchObject({ overtimeSec: 900, overtimeCost: 30048, wasteCost: 60096, wasteRate: 67 });
    expect(calcWaste(r, "partial").wasteCost).toBe(45072);
    expect(calcWaste(r, "decided").wasteCost).toBe(30048);
    expect(calcWaste({ ...r, totalCost: 0 }, "none").wasteRate).toBe(0);
  });

  it("포맷", () => {
    expect(formatWon(90144)).toBe("90,144원");
    expect(formatHMS(2700)).toBe("00:45:00");
    expect(formatHMS(28800)).toBe("08:00:00");
    expect(toLocalDateKey(new Date(2026, 8, 5))).toBe("2026-09-05");
  });

  it("문구가 SPEC 원문과 같다", () => {
    expect(m.QUOTA_TOAST).toBe("저장 공간이 부족해요. 오래된 기록을 삭제해주세요");
    expect(m.TOO_SHORT).toBe("10초 미만 회의는 저장되지 않아요");
    expect(m.NO_MEETING_CANCELLED).toBe("오늘 회의가 기록되어 '회의 없는 날'이 취소됐어요");
    expect(m.AUTO_CLOSED_8H).toBe("8시간이 지나 회의를 자동 종료했어요");
    expect(m.AUTO_CLOSED_12H).toBe("12시간이 지나 회의를 자동 종료했어요");
    expect(m.RESTART_SAVED).toBe("이전 회의를 저장했어요. 회고는 기록 탭에서 입력할 수 있어요");
  });
});

import { calculateCost } from "@/lib/cost";
import { formatDuration, formatPrice } from "@/lib/format";

describe("contract functions", () => {
  it("calculateCost", () => {
    expect(calculateCost(3_600_000, 30000)).toBe(30000);
    expect(calculateCost(1_800_000, 25001)).toBe(12500);
    expect(calculateCost(-1, 30000)).toBe(0);
    expect(calculateCost(1000, NaN)).toBe(0);
  });
  it("formatDuration", () => {
    expect(formatDuration(0)).toBe("00:00");
    expect(formatDuration(125_000)).toBe("02:05");
    expect(formatDuration(3_725_000)).toBe("01:02:05");
  });
  it("formatPrice", () => {
    expect(formatPrice(90144)).toBe("90,144원");
    expect(formatPrice(1_250_000, { compact: true })).toBe("125만원");
    expect(formatPrice(15000, { compact: true })).toBe("1.5만원");
    expect(formatPrice(9000, { compact: true })).toBe("9,000원");
  });
});

describe("formatDurationLabel — 모든 화면(회고·리포트·기록·홈)이 쓰는 회의 길이 표기", () => {
  it("1분 미만은 초로 말한다 — 12초 회의가 '1분'으로 반올림되지 않는다", () => {
    expect(formatDurationLabel(12)).toBe("12초");
    expect(formatDurationLabel(0)).toBe("0초");
    expect(formatDurationLabel(59.9)).toBe("59초");
  });
  it("1시간 미만은 분(내림) — 공유 카드의 MM:SS와 같은 값을 가리킨다", () => {
    expect(formatDurationLabel(60)).toBe("1분");
    expect(formatDurationLabel(119)).toBe("1분");
    expect(formatDurationLabel(2700)).toBe("45분");
    expect(formatDurationLabel(3599)).toBe("59분");
  });
  it("1시간 이상은 시간(+분)", () => {
    expect(formatDurationLabel(3600)).toBe("1시간");
    expect(formatDurationLabel(5400)).toBe("1시간 30분");
    expect(formatDurationLabel(28800)).toBe("8시간");
  });
  it("손상 값은 0초로 — 음수·NaN이 화면에 새지 않는다", () => {
    expect(formatDurationLabel(-5)).toBe("0초");
    expect(formatDurationLabel(Number.NaN)).toBe("0초");
    expect(formatDurationLabel(Number("abc"))).toBe("0초");
  });
  it("계약 함수 formatDuration은 그대로다(공유 카드 00:12)", () => {
    expect(formatDuration(12_000)).toBe("00:12");
  });
});
