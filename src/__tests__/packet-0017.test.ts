import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { mockTds, mockAppsInToss } from "@/__tests__/__helpers__/mocks";

const { mockNavigate } = vi.hoisted(() => ({ mockNavigate: vi.fn() }));
vi.mock("react-router-dom", async () => ({
  ...(await vi.importActual<typeof import("react-router-dom")>("react-router-dom")),
  useNavigate: () => mockNavigate,
}));

mockTds();
mockAppsInToss();

import History from "@/pages/History";

const NOW = new Date(2026, 8, 15, 12, 0, 0); // 2026-09-15 12:00 로컬
const RECORDS_KEY = "mcc:v1:records";
const NMD_KEY = "mcc:v1:noMeetingDays";

function makeRecord(i: number, over: Record<string, unknown> = {}) {
  const ended = new Date(NOW.getTime() - (i + 1) * 3600_000);
  const started = new Date(ended.getTime() - 45 * 60_000);
  return {
    id: `r${i}`,
    title: `회의 ${i}`,
    teamName: "팀A",
    attendees: 5,
    annualSalaryManwon: 5000,
    plannedMinutes: 45,
    startedAt: started.toISOString(),
    endedAt: ended.toISOString(),
    durationSec: 2700,
    totalCost: 10000 + i,
    outcome: null,
    wasteCost: null,
    reportUnlocked: false,
    shareUnlocked: false,
    createdAt: ended.toISOString(),
    updatedAt: ended.toISOString(),
    ...over,
  };
}

function seedRecords(rows: unknown[]) {
  localStorage.setItem(RECORDS_KEY, JSON.stringify(rows));
}

function renderHistory() {
  return render(
    React.createElement(MemoryRouter, { initialEntries: ["/history"] }, React.createElement(History)),
  );
}

const rowCount = () => screen.queryAllByTestId("record-more-button").length;
const flat = (el: Element) => (el.textContent ?? "").replace(/\s+/g, "");

describe("[부가] S7 기록 페이지 (/history: 목록 탭, 팀 랭킹 탭, 삭제, 배너)", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("AC-1[P0]: 기록 25건이면 처음 20행, '더보기' 탭 후 25행", async () => {
    seedRecords(Array.from({ length: 25 }, (_, i) => makeRecord(i)));
    renderHistory();

    await waitFor(() => expect(rowCount()).toBe(20));
    expect(screen.queryByText("회의 20")).toBeNull();

    const more = screen
      .getAllByRole("button", { name: /더\s?보기/ })
      .find((b) => /더\s?보기/.test(b.textContent ?? ""));
    expect(more).toBeDefined();
    fireEvent.click(more!);

    await waitFor(() => expect(rowCount()).toBe(25));
    expect(screen.getByText("회의 24")).toBeInTheDocument();
    // 25행이면 더 불러올 게 없으므로 텍스트 '더보기' 버튼은 사라진다
    expect(
      screen.queryAllByRole("button").filter((b) => /더\s?보기/.test(b.textContent ?? "")),
    ).toHaveLength(0);
  });

  it("AC-2[P0]: 저장소가 corrupted면 오류 문구와 '다시 시도'가 보이고, 누르면 다시 읽는다", async () => {
    localStorage.setItem(RECORDS_KEY, "{not json");
    renderHistory();

    expect(await screen.findByText("기록을 불러오지 못했어요")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다시 시도" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "새 회의 시작" })).toBeNull();

    seedRecords([makeRecord(0), makeRecord(1)]);
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    await waitFor(() => expect(rowCount()).toBe(2));
    expect(screen.queryByText("기록을 불러오지 못했어요")).toBeNull();
  });

  it("AC-2[P0]: 기록이 0건이면 빈 상태와 '새 회의 시작' 버튼이 보인다", async () => {
    renderHistory();

    const start = await screen.findByRole("button", { name: "새 회의 시작" });
    expect(rowCount()).toBe(0);
    expect(screen.queryByText("기록을 불러오지 못했어요")).toBeNull();
    fireEvent.click(start);
    expect(mockNavigate).toHaveBeenCalledWith("/setup");
  });

  it("AC-3[P0]: 삭제를 확정하면 해당 id만 records에서 사라지고 NoMeetingDay는 복원되지 않는다", async () => {
    seedRecords([makeRecord(0), makeRecord(1), makeRecord(2)]);
    const stamp = NOW.toISOString();
    const nmd = ["2026-09-10", "2026-09-11"].map((d) => ({
      id: d,
      date: d,
      createdAt: stamp,
      updatedAt: stamp,
    }));
    localStorage.setItem(NMD_KEY, JSON.stringify(nmd));
    renderHistory();
    await waitFor(() => expect(rowCount()).toBe(3));

    fireEvent.click(screen.getAllByTestId("record-more-button")[0]);
    fireEvent.click(await screen.findByText("기록 삭제"));
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "삭제" }));

    await waitFor(() => expect(rowCount()).toBe(2));
    const ids = (JSON.parse(localStorage.getItem(RECORDS_KEY) ?? "[]") as { id: string }[]).map(
      (r) => r.id,
    );
    expect(ids).toEqual(["r1", "r2"]);
    expect(JSON.parse(localStorage.getItem(NMD_KEY) ?? "[]")).toHaveLength(2);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("AC-3[P0]: 다이얼로그를 '닫기'로 닫으면 기록은 그대로 남는다", async () => {
    seedRecords([makeRecord(0), makeRecord(1)]);
    renderHistory();
    await waitFor(() => expect(rowCount()).toBe(2));

    fireEvent.click(screen.getAllByTestId("record-more-button")[0]);
    fireEvent.click(await screen.findByText("기록 삭제"));
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "닫기" }));

    expect(JSON.parse(localStorage.getItem(RECORDS_KEY) ?? "[]")).toHaveLength(2);
    expect(rowCount()).toBe(2);
  });

  it("AC-4[P0]: '팀 랭킹' 탭은 이번 달 팀별 합계를 내림차순 '1위 팀A 180,288원'으로 보여준다", async () => {
    seedRecords([
      makeRecord(0, { teamName: "팀A", totalCost: 100000 }),
      makeRecord(1, { teamName: "팀B", totalCost: 50000 }),
      makeRecord(2, { teamName: "팀A", totalCost: 80288 }),
      // 지난달 기록은 합산에서 제외된다
      makeRecord(3, {
        teamName: "팀C",
        totalCost: 900000,
        startedAt: new Date(2026, 7, 10, 9, 0).toISOString(),
        endedAt: new Date(2026, 7, 10, 10, 0).toISOString(),
      }),
    ]);
    renderHistory();
    await waitFor(() => expect(rowCount()).toBe(4));

    fireEvent.click(screen.getByRole("tab", { name: "팀 랭킹" }));

    // 기본값은 "전체" — 이번 달로 좁힌다
    fireEvent.click(screen.getByRole("radio", { name: "이번 달" }));
    const rows = await screen.findAllByTestId("team-rank-row");
    expect(rows).toHaveLength(2);
    expect(flat(rows[0])).toContain("1위팀A180,288원");
    expect(flat(rows[1])).toContain("2위팀B50,000원");
    expect(screen.queryByText(/팀C/)).toBeNull();
  });
});
