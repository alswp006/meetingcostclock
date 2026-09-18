import { describe, it, expect } from "vitest";
import { rankTeams, declareNoMeetingDay } from "@/lib/challenge";
import { failSetItemOnNth } from "@/lib/__tests__/failSetItemOnNth";
import { STORAGE_KEY_NO_MEETING_DAYS, STORAGE_KEY_RECORDS } from "@/lib/constants";
import type { MeetingRecord } from "@/lib/types";

function rec(teamName: string, totalCost: number, endedAt: Date): MeetingRecord {
  const iso = endedAt.toISOString();
  return {
    id: `${teamName}-${endedAt.getTime()}-${totalCost}`, title: "주간 회의", teamName, attendees: 5,
    annualSalaryManwon: 5000, plannedMinutes: 60, startedAt: iso, endedAt: iso, durationSec: 3600,
    totalCost, outcome: null, wasteCost: null, reportUnlocked: false, shareUnlocked: false,
    createdAt: iso, updatedAt: iso,
  };
}

const wed = new Date(2026, 8, 16, 10, 0);

describe("challenge", () => {
  it("rankTeams: 이번 달만 합산", () => {
    const r = rankTeams(
      [rec("A", 90144, wed), rec("A", 90144, wed), rec("B", 1000, wed), rec("B", 999999, new Date(2026, 7, 10))],
      wed,
    );
    expect(r[0].teamName).toBe("A");
    expect(r[0].totalCost).toBe(180288);
    expect(r).toHaveLength(2);
  });

  it("주말은 저장소를 바꾸지 않는다", () => {
    expect(declareNoMeetingDay(new Date(2026, 8, 19, 10))).toEqual({ ok: false, reason: "weekend" });
    expect(localStorage.getItem(STORAGE_KEY_NO_MEETING_DAYS)).toBeNull();
  });

  it("오늘 기록이 있으면 has_meeting", () => {
    localStorage.setItem(STORAGE_KEY_RECORDS, JSON.stringify([rec("A", 1, wed)]));
    expect(declareNoMeetingDay(wed)).toEqual({ ok: false, reason: "has_meeting" });
  });

  it("첫 선언은 배지를 주고 재선언해도 1행", () => {
    const r = declareNoMeetingDay(wed);
    expect(r.ok && r.newBadges.map((b) => b.badgeId)).toContain("first_free_day");
    declareNoMeetingDay(wed);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY_NO_MEETING_DAYS) ?? "[]")).toHaveLength(1);
  });

  it("쓰기 실패 시 원본 복원 + quota", () => {
    const orig = JSON.stringify([]);
    localStorage.setItem(STORAGE_KEY_NO_MEETING_DAYS, orig);
    const spy = failSetItemOnNth(1);
    const r = declareNoMeetingDay(wed);
    spy.mockRestore();
    expect(r).toEqual({ ok: false, reason: "quota" });
    expect(localStorage.getItem(STORAGE_KEY_NO_MEETING_DAYS)).toBe(orig);
  });
});

import { getTeamRanking } from "@/lib/ranking";

describe("getTeamRanking", () => {
  it("합산·내림차순·동률 순위", () => {
    const res = getTeamRanking([
      { userId: "a", durationMs: 30 * 60000 },
      { userId: "b", durationMs: 60 * 60000 },
      { userId: "a", durationMs: 30 * 60000 },
      { userId: "c", durationMs: 10 * 60000 },
    ]);
    expect(res).toEqual([
      { userId: "a", totalMinutes: 60, rank: 1 },
      { userId: "b", totalMinutes: 60, rank: 1 },
      { userId: "c", totalMinutes: 10, rank: 3 },
    ]);
  });
  it("빈 입력은 빈 배열", () => {
    expect(getTeamRanking([])).toEqual([]);
  });
});
