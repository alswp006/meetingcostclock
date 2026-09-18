import { describe, it, expect } from "vitest";
import { weekSummary } from "@/lib/weekSummary";
import { buildShareText, renderShareCard } from "@/lib/shareCard";
import type { MeetingRecord } from "@/lib/types";

const rec = (id: string, endedAt: string, totalCost: number, extra: Partial<MeetingRecord> = {}): MeetingRecord => ({
  id, title: "주간 회의", teamName: "A", attendees: 5, annualSalaryManwon: 5000, plannedMinutes: 30,
  startedAt: endedAt, endedAt, durationSec: 2700, totalCost, outcome: null, wasteCost: null,
  reportUnlocked: false, shareUnlocked: false, createdAt: endedAt, updatedAt: endedAt, ...extra,
});
const now = new Date(2026, 8, 17, 12); // 목요일

describe("weekSummary", () => {
  const records = [
    rec("a", new Date(2026, 8, 16, 10).toISOString(), 90144),
    rec("b", new Date(2026, 8, 14, 9).toISOString(), 30030),
    rec("c", new Date(2026, 8, 11, 9).toISOString(), 5000),
  ];
  it("이번 주 합계", () => {
    const s = weekSummary(records, now);
    expect(s.weekTotal).toBe(120174);
    expect(s.weekCount).toBe(2);
  });
  it("recent3 내림차순", () => {
    expect(weekSummary(records, now).recent3.map((r) => r.id)).toEqual(["a", "b", "c"]);
  });
});

describe("shareCard", () => {
  const r = rec("x", new Date(2026, 8, 16).toISOString(), 90144, { outcome: "none", wasteCost: 60096 });
  it("buildShareText", () => {
    const t = buildShareText(r);
    expect(t).toContain("90,144원");
    expect(t).toContain("60,096원");
    expect(t).not.toContain("AI");
  });
  it("getContext null이면 ok:false", () => {
    const canvas = document.createElement("canvas");
    canvas.getContext = (() => null) as never;
    expect(renderShareCard(canvas, r)).toEqual({ ok: false });
  });
});
