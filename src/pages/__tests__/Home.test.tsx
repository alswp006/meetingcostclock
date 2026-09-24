import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { mockTds, mockAppsInToss } from "@/__tests__/__helpers__/mocks";

mockTds();
mockAppsInToss();

import Home from "@/pages/Home";

describe("Home 레이아웃", () => {
  it("빈 상태에서 1차 CTA는 하나이고 주간 히어로는 없다", () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );
    expect(screen.getAllByRole("button", { name: "새 회의 시작" })).toHaveLength(1);
    expect(screen.queryAllByTestId("week-summary-hero")).toHaveLength(0);
  });

  it("M2: 최근 회의 부제의 회의 길이는 공통 표기다 — 12초 회의는 '1분'이 아니라 '12초'", () => {
    const ended = new Date();
    const started = new Date(ended.getTime() - 12_000);
    localStorage.setItem(
      "mcc:v1:records",
      JSON.stringify([
        {
          id: "r12",
          title: "주간회의",
          teamName: "제품팀",
          attendees: 6,
          annualSalaryManwon: 6000,
          plannedMinutes: 30,
          startedAt: started.toISOString(),
          endedAt: ended.toISOString(),
          durationSec: 12,
          totalCost: 576,
          outcome: null,
          wasteCost: null,
          reportUnlocked: false,
          shareUnlocked: false,
          createdAt: ended.toISOString(),
          updatedAt: ended.toISOString(),
        },
      ]),
    );
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );
    expect(screen.getByText(`${ended.getMonth() + 1}월 ${ended.getDate()}일 · 12초 · 6명`)).toBeInTheDocument();
    expect(screen.queryByText(/· 1분 ·/)).toBeNull();
  });
});
