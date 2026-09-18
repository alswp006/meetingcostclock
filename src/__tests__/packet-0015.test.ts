import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import { mockTds, mockAppsInToss } from "@/__tests__/__helpers__/mocks";

mockTds();
mockAppsInToss();

import Home from "@/pages/Home";
import type { ActiveMeeting, MeetingRecord } from "@/lib/types";

const NOW = new Date("2026-09-16T03:00:00.000Z"); // 수요일

function makeRecord(over: Partial<MeetingRecord>): MeetingRecord {
  return {
    id: "r1",
    title: "주간 회의",
    teamName: "제품팀",
    attendees: 5,
    annualSalaryManwon: 5000,
    plannedMinutes: 30,
    startedAt: "2026-09-16T01:00:00.000Z",
    endedAt: "2026-09-16T01:45:00.000Z",
    durationSec: 2700,
    totalCost: 90144,
    outcome: null,
    wasteCost: null,
    reportUnlocked: false,
    shareUnlocked: false,
    createdAt: "2026-09-16T01:45:00.000Z",
    updatedAt: "2026-09-16T01:45:00.000Z",
    ...over,
  };
}

const REC_A = makeRecord({ id: "rec-a", title: "주간 회의", totalCost: 90144, outcome: null });
const REC_B = makeRecord({
  id: "rec-b",
  title: "기획 리뷰",
  totalCost: 30030,
  outcome: "decided",
  endedAt: "2026-09-15T05:45:00.000Z",
  startedAt: "2026-09-15T05:15:00.000Z",
  durationSec: 1800,
});

const ACTIVE: ActiveMeeting = {
  id: "act-1",
  setup: { title: "스프린트 계획", teamName: "제품팀", attendees: 5, annualSalaryManwon: 5000, plannedMinutes: 30 },
  startedAt: NOW.getTime() - 60_000,
  pausedAt: null,
  totalPausedMs: 0,
  createdAt: NOW.toISOString(),
  updatedAt: NOW.toISOString(),
};

function Path() {
  return React.createElement("div", { "data-testid": "path" }, useLocation().pathname);
}

function renderHome() {
  return render(
    React.createElement(
      MemoryRouter,
      { initialEntries: ["/"] },
      React.createElement(
        Routes,
        null,
        React.createElement(Route, { path: "/", element: React.createElement(Home) }),
        React.createElement(Route, { path: "*", element: null }),
      ),
      React.createElement(Path),
    ),
  );
}

function seed(records: MeetingRecord[], active?: ActiveMeeting) {
  localStorage.setItem("mcc:v1:records", JSON.stringify(records));
  if (active) localStorage.setItem("mcc:v1:active", JSON.stringify(active));
}

beforeEach(() => {
  vi.useFakeTimers({ now: NOW });
});

describe("S1 홈 대시보드 (/: 진행 중 카드, 이번 주 합계, 최근 회의)", () => {
  it("AC-1[P0]: 기록 0건 + active 없음이면 빈 상태 문구를 보이고 주간 히어로는 없다", () => {
    renderHome();
    expect(screen.getByText("회의 한 번에 얼마가 드는지 확인해보세요")).toBeTruthy();
    expect(screen.queryAllByTestId("week-summary-hero")).toHaveLength(0);
    expect(screen.queryAllByTestId("active-meeting-card")).toHaveLength(0);
  });

  it("AC-1[P0]: 빈 상태에서 SubmitFooter를 누르면 /setup으로 이동한다", () => {
    renderHome();
    expect(screen.getByTestId("path").textContent).toBe("/");
    const footer = screen.getAllByRole("button").filter((b) => /시작/.test(b.textContent ?? ""));
    expect(footer.length).toBeGreaterThan(0);
    fireEvent.click(footer[footer.length - 1]);
    expect(screen.getByTestId("path").textContent).toBe("/setup");
  });

  it("AC-2[P0]: 이번 주 기록 2건(90144, 30030)이면 히어로에 '120,174원'과 '이번 주 회의 2회'를 표시한다", () => {
    seed([REC_A, REC_B]);
    renderHome();
    const hero = screen.getAllByTestId("week-summary-hero");
    expect(hero).toHaveLength(1);
    expect(hero[0].textContent).toContain("120,174원");
    expect(hero[0].textContent).toContain("이번 주 회의 2회");
    expect(screen.queryByText("회의 한 번에 얼마가 드는지 확인해보세요")).toBeNull();
  });

  it("AC-3[P0]: active가 있으면 진행 중 카드와 '진행 중인 회의로 이동' CTA가 보이고 탭하면 /meeting으로 간다", () => {
    seed([], ACTIVE);
    renderHome();
    const card = screen.getAllByTestId("active-meeting-card");
    expect(card).toHaveLength(1);
    expect(card[0].textContent).toContain("스프린트 계획");
    const cta = screen.getByRole("button", { name: "진행 중인 회의로 이동" });
    fireEvent.click(cta);
    expect(screen.getByTestId("path").textContent).toBe("/meeting");
  });

  it("AC-3[P1]: 진행 중 카드의 비용이 1초마다 갱신된다", () => {
    seed([], ACTIVE);
    renderHome();
    const before = screen.getByTestId("active-meeting-card").textContent;
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    const after = screen.getByTestId("active-meeting-card").textContent;
    expect(before).toMatch(/원/);
    expect(after).not.toBe(before);
  });

  it("AC-4[P0]: outcome이 null인 최근 회의 행을 탭하면 /wrapup/{id}로 이동한다", () => {
    seed([REC_A, REC_B]);
    renderHome();
    expect(screen.getByText("기획 리뷰")).toBeTruthy();
    fireEvent.click(screen.getByText("주간 회의"));
    expect(screen.getByTestId("path").textContent).toBe("/wrapup/rec-a");
  });

  it("AC-4[P0]: outcome이 있는 최근 회의 행을 탭하면 /report/{id}로 이동한다", () => {
    seed([REC_A, REC_B]);
    renderHome();
    fireEvent.click(screen.getByText("기획 리뷰"));
    expect(screen.getByTestId("path").textContent).toBe("/report/rec-b");
    expect(screen.queryByText("기획 리뷰")).toBeNull();
  });

  it("최근 회의는 최대 3건만 보여준다", () => {
    const many = ["a", "b", "c", "d"].map((k, i) =>
      makeRecord({
        id: `rec-${k}`,
        title: `회의 ${k}`,
        endedAt: `2026-09-1${5 + (i % 2)}T0${i + 1}:00:00.000Z`,
      }),
    );
    seed(many);
    renderHome();
    const shown = many.filter((r) => screen.queryByText(r.title));
    expect(shown).toHaveLength(3);
    expect(screen.queryByText("회의 a")).toBeNull();
  });
});
