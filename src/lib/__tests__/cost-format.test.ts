import { describe, it, expect } from "vitest";
import { calcHourly, calcCost, calcWaste } from "@/lib/cost";
import { formatWon, formatHMS, toLocalDateKey } from "@/lib/format";
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
