import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import TimerDisplay from "@/components/meeting/TimerDisplay";
import type { ActiveMeeting } from "@/lib/types";

vi.mock("@toss/tds-mobile", () => {
  const R = require("react");
  const h = R.createElement;
  return {
    Button: ({ children, onClick, ...p }: any) => h("button", { onClick }, children),
    Spacing: ({ size }: any) => h("div", { "data-spacing": size }),
    Paragraph: {
      Text: ({ children, typography, ...p }: any) => h("span", { "data-typography": typography }, children),
    },
    Badge: ({ children }: any) => h("span", null, children),
  };
});
vi.mock("@apps-in-toss/web-framework", () => ({
  generateHapticFeedback: vi.fn(),
}));
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => ({
  ...(await vi.importActual<typeof import("react-router-dom")>("react-router-dom")),
  useNavigate: () => mockNavigate,
}));

// 5명 × 연봉 5000만 원 × 예정 30분 → 2700초 = 90,144원, 초과 900초 = 30,048원
const START = 1_780_000_000_000;
const base: ActiveMeeting = {
  id: "active-1",
  setup: {
    title: "주간 스프린트 회의",
    teamName: "프론트엔드팀",
    attendees: 5,
    annualSalaryManwon: 5000,
    plannedMinutes: 30,
  },
  startedAt: START,
  pausedAt: null,
  totalPausedMs: 0,
  createdAt: "2026-09-19T01:00:00.000Z",
  updatedAt: "2026-09-19T01:00:00.000Z",
};

const renderTimer = (active: ActiveMeeting, now: number) =>
  render(
    React.createElement(
      MemoryRouter,
      null,
      React.createElement(TimerDisplay, { active, now }),
    ),
  );

describe("S3 타이머 표시 조각 (실시간 비용, 경과 시간, 초과 표시)", () => {
  it("AC-1[P0]: 2700초 경과 시 누적 비용 '90,144원'과 경과 '00:45:00'을 표시한다", () => {
    renderTimer(base, START + 2_700_000);
    expect(screen.getByText("90,144원")).toBeInTheDocument();
    expect(screen.getByText("00:45:00")).toBeInTheDocument();
  });

  it("AC-1[P0]: 예정 시간 안이면 초과 표시가 없고 비용·시간이 경과에 맞다", () => {
    renderTimer(base, START + 1_800_000);
    expect(screen.getByText("60,096원")).toBeInTheDocument();
    expect(screen.getByText("00:30:00")).toBeInTheDocument();
    expect(screen.queryByText(/초과/)).toBeNull();
  });

  it("AC-2[P0]: 예정 30분에서 2700초 경과 시 '15분 초과'와 '30,048원'을 표시한다", () => {
    renderTimer(base, START + 2_700_000);
    expect(screen.getByText("15분 초과")).toBeInTheDocument();
    expect(screen.getByText("30,048원")).toBeInTheDocument();
  });

  it("AC-3[P0]: pausedAt이 있으면 '일시정지 중'을 표시하고 now가 늘어도 비용이 변하지 않는다", () => {
    const paused: ActiveMeeting = { ...base, pausedAt: START + 1_800_000 };
    const first = renderTimer(paused, START + 1_900_000);
    expect(screen.getByText("일시정지 중")).toBeInTheDocument();
    expect(screen.getByText("60,096원")).toBeInTheDocument();
    first.unmount();

    renderTimer(paused, START + 2_500_000);
    expect(screen.getByText("일시정지 중")).toBeInTheDocument();
    expect(screen.getByText("60,096원")).toBeInTheDocument();
    expect(screen.getByText("00:30:00")).toBeInTheDocument();
  });

  it("AC-3[P0]: 일시정지가 아니면 '일시정지 중'을 표시하지 않는다", () => {
    renderTimer(base, START + 600_000);
    expect(screen.queryByText("일시정지 중")).toBeNull();
    expect(screen.getByText("00:10:00")).toBeInTheDocument();
  });

  it("AC-4[P0]: 경과 초가 28800을 넘어도 '08:00:00'으로 표시하고 비용도 상한에서 멈춘다", () => {
    renderTimer(base, START + 30_000_000);
    expect(screen.getByText("08:00:00")).toBeInTheDocument();
    expect(screen.getByText("961,538원")).toBeInTheDocument();
    expect(screen.queryByText("08:20:00")).toBeNull();
  });
});
