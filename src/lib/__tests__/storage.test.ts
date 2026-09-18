import { describe, it, expect, vi, afterEach } from "vitest";
import {
  saveRecord,
  getRecord,
  updateRecord,
  deleteRecord,
  loadRecordsPage,
  writeRaw,
  newId,
  loadActive,
  saveActive,
  loadLastSetup,
  saveLastSetup,
} from "@/lib/storage";
import { failSetItemOnNth } from "./failSetItemOnNth";
import type { MeetingRecord } from "@/lib/types";

function rec(i: number, over: Partial<MeetingRecord> = {}) {
  const start = Date.parse("2026-01-01T00:00:00Z") + i * 60000;
  return {
    id: `rec-${String(i).padStart(3, "0")}`,
    title: `회의 ${i}`,
    teamName: "팀A",
    attendees: 5,
    annualSalaryManwon: 5000,
    plannedMinutes: 60,
    startedAt: new Date(start).toISOString(),
    endedAt: new Date(start + 3600000).toISOString(),
    durationSec: 3600,
    totalCost: 25000,
    outcome: null,
    wasteCost: null,
    reportUnlocked: false,
    shareUnlocked: false,
    ...over,
  };
}

afterEach(() => vi.restoreAllMocks());

describe("storage", () => {
  it("AC-1: 같은 id 재저장은 1행, createdAt 유지, updatedAt 갱신", async () => {
    saveRecord(rec(1));
    const a = getRecord("rec-001")!;
    await new Promise((r) => setTimeout(r, 5));
    saveRecord(rec(1, { totalCost: 30000 }));
    const b = getRecord("rec-001")!;
    expect(loadRecordsPage(0).total).toBe(1);
    expect(b.createdAt).toBe(a.createdAt);
    expect(b.updatedAt > a.updatedAt).toBe(true);
    expect(b.totalCost).toBe(30000);
  });

  it("AC-2: 501번째 저장 시 가장 오래된 행 삭제", () => {
    localStorage.setItem(
      "mcc:v1:records",
      JSON.stringify(
        Array.from({ length: 500 }, (_, i) => ({
          ...rec(i),
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        })),
      ),
    );
    expect(saveRecord(rec(500)).ok).toBe(true);
    const all = JSON.parse(localStorage.getItem("mcc:v1:records")!);
    expect(all).toHaveLength(500);
    expect(all[0].id).toBe("rec-500");
    expect(all.some((r: { id: string }) => r.id === "rec-000")).toBe(false);
  });

  it("AC-3: 손상은 corrupted, getItem 예외는 unavailable", () => {
    localStorage.setItem("mcc:v1:records", "{bad");
    expect(loadRecordsPage(0)).toMatchObject({ items: [], error: "corrupted" });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    expect(loadRecordsPage(0)).toMatchObject({ items: [], error: "unavailable" });
  });

  it("AC-4: writeRaw 오류 분류", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      const e = new Error("q");
      e.name = "QuotaExceededError";
      throw e;
    });
    expect(writeRaw("k", 1)).toEqual({ ok: false, reason: "quota" });
    spy.mockImplementation(() => {
      throw new Error("x");
    });
    expect(writeRaw("k", 1)).toEqual({ ok: false, reason: "unknown" });
  });

  it("AC-5: 읽기 경로는 setItem을 호출하지 않는다", () => {
    saveRecord(rec(1));
    saveActive(null);
    const spy = vi.spyOn(Storage.prototype, "setItem");
    getRecord("rec-001");
    loadRecordsPage(0);
    loadActive();
    loadLastSetup();
    expect(spy).not.toHaveBeenCalled();
  });

  it("update/delete/not_found와 페이징", () => {
    for (let i = 0; i < 25; i++) saveRecord(rec(i));
    expect(loadRecordsPage(0).items).toHaveLength(20);
    const p2 = loadRecordsPage(20);
    expect(p2.page).toBe(2);
    expect(p2.items).toHaveLength(5);
    expect(updateRecord("rec-001", { title: "수정" }).ok).toBe(true);
    expect(getRecord("rec-001")!.title).toBe("수정");
    expect(updateRecord("none", {})).toEqual({ ok: false, reason: "not_found" });
    expect(deleteRecord("rec-001").ok).toBe(true);
    expect(getRecord("rec-001")).toBeNull();
    expect(deleteRecord("rec-001")).toEqual({ ok: false, reason: "not_found" });
  });

  it("failSetItemOnNth: n번째 쓰기만 실패", () => {
    failSetItemOnNth(2);
    expect(saveRecord(rec(1)).ok).toBe(true);
    expect(saveRecord(rec(2))).toEqual({ ok: false, reason: "quota" });
    expect(getRecord("rec-002")).toBeNull();
  });

  it("newId 고유, lastSetup 왕복", () => {
    expect(newId()).not.toBe(newId());
    saveLastSetup({ title: "주간", teamName: "A", attendees: 4, annualSalaryManwon: 4000, plannedMinutes: 30 });
    expect(loadLastSetup()?.title).toBe("주간");
  });
});
