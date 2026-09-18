import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { mockAll } from "@/__tests__/__helpers__/mocks";
import { renderWithRouter } from "@/__tests__/__helpers__/test-utils";
import Challenge from "@/pages/Challenge";

mockAll();

const DAYS = "mcc:v1:noMeetingDays";
const RECORDS = "mcc:v1:records";

function setNow(iso: string) {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(iso));
}

afterEach(() => vi.useRealTimers());

describe("Challenge", () => {
  it("AC-1: 평일 선언하면 오늘 키가 저장되고 버튼이 바뀐다", () => {
    setNow("2026-09-16T10:00:00");
    renderWithRouter(<Challenge />);
    fireEvent.click(screen.getByRole("button", { name: "오늘은 회의 없는 날" }));
    expect(JSON.parse(localStorage.getItem(DAYS) ?? "[]")[0].date).toBe("2026-09-16");
    const done = screen.getByRole("button", { name: "오늘은 선언했어요" });
    expect(done).toBeDisabled();
  });

  it("AC-2: 주말이면 비활성화 사유를 보여준다", () => {
    setNow("2026-09-19T10:00:00");
    renderWithRouter(<Challenge />);
    expect(screen.getByRole("button", { name: "오늘은 회의 없는 날" })).toBeDisabled();
    expect(screen.getByText("주말에는 선언할 수 없어요")).toBeInTheDocument();
  });

  it("AC-3: 오늘 기록이 있으면 비활성화된다", () => {
    setNow("2026-09-16T10:00:00");
    const t = new Date("2026-09-16T09:00:00").toISOString();
    localStorage.setItem(
      RECORDS,
      JSON.stringify([
        {
          id: "r1", title: "a", teamName: "t", attendees: 2, annualSalaryManwon: 5000, plannedMinutes: 30,
          startedAt: t, endedAt: t, durationSec: 600, totalCost: 1000, outcome: null, wasteCost: null,
          reportUnlocked: false, shareUnlocked: false, createdAt: t, updatedAt: t,
        },
      ]),
    );
    renderWithRouter(<Challenge />);
    expect(screen.getByRole("button", { name: "오늘은 회의 없는 날" })).toBeDisabled();
    expect(screen.getByText("오늘은 이미 회의가 있었어요")).toBeInTheDocument();
  });

  it("AC-4: 첫 선언이면 배지 시트가 열린다", () => {
    setNow("2026-09-16T10:00:00");
    renderWithRouter(<Challenge />);
    fireEvent.click(screen.getByRole("button", { name: "오늘은 회의 없는 날" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("첫 회의 없는 날");
  });
});
