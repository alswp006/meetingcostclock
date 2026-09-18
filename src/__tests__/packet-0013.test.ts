import { describe, it, expect, vi, afterEach } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import { mockTds, mockAppsInToss } from "@/__tests__/__helpers__/mocks";

// Set up mocks BEFORE importing modules that use them (hoisted at module load time)
mockTds();
mockAppsInToss();

// Import SDK modules AFTER mocks are registered
import { generateHapticFeedback } from "@apps-in-toss/web-framework";
import { failSetItemOnNth } from "@/lib/__tests__/failSetItemOnNth";
import { QUOTA_TOAST } from "@/lib/messages";
import Wrapup from "@/pages/Wrapup";
import type { MeetingRecord } from "@/lib/types";

// 5명 · 연봉 5,000만 원 · 예정 30분 · 실제 45분 → 총비용 90,144원, 초과 30,048원
const RECORD: MeetingRecord = {
  id: "rec-wrapup-1",
  title: "주간 회의",
  teamName: "우리 팀",
  attendees: 5,
  annualSalaryManwon: 5000,
  plannedMinutes: 30,
  startedAt: "2026-09-01T01:00:00.000Z",
  endedAt: "2026-09-01T01:45:00.000Z",
  durationSec: 2700,
  totalCost: 90144,
  outcome: null,
  wasteCost: null,
  reportUnlocked: false,
  shareUnlocked: false,
  createdAt: "2026-09-01T01:45:00.000Z",
  updatedAt: "2026-09-01T01:45:00.000Z",
};

function seed() {
  localStorage.setItem("mcc:v1:records", JSON.stringify([RECORD]));
}

function stored(): MeetingRecord {
  const list = JSON.parse(localStorage.getItem("mcc:v1:records") ?? "[]") as MeetingRecord[];
  return list.find((r) => r.id === RECORD.id) as MeetingRecord;
}

function LocationProbe() {
  const loc = useLocation();
  return React.createElement("div", { "data-testid": "pathname" }, loc.pathname);
}

function renderAt(path: string) {
  return render(
    React.createElement(
      MemoryRouter,
      { initialEntries: [path] },
      React.createElement(
        Routes,
        null,
        React.createElement(Route, {
          path: "/wrapup/:id",
          element: React.createElement(Wrapup),
        }),
        React.createElement(Route, {
          path: "/report/:id",
          element: React.createElement("div", null, "report-stub"),
        }),
      ),
      React.createElement(LocationProbe),
    ),
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("S4 회고 페이지 (/wrapup/:id: 결론 여부 선택)", () => {
  it("AC-1[P0]: 존재하지 않는 id면 '기록을 찾을 수 없어요'를 표시한다", () => {
    seed();
    renderAt("/wrapup/does-not-exist");
    expect(screen.getByText("기록을 찾을 수 없어요")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "리포트 보기" })).toBeNull();
  });

  it("기록이 있으면 결론 Chip 3개와 총비용 요약을 보여준다", () => {
    seed();
    renderAt(`/wrapup/${RECORD.id}`);
    expect(screen.queryByText("기록을 찾을 수 없어요")).toBeNull();
    expect(screen.getByText("결론 났어요")).toBeInTheDocument();
    expect(screen.getByText("일부만 났어요")).toBeInTheDocument();
    expect(screen.getByText("결론이 없었어요")).toBeInTheDocument();
    expect(document.body.textContent).toContain("90,144");
  });

  it("AC-2[P0]: outcome을 고르지 않으면 '리포트 보기'가 disabled이고 고르면 활성화된다", () => {
    seed();
    renderAt(`/wrapup/${RECORD.id}`);
    expect(screen.getByRole("button", { name: "리포트 보기" })).toBeDisabled();
    fireEvent.click(screen.getByText("일부만 났어요"));
    expect(screen.getByRole("button", { name: "리포트 보기" })).toBeEnabled();
    expect(screen.getByText("일부만 났어요").closest("button")).toHaveAttribute("aria-pressed", "true");
  });

  it("Chip을 선택하면 tickWeak 햅틱을 준다", () => {
    seed();
    renderAt(`/wrapup/${RECORD.id}`);
    fireEvent.click(screen.getByText("결론 났어요"));
    expect(generateHapticFeedback).toHaveBeenCalledWith({ type: "tickWeak" });
    expect(generateHapticFeedback).toHaveBeenCalledTimes(1);
  });

  it("AC-3[P0]: '결론이 없었어요' 제출 시 outcome='none', wasteCost=60096으로 저장하고 /report/{id}로 이동한다", () => {
    seed();
    renderAt(`/wrapup/${RECORD.id}`);
    fireEvent.click(screen.getByText("결론이 없었어요"));
    fireEvent.click(screen.getByRole("button", { name: "리포트 보기" }));

    const saved = stored();
    expect(saved.outcome).toBe("none");
    expect(saved.wasteCost).toBe(60096);
    expect(screen.getByTestId("pathname").textContent).toBe(`/report/${RECORD.id}`);
  });

  it("AC-3: '결론 났어요'면 wasteCost는 초과 비용 30048이다", () => {
    seed();
    renderAt(`/wrapup/${RECORD.id}`);
    fireEvent.click(screen.getByText("결론 났어요"));
    fireEvent.click(screen.getByRole("button", { name: "리포트 보기" }));

    const saved = stored();
    expect(saved.outcome).toBe("decided");
    expect(saved.wasteCost).toBe(30048);
    expect(screen.getByTestId("pathname").textContent).toBe(`/report/${RECORD.id}`);
  });

  it("AC-4[P0]: updateRecord가 quota로 실패하면 QUOTA_TOAST를 표시하고 이동하지 않는다", () => {
    seed();
    renderAt(`/wrapup/${RECORD.id}`);
    fireEvent.click(screen.getByText("결론이 없었어요"));
    failSetItemOnNth(1);
    fireEvent.click(screen.getByRole("button", { name: "리포트 보기" }));

    expect(screen.getByText(QUOTA_TOAST)).toBeInTheDocument();
    expect(screen.getByTestId("pathname").textContent).toBe(`/wrapup/${RECORD.id}`);
    expect(stored().outcome).toBeNull();
    expect(stored().wasteCost).toBeNull();
  });
});
