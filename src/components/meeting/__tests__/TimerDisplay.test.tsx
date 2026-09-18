import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { mockAll } from "@/__tests__/__helpers__/mocks";
import { renderWithRouter } from "@/__tests__/__helpers__/test-utils";
import { TimerDisplay } from "@/components/meeting/TimerDisplay";
import type { ActiveMeeting } from "@/lib/types";

mockAll();

const START = 1_700_000_000_000;
const active: ActiveMeeting = {
  id: "a1",
  setup: {
    title: "주간 회의",
    teamName: "우리 팀",
    attendees: 5,
    annualSalaryManwon: 5000,
    plannedMinutes: 30,
  },
  startedAt: START,
  pausedAt: null,
  totalPausedMs: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("TimerDisplay", () => {
  it("AC-1: 비용과 경과 시간 표시", () => {
    renderWithRouter(<TimerDisplay active={active} now={START + 2_700_000} />);
    expect(screen.getByText("90,144원")).toBeInTheDocument();
    expect(screen.getByText(/00:45:00/)).toBeInTheDocument();
  });

  it("AC-2: 초과 시간과 초과 비용", () => {
    renderWithRouter(<TimerDisplay active={active} now={START + 2_700_000} />);
    expect(screen.getByText("15분 초과")).toBeInTheDocument();
    expect(screen.getByText("30,048원")).toBeInTheDocument();
  });

  it("예정 시간 이내면 초과 영역 없음", () => {
    renderWithRouter(<TimerDisplay active={active} now={START + 600_000} />);
    expect(screen.queryByTestId("timer-over")).toBeNull();
  });

  it("AC-3: 일시정지 중이면 비용이 고정된다", () => {
    const paused = { ...active, pausedAt: START + 600_000 };
    const { unmount } = renderWithRouter(<TimerDisplay active={paused} now={START + 700_000} />);
    expect(screen.getByText("일시정지 중")).toBeInTheDocument();
    const before = screen.getByTestId("timer-hero").textContent;
    unmount();
    renderWithRouter(<TimerDisplay active={paused} now={START + 900_000} />);
    expect(screen.getByTestId("timer-hero").textContent).toBe(before);
  });

  it("AC-4: 8시간 상한", () => {
    renderWithRouter(<TimerDisplay active={active} now={START + 30_000_000} />);
    expect(screen.getByText(/08:00:00/)).toBeInTheDocument();
  });
});
