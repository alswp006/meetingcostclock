import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { MeetingRecord } from "@/lib/types";
// 이 import들은 Coder가 구현할 모듈들입니다 — 아직 존재하지 않음 (TDD red phase)
import { weekSummary } from "@/lib/weekSummary";
import { buildShareText, renderShareCard } from "@/lib/shareCard";

describe("홈 이번 주 합계와 공유 카드 텍스트/캔버스 렌더러", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ============ AC-1: weekSummary — 이번 주 기록 2건과 지난주 1건 ============

  it("AC-1[P0]: 이번 주 기록 2건(90144, 30030)과 지난주 1건이 있으면 weekTotal은 120174, weekCount는 2다", () => {
    const now = new Date("2026-09-19T10:00:00+09:00"); // 금요일
    const weekStartMs = getMonday00Local(now).getTime();
    const weekEndMs = weekStartMs + 7 * 24 * 60 * 60 * 1000;
    const lastWeekMs = weekStartMs - 24 * 60 * 60 * 1000; // 지난주 일요일

    const thisWeekRecord1: MeetingRecord = {
      id: "rec-001",
      title: "회의1",
      teamName: "팀A",
      attendees: 5,
      annualSalaryManwon: 5000,
      plannedMinutes: 60,
      startedAt: new Date(weekStartMs).toISOString(),
      endedAt: new Date(weekStartMs + 3600000).toISOString(),
      durationSec: 3600,
      totalCost: 90144,
      outcome: "decided",
      wasteCost: 45072,
      reportUnlocked: false,
      shareUnlocked: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const thisWeekRecord2: MeetingRecord = {
      ...thisWeekRecord1,
      id: "rec-002",
      endedAt: new Date(weekStartMs + 7200000).toISOString(),
      totalCost: 30030,
    };

    const lastWeekRecord: MeetingRecord = {
      ...thisWeekRecord1,
      id: "rec-003",
      endedAt: new Date(lastWeekMs).toISOString(),
      totalCost: 50000,
    };

    const records = [thisWeekRecord1, thisWeekRecord2, lastWeekRecord];
    const result = weekSummary(records, now);

    expect(result.weekTotal).toBe(120174);
    expect(result.weekCount).toBe(2);
    // recent3는 모든 기록 중 최근 3건이므로 길이는 3 (지난주도 포함)
    expect(result.recent3).toHaveLength(3);
  });

  // ============ AC-2: recent3 정렬 및 최대 3건 ============

  it("AC-2[P0]: recent3는 endedAt 내림차순으로 최대 3건을 반환한다 (4건 입력)", () => {
    const now = new Date("2026-09-19T10:00:00+09:00");
    const baseTime = new Date("2026-09-15T00:00:00+09:00").getTime();

    const records: MeetingRecord[] = [
      makeRecord("rec-001", baseTime + 1000),
      makeRecord("rec-002", baseTime + 2000),
      makeRecord("rec-003", baseTime + 3000),
      makeRecord("rec-004", baseTime + 4000),
    ];

    const result = weekSummary(records, now);

    expect(result.recent3).toHaveLength(3);
    expect(result.recent3[0].id).toBe("rec-004"); // 가장 최신
    expect(result.recent3[1].id).toBe("rec-003");
    expect(result.recent3[2].id).toBe("rec-002");
  });

  it("AC-2[P1]: recent3는 3건 이하일 때 모두 반환한다", () => {
    const now = new Date("2026-09-19T10:00:00+09:00");
    const baseTime = new Date("2026-09-15T00:00:00+09:00").getTime();

    const records: MeetingRecord[] = [
      makeRecord("rec-001", baseTime + 1000),
      makeRecord("rec-002", baseTime + 2000),
    ];

    const result = weekSummary(records, now);

    expect(result.recent3).toHaveLength(2);
  });

  // ============ AC-3: buildShareText — 통화 형식 및 AI 제거 ============

  it("AC-3[P0]: buildShareText(픽스처 none)의 결과에 '90,144원'과 '60,096원'이 들어 있고 'AI' 문자열은 0건이다", () => {
    const record: MeetingRecord = {
      id: "rec-001",
      title: "팀 회의",
      teamName: "개발팀",
      attendees: 5,
      annualSalaryManwon: 5000,
      plannedMinutes: 60,
      startedAt: new Date("2026-09-15T10:00:00+09:00").toISOString(),
      endedAt: new Date("2026-09-15T11:00:00+09:00").toISOString(),
      durationSec: 3600,
      totalCost: 90144,
      outcome: "decided",
      wasteCost: 60096,
      reportUnlocked: false,
      shareUnlocked: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const text = buildShareText(record);

    expect(text).toContain("90,144원");
    expect(text).toContain("60,096원");
    expect(text.includes("AI")).toBe(false);
  });

  it("AC-3[P1]: buildShareText는 회의 제목과 팀명을 포함한다", () => {
    const record: MeetingRecord = {
      id: "rec-001",
      title: "분기별 전략 회의",
      teamName: "전략팀",
      attendees: 8,
      annualSalaryManwon: 6000,
      plannedMinutes: 120,
      startedAt: new Date("2026-09-15T09:00:00+09:00").toISOString(),
      endedAt: new Date("2026-09-15T11:00:00+09:00").toISOString(),
      durationSec: 7200,
      totalCost: 200000,
      outcome: "partial",
      wasteCost: 100000,
      reportUnlocked: true,
      shareUnlocked: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const text = buildShareText(record);

    expect(text.includes("분기별 전략 회의")).toBe(true);
    expect(text.includes("전략팀")).toBe(true);
  });

  // ============ AC-4: renderShareCard — jsdom null canvas context 처리 ============

  it("AC-4[P0]: renderShareCard는 jsdom에서 getContext가 null이면 {ok:false}를 반환하고 예외를 던지지 않는다", () => {
    const mockCanvas = document.createElement("canvas");
    // jsdom에서 canvas.getContext('2d')는 null을 반환함
    vi.spyOn(mockCanvas, "getContext").mockReturnValue(null);

    const record: MeetingRecord = {
      id: "rec-001",
      title: "테스트",
      teamName: "팀A",
      attendees: 5,
      annualSalaryManwon: 5000,
      plannedMinutes: 60,
      startedAt: new Date().toISOString(),
      endedAt: new Date(Date.now() + 3600000).toISOString(),
      durationSec: 3600,
      totalCost: 100000,
      outcome: null,
      wasteCost: null,
      reportUnlocked: false,
      shareUnlocked: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    let threwException = false;
    let result: { ok: boolean } | undefined;

    try {
      result = renderShareCard(mockCanvas, record);
    } catch (e) {
      threwException = true;
    }

    expect(threwException).toBe(false);
    expect(result).toBeDefined();
    expect(result?.ok).toBe(false);
  });

  it("AC-4[P1]: renderShareCard는 유효한 canvas 2d context에서 {ok:true}를 반환한다 (또는 정상 렌더링함)", () => {
    const mockCanvas = document.createElement("canvas");
    const mockCtx = {
      fillStyle: "",
      fillRect: vi.fn(),
      fillText: vi.fn(),
      font: "",
      textAlign: "left" as const,
      strokeStyle: "",
      strokeRect: vi.fn(),
      drawImage: vi.fn(),
    };
    vi.spyOn(mockCanvas, "getContext").mockReturnValue(mockCtx as any);

    const record: MeetingRecord = {
      id: "rec-001",
      title: "테스트",
      teamName: "팀A",
      attendees: 5,
      annualSalaryManwon: 5000,
      plannedMinutes: 60,
      startedAt: new Date().toISOString(),
      endedAt: new Date(Date.now() + 3600000).toISOString(),
      durationSec: 3600,
      totalCost: 100000,
      outcome: null,
      wasteCost: null,
      reportUnlocked: false,
      shareUnlocked: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const result = renderShareCard(mockCanvas, record);

    expect(result).toBeDefined();
    expect(result.ok).toBe(true);
  });
});

// ============ Helper Functions (Test Utilities) ============

/**
 * 로컬 타임존 기준 월요일 00:00을 반환합니다 (테스트 유틸리티).
 */
function getMonday00Local(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

/**
 * makeRecord는 테스트 데이터용 MeetingRecord를 생성합니다.
 */
function makeRecord(id: string, endedAtMs: number): MeetingRecord {
  return {
    id,
    title: `회의 ${id}`,
    teamName: "팀A",
    attendees: 5,
    annualSalaryManwon: 5000,
    plannedMinutes: 60,
    startedAt: new Date(endedAtMs - 3600000).toISOString(),
    endedAt: new Date(endedAtMs).toISOString(),
    durationSec: 3600,
    totalCost: 50000,
    outcome: null,
    wasteCost: null,
    reportUnlocked: false,
    shareUnlocked: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
