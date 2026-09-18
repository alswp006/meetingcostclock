import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import {
  startMeeting,
  pauseMeeting,
  resumeMeeting,
  finalizeActive,
  autoFinalizeStale,
  resetAutoFinalizeRetries,
} from "@/lib/meetingLifecycle";
import { failSetItemOnNth } from "./failSetItemOnNth";
import type { ActiveMeeting } from "@/lib/types";

const START = new Date(2026, 0, 5, 10, 0, 0).getTime();
const setup = {
  title: "주간 회의",
  teamName: "팀A",
  attendees: 5,
  annualSalaryManwon: 5000,
  plannedMinutes: 60,
};
const active: ActiveMeeting = {
  id: "a1",
  setup,
  startedAt: START,
  pausedAt: null,
  totalPausedMs: 0,
  createdAt: "2026-01-05T01:00:00.000Z",
  updatedAt: "2026-01-05T01:00:00.000Z",
};
const day = {
  id: "2026-01-05",
  date: "2026-01-05",
  createdAt: "2026-01-04T00:00:00.000Z",
  updatedAt: "2026-01-04T00:00:00.000Z",
};

function seed(a: ActiveMeeting | null = active, withDay = false) {
  localStorage.setItem("mcc:v1:active", JSON.stringify(a));
  if (withDay) localStorage.setItem("mcc:v1:noMeetingDays", JSON.stringify([day]));
}
const records = () => JSON.parse(localStorage.getItem("mcc:v1:records") ?? "[]");

beforeEach(() => resetAutoFinalizeRetries());
afterEach(() => vi.restoreAllMocks());

describe("finalizeActive", () => {
  it("2700초 경과: totalCost=90144, outcome=null, active=null", () => {
    seed();
    const r = finalizeActive(START + 2700_000);
    expect(r.ok).toBe(true);
    expect(records()[0].totalCost).toBe(90144);
    expect(records()[0].outcome).toBeNull();
    expect(localStorage.getItem("mcc:v1:active")).toBe("null");
  });

  it("10초 미만이면 too_short, active만 null", () => {
    seed();
    expect(finalizeActive(START + 5000)).toEqual({ ok: false, reason: "too_short" });
    expect(records()).toEqual([]);
    expect(localStorage.getItem("mcc:v1:active")).toBe("null");
  });

  it("records 쓰기 실패 시 스냅샷으로 복원하고 quota", () => {
    seed(active, true);
    const days = localStorage.getItem("mcc:v1:noMeetingDays");
    const act = localStorage.getItem("mcc:v1:active");
    failSetItemOnNth(2);
    expect(finalizeActive(START + 2700_000)).toEqual({ ok: false, reason: "quota" });
    expect(localStorage.getItem("mcc:v1:noMeetingDays")).toBe(days);
    expect(localStorage.getItem("mcc:v1:active")).toBe(act);
    expect(localStorage.getItem("mcc:v1:records")).toBeNull();
  });

  it("회의 기간의 NoMeetingDay를 취소한다", () => {
    seed(active, true);
    const r = finalizeActive(START + 2700_000);
    expect(r.ok && r.noMeetingCancelled).toBe(true);
    expect(JSON.parse(localStorage.getItem("mcc:v1:noMeetingDays")!)).toEqual([]);
  });

  it("active가 없으면 no_active", () => {
    expect(finalizeActive(START)).toEqual({ ok: false, reason: "no_active" });
  });
});

describe("autoFinalizeStale", () => {
  it("만료된 active를 capAt으로 저장한다", () => {
    seed();
    const res = autoFinalizeStale(START + 10 * 3600_000);
    expect(res.status).toBe("done");
    expect(records()[0].durationSec).toBe(28800);
    expect(records()[0].endedAt).toBe(new Date(START + 28800_000).toISOString());
  });

  it("quota 실패는 최대 2회 재시도(총 3회 시도)", () => {
    seed();
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      const e = new Error("full");
      e.name = "QuotaExceededError";
      throw e;
    });
    const res = autoFinalizeStale(START + 10 * 3600_000);
    // Each finalizeAt attempt makes 2 setItem calls (saveRecord + rollback/restore).
    // With 3 attempts total (1 initial + 2 retries), we expect 6 calls.
    expect(spy).toHaveBeenCalledTimes(6);
    expect(res.status === "done" && res.showQuotaToast).toBe(true);
  });

  it("만료 전이면 not_stale", () => {
    seed();
    expect(autoFinalizeStale(START + 1000)).toEqual({ status: "not_stale" });
  });
});

describe("start/pause/resume", () => {
  it("시작 → 일시정지 → 재개 시 totalPausedMs 누적", () => {
    const s = startMeeting(setup, START);
    expect(s.ok).toBe(true);
    expect(localStorage.getItem("mcc:v1:lastSetup")).not.toBeNull();
    expect(pauseMeeting(START + 1000)).toEqual({ ok: true });
    expect(resumeMeeting(START + 4000)).toEqual({ ok: true });
    expect(JSON.parse(localStorage.getItem("mcc:v1:active")!).totalPausedMs).toBe(3000);
  });

  it("잘못된 설정은 invalid", () => {
    expect(startMeeting({ ...setup, attendees: 1 }, START)).toEqual({ ok: false, reason: "invalid" });
  });
});
