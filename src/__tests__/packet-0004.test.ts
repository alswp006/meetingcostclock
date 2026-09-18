import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type {
  MeetingRecord,
  ActiveMeeting,
  SaveResult,
  Page,
  MeetingSetup,
  NoMeetingDay,
  EarnedBadge,
} from "@/lib/types";

// PLACEHOLDER: 이 import들은 아직 구현되지 않은 상태다.
// Red phase: 테스트가 모두 실패할 것.
//
// 구현될 API:
// - saveRecord(r: Partial<MeetingRecord>) → SaveResult
// - getRecord(id: string) → MeetingRecord | null
// - updateRecord(id: string, patch: Partial<MeetingRecord>) → SaveResult
// - deleteRecord(id: string) → SaveResult
// - loadRecordsPage(offset: number) → Page<MeetingRecord>
// - loadActive() → ActiveMeeting | null
// - saveActive(a: ActiveMeeting | null) → SaveResult
// - saveLastSetup(setup: MeetingSetup) → SaveResult
// - loadLastSetup() → MeetingSetup | null
// - newId() → string
// - writeRaw(key: string, value: unknown) → { ok: boolean; reason?: string }
// - readRaw(key: string) → unknown

describe("저장소 계층 (안전 읽기/쓰기, CRUD, 페이지 조회, storage.ts 공개 모듈)", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ============ AC-1: saveRecord 같은 id로 두 번 호출 ============

  it("AC-1[P0]: saveRecord 같은 id로 두 번 호출 시, id 1개, createdAt 유지, updatedAt만 갱신", () => {
    // 다이나믹하게 import해서 아직 없어도 테스트 구조는 유효
    // 실제 구현 후 import 경로 활성화됨
    const { saveRecord, getRecord } = require("@/lib/storage");

    const now = new Date().toISOString();
    const testId = "rec-001";

    const record1: Partial<MeetingRecord> = {
      id: testId,
      title: "팀 회의",
      teamName: "개발팀",
      attendees: 5,
      annualSalaryManwon: 5000,
      plannedMinutes: 60,
      startedAt: now,
      endedAt: new Date(Date.now() + 3600000).toISOString(),
      durationSec: 3600,
      totalCost: 25000,
      outcome: "decided",
      wasteCost: null,
      reportUnlocked: false,
      shareUnlocked: false,
    };

    // 첫 번째 저장
    const result1: SaveResult = saveRecord(record1);
    expect(result1.ok).toBe(true);

    const saved1 = getRecord(testId);
    expect(saved1).not.toBeNull();
    expect(saved1.id).toBe(testId);
    expect(saved1.totalCost).toBe(25000);
    const originalCreatedAt = saved1.createdAt;
    const originalUpdatedAt = saved1.updatedAt;

    // 약간 대기 후 두 번째 저장 (createdAt과 다르도록)
    const record2: Partial<MeetingRecord> = {
      ...record1,
      totalCost: 30000, // 비용만 변경
    };

    const result2: SaveResult = saveRecord(record2);
    expect(result2.ok).toBe(true);

    const saved2 = getRecord(testId);
    expect(saved2).not.toBeNull();
    expect(saved2.id).toBe(testId);
    expect(saved2.createdAt).toBe(originalCreatedAt); // createdAt 유지
    expect(saved2.updatedAt).toBeGreaterThanOrEqual(originalUpdatedAt); // updatedAt 변경
    expect(saved2.totalCost).toBe(30000); // 데이터 업데이트됨
  });

  // ============ AC-2: 501번째 기록 저장 시 가장 오래된 행 삭제 ============

  it("AC-2[P0]: 501번째 기록 저장 시, endedAt 가장 오래된 행 삭제되어 500건 유지", () => {
    const { saveRecord, getRecord, loadRecordsPage } = require("@/lib/storage");

    // 500개 기록 생성
    const baseTime = new Date("2026-01-01T00:00:00Z");
    for (let i = 0; i < 500; i++) {
      const recordTime = new Date(baseTime.getTime() + i * 60000); // 1분씩 간격
      const record: Partial<MeetingRecord> = {
        id: `rec-${String(i).padStart(3, "0")}`,
        title: `회의 ${i}`,
        teamName: "팀A",
        attendees: 5,
        annualSalaryManwon: 5000,
        plannedMinutes: 60,
        startedAt: recordTime.toISOString(),
        endedAt: new Date(
          recordTime.getTime() + 3600000
        ).toISOString(),
        durationSec: 3600,
        totalCost: 25000 + i * 100,
        outcome: "decided",
        wasteCost: null,
        reportUnlocked: false,
        shareUnlocked: false,
      };
      saveRecord(record);
    }

    // 첫 페이지 로드 — 500건 확인
    let page: Page<MeetingRecord> = loadRecordsPage(0);
    expect(page.items).toHaveLength(500);
    expect(page.total).toBe(500);

    // endedAt이 가장 오래된 행 (page.items[499] — endedAt DESC이므로 마지막)
    const oldestRecord = page.items[page.items.length - 1];
    const oldestId = oldestRecord.id;
    expect(oldestId).toBe("rec-000");

    // 501번째 저장
    const newRecord: Partial<MeetingRecord> = {
      id: "rec-501",
      title: "회의 501",
      teamName: "팀A",
      attendees: 5,
      annualSalaryManwon: 5000,
      plannedMinutes: 60,
      startedAt: new Date(baseTime.getTime() + 500 * 60000).toISOString(),
      endedAt: new Date(
        baseTime.getTime() + 500 * 60000 + 3600000
      ).toISOString(),
      durationSec: 3600,
      totalCost: 75000,
      outcome: "decided",
      wasteCost: null,
      reportUnlocked: false,
      shareUnlocked: false,
    };
    const result = saveRecord(newRecord);
    expect(result.ok).toBe(true);

    // 다시 페이지 로드 — 500건 유지
    page = loadRecordsPage(0);
    expect(page.items).toHaveLength(500);
    expect(page.total).toBe(500);

    // 가장 오래된 행(rec-000)이 삭제되었는지 확인
    const ids = page.items.map((r) => r.id);
    expect(ids).not.toContain(oldestId);
    expect(ids).toContain("rec-501");

    // 첫 번째 행(rec-501, endedAt 최신)과 마지막 행(rec-001, endedAt 가장 오래됨) 확인
    expect(page.items[0].id).toBe("rec-501");
    expect(page.items[page.items.length - 1].id).toBe("rec-001");
  });

  // ============ AC-3: localStorage 손상 또는 예외 처리 ============

  it("AC-3[P0]: localStorage 'mcc:v1:records'에 손상된 JSON → loadRecordsPage가 {items:[], error:'corrupted'} 반환", () => {
    const { loadRecordsPage } = require("@/lib/storage");

    // 손상된 JSON 설정
    localStorage.setItem("mcc:v1:records", "{bad");

    const page: Page<MeetingRecord> = loadRecordsPage(0);
    expect(page.items).toEqual([]);
    expect(page.error).toBe("corrupted");
  });

  it("AC-3[P0]: getItem이 예외 던질 때 → loadRecordsPage가 error:'unavailable' 반환", () => {
    const { loadRecordsPage } = require("@/lib/storage");

    // localStorage.getItem을 spy & 예외 발생하도록
    const getItemSpy = vi.spyOn(Storage.prototype, "getItem");
    getItemSpy.mockImplementation(() => {
      throw new Error("access denied");
    });

    const page: Page<MeetingRecord> = loadRecordsPage(0);
    expect(page.error).toBe("unavailable");
    expect(page.items).toEqual([]);

    getItemSpy.mockRestore();
  });

  // ============ AC-4: setItem 오류 분류 ============

  it("AC-4[P1]: setItem이 QuotaExceededError 던질 때 → writeRaw {ok:false, reason:'quota'} 반환", () => {
    const { writeRaw } = require("@/lib/storage");

    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");
    const err = new Error("quota exceeded");
    err.name = "QuotaExceededError";
    setItemSpy.mockImplementation(() => {
      throw err;
    });

    const result = writeRaw("mcc:v1:records", []);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("quota");

    setItemSpy.mockRestore();
  });

  it("AC-4[P1]: setItem이 기타 예외 던질 때 → reason:'unknown' 반환", () => {
    const { writeRaw } = require("@/lib/storage");

    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");
    setItemSpy.mockImplementation(() => {
      throw new Error("unknown error");
    });

    const result = writeRaw("mcc:v1:records", []);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("unknown");

    setItemSpy.mockRestore();
  });

  // ============ AC-5: 읽기 함수는 setItem 호출 없음 ============

  it("AC-5[P1]: records 읽기 함수들은 setItem을 호출하지 않음", () => {
    const { saveRecord, getRecord, loadRecordsPage } = require("@/lib/storage");

    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");

    // 기준 기록 1개 저장 (readRaw 테스트를 위함)
    saveRecord({
      id: "rec-test",
      title: "테스트",
      teamName: "팀",
      attendees: 5,
      annualSalaryManwon: 5000,
      plannedMinutes: 60,
      startedAt: new Date().toISOString(),
      endedAt: new Date(Date.now() + 3600000).toISOString(),
      durationSec: 3600,
      totalCost: 25000,
      outcome: null,
      wasteCost: null,
      reportUnlocked: false,
      shareUnlocked: false,
    });

    setItemSpy.mockClear(); // 저장 이후 호출 기록 초기화

    // 읽기 함수들 호출
    getRecord("rec-test");
    expect(setItemSpy).not.toHaveBeenCalled();

    loadRecordsPage(0);
    expect(setItemSpy).not.toHaveBeenCalled();

    setItemSpy.mockRestore();
  });

  // ============ 보조 테스트: newId 생성 및 기본 CRUD ============

  it("newId는 고유한 ID를 생성한다", () => {
    const { newId } = require("@/lib/storage");

    const ids = new Set<string>();
    for (let i = 0; i < 10; i++) {
      const id = newId();
      expect(typeof id).toBe("string");
      expect(id.length).toBeGreaterThan(0);
      expect(ids.has(id)).toBe(false);
      ids.add(id);
    }
    expect(ids.size).toBe(10);
  });

  it("getRecord 존재하지 않는 id → null 반환", () => {
    const { getRecord } = require("@/lib/storage");

    const result = getRecord("nonexistent");
    expect(result).toBeNull();
  });

  it("deleteRecord 성공 → SaveResult.ok=true", () => {
    const { saveRecord, deleteRecord, getRecord } = require("@/lib/storage");

    const testId = "rec-del";
    saveRecord({
      id: testId,
      title: "삭제 테스트",
      teamName: "팀",
      attendees: 5,
      annualSalaryManwon: 5000,
      plannedMinutes: 60,
      startedAt: new Date().toISOString(),
      endedAt: new Date(Date.now() + 3600000).toISOString(),
      durationSec: 3600,
      totalCost: 25000,
      outcome: null,
      wasteCost: null,
      reportUnlocked: false,
      shareUnlocked: false,
    });

    const result: SaveResult = deleteRecord(testId);
    expect(result.ok).toBe(true);

    const deleted = getRecord(testId);
    expect(deleted).toBeNull();
  });

  it("updateRecord 기존 행 패치 → updatedAt 갱신", () => {
    const { saveRecord, updateRecord, getRecord } = require("@/lib/storage");

    const testId = "rec-update";
    saveRecord({
      id: testId,
      title: "원본",
      teamName: "팀",
      attendees: 5,
      annualSalaryManwon: 5000,
      plannedMinutes: 60,
      startedAt: new Date().toISOString(),
      endedAt: new Date(Date.now() + 3600000).toISOString(),
      durationSec: 3600,
      totalCost: 25000,
      outcome: null,
      wasteCost: null,
      reportUnlocked: false,
      shareUnlocked: false,
    });

    const saved1 = getRecord(testId);
    const originalUpdatedAt = saved1.updatedAt;

    const result: SaveResult = updateRecord(testId, { title: "수정됨" });
    expect(result.ok).toBe(true);

    const updated = getRecord(testId);
    expect(updated.title).toBe("수정됨");
    expect(updated.updatedAt).toBeGreaterThanOrEqual(originalUpdatedAt);
  });

  it("loadRecordsPage offset 파라미터 — 페이징 동작", () => {
    const { saveRecord, loadRecordsPage } = require("@/lib/storage");

    // 50개 기록 생성
    for (let i = 0; i < 50; i++) {
      saveRecord({
        id: `rec-page-${i}`,
        title: `회의 ${i}`,
        teamName: "팀",
        attendees: 5,
        annualSalaryManwon: 5000,
        plannedMinutes: 60,
        startedAt: new Date(
          Date.now() - (50 - i) * 60000
        ).toISOString(),
        endedAt: new Date(
          Date.now() - (50 - i) * 60000 + 3600000
        ).toISOString(),
        durationSec: 3600,
        totalCost: 25000 + i,
        outcome: null,
        wasteCost: null,
        reportUnlocked: false,
        shareUnlocked: false,
      });
    }

    // 페이지 0 (오프셋 0, 20건)
    const page1: Page<MeetingRecord> = loadRecordsPage(0);
    expect(page1.items.length).toBeLessThanOrEqual(20);
    expect(page1.page).toBe(1);
    expect(page1.total).toBe(50);

    // 페이지 1 (오프셋 20, 다음 20건)
    const page2: Page<MeetingRecord> = loadRecordsPage(20);
    expect(page2.page).toBe(2);
    if (page2.items.length > 0) {
      expect(page2.items[0].id).not.toBe(page1.items[0].id);
    }
  });

  // ============ ActiveMeeting 저장/로드 ============

  it("saveActive/loadActive — ActiveMeeting 저장 및 로드", () => {
    const { saveActive, loadActive } = require("@/lib/storage");

    const active: ActiveMeeting = {
      id: "active-001",
      setup: {
        title: "진행 중인 회의",
        teamName: "팀A",
        attendees: 5,
        annualSalaryManwon: 5000,
        plannedMinutes: 60,
      },
      startedAt: Date.now(),
      pausedAt: null,
      totalPausedMs: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const result = saveActive(active);
    expect(result.ok).toBe(true);

    const loaded = loadActive();
    expect(loaded).not.toBeNull();
    expect(loaded.id).toBe("active-001");
    expect(loaded.setup.title).toBe("진행 중인 회의");
  });

  it("saveActive(null) — ActiveMeeting 제거", () => {
    const { saveActive, loadActive } = require("@/lib/storage");

    // 저장
    saveActive({
      id: "active-001",
      setup: {
        title: "회의",
        teamName: "팀",
        attendees: 5,
        annualSalaryManwon: 5000,
        plannedMinutes: 60,
      },
      startedAt: Date.now(),
      pausedAt: null,
      totalPausedMs: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // 제거
    const result = saveActive(null);
    expect(result.ok).toBe(true);

    // 로드
    const loaded = loadActive();
    expect(loaded).toBeNull();
  });
});
